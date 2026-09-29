/* vending-machine.test.mjs — the machine seat's door holds to what it says, with no key and no network:
   the canonical-name law, the dry run (name → throwaway key in memory → memory → certificate → hash,
   nothing uploaded, nothing written, no key kept), the refusal of any real mint (a member key is made
   in the member's own browser, never on this machine), the owner law of --row, and the page's
   rehearsal rail telling the truth: it signs with the member's new key, pays nothing, and says the
   chain row is not written until the seat writes it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const read = (p) => readFileSync(ROOT + '/' + p, 'utf8');
const M = await import('../scripts/vending-machine.mjs');
const env = { ...process.env }; delete env[M.KEY_ENV];
const run = (...a) => spawnSync(process.execPath, [ROOT + '/scripts/vending-machine.mjs', ...a], { encoding: 'utf8', timeout: 60000, env });
const NO_KEY = /seedB64url|seed_hex|"d":|PVT_K1|5[HJK][1-9A-HJ-NP-Za-km-z]{49}/;

test('the canonical-name law: NFC, trim, collapse, lowercase per tongue; zero-width refused', () => {
  assert.equal(M.canonicalName('  Bee   Test ', 'latvian'), 'bee test');
  assert.equal(M.canonicalName('MĪLESTĪBA', 'latvian'), 'mīlestība');
  assert.equal(M.canonicalName('İstanbul', 'turkish'), 'istanbul');
  assert.throws(() => M.canonicalName('bee​test', 'latvian'), /zero-width/);
  assert.throws(() => M.canonicalName('   ', 'latvian'), /empty/);
});

test('a dry run composes a hash-true certificate under a throwaway key, and keeps no key anywhere', async () => {
  const steps = [];
  const out = await M.mint({ name: 'Machine  Selftest', dryRun: true, report: (s, d) => steps.push([s, d]) });
  assert.deepEqual(steps.map((s) => s[0]), ['name', 'key', 'memory', 'certificate']);
  assert.equal(out.canonical, 'machine selftest'); assert.equal(out.dryRun, true);
  assert.match(out.member_key, /^[0-9a-f]{64}$/); assert.match(out.hash, /^[0-9a-f]{64}$/);
  assert.ok(out.bytes > 2000 && out.bytes < 8000, 'a few KiB, inside Turbo\'s free tier');
  const keyStep = steps.find((s) => s[0] === 'key')[1];
  assert.deepEqual(Object.keys(keyStep).sort(), ['kept', 'member_key'], 'the key step reports the public key and where it is kept, nothing else');
  assert.doesNotMatch(JSON.stringify(steps), NO_KEY);
  const again = await M.mint({ name: 'machine selftest', dryRun: true });
  assert.notEqual(again.member_key, out.member_key, 'no vault: every dry run is a fresh throwaway key');
  await assert.rejects(M.mint({ name: 'real mint', dryRun: false }), (e) => e.step === 'mint' && /member's own browser/.test(e.message));
});

test('the CLI refuses a real mint and a bad row before any door, and never prints a key', () => {
  const r = run('refusal-probe', 'latvian');
  assert.equal(r.status, 1); assert.match(r.stderr, /REFUSED at mint: a member key is made in the member's own browser/);
  const bad = run('--row', 'probe', 'not-an-id');
  assert.equal(bad.status, 1); assert.match(bad.stderr, /REFUSED at arweave: not a 43-character arweave id/);
  const d = run('Dry  Probe', 'latvian', 'bqueenbee-genesis-1', '--dry-run');
  assert.equal(d.status, 0); assert.match(d.stdout, /MINT-DONE/); assert.match(d.stdout, /"canonical":"dry probe"/);
  for (const x of [r, bad, d]) assert.doesNotMatch(x.stdout + x.stderr, NO_KEY);
  const u = run(); assert.equal(u.status, 2);
});

test('the owner law: Arweave\'s index is read as hex of the ed25519 owner, and an unreadable index gives nothing', async () => {
  const pub = Buffer.alloc(32, 7);
  const ok = async () => ({ ok: true, json: async () => ({ data: { transactions: { edges: [{ node: { owner: { key: pub.toString('base64url') } } }] } } }) });
  assert.equal(await M.itemOwnerHex('x'.repeat(43), ok), pub.toString('hex'));
  assert.equal(await M.itemOwnerHex('x'.repeat(43), async () => ({ ok: true, json: async () => ({ data: { transactions: { edges: [] } } }) })), null);
  assert.equal(await M.itemOwnerHex('x'.repeat(43), async () => ({ ok: false })), null);
  const src = read('scripts/vending-machine.mjs');
  assert.match(src, /if \(owner !== pubHex\) throw refuse\('owner'/, '--row refuses an item signed by another key');
  assert.match(src, /if \(held && held\.member_key !== pubHex\) throw refuse\('collision'/, '--row refuses a name held by another key');
  assert.doesNotMatch(src, /writeFileSync|mkdirSync|seed\.json|SolanaSigner/, 'this machine writes no key file and uploads nothing');
});

test('the page tells the truth about the rehearsal mint', () => {
  const html = read('surfaces/vending.html');
  assert.doesNotMatch(html, /the poller below will catch your mint/);
  assert.doesNotMatch(html, /memo vending:|memo-bound|with memo <code>vending:/, 'no memo mint is promised anywhere, in any register');
  assert.doesNotMatch(html, /signs nothing/, 'approve signs with the member\'s new key; the page says so');
  assert.match(html, /your new key is made in\s+this page and signs your certificate/);
  assert.doesNotMatch(html, /a-legacy|vending\.rows\.pending|row follows from/, 'no dead branch, no queue nothing reads, no row that follows by itself');
  assert.match(html, /the chain row is not written yet; the machine seat writes it with <code>node scripts\/vending-machine\.mjs --row/);
  assert.match(html, /minting = true; mintState\.uploaded = false; \$\('papprove'\)\.disabled = true/, 'approve cannot be pressed twice');
  assert.match(html, /e\.target === plan && !minting/, 'the plan cannot be dismissed while a mint runs');
  const mintFn = html.slice(html.indexOf('async function mintInPage'));
  assert.ok(mintFn.indexOf('keep your key now') > 0 && mintFn.indexOf('keep your key now') < mintFn.indexOf('A.upload(item)'), 'the key is offered before anything is uploaded');
  assert.match(mintFn, /try \$\{i \+ 1\} of 6/, 'the read-back wait has a clock');
  assert.match(html, /may have reached the permaweb anyway/, 'a failure after upload does not claim nothing was kept');
  assert.match(html, /const after = e\.step === 'arweave' \|\| mintState\.uploaded;/, 'the upload is remembered by a flag, not inferred from a step label');
  assert.ok(mintFn.indexOf('mintState.uploaded = true') > mintFn.indexOf('A.upload(item)'), 'the flag is set once the upload returns');
  assert.match(html, /\$\('papprove'\)\.disabled = mintedHere\.has\(n\);/, 'a name minted in this tab is not minted again under a second key');
  assert.match(html, /approve rests for this name/, 'and the page says why approve rests');
  const res = html.slice(html.indexOf('async function resurrect'), html.indexOf("$('vrebuild').addEventListener"));
  assert.match(res, /if \(!res\.ok && !onChain\) \{ seeding\(/, 'a fresh in-page mint the gateway has not seeded waits instead of failing');
  assert.match(res, /keyRoad = KEY_WAITS; waits\('key road: Arweave\\'s index has not listed/, 'an unindexed key road waits, and the summary stops claiming it was found');
  assert.match(res, /\$\{keyRoad\}Fingerprint matched \$\{ways\}/);
});

test('the chain\'s rate string is escaped before markup, and carries its own unit once', () => {
  const html = read('surfaces/vending.html');
  /* basis is the jungle4 asset string ("0.6000 A"), read from a third-party host */
  assert.doesNotMatch(html, /innerHTML[^;\n]*\$\{L\.basisTxt\}/, 'the rate never reaches innerHTML unescaped');
  assert.equal((html.match(/\$\{esc\(L\.basisTxt\)\}/g) || []).length, 2);
  assert.doesNotMatch(html, /basisTxt\}? A\b|basisTxt\) \+ ' A /, 'no second " A" after a string that already ends in its unit');
});
