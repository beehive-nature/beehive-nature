// av2-av3-repair.js — apply the Ceremony M repair patches to gate-bounded.js
const fs = require('fs');
let s = fs.readFileSync('ops/buzz-meter/gate-bounded.js', 'utf8');

// ═══ AV-2: rate freshness as a shared admission precondition ═══
// The gate does NOT duplicate TTL logic — it reads the same rate_set.json
// the x402-session paths use, and refuses generation admission when the
// rate handle is stale. Non-generation requests (credits, reconciliation,
// already-qualified obligations) do NOT check rate freshness (the founder's
// law: they don't create new priced exposure).
const rateProbe = `
/* ── AV-2: rate-freshness admission (the shared pricing precondition) ──
   Reads rate_set.json's minted_at (the SAME attestation the x402-session
   paths enforce via rate_set_in_force). Refuses typed on stale/future.
   Caches for READY_TTL_MS. Non-generation requests bypass this check. */
const RATE_SET_PATH = process.env.RATE_SET_PATH || '/opt/buzz-meter/rate_set.json';
const RATE_TTL_S = parseFloat(process.env.RATE_TTL_S || '300');
let rateCache = { at: 0, ok: true, age: 0 };
function probeRate(cb) {
  const age_of_cache = Date.now() - rateCache.at;
  if (age_of_cache < READY_TTL_MS) return setImmediate(() => cb(rateCache.ok, rateCache.age));
  let minted = null;
  try {
    const rs = JSON.parse(fs.readFileSync(RATE_SET_PATH, 'utf8'));
    minted = rs.minted_at ? Date.parse(rs.minted_at) : null;
  } catch (e) { minted = null; }
  if (minted === null || isNaN(minted)) {
    // absent attestation = unjudgeable, passes (the x402_meter.py law)
    rateCache = { at: Date.now(), ok: true, age: -1 };
    return cb(true, -1);
  }
  const now = Date.now();
  const ageS = (now - minted) / 1000;
  if (minted > now) {
    rateCache = { at: Date.now(), ok: false, age: ageS };
    return cb(false, ageS);  // future-dated = malformed, refuse
  }
  const ok = ageS < RATE_TTL_S;  // exclusive at TTL (inclusive refusal per rate_set_in_force)
  rateCache = { at: Date.now(), ok, age: ageS };
  cb(ok, ageS);
}
`;
const rateAnchor = '/* ── P-A: bounded in-flight + FIFO queue ─────────────────────────────── */
';
if (!s.includes(rateAnchor)) { console.error('P-A anchor missing'); process.exit(1); }
s = s.replace(rateAnchor, rateProbe + '\n' + rateAnchor);

// Wire rate freshness into the generation admission path
const oldAdmission = `  // generation: admission (P-B readiness) then bounded queueing (P-A)
  probeReady((ok) => {
    if (!ok) {
      logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url, verdict: 503, phase: 'not-ready' });
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '5' });
      res.end(JSON.stringify({ error: { message: 'gate: upstream not ready (slots probe failed — alive is not available)', code: 503 } }));
      return;
    }`;
const newAdmission = `  // generation: admission (P-B readiness + AV-2 rate freshness) then bounded queueing (P-A)
  probeReady((ok) => {
    if (!ok) {
      logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url, verdict: 503, phase: 'not-ready' });
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '5' });
      res.end(JSON.stringify({ error: { message: 'gate: upstream not ready (slots probe failed — alive is not available)', code: 503 } }));
      return;
    }
    // AV-2: the rate handle must be fresh before new priced exposure is admitted
    probeRate((rateOk, rateAge) => {
    if (!rateOk) {
      logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url, verdict: 503, phase: 'rate-stale', rate_age_s: Math.round(rateAge) });
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '10' });
      res.end(JSON.stringify({ error: { message: 'gate: rate set stale (age ' + Math.round(rateAge) + 's >= TTL ' + RATE_TTL_S + 's — refresh before new priced work)', code: 503, phase: 'rate-stale' } }));
      return;
    }`;
if (!s.includes(oldAdmission)) { console.error('admission anchor missing'); process.exit(1); }
s = s.replace(oldAdmission, newAdmission);

// Close the probeRate callback — find the end of the probeReady callback block
// The generation admission continues after the rate check; we need to close
// the extra callback nesting. Find the queue-full section and close before it.
const oldQueueFull = `    if (queue.length >= BOUND_QUEUE) {`;
const newQueueFull = `    if (queue.length >= BOUND_QUEUE) {`;
// Actually, the nesting: probeReady((ok) => { ... probeRate((rateOk, rateAge) => { ... } }
// We need to close the probeRate's callback before the end of probeReady's.
// The cleanest way: find the end of the generation handler and add a closing }
const oldEndGen = `    queue.push({ run: () => { acquire(key) && proxyBounded(req, res, key, Date.now()); } });
    req.on('aborted', () => { const i = queue.indexOf(this); }); // queued client gone: runner no-ops on dead res
  });
});`;
const newEndGen = `    queue.push({ run: () => { acquire(key) && proxyBounded(req, res, key, Date.now()); } });
    req.on('aborted', () => { const i = queue.indexOf(this); }); // queued client gone: runner no-ops on dead res
    });
  });
});`;
if (!s.includes(oldEndGen)) { console.error('endGen anchor missing'); process.exit(1); }
s = s.replace(oldEndGen, newEndGen);

// ═══ AV-3: drill correlation ID passthrough + observability ═══
// The gate forwards X-Drill-ID (if present) to upstream and logs it in the
// access verdict — drill-local diagnostics, not a durable payment identity.
const oldProxy = `  const headers = { ...req.headers };
  delete headers['authorization'];
  headers['authorization'] = 'Bearer ' + UPSTREAM_KEY;`;
const newProxy = `  const headers = { ...req.headers };
  delete headers['authorization'];
  headers['authorization'] = 'Bearer ' + UPSTREAM_KEY;
  // AV-3: forward the drill correlation ID (drill-local diagnostics only)
  const drillId = req.headers['x-drill-id'] || null;`;
if (!s.includes(oldProxy)) { console.error('proxy anchor missing'); process.exit(1); }
s = s.replace(oldProxy, newProxy);

// Add drill_id to the finish() log
const oldFinish = `  const finish = (verdict, phase) => {
    if (settled) return;
    settled = true;
    logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url,
                verdict, phase, ms: Date.now() - t0, queue_ms: queuedAt ? t0 - queuedAt : 0 });
    release(key);
  };`;
const newFinish = `  const finish = (verdict, phase) => {
    if (settled) return;
    settled = true;
    logAccess({ ts: new Date().toISOString(), key_id: key.id, path: req.url,
                verdict, phase, ms: Date.now() - t0, queue_ms: queuedAt ? t0 - queuedAt : 0,
                ...(drillId ? { drill_id: drillId } : {}) });
    release(key);
  };`;
if (!s.includes(oldFinish)) { console.error('finish anchor missing'); process.exit(1); }
s = s.replace(oldFinish, newFinish);

fs.writeFileSync('ops/buzz-meter/gate-bounded.js', s);
console.log('AV-2 rate-freshness + AV-3 drill-ID applied');
