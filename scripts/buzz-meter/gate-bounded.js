#!/usr/bin/env node
// gate-bounded.js — the P-A + P-B bounded gate (founder mission 2026-09-16).
//
// A COPY of the production gate's auth semantics plus the two missing bound
// layers, proven off-production against mock upstreams. NEVER installed:
// the production gate (/opt/buzz-meter/gate.js, 172.18.0.1:8091) is
// untouched. P-C (upstream destroy on client disconnect) is deliberately
// NOT implemented — it would deliver aborts into llama-server, the #27388
// trigger class; that lands with the banked watchdog, per the sequencing
// ruling (contain → observe readiness → watchdog → cancellation).
//
// P-A — request bounds:
//   * upstream response-header timeout   BOUND_HEADER_MS  (default 60000)
//   * streaming idle timeout (SSE chunks) BOUND_IDLE_MS   (default 30000)
//     → on breach the upstream request is destroyed and the client gets 504
//       (mid-stream: the stream is cut and the verdict logged)
//   * per-key in-flight cap               BOUND_PERKEY    (default 1)
//   * bounded FIFO queue                  BOUND_QUEUE     (default 4)
//     → saturation answers 503 + Retry-After instead of queueing forever
//
// P-B — readiness admission:
//   * generation endpoints admit only after a GET upstream /slots probe
//     (200 ms budget, OK cached READY_TTL_MS, default 5000) — the probe law:
//     liveness is /slots, never /health
//   * not-ready → 503 {"upstream not ready"} + Retry-After
//   * keyless GET /readiness at the gate: 200/503 from the same probe, so
//     monitors stop eating 401s
//
// Verdict log carries duration + phase (P-E hygiene rides along):
//   {ts, key_id, path, verdict, phase, ms, queue_ms}
const http = require('http');
const fs = require('fs');

const UPSTREAM_HOST = process.env.UP_HOST || '172.18.0.1';
const UPSTREAM_PORT = parseInt(process.env.UP_PORT || '8090');
const UPSTREAM_KEY = process.env.LLAMA_KEY || fs.readFileSync('/opt/buzz-meter/upstream.key', 'utf8').trim();
const KEYS = process.env.TEST_KEYS || '/opt/buzz-meter/keys.json';
const ACCESS_LOG = process.env.TEST_LOG || '/opt/buzz-meter/logs/gate-access.log';
const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || '8091');
const LISTEN_HOST = process.env.LISTEN_HOST || '172.18.0.1';

const BOUND_HEADER_MS = parseInt(process.env.BOUND_HEADER_MS || '60000');
const BOUND_IDLE_MS = parseInt(process.env.BOUND_IDLE_MS || '30000');
const BOUND_PERKEY = parseInt(process.env.BOUND_PERKEY || '1');
const BOUND_QUEUE = parseInt(process.env.BOUND_QUEUE || '4');
const READY_TTL_MS = parseInt(process.env.READY_TTL_MS || '5000');
const READY_PROBE_MS = parseInt(process.env.READY_PROBE_MS || '200');

/* ── AV-2 shared pricing-freshness admission (M-REPAIR) ─────────────────
 * Founder ruling: the 300-second freshness law wires into the shared
 * admission boundary for EVERY operation creating new rate-dependent
 * exposure — the gate CONSUMES the serve's validated snapshot; there is no
 * second TTL implementation here. A cached verdict younger than the law's
 * own TTL window (minus probe margin) admits without a re-fetch; unknown
 * freshness (serve unreachable, no live cache) REFUSES new exposure,
 * fail-closed. Historical claims/credits/reconciliation are unaffected. */
