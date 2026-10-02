// walker-guard.test.mjs — proves the queue-membership rejections are
// CODE-ENFORCED (founder order 2026-09-29d), including the actual stray ark
// from the 2026-09-29c incident. Synthetic fixtures only; CI-safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, utimesSync } from "node:fs";
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

const bindingOpts = (opts, response, status = 200) => ({
  ...opts,
  fetchBinding: async () => ({ ok: status >= 200 && status < 300, status, text: async () => response }),
  fetchImageXml: async () => ({ ok: false, status: 403, text: async () => "denied" }),
});

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
  assert.throws(() => checkpointState("33SQ-GBSF-9FTG", { state: "xml-403" }, opts), /REJECT out-of-queue/);
  assert.equal(readFileSync(manifestPath, "utf8"), before, "manifest must be untouched by the rejected save");
});

test("checkpointDownload REJECTS downloads without binding apid or sha256 (bytes without identity never land)", () => {
  const { opts } = fixtures();
  assert.throws(() => checkpointDownload("BBBB-2222", { state: "downloaded" }, opts), /binding apid/);
  assert.throws(() => checkpointDownload("BBBB-2222", { state: "downloaded", apid: "apid:TH-9-9-9-9-9" }, opts), /sha256/);
  assert.throws(() => checkpointDownload("BBBB-2222", { state: "xml-403" }, opts), /state:'downloaded'/);
});

test("checkpointDownload ACCEPTS only the guard's authoritative binding response and stamps it", async () => {
  const { opts } = fixtures();
  const ok = await checkpointDownload("CCCC-3333", {
    state: "downloaded", apid: "apid:TH-2-2-2-2-2", w: 100, h: 200, level: 11, maxLevel: 12,
    tiles: 4, edgeSkips: 0, bytes: 1234, sha256: "a".repeat(64), ts: "2026-09-29T00:00:00.000Z",
    // Caller evidence is deliberately wrong. The guard discards it and uses
    // its own request below, which returns the bare-apid wire shape.
    binding: { url: "https://neighbor.invalid", response: "TH-9-9-9-9-9" },
  }, bindingOpts(opts, "TH-2-2-2-2-2"));
  assert.equal(ok, true);
  const man = JSON.parse(readFileSync(new URL(opts.manifestPath), "utf8"));
  assert.equal(man.images["CCCC-3333"].state, "downloaded");
  assert.match(man.images["CCCC-3333"].guard, /queue-member verified/);
  assert.match(man.images["CCCC-3333"].bindingVerified, /ark-bound/);
});

// ── PR #296 review fixes (2026-10-02) ─────────────────────────────────────

test("P1 outcome allowlist: checkpointState REJECTS 'downloaded' and unrecognized states (no denylist bypass)", async () => {
  const { opts } = fixtures();
  assert.throws(() => checkpointState("BBBB-2222", { state: "downloaded", apid: "apid:TH-1-1-1-1-1", sha256: "0".repeat(64) }, opts),
    /'downloaded' via checkpointState/);
  for (const bad of ["xml-4o3", "xml-", "403", "denied", undefined, null, "xml-403-all-typo"]) {
    assert.throws(() => checkpointState("BBBB-2222", { state: bad }, opts), /REJECT/);
  }
  // the explicit site-denial class stays valid (one outcome per ark — finality)
  assert.equal(await checkpointState("BBBB-2222", { state: "xml-403", apid: "apid:TH-4-4-4-4-4" }, bindingOpts(opts, "TH-4-4-4-4-4")), true);
  assert.equal(await checkpointState("CCCC-3333", { state: "xml-403-all", apid: "apid:TH-5-5-5-5-5" }, bindingOpts(opts, "TH-5-5-5-5-5")), true);
});

test("P1 ark↔apid binding: guard fetches the canonical URL and rejects a neighbor response regardless of caller evidence", async () => {
  const { opts } = fixtures();
  const URL_FOR = (a) => "https://sg30p0.familysearch.org/service/records/storage/dascloud/das/v2/3:1:" + a + "/name?namespace=apid";
  let requested = "";
  const guarded = { ...opts, fetchBinding: async (url) => {
    requested = url;
    return { ok: true, status: 200, text: async () => "apid:TH-9-9-9-9-9" };
  } };
  await assert.rejects(checkpointDownload("BBBB-2222", {
    state: "downloaded", apid: "apid:TH-3-3-3-3-3", sha256: "b".repeat(64),
    binding: { url: URL_FOR("BBBB-2222"), response: "TH-3-3-3-3-3" },
  }, guarded), /authoritative binding response does not normalize/);
  assert.equal(requested, URL_FOR("BBBB-2222"));
  await assert.rejects(checkpointDownload("BBBB-2222", {
    state: "downloaded", apid: "apid:TH-3-3-3-3-3", sha256: "b".repeat(64),
  }, bindingOpts(opts, "denied", 503)), /authoritative binding request/);
  await assert.rejects(checkpointState("BBBB-2222", {
    state: "xml-403", apid: "apid:TH-3-3-3-3-3", binding: { response: "TH-3-3-3-3-3" },
  }, guarded), /negative outcome apid/);
});

