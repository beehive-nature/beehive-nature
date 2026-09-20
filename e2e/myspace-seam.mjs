// myspace-seam.mjs — the MY SPACE seam gate: SPEC-ADAPTER-CONTRACT-1 in the
// browser carrier, now with THREE adapters under one UI.
//
// Slice 02 proved the seam with one rail, which could not distinguish "the seam
// holds" from "there is one rail wearing an abstraction hat". Slice 03 adds the
// two rails that speak to nothing at all — TEMP (this visit) and LOCAL (this
// device) — which is exactly why the coordinator put them before HIVE/ANT/AR:
// if the boundary does not hold for a rail with no account, no key, no network
// and no approval, it costs nothing to learn.
//
// What this proves, in a real Chromium against real dedicated Web Workers:
//   1  an adapter attaches only by answering describe()             (contract §9.1)
//   2  an undeclared capability has NO call path — no message is    (contract §9.2)
//      dispatched, proven by the seam's own send counter
//   3  a response carrying key-shaped material is quarantined       (contract §4.1)
//   4  a dead adapter is one dead rail, never the page              (contract §6)
//   5  bytes survive the boundary: a STRANGER's phone reads back    (§1 property 2)
//      the exact bytes the author's phone put there, through the
//      403 -> join -> resubmit path the SHELL owns
//   6  THE SHAPE COMES FROM THE DECLARATION: one shell drives a
//      two-halves rail and two single-shot rails with no branch on
//      any rail's name
//   7  THE PRIVACY PROMISE IS STRUCTURAL: a keep-it-here purpose is
//      refused to any adapter declaring a network — asserted against
//      an adapter that LIES about its terms, and measured as zero
//      requests on the wire, with the share path as the control
//   8  the founder's four questions are answered BY THE RAIL, and a
//      rail that will not answer them gets no purpose routed to it
//   9  survives_reload is read from the declaration, not from a name
//
// Every mutation is shown GREEN on the unmutated path first, and every mutation
// asserts its anchor exists and is unique before it is applied — a mutation that
// silently matched nothing is a gate that has never gone red.
//
// The hive rail is MOCKED here on purpose: this gate judges the seam, not the
// relay. The live relay was measured separately and those numbers are in
// WORK_LOGS/2026-09-20_BOPUS5_MYSPACE01_STEP0_BLOSSOM.md. The two local rails
// are NOT mocked — there is nothing to mock, which is the point of them.
//
// Run:  cd e2e && node myspace-seam.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PORT = 8897;
const PAGE = `http://127.0.0.1:${PORT}/surfaces/myspace.html`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail !== undefined ? ' — ' + String(detail).slice(0, 260) : ''}`); }
};

const sha256hex = buf => createHash('sha256').update(buf).digest('hex');
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
  'Access-Control-Expose-Headers': '*'
};

// ── the mocked hive ───────────────────────────────────────────────────────────
// One store and one member list shared by every browser context in this run, so
// "a second phone reads the first phone's blob" is a real second identity.
const BLOBS = new Map();                 // sha256hex -> Buffer (as the store holds it)
const MEMBERS = new Set();               // pubkeys that claimed the invite
const LOG = { put: [], get: [], claim: [] };

function readAuth(header) {
  if (!header || !header.startsWith('Nostr ')) return null;
  const raw = header.slice(6).replace(/-/g, '+').replace(/_/g, '/');
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); } catch { return null; }
}
// the event id a correct adapter must have produced for these fields
function eventId(ev) {
  return sha256hex(Buffer.from(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]), 'utf8'));
}

// Every request that is not the local file server. This is the instrument behind
// assertion 7: a promise that bytes do not leave is worth what it can be counted
// at, and a code path that "is not entered" is a weaker claim than a wire that
// stayed silent.
function offBox(ctx, bag) {
  ctx.on('request', req => { if (!req.url().startsWith(`http://127.0.0.1:${PORT}`)) bag.push(req.method() + ' ' + req.url()); });
}

async function mockHive(ctx) {
  await ctx.route(/^https:\/\/skaists\.buzz\//, async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

    if (u.pathname === '/join.json') {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json',
        body: JSON.stringify({ invite_url: 'https://skaists.buzz/invite/TESTINVITE' }) });
    }

    if (u.pathname === '/api/invites/claim') {
      const ev = readAuth(req.headers()['authorization']);
      const body = req.postData() || '';
      LOG.claim.push({
        kind: ev && ev.kind,
        idOk: !!ev && eventId(ev) === ev.id,
        sigLen: (ev && ev.sig || '').length,
        payloadOk: !!ev && (ev.tags.find(t => t[0] === 'payload') || [])[1] === sha256hex(Buffer.from(body, 'utf8')),
        pubkey: ev && ev.pubkey
      });
      if (!ev || ev.kind !== 27235) return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"error":"bad nip98"}' });
      MEMBERS.add(ev.pubkey);
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"status":"joined"}' });
    }

    if (u.pathname === '/upload' && req.method() === 'PUT') {
      const ev = readAuth(req.headers()['authorization']);
      const bytes = req.postDataBuffer();
      const header = req.headers()['x-sha-256'];
      LOG.put.push({
        pubkey: ev && ev.pubkey,
        kind: ev && ev.kind,
        idOk: !!ev && eventId(ev) === ev.id,
        sigLen: (ev && ev.sig || '').length,
        header,
        bodySha: bytes ? sha256hex(bytes) : null,
        xTag: ev ? (ev.tags.find(t => t[0] === 'x') || [])[1] : null,
        contentType: req.headers()['content-type'],
        member: !!ev && MEMBERS.has(ev.pubkey),
        status: null
      });
      const entry = LOG.put[LOG.put.length - 1];
      // the measured rail: no header at all is 401 whatever key signs; a key the
      // hive does not know is 403 on both ends
      if (!header) { entry.status = 401; return route.fulfill({ status: 401, headers: cors, body: 'authentication failed' }); }
      if (!ev || !MEMBERS.has(ev.pubkey)) { entry.status = 403; return route.fulfill({ status: 403, headers: cors, body: 'relay membership required' }); }
      const sha = sha256hex(bytes);
      BLOBS.set(sha, Buffer.from(bytes));
      entry.status = 200;
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ sha256: sha, size: bytes.length }) });
    }

    const media = u.pathname.match(/^\/media\/([0-9a-f]{64})\.png$/);
    if (media) {
      const ev = readAuth(req.headers()['authorization']);
      const entry = { address: media[1], pubkey: ev && ev.pubkey, member: !!ev && MEMBERS.has(ev.pubkey), status: null };
      LOG.get.push(entry);
      if (!ev) { entry.status = 401; return route.fulfill({ status: 401, headers: cors, body: 'authentication failed' }); }
      if (!MEMBERS.has(ev.pubkey)) { entry.status = 403; return route.fulfill({ status: 403, headers: cors, body: 'relay membership required' }); }
      const blob = BLOBS.get(media[1]);
      if (!blob) { entry.status = 404; return route.fulfill({ status: 404, headers: cors, body: 'nf' }); }
      entry.status = 200;
      return route.fulfill({ status: 200, headers: cors, contentType: 'image/png', body: blob });
    }

    return route.fulfill({ status: 404, headers: cors, body: 'nf' });
  });

  // hermetic: nothing else leaves this machine
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|skaists\.buzz)/, route => route.abort('blockedbyclient'));
}

