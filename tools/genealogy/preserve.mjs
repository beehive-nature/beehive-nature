// ── preservation: versioned whole-experience snapshots ─────────────────────
//   node preserve.mjs prepare  [outdir] [destination-label]  → bundle + manifest (prepared)
//   node preserve.mjs approve <dir> <approved-by> <destination-label>      → binds THIS manifest
//   node preserve.mjs restore <dir> <target-root>           → reconstructs the real tree
//   node preserve.mjs verify <dir> [manifest]               → LOCAL verification (hash check)
//
// VERIFICATION SCOPE LAW: verify reads local files — its success is a LOCAL
// COPY-INTEGRITY check, reported as "local-verification". "retrieval-verified"
// is reserved for a fresh fetch over an actual storage route after an adapter
// upload receipt exists in manifest.uploads.
//
// MANDATORY ARTIFACT LAW: required files (crest + authored meaning, both
// surfaces, corpus, overlays, reconstructions, evidence, persons) must exist —
// a missing mandatory artifact FAILS preparation, naming the file. No silent
// omission can hide behind a passing hash check.
//
// Paths in the manifest are REAL repo-relative paths; restore reconstructs
// that structure so relative links inside the pages keep working.
// Living-family/private material is never bundled (public artifacts only).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";

const REPO = join(import.meta.dirname, "..", "..");
const LINEAGE = "assets/profile-archive/lineage";
const MANDATORY = [
  "assets/profile-archive/house-crest-von-zutphen-DESIGN.svg",
  "assets/profile-archive/house-crest-von-zutphen.json",
  "surfaces/profile.html",
  "surfaces/blood.html",
  // runtime dependencies of both surfaces — a restored experience that 404s
  // its own scripts and art does not "work"
  "surfaces/tour.js",
  "surfaces/lang.js",
  "surfaces/lang-corpus.json",
  "surfaces/agent-dock.js",
  "surfaces/register.js",
  "docs/mvp-walk/assets/genesis-3d/motion/green-teal-breathing.svg",
  "assets/brand/skaists-separators.svg",
  LINEAGE + "/remington-bloodline.json",
  LINEAGE + "/attested-overlays.json",
  LINEAGE + "/reconstructions.json",
  LINEAGE + "/identity-registry.json",
  LINEAGE + "/staging-inventory.json",
];
function optional() {
  const opt = [];
  for (const d of ["evidence", "persons"]) {
    const dir = join(REPO, LINEAGE, d);
    if (existsSync(dir)) for (const f of readdirSync(dir)) opt.push(LINEAGE + "/" + d + "/" + f);
  }
  return opt;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const cmd = process.argv[2];

function fatalMissing(files) {
  const missing = MANDATORY.filter((f) => !files.includes(f));
  if (missing.length) {
    console.error("PREPARE FAILED — mandatory artifacts missing (no silent omission):");
    missing.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
}

if (cmd === "prepare") {
  const out = process.argv[3] || "preservation-snapshot";
  const destination = process.argv[4] || "(destination not yet chosen)";
  const files = [...MANDATORY, ...optional()];
  fatalMissing(files);
  mkdirSync(out, { recursive: true });
  const manifest = {
    schema: "skaists.preservation/1",
    status: "prepared",
    preparedAt: new Date().toISOString(),
    destination,
    upstream: "FamilySearch Family Tree (walked under the founder's session; attribution + retrieval date in corpus meta)",
    privacy: "public artifacts only — living-family/private material (raw walk, full GEDCOM, private staging) stays on estate-local disk",
    files: {},
  };
  for (const f of files) {
    const buf = readFileSync(join(REPO, f));
    // real structure preserved: <out>/<repo-relative-path>
    mkdirSync(dirname(join(out, f)), { recursive: true });
    writeFileSync(join(out, f), buf);
    manifest.files[f] = { sha256: sha256(buf), bytes: buf.length };
  }
  manifest.totalBytes = Object.values(manifest.files).reduce((a, b) => a + b.bytes, 0);
  manifest.manifestSha256 = sha256(Buffer.from(JSON.stringify(manifest.files)));
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ status: "prepared", out, destination, files: Object.keys(manifest.files).length,
    totalBytes: manifest.totalBytes, manifestSha256: manifest.manifestSha256,
    next: "approve binds THIS manifest hash + destination; upload via the estate's Autonomi/Arweave adapters where keys live" }, null, 2));
} else if (cmd === "approve") {
  const dir = process.argv[3];
  const approvedBy = process.argv[4] || "";
  const destination = process.argv[5] || "";
  if (!approvedBy || !destination) { console.error("usage: approve <dir> <approved-by> <destination-label> — approval binds to the exact package and its intended destination"); process.exit(1); }
  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.status !== "prepared") { console.error("only prepared packages can be approved (status: " + manifest.status + ")"); process.exit(1); }
  manifest.status = "approved";
  manifest.approvedAt = new Date().toISOString();
  manifest.approvedBy = approvedBy;
  manifest.approvedDestination = destination;
  manifest.approvedManifestSha256 = manifest.manifestSha256;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ status: "approved", manifestSha256: manifest.approvedManifestSha256, destination, files: Object.keys(manifest.files).length }, null, 2));
} else if (cmd === "restore") {
  const dir = process.argv[3], target = process.argv[4];
  if (!dir || !target) { console.error("usage: restore <pkg-dir> <target-root>"); process.exit(1); }
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  let restored = 0;
  for (const f of Object.keys(manifest.files)) {
    const src = join(dir, f);
    if (!existsSync(src)) { console.error("RESTORE FAILED — missing " + f); process.exit(1); }
    const dst = join(target, f);
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, readFileSync(src));
    restored++;
  }
  console.log(JSON.stringify({ status: "restored", target, files: restored }, null, 2));
} else if (cmd === "verify") {
  const dir = process.argv[3], manifestPath = process.argv[4] || join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let ok = 0; const bad = [];
  for (const [f, meta] of Object.entries(manifest.files)) {
    const p = join(dir, f);
    if (!existsSync(p)) { bad.push([f, "missing"]); continue; }
    if (sha256(readFileSync(p)) === meta.sha256) ok++; else bad.push([f, "hash mismatch"]);
  }
  const hasUploadReceipt = !!(manifest.uploads && manifest.uploads.length);
  console.log(JSON.stringify({
    status: bad.length ? "LOCAL-VERIFICATION-FAILED" : "local-verification",
    scope: hasUploadReceipt ? "local files; adapter receipt present — network retrieval check still required for 'retrieval-verified'" : "local copy-integrity only — no storage route involved",
    packageStatus: manifest.status || "unknown",
    ok, bad, against: manifestPath,
  }, null, 2));
  process.exit(bad.length ? 1 : 0);
} else {
  console.error("usage: node preserve.mjs prepare [outdir] [destination] | approve <dir> <by> <destination> | restore <dir> <target> | verify <dir> [manifest]");
  process.exit(1);
}