const SERVE_HOST = process.env.SERVE_HOST || '172.18.0.1';
const SERVE_PORT = parseInt(process.env.SERVE_PORT || '8092');
const ADMIT_TIMEOUT_MS = parseInt(process.env.ADMIT_TIMEOUT_MS || '700');
let admitSnap = null; // { ttl_s, fetchedAtMs, minted_at }
function admitFresh(cb) {
  const margin = 250;
  if (admitSnap && (Date.now() - admitSnap.fetchedAtMs) < (admitSnap.ttl_s * 1000) - margin) {
    return cb(null, admitSnap);
  }
  const req = http.get({ host: SERVE_HOST, port: SERVE_PORT, path: '/v1/pricing/admit', timeout: ADMIT_TIMEOUT_MS }, (r) => {
    let b = '';
    r.on('data', (c) => { b += c; });
    r.on('end', () => {
      let j = null;
      try { j = JSON.parse(b); } catch (e) { return cb(e, null); }
      if (r.statusCode === 200 && j && j.ok) {
        admitSnap = { ttl_s: j.ttl_s, minted_at: j.minted_at, fetchedAtMs: Date.now() };
      } else {
        admitSnap = null; // stale/malformed verdicts never cache
      }
      cb((j && j.ok) ? null : new Error(j && j.message ? j.message : 'admission refused'), j);
    });
  });
  req.on('timeout', () => { req.destroy(); cb(new Error('admission probe timeout'), null); });
  req.on('error', (e) => cb(e, null));
}

const isGeneration = (req) => req.method === 'POST' || /\/(v1\/)?(completions|chat|completion|infill|embedding)/i.test(req.url);

function loadKeys() { try { return JSON.parse(fs.readFileSync(KEYS, 'utf8')); } catch (e) { return { keys: [] }; } }
function findKey(secret) { const l = loadKeys(); return l.keys.find(k => k.secret === secret && !k.revoked) || null; }
function logAccess(entry) { fs.appendFileSync(ACCESS_LOG, JSON.stringify(entry) + '\n'); }

/* ── P-B: the readiness probe (cached; /slots never /health) ─────────── */
let readyCache = { at: 0, ok: true };
function probeReady(cb) {
  const age = Date.now() - readyCache.at;
  if (age < READY_TTL_MS) return setImmediate(() => cb(readyCache.ok));
  const pr = http.get({ host: UPSTREAM_HOST, port: UPSTREAM_PORT, path: '/slots',
                        headers: { authorization: 'Bearer ' + UPSTREAM_KEY } }, (r) => {
    r.resume();
    const ok = r.statusCode === 200;
    readyCache = { at: Date.now(), ok };
    cb(ok);
  });
  pr.setTimeout(READY_PROBE_MS, () => { pr.destroy(new Error('probe-timeout')); });
  pr.on('error', () => { readyCache = { at: Date.now(), ok: false }; cb(false); });
}

/* ── P-A: bounded in-flight + FIFO queue ─────────────────────────────── */
const inFlight = new Map();   // key.id -> count
let inflightTotal = 0;
const queue = [];             // {run}

function acquire(key) {
  const n = inFlight.get(key.id) || 0;
  if (n < BOUND_PERKEY && queue.length === 0) { inFlight.set(key.id, n + 1); inflightTotal++; return true; }
  return false;
}
function release(key) {
  const n = (inFlight.get(key.id) || 1) - 1;
  if (n <= 0) inFlight.delete(key.id); else inFlight.set(key.id, n);
  inflightTotal--;
  const next = queue.shift();
  if (next) setImmediate(next.run);
}

/* ── the proxy with bounds ───────────────────────────────────────────── */
function proxyBounded(req, res, key, queuedAt) {
  const t0 = Date.now();
  let settled = false;   // settle once: the 504/502/complete/close races all funnel here
  const finish = (verdict, phase) => {
    if (settled) return;
    settled = true;
    logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url,
                verdict, phase, ms: Date.now() - t0, queue_ms: queuedAt ? t0 - queuedAt : 0 });
    release(key);
  };
  const headers = { ...req.headers };
  delete headers['authorization'];
  headers['authorization'] = 'Bearer ' + UPSTREAM_KEY;

  const up = http.request({ host: UPSTREAM_HOST, port: UPSTREAM_PORT, path: req.url, method: req.method, headers }, (ur) => {
    clearTimeout(headerTimer);
    logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url,
                verdict: ur.statusCode, phase: 'upstream-status', ms: Date.now() - t0 });
    res.writeHead(ur.statusCode, ur.headers);
    let idleTimer = null;
    const armIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        finish(504, 'stream-idle-cut');     // settle BEFORE destroying: the destroy-error must not race a second verdict
        ur.destroy(new Error('idle-cut'));
        try { res.end(); } catch (e) {}
      }, BOUND_IDLE_MS);
    };
    armIdle();
    ur.on('data', () => armIdle());
    ur.on('end', () => { clearTimeout(idleTimer); finish(ur.statusCode, 'complete'); });
    res.on('close', () => {
      clearTimeout(idleTimer);
      finish(res.writableEnded ? res.statusCode : 'client-departed', 'res-close');
    });
    ur.pipe(res);
  });
  // P-A header timeout: no upstream response headers in time → 504 + destroy
  const headerTimer = setTimeout(() => {
    finish(504, 'header-timeout');
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json', 'Retry-After': '10' });
      res.end(JSON.stringify({ error: { message: 'gate: upstream did not start responding (bounded)', code: 504 } }));
    }
    up.destroy(new Error('header-timeout'));
  }, BOUND_HEADER_MS);
  up.on('error', (e) => {
    if (settled) return;                     // expected aftermath of our own destroy
    finish(502, String(e.message).slice(0, 40));
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'gate: upstream unreachable', code: 502 } }));
    }
  });
  req.pipe(up);
}

