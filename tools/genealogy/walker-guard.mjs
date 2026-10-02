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
//
// PR #296 review hardening (2026-10-02, founder-ordered fixes):
//   · P1 lock acquisition is ATOMIC — fresh claims take the lock via
//     exclusive create (O_EXCL); a lost race REFUSES instead of silently
//     double-holding; holder refreshes replace atomically and re-read;
//   · P1 checkpointState enforces an outcome ALLOWLIST — 'downloaded' must
//     come through checkpointDownload; unrecognized states are rejected,
//     not denylisted around;
//   · P1 checkpointDownload verifies the apid is bound to THIS ark — the
//     binding evidence {url, response} must match the das/v2 name binding
//     for the ark exactly (a neighboring filmstrip apid no longer passes);
//   · P2 every manifest/lock write goes through atomic temp+replace — a
//     crash can never leave the authoritative manifest truncated;
//   · P2 recordObservation/recordWalkerFailure assert queue membership too
//     (the stray-ark class could re-enter through the retry logs).
import { readFileSync, writeFileSync, existsSync, unlinkSync, openSync, closeSync, renameSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Default paths = the live private tier. CI/tests inject fixtures via opts.
const DEFAULT_QUEUE = "file:///C:/Users/travi/family-lineage/images-harvest/sweep-queue.json";
const DEFAULT_MANIFEST = "file:///C:/Users/travi/family-lineage/images-harvest/images-manifest.json";
const DEFAULT_LOCK = "file:///C:/Users/travi/family-lineage/images-harvest/.writer-lock.json";
const LOCK_STALE_MS = 10 * 60 * 1000; // heartbeat older than this = takeover allowed

// THE canonical ark→apid binding wire (the only other home of this URL is
// sweep-walker.mjs; the fs-adapter note elides the prefix). The guard
// reconstructs it from the ark and compares it to the walker's binding
// evidence — the apid must come from THIS ark's binding, not a neighbor's.
const BINDING_URL_FOR = (ark) =>
  "https://sg30p0.familysearch.org/service/records/storage/dascloud/das/v2/3:1:" + ark + "/name?namespace=apid";
const normalizeApid = (s) => String(s ?? "").trim().replace(/^apid:/, "");

// Atomic replace: write a sibling temp file, then rename over the target.
// rename is the atomic step on both POSIX and Windows (MoveFileEx with
// REPLACE_EXISTING); a crash leaves either the old file or the new one,
// never a truncated half-write (PR #296 review P2).
function atomicReplace(url, text) {
  const tmp = new URL(url.href + ".tmp-" + process.pid + "-" + randomUUID().slice(0, 8));
  writeFileSync(tmp, text);
  try {
    renameSync(tmp, url);
  } catch (first) {
    // Windows can transiently refuse a replace while another handle reads
    // the target — one bounded retry, then fail loudly (never truncate).
    try {
      renameSync(tmp, url);
    } catch (second) {
      try { unlinkSync(tmp); } catch { /* best effort cleanup */ }
      throw second;
    }
    void first;
  }
}

// Exclusive create (O_EXCL): returns false if the file already exists.
// The atomicity primitive for lock claims — only ONE of N racing writers
// can create the lock file; every loser sees EEXIST and refuses (P1).
function exclusiveCreate(url, text) {
  let fd;
  try {
    fd = openSync(url, "wx");
  } catch (e) {
    if (e.code === "EEXIST") return false;
    throw e;
  }
  try {
    writeFileSync(fd, text);
  } finally {
    closeSync(fd);
  }
  return true;
}

function safeReadJson(url) {
  try { return JSON.parse(readFileSync(url, "utf8")); } catch { return null; }
}

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
    prev = safeReadJson(lockUrl);
    if (prev && prev.writerId !== writerId && (Date.now() - Date.parse(prev.heartbeat)) < LOCK_STALE_MS)
      throw new Error("REFUSED: exclusive writer lock held by " + prev.writerId + " (heartbeat " + prev.heartbeat + ") — a second writer may not run");
    if (prev && prev.writerId === writerId) {
      // Holder heartbeat refresh: atomic replace, then RE-READ — if a
      // takeover raced the refresh, this writer stands down (P1).
      const refreshed = { ...prev, schema: "skaists.writer-lock/1", writerId, heartbeat: now };
      atomicReplace(lockUrl, JSON.stringify(refreshed, null, 1));
      const back = safeReadJson(lockUrl);
      if (!back || back.writerId !== writerId)
        throw new Error("REFUSED: lock takeover raced the heartbeat refresh — " + (back ? back.writerId : "unknown") + " now holds it; stand down");
      return refreshed;
    }
    // Stale foreign lock: takeover must be CONDITIONAL on the stale identity
    // still being on disk at claim time (PR #296 review P1). Protocol: RENAME
    // the lock into a quarantine name — atomic, and it succeeds for exactly
    // ONE of N contenders (the rest fail or find the lock gone). If the
    // quarantined content is NOT the stale identity this writer judged (a
    // fresh claim landed between read and rename), RESTORE it and refuse.
    // Only after the quarantine provably holds the judged-stale identity is
    // the fresh exclusive claim made — and a lost create race still refuses.
    const quarantine = new URL(lockUrl.href + ".takeover-" + randomUUID().slice(0, 8));
    try {
      renameSync(lockUrl, quarantine);
    } catch { /* the lock vanished — another contender quarantined it; the exclusive claim below settles the winner */ }
    if (existsSync(quarantine)) {
      const stolen = safeReadJson(quarantine);
      if (!prev || !stolen || stolen.writerId !== prev.writerId || stolen.heartbeat !== prev.heartbeat) {
        // we renamed somebody's FRESH lock — restore it and stand down
        if (!existsSync(lockUrl)) {
          try { renameSync(quarantine, lockUrl); } catch { /* restore raced a new claim — that claimant owns the file */ }
        }
        const winner = safeReadJson(lockUrl);
        throw new Error("REFUSED: takeover raced a fresh claim — " + (winner ? winner.writerId : "another writer") + " holds it; stand down");
      }
      // genuinely the stale identity we judged: drop the quarantine copy and claim
      try { unlinkSync(quarantine); } catch { /* best effort */ }
    }
  }
  const lock = { schema: "skaists.writer-lock/1", writerId, acquiredAt: now, heartbeat: now,
    previousWriter: prev && prev.writerId !== writerId ? { writerId: prev.writerId, heartbeat: prev.heartbeat, takenOverAt: now } : (prev && prev.previousWriter) || null };
  if (!exclusiveCreate(lockUrl, JSON.stringify(lock, null, 1))) {
    const winner = safeReadJson(lockUrl);
    throw new Error("REFUSED: exclusive writer lock held by " + (winner ? winner.writerId : "another writer") + " (heartbeat " + (winner ? winner.heartbeat : "unknown") + ") — a second writer may not run");
  }
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

