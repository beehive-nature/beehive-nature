#!/usr/bin/env node
/* bchat-live-proof.mjs — ON-DEMAND live wire proof for the bChat lane (SPEC-BCHAT-1).
   NOT a CI test: it makes REAL external connections by design — a CI run would
   prove nothing about today's relay posture. A seat runs it and pastes the
   receipts into the dispatch. Run: node scripts/bchat-live-proof.mjs
   [--relay wss://host] (default: dual-home cascade, primary then fallback).

   Measured-states law, applied to every hop — a state is named only when its
   own evidence lands:
     dialed ≠ connected ≠ authed(NIP-42) ≠ published(OK true + event id)
     ≠ received(B saw the id) ≠ unwrapped(seal signature VERIFIED) ≠ matched.
   Any refusal prints the relay's verdict VERBATIM and exits 1 with the state
   that failed. Keys are fresh per run — nothing persists, nothing is reused.

   THE CONTROL LEG (added 2026-10-03): before the member-relay legs, the same
   serializer/signer publishes a short kind-1 control note to a PUBLIC relay
   (cascade: relay.damus.io → nos.lol). If the public relay says OK true,
   our NIP-01 serialization + BIP-340 schnorr are valid — so a member relay's
   'auth-required: verification failed' is ADMISSION CONTROL (member hive),
   not a signature defect. One note per run, ephemeral key, neutral content. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const argRelay = (process.argv.indexOf('--relay') > 0) ? process.argv[process.argv.indexOf('--relay') + 1] : null;
const CASCADE = argRelay ? [argRelay] : ['wss://skaists.buzz', 'wss://relay.skaists.dev'];

/* the same modules the page runs — one implementation, no parallel truth */
const ctx = vm.createContext({ console, TextEncoder, TextDecoder, crypto: globalThis.crypto });
vm.runInContext(read('surfaces/onboarding/vendor/bnr-sign.js'), ctx, { filename: 'bnr-sign.js' });
vm.runInContext(read('surfaces/bchat-core.js'), ctx, { filename: 'bchat-core.js' });
vm.runInContext(read('surfaces/bchat-nip44.js'), ctx, { filename: 'bchat-nip44.js' });
vm.runInContext(read('surfaces/bchat-wire.js'), ctx, { filename: 'bchat-wire.js' });
const CORE = ctx.BCHAT, WIRE = ctx.BCHATWIRE;
const b2h = ctx.BCHATNIP44.bytesToHex;

function fresh() {
  const raw = new Uint8Array(32); crypto.getRandomValues(raw);
  const sec = b2h(raw);
  return { sec, pub: WIRE.xonly(sec) };
}
const ts = () => new Date().toISOString().slice(11, 23);
const log = (who, state, detail) => console.log('[' + ts() + '] ' + who.padEnd(2) + ' ' + state.padEnd(12) + ' ' + detail);

/* one socket per identity, cascade across roads; resolves on the first
   terminal state (published / rejected / received / closed / unreachable /
   timeout). AUTH (NIP-42) is answered when challenged; publish happens only
   after AUTH answered or 2s passed with no challenge (the join-event-publish
   pattern — never race EVENT into a pending AUTH). */