/* ── the server ──────────────────────────────────────────────────────── */
const server = http.createServer((req, res) => {
  // keyless readiness endpoint (P-B): monitors stop eating 401s
  if (req.method === 'GET' && req.url.startsWith('/readiness')) {
    probeReady((ok) => {
      res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: ok, probed: '/slots' }));
    });
    return;
  }
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const secret = m ? m[1].trim() : null;
  const key = secret ? findKey(secret) : null;
  if (!key) {
    logAccess({ ts: new Date().toISOString(), key_id: secret ? 'unknown' : 'none', path: req.url, verdict: 401 });
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'gate: unknown or revoked key', type: 'authentication_error', code: 401 } }));
    return;
  }
  if (key.tier === 'paid' && !(key.balance_A > 0)) {
    logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url, verdict: 402 });
    res.writeHead(402, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'gate: no A balance on this key — top up to continue (Lane M)', type: 'payment_required', code: 402 } }));
    return;
  }
  // AV-2 admission: the shared freshness law gates every admitted request
  // (paid AND guest tiers alike — exposure is exposure). Fail-closed on
  // unknown freshness; cached validated verdicts admit within the law's own
  // TTL window.
  admitFresh((err, j) => {
    if (err || !j || !j.ok) {
      logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url, verdict: 503, phase: 'stale-admission', detail: err ? err.message : 'refused' });
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '5' });
      res.end(JSON.stringify({ error: { message: 'gate: rate set stale or freshness unknown — new exposure refused until a fresh mint (AV-2)', code: 503, stale: true, ttl_s: j ? j.ttl_s : undefined } }));
      return;
    }
    admitCont(key);
  });
  function admitCont(key) {
  if (!isGeneration(req)) { proxyBounded(req, res, key, null); return; }  // passthrough, bounded

  // generation: admission (P-B readiness) then bounded queueing (P-A)
  probeReady((ok) => {
    if (!ok) {
      logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url, verdict: 503, phase: 'not-ready' });
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '5' });
      res.end(JSON.stringify({ error: { message: 'gate: upstream not ready (slots probe failed — alive is not available)', code: 503 } }));
      return;
    }
    if (acquire(key)) { proxyBounded(req, res, key, null); return; }
    if (queue.length >= BOUND_QUEUE) {
      logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url, verdict: 503, phase: 'queue-full' });
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '15' });
      res.end(JSON.stringify({ error: { message: 'gate: queue saturated for this key (bounded)', code: 503 } }));
      return;
    }
    queue.push({ run: () => { acquire(key) && proxyBounded(req, res, key, Date.now()); } });
    req.on('aborted', () => { const i = queue.indexOf(this); }); // queued client gone: runner no-ops on dead res
  });
  } // admitCont
});
server.listen(LISTEN_PORT, LISTEN_HOST, () => console.log(
  `gate-bounded: listening on ${LISTEN_HOST}:${LISTEN_PORT} — header=${BOUND_HEADER_MS}ms idle=${BOUND_IDLE_MS}ms perkey=${BOUND_PERKEY} queue=${BOUND_QUEUE} readyTTL=${READY_TTL_MS}ms (P-A+P-B; P-C intentionally absent)`));