test("P1 terminal denial is fetched by the guard from the bound APID and must match the claimed status", async () => {
  const { opts } = fixtures();
  const calls = [];
  const guarded = {
    ...bindingOpts(opts, "TH-3-3-3-3-3"),
    fetchImageXml: async (url) => { calls.push(url); return { status: 200, ok: true, text: async () => "xml" }; },
  };
  await assert.rejects(checkpointState("BBBB-2222", {
    state: "xml-403", apid: "apid:TH-3-3-3-3-3", denial: { status: 403 },
  }, guarded), /live image\.xml status/);
  assert.deepEqual(calls, ["https://sg30p0.familysearch.org/service/records/storage/deepzoomcloud/dz/v1/apid:TH-3-3-3-3-3/image.xml"]);
});

test("P2 atomic manifest replace: saves leave no temp residue and the manifest always parses", async () => {
  const { opts, manifestPath } = fixtures();
  await checkpointState("BBBB-2222", { state: "xml-404", apid: "apid:TH-4-4-4-4-4", ts: new Date().toISOString() }, {
    ...bindingOpts(opts, "TH-4-4-4-4-4"), fetchImageXml: async () => ({ status: 404, ok: false, text: async () => "missing" }),
  });
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

test("P2 heartbeat refresh keeps the canonical lock visible and serializes contenders", async () => {
  const { opts } = fixtures();
  const lockPath = opts.manifestPath.replace("images-manifest.json", ".writer-lock-refresh.json");
  acquireWriterLock("refresh-A", { ...opts, lockPath });
  let inspected = false;
  const refreshed = acquireWriterLock("refresh-A", {
    ...opts,
    lockPath,
    beforeLockReplace: (lockUrl) => {
      inspected = true;
      assert.equal(new URL(lockUrl).protocol, "file:");
      assert.equal(JSON.parse(readFileSync(lockUrl, "utf8")).writerId, "refresh-A", "canonical lock remains present during refresh");
      assert.throws(() => acquireWriterLock("refresh-B", { ...opts, lockPath }), /lock mutation already in progress/);
    },
  });
  assert.equal(inspected, true);
  assert.equal(refreshed.writerId, "refresh-A");
});

test("P2 abandoned mutation claims refuse while fresh and recover after the stale interval", () => {
  const { opts } = fixtures();
  const lockPath = opts.manifestPath.replace("images-manifest.json", ".writer-lock-mutation-recovery.json");
  const mutationUrl = new URL(lockPath + ".mutation");
  writeFileSync(mutationUrl, JSON.stringify({ schema: "skaists.writer-lock-mutation/1", writerId: "crashed", claimedAt: new Date().toISOString() }));
  assert.throws(() => acquireWriterLock("recovery-A", { ...opts, lockPath }), /mutation already in progress/);
  writeFileSync(mutationUrl, JSON.stringify({
    schema: "skaists.writer-lock-mutation/1", writerId: "crashed", claimedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
  }));
  const recovered = acquireWriterLock("recovery-A", { ...opts, lockPath });
  assert.equal(recovered.writerId, "recovery-A");
  assert.equal(readFileSync(new URL(lockPath), "utf8").includes("recovery-A"), true);
});

test("P1 conditional takeover: a takeover cannot steal a FRESH claim, and takeovers leave no quarantine residue", async () => {
  const { opts, manifestPath } = fixtures();
  const { readdirSync } = await import("node:fs");
  const dir = manifestPath.replace(/[/\\][^/\\]+$/, "");
  const lockPath = opts.manifestPath.replace("images-manifest.json", ".writer-lock3.json");
  const lockUrl = new URL(lockPath);
  // a stale lock ages out; race-A takes it over (fresh claim now on disk)
  acquireWriterLock("race-A", { ...opts, lockPath });
  const aged = JSON.parse(readFileSync(lockUrl, "utf8"));
  aged.heartbeat = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  writeFileSync(lockUrl, JSON.stringify(aged));
  const B1 = acquireWriterLock("late-B", { ...opts, lockPath });
  assert.equal(B1.previousWriter.writerId, "race-A");
  // a contender who ALSO judged the old stale lock now arrives: it must read
  // the FRESH B1 lock and refuse BEFORE touching anything — B1's lock intact
  const before = readFileSync(lockUrl, "utf8");
  assert.throws(() => acquireWriterLock("late-C", { ...opts, lockPath }), /REFUSED: exclusive writer lock held by late-B/);
  assert.equal(readFileSync(lockUrl, "utf8"), before, "a refused contender must leave the holder's lock byte-unchanged");
  assert.deepEqual(readdirSync(dir).filter((f) => f.includes(".claim-") || f.includes(".tmp-")), [], "no quarantine/temp residue from takeover or refusal");
});

test("P2 outcomes are final: an already-resolved ark is never overwritten by a later save (review fix)", async () => {
  const { opts, manifestPath } = fixtures();
  await checkpointDownload("CCCC-3333", {
    state: "downloaded", apid: "apid:TH-7-7-7-7-7", sha256: "c".repeat(64), bytes: 99,
  }, bindingOpts(opts, "TH-7-7-7-7-7"));
  const before = readFileSync(manifestPath, "utf8");
  // a late negative for the same ark must not erase the download's identity
  assert.throws(() => checkpointState("CCCC-3333", { state: "xml-403" }, opts), /REJECT already-resolved/);
  // a late duplicate download must not overwrite either
  assert.throws(() => checkpointDownload("CCCC-3333", {
    state: "downloaded", apid: "apid:TH-8-8-8-8-8", sha256: "d".repeat(64),
  }, bindingOpts(opts, "TH-8-8-8-8-8")), /REJECT already-resolved/);
  assert.equal(readFileSync(manifestPath, "utf8"), before, "manifest must be untouched by rejected overwrites");
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

test("transient XML responses never become terminal outcomes", () => {
  const { opts } = fixtures();
  for (const transient of ["xml-429", "xml-500", "xml-502", "xml-503", "xml-429-all"]) {
    assert.throws(() => checkpointState("CCCC-3333", { state: transient }, opts), /REJECT unrecognized record outcome/);
  }
});

test("unreadable lock claims refuse while fresh and recover after the stale interval", () => {
  const { opts } = fixtures();
  const lockPath = opts.manifestPath.replace("images-manifest.json", ".writer-lock-unreadable.json");
  const lockUrl = new URL(lockPath);
  writeFileSync(lockUrl, "{partial");
  assert.throws(() => acquireWriterLock("recovery-writer", { ...opts, lockPath }), /initializing writer/);
  const old = new Date(Date.now() - 11 * 60 * 1000);
  utimesSync(lockUrl, old, old);
  const recovered = acquireWriterLock("recovery-writer", { ...opts, lockPath });
  assert.equal(recovered.previousWriter.writerId, "unreadable-claim");
  assert.equal(JSON.parse(readFileSync(lockUrl, "utf8")).claimId, recovered.claimId);
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

test("lock: the holder may save; stale locks allow takeover with audit trail; release works", async () => {
  const { opts, manifestPath } = fixtures();
  const lockOpts = { ...opts, lockPath: opts.manifestPath.replace("images-manifest.json", ".writer-lock.json") };
  acquireWriterLock("writer-A/imgqueue-owner", lockOpts);
  // holder saves fine
  await checkpointState("BBBB-2222", { state: "xml-403", apid: "apid:TH-6-6-6-6-6", ts: new Date().toISOString() },
    bindingOpts({ ...lockOpts, writer: "writer-A/imgqueue-owner" }, "TH-6-6-6-6-6"));
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

test("conditional release preserves a contender's replacement claim", () => {
  const { opts } = fixtures();
  const lockPath = opts.manifestPath.replace("images-manifest.json", ".writer-lock-release-race.json");
  const lockUrl = new URL(lockPath);
  acquireWriterLock("release-A", { ...opts, lockPath });
  const contender = { schema: "skaists.writer-lock/1", writerId: "release-B", claimId: "fresh-B", acquiredAt: new Date().toISOString(), heartbeat: new Date().toISOString() };
  assert.throws(() => releaseWriterLock("release-A", {
    ...opts,
    lockPath,
    beforeConditionalRelease: () => writeFileSync(lockUrl, JSON.stringify(contender, null, 1)),
  }), /lock identity changed before conditional release/);
  assert.deepEqual(JSON.parse(readFileSync(lockUrl, "utf8")), contender, "release must restore and preserve the replacement claim");
});
