// walker-guard.test.mjs — proves the queue-membership rejections are
// CODE-ENFORCED (founder order 2026-09-29d), including the actual stray ark
// from the 2026-09-29c incident. Synthetic fixtures only; CI-safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nextPending, assertQueueMember, checkpointState, checkpointDownload, assertRecordOutcome, recordWalkerFailure, recordObservation, acquireWriterLock, releaseWriterLock } from "./walker-guard.mjs";

function fixtures() {
  const dir = mkdtempSync(join(tmpdir(), "walker-guard-"));
  const queuePath = join(dir, "sweep-queue.json");
  const manifestPath = join(dir, "images-manifest.json");
  writeFileSync(queuePath, JSON.stringify({
    schema: "skaists.sweep-queue/1",
    queue: [
      { ark: "AAAA-1111", minDepth: 3, emphasis: "lowry-rockwood" },
      { ark: "BBBB-2222", minDepth: 4 },
      { ark: "CCCC-3333", minDepth: 4 },
    ],
  }));
  writeFileSync(manifestPath, JSON.stringify({ schema: "skaists.images-harvest/1", images: {
    "AAAA-1111": { state: "downloaded", apid: "apid:TH-1-1-1-1-1", sha256: "0".repeat(64) },
  } }));
  const lockPath = "file:///" + manifestPath.replace(/\\/g, "/").replace("images-manifest.json", ".writer-lock-test.json");
  acquireWriterLock("test-writer", { lockPath });
  return { opts: { queuePath: "file:///" + queuePath.replace(/\\/g, "/"), manifestPath: "file:///" + manifestPath.replace(/\\/g, "/"), writer: "test-writer", lockPath }, manifestPath };
}

test("nextPending yields only unresolved queue members, in queue order", () => {
  const { opts } = fixtures();
  const pending = nextPending(10, opts);
  assert.deepEqual(pending.map((p) => p.ark), ["BBBB-2222", "CCCC-3333"]);
  assert.equal(pending[0].emphasis, "");
});

test("assertQueueMember REJECTS the real stray ark from the 2026-09-29c incident (out-of-queue)", () => {
  const { opts } = fixtures();
  assert.throws(() => assertQueueMember("33SQ-GBSF-9FTG", opts), /REJECT out-of-queue/);
});

test("assertQueueMember REJECTS already-resolved and malformed arks", () => {
  const { opts } = fixtures();
  assert.throws(() => assertQueueMember("AAAA-1111", opts), /REJECT already-resolved/);
  assert.throws(() => assertQueueMember("not an ark", opts), /REJECT malformed/);
  assert.throws(() => assertQueueMember("", opts), /REJECT malformed/);
});

test("assertQueueMember ACCEPTS a pending queue member", () => {
  const { opts } = fixtures();
  assert.equal(assertQueueMember("BBBB-2222", opts), true);
});

test("checkpointState REJECTS saving an out-of-queue ark and leaves the manifest unchanged", () => {
  const { opts, manifestPath } = fixtures();
  const before = readFileSync(manifestPath, "utf8");
  assert.throws(() => checkpointState("33SQ-GBSF-9FTG", { state: "xml-403" }, opts), /REJECT SAVE out-of-queue/);
  assert.equal(readFileSync(manifestPath, "utf8"), before, "manifest must be untouched by the rejected save");
});

test("checkpointDownload REJECTS downloads without binding apid or sha256 (bytes without identity never land)", () => {
  const { opts } = fixtures();
  assert.throws(() => checkpointDownload("BBBB-2222", { state: "downloaded" }, opts), /binding apid/);
  assert.throws(() => checkpointDownload("BBBB-2222", { state: "downloaded", apid: "apid:TH-9-9-9-9-9" }, opts), /sha256/);
  assert.throws(() => checkpointDownload("BBBB-2222", { state: "xml-403" }, opts), /state:'downloaded'/);
});

