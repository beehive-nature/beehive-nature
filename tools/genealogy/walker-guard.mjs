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
//     exclusive create (O_EXCL); refresh and stale takeover first quarantine
//     the exact observed bytes, then re-claim exclusively; lost races REFUSE;
//   · P1 checkpointState enforces an outcome ALLOWLIST — 'downloaded' must
//     come through checkpointDownload; unrecognized states are rejected,
//     not denylisted around;
//   · P1 checkpointDownload verifies the apid is bound to THIS ark by
//     fetching the canonical das/v2 binding itself (caller evidence cannot
//     authenticate itself; a neighboring filmstrip apid no longer passes);
//   · P2 every manifest write goes through atomic temp+replace — a crash
//     cannot leave the authoritative manifest truncated;
//   · P2 recordObservation/recordWalkerFailure assert queue membership too
//     (the stray-ark class could re-enter through the retry logs).
import { readFileSync, writeFileSync, existsSync, unlinkSync, openSync, closeSync, renameSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Default paths = the live private tier. CI/tests inject fixtures via opts.
const DEFAULT_QUEUE = "file:///C:/Users/travi/family-lineage/images-harvest/sweep-queue.json";
const DEFAULT_MANIFEST = "file:///C:/Users/travi/family-lineage/images-harvest/images-manifest.json";
const DEFAULT_LOCK = "file:///C:/Users/travi/family-lineage/images-harvest/.writer-lock.json";
const LOCK_STALE_MS = 10 * 60 * 1000; // heartbeat older than this = takeover allowed
const OWNED_CLAIMS = new Map();
const claimKey = (url, writerId) => url.href + "\n" + writerId;

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

function readClaim(url) {
  try {
    const text = readFileSync(url, "utf8");
    return { text, parsed: JSON.parse(text), mtimeMs: statSync(url).mtimeMs };
  } catch {
    try { return { text: readFileSync(url, "utf8"), parsed: null, mtimeMs: statSync(url).mtimeMs }; }
    catch { return null; }
  }
}

// Serialize refresh and takeover through an atomic rename. The replacement is
// allowed only when the quarantined bytes exactly equal those this caller
// inspected. A contender may create a new claim while the canonical path is
// absent; in that case exclusiveCreate loses and this caller stands down.
function replaceClaimIfUnchanged(lockUrl, expectedText, replacementText) {
  const quarantine = new URL(lockUrl.href + ".claim-" + randomUUID().slice(0, 8));
  try { renameSync(lockUrl, quarantine); }
  catch { throw new Error("REFUSED: lock changed before conditional claim; stand down"); }
  const actualText = readFileSync(quarantine, "utf8");
  if (actualText !== expectedText) {
    if (!existsSync(lockUrl)) {
      try { renameSync(quarantine, lockUrl); } catch { /* another claimant owns the canonical path */ }
    }
    throw new Error("REFUSED: lock identity changed before conditional claim; stand down");
  }
  if (!exclusiveCreate(lockUrl, replacementText)) {
    try { unlinkSync(quarantine); } catch { /* best effort */ }
    throw new Error("REFUSED: another writer won the conditional claim; stand down");
  }
  try { unlinkSync(quarantine); } catch { /* the canonical claim is already complete */ }
}

// Conditional release uses the same quarantine/byte-identity primitive as a
// refresh or takeover. An unconditional unlink can erase a contender's fresh
// claim when the old holder races a stale takeover (PR #296 review P1).
function removeClaimIfUnchanged(lockUrl, expectedText) {
  const quarantine = new URL(lockUrl.href + ".release-" + randomUUID().slice(0, 8));
  try { renameSync(lockUrl, quarantine); }
  catch { throw new Error("REFUSED: lock changed before conditional release; stand down"); }
  const actualText = readFileSync(quarantine, "utf8");
  if (actualText !== expectedText) {
    if (!existsSync(lockUrl)) {
      try { renameSync(quarantine, lockUrl); } catch { /* another claimant owns the canonical path */ }
    }
    throw new Error("REFUSED: lock identity changed before conditional release; stand down");
  }
  unlinkSync(quarantine);
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
  let observed = null;
  if (existsSync(lockUrl)) {
    observed = readClaim(lockUrl);
    if (!observed) throw new Error("REFUSED: lock vanished while being inspected; retry acquisition");
    prev = observed.parsed;
    const heartbeatMs = prev ? Date.parse(prev.heartbeat) : observed.mtimeMs;
    const fresh = Number.isFinite(heartbeatMs) && (Date.now() - heartbeatMs) < LOCK_STALE_MS;
    const ownedToken = OWNED_CLAIMS.get(claimKey(lockUrl, writerId));
    if (prev && prev.writerId === writerId && prev.claimId && ownedToken === prev.claimId) {
      // Holder heartbeat refresh is itself a conditional claim. It never
      // replaces whatever happens to be at the path after the initial read.
      const refreshed = { ...prev, schema: "skaists.writer-lock/1", writerId, heartbeat: now };
      replaceClaimIfUnchanged(lockUrl, observed.text, JSON.stringify(refreshed, null, 1));
      return refreshed;
    }
    if (fresh) throw new Error("REFUSED: exclusive writer lock held by " + (prev?.writerId || "an initializing writer") + " (heartbeat " + (prev?.heartbeat || new Date(observed.mtimeMs).toISOString()) + ") — a second writer may not run");
    // Stale valid or unreadable claim: replace only the exact bytes inspected.
    const claimId = randomUUID();
    const lock = { schema: "skaists.writer-lock/1", writerId, claimId, acquiredAt: now, heartbeat: now,
      previousWriter: prev ? { writerId: prev.writerId, heartbeat: prev.heartbeat, takenOverAt: now }
        : { writerId: "unreadable-claim", heartbeat: new Date(observed.mtimeMs).toISOString(), takenOverAt: now } };
    replaceClaimIfUnchanged(lockUrl, observed.text, JSON.stringify(lock, null, 1));
    OWNED_CLAIMS.set(claimKey(lockUrl, writerId), claimId);
    return lock;
  }
  const claimId = randomUUID();
  const lock = { schema: "skaists.writer-lock/1", writerId, claimId, acquiredAt: now, heartbeat: now, previousWriter: null };
  if (!exclusiveCreate(lockUrl, JSON.stringify(lock, null, 1))) {
    const winner = safeReadJson(lockUrl);
    throw new Error("REFUSED: exclusive writer lock held by " + (winner ? winner.writerId : "another writer") + " (heartbeat " + (winner ? winner.heartbeat : "unknown") + ") — a second writer may not run");
  }
  OWNED_CLAIMS.set(claimKey(lockUrl, writerId), claimId);
  return lock;
}

export function assertWriterLock(writerId, opts = {}) {
  if (!writerId) throw new Error("REFUSED: save without a writer identity — acquireWriterLock first");
  const lockUrl = new URL(opts.lockPath || DEFAULT_LOCK);
  if (!existsSync(lockUrl)) throw new Error("REFUSED: no writer lock exists — acquireWriterLock first");
  const lock = JSON.parse(readFileSync(lockUrl, "utf8"));
  if (lock.writerId !== writerId)
    throw new Error("REFUSED: exclusive writer lock held by " + lock.writerId + ", not " + writerId);
  if (!lock.claimId || OWNED_CLAIMS.get(claimKey(lockUrl, writerId)) !== lock.claimId)
    throw new Error("REFUSED: writer identity does not own this process claim — re-acquire");
  if (Date.now() - Date.parse(lock.heartbeat) >= LOCK_STALE_MS)
    throw new Error("REFUSED: writer lock heartbeat stale (since " + lock.heartbeat + ") — re-acquire");
  return true;
}

export function releaseWriterLock(writerId, opts = {}) {
  const lockUrl = new URL(opts.lockPath || DEFAULT_LOCK);
  if (!existsSync(lockUrl)) return true;
  const observed = readClaim(lockUrl);
  if (!observed?.parsed) throw new Error("REFUSED: cannot release an unreadable lock claim");
  const lock = observed.parsed;
  if (lock.writerId !== writerId)
    throw new Error("REFUSED: cannot release a lock held by " + lock.writerId);
  if (!lock.claimId || OWNED_CLAIMS.get(claimKey(lockUrl, writerId)) !== lock.claimId)
    throw new Error("REFUSED: cannot release a lock this process does not own");
  // Deterministic race hook for the adversarial test; production callers do
  // not supply it. The conditional removal must preserve a replacement claim.
  if (typeof opts.beforeConditionalRelease === "function") opts.beforeConditionalRelease();
  removeClaimIfUnchanged(lockUrl, observed.text);
  OWNED_CLAIMS.delete(claimKey(lockUrl, writerId));
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
  return typeof state === "string" && /^xml-(403|404)(-all)?$/.test(state.trim());
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
      "REJECT 'downloaded' via checkpointState: " + ark + " — downloads must pass checkpointDownload (authoritative binding request + sha256 enforced there)",
    );
  assertRecordOutcome(entry?.state);
  if (!isRecordOutcome(entry?.state))
    throw new Error(
      "REJECT unrecognized record outcome: " + JSON.stringify(entry?.state) + " — outcomes are the explicit site-denial class xml-NNN(-all) only ('downloaded' arrives via checkpointDownload)",
    );
  return saveEntry(ark, entry, opts);
}

