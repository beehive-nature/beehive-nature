/* vending-machine.test.mjs — the machine door holds to what it says, with no key and no network:
   the canonical-name law, the dry run (name → key → memory → certificate → hash, nothing uploaded,
   nothing written), the refusal before any upload when the seat key is absent, and the page's
   rail-A screen telling the truth instead of the memo promise the contract could never honour. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const read = (p) => readFileSync(ROOT + '/' + p, 'utf8');
const M = await import('../scripts/vending-machine.mjs');
const env = { ...process.env }; delete env[M.KEY_ENV];
const run = (...a) => spawnSync(process.execPath, [ROOT + '/scripts/vending-machine.mjs', ...a], { encoding: 'utf8', timeout: 60000, env });

test('the canonical-name law: NFC, trim, collapse, lowercase per tongue; zero-width refused', () => {
  assert.equal(M.canonicalName('  Bee   Test ', 'latvian'), 'bee test');
  assert.equal(M.canonicalName('MĪLESTĪBA', 'latvian'), 'mīlestība');
  assert.equal(M.canonicalName('İstanbul', 'turkish'), 'istanbul');
  assert.throws(() => M.canonicalName('bee​test', 'latvian'), /zero-width/);
  assert.throws(() => M.canonicalName('   ', 'latvian'), /empty/);
});

test('a dry run composes a hash-true certificate and touches no door', async () => {
  const steps = [];
  const out = await M.mint({ name: 'Machine  Selftest', dryRun: true, report: (s, d) => steps.push([s, d]) });
  assert.deepEqual(steps.map((s) => s[0]), ['name', 'key', 'memory', 'certificate']);
  assert.equal(out.canonical, 'machine selftest'); assert.equal(out.dryRun, true);
  assert.match(out.member_key, /^[0-9a-f]{64}$/); assert.match(out.hash, /^[0-9a-f]{64}$/);
  assert.ok(out.bytes > 2000 && out.bytes < 8000, 'a few KiB, inside Turbo\'s free tier');
  const vault = steps.find((s) => s[0] === 'key')[1].vault; assert.ok(existsSync(vault));
  const again = await M.mint({ name: 'machine selftest', dryRun: true });
  assert.equal(again.member_key, out.member_key, 'the same name finds the same member key in the vault');
  rmSync(vault);
});

test('without the seat key the door refuses at sign, before any upload — and never prints a key', () => {
  const r = run('refusal-probe', 'latvian');
  assert.equal(r.status, 1); assert.match(r.stderr, new RegExp('REFUSED at sign: ' + M.KEY_ENV));
  assert.doesNotMatch(r.stdout + r.stderr, /seedB64url|PVT_K1|5[HJK][1-9A-HJ-NP-Za-km-z]{49}/);
  const d = run('Dry  Probe', 'latvian', 'bqueenbee-genesis-1', '--dry-run');
  assert.equal(d.status, 0); assert.match(d.stdout, /MINT-DONE/); assert.match(d.stdout, /"canonical":"dry probe"/);
  assert.doesNotMatch(d.stdout, /seedB64url/);
  const u = run(); assert.equal(u.status, 2);
});

test('the page no longer promises a memo mint, and watches the certs table instead of the dead history door', () => {
  const html = read('surfaces/vending.html');
  assert.doesNotMatch(html, /the poller below will catch your mint/);
  assert.doesNotMatch(html, /with memo <code>vending:/);
  assert.match(html, /this page signs nothing/);
  assert.match(html, /scripts\/vending-machine\.mjs/);
  assert.match(html, /await readCerts\(\)/);
  assert.match(html, /history door \(v1\/history\/get_actions\) is not answering/);
});