test("checkpointDownload ACCEPTS a fully-identified download for a queue member and stamps the guard", () => {
  const { opts } = fixtures();
  const ok = checkpointDownload("CCCC-3333", {
    state: "downloaded", apid: "apid:TH-2-2-2-2-2", w: 100, h: 200, level: 11, maxLevel: 12,
    tiles: 4, edgeSkips: 0, bytes: 1234, sha256: "a".repeat(64), ts: "2026-09-29T00:00:00.000Z",
    binding: {
      url: "https://sg30p0.familysearch.org/service/records/storage/dascloud/das/v2/3:1:CCCC-3333/name?namespace=apid",
      response: "TH-2-2-2-2-2", // bare apid (the BARE-APID gotcha) — normalization must accept it
    },
  }, opts);
  assert.equal(ok, true);
  const man = JSON.parse(readFileSync(new URL(opts.manifestPath), "utf8"));
  assert.equal(man.images["CCCC-3333"].state, "downloaded");
  assert.match(man.images["CCCC-3333"].guard, /queue-member verified/);
  assert.match(man.images["CCCC-3333"].bindingVerified, /ark-bound/);
});

// ── PR #296 review fixes (2026-10-02) ─────────────────────────────────────

test("P1 outcome allowlist: checkpointState REJECTS 'downloaded' and unrecognized states (no denylist bypass)", () => {
  const { opts } = fixtures();
  assert.throws(() => checkpointState("BBBB-2222", { state: "downloaded", apid: "apid:TH-1-1-1-1-1", sha256: "0".repeat(64) }, opts),
    /'downloaded' via checkpointState/);
  for (const bad of ["xml-4o3", "xml-", "403", "denied", undefined, null, "xml-403-all-typo"]) {
    assert.throws(() => checkpointState("BBBB-2222", { state: bad }, opts), /REJECT/);
  }
  // the explicit site-denial class stays valid
  assert.equal(checkpointState("BBBB-2222", { state: "xml-403" }, opts), true);
  assert.equal(checkpointState("BBBB-2222", { state: "xml-403-all" }, opts), true);
});

test("P1 ark↔apid binding: checkpointDownload REJECTS missing/mismatched binding evidence (neighbor filmstrip apid never lands)", () => {
  const { opts } = fixtures();
  const URL_FOR = (a) => "https://sg30p0.familysearch.org/service/records/storage/dascloud/das/v2/3:1:" + a + "/name?namespace=apid";
  // missing evidence entirely
  assert.throws(() => checkpointDownload("BBBB-2222", { state: "downloaded", apid: "apid:TH-3-3-3-3-3", sha256: "b".repeat(64) }, opts),
    /without binding evidence/);
  // evidence URL for a DIFFERENT ark
  assert.throws(() => checkpointDownload("BBBB-2222", { state: "downloaded", apid: "apid:TH-3-3-3-3-3", sha256: "b".repeat(64),
    binding: { url: URL_FOR("CCCC-3333"), response: "TH-3-3-3-3-3" } }, opts), /binding evidence URL mismatch/);
  // response normalizes to a DIFFERENT apid (the neighbor-image case: bytes hash fine, identity does not)
  assert.throws(() => checkpointDownload("BBBB-2222", { state: "downloaded", apid: "apid:TH-3-3-3-3-3", sha256: "b".repeat(64),
    binding: { url: URL_FOR("BBBB-2222"), response: "apid:TH-9-9-9-9-9" } }, opts), /binding response does not normalize/);
});

test("P2 atomic manifest replace: saves leave no temp residue and the manifest always parses", async () => {
  const { opts, manifestPath } = fixtures();
  checkpointState("BBBB-2222", { state: "xml-404", ts: new Date().toISOString() }, opts);
  recordObservation("CCCC-3333", "no-tiles", "probe", opts);
  recordWalkerFailure("CCCC-3333", "probe failure", opts); // CCCC stays pending after the observation
  const dir = manifestPath.replace(/[/\\][^/\\]+$/, "");
  const { readdirSync } = await import("node:fs");
  const residue = readdirSync(dir).filter((f) => f.includes(".tmp-"));
  assert.deepEqual(residue, [], "no temp files may survive an atomic save");
  const man = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(man.images["BBBB-2222"].state, "xml-404");
});

