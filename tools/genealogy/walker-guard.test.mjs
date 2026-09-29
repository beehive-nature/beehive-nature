// walker-guard.test.mjs — proves the queue-membership rejections are
// CODE-ENFORCED (founder order 2026-09-29d), including the actual stray ark
// from the 2026-09-29c incident. Synthetic fixtures only; CI-safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nextPending, assertQueueMember, checkpointState, checkpointDownload } from "./walker-guard.mjs";

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
  return { opts: { queuePath: "file:///" + queuePath.replace(/\\/g, "/"), manifestPath: "file:///" + manifestPath.replace(/\\/g, "/") }, manifestPath };
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
  }, opts);
  assert.equal(ok, true);
  const man = JSON.parse(readFileSync(new URL(opts.manifestPath), "utf8"));
  assert.equal(man.images["CCCC-3333"].state, "downloaded");
  assert.match(man.images["CCCC-3333"].guard, /queue-member verified/);
});