// ── WALKER-FAILURE CLASS (founder order 2026-09-29h: the four eval-err
//    executions were correctly returned to pending and retried — make that
//    classification PART OF THE GUARD: walker failures stay retryable and
//    never count as resolved record outcomes) ──
// Walker-failure states are the ones where the WALKER itself errored (its
// code/transport blew up), NOT the site's answer about the record. Site
// answers (xml-403, xml-404) ARE record outcomes. The tests pin the classes.
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
export function isRetryableObservation(state) {
  if (typeof state !== "string") return false;
  return /^(no-deepzoom-traffic|no-tiles|binding-\d+|timeout.*)$/i.test(state.trim());
}

// ── OUTCOME ALLOWLIST (PR #296 review P1): a record OUTCOME is either a
//    completed download (validated by checkpointDownload, never accepted
//    from checkpointState) or an EXPLICIT site denial of the xml-NNN(-all)
//    class. Anything else is an unrecognized state and is refused — an
//    allowlist, not a denylist, so a typo or a novel state can never land
//    as if it were the site's answer. ──
export function isRecordOutcome(state) {
  return typeof state === "string" && /^xml-\d{3}(-all)?$/.test(state.trim());
}

// Shared save path: membership + holder lock + ATOMIC manifest replace.
// Outcomes are FINAL (PR #296 review P2): an ark already present in
// manifest.images is never overwritten — a late or duplicate save cannot
// replace a download's apid/hash/binding with a lesser state.
function saveEntry(ark, entry, opts) {
  assertWriterLock(opts.writer, opts);
  const { memberArks, manifestUrl, manifest, states } = loadState(opts);
  if (!memberArks.has(ark))
    throw new Error("REJECT SAVE out-of-queue ark: " + ark + " — nothing may be recorded for it");
  if (states.has(ark))
    throw new Error("REJECT SAVE already-resolved ark: " + ark + " (state=" + states.get(ark).state + ") — outcomes are final; no overwrite, no transition");
  manifest.images[ark] = { ...entry, guard: "queue-member verified " + new Date().toISOString() };
  atomicReplace(manifestUrl, JSON.stringify(manifest, null, 1));
  return true;
}