test("P2 retry logs assert queue membership: the 2026-09-29c stray ark is rejected from observations and walker-failures too", () => {
  const { opts, manifestPath } = fixtures();
  const before = readFileSync(manifestPath, "utf8");
  assert.throws(() => recordObservation("33SQ-GBSF-9FTG", "no-tiles", "stray probe", opts), /REJECT out-of-queue/);
  assert.throws(() => recordWalkerFailure("33SQ-GBSF-9FTG", "stray probe", opts), /REJECT out-of-queue/);
  assert.equal(readFileSync(manifestPath, "utf8"), before, "manifest must be untouched by the rejected retry-log writes");
});

test("P1 atomic lock claims: fresh claims are exclusive; refresh keeps acquiredAt; a takeover race loser refuses", async () => {
  const { opts, manifestPath } = fixtures();
  const lockPath = opts.manifestPath.replace("images-manifest.json", ".writer-lock2.json");
  const lockUrl = new URL(lockPath);
  const { readdirSync } = await import("node:fs");
  // fresh claim creates the lock exclusively
  const A1 = acquireWriterLock("race-A", { ...opts, lockPath });
  assert.equal(A1.writerId, "race-A");
  // loser of the create race (lock fresh) refuses
  assert.throws(() => acquireWriterLock("race-B", { ...opts, lockPath }), /REFUSED: exclusive writer lock held by race-A/);
  // holder refresh keeps acquiredAt and bumps heartbeat
  await new Promise((r) => setTimeout(r, 15));
  const A2 = acquireWriterLock("race-A", { ...opts, lockPath });
  assert.equal(A2.acquiredAt, A1.acquiredAt);
  assert.notEqual(A2.heartbeat, A1.heartbeat);
  // refresh is atomic: no temp residue beside the lock
  const dir = manifestPath.replace(/[/\\][^/\\]+$/, "");
  assert.deepEqual(readdirSync(dir).filter((f) => f.includes(".tmp-")), []);
  // stale foreign → takeover with audit trail (exclusive re-claim)
  const aged = JSON.parse(readFileSync(lockUrl, "utf8"));
  aged.heartbeat = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  writeFileSync(lockUrl, JSON.stringify(aged));
  const B = acquireWriterLock("race-B", { ...opts, lockPath });
  assert.equal(B.previousWriter.writerId, "race-A");
});

test("walker failures are REJECTED as record outcomes and stay retryable (founder order 09-29h)", () => {
  const { opts, manifestPath } = fixtures();
  // the four execution errors from the 09-29g wake, as the class fixture
  for (const bad of ["eval-err", "stitch-err", "v3-err"]) {
    assert.throws(() => checkpointState("BBBB-2222", { state: bad }, opts), /REJECT walker-failure/);
  }
  // explicit site denials ARE record outcomes (09-29i keeps these)
  assert.equal(assertRecordOutcome("xml-403"), true);
  assert.equal(assertRecordOutcome("xml-404"), true);
  assert.equal(assertRecordOutcome("downloaded"), true);
  // binding-* / no-* / timeout moved to the retryable class by 09-29i (asserted in the 09-29i test below)
});

test("recordWalkerFailure logs to the retryable side log and the ark STAYS pending", async () => {
  const { opts, manifestPath } = fixtures();
  const before = readFileSync(manifestPath, "utf8");
  recordWalkerFailure("BBBB-2222", "template syntax slip", opts);
  const man = JSON.parse(readFileSync(new URL(opts.manifestPath), "utf8"));
  assert.equal(man.images["BBBB-2222"], undefined, "no outcome recorded in images");
  assert.equal(man.walkerFailures["BBBB-2222"].length, 1);
  assert.match(man.walkerFailures["BBBB-2222"][0].err, /template syntax slip/);
  // still pending: nextPending keeps handing it out
  const { nextPending: np } = await import("./walker-guard.mjs");
  assert.ok(np(10, opts).some((p) => p.ark === "BBBB-2222"));
});

