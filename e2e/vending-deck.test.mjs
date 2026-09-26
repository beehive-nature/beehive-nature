/* vending-deck.test.mjs — the value deck holds to what it says. No browser: the core is pure.
   Three things are on trial:
   1. THE DOORS — each normaliser is fed the shape its source really emits (x0x
      src/server/routes/named_groups.rs and src/groups/public_message.rs; the
      relay's /hive/public/index.json as read live 2026-09-25; jungle4 rows as
      surfaces/vending.html reads them; block/buzz preview-features.json), and the
      x0x CORS predicate is mirrored so the page refuses before asking.
   2. THE PAGE — skaists laws a static read can catch: one primary per view, no
      honey outside b, lowercase-start headings and buttons, no dash for an unknown,
      every keyed word docked in the corpus for every tongue, message text set as
      text, no token ever stored, a literal loopback door by default.
   3. THE RUNNER — refuses loudly on a bad door or a missing token file. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { extractKeyedText } from './i18n-extract.mjs';

const ROOT = process.cwd().replace(/[\\/]e2e$/, '');
const read = (p) => readFileSync(ROOT + '/' + p, 'utf8');
const sandbox = { self: undefined }; vm.runInNewContext(read('surfaces/vending-deck.js') + '\nthis.bDeck = bDeck;', sandbox);
const D = sandbox.bDeck;
/* the core runs in its own realm: objects it returns are round-tripped before a deep compare */
const plain = (x) => JSON.parse(JSON.stringify(x));
const html = read('surfaces/vending-deck.html');
const corpus = JSON.parse(read('surfaces/lang-corpus.json'));

/* ── 1 · the doors ─────────────────────────────────────────────────────── */
test('law: the vaulta rail wins, the tithe and the cap are read, nothing is invented', () => {
  /* the rows as jungle4 bnrapolltest answered them on 2026-09-25 (config: admin · max_certs 7776 · certs_count · spec) */
  const L = D.law({ rows: [{ rail: 'zano', basis: '1.0000 A' }, { rail: 'vaulta', basis: '0.6000 A', tithe_bp: 1000 }] }, { rows: [{ percent_bp: 1000, destination: 'kingbeelovis', updated: '2026-09-04T00:05:41' }] }, { rows: [{ admin: 'bnrapolltest', max_certs: 7776, certs_count: 2, spec: 'SPEC-VENDING-1', initialized: 1 }] });
  assert.deepEqual({ ...L }, { rail: 'vaulta', basisA: 0.6, titheBp: 1000, titheDest: 'kingbeelovis', maxCerts: 7776, count: 2 });
  const empty = D.law({ rows: [] }, { rows: [] }, { rows: [] });
  assert.equal(empty.basisA, null); assert.equal(empty.titheBp, null); assert.equal(empty.count, null);
});

test('certs: newest first, only rows with a name', () => {
  /* the live row shape: agent_name, not name (vendingtest2, minted 2026-09-04T00:33:06, template bqueenbee-genesis-1) */
  const C = D.certs({ rows: [{ id: '7226953197822445954', agent_name: 'vendingtest', owner: 'bnrapolltest', minted: '2026-09-01T00:00:00' }, { id: 1 }, { id: '34683951899866640', agent_name: 'vendingtest2', minted: '2026-09-04T00:33:06', ar_id: 'eiHVpo3lzifCKF3HN0JrDCnS8BlEjIUCk1oFM-4nMS4', template_id: 'bqueenbee-genesis-1' }] });
  assert.deepEqual(plain(C.map((c) => c.name)), ['vendingtest2', 'vendingtest']); assert.equal(C[0].ar, 'eiHVpo3lzifCKF3HN0JrDCnS8BlEjIUCk1oFM-4nMS4'); assert.equal(C[0].template, 'bqueenbee-genesis-1');
});

