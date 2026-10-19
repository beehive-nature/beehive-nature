import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptUpdate, canonicalDocument, signingBytes, bytesDigest } from './contract.mjs';
import { loadPackage, packSnapshot, restoreSnapshot, writeDocument } from './package.mjs';
import { fixture, envelope, reseal } from './fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url)), cli = join(here, 'cli.mjs');
function sandbox(t) { const root = mkdtempSync(join(tmpdir(), 'repository-contract-')); t.after(() => rmSync(root, { recursive: true, force: true })); return root; }
function runGit(repo, ...args) { return execFileSync('git', ['-c', 'core.hooksPath=', '-C', repo, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_AUTHOR_NAME: 'Repository Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Repository Test', GIT_COMMITTER_EMAIL: 'test@example.invalid', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' } }).trim(); }
test('export and cold restore preserve exact Git commit/tree and artifacts with no remote', t => {
  const root = sandbox(t), repo = join(root, 'source'), out = join(root, 'package'); mkdirSync(repo);
  runGit(repo, 'init', '--initial-branch=main'); writeFileSync(join(repo, 'a.txt'), 'original\n');
  runGit(repo, 'add', 'a.txt'); runGit(repo, '-c', 'commit.gpgsign=false', 'commit', '-m', 'initial');
  const parent = runGit(repo, 'rev-parse', 'HEAD'); mkdirSync(join(repo, 'nested')); writeFileSync(join(repo, 'nested', 'b.txt'), 'next\n');
  runGit(repo, 'add', 'nested/b.txt'); runGit(repo, '-c', 'commit.gpgsign=false', 'commit', '-m', 'next');
  const head = runGit(repo, 'rev-parse', 'HEAD'), tree = runGit(repo, 'rev-parse', 'HEAD^{tree}');
  runGit(repo, 'remote', 'add', 'origin', 'https://github.invalid/unavailable/repo');
  const f = fixture(), artifact = join(root, 'result.txt'); writeFileSync(artifact, 'results');
  const plan = { recipes: f.manifest.recipes, files: [{ name: 'results', role: 'output', path: artifact }] };
  const packed = packSnapshot({ repo, repository: f.policy.repository, ref: f.policy.ref, plan, out });
  assert.equal(packed.manifest.source.commit, head); assert.equal(packed.manifest.source.tree, tree); assert.deepEqual(packed.manifest.source.parents, [parent]);
  const loaded = loadPackage(out); assert.equal(loaded.payloads.get(packed.manifest.files[0].digest).toString(), 'results');
  const restored = restoreSnapshot(out, join(root, 'restored.git'));
  assert.equal(runGit(restored.directory, 'rev-parse', 'HEAD'), head); assert.equal(runGit(restored.directory, 'rev-parse', 'HEAD^{tree}'), tree);
  assert.equal(runGit(restored.directory, 'show', 'HEAD:nested/b.txt'), 'next'); assert.equal(runGit(restored.directory, 'remote'), '');
  assert.equal(readFileSync(join(restored.directory, 'shallow'), 'utf8'), head + '\n');
  assert.throws(() => restoreSnapshot(out, restored.directory));
  const object = packed.manifest.source.objects[0]; writeFileSync(join(out, 'objects', object.digest.slice(7)), 'tampered');
  assert.throws(() => loadPackage(out), e => e.code === 'OBJECT_DIGEST');
});

test('CLI requires external checkpoint, verifies signed packet offline and never changes state', t => {
  const root = sandbox(t), pack = join(root, 'pack'); mkdirSync(pack); mkdirSync(join(pack, 'objects'));
  const f = fixture(); writeDocument(join(pack, 'manifest.json'), f.manifest);
  for (const [hash, bytes] of f.payloads) writeFileSync(join(pack, 'objects', hash.slice(7)), bytes);
  const packet = { state: f.state, policy: f.policy, proposal: f.proposal, signatures: f.signatures, evidence: f.evidence };
  const path = join(root, 'packet.json'); writeDocument(path, packet); const before = readFileSync(path);
  const run = (...args) => spawnSync(process.execPath, [cli, 'verify', '--package', pack, '--packet', path, ...args], { encoding: 'utf8', windowsHide: true });
  assert.notEqual(run().status, 0);
  const good = run('--checkpoint', f.trustedStateDigest); assert.equal(good.status, 0, good.stderr); assert.equal(JSON.parse(good.stdout).accepted, true); assert.deepEqual(readFileSync(path), before);
  const wrong = run('--checkpoint', bytesDigest(Buffer.from('untrusted'))); assert.equal(wrong.status, 1); assert.equal(JSON.parse(wrong.stderr).code, 'UNTRUSTED_STATE');
  packet.proposal.sequence++; writeFileSync(path, canonicalDocument(packet)); assert.equal(run('--checkpoint', f.trustedStateDigest).status, 1);
});

test('signing bytes CLI agrees with the pure contract and refuses overwrite', t => {
  const root = sandbox(t), f = fixture(), doc = join(root, 'proposal.json'), out = join(root, 'sign.bytes'); writeDocument(doc, f.proposal);
  const args = [cli, 'signing-bytes', '--kind', 'proposal', '--document', doc, '--out', out];
  const first = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true }); assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(readFileSync(out), signingBytes('proposal', f.proposal)); assert.notEqual(spawnSync(process.execPath, args, { windowsHide: true }).status, 0);
});

test('threshold counts distinct keys, never duplicate envelopes from a second signing', () => {
  const f = fixture(); f.policy.update_keys.push(f.policy.keys[2].id); f.policy.update_threshold = 2;
  reseal(f); assert.equal(acceptUpdate(f).code, 'THRESHOLD');
  f.signatures.push(envelope(signingBytes('proposal', f.proposal))); assert.equal(acceptUpdate(f).code, 'DUPLICATE');
  f.signatures[1] = envelope(signingBytes('proposal', f.proposal), 2); assert.equal(acceptUpdate(f).accepted, true);
});