function session(who, ident, { filter, drive, timeoutMs = 40000 }) {
  return new Promise((resolve) => {
    const out = { who, url: null, connected: false, challenged: false, authSent: false, verdict: 'none', okMsg: '', event: null, closed: '', notices: [] };
    let ws = null, relayIdx = 0, settled = false, drove = false, subSent = false, expectId = null;
    const finish = (r) => { if (!settled) { settled = true; try { ws && ws.close(); } catch {} resolve(Object.assign(out, r)); } };
    const guard = setTimeout(() => finish({ verdict: 'timeout' }), timeoutMs); guard.unref?.();

    const ready = () => {
      if (drove || ws.readyState !== 1) return;
      /* drive after AUTH answered, or after a quiet 2s with no challenge */
      if (out.authSent || out.challenged) { if (out.authSent) driveNow(); }
      else quietTimer();
    };
    let quietT = null;
    const quietTimer = () => {
      if (quietT) return;
      quietT = setTimeout(() => { quietT = null; if (!out.challenged) driveNow(); }, 2000);
      quietT.unref?.();
    };
    const driveNow = () => {
      if (drove) return; drove = true;
      if (filter && !subSent) { sendReq(); }
      if (drive) {
        const send = (arr) => { ws.send(JSON.stringify(arr)); };
        expectId = drive(send, (id) => { expectId = id; }) || expectId;
        log(who, 'sent', 'EVENT offered' + (expectId ? ' · ' + String(expectId).slice(0, 8) + '…' : ''));
      }
    };
    const sendReq = () => {
      ws.send(JSON.stringify(['REQ', 'bchatlp_' + WIRE.nowSec(), filter]));
      subSent = true;
      log(who, 'REQ', JSON.stringify(filter));
    };

    function dial() {
      const url = CASCADE[relayIdx];
      out.url = url;
      log(who, 'dial', url);
      try { ws = new WebSocket(url); }
      catch (e) { return rotate('constructor: ' + e.message); }
      ws.onopen = () => {
        out.connected = true; out.verdict = 'connected';
        log(who, 'connected', url);
        if (filter && !drive) sendReq(); /* pure listener subscribes at once */
        ready();
      };
      ws.onerror = () => { if (!out.connected) rotate('error'); };
      ws.onclose = () => { if (!settled) rotate('closed'); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m[0] === 'AUTH' && m[1]) {
          out.challenged = true;
          const auth = WIRE.finishEvent({
            pubkey: ident.pub, created_at: WIRE.nowSec(), kind: 22242,
            tags: [['relay', url], ['challenge', m[1]]], content: ''
          }, ident.sec);
          ws.send(JSON.stringify(['AUTH', auth]));
          out.authSent = true;
          log(who, 'AUTH', 'challenge answered · kind 22242 ' + auth.id.slice(0, 8) + '…');
          driveNow();
          return;
        }
        if (m[0] === 'OK') {
          if (expectId && m[1] === expectId) {
            out.verdict = m[2] === true ? 'published' : 'rejected';
            out.okMsg = String(m[3] || '');
            log(who, 'OK ' + m[2], out.okMsg || ('event ' + String(m[1]).slice(0, 8) + '…'));
            finish();
          } else {
            log(who, 'OK(other)', String(m[1]).slice(0, 8) + '… ' + String(m[3] || ''));
          }
          return;
        }
        if (m[0] === 'EVENT' && m[2] && m[2].kind === 1059 && filter) {
          const p = (m[2].tags || []).filter(t => t[0] === 'p').map(t => t[1]);
          if (p.includes(ident.pub)) {
            out.verdict = 'received'; out.event = m[2];
            log(who, 'received', 'gift ' + m[2].id.slice(0, 8) + '… addressed to us');
            finish();
          }
          return;
        }
        if (m[0] === 'EOSE') { log(who, 'EOSE', 'end of stored events'); return; }
        if (m[0] === 'CLOSED') {
          out.verdict = 'closed'; out.closed = String(m[2] || '');
          log(who, 'CLOSED', out.closed + '  (verbatim)'); finish(); return;
        }
        if (m[0] === 'NOTICE') { out.notices.push(String(m[1])); log(who, 'NOTICE', String(m[1])); return; }
      };
    }
    function rotate(why) {
      relayIdx++;
      if (relayIdx < CASCADE.length) { log(who, 'rotate', why + ' → ' + CASCADE[relayIdx]); dial(); }
      else { out.verdict = 'unreachable'; out.why = why; finish(); }
    }
    dial();
  });
}

/* ── the run ── */
/* CONTROL (decisive, offline-first): verify our serializer/signer against an
   INDEPENDENT implementation before spending a connection. nostr-tools 2.10.4
   (the estate's own ops pin) recomputes ids with ITS serializer; if it disagrees,
   every relay verdict below is meaningless. Falls back to a public-relay publish
   attempt when nostr-tools is not importable (this network SNI-filters most
   public relays, so the offline check is the primary). */
let ctlNote = 'nostr-tools unavailable; public-relay fallback attempted';
try {
  const nt = await import('nostr-tools');
  const raw0 = new Uint8Array(32); crypto.getRandomValues(raw0);
  const sec0 = b2h(raw0);
  const auth0 = WIRE.finishEvent({
    pubkey: WIRE.xonly(sec0), created_at: WIRE.nowSec(), kind: 22242,
    tags: [['relay', CASCADE[0]], ['challenge', '00'.repeat(32)]], content: ''
  }, sec0);
  const hashOk = nt.getEventHash(auth0) === auth0.id;
  const sigOk = hashOk && nt.verifyEvent(auth0);
  log('C', 'control', 'nostr-tools cross-verify: hash-match=' + hashOk + ' signature=' + sigOk);
  if (!sigOk) {
    console.log('CONTROL FAILED OFFLINE — serializer/signature is wrong; FIX bchat-wire BEFORE reading any relay verdict below.');
    process.exit(1);
  }
  ctlNote = 'offline cross-library control PASSED (nostr-tools verified our hash + signature)';
} catch (e) {
  const CONTROL = ['wss://relay.damus.io', 'wss://nos.lol'];
  const c = fresh();
  const note = WIRE.finishEvent({
    pubkey: c.pub, created_at: WIRE.nowSec(), kind: 1, tags: [],
    content: 'bChat wire control probe — ephemeral key; NIP-01 serialization + schnorr validity check. zCode lane receipt.'
  }, c.sec);
  const savedCascade = CASCADE.slice();
  CASCADE.length = 0; CONTROL.forEach(u => CASCADE.push(u));
  const ctl = await session('C', c, { drive: (send, setExpect) => { setExpect(note.id); send(['EVENT', note]); }, timeoutMs: 25000 });
  CASCADE.length = 0; savedCascade.forEach(u => CASCADE.push(u));
  log('C', 'verdict', ctl.verdict + (ctl.okMsg ? ' · relay said: ' + ctl.okMsg : '') + (ctl.url ? ' · ' + ctl.url : ''));
  ctlNote = ctl.verdict === 'published'
    ? 'CONTROL PASSED on a public relay (event ' + note.id.slice(0, 16) + '…)'
    : 'CONTROL INCONCLUSIVE (' + ctl.verdict + ') — public relays unreachable from this network';
}
console.log('CONTROL VERDICT: ' + ctlNote);

