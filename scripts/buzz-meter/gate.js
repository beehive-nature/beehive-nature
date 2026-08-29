#!/usr/bin/env node
// gate.js — the Lane M P2 per-key gate for /compute.
//
// Sits between Caddy and llama-server: every request's bearer is checked
// against the meter's key ledger (keys.json, 600, on-box). Valid key → the
// request proxies to llama-server with the CANONICAL server key (guest keys
// never see it); unknown/revoked key → 401 at the gate. Each request is
// logged with its key-id — the attribution seam that lets receipts name their
// spender. FREE tier (qwen lane): issued guest keys pass without charge, per
// the founder tier-ladder ruling; a paid-tier key additionally requires
// balance > 0 (the decrement lands with P3 pricing).
//
// Streaming is a pure pipe (SSE passes untouched). No payment processing, no
// custody of member keys — the gate is metering, per the baton fence.
const http = require('http');
const fs = require('fs');

const KEYS = '/opt/buzz-meter/keys.json';
const UPSTREAM_HOST = '172.18.0.1';
const UPSTREAM_PORT = 8090;          // llama-server, bridge-internal
const UPSTREAM_KEY = process.env.LLAMA_KEY || fs.readFileSync('/opt/buzz-meter/upstream.key', 'utf8').trim();
const ACCESS_LOG = '/opt/buzz-meter/logs/gate-access.log';

function loadKeys() {
  try { return JSON.parse(fs.readFileSync(KEYS, 'utf8')); } catch (e) { return { keys: [] }; }
}

function findKey(secret) {
  const ledger = loadKeys();
  return ledger.keys.find(k => k.secret === secret && !k.revoked) || null;
}

function logAccess(entry) {
  fs.appendFileSync(ACCESS_LOG, JSON.stringify(entry) + '\n');
}

const server = http.createServer((req, res) => {
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
  // proxy with the canonical upstream key; never echo the guest secret
  const headers = { ...req.headers };
  delete headers['authorization'];
  headers['authorization'] = 'Bearer ' + UPSTREAM_KEY;
  const up = http.request({ host: UPSTREAM_HOST, port: UPSTREAM_PORT, path: req.url, method: req.method, headers }, (ur) => {
    logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url, verdict: ur.statusCode });
    res.writeHead(ur.statusCode, ur.headers);
    ur.pipe(res);                                  // streaming passes untouched
  });
  up.on('error', (e) => {
    logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url, verdict: 502, err: String(e.message).slice(0, 60) });
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'gate: upstream unreachable', code: 502 } }));
  });
  req.pipe(up);
});
server.listen(8091, '172.18.0.1', () => console.log('gate: listening on 172.18.0.1:8091 (LLAMA_KEY ' + (process.env.LLAMA_KEY ? 'from env' : 'from /etc/buzz-compute/api.key') + ')'));