// Save-side guard for a site-answer state (negative outcomes only).
// opts.writer is REQUIRED — the exclusive writer lock must be held (09-30c).
export function checkpointState(ark, entry, opts = {}) {
  if (entry?.state === "downloaded")
    throw new Error(
      "REJECT 'downloaded' via checkpointState: " + ark + " — downloads must pass checkpointDownload (binding evidence + sha256 enforced there)",
    );
  assertRecordOutcome(entry?.state);
  if (!isRecordOutcome(entry?.state))
    throw new Error(
      "REJECT unrecognized record outcome: " + JSON.stringify(entry?.state) + " — outcomes are the explicit site-denial class xml-NNN(-all) only ('downloaded' arrives via checkpointDownload)",
    );
  return saveEntry(ark, entry, opts);
}

// Save-side guard for a DOWNLOAD: bytes without identity never land, and
// the identity must be THIS ark's (PR #296 review P1): the walker supplies
// binding evidence {url, response} from the das/v2 name binding it fetched,
// and the guard reconstructs the binding URL from the ark and requires the
// response to normalize to the entry's apid — a neighboring filmstrip apid
// no longer passes (a sha256 over the wrong image's bytes proves nothing
// about ark↔image identity).
export function checkpointDownload(ark, entry, opts = {}) {
  if (entry?.state !== "downloaded") throw new Error("checkpointDownload requires state:'downloaded'");
  if (!entry.apid || !/^apid:TH-/.test(entry.apid))
    throw new Error("REJECT download without binding apid: " + ark);
  if (!/^[0-9a-f]{64}$/.test(entry.sha256 || ""))
    throw new Error("REJECT download without sha256: " + ark);
  const binding = entry?.binding;
  if (!binding || typeof binding.url !== "string" || typeof binding.response !== "string")
    throw new Error("REJECT download without binding evidence {url, response} from the das/v2 name binding for THIS ark: " + ark);
  if (binding.url !== BINDING_URL_FOR(ark))
    throw new Error("REJECT binding evidence URL mismatch for " + ark + " — expected exactly " + BINDING_URL_FOR(ark));
  if (normalizeApid(binding.response) !== normalizeApid(entry.apid))
    throw new Error("REJECT binding response does not normalize to the entry apid — the apid may belong to a different image: " + ark);
  return saveEntry(ark, { ...entry, bindingVerified: "ark-bound: das/v2 url + response match this ark" }, opts);
}

// Absence-observations go to manifest.retryableObservations (side log,
// never images) — the ark stays pending. Silence is not proof.
// Queue membership is asserted here too (PR #296 review P2): the stray-ark
// class must not re-enter through the retry logs.
export function recordObservation(ark, kind, detail, opts = {}) {
  assertQueueMember(ark, opts);
  assertWriterLock(opts.writer, opts);
  const { manifestUrl, manifest } = loadState(opts);
  manifest.retryableObservations = manifest.retryableObservations || {};
  (manifest.retryableObservations[ark] = manifest.retryableObservations[ark] || []).push({
    ts: new Date().toISOString(), kind, detail: String(detail).slice(0, 200),
  });
  atomicReplace(manifestUrl, JSON.stringify(manifest, null, 1));
  return true;
}

// Walker failures go to a SEPARATE retryable log (manifest.walkerFailures),
// never to manifest.images — so nextPending() keeps handing the ark out.
// Queue membership is asserted here too (PR #296 review P2).
export function recordWalkerFailure(ark, err, opts = {}) {
  assertQueueMember(ark, opts);
  assertWriterLock(opts.writer, opts);
  const { manifestUrl, manifest } = loadState(opts);
  manifest.walkerFailures = manifest.walkerFailures || {};
  (manifest.walkerFailures[ark] = manifest.walkerFailures[ark] || []).push({
    ts: new Date().toISOString(),
    err: String(err).slice(0, 200),
  });
  atomicReplace(manifestUrl, JSON.stringify(manifest, null, 1));
  return true;
}