async function authoritativeBinding(ark, opts) {
  const url = BINDING_URL_FOR(ark);
  const fetcher = opts.fetchBinding || globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("REJECT binding verification unavailable: no fetch implementation");
  const response = await fetcher(url, { method: "GET", redirect: "error" });
  if (!response || response.ok !== true || typeof response.text !== "function")
    throw new Error("REJECT authoritative binding request for " + ark + " (status " + (response?.status ?? "unknown") + ")");
  return { url, response: await response.text(), status: response.status };
}

// Save-side guard for a DOWNLOAD: bytes without identity never land. The
// guard itself fetches the canonical ark binding URL and compares that live
// response with the claimed apid; caller-supplied binding fields are discarded
// and cannot authenticate themselves (PR #296 review P1).
export function checkpointDownload(ark, entry, opts = {}) {
  if (entry?.state !== "downloaded") throw new Error("checkpointDownload requires state:'downloaded'");
  if (!entry.apid || !/^apid:TH-/.test(entry.apid))
    throw new Error("REJECT download without binding apid: " + ark);
  if (!/^[0-9a-f]{64}$/.test(entry.sha256 || ""))
    throw new Error("REJECT download without sha256: " + ark);
  return (async () => {
    const binding = await authoritativeBinding(ark, opts);
    if (normalizeApid(binding.response) !== normalizeApid(entry.apid))
      throw new Error("REJECT authoritative binding response does not normalize to the entry apid — the apid may belong to a different image: " + ark);
    const { binding: ignoredCallerBinding, ...safeEntry } = entry;
    void ignoredCallerBinding;
    return saveEntry(ark, { ...safeEntry, binding, bindingVerified: "ark-bound: guard-fetched das/v2 response matches this ark" }, opts);
  })();
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