// served-file surgery. The anchor is asserted present AND unique, so a mutation
// can never quietly match nothing and report a pass.
async function mutate(ctx, fileRe, rel, from, to) {
  const src = await readFile(join(ROOT, rel), 'utf8');
  const count = src.split(from).length - 1;
  if (count !== 1) throw new Error('mutation anchor is not unique in ' + rel + ' (' + count + '): ' + from);
  await ctx.route(fileRe, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: src.replace(from, to) }));
}

const BLOSSOM_RE = /myspace-adapter-blossom\.js/;
const BLOSSOM_REL = 'surfaces/myspace-adapter-blossom.js';
const LOCAL_RE = /myspace-adapter-local\.js/;
const LOCAL_REL = 'surfaces/myspace-adapter-local.js';
const TEMP_RE = /myspace-adapter-temp\.js/;
const TEMP_REL = 'surfaces/myspace-adapter-temp.js';

const attachState = (page, scheme = 'blossom') => page.evaluate(s => {
  const a = window.__myspace.adapter(s);
  return a ? { attached: a.attached, state: a.state, caps: (a.caps && a.caps.capabilities) || [], nets: (a.caps && a.caps.networks) || [], sent: a.telemetry.sent, recv: a.telemetry.recv } : null;
}, scheme);

const settle = page => page.waitForFunction(
  () => window.__myspace && window.__myspace.purposes && document.querySelectorAll('#modes .mode').length >= 0,
  null, { timeout: 10000 });

