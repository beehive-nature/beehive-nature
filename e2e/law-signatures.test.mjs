// The one-press "sign the law" path, end to end without a browser: a receipt shaped like the
// wallet's (surfaces/wallet.html#pq-law) goes through scripts/apply-law-signatures.mjs into a
// throwaway copy of the repo, and scripts/verify-bpq-signatures.mjs then reads it: ok while the
// files are unchanged, STALE (not failed) after a signed file changes, FAIL for a forged signature.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
require(join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bpq-lib.js'));
require(join(ROOT, 'surfaces', 'bpq.js'));
const B = globalThis.BPQ;
const LAW = JSON.parse(readFileSync(join(ROOT, 'docs', 'PQ-LAW.json'), 'utf8')).files;

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'law-sign-'));
  for (const p of ['scripts/apply-law-signatures.mjs', 'scripts/verify-bpq-signatures.mjs', 'surfaces/bpq.js',
    'surfaces/onboarding/vendor/bpq-lib.js', 'docs/PQ-LAW.json', ...LAW]) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    cpSync(join(ROOT, p), join(dir, p));
  }
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
  git('init', '-q'); git('add', '-A');
  return { dir, git };
}
function receipt(keys, at) {
  return { bpq: 1, kind: 'law-signatures', at, card: B.card(keys),
    signatures: LAW.map(path => ({ path, sig: B.signFile(keys, new Uint8Array(readFileSync(join(ROOT, path))), at) })) };
}
const run = (dir, script, ...a) => spawnSync(process.execPath, [join(dir, 'scripts', script), ...a], { cwd: dir, encoding: 'utf8' });

test('a wallet receipt becomes committed signatures that CI accepts, then reports a later edit as STALE', () => {
  const k = B.keys(new Uint8Array(32).fill(0x5a), 'pq:lawtest');   // TEST-ONLY root, public
  const { dir, git } = sandbox();
  try {
    writeFileSync(join(dir, 'receipt.json'), JSON.stringify(receipt(k, '2026-10-04T12:00:00.000Z')));
    const a = run(dir, 'apply-law-signatures.mjs', 'receipt.json');
    assert.equal(a.status, 0, a.stderr);
    assert.match(a.stdout, new RegExp(`${LAW.length} signatures by ${k.id} \\(founder\\) written`));
    const pins = JSON.parse(readFileSync(join(dir, 'docs', 'PQ-SIGNERS.json'), 'utf8'));
    assert.deepEqual(pins.signers.map(s => [s.id, s.name]), [[k.id, 'founder']]);
    assert.ok(B.verifyCard(pins.signers[0].card));
    git('add', '-A');
    const v = run(dir, 'verify-bpq-signatures.mjs');
    assert.equal(v.status, 0, v.stderr);
    assert.match(v.stdout, new RegExp(`bpq signatures: ${LAW.length} of ${LAW.length} verify, signers pinned \\(1\\)`));
    appendFileSync(join(dir, LAW[0]), '\nan agent edit after signing\n');
    const s = run(dir, 'verify-bpq-signatures.mjs');
    assert.equal(s.status, 0, 'a changed file is reported, never a failed build: ' + s.stderr);
    assert.match(s.stdout, new RegExp(`STALE ${LAW[0].replace(/[.]/g, '\\.')}: signed by ${k.id}`));
    assert.match(s.stdout, new RegExp(`${LAW.length - 1} of ${LAW.length} verify, 1 stale`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('nothing is written for a receipt with a forged, foreign or out-of-list signature', () => {
  const k = B.keys(new Uint8Array(32).fill(0x5a), 'pq:lawtest');
  const other = B.keys(new Uint8Array(32).fill(0x5b), 'pq:other');
  const cases = {
    forged: r => { const s = r.signatures[0].sig; s.sig = s.sig.slice(0, 10) + (s.sig[10] === 'A' ? 'B' : 'A') + s.sig.slice(11); },
    foreign: r => { r.signatures[0].sig = B.signFile(other, new Uint8Array(readFileSync(join(ROOT, LAW[0]))), r.at); },
    outside: r => { r.signatures.push({ path: 'surfaces/wallet.html', sig: r.signatures[0].sig }); },
  };
  for (const [name, spoil] of Object.entries(cases)) {
    const { dir } = sandbox();
    try {
      const r = receipt(k, '2026-10-04T12:00:00.000Z'); spoil(r);
      writeFileSync(join(dir, 'receipt.json'), JSON.stringify(r));
      const a = run(dir, 'apply-law-signatures.mjs', 'receipt.json');
      assert.notEqual(a.status, 0, name + ' must be refused');
      assert.match(a.stderr, /nothing written/);
      const written = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' })
        .split(/\r?\n/).filter(l => l.startsWith('??') && !l.endsWith('receipt.json'));
      assert.deepEqual(written, [], name + ' wrote files');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('verifyDetachedClaim checks the signature over the hash it names, not a file', () => {
  const k = B.keys(new Uint8Array(32).fill(0x5a), 'pq:lawtest');
  const d = B.signFile(k, new TextEncoder().encode('v1'), '2026-10-04T12:00:00Z');
  assert.equal(B.verifyFile(d, new TextEncoder().encode('v2')).ok, false);
  assert.deepEqual(B.verifyDetachedClaim(d), { ok: true, id: k.id, at: '2026-10-04T12:00:00Z' });
  assert.equal(B.verifyDetachedClaim({ ...d, file: { ...d.file, size: d.file.size + 1 } }).ok, false);
  assert.equal(B.verifyDetachedClaim({ ...d, at: '2026-10-04T12:00:01Z' }).ok, false);
});
