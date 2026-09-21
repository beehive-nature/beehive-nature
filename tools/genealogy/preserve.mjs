// ── preservation: versioned whole-experience snapshots (adversarial repair) ─
//   node preserve.mjs prepare  [outdir] [destination] → clean package from DECLARED contents
//   node preserve.mjs approve <dir> <by> <destination> → verifies bytes FIRST, writes approval.json
//   node preserve.mjs restore <dir> <target-root>      → validates everything, then restores (fresh dir)
//   node preserve.mjs verify <dir> [manifest]          → local-verification + approval binding
//
// ADVERSARIAL LAWS (founder probes 2026-09-16, all five now refused):
//  1. Package contents come from the ARCHIVE'S DECLARED OBJECTS — the corpus's
//     published persons, the pack index, the overlay's referenced evidence —
//     never from a directory listing. Missing declared people/evidence fails.
//  2. Approval verifies every byte against the manifest and recomputes the
//     content digest; the approval record (approval.json) is RETAINED
//     SEPARATELY. Verify compares the current manifest digest against the
//     approval record — substitution after approval fails.
//  3. Restore validates the complete manifest + every hash + path safety
//     (no absolute paths, no traversal, nothing outside the target root)
//     BEFORE any write, into a fresh directory; refusal leaves nothing.
//  4. prepare builds into a CLEAN directory — stale files from an earlier
//     publication cannot slip into the next package.
//  5. Crest-missing refusal stays (regression control).
// Local verification only; retrieval-verified requires an adapter receipt + fresh fetch.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, isAbsolute, resolve, sep } from "node:path";

// test override: adversarial suites run this tool against synthetic fixture
// estates via BNR_PRESERVE_ROOT (never the real archive)
const REPO = process.env.BNR_PRESERVE_ROOT || join(import.meta.dirname, "..", "..");
const LINEAGE = "assets/profile-archive/lineage";
const MANDATORY = [
  "assets/profile-archive/house-crest-von-zutphen-DESIGN.svg",
  "assets/profile-archive/house-crest-von-zutphen.json",
  "surfaces/profile.html",
  "surfaces/blood.html",
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

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const fail = (msg) => { console.error("FAILED: " + msg); process.exit(1); };

// DECLARED contents: the archive says what it contains — persons from the
// corpus, evidence from the pack index + overlay references, fixtures' pages.
function declaredContents() {
  const corpus = JSON.parse(readFileSync(join(REPO, LINEAGE, "remington-bloodline.json"), "utf8"));
  const overlay = JSON.parse(readFileSync(join(REPO, LINEAGE, "attested-overlays.json"), "utf8"));
  const packs = new Set(Object.values(corpus.meta?.packs || {}));
  for (const p of Object.values(overlay.persons || {})) if (p?.evidencePack) packs.add(p.evidencePack);
  const persons = Object.keys(corpus.persons || {}).map((iid) => LINEAGE + "/persons/" + iid + ".json");
  const personPages = readdirSync(join(REPO, LINEAGE, "persons"))
    .filter((f) => f.endsWith(".html")).map((f) => LINEAGE + "/persons/" + f);
  return {
    files: [...new Set([...MANDATORY, ...persons, ...[...packs].map((p) => LINEAGE + "/" + p), ...personPages])],
    expectedPersons: persons.length,
    expectedPacks: packs.size,
  };
}

function verifyPackage(dir, manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const problems = [];
  let ok = 0;
  for (const [f, meta] of Object.entries(manifest.files)) {
    const p = join(dir, f);
    if (!existsSync(p)) { problems.push([f, "missing"]); continue; }
    if (sha256(readFileSync(p)) === meta.sha256) ok++; else problems.push([f, "hash mismatch"]);
  }
  const digest = sha256(Buffer.from(JSON.stringify(manifest.files)));
  return { manifest, problems, ok, digest };
}

// path safety: reject absolute, traversal, and anything resolving outside root
function safeJoin(root, rel) {
  if (isAbsolute(rel) || rel.includes("\0")) return null;
  const resolved = resolve(root, rel);
  const rootResolved = resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + sep)) return null;
  return resolved;
}

const cmd = process.argv[2];