const A = fresh(), B = fresh();
log('A', 'identity', 'fresh sender ' + A.pub.slice(0, 8) + '…');
log('B', 'identity', 'fresh recipient ' + B.pub.slice(0, 8) + '…');

const text = 'bChat live proof ' + new Date().toISOString() + ' — zCode seat, SPEC-BCHAT-1 wire';
const built = CORE.envelope({
  lane: CORE.LANES.BNR, from: { kind: 'npub', value: A.pub },
  body: { type: 'text', text }, policy: { retain: 'until-read' }
});
if (!built.ok) { console.error('REFUSED locally:', built.errors.join('; ')); process.exit(1); }
const gift = WIRE.buildDM(A.sec, A.pub, B.pub, CORE.wireEncode(built.env));
log('A', 'built', 'gift ' + gift.id.slice(0, 8) + '… · wrap ' + gift.content.length + 'B ciphertext · seal inside');

const bPromise = session('B', B, { filter: { kinds: [1059], '#p': [B.pub], limit: 4 }, timeoutMs: 60000 });
await new Promise(r => setTimeout(r, 1500)); /* B's subscription first — never publish into a deaf room */

const a = await session('A', A, {
  drive: (send, setExpect) => {
    setExpect(gift.id);
    send(['EVENT', gift]);
  }
});
console.log('---');
log('A', 'verdict', a.verdict + (a.okMsg ? ' · relay said: ' + a.okMsg : '') + (a.url ? ' · ' + a.url : ''));

if (a.verdict !== 'published') {
  console.log('FINDING: publication did not land — state reached: ' + a.verdict +
    (a.closed ? ' · CLOSED: ' + a.closed : '') +
    (a.notices.length ? ' · NOTICEs: ' + a.notices.join(' / ') : ''));
  console.log('This is the relay\'s own answer, verbatim above — it settles the kind-1059 allowlist question for today.');
  process.exit(1);
}

log('A', 'receipt', 'PUBLISHED · event id ' + gift.id.slice(0, 16) + '… on ' + a.url);
const b = await bPromise;
log('B', 'verdict', b.verdict + (b.url ? ' · ' + b.url : ''));
if (b.verdict !== 'received' || !b.event) {
  console.log('FINDING: published but not received in-window (' + b.verdict + ') — publication and delivery are different states; the id above is the search key for the box seat.');
  process.exit(1);
}
if (b.event.id !== gift.id) {
  log('B', 'note', 'a different gift arrived first (' + b.event.id.slice(0, 8) + '…) — still proving unwrap on a real wrap addressed to us');
}
const got = WIRE.unwrapGift(B.sec, B.pub, b.event);
const envBack = CORE.wireDecode(got.rumor.content);
log('B', 'unwrapped', 'seal signature VERIFIED · sender ' + got.from.slice(0, 8) + '… · rumor kind ' + got.rumor.kind);
log('B', 'matched', envBack.body.type === 'text' ? '"' + String(envBack.body.text).slice(0, 60) + '…"' : envBack.body.type);
console.log('---');
console.log('MEASURED STATES, all evidence-landed: connected ✓ · NIP-42 answered ' + (a.challenged ? '✓ (challenge came, we answered)' : '(no challenge demanded)') +
  ' · published ✓ (' + gift.id.slice(0, 16) + '…) · received ✓ · seal verified ✓ · text matched ' + (envBack.body.text === text ? '✓' : '✗') + '.');
process.exit(envBack.body.text === text ? 0 : 1);