test('originMayAsk mirrors the daemon: literal loopback only, localhost and file refused', () => {
  assert.equal(D.originMayAsk('http://127.0.0.1:8842'), true);
  assert.equal(D.originMayAsk('http://127.5.6.7'), true);
  assert.equal(D.originMayAsk('http://[::1]:8842'), true);
  assert.equal(D.originMayAsk('http://localhost:8842'), false, 'the daemon rejects the localhost hostname on purpose');
  assert.equal(D.originMayAsk('null'), false, 'file:// has no origin the daemon admits');
  assert.equal(D.originMayAsk('https://skaists.dev'), false);
  assert.equal(D.originMayAsk('http://127.0.0.1:8842/path'), false);
});

test('x0x: health, groups, the hive, and messages in their wire shape', () => {
  const h = D.health({ status: 'healthy', version: '0.45.0', peers: 33, send_ready_peers: 25 });
  assert.deepEqual({ ...h }, { status: 'healthy', version: '0.45.0', peers: 33, ready: 25, why: null });
  const gs = D.groups({ ok: true, groups: [{ group_id: 'abc', name: 'hive-porch', description: '', creator: 'be9a', created_at: 1757030000, member_count: 3 }, { nope: 1 }] });
  assert.equal(gs.length, 1); assert.equal(D.hive(gs).members, 3); assert.equal(D.hive([]), null);
  const ms = D.messages([
    { group_id: 'abc', state_hash_at_send: 'x', revision_at_send: 2, author_agent_id: '97b09c05aa', author_public_key: 'k', kind: 'chat', body: 'seat proof', timestamp: 1757031000, signature: 'ffff0000' },
    { group_id: 'abc', author_agent_id: '1ca00a42bb', kind: 'announcement', body: 'later, in ms', timestamp: 1757032000000, signature: 's' },
    { body: 'no author' }
  ], 8);
  assert.deepEqual(plain(ms.map((m) => [m.who, m.kind, m.at])), [['97b09c05', 'chat', 1757031000], ['1ca00a42', 'announcement', 1757032000]]);
  assert.equal(D.messages({ messages: [] }).length, 0);
});

test('the relay feed: rooms keep every uuid, general is found, messages newest last and capped', () => {
  const rs = D.rooms({ rule: 'channels.visibility = open', channels: [{ id: '82f532d3-3280-465c-844e-635bb715911e', name: 'general' }, { id: 'd78414ed-1055-5d84-8b85-ba3a0be77193', name: 'general' }, { id: 'bad', name: 'x' }] });
  assert.equal(rs.length, 2, 'two general rooms are live: the uuid is the identity');
  assert.equal(D.room(rs, 'general').id, '82f532d3-3280-465c-844e-635bb715911e');
  const f = D.feed({ messages: [{ content: 'b', created_at: 2, pubkey: 'abbb9dfce4' }, { content: 'a', created_at: 1, name: 'bClaude' }, { nope: 1 }] }, 1);
  assert.deepEqual(plain(f), [{ who: 'abbb9dfc', body: 'b', at: 2 }]);
});

test('buzz preview features default off, an override wins', () => {
  const m = JSON.parse(read('e2e/fixtures/buzz-preview-features.json'));
  const p = D.previews(m);
  assert.deepEqual(plain(p.map((x) => x.id)), plain(D.BUZZ_PREVIEW));
  assert.ok(p.every((x) => x.on === false), 'resolveEnabled: overrides[id] ?? false');
  assert.equal(D.previews(m, { projects: true }).find((x) => x.id === 'projects').on, true);
});

test('every public repository names its owner, and its link is that owner\'s', () => {
  /* GitHub, read 2026-09-25: beehive-nature/beehive-nature 200 · skaists/LOVErnment-DAO 200 · beehive-nature/b-domain 200; beehive-nature/LOVErnment-DAO 404 */
  assert.deepEqual(plain(D.REPOS.map((r) => r.owner + '/' + r.name)), ['beehive-nature/beehive-nature', 'skaists/LOVErnment-DAO', 'beehive-nature/b-domain']);
  for (const r of D.REPOS) assert.equal(r.url, 'https://github.com/' + r.owner + '/' + r.name, r.name);
});

