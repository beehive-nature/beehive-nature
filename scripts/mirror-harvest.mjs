// mirror-harvest.mjs — phase 1+2 of SPEC-MIRROR-COMMONS-1.
// Fetches every registered source, stages payloads OFF-REPO, appends to the manifest
// (append-only: a changed hash is a new entry beside the old, never a replacement),
// and requests a Wayback capture for every URL.
// Usage:  node scripts/mirror-harvest.mjs [--no-wayback]
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VAULT = "C:/Users/travi/beehive-mirror";           // off-repo staging vault
const MANIFEST = "docs/mirror/MANIFEST.json";

// class: "mirror" = US-gov public domain (payload staged) · "witness" = hash+pointer only
const REGISTER = [
  // — bSymposium's government-primary set —
  { cls:"mirror", tag:"eo14212-fr-html",   url:"https://www.govinfo.gov/content/pkg/FR-2025-02-19/html/2025-02871.htm" },
  { cls:"mirror", tag:"eo14212-fr-txt",    url:"https://www.federalregister.gov/documents/full_text/text/2025/02/19/2025-02871.txt" },
  { cls:"mirror", tag:"eo14212-whitehouse",url:"https://www.whitehouse.gov/presidential-actions/2025/02/establishing-the-presidents-make-america-healthy-again-commission/" },
  { cls:"mirror", tag:"maha-assessment-a", url:"https://www.whitehouse.gov/wp-content/uploads/2025/05/WH-The-MAHA-Report-Assessment.pdf" },
  { cls:"mirror", tag:"maha-assessment-b", url:"https://www.whitehouse.gov/wp-content/uploads/2025/05/MAHA-Report-The-White-House.pdf" },
  { cls:"mirror", tag:"strategy-usda",     url:"https://www.fns.usda.gov/newsroom/usda-0213.25" },
  { cls:"mirror", tag:"strategy-niehs",    url:"https://ptfcehs.niehs.nih.gov/featured-activities/make-our-children-healthy-again-strategy" },
  { cls:"mirror", tag:"red3-fda",          url:"https://www.fda.gov/industry/color-additives/fdc-red-no-3" },
  { cls:"mirror", tag:"red3-fr",           url:"https://www.govinfo.gov/content/pkg/FR-2025-01-16/html/2025-00830.htm" },
  { cls:"mirror", tag:"dye-announcement",  url:"https://www.fda.gov/news-events/press-announcements/hhs-fda-phase-out-petroleum-based-synthetic-dyes-nations-food-supply" },
  { cls:"mirror", tag:"dye-tracker",       url:"https://www.fda.gov/food/color-additives-information-consumers/tracking-food-industry-pledges-remove-petroleum-based-food-dyes" },
  { cls:"mirror", tag:"fda-hfp-2026",      url:"https://www.fda.gov/about-fda/human-foods-program/human-foods-program-2026-priority-deliverables" },
  { cls:"mirror", tag:"aragon-opinion",    url:"https://www.govinfo.gov/content/pkg/USCOURTS-dcd-1_26-cv-00861/pdf/USCOURTS-dcd-1_26-cv-00861-0.pdf" },
  { cls:"mirror", tag:"snap-waivers",      url:"https://www.fns.usda.gov/snap/waivers/foodrestriction" },
  { cls:"mirror", tag:"shutdown-plaw",     url:"https://www.govinfo.gov/content/pkg/PLAW-119publ37/html/PLAW-119publ37.htm" },
  // — bFood's requirement backbone —
  { cls:"mirror", tag:"dga-2025-2030",     url:"https://cdn.realfood.gov/DGA.pdf" },
  { cls:"mirror", tag:"eer-nasem-2023",    url:"https://www.ncbi.nlm.nih.gov/books/NBK591021/table/tab_5_16/?report=objectonly" },
  { cls:"mirror", tag:"ahrq-aa-discussion",url:"https://www.ncbi.nlm.nih.gov/books/NBK614612/" },
  { cls:"mirror", tag:"nasem-macros-pdf",  url:"https://www.nationalacademies.org/cdn/materials/9fb9fae1-63a0-4048-88ad-3f972639149a" },
  // — the cannabinoid receipt's backbone (foreign gov: FSANZ permits reproduction w/ attribution; mirrored) —
  { cls:"mirror", tag:"fsanz-hemp-stage2", url:"https://www.foodstandards.gov.au/sites/default/files/science-data/surveillance/SiteAssets/Pages/Survey-of-low-THC-hemp-seed-foods/Low-THC-Hemp-Stage-2-report.pdf" },
  // — witness-only: copyrighted reporting the record rests on —
  { cls:"witness", tag:"notus-citations",  url:"https://www.notus.org/health-science/make-america-healthy-again-report-citation-errors" },
  { cls:"witness", tag:"notus-updates",    url:"https://www.notus.org/health-science/maha-report-update-citations" },
  { cls:"witness", tag:"pbs-formatting",   url:"https://www.pbs.org/newshour/politics/watch-maha-report-with-non-existent-sources-had-formatting-issues-white-house-says" },
  { cls:"witness", tag:"baltsun-aragon",   url:"https://www.baltimoresun.com/2026/06/23/federal-judge-blocks-usdas-snap-restrictions-on-soda-candy-in-five-states" },
  { cls:"witness", tag:"mcgill-seed-oils", url:"https://www.mcgill.ca/oss/article/medical-critical-thinking-health-and-nutrition/unscientific-crusade-against-seed-oils" },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) beehive-mirror/1 (public-record preservation; contact via github.com/beehive-nature)";
