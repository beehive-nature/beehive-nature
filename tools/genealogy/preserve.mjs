// ── preservation: versioned corpus-and-evidence snapshots ──────────────────
//   node preserve.mjs prepare  [outdir]   → snapshot bundle + manifest (status: prepared)
//   node preserve.mjs verify <dir-or-zip> <expected-manifest> → hash-check (retrieval-verified)
// Upload rides the estate's EXISTING adapters (Autonomi member-write lane,
// Arweave via the estate wallet adapter) — those carry keys and run where keys
// live. This tool NEVER uploads; it distinguishes prepared / uploaded (adapter
// receipt pasted into the manifest) / retrieval-verified.
// LAW: living-family/private material stays OUT of public permanent uploads —
// prepare() bundles the PUBLIC corpus + evidence + overlays + recon only.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LINEAGE = "assets/profile-archive/lineage";
const cmd = process.argv[2];

function sha256(buf) { return createHash("sha256").update(buf).digest("hex"); }

function bundleFiles() {
  // THE WHOLE PERMITTED EXPERIENCE: corpus + evidence + overlays +
  // reconstructions + the founder-created crest and its authored meaning +
  // the two surfaces that carry the interconnected experience. Public
  // artifacts only — living-family/private material never bundles.
  const files = [
    "remington-bloodline.json",
    "attested-overlays.json",
    "reconstructions.json",
    ...readdirSync(join(LINEAGE, "evidence")).map((f) => "evidence/" + f),
    "../../house-crest-von-zutphen-DESIGN.svg",
    "../../house-crest-von-zutphen.json",
    "../../../surfaces/profile.html",
    "../../../surfaces/blood.html",
  ];
  return files.filter((f) => existsSync(join(LINEAGE, f)));
}

if (cmd === "prepare") {
  const out = process.argv[3] || "preservation-snapshot";
  mkdirSync(out, { recursive: true });
  const manifest = {
    schema: "skaists.preservation/1",
    status: "prepared",
    preparedAt: new Date().toISOString(),
    upstream: "FamilySearch Family Tree (walked under the founder's session; attribution + retrieval date in corpus meta)",
    privacy: "public artifacts only — living-family/private material (raw walk, full GEDCOM) stays on estate-local disk and is never bundled",
    files: {},
  };
  for (const f of bundleFiles()) {
    const buf = readFileSync(join(LINEAGE, f));
    writeFileSync(join(out, f.replace(/\//g, "__")), buf);
    manifest.files[f] = { sha256: sha256(buf), bytes: buf.length };
  }
  manifest.totalBytes = Object.values(manifest.files).reduce((a, b) => a + b.bytes, 0);
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ status: "prepared", out, files: Object.keys(manifest.files).length, totalBytes: manifest.totalBytes,
    next: "upload via the estate's Autonomi member-write or Arweave adapter, then paste the adapter receipt into manifest.uploads and set status:'uploaded'" }, null, 2));
} else if (cmd === "verify") {
  const dir = process.argv[3], manifestPath = process.argv[4] || join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let ok = 0, bad = [];
  for (const [f, meta] of Object.entries(manifest.files)) {
    const p = join(dir, f.replace(/\//g, "__"));
    if (!existsSync(p)) { bad.push([f, "missing"]); continue; }
    const h = sha256(readFileSync(p));
    if (h === meta.sha256) ok++; else bad.push([f, "hash mismatch"]);
  }
  console.log(JSON.stringify({ status: bad.length ? "RETRIEVAL-FAILED" : "retrieval-verified", ok, bad, against: manifestPath }, null, 2));
  process.exit(bad.length ? 1 : 0);
} else {
  console.error("usage: node preserve.mjs prepare [outdir] | verify <dir> [manifest]");
  process.exit(1);
}
