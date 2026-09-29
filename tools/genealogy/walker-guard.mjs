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
import { readFileSync, writeFileSync } from "node:fs";

// Default paths = the live private tier. CI/tests inject fixtures via opts.
const DEFAULT_QUEUE = "file:///C:/Users/travi/family-lineage/images-harvest/sweep-queue.json";
const DEFAULT_MANIFEST = "file:///C:/Users/travi/family-lineage/images-harvest/images-manifest.json";

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
export function checkpointState(ark, entry, opts = {}) {
  const { memberArks, manifestUrl, manifest } = loadState(opts);
  if (!memberArks.has(ark))
    throw new Error("REJECT SAVE out-of-queue ark: " + ark + " — nothing may be recorded for it");
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