test('states carry a reason or refuse; the briefing is derived', () => {
  assert.throws(() => D.state('declined'), /needs a reason/);
  assert.throws(() => D.state('silent', 'x'), /unknown card state/);
  const b = D.briefing({ a: D.state('answered'), b: D.state('asking'), c: D.state('declined', 'deck.offline'), d: D.state('notyet', 'deck.mem.gate'), e: null });
  assert.deepEqual(plain(b), { answering: 1, asking: 1, declined: 1, notyet: 1, total: 4 });
  assert.equal(D.fill('{n} of {m} doors', { n: 3, m: 7 }), '3 of 7 doors');
  assert.equal(D.fill('{x} stays', {}), '{x} stays', 'an unfilled slot is left visible, never blanked');
});

/* ── 2 · the page ──────────────────────────────────────────────────────── */
test('one primary, no honey outside b, no dash for an unknown, no fonts fetched', () => {
  assert.equal((html.match(/class="primary"/g) || []).length, 1);
  assert.doesNotMatch(html, /--gold|#ffd700|#e8b54b/i, 'honey is the colour of b only');
  assert.doesNotMatch(html, />—</, 'an unknown is a word');
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|https?:\/\/[^"']*\.woff2/, 'estate surfaces fetch no fonts');
  assert.doesNotMatch(html, /text-transform/, 'the casing law: never let a style sheet do it');
  assert.match(html, /<div data-register-host>/); assert.match(html, /data-reg-disclose/);
});

test('every heading, button and label starts lowercase, names keep theirs', () => {
  const words = [...html.matchAll(/<(h1|h2|button|summary)[^>]*>([^<]+)</g)].map((m) => m[2].trim()).filter(Boolean);
  for (const w of words) assert.match(w, /^[a-z⬡✚‡♡{0-9]/, 'lowercase start: ' + w);
});

test('every keyed word is docked in the corpus for english and all 28 tongues, and the english is the page', () => {
  const keys = [...html.matchAll(/<[a-z0-9]+[^>]*\sdata-i18n="([^"]+)"[^>]*>/g)];
  assert.ok(keys.length >= 50, 'the page is keyed: ' + keys.length);
  const langs = ['en', ...corpus._meta.langs];
  for (const m of keys) {
    const key = m[1]; const row = corpus.strings[key];
    assert.ok(row, 'corpus row: ' + key);
    for (const l of langs) assert.ok(typeof row[l] === 'string' && row[l].trim(), key + ' in ' + l);
    const page = extractKeyedText(html, m.index);
    if (page) assert.equal(page, row.en, 'english on the page is the corpus en cell: ' + key);
  }
  for (const key of Object.keys(corpus.strings).filter((k) => k.startsWith('deck.'))) assert.ok(keys.some((m) => m[1] === key), 'corpus key unused on the page: ' + key);
});

test('messages are text, tokens live in memory, the door defaults to a literal loopback', () => {
  const app = html.slice(html.indexOf('/* the app:'));
  assert.doesNotMatch(app, /innerHTML/, 'nothing from a door is set as markup');
  assert.doesNotMatch(app, /localStorage|sessionStorage|document\.cookie|indexedDB/, 'no token is stored');
  assert.match(html, /id="token" type="password" autocomplete="off"/);
  assert.match(html, /id="door" value="http:\/\/127\.0\.0\.1:12700"/);
  assert.equal(D.LOOPBACK_DOOR, 'http://127.0.0.1:12700'); assert.ok(D.originMayAsk(D.LOOPBACK_DOOR));
  assert.match(app, /credentials: 'omit'/); assert.match(app, /referrerPolicy: 'no-referrer'/);
  assert.match(app, /\$\('#token'\)\.value = ''/, 'the pasted token is cleared from the field once taken');
});

test('the registry and the hub carry the deck', () => {
  const E = JSON.parse(read('estate.json'));
  const row = E.surfaces.find((s) => s.id === 'vending-deck');
  assert.ok(row, 'estate.json row'); assert.equal(row.path, 'surfaces/vending-deck.html'); assert.equal(row.state, 'LIVE');
  assert.match(read('surfaces/index.html'), /surfaces\/vending-deck\.html|vending-deck\.html/);
});