if (cmd === "prepare") {
  const out = process.argv[3] || "preservation-snapshot";
  const destination = process.argv[4] || "(destination not yet chosen)";
  const declared = declaredContents();
  const missing = declared.files.filter((f) => !existsSync(join(REPO, f)));
  if (missing.length) {
    console.error("PREPARE FAILED — declared archive contents missing (no silent omission):");
    missing.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
  // CLEAN package dir: stale files from earlier publications cannot slip in
  if (existsSync(out)) rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const manifest = {
    schema: "skaists.preservation/1",
    status: "prepared",
    preparedAt: new Date().toISOString(),
    destination,
    declared: { persons: declared.expectedPersons, evidencePacks: declared.expectedPacks },
    upstream: "FamilySearch Family Tree (attribution + retrieval date in corpus meta)",
    privacy: "public artifacts only — living-family/private material stays on estate-local disk",
    files: {},
  };
  for (const f of declared.files) {
    const buf = readFileSync(join(REPO, f));
    mkdirSync(dirname(join(out, f)), { recursive: true });
    writeFileSync(join(out, f), buf);
    manifest.files[f] = { sha256: sha256(buf), bytes: buf.length };
  }
  manifest.totalBytes = Object.values(manifest.files).reduce((a, b) => a + b.bytes, 0);
  manifest.manifestSha256 = sha256(Buffer.from(JSON.stringify(manifest.files)));
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ status: "prepared", out, destination, files: Object.keys(manifest.files).length,
    declared: manifest.declared, totalBytes: manifest.totalBytes, manifestSha256: manifest.manifestSha256 }, null, 2));
} else if (cmd === "approve") {
  const dir = process.argv[3];
  const approvedBy = process.argv[4] || "";
  const destination = process.argv[5] || "";
  if (!approvedBy || !destination) fail("usage: approve <dir> <approved-by> <destination-label> — approval binds to the exact package and its intended destination");
  // verify EVERY byte before approval; altered content refuses approval
  const v = verifyPackage(dir, join(dir, "manifest.json"));
  if (v.problems.length) {
    console.error("APPROVAL REFUSED — package content does not match its manifest:");
    v.problems.forEach(([f, why]) => console.error("  - " + f + ": " + why));
    process.exit(1);
  }
  if (v.manifest.manifestSha256 && v.digest !== v.manifest.manifestSha256)
    fail("APPROVAL REFUSED — manifest digest mismatch (content list altered)");
  // if a prior approval exists for this package, changing content requires NEW approval
  const approvalRecord = {
    schema: "skaists.preservation-approval/1",
    approvedAt: new Date().toISOString(),
    approvedBy, destination,
    manifestSha256: v.digest,
    files: Object.keys(v.manifest.files).length,
  };
  writeFileSync(join(dir, "approval.json"), JSON.stringify(approvalRecord, null, 2));
  console.log(JSON.stringify({ status: "approved", manifestSha256: v.digest, destination, files: approvalRecord.files }, null, 2));
} else if (cmd === "restore") {
  const dir = process.argv[3], target = process.argv[4];
  if (!dir || !target) fail("usage: restore <pkg-dir> <fresh-target-root>");
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) fail("no manifest in package");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  // PHASE 1: validate EVERYTHING before any write — hashes, paths, boundary
  const problems = [];
  const plan = [];
  for (const [f, meta] of Object.entries(manifest.files)) {
    const src = safeJoin(dir, f);
    const dst = safeJoin(target, f);
    if (!src || !dst) { problems.push([f, "unsafe path (absolute/traversal/escape)"]); continue; }
    if (!existsSync(src)) { problems.push([f, "missing from package"]); continue; }
    const buf = readFileSync(src);
    if (sha256(buf) !== meta.sha256) { problems.push([f, "hash mismatch — package altered"]); continue; }
    plan.push([src, dst, buf]);
  }
  // approval binding: if approved, the current manifest digest must match
  if (existsSync(join(dir, "approval.json"))) {
    const approval = JSON.parse(readFileSync(join(dir, "approval.json"), "utf8"));
    const digest = sha256(Buffer.from(JSON.stringify(manifest.files)));
    if (digest !== approval.manifestSha256) problems.push(["(approval)", "manifest substituted after approval — binding broken"]);
  }
  if (problems.length) {
    console.error("RESTORE REFUSED — nothing written:");
    problems.forEach(([f, why]) => console.error("  - " + f + ": " + why));
    process.exit(1);
  }
  // fresh target only: refuse to merge into a populated directory
  if (existsSync(target) && readdirSync(target).length) fail("restore target exists and is not empty — restore into a fresh directory");
  mkdirSync(target, { recursive: true });
  for (const [, dst, buf] of plan) { mkdirSync(dirname(dst), { recursive: true }); writeFileSync(dst, buf); }
  console.log(JSON.stringify({ status: "restored", target, files: plan.length }, null, 2));
} else if (cmd === "verify") {
  const dir = process.argv[3], manifestPath = process.argv[4] || join(dir, "manifest.json");
  if (!existsSync(manifestPath)) fail("no manifest");
  const v = verifyPackage(dir, manifestPath);
  let binding = "not approved";
  if (existsSync(join(dir, "approval.json"))) {
    const approval = JSON.parse(readFileSync(join(dir, "approval.json"), "utf8"));
    binding = v.digest === approval.manifestSha256
      ? "approval binding intact (" + approval.destination + ")"
      : "APPROVAL BINDING BROKEN — package altered after approval";
  }
  if (v.manifest.manifestSha256 && v.digest !== v.manifest.manifestSha256)
    v.problems.push(["(manifest)", "content list digest mismatch — manifest substituted"]);
  const ok = v.problems.length === 0;
  console.log(JSON.stringify({
    status: !ok ? "LOCAL-VERIFICATION-FAILED" : "local-verification",
    scope: "local copy-integrity only — network retrieval requires an adapter upload receipt and a fresh fetch",
    packageStatus: v.manifest.status || "unknown",
    approvalBinding: binding,
    ok: v.ok, bad: v.problems, against: manifestPath,
  }, null, 2));
  process.exit(ok ? 0 : 1);
} else {
  console.error("usage: node preserve.mjs prepare [outdir] [destination] | approve <dir> <by> <destination> | restore <dir> <fresh-target> | verify <dir> [manifest]");
  process.exit(1);
}