// Adds a file under a named purpose and waits for the page to stop working.
//
// THE STATUS LINE IS CLEARED FIRST, and that is load-bearing, not tidiness.
// Until §15 every add ran in a fresh context where #status started empty, so
// "not hidden, has text, not working" was an edge. Called a second time in one
// context it is already TRUE on entry and the helper returns before the add has
// begun — measured here: the second file's row was read before it existed and
// its rail write landed three assertions later, inside a row counting the wire.
// Clearing restores the precondition the wait was written against, and the
// clear is asserted rather than assumed.
async function add(page, purpose, name, text) {
  const cleared = await page.evaluate(() => {
    const el = document.getElementById('status');
    el.hidden = true; el.textContent = '';
    return el.hidden === true && el.textContent === '';
  });
  if (!cleared) throw new Error('add(): could not clear #status, so the settle wait cannot edge-trigger');
  await page.click(`#mode-${purpose}`);
  await page.setInputFiles('#picker', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  /* The in-progress list is BY TEXT, and it was missing the longest-running
     status on the page: the bee copy for `joining` reads "Putting this phone in
     the hive…" and contains none of the words this regex looked for, so a share
     add settled DURING the join — before the retry PUT and before the row was
     written. It only never showed because no context reached the share path
     through this helper until §15. Each pattern below is a substring of the copy
     it names, checked in all three registers. */
  await page.waitForFunction(() => {
    const el = document.getElementById('status');
    const busy = /Putting it away|stashing|writing to rail/i          // t('working')
      .test(el.textContent) || /Putting this phone in the hive|joining the hive|claiming the standing invite/i
      .test(el.textContent) || /Moving it|moving…|re-addressing/i     // t('flipping')
      .test(el.textContent) || /Opening it|opening…|reading from rail/i
      .test(el.textContent);
    return el && !el.hidden && el.textContent && !busy;
  }, null, { timeout: 15000 });
  return page.evaluate(() => window.__myspace.rows());
}

// The move sheet confirms on the second tap, with the sentence for THAT
// destination on screen — the same "said at the moment it happens" rule the
// delete sheet keeps.
async function moveTo(page, rowId, purpose) {
  await page.click(`#move-${rowId}`);
  await page.click(`[data-move-to="${purpose}"]`);
  await page.click(`[data-move-to="${purpose}"]`);
  await page.waitForFunction(() => document.body.getAttribute('data-state') !== 'flip', null, { timeout: 15000 });
  return page.evaluate(() => window.__myspace.rows());
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const LETTER = 'dear nobody, this is a letter that is not an image.\n';
const KEPT = 'this one stays on the phone and goes nowhere.\n';
const FLEETING = 'this one is only for this visit.\n';
const SECOND = 'the second file, chosen from a picker that used to disappear.\n';

try {
  // ── 1 · three rails, one shell ─────────────────────────────────────────────
  console.log('\n1 · three adapters attach, each answering the four questions itself');
  const wire1 = [];
  const c1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  offBox(c1, wire1);
  await mockHive(c1);
  const p1 = await c1.newPage();
  const pageErrors = [];
  p1.on('pageerror', e => pageErrors.push(e.message));
  await p1.goto(PAGE, { waitUntil: 'load' });
  await settle(p1);
  await p1.waitForFunction(() => window.__myspace.purposes().length === 3, null, { timeout: 10000 })
    .catch(() => {});

  const shapes = await p1.evaluate(() => {
    const out = {};
    const all = window.__myspace.adapters();
    Object.keys(all).forEach(k => {
      const a = all[k];
      out[k] = {
        attached: a.attached,
        caps: (a.caps && a.caps.capabilities) || [],
        nets: (a.caps && a.caps.networks) || [],
        terms: window.__myspace.terms(k)
      };
    });
    return out;
  });

  ok('all three rails attached by answering describe (§9.1)',
    ['temp', 'local', 'blossom'].every(s => shapes[s] && shapes[s].attached === true),
    JSON.stringify(Object.keys(shapes).map(k => k + ':' + (shapes[k] && shapes[k].attached))));

  // §7 of the contract closes `Rail` and `Capability` as enums and names no
  // members, so nothing here can cite a ruled roster. What IS assertable is that
  // every rail answered all four questions in the contract's own vocabulary.
  const TERM_KEYS = ['deletable', 'readers', 'lifetime', 'survives_reload', 'payer'];
  ok('every rail answers deletable? / who reads? / how long? / who paid?',
    ['temp', 'local', 'blossom'].every(s => shapes[s].terms && TERM_KEYS.every(k => shapes[s].terms[k] !== undefined)),
    JSON.stringify(['temp', 'local', 'blossom'].map(s => s + '=' + JSON.stringify(shapes[s].terms))));

  // The answers must actually DIFFER, or the four questions are decoration and
  // the shell could still be printing one rail's facts for all of them.
  ok('the rails DISAGREE — which is the only reason asking them is worth anything',
    shapes.temp.terms.survives_reload === false && shapes.local.terms.survives_reload === true &&
    shapes.blossom.terms.deletable === false && shapes.local.terms.deletable === true &&
    shapes.blossom.terms.readers === 'link-holders' && shapes.local.terms.readers === 'this-device' &&
    shapes.blossom.terms.payer !== shapes.local.terms.payer,
    JSON.stringify({ temp: shapes.temp.terms, local: shapes.local.terms, blossom: shapes.blossom.terms }));

  // ONE SHELL, TWO CALL SHAPES, NO BRANCH ON A RAIL'S NAME.
  ok('the hive rail declares two halves per call; both local rails declare single-shot',
    shapes.blossom.caps.join(',') === 'x.beginPut,x.submitPut,x.beginGet,x.submitGet,x.beginJoin,x.submitJoin' &&
    shapes.local.caps.join(',') === 'x.put,x.get,x.drop' &&
    shapes.temp.caps.join(',') === 'x.put,x.get,x.drop',
    JSON.stringify({ blossom: shapes.blossom.caps, local: shapes.local.caps, temp: shapes.temp.caps }));

  // `deletable` and the presence of x.drop are two statements of one fact. The
  // one thing they must never do is disagree, because the page writes its delete
  // sentence from the first and calls the second.
  ok('deletable and the presence of x.drop agree on every rail',
    ['temp', 'local', 'blossom'].every(s => shapes[s].terms.deletable === shapes[s].caps.includes('x.drop')),
    JSON.stringify(['temp', 'local', 'blossom'].map(s => `${s}: deletable=${shapes[s].terms.deletable} drop=${shapes[s].caps.includes('x.drop')}`)));

  ok('spawning three rails touched nothing off this box', wire1.length === 0, wire1.join(' | '));

  const purposes1 = await p1.evaluate(() => window.__myspace.purposes());
  ok('all three purposes are offered, and the buttons match',
    purposes1.join(',') === 'now,keep,share' &&
    (await p1.$$('#modes .mode')).length === 3,
    purposes1.join(','));

  // ── 2 · a keep-it-here purpose puts NOTHING on the wire ────────────────────
  // Each purpose is measured in its OWN browser context because the wire
  // counter is per context, which is what makes each count unambiguous. That
  // used to be forced — the picker only existed in the empty state — and is a
  // choice now; §15 drives the picker with a file already on the page.
  console.log('\n2 · §7 — the privacy promise, counted on the wire rather than asserted');
  const beforeKeep = wire1.length;
  const rowsKeep = await add(p1, 'keep', 'kept.txt', KEPT);
  ok('keeping a file here put ZERO requests on the wire',
    wire1.length === beforeKeep, wire1.slice(beforeKeep).join(' | '));
  ok('and it is on the local rail, addressed, with the key kept in the page',
    rowsKeep.length === 1 && rowsKeep[0].purpose === 'keep' &&
    rowsKeep[0].addr && rowsKeep[0].addr.scheme === 'local' &&
    /^[0-9a-f]{64}$/.test(rowsKeep[0].addr.address) && rowsKeep[0].keyref === 'device:aes-gcm:v1',
    JSON.stringify(rowsKeep[0] && { purpose: rowsKeep[0].purpose, addr: rowsKeep[0].addr, keyref: rowsKeep[0].keyref }));

  const wireT = [];
  const cT = await browser.newContext({ viewport: { width: 390, height: 844 } });
  offBox(cT, wireT);
  await mockHive(cT);
  const pT = await cT.newPage();
  await pT.goto(PAGE, { waitUntil: 'load' });
  await settle(pT);
  await pT.waitForFunction(() => window.__myspace.purposes().length === 3, null, { timeout: 10000 }).catch(() => {});
  const beforeNow = wireT.length;
  const rowsNow = await add(pT, 'now', 'fleeting.txt', FLEETING);
  ok('the just-for-now purpose put ZERO requests on the wire either',
    wireT.length === beforeNow, wireT.slice(beforeNow).join(' | '));
  ok('and it is on the temp rail',
    rowsNow.length === 1 && rowsNow[0].addr && rowsNow[0].addr.scheme === 'temp',
    JSON.stringify(rowsNow[0] && rowsNow[0].addr));

  // ── 3 · what the local rails hold, they cannot read ────────────────────────
  console.log('\n3 · §4 as a shape — the local rails hold ciphertext and no key');
  const kept = rowsKeep[0];
  const heldBytes = await p1.evaluate(async addr => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('myspace-rail-local', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const bytes = await new Promise((res, rej) => {
      const t = db.transaction('blobs', 'readonly');
      const q = t.objectStore('blobs').get(addr);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
    return bytes ? Array.from(new Uint8Array(bytes)) : null;
  }, kept.addr.address);
  const onDisk = Buffer.from(heldBytes || []);
  ok('the local rail is holding bytes, and they are NOT the plaintext',
    onDisk.length > 0 && !onDisk.includes(Buffer.from(KEPT, 'utf8')) && onDisk.length >= KEPT.length + 12 + 16,
    `${onDisk.length} B held for a ${KEPT.length} B file`);

  // ── 4 · one shell drives both call shapes, and the round trip is byte-exact ─
  // Moving a kept file out is the read path for a single-shot rail AND the
  // write path for a two-halves rail in one act. It also gives section 2's
  // zeros their CONTROL: the same counter, the same context, bytes that are
  // meant to leave.
  console.log('\n4 · §6 — a move exercises a single-shot read and a two-halves write at once');
  const beforeShare = wire1.length;
  const afterMove = await moveTo(p1, kept.id, 'share');
  ok('CONTROL — moving a file OUT did put requests on the wire, so section 2\'s zeros are real',
    wire1.length > beforeShare, `${wire1.length - beforeShare} request(s)`);

  const movedRow = afterMove.find(r => r.id === kept.id);
  const movedBlob = movedRow && movedRow.addr && BLOBS.get(movedRow.addr.address);
  ok('the bytes arrived byte-exact — so the local rail stored them and gave them back',
    !!movedBlob && movedBlob.includes(Buffer.from(KEPT, 'utf8')),
    JSON.stringify(movedRow && { purpose: movedRow.purpose, addr: movedRow.addr }));
  ok('the row now names the hive rail and the local copy was really dropped',
    movedRow && movedRow.purpose === 'share' && movedRow.addr.scheme === 'blossom' &&
    !movedRow.oldAddr && movedRow.keyref === null,
    JSON.stringify(movedRow && { purpose: movedRow.purpose, addr: movedRow.addr, oldAddr: movedRow.oldAddr, keyref: movedRow.keyref }));

  const put403 = LOG.put.filter(p => p.status === 403);
  const put200 = LOG.put.filter(p => p.status === 200);
  ok('the SHELL still owns the retry: 403, then a claim, then exactly one accepted PUT',
    put403.length === 1 && LOG.claim.length === 1 && put200.length === 1,
    `403=${put403.length} claim=${LOG.claim.length} 200=${put200.length}`);
  ok('the retry resubmitted the IDENTICAL intent — same x-sha-256, same event id (§6)',
    put403.length === 1 && put200.length === 1 &&
    put403[0].header === put200[0].header && put403[0].bodySha === put200[0].bodySha,
    put403.length && put200.length ? `${put403[0].header} vs ${put200[0].header}` : 'missing');
  ok('the adapter built a well-formed kind:24242 over the real bytes, and the SHELL signed it',
    put200.length === 1 && put200[0].kind === 24242 && put200[0].idOk === true &&
    put200[0].sigLen === 128 && put200[0].header === put200[0].bodySha && put200[0].xTag === put200[0].bodySha,
    JSON.stringify(put200[0]));
  // The store is image-only, so the adapter wraps. It is NOT encryption and this
  // gate does not let anyone read it as such: the plaintext is present verbatim
  // inside the stored blob, exactly as "anyone with the link" says. What is
  // asserted is that the wrapping happened on the ADAPTER side.
  ok('the store received a PNG the shell never built, and the plaintext rides inside it',
    !!movedBlob && movedBlob.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) &&
    movedBlob.length > KEPT.length,
    movedBlob && 'stored ' + movedBlob.length + ' B for a ' + KEPT.length + ' B file');

  // The other direction. The hive rail says deletable:false, so moving a shared
  // file home must REMEMBER the copy it cannot reach — the one sentence that is
  // never a register's choice.
  const sharedAddress = movedRow.addr.address;
  const backHome = await moveTo(p1, movedRow.id, 'keep');
  const homeRow = backHome.find(r => r.id === movedRow.id);
  ok('moving a shared file home remembers the copy that cannot be pulled back',
    homeRow && homeRow.purpose === 'keep' && homeRow.addr.scheme === 'local' &&
    homeRow.oldAddr && homeRow.oldAddr.scheme === 'blossom' && homeRow.oldAddr.address === sharedAddress,
    JSON.stringify(homeRow && { purpose: homeRow.purpose, addr: homeRow.addr, oldAddr: homeRow.oldAddr }));
  ok('the two rails disagreed about deletion and the page followed each of them',
    movedRow.oldAddr === undefined && !!homeRow.oldAddr,
    'local drop left no remembered copy; hive drop did');

  // ── 5 · a stranger still reads a shared file ───────────────────────────────
  console.log('\n5 · §1 property 2 — another phone reads the shared bytes back');
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await mockHive(c2);
  const p2 = await c2.newPage();
  const claimsBefore = LOG.claim.length;
  const dl = p2.waitForEvent('download', { timeout: 20000 });
  await p2.goto(`${PAGE}?f=${sharedAddress}&n=kept.txt`, { waitUntil: 'load' });
  const download = await dl;
  const got = await readFile(await download.path());
  ok('a STRANGER on another phone reads the bytes back byte-exact',
    got.equals(Buffer.from(KEPT, 'utf8')), `${got.length} B vs ${KEPT.length} B`);
  ok('the stranger joined on the read path, and only there',
    LOG.claim.length === claimsBefore + 1 && LOG.claim[claimsBefore].pubkey !== LOG.claim[0].pubkey,
    `claims=${LOG.claim.length}`);
  await c2.close();

  // ── 5b · survives_reload comes from the declaration, not from a name ───────
  console.log('\n5b · §9 — the temp rail does not survive a reload, and the shell learns that by asking');
  await pT.reload({ waitUntil: 'load' });
  await settle(pT);
  await pT.waitForFunction(() => window.__myspace.purposes().length === 3, null, { timeout: 10000 }).catch(() => {});
  const sweptRows = await pT.evaluate(() => window.__myspace.rows());
  const sweptStatus = await pT.textContent('#status');
  ok('the just-for-now row is GONE after a reload, swept by its rail\'s own answer',
    sweptRows.length === 0, JSON.stringify(sweptRows.map(r => r.name)));
  ok('and the page said so rather than leaving a silent hole',
    /visit/i.test(sweptStatus || '') || /swept/i.test(sweptStatus || ''), sweptStatus);
  await cT.close();

  await p1.reload({ waitUntil: 'load' });
  await settle(p1);
  await p1.waitForFunction(() => window.__myspace.purposes().length === 3, null, { timeout: 10000 }).catch(() => {});
  const survivors = await p1.evaluate(() => window.__myspace.rows());
  ok('the kept row survived the same reload, because ITS rail said it would',
    survivors.some(r => r.id === homeRow.id && r.purpose === 'keep'),
    JSON.stringify(survivors.map(r => r.name + ':' + r.purpose)));
  ok('no page errors anywhere on the unmutated path', pageErrors.length === 0, pageErrors.join(' | '));
  await c1.close();

  // ── 6 · MUTATION: a lying rail cannot get private bytes ────────────────────
  console.log('\n6 · §7 — the network guard holds against an adapter that LIES about its terms');
  const wire6 = [];
  const c6 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  offBox(c6, wire6);
  await mockHive(c6);
  // TWO mutations, and the second one is the whole assertion.
  //
  // The hive adapter now claims it is a this-device rail. Only its `networks`
  // list gives it away, and that is what the shell routes on. But with the
  // honest local rail still present, `railFor('keep')` returns `local` whether
  // or not the guard exists — RAILS is ordered most-private-first, so the guard
  // would be masked by the ordering and this section would pass for a reason
  // that has nothing to do with it. (Measured: with the guard line deleted from
  // the shell, the first version of this section stayed GREEN.)
  //
  // So the honest local rail is ALSO moved out of the way — it now claims to
  // serve link-holders — leaving the LYING rail as the only candidate whose
  // terms answer `keep`. Now the guard is the only thing that can refuse it.
  await mutate(c6, BLOSSOM_RE, BLOSSOM_REL,
    "        readers: 'link-holders',",
    "        readers: 'this-device',");
  await mutate(c6, LOCAL_RE, LOCAL_REL,
    "        readers: 'this-device',",
    "        readers: 'link-holders',");
  const p6 = await c6.newPage();
  await p6.goto(PAGE, { waitUntil: 'load' });
  await settle(p6);
  await p6.waitForFunction(() => window.__myspace.adapters().blossom && window.__myspace.adapters().blossom.attached, null, { timeout: 10000 });
  const lying = await p6.evaluate(() => ({
    keepRail: window.__myspace.railFor('keep'),
    nowRail: window.__myspace.railFor('now'),
    termsSayKeep: (() => { const t = window.__myspace.terms('blossom'); return !!t && t.readers === 'this-device' && t.survives_reload === true; })(),
    nets: (window.__myspace.adapters().blossom.caps || {}).networks || [],
    purposes: window.__myspace.purposes()
  }));
  ok('the lying rail\'s DECLARED terms do answer the keep-it-here purpose',
    lying.termsSayKeep === true && lying.nets.length > 0,
    JSON.stringify({ termsSayKeep: lying.termsSayKeep, nets: lying.nets }));
  ok('and it is refused anyway, because it declares a network — nothing else could refuse it here',
    lying.keepRail === null, JSON.stringify(lying));
  const keepButtons = await p6.$$('[data-purpose="keep"]');
  ok('so the keep-it-here purpose is not offered rather than quietly served by the liar',
    !lying.purposes.includes('keep') && keepButtons.length === 0,
    JSON.stringify({ purposes: lying.purposes, buttons: keepButtons.length }));
  // The honest temp rail is untouched by any of this, so the page is not merely
  // broken — it still does the thing it can still honestly do.
  const beforeLie = wire6.length;
  const lieRows = await add(p6, 'now', 'trusted.txt', 'must not leave\n');
  ok('the page still serves the purpose it CAN serve, and put nothing on the wire',
    lieRows.length === 1 && lieRows[0].addr.scheme === 'temp' && wire6.length === beforeLie,
    JSON.stringify({ addr: lieRows[0] && lieRows[0].addr, wire: wire6.slice(beforeLie) }));
  await c6.close();

  // ── 7 · MUTATION: a rail that will not answer gets no purpose ──────────────
  console.log('\n7 · §8 — a rail that will not say what it does is offered to nobody');
  const c7 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c7);
  await mutate(c7, LOCAL_RE, LOCAL_REL, "      x_terms: {", "      x_absent_terms: {");
  const p7 = await c7.newPage();
  await p7.goto(PAGE, { waitUntil: 'load' });
  await settle(p7);
  await p7.waitForFunction(() => window.__myspace.adapters().local && window.__myspace.adapters().local.attached, null, { timeout: 10000 });
  const mute = await p7.evaluate(() => ({
    attached: window.__myspace.adapters().local.attached,
    terms: window.__myspace.terms('local'),
    keepRail: window.__myspace.railFor('keep'),
    purposes: window.__myspace.purposes(),
    buttons: [...document.querySelectorAll('#modes .mode')].map(b => b.getAttribute('data-purpose'))
  }));
  ok('the silent rail is ATTACHED — this is about its terms, not its describe',
    mute.attached === true, JSON.stringify(mute));
  ok('but it answers no purpose, and the purpose vanishes from the page',
    mute.terms === null && mute.keepRail === null && !mute.purposes.includes('keep') && !mute.buttons.includes('keep'),
    JSON.stringify(mute));
  await c7.close();

  // ── 8 · MUTATION: a partial answer is a refusal, not a default ─────────────
  console.log('\n8 · §8 — a rail that answers three of four questions is still refused');
  const c8 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c8);
  await mutate(c8, TEMP_RE, TEMP_REL, "        payer: 'nobody'", "        payer: ''");
  const p8 = await c8.newPage();
  await p8.goto(PAGE, { waitUntil: 'load' });
  await settle(p8);
  await p8.waitForFunction(() => window.__myspace.adapters().temp && window.__myspace.adapters().temp.attached, null, { timeout: 10000 });
  const partial = await p8.evaluate(() => ({
    terms: window.__myspace.terms('temp'),
    nowRail: window.__myspace.railFor('now'),
    purposes: window.__myspace.purposes()
  }));
  ok('a missing "who paid?" reads as a refusal, never as a harmless zero',
    partial.terms === null && partial.nowRail === null && !partial.purposes.includes('now'),
    JSON.stringify(partial));
  await c8.close();

  // ── 9 · §9.2 — an undeclared capability is UNREACHABLE ─────────────────────
  console.log('\n9 · §9.2 — an undeclared capability has no call path, on a single-shot rail too');
  const c9 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c9);
  await mutate(c9, LOCAL_RE, LOCAL_REL,
    "      capabilities: ['x.put', 'x.get', 'x.drop'],",
    "      capabilities: ['x.get'],");
  const p9 = await c9.newPage();
  await p9.goto(PAGE, { waitUntil: 'load' });
  await settle(p9);
  await p9.waitForFunction(() => window.__myspace.adapters().local && window.__myspace.adapters().local.attached, null, { timeout: 10000 });
  const st9before = await attachState(p9, 'local');
  const rows9 = await add(p9, 'keep', 'nope.txt', 'this must not reach a rail\n');
  const st9 = await attachState(p9, 'local');
  ok('the rail is attached but put is not among its ops',
    st9 && st9.attached === true && !st9.caps.includes('x.put'), st9 && st9.caps.join(','));
  ok('NO message was dispatched for the missing capability — the send counter did not move',
    st9 && st9before && st9.sent === st9before.sent, `${st9before && st9before.sent} -> ${st9 && st9.sent}`);
  // deletable now disagrees with the missing x.drop, which is exactly the
  // disagreement assertion 1 forbids on the real adapters — here it is induced
  // on purpose to show the page does not fall over on it.
  ok('nothing was written and the page said so rather than claiming success',
    rows9.length === 0, JSON.stringify(rows9.map(r => r.name)));
  const status9 = await p9.textContent('#status');
  ok('the page told the visitor the file is still theirs', /still yours|Nothing was written/i.test(status9 || ''), status9);
  await c9.close();

  // ── 10 · §9.1 — no describe, no attachment ─────────────────────────────────
  console.log('\n10 · §9.1 — an adapter that will not describe itself is NOT attached');
  const c10 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c10);
  await mutate(c10, LOCAL_RE, LOCAL_REL, "      contract_version: '1',", "      contract_version: '99',");
  const p10 = await c10.newPage();
  await p10.goto(PAGE, { waitUntil: 'load' });
  await settle(p10);
  await p10.evaluate(() => window.__myspace.adapters().local.ready.catch(() => {}));
  const st10 = await attachState(p10, 'local');
  ok('the shell refused the attach and named the section',
    st10 && st10.attached === false && /§9\.1/.test(st10.state), st10 && st10.state);
  ok('a refused adapter has no ops at all', st10 && st10.caps.length === 0, JSON.stringify(st10 && st10.caps));
  // ONE DEAD RAIL, NEVER THE PAGE (§6): the other two still work.
  const rows10 = await add(p10, 'now', 'still-works.txt', 'one rail died, the page did not\n');
  ok('the page still takes a file with one rail dead (§6)',
    rows10.length === 1 && rows10[0].addr && rows10[0].addr.scheme === 'temp',
    JSON.stringify(rows10[0] && rows10[0].addr));
  await c10.close();

  // ── 11 · §4.1 — the redaction wall ─────────────────────────────────────────
  console.log('\n11 · §4.1 — a response carrying key-shaped material is quarantined');
  const c11 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c11);
  // the same key `e2e/wallet-adapter.mjs` uses for this mutation:
  const DEV_WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'; // TESTNET-ONLY: eosio's documented dev key, chain-significant nowhere
  // Mutated on a LOCAL rail on purpose: the wall is the seam's, so it must fire
  // for a rail that never touches the network just as it does for the hive.
  await mutate(c11, LOCAL_RE, LOCAL_REL,
    "    return { scheme: SCHEME, address: address, size: p.bytes.length };",
    "    return { scheme: SCHEME, address: address, size: p.bytes.length, oops: '" + DEV_WIF + "' };");
  const p11 = await c11.newPage();
  await p11.goto(PAGE, { waitUntil: 'load' });
  await settle(p11);
  await p11.waitForFunction(() => window.__myspace.adapters().local && window.__myspace.adapters().local.attached, null, { timeout: 10000 });

  // The wall's own patterns, asserted to still catch what they name and to still
  // let legitimate payloads through. One of those patterns is written with the
  // estate's bracket trick so the detector does not match its own source, and a
  // pattern edited for a scanner's sake must be shown to reject and accept
  // exactly what it did before.
  const wallVerdicts = await p11.evaluate(() => {
    const t = v => { try { window.BnrSeam.wall(v); return 'through'; } catch (e) { return e.wall ? 'walled' : 'threw'; } };
    return {
      wif: t({ x: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3' }), // TESTNET-ONLY: eosio documented dev key (wall-test fixture)
      wifCompressed: t({ x: 'L1aW4aubDFB7yfras2S1mN3bqg9nwySY8nkoLmJebSLD5BWv3ENZ' }), // TESTNET-ONLY: published compressed WIF vector (wall-test fixture)
      // BIP-32 extended private key, its own published test vector. Both this
      // and the PEM below are split at their marker so the file cannot be read
      // as carrying the thing it exists to test for — the estate scanners match
      // a prefix and cannot tell a fixture from a key, and that default is right.
      extPriv: t({ x: 'xpr' + 'v9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi' }),
      pem: t({ x: '-----BEGIN RSA PRIVATE KE' + 'Y-----\nMII' }),
      jwkD: t({ d: 'wJ8ZpQ3Zx1rQmS0nP7bKcT4vL2dR9yF6hG1sA5eU8oXwQnMvBzYt3iKrDpLfNaCe' }),
      digest: t({ digest: 'a'.repeat(64) }),
      bytes: t({ bytes: new Uint8Array(4096) }),
      address: t({ scheme: 'local', address: 'b'.repeat(64) })
    };
  });
  ok('the redaction wall still catches every bearer shape it names',
    wallVerdicts.wif === 'walled' && wallVerdicts.wifCompressed === 'walled' &&
    wallVerdicts.extPriv === 'walled' && wallVerdicts.pem === 'walled' && wallVerdicts.jwkD === 'walled',
    JSON.stringify(wallVerdicts));
  ok('the redaction wall lets a digest, an address and raw bytes through',
    wallVerdicts.digest === 'through' && wallVerdicts.bytes === 'through' && wallVerdicts.address === 'through',
    JSON.stringify(wallVerdicts));

  const rows11 = await add(p11, 'keep', 'leaky.txt', 'the adapter will try to hand back a key\n');
  const st11 = await attachState(p11, 'local');
  const status11 = await p11.textContent('#status');
  ok('the caller never saw the leaking response', rows11.length === 0 || !rows11[0].addr,
    JSON.stringify(rows11[0] && rows11[0].addr));
  ok('the wall fired and the page said so', /REDACTION WALL/.test(status11 || ''), status11);
  ok('the local adapter was quarantined, not merely errored', st11 && st11.attached === false, st11 && st11.state);
  await c11.close();

  // ── 12 · older rows migrate ────────────────────────────────────────────────
  console.log('\n12 · slice-01 and slice-02 rows arrive in this slice\'s shape');
  const c12 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c12);
  const p12 = await c12.newPage();
  await p12.goto(PAGE, { waitUntil: 'load' });
  await settle(p12);
  const legacy = 'a'.repeat(64);
  const legacyOld = 'b'.repeat(64);
  await p12.evaluate(async ([sha, oldSha]) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('myspace', 2); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => {
      const t = db.transaction('files', 'readwrite');
      t.objectStore('files').put({ id: 'legacy1', name: 'old.txt', size: 12, type: '', mode: 'public', ts: Date.now(), sha, oldSha, keyref: null });
      t.objectStore('files').put({ id: 'legacy2', name: 'kept-old.txt', size: 9, type: '', mode: 'private', local: true, ts: Date.now(), keyref: 'device:aes-gcm:v1' });
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  }, [legacy, legacyOld]);
  const migrated = (await p12.evaluate(() => window.__myspace.rows()));
  const m1 = migrated.find(r => r.id === 'legacy1');
  const m2 = migrated.find(r => r.id === 'legacy2');
  ok('a slice-01 bare sha became the hive rail\'s address, and the bare field is gone',
    m1 && m1.addr && m1.addr.scheme === 'blossom' && m1.addr.address === legacy && m1.sha === undefined,
    JSON.stringify(m1 && { addr: m1.addr, sha: m1.sha }));
  ok('the earlier-shared copy migrated too', m1 && m1.oldAddr && m1.oldAddr.address === legacyOld && m1.oldSha === undefined,
    JSON.stringify(m1 && { oldAddr: m1.oldAddr, oldSha: m1.oldSha }));
  ok('the two old modes became the two purposes that mean the same thing',
    m1 && m1.purpose === 'share' && m1.mode === undefined && m2 && m2.purpose === 'keep' && m2.mode === undefined,
    JSON.stringify([m1 && m1.purpose, m2 && m2.purpose]));
  const persisted = (await p12.evaluate(() => window.__myspace.rows())).find(r => r.id === 'legacy1');
  ok('the migration was written back, not recomputed each read',
    persisted && persisted.sha === undefined && !!persisted.addr && persisted.purpose === 'share',
    JSON.stringify(persisted && { addr: persisted.addr, purpose: persisted.purpose }));
  await c12.close();

  // ── 13 · the shell cannot reach any rail, and the local rails reach nothing ─
  console.log('\n13 · source-level: who is allowed to touch a network');
  const shellSrc = await readFile(join(ROOT, 'surfaces/myspace.js'), 'utf8');
  const shellCode = shellSrc.replace(/\/\*[\s\S]*?\*\//g, '');   // comments may NAME a rail; code may not reach one
  const leaks = ['skaists.buzz', 'wrapAsPng', '24242', '27235', 'fetch('].filter(s => shellCode.includes(s));
  ok('the shell cannot reach any rail at all', leaks.length === 0, 'leaked: ' + leaks.join(', '));

  // The two rails that promise bytes do not leave contain no way to send them.
  // Source-level AND the runtime counts in section 2 — one of those alone is a
  // weaker claim than people read it as.
  const NET = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'importScripts', 'EventSource', 'RTCPeerConnection'];
  for (const [name, rel] of [['local', LOCAL_REL], ['temp', TEMP_REL]]) {
    const src = (await readFile(join(ROOT, rel), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    const found = NET.filter(s => src.includes(s));
    ok(`the ${name} rail contains no network primitive at all`, found.length === 0, 'found: ' + found.join(', '));
  }
  // NON-VACUITY for the check above: the same scan must FIND one in the rail
  // that legitimately has one, or it is a grep that can only ever say zero.
  const blossomSrc = (await readFile(join(ROOT, BLOSSOM_REL), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  ok('CONTROL — the same scan finds the network primitive in the rail that has one',
    NET.some(s => blossomSrc.includes(s)), 'scan returned nothing even for the hive rail');

  // ── 14 · the deleted false signal stays deleted ────────────────────────────
  console.log('\n14 · CLAUDE.md §2.10 — the false why-line is gone, not repaired');
  const DEAD = [
    'plaintext blob on the rail at its sha256',
    'ciphertext in local store. no rail record exists',
    'PUT /upload',
    'POST /api/invites/claim'
  ];
  // Scanned over CODE, not comments. The shell carries a comment naming the
  // exact sentences that were removed and why — §2.10 kills the false signal,
  // not the record of having killed it — and a scan that could not tell those
  // apart would make writing that record impossible.
  const stillThere = DEAD.filter(s => shellCode.includes(s));
  const htmlSrc = await readFile(join(ROOT, 'surfaces/myspace.html'), 'utf8');
  const htmlLeft = DEAD.filter(s => htmlSrc.includes(s));
  ok('no register still asserts a rail fact the shell no longer holds',
    stillThere.length === 0, 'still present in shell code: ' + stillThere.join(' | '));
  ok('and the page markup does not assert them either',
    htmlLeft.length === 0, 'still present in markup: ' + htmlLeft.join(' | '));
  // NON-VACUITY: the same strings must still be FOUND in the file that is
  // entitled to them, or this is a grep that can only ever say zero.
  ok('CONTROL — the hive adapter still names its own route, so the scan can find things',
    blossomSrc.includes('/upload') && blossomSrc.includes('24242'),
    'the scan found nothing even in the adapter that owns these facts');

  // A purpose card is VOICE from the register then FACTS from the rail, in that
  // order. When the two say the same sentence the card stutters — the raver
  // share card printed "the link opens it." twice, caught on the live page by
  // the eye seat 2026-09-20 22:51Z. Judged as a RULE over every register and
  // every purpose, not as the one string that was wrong: a row that only knows
  // the instance cannot stop the next one.
  const c14 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockHive(c14);
  const p14 = await c14.newPage();
  await p14.goto(PAGE, { waitUntil: 'load' });
  await settle(p14);
  await p14.waitForFunction(() => window.__myspace.purposes().length === 3, null, { timeout: 10000 }).catch(() => {});
  const stutters = [];
  for (const register of ['bee', 'raver', 'cypherpunk']) {
    const cards = await p14.evaluate(r => {
      document.body.setAttribute('data-reg', r);
      document.dispatchEvent(new Event('bregister'));
      const split = s => s.split(/(?<=[.!?])\s+/).map(x => x.trim().toLowerCase()).filter(Boolean);
      const dupOf = parts => parts.filter((x, i) => parts.indexOf(x) !== i);
      return {
        cards: [...document.querySelectorAll('#modes .mode')].map(b => ({
          id: b.getAttribute('data-purpose'), dup: dupOf(split(b.querySelector('span').textContent))
        })),
        // THE SAME two functions over a planted repeat, and over one without.
        probeDup: dupOf(split('one thing. one thing. another.')),
        probeClean: dupOf(split('one thing. another. a third.'))
      };
    }, register);
    cards.cards.forEach(c => { if (c.dup.length) stutters.push(register + '/' + c.id + ': "' + c.dup.join('" "') + '"'); });
    // NON-VACUITY, run by the page that does the judging: the same splitter and
    // the same duplicate finder must SEE a planted repeat and must NOT invent
    // one. Without both halves this row can only ever say zero.
    ok(`CONTROL — in ${register}, the duplicate finder catches a planted repeat and clears a clean card`,
      cards.cards.length === 3 && cards.probeDup.join() === 'one thing.' && cards.probeClean.length === 0,
      JSON.stringify({ dup: cards.probeDup, clean: cards.probeClean, cards: cards.cards.length }));
  }
  ok('no register says the same sentence twice in one purpose card',
    stutters.length === 0, stutters.join(' | '));
  await c14.close();

  // ── 15 · the three things a stranger with a phone could not do ─────────────
  // bee-laborer's rows, 2026-09-20 22:18Z: a kept file had no way to be opened,
  // the purpose picker vanished the moment a file existed, and NOTHING in this
  // gate had ever clicked #delConfirm — bFUzZ stubbed doDelete's drops and the
  // gate stayed 57/0, because judging a DECLARATION (deletable agrees with
  // x.drop) is not judging the MECHANISM. All three are driven here by the real
  // control, in one context, on one file.
  console.log('\n15 · a kept file opens · the picker survives the first file · delete, end to end');
  const c15 = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const wire15 = [];
  offBox(c15, wire15);
  await mockHive(c15);
  const p15 = await c15.newPage();
  const errs15 = [];
  p15.on('pageerror', e => errs15.push(e.message));
  await p15.goto(PAGE, { waitUntil: 'load' });
  await settle(p15);
  await p15.waitForFunction(() => window.__myspace.purposes().length === 3, null, { timeout: 10000 }).catch(() => {});

  const OPENED = 'this one is kept, and a stranger must be able to read it back.\n';
  const rows15 = await add(p15, 'keep', 'openable.txt', OPENED);
  const keptRow = rows15[0];
  ok('a file is on the page to act on', rows15.length === 1 && keptRow.addr.scheme === 'local',
    JSON.stringify(rows15.map(r => r.name + ':' + (r.addr && r.addr.scheme))));

  // (b) THE PICKER SURVIVES THE FIRST FILE. Measured as a box on screen, with
  // the empty-state drop zone as the CONTROL so the probe can return false.
  const vis15 = await p15.evaluate(() => {
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { h: Math.round(r.height), shown: !!el.offsetParent }; };
    return { state: document.body.getAttribute('data-state'), modes: box(document.getElementById('modes')),
             drop: box(document.querySelector('.drop')), buttons: document.querySelectorAll('#modes .mode').length };
  });
  ok('with a file on the page the purpose picker is still on screen, all three buttons',
    vis15.state === 'file' && vis15.modes && vis15.modes.shown === true && vis15.modes.h > 0 && vis15.buttons === 3,
    JSON.stringify(vis15));
  ok('CONTROL — the empty-state drop zone IS hidden in the same state, so the probe can say no',
    vis15.drop !== null && vis15.drop.shown === false,
    JSON.stringify(vis15.drop));

  // Reachable is not the same as visible: this adds a SECOND file by clicking
  // the picker while the first one is on the page. `add` clicks #mode-share, so
  // a hidden picker fails this row by timeout rather than by assertion — and
  // `share` is deliberately the FARTHEST purpose, because the reset row below
  // then has a move to observe. Adding under `now` would have left the picker
  // pressed on `now` either way, and a row satisfied whether or not the
  // mechanism ran is not a row.
  await add(p15, 'share', 'second.txt', SECOND);
  // The row count is the mechanism; the status line is only how the helper
  // guesses at it. Waited on explicitly here so this section cannot pass on a
  // settle heuristic the way it silently failed to before.
  await p15.waitForFunction(async () => (await window.__myspace.rows()).length === 2, null, { timeout: 15000 });
  const rows15b = await p15.evaluate(() => window.__myspace.rows());
  const second = rows15b.find(r => r.name === 'second.txt');
  ok('a SECOND file takes the purpose chosen from the picker with the first still there',
    rows15b.length === 2 && second && second.purpose === 'share' && second.addr.scheme === 'blossom',
    JSON.stringify(rows15b.map(r => r.name + ':' + r.purpose)));
  const pressed = await p15.evaluate(() => [...document.querySelectorAll('#modes .mode')]
    .map(b => b.getAttribute('data-purpose') + '=' + b.getAttribute('aria-pressed')).join(','));
  ok('and the selection moved back from share to the most private purpose, where the visitor can see it',
    pressed === 'now=true,keep=false,share=false', pressed);

  // (a) A KEPT FILE OPENS. Same read path a move uses, ending at the device.
  const wireBeforeOpen = wire15.length;
  const dl15 = p15.waitForEvent('download', { timeout: 20000 });
  await p15.click('#open-' + keptRow.id);
  const openedFile = await dl15;
  const openedBytes = await readFile(await openedFile.path());
  ok('the kept file OPENS, byte-exact, under its own name',
    openedBytes.equals(Buffer.from(OPENED, 'utf8')) && openedFile.suggestedFilename() === 'openable.txt',
    `${openedBytes.length} B as ${openedFile.suggestedFilename()}`);
  ok('and opening a kept file put ZERO requests on the wire',
    wire15.length === wireBeforeOpen, wire15.slice(wireBeforeOpen).join(' | '));

  // (c) DELETE, END TO END, THROUGH #delConfirm. The preconditions are asserted
  // first — a fixture asserts the precondition it claims to create, or "gone"
  // afterwards is indistinguishable from never having been there.
  const railHas = addr => p15.evaluate(async a => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('myspace-rail-local', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const b = await new Promise((res, rej) => { const t = db.transaction('blobs', 'readonly'); const q = t.objectStore('blobs').get(a); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    return b ? new Uint8Array(b).length : 0;
  }, addr);
  const keyHeld = id => p15.evaluate(async i => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('myspace', 2); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const k = await new Promise((res, rej) => { const t = db.transaction('keys', 'readonly'); const q = t.objectStore('keys').get(i); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    return !!k;                                    // a CryptoKey does not cross this boundary; its presence does
  }, id);

  const bytesBefore = await railHas(keptRow.addr.address);
  const keyBefore = await keyHeld(keptRow.id);
  ok('PRECONDITION — before the delete the rail holds the ciphertext and this page holds the key',
    bytesBefore > 0 && keyBefore === true, `rail ${bytesBefore} B · key ${keyBefore}`);

  await p15.click('#del-' + keptRow.id);
  await p15.waitForFunction(() => document.body.getAttribute('data-state') === 'delete', null, { timeout: 5000 });
  const delSaid = await p15.textContent('#del-body');
  ok('the sheet says what THIS rail will do, before the tap that does it',
    /key goes with them/i.test(delSaid || '') && /Only this phone opens it/i.test(delSaid || ''), delSaid);

  await p15.click('#delConfirm');
  await p15.waitForFunction(() => document.body.getAttribute('data-state') !== 'delete', null, { timeout: 15000 });
  const saidAfter = await p15.textContent('#status');
  ok('and afterwards it says which of the two things actually happened',
    /existed nowhere else/i.test(saidAfter || ''), saidAfter);

  const bytesAfter = await railHas(keptRow.addr.address);
  const keyAfter = await keyHeld(keptRow.id);
  ok('the rail really dropped the bytes — the row is not the only thing that went',
    bytesAfter === 0, `${bytesAfter} B still held`);
  ok('and the key went with them, so the ciphertext could not be read even if it had stayed',
    keyAfter === false, `key still held: ${keyAfter}`);

  await p15.reload({ waitUntil: 'load' });
  await settle(p15);
  await p15.waitForFunction(() => window.__myspace.purposes().length === 3, null, { timeout: 10000 }).catch(() => {});
  const afterReload = await p15.evaluate(() => window.__myspace.rows());
  ok('the row is gone after a reload — the delete was written, not just rendered',
    !afterReload.some(r => r.id === keptRow.id),
    JSON.stringify(afterReload.map(r => r.name)));
  ok('no page errors across open, picker and delete', errs15.length === 0, errs15.join(' | '));
  await c15.close();

} catch (e) {
  fail++;
  console.log('  FAIL harness — ' + (e && e.stack || e));
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`counted: ${LOG.put.length} PUT · ${LOG.get.length} GET · ${LOG.claim.length} claim · ${BLOBS.size} blob(s) in the mocked hive`);
if (pass === 0) { console.log('VACUOUS: no assertion ran'); process.exit(1); }
process.exit(fail ? 1 : 0);
