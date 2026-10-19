// Exact Git snapshot graph with declared parent boundary, plus build inputs
// and outputs. Git's object id and a SHA-256 commitment both cover every byte.
import { createHash } from 'node:crypto';
import { checkPayload, integer, jsonValue, list, need, oid, record, ref, text, unique, hash } from './contract.mjs';

export function gitOid(kind, bytes) {
  return createHash('sha1').update(`${kind} ${bytes.length}\0`).update(bytes).digest('hex');
}
export function commitLinks(bytes) {
  const end = bytes.indexOf(Buffer.from('\n\n')); need(end > 0, 'GIT_COMMIT');
  const headers = bytes.subarray(0, end).toString('latin1').split('\n');
  const trees = headers.filter(line => line.startsWith('tree '));
  need(trees.length === 1 && headers[0] === trees[0], 'GIT_COMMIT');
  const tree = trees[0].slice(5), parents = headers.filter(line => line.startsWith('parent ')).map(line => line.slice(7));
  oid(tree); parents.forEach(oid); unique(parents); need(parents.length <= 64, 'GIT_COMMIT');
  for (const role of ['author', 'committer']) {
    const rows = headers.filter(line => line.startsWith(role + ' '));
    need(rows.length === 1 && /^[^<>\r\n]+ <[^<>\r\n]+> [0-9]+ [+-][0-9]{4}$/.test(rows[0].slice(role.length + 1)), 'GIT_COMMIT');
  }
  return { tree, parents };
}
export function treeLinks(bytes) {
  const entries = []; let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset), nul = bytes.indexOf(0, space + 1);
    need(space > offset && nul > space + 1 && nul + 21 <= bytes.length, 'GIT_TREE');
    const mode = bytes.subarray(offset, space).toString('ascii');
    need(['40000', '100644', '100755', '120000'].includes(mode), 'EXTERNAL_OBJECT', 'Submodule/gitlink or unsupported mode requires a future manifest version');
    const rawName = bytes.subarray(space + 1, nul);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(rawName);
    need(!['.', '..', '.git'].includes(name.toLowerCase()) && !/[\\/\x00-\x1f\x7f]/.test(name), 'GIT_PATH');
    entries.push({ name, rawName, kind: mode === '40000' ? 'tree' : 'blob', oid: bytes.subarray(nul + 1, nul + 21).toString('hex') });
    offset = nul + 21;
  }
  unique(entries.map(e => e.name));
  for (let i = 1; i < entries.length; i++) {
    const sortKey = e => Buffer.concat([e.rawName, Buffer.from(e.kind === 'tree' ? '/' : '')]);
    need(Buffer.compare(sortKey(entries[i - 1]), sortKey(entries[i])) < 0, 'GIT_TREE');
  }
  return entries;
}
export function validateManifest(m, payloads, maxBytes) {
  jsonValue(m); record(m, ['schema', 'repository', 'ref', 'source', 'files', 'recipes']);
  need(m.schema === 'bnr.repository-manifest/1', 'VERSION'); text(m.repository); ref(m.ref);
  integer(maxBytes, 1); need(payloads instanceof Map && payloads.size <= 100_000, 'SHAPE');
  let total = 0;
  for (const [key, value] of payloads) { hash(key); need(value instanceof Uint8Array, 'SHAPE'); total += value.byteLength; need(total <= maxBytes, 'RESOURCE_LIMIT'); }
  const budget = { used: 0, max: maxBytes };
  const source = m.source;
  record(source, ['object_format', 'history', 'commit', 'tree', 'parents', 'objects']);
  need(source.object_format === 'sha1' && source.history === 'snapshot', 'VERSION');
  oid(source.commit); oid(source.tree); list(source.parents, 0, 64); source.parents.forEach(oid); unique(source.parents);
  list(source.objects, 2); unique(source.objects.map(o => o.oid));
  const objects = new Map();
  for (const entry of source.objects) {
    record(entry, ['oid', 'kind', 'bytes', 'digest']); oid(entry.oid);
    need(['commit', 'tree', 'blob'].includes(entry.kind), 'GIT_KIND');
    const bytes = checkPayload(entry, payloads, budget);
    need(gitOid(entry.kind, bytes) === entry.oid, 'GIT_OID');
    // A pointer alone cannot claim to carry the LFS object it names.
    need(entry.kind !== 'blob' || !/^version https:\/\/git-lfs.github.com\/spec\/v1(?:\r?\n|$)/.test(bytes.subarray(0, 100).toString('utf8')), 'EXTERNAL_OBJECT', 'LFS content must be resolved by a future manifest version');
    objects.set(entry.oid, { kind: entry.kind, bytes });
  }
  const visited = new Set();
  const visit = (id, kind, depth = 0) => {
    need(depth <= 256, 'RESOURCE_LIMIT');
    const object = objects.get(id); need(object?.kind === kind, 'GIT_CLOSURE');
    if (visited.has(id)) return;
    visited.add(id);
    if (kind === 'tree') for (const e of treeLinks(object.bytes)) visit(e.oid, e.kind, depth + 1);
  };
  visit(source.commit, 'commit');
  const links = commitLinks(objects.get(source.commit).bytes);
  need(links.tree === source.tree && JSON.stringify(links.parents) === JSON.stringify(source.parents), 'GIT_BINDING');
  visit(source.tree, 'tree');
  need(visited.size === objects.size, 'GIT_EXTRANEOUS');
  list(m.files); unique(m.files.map(f => f.name));
  for (const f of m.files) {
    record(f, ['name', 'role', 'bytes', 'digest']); text(f.name);
    need(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(f.name) && !f.name.endsWith('.'), 'FILE_NAME');
    need(['input', 'output'].includes(f.role), 'FILE_ROLE'); checkPayload(f, payloads, budget);
  }
  list(m.recipes, 1, 64); unique(m.recipes.map(r => r.id));
  for (const r of m.recipes) {
    record(r, ['id', 'argv', 'runtime_digest', 'input_files', 'output_files', 'network', 'limits']);
    text(r.id); list(r.argv, 1, 128); r.argv.forEach(text); hash(r.runtime_digest);
    need(r.network === 'none', 'NETWORK_POLICY');
    record(r.limits, ['cpu_seconds', 'ram_bytes', 'net_bytes']); integer(r.limits.cpu_seconds, 1); integer(r.limits.ram_bytes, 1); need(r.limits.net_bytes === 0, 'NETWORK_POLICY');
    for (const [field, role] of [['input_files', 'input'], ['output_files', 'output']]) {
      list(r[field]); unique(r[field]);
      for (const name of r[field]) need(m.files.some(f => f.name === name && f.role === role), 'RECIPE_FILE');
    }
  }
  return true;
}
