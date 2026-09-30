// walker-guard.mjs — skaists.walker-guard/1
// CODE-ENFORCED QUEUE MEMBERSHIP (founder order 2026-09-29d): remembering the
// rule did not prevent the stray-ark failure class (four memory-typed arks,
// one untied image, 2026-09-29c). From this module onward the walker:
//   · receives arks ONLY from nextPending() — read from the saved queue file,
//     minus already-resolved manifest states, in queue order;
//   · must pass assertQueueMember(ark) BEFORE any network request (rejects
//     malformed, out-of-queue, and already-resolved identifiers);
//   · must checkpoint ONLY through checkpointDownload/checkpointState, which
//     re-verify membership on the SAVE side and refuse downloaded entries
//     lacking a binding apid or a sha256 (bytes without identity never land).
// Memory-typed arks are void. The tests in walker-guard.test.mjs prove the
// rejections (including the actual stray from the 2026-09-29c incident).
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";

// Default paths = the live private tier. CI/tests inject fixtures via opts.
const DEFAULT_QUEUE = "file:///C:/Users/travi/family-lineage/images-harvest/sweep-queue.json";
const DEFAULT_MANIFEST = "file:///C:/Users/travi/family-lineage/images-harvest/images-manifest.json";
const DEFAULT_LOCK = "file:///C:/Users/travi/family-lineage/images-harvest/.writer-lock.json";
const LOCK_STALE_MS = 10 * 60 * 1000; // heartbeat older than this = takeover allowed

// ── EXCLUSIVE WRITER LOCK (founder order 2026-09-30c: another session
//    reported saving images during this walker's run, contradicting the
//    sole-writer claim — every walker entry point now shares ONE lock, and
//    every save path REQUIRES holding it; a second writer is refused) ──
export function acquireWriterLock(writerId, opts = {}) {
  if (!writerId) throw new Error("writerId required");
  const lockUrl = new URL(opts.lockPath || DEFAULT_LOCK);
  const now = new Date().toISOString();
  let prev = null;
  if (existsSync(lockUrl)) {
    try { prev = JSON.parse(readFileSync(lockUrl, "utf8")); } catch { prev = null; }
    if (prev && prev.writerId !== writerId && (Date.now() - Date.parse(prev.heartbeat)) < LOCK_STALE_MS)
      throw new Error("REFUSED: exclusive writer lock held by " + prev.writerId + " (heartbeat " + prev.heartbeat + ") — a second writer may not run");
  }
  const lock = { schema: "skaists.writer-lock/1", writerId, acquiredAt: (prev && prev.writerId === writerId && prev.acquiredAt) || now,
    heartbeat: now, previousWriter: prev && prev.writerId !== writerId ? { writerId: prev.writerId, heartbeat: prev.heartbeat, takenOverAt: now } : (prev && prev.previousWriter) || null };
  writeFileSync(lockUrl, JSON.stringify(lock, null, 1));
  return lock;
}

export function assertWriterLock(writerId, opts = {}) {
  if (!writerId) throw new Error("REFUSED: save without a writer identity — acquireWriterLock first");
  const lockUrl = new URL(opts.lockPath || DEFAULT_LOCK);
  if (!existsSync(lockUrl)) throw new Error("REFUSED: no writer lock exists — acquireWriterLock first");
  const lock = JSON.parse(readFileSync(lockUrl, "utf8"));
  if (lock.writerId !== writerId)
    throw new Error("REFUSED: exclusive writer lock held by " + lock.writerId + ", not " + writerId);
  if (Date.now() - Date.parse(lock.heartbeat) >= LOCK_STALE_MS)
    throw new Error("REFUSED: writer lock heartbeat stale (since " + lock.heartbeat + ") — re-acquire");
  return true;
}

export function releaseWriterLock(writerId, opts = {}) {
  const lockUrl = new URL(opts.lockPath || DEFAULT_LOCK);
  if (!existsSync(lockUrl)) return true;
  const lock = JSON.parse(readFileSync(lockUrl, "utf8"));
  if (lock.writerId !== writerId)
    throw new Error("REFUSED: cannot release a lock held by " + lock.writerId);
  unlinkSync(lockUrl);
  return true;
}

export function loadState(opts = {}) {
  const queueUrl = new URL(opts.queuePath || DEFAULT_QUEUE);
  const manifestUrl = new URL(opts.manifestPath || DEFAULT_MANIFEST);
  const queue = JSON.parse(readFileSync(queueUrl, "utf8"));
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
  if (!queue.queue || !Array.isArray(queue.queue)) throw new Error("bad queue file: no queue[]");
  const memberArks = new Set(queue.queue.map((x) => x.ark));
  const states = new Map(Object.entries(manifest.images || {}));
  return { queueUrl, manifestUrl, queue, manifest, memberArks, states };
}

// The ONLY sanctioned way the walker learns what to request next.
export function nextPending(n = 1, opts = {}) {
  const { queue, memberArks, states } = loadState(opts);
  const pending = queue.queue.filter((x) => memberArks.has(x.ark) && !states.has(x.ark));
  return pending.slice(0, n).map((x) => ({ ark: x.ark, minDepth: x.minDepth ?? null, emphasis: x.emphasis || "" }));
}