const sha256 = b => createHash("sha256").update(b).digest("hex");
const today = new Date().toISOString().slice(0, 10);

async function fetchBytes(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(90000) });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, type: r.headers.get("content-type") || "", buf };
}

mkdirSync(VAULT, { recursive: true });
mkdirSync("docs/mirror", { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { spec: "SPEC-MIRROR-COMMONS-1", entries: [] };

const noWayback = process.argv.includes("--no-wayback");
let ok = 0, fail = 0, unchanged = 0;

for (const src of REGISTER) {
  try {
    const { status, type, buf } = await fetchBytes(src.url);
    if (status !== 200 || buf.length === 0) { console.log(`FAIL ${status}  ${src.tag}`); fail++; continue; }
    const hash = sha256(buf);
    const prior = manifest.entries.find(e => e.url === src.url && e.sha256 === hash);
    if (prior) { console.log(`SAME       ${src.tag}  ${hash.slice(0, 12)}`); unchanged++; }
    else {
      const ext = /pdf/.test(type) ? ".pdf" : /html/.test(type) ? ".html" : ".bin";
      const file = src.cls === "mirror" ? `${src.tag}.${today}.${hash.slice(0, 12)}${ext}` : null;
      if (file) writeFileSync(join(VAULT, file), buf);
      manifest.entries.push({ tag: src.tag, cls: src.cls, url: src.url, fetched: today,
        sha256: hash, bytes: buf.length, contentType: type.split(";")[0], staged: file, permanent: [] });
      console.log(`${src.cls === "mirror" ? "MIRROR" : "WITNESS"}  ${src.tag}  ${hash.slice(0, 12)}  ${buf.length}b`);
      ok++;
    }
  } catch (e) { console.log(`ERR        ${src.tag}  ${String(e.message || e).slice(0, 60)}`); fail++; }

  if (!noWayback) {
    try {
      const w = await fetch("https://web.archive.org/save/" + src.url,
        { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(75000) });
      const e = manifest.entries.filter(x => x.url === src.url).pop();
      if (e) e.wayback = { requested: today, confirmed: w.status === 200 };
      console.log(`   wayback ${w.status === 200 ? "confirmed" : "requested (" + w.status + ")"}`);
    } catch (e2) {
      const en = manifest.entries.filter(x => x.url === src.url).pop();
      if (en) en.wayback = { requested: today, confirmed: false };
      console.log(`   wayback request errored (recorded as requested, not confirmed)`);
    }
  }
}

/* One entry per line, each carrying its own PUBLIC-CONSTANT marker: the repo is public
   and its pre-commit secret scan (rightly) challenges any 48+-char hex without one on
   the same line. A sha256 of a public government document is the definitional public
   constant, and saying so beside every hash keeps the scanner's law and the manifest's
   greppability at once. */
const body = manifest.entries.map(e =>
  " " + JSON.stringify({ note: "PUBLIC-CONSTANT sha256 of a public document", ...e })
).join(",\n");
writeFileSync(MANIFEST,
  `{\n "spec": ${JSON.stringify(manifest.spec)},\n "entries": [\n${body}\n ]\n}\n`);
console.log(`\ndone: ${ok} new, ${unchanged} unchanged, ${fail} failed · manifest entries: ${manifest.entries.length}`);
