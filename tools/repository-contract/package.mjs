// Local Git/filesystem adapter. Never fetches, checks out files, runs a recipe,
// signs, pays or submits. Content addresses are the only payload filenames.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { bytesDigest, canonicalDocument, parseDocument, need, record, text, integer, list } from './contract.mjs';
import { commitLinks, validateManifest } from './manifest.mjs';

export const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;
function git(repo, args, input, maxBuffer = DEFAULT_MAX_BYTES) {
  const env = { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0' };
  for (const name of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS']) delete env[name];
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.hooksPath=', '-C', resolve(repo), ...args], {
    input, maxBuffer, windowsHide: true, env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
function regularBytes(path, maxBytes) {
  const stat = lstatSync(path); need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= maxBytes, 'RESOURCE_LIMIT');
  const bytes = readFileSync(path); need(bytes.length <= maxBytes, 'RESOURCE_LIMIT'); return bytes;
}
export function readDocument(path) { return parseDocument(regularBytes(path, 32 * 1024 * 1024)); }
export function writeDocument(path, doc) { writeFileSync(path, canonicalDocument(doc), { flag: 'wx' }); }

export function packSnapshot({ repo, repository, ref, plan, out, maxBytes = DEFAULT_MAX_BYTES }) {
  integer(maxBytes, 1); text(repository); record(plan, ['recipes', 'files']);
  list(plan.files); list(plan.recipes, 1, 64);
  const head = git(repo, ['rev-parse', '--verify', 'HEAD^{commit}']).toString().trim();
  const commit = git(repo, ['cat-file', 'commit', head]);
  const { tree, parents } = commitLinks(commit);
  const treeRows = git(repo, ['ls-tree', '-r', '-t', '-z', tree]).toString('utf8').split('\0').filter(Boolean);
  const ids = [...new Set([head, tree, ...treeRows.map(row => {
    const match = /^([0-9]+) (blob|tree|commit) ([0-9a-f]{40})\t/.exec(row); need(match, 'GIT_TREE');
    need(match[1] !== '160000', 'EXTERNAL_OBJECT'); return match[3];
  })])].sort();
  need(ids.length <= 100_000, 'RESOURCE_LIMIT');
  const input = ids.join('\n') + '\n';
  const sizes = git(repo, ['cat-file', '--batch-check'], input).toString().trim().split('\n').map(row => {
    const parts = row.split(' '); need(parts.length === 3 && /^\d+$/.test(parts[2]), 'GIT_OBJECT'); return Number(parts[2]);
  });
  need(sizes.reduce((a, b) => a + b, 0) <= maxBytes, 'RESOURCE_LIMIT');
  const batch = git(repo, ['cat-file', '--batch'], input, maxBytes + ids.length * 128);
  const payloads = new Map(), objects = []; let offset = 0;
  for (const id of ids) {
    const end = batch.indexOf(10, offset); need(end > offset, 'GIT_OBJECT');
    const [observed, kind, count] = batch.subarray(offset, end).toString().split(' '); const size = Number(count);
    need(observed === id && Number.isSafeInteger(size) && size >= 0 && batch[end + 1 + size] === 10, 'GIT_OBJECT');
    const bytes = batch.subarray(end + 1, end + 1 + size), digest = bytesDigest(bytes);
    objects.push({ oid: id, kind, bytes: size, digest }); payloads.set(digest, bytes); offset = end + size + 2;
  }
  need(offset === batch.length, 'GIT_OBJECT');
  let carried = sizes.reduce((a, b) => a + b, 0);
  const files = plan.files.map(file => {
    record(file, ['name', 'role', 'path']); const bytes = regularBytes(file.path, maxBytes - carried), digest = bytesDigest(bytes); carried += bytes.length;
    payloads.set(digest, bytes); return { name: file.name, role: file.role, bytes: bytes.length, digest };
  });
  const manifest = { schema: 'bnr.repository-manifest/1', repository, ref,
    source: { object_format: 'sha1', history: 'snapshot', commit: head, tree, parents, objects }, files, recipes: plan.recipes };
  validateManifest(manifest, payloads, maxBytes);
  const directory = resolve(out); mkdirSync(directory); mkdirSync(join(directory, 'objects'));
  for (const [digest, bytes] of payloads) writeFileSync(join(directory, 'objects', digest.slice(7)), bytes, { flag: 'wx' });
  writeDocument(join(directory, 'manifest.json'), manifest);
  return { manifest, directory };
}

export function loadPackage(directory, observationDigests = [], maxBytes = DEFAULT_MAX_BYTES) {
  const root = resolve(directory); need(!lstatSync(join(root, 'objects')).isSymbolicLink(), 'OBJECT_PATH');
  const manifest = readDocument(join(root, 'manifest.json'));
  const entries = [...manifest.source.objects, ...manifest.files];
  const digests = new Set([...entries.map(e => e.digest), ...observationDigests]);
  need(digests.size <= 100_000, 'RESOURCE_LIMIT');
  const payloads = new Map(); let total = 0;
  for (const digest of digests) {
    need(typeof digest === 'string' && /^sha256:[a-f0-9]{64}$/.test(digest), 'OBJECT_PATH');
    const bytes = regularBytes(join(root, 'objects', digest.slice(7)), maxBytes - total); total += bytes.length;
    need(total <= maxBytes, 'RESOURCE_LIMIT'); payloads.set(digest, bytes);
  }
  validateManifest(manifest, payloads, maxBytes);
  return { manifest, payloads };
}

export function restoreSnapshot(directory, out, maxBytes = DEFAULT_MAX_BYTES) {
  const { manifest, payloads } = loadPackage(directory, [], maxBytes);
  const target = resolve(out); mkdirSync(target); // refuses existing repositories
  git(target, ['init', '--bare', '--object-format=sha1', '--template=']);
  for (const entry of manifest.source.objects) {
    // Git's existing loose-object format: zlib(type SP size NUL content).
    // All IDs/content were verified above. Avoid one process per object;
    // Git itself validates the complete reconstructed database below.
    const fanout = join(target, 'objects', entry.oid.slice(0, 2)); mkdirSync(fanout, { recursive: true });
    const raw = Buffer.concat([Buffer.from(`${entry.kind} ${entry.bytes}\0`), payloads.get(entry.digest)]);
    writeFileSync(join(fanout, entry.oid.slice(2)), deflateSync(raw), { flag: 'wx' });
  }
  if (manifest.source.parents.length) writeFileSync(join(target, 'shallow'), manifest.source.commit + '\n', { flag: 'wx' });
  git(target, ['update-ref', manifest.ref, manifest.source.commit, '0'.repeat(40)]);
  git(target, ['symbolic-ref', 'HEAD', manifest.ref]);
  git(target, ['fsck', '--strict', '--no-reflogs']);
  return { restored: true, directory: target, commit: manifest.source.commit, tree: manifest.source.tree, history: 'snapshot', authority: 'untrusted source restoration only' };
}