// Request-side guard: run BEFORE any fetch for an ark.
export function assertQueueMember(ark, opts = {}) {
  if (typeof ark !== "string" || !/^[A-Z0-9-]{6,}$/.test(ark))
    throw new Error("REJECT malformed ark: " + JSON.stringify(ark));
  const { memberArks, states } = loadState(opts);
  if (!memberArks.has(ark))
    throw new Error(
      "REJECT out-of-queue ark: " + ark + " — arks come from skaists.sweep-queue/1 via nextPending() only; memory-typed arks are void",
    );
  if (states.has(ark))
    throw new Error("REJECT already-resolved ark: " + ark + " (state=" + states.get(ark).state + ")");
  return true;
}

// Save-side guard for any state (negative or downloaded).
// opts.writer is REQUIRED — the exclusive writer lock must be held (09-30c).
export function checkpointState(ark, entry, opts = {}) {
  assertWriterLock(opts.writer, opts);
  const { memberArks, manifestUrl, manifest } = loadState(opts);
  if (!memberArks.has(ark))
    throw new Error("REJECT SAVE out-of-queue ark: " + ark + " — nothing may be recorded for it");
  assertRecordOutcome(entry?.state);
  manifest.images[ark] = { ...entry, guard: "queue-member verified " + new Date().toISOString() };
  writeFileSync(manifestUrl, JSON.stringify(manifest, null, 1));
  return true;
}

// Save-side guard for a DOWNLOAD: bytes without identity never land.
export function checkpointDownload(ark, entry, opts = {}) {
  if (entry?.state !== "downloaded") throw new Error("checkpointDownload requires state:'downloaded'");
  if (!entry.apid || !/^apid:TH-/.test(entry.apid))
    throw new Error("REJECT download without binding apid: " + ark);
  if (!/^[0-9a-f]{64}$/.test(entry.sha256 || ""))
    throw new Error("REJECT download without sha256: " + ark);
  return checkpointState(ark, entry, opts);
}

// ── WALKER-FAILURE CLASS (founder order 2026-09-29h: the four eval-err
//    executions were correctly returned to pending and retried — make that
//    classification PART OF THE GUARD: walker failures stay retryable and
//    never count as resolved record outcomes) ──
// Walker-failure states are the ones where the WALKER itself errored (its
// code/transport blew up), NOT the site's answer about the record. Site
// answers (xml-403, xml-404, binding-403, no-deepzoom-traffic, no-tiles)
// ARE record outcomes. The test below pins the classification.
export function isWalkerFailure(state) {
  return typeof state === "string" && /err$/i.test(state.trim());
}

export function assertRecordOutcome(state) {
  if (isWalkerFailure(state))
    throw new Error(
      "REJECT walker-failure as record outcome: '" + state + "' — use recordWalkerFailure(); the ark stays pending and retryable",
    );
  if (isRetryableObservation(state))
    throw new Error(
      "REJECT retryable-observation as record outcome: '" + state + "' — silence is not proof (founder order 09-29i); use recordObservation(); the ark stays pending",
    );
  return true;
}

// ── RETRYABLE-OBSERVATION CLASS (founder order 2026-09-29i: timeouts,
//    missing traffic, missing tiles, and binding failures remain RETRYABLE
//    unless explicit record-specific evidence establishes an outcome;
//    silence is not proof that no image exists) ──
// Only explicit site denials for the BOUND apid (xml-403/xml-404 etc.) and
// completed downloads are record outcomes. Everything observed by absence
// stays retryable.
export function isRetryableObservation(state) {
  if (typeof state !== "string") return false;
  return /^(no-deepzoom-traffic|no-tiles|binding-\d+|timeout.*)$/i.test(state.trim());
}

// Absence-observations go to manifest.retryableObservations (side log,
// never images) — the ark stays pending. Silence is not proof.
export function recordObservation(ark, kind, detail, opts = {}) {
  assertWriterLock(opts.writer, opts);
  const { manifestUrl, manifest } = loadState(opts);
  manifest.retryableObservations = manifest.retryableObservations || {};
  (manifest.retryableObservations[ark] = manifest.retryableObservations[ark] || []).push({
    ts: new Date().toISOString(), kind, detail: String(detail).slice(0, 200),
  });
  writeFileSync(manifestUrl, JSON.stringify(manifest, null, 1));
  return true;
}

// Walker failures go to a SEPARATE retryable log (manifest.walkerFailures),
// never to manifest.images — so nextPending() keeps handing the ark out.
export function recordWalkerFailure(ark, err, opts = {}) {
  assertWriterLock(opts.writer, opts);
  const { manifestUrl, manifest } = loadState(opts);
  manifest.walkerFailures = manifest.walkerFailures || {};
  (manifest.walkerFailures[ark] = manifest.walkerFailures[ark] || []).push({
    ts: new Date().toISOString(),
    err: String(err).slice(0, 200),
  });
  writeFileSync(manifestUrl, JSON.stringify(manifest, null, 1));
  return true;
}
