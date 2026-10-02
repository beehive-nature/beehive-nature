// adversarial preservation tests — the founder's five probes, executable in CI
// against the exact preserve.mjs, using synthetic fixtures in a temp dir. No
// repository or production files are touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const TOOL = new URL("preserve.mjs", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const REPO = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1").replace(/\/$/, "");

function run(args, opts = {}) {
  try {
    const stdout = execFileSync("node", [TOOL, ...args], { encoding: "utf8", ...opts, env: { ...process.env, BNR_PRESERVE_ROOT: opts.cwd } });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout || ""), stderr: String(e.stderr || "") };
  }
}

// minimal synthetic estate: corpus declaring 2 persons + 1 pack, overlay,
// registry, inventory, crest, surfaces, runtime deps
function buildFixture() {
  const root = mkdtempSync(join(tmpdir(), "bnr-preserve-"));
  const dirs = [
    "assets/profile-archive/lineage/persons",
    "assets/profile-archive/lineage/evidence",
    "surfaces",
    "docs/mvp-walk/assets/genesis-3d/motion",
    "assets/brand",
  ];
  for (const d of dirs) mkdirSync(join(root, d), { recursive: true });
  const file = (p, content) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), content); };
  const persons = { pa1: { name: "A", living: false }, pa2: { name: "B", living: false } };
  const corpus = {
    persons,
    meta: { packs: { pa1: "evidence/pack-a.json" }, reconciliation: { rawPersons: 2, published: 2, excluded: {} } },
  };
  file("assets/profile-archive/lineage/remington-bloodline.json", JSON.stringify(corpus));
  file("assets/profile-archive/lineage/attested-overlays.json", JSON.stringify({ persons: {}, corrections: {}, relationshipEvidence: {}, testimony: [], symbolicLinks: [] }));
  file("assets/profile-archive/lineage/reconstructions.json", JSON.stringify({ current: {}, versions: [] }));
  file("assets/profile-archive/lineage/identity-registry.json", JSON.stringify({ schema: "skaists.identity-registry/1", issued: {}, aliases: {} }));
  file("assets/profile-archive/lineage/staging-inventory.json", JSON.stringify({ publicStaged: 2, privateStaged: 0, sumCheck: true }));
  // evidence layer (founder order 2026-10-02): the five declared sources files
  file("assets/profile-archive/lineage/sources/manifest.json", JSON.stringify({ schema: "skaists.sources-manifest/1" }));
  file("assets/profile-archive/lineage/sources/index.json", JSON.stringify({ schema: "skaists.sources/1", persons: {} }));
  file("assets/profile-archive/lineage/sources/records.json", JSON.stringify({
    schema: "skaists.sources-records/1", generated: "fixture", records: {
      rec1: { id: "rec1", title: "Public title", citation: "Public citation", redactedLiving: false,
        urls: ["https://example.test/ark"], event: { factType: "Census", place: "Somewhere" },
        evidence: [{ factType: "Name", fieldType: "Original", value: "PRIVATE TRANSCRIPTION" }],
        retrieved: "2026-10-02", provider: "fixture" },
    },
  }));
  file("assets/profile-archive/lineage/sources/images-summary.json", JSON.stringify({ schema: "skaists.images-summary/1", images: [] }));
  file("assets/profile-archive/lineage/sources/relationship-audit.json", JSON.stringify({ schema: "skaists.relationship-audit/1", edges: {} }));
  file("assets/profile-archive/lineage/persons/pa1.json", '{"internalId":"pa1"}');
  file("assets/profile-archive/lineage/persons/pa2.json", '{"internalId":"pa2"}');
  file("assets/profile-archive/lineage/evidence/pack-a.json", '{"schema":"skaists.evidence/1"}');
  file("assets/profile-archive/house-crest-von-zutphen-DESIGN.svg", "<svg>crest</svg>");
  file("assets/profile-archive/house-crest-von-zutphen.json", '{"schema":"skaists.house-profile/1"}');
  for (const s of ["profile.html", "blood.html", "tour.js", "lang.js", "lang-corpus.json", "agent-dock.js", "register.js"])
    file("surfaces/" + s, "<!--" + s + "-->");
  file("docs/mvp-walk/assets/genesis-3d/motion/green-teal-breathing.svg", "<svg>breathe</svg>");
  file("assets/brand/skaists-separators.svg", "<svg>sep</svg>");
  return root;
}

test("probe 0 (control): crest-missing refusal stays", () => {
  const root = buildFixture();
  rmSync(join(root, "assets/profile-archive/house-crest-von-zutphen-DESIGN.svg"));
  const r = run(["prepare", join(root, "pkg")], { cwd: root });
  assert.notEqual(r.code, 0, "prepare must fail without the crest");
  assert.match(r.stderr, /house-crest-von-zutphen-DESIGN\.svg/);
});

test("probe 1: missing declared persons/evidence refuses preparation", () => {
  const root = buildFixture();
  rmSync(join(root, "assets/profile-archive/lineage/persons/pa2.json"));
  let r = run(["prepare", join(root, "pkg")], { cwd: root });
  assert.notEqual(r.code, 0, "missing declared person must fail prepare");
  assert.match(r.stderr, /persons\/pa2\.json/);
  rmSync(join(root, "assets/profile-archive/lineage/evidence/pack-a.json"));
  r = run(["prepare", join(root, "pkg2")], { cwd: root });
  assert.notEqual(r.code, 0, "missing declared evidence pack must fail prepare");
  assert.match(r.stderr, /pack-a\.json/);
});