test("retryable observations (missing traffic/tiles, binding failures) are REJECTED as outcomes (founder order 09-29i)", () => {
  const { opts } = fixtures();
  for (const obs of ["no-deepzoom-traffic", "no-tiles", "binding-403", "timeout"]) {
    assert.throws(() => checkpointState("CCCC-3333", { state: obs }, opts), /REJECT retryable-observation/);
  }
  // explicit site denials for the bound apid remain valid outcomes
  assert.equal(assertRecordOutcome("xml-403"), true);
  assert.equal(assertRecordOutcome("xml-404"), true);
});

test("recordObservation side-logs the absence-observation and the ark STAYS pending", async () => {
  const { opts } = fixtures();
  recordObservation("CCCC-3333", "no-deepzoom-traffic", "viewer rendered, zero deepzoom this session", opts);
  const man = JSON.parse(readFileSync(new URL(opts.manifestPath), "utf8"));
  assert.equal(man.images["CCCC-3333"], undefined, "no outcome recorded");
  assert.equal(man.retryableObservations["CCCC-3333"].length, 1);
  const { nextPending: np } = await import("./walker-guard.mjs");
  assert.ok(np(10, opts).some((p) => p.ark === "CCCC-3333"));
});

test("EXCLUSIVE WRITER LOCK: a second writer is REFUSED while the lock is fresh (founder order 09-30c)", () => {
  const { opts } = fixtures();
  const lockOpts = { ...opts, lockPath: opts.manifestPath.replace("images-manifest.json", ".writer-lock.json") };
  const A = acquireWriterLock("writer-A/imgqueue-owner", lockOpts);
  assert.match(A.writerId, /writer-A/);
  // second writer refused
  assert.throws(() => acquireWriterLock("writer-B/other-session", lockOpts), /REFUSED: exclusive writer lock held by writer-A/);
  // saves without a writer identity refused
  assert.throws(() => checkpointState("BBBB-2222", { state: "xml-403" }, { ...lockOpts, writer: undefined }), /REFUSED: save without a writer identity/);
  // saves from the NON-holder refused
  assert.throws(() => checkpointState("BBBB-2222", { state: "xml-403" }, { ...lockOpts, writer: "writer-B/other-session" }), /REFUSED: exclusive writer lock held by/);
});

test("lock: the holder may save; stale locks allow takeover with audit trail; release works", () => {
  const { opts, manifestPath } = fixtures();
  const lockOpts = { ...opts, lockPath: opts.manifestPath.replace("images-manifest.json", ".writer-lock.json") };
  acquireWriterLock("writer-A/imgqueue-owner", lockOpts);
  // holder saves fine
  checkpointState("BBBB-2222", { state: "xml-403", ts: new Date().toISOString() }, { ...lockOpts, writer: "writer-A/imgqueue-owner" });
  // age the heartbeat → takeover by B allowed, previousWriter recorded
  const lockUrl = new URL(lockOpts.lockPath);
  const aged = JSON.parse(readFileSync(lockUrl, "utf8"));
  aged.heartbeat = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  writeFileSync(lockUrl, JSON.stringify(aged));
  const B = acquireWriterLock("writer-B/other-session", lockOpts);
  assert.equal(B.previousWriter.writerId, "writer-A/imgqueue-owner");
  // A is now refused (B holds it)
  assert.throws(() => checkpointState("CCCC-3333", { state: "xml-403" }, { ...lockOpts, writer: "writer-A/imgqueue-owner" }), /held by writer-B/);
  releaseWriterLock("writer-B/other-session", lockOpts);
  // released → no lock → saves refused again (must re-acquire)
  assert.throws(() => checkpointState("CCCC-3333", { state: "xml-403" }, { ...lockOpts, writer: "writer-B/other-session" }), /no writer lock exists/);
});
