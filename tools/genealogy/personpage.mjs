// ── person pages: wiki-style biography generated from the staged object ────
//   node personpage.mjs [internal-id ...]   (no args → regenerate all staged)
// Pages land beside their objects in persons/<id>.html — archive artifacts,
// not estate surfaces. Every page links into the fractal (blood.html#p=<id>)
// and back to the profile doorway.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const LINEAGE = "assets/profile-archive/lineage";
const corpus = JSON.parse(readFileSync(join(LINEAGE, "remington-bloodline.json"), "utf8"));
const overlay = JSON.parse(readFileSync(join(LINEAGE, "attested-overlays.json"), "utf8"));

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function renderPage(o) {
  const p = o.identity;
  const rel = o.relationships;
  const parents = (rel.parents || []).map((x) =>
    `<li>${x.name ? esc(x.name) : esc(x.id)} — <span class="dim">${esc(x.evidence)}</span> ` +
    `<a href="../../../../surfaces/blood.html#p=${esc(x.id)}">fractal ↗</a></li>`).join("") || "<li class='dim'>(none recorded)</li>";
  const children = (rel.children || []).map((x) =>
    `<li>${x.name ? esc(x.name) : esc(x.id)} <a href="../../../../surfaces/blood.html#p=${esc(x.id)}">fractal ↗</a></li>`).join("") || "<li class='dim'>(none recorded)</li>";
  const spouses = (rel.spouses || []).map((x) =>
    `<li>${x.name ? esc(x.name) : esc(x.id)}${x.marriage ? ` — <span class="dim">${esc(x.marriage)}</span>` : ""}</li>`).join("") || "<li class='dim'>(none recorded)</li>";
  const recs = o.layers.records
    ? `<li>provider record: <a href="${esc(o.layers.records.recordUrl)}">FamilySearch ${esc(o.layers.records.provider)} ↗</a> <span class="dim">(retrieved ${esc(o.layers.records.retrieved)})</span></li>` : "";
  const trad = o.layers.tradition
    ? `<li>tradition: <a href="../${esc(o.layers.tradition.pack)}">evidence pack — cited claims</a></li>` : "";
  const meaning = (o.layers.meaning || []).map((m) =>
    `<li>meaning: <b>${esc(m.symbol)}</b> — ${esc(m.meaning)} <span class="dim">(${esc(m.attribution)})</span></li>`).join("");
  const testi = (o.layers.testimony || []).map((t) =>
    `<li>family testimony: ${esc(t.text)} <span class="dim">(${esc(t.author)} · ${esc(t.status)})</span></li>`).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="dark">
<title>${esc(p.name)} — the blood archive</title><style>
:root{--bg:#0d1410;--panel:#111a14;--well:#0a0f0b;--ink:#e2efdb;--dim:#8a9a8a;--faint:#5f6f61;--line:#243026;--gold:#FFD700;--cyan:#00E5FF;--violet:#c9a0ff}
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--ink);font:13px/1.75 'IBM Plex Mono',monospace;padding:26px 16px 80px}
main{max-width:760px;margin:0 auto}
.kicker{font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--faint)}
h1{font-size:clamp(24px,5vw,36px);margin:8px 0 4px;color:var(--gold);font-weight:600}
.years{color:var(--dim);font-size:13px}
.chips{margin:12px 0;display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:9.5px;padding:2px 9px;border-radius:99px;border:1px solid var(--line);color:var(--dim)}
.chip.era{color:var(--violet);border-color:var(--violet)}
section{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:14px 16px;margin-top:14px}
h2{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:8px}
ul{list-style:none;display:grid;gap:6px;font-size:12px}
a{color:var(--cyan)} .dim{color:var(--faint)}
.bnr{color:var(--cyan);font-size:11px;word-break:break-all}
footer{margin-top:22px;color:var(--faint);font-size:10px;text-align:center;line-height:1.9}
</style></head><body><main>
<div class="kicker">bnr blood archive · staged person object</div>
<h1>${esc(p.name)}</h1>
<div class="years">${esc(p.lifespan || "")}</div>
<div class="chips">
 <span class="chip era">era: ${esc(o.evidence?.era || o.evidence?.class || "?")}</span>
 <span class="chip">support: ${esc(o.evidence?.support || "unsourced-entry")}</span>
 <span class="chip">research: ${esc(o.research?.status)}</span>
 <span class="chip">publication: ${esc(o.publication?.status)}${o.publication?.reason ? " — " + esc(o.publication.reason) : ""}</span>
 ${o.onSpine ? '<span class="chip" style="color:var(--gold);border-color:var(--gold)">on the spine</span>' : ""}
 ${o.corrected ? '<span class="chip" style="color:var(--gold);border-color:var(--gold)">founder-corrected</span>' : ""}
</div>
${o.corrected ? `<section><h2>correction</h2><ul><li>${esc(o.corrected.note)} <span class="dim">(${esc(o.corrected.attested)})</span></li></ul></section>` : ""}
<section><h2>relationships — each connection inspected separately</h2>
 <ul>${parents}${children}${spouses}</ul></section>
<section><h2>layers — records, tradition, testimony, meaning; attribution distinguishes, never ranks</h2>
 <ul>${recs}${trad}${testi}${meaning || ""}</ul></section>
<section><h2>identity + address</h2>
 <ul><li>internal id: <b>${esc(o.internalId)}</b> <span class="dim">(provider ids are references, not identity)</span></li>
 ${o.refs.map((r) => `<li>ref: ${esc(r.provider)} ${esc(r.id)}</li>`).join("")}
 <li class="bnr">${esc(o.bnr)}</li></ul></section>
<p style="margin-top:14px"><a href="../../../../surfaces/blood.html#p=${esc(o.internalId)}">open in the fractal comb ↗</a> ·
<a href="../../../../surfaces/profile.html#blood-record">the profile doorway ↗</a></p>
<footer>generated from the staged object (${esc(o.generatedFrom)}) · ${esc(corpus.meta.retrieved ? "records retrieved " + corpus.meta.retrieved : "")}</footer>
</main></body></html>`;
}

const args = process.argv.slice(2);
const ids = args.length ? args : readdirSync(join(LINEAGE, "persons")).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
let n = 0;
for (const id of ids) {
  const objPath = join(LINEAGE, "persons", id + ".json");
  if (!existsSync(objPath)) { console.error("no staged object for " + id); continue; }
  writeFileSync(join(LINEAGE, "persons", id + ".html"), renderPage(JSON.parse(readFileSync(objPath, "utf8"))), "utf8");
  n++;
}
console.log(JSON.stringify({ pages: n, out: LINEAGE + "/persons/" }, null, 0));