test("probe 2: approval refuses altered bytes", () => {
  const root = buildFixture();
  const pkg = join(root, "pkg");
  assert.equal(run(["prepare", pkg, "test destination"], { cwd: root }).code, 0);
  writeFileSync(join(pkg, "surfaces/blood.html"), "<!--tampered-->");
  const r = run(["approve", pkg, "tester", "test destination"], { cwd: root });
  assert.notEqual(r.code, 0, "approve must verify bytes first");
  assert.match(r.stderr, /blood\.html: hash mismatch/);
});

test("probe 3: manifest substitution after approval fails verification", () => {
  const root = buildFixture();
  const pkg = join(root, "pkg");
  assert.equal(run(["prepare", pkg, "test destination"], { cwd: root }).code, 0);
  assert.equal(run(["approve", pkg, "tester", "test destination"], { cwd: root }).code, 0);
  // substitute: change a file AND its manifest hash while keeping approval.json
  writeFileSync(join(pkg, "surfaces/blood.html"), "<!--substituted-->");
  const manifest = JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
  manifest.files["surfaces/blood.html"].sha256 = "0".repeat(64);
  writeFileSync(join(pkg, "manifest.json"), JSON.stringify(manifest, null, 2));
  const r = run(["verify", pkg], { cwd: root });
  assert.notEqual(r.code, 0, "verify must detect the broken approval binding");
  assert.match(r.stdout, /APPROVAL BINDING BROKEN/);
});

test("probe 4: restore refuses unverified (altered) packages — nothing written", () => {
  const root = buildFixture();
  const pkg = join(root, "pkg");
  assert.equal(run(["prepare", pkg, "test destination"], { cwd: root }).code, 0);
  writeFileSync(join(pkg, "assets/profile-archive/lineage/persons/pa1.json"), '{"tampered":true}');
  const target = join(root, "restored");
  const r = run(["restore", pkg, target], { cwd: root });
  assert.notEqual(r.code, 0, "restore must validate before writing");
  assert.match(r.stderr, /hash mismatch/);
  assert.ok(!existsSync(target), "refusal must leave no partial restoration");
});

test("probe 5: manifest path escape refuses restore — nothing written outside root", () => {
  const root = buildFixture();
  const pkg = join(root, "pkg");
  assert.equal(run(["prepare", pkg, "test destination"], { cwd: root }).code, 0);
  const manifest = JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
  const escapeRel = "../escaped.txt";
  manifest.files[escapeRel] = { sha256: createHash("sha256").update("x").digest("hex"), bytes: 1 };
  writeFileSync(join(pkg, "escaped-payload"), "x");
  writeFileSync(join(pkg, "manifest.json"), JSON.stringify(manifest, null, 2));
  // smuggle the payload to where the escaped path would read it from
  mkdirSync(join(pkg, "..", ".."), { recursive: true });
  writeFileSync(join(pkg, "..", "escaped.txt"), "x");
  const target = join(root, "restored");
  const r = run(["restore", pkg, target], { cwd: root });
  assert.notEqual(r.code, 0, "path escape must be refused before any write");
  assert.match(r.stderr, /unsafe path/);
  assert.ok(!existsSync(target), "no partial restoration");
});

test("prepare builds clean packages: stale files cannot slip in", () => {
  const root = buildFixture();
  const pkg = join(root, "pkg");
  mkdirSync(join(pkg, "assets/profile-archive/lineage/persons"), { recursive: true });
  writeFileSync(join(pkg, "assets/profile-archive/lineage/persons/STALE-from-old-publication.json"), "{}");
  assert.equal(run(["prepare", pkg, "test destination"], { cwd: root }).code, 0);
  const manifest = JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
  assert.ok(!manifest.files["assets/profile-archive/lineage/persons/STALE-from-old-publication.json"],
    "stale file from an earlier publication must not enter the new package");
  assert.ok(!existsSync(join(pkg, "assets/profile-archive/lineage/persons/STALE-from-old-publication.json")),
    "prepare cleaned the package directory");
});

test("EVIDENCE LAYER declared (founder order 2026-10-02): the five sources files are mandatory and missing ones fail prepare", () => {
  const root = buildFixture();
  // delete one declared evidence file → prepare must fail, no silent omission
  rmSync(join(root, "assets/profile-archive/lineage/sources/relationship-audit.json"));
  const r = run(["prepare", join(root, "pkg"), "test"], { cwd: root });
  assert.notEqual(r.code, 0, "prepare must fail when a declared evidence file is missing");
  assert.match(r.stderr, /relationship-audit/);
});

test("privacy-safe edition projects source records without raw transcription values", () => {
  const root = buildFixture();
  const pkg = join(root, "pkg");
  const r = run(["prepare", pkg, "test"], { cwd: root });
  assert.equal(r.code, 0, r.stderr);
  const projected = JSON.parse(readFileSync(join(pkg, "assets/profile-archive/lineage/sources/records.json"), "utf8"));
  assert.equal(projected.schema, "skaists.sources-records-public/1");
  assert.equal(projected.records.rec1.citation, "Public citation");
  assert.deepEqual(projected.records.rec1.evidence, [{ factType: "Name", fieldType: "Original" }]);
  assert.doesNotMatch(JSON.stringify(projected), /PRIVATE TRANSCRIPTION/);
  const original = readFileSync(join(root, "assets/profile-archive/lineage/sources/records.json"), "utf8");
  assert.match(original, /PRIVATE TRANSCRIPTION/, "prepare projects package bytes without mutating the research source");
});
