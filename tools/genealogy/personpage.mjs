// ── person pages: wiki-style biography generated from the staged object ────
//   node personpage.mjs [internal-id ...]   (no args → regenerate all staged)
// Pages land beside their objects in persons/<id>.html — archive artifacts,
// not estate surfaces. Every page keeps the visitor oriented: estate crumbs
// and the shared site menu (surfaces/tour.js) survive a direct load, a
// return-to-tree action reopens blood.html with this person selected, and
// relatives navigate between their own research pages (same tab — the
// external-nav law; only off-site links open a new tab).
//
// ONE MODEL (handoff 2026-10-03): family grouping, the grandparent resolver
// and the Wikipedia mapping are IMPORTED from surfaces/person-panel.mjs —
// the same functions blood.html mounts — never re-derived here. The staged
// object contributes only what the archive view cannot: research/publication
// status wording and the generatedFrom receipt.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildArchive } from "../../surfaces/person-panel-corpus.mjs";
import { grandparentBranches, wikipediaLink, familyGroups } from "../../surfaces/person-panel.mjs";

const LINEAGE = "assets/profile-archive/lineage";
const SURFACES = "../../../../surfaces"; // persons/<id>.html → site surfaces
const corpus = JSON.parse(readFileSync(join(LINEAGE, "remington-bloodline.json"), "utf8"));
const overlay = JSON.parse(readFileSync(join(LINEAGE, "attested-overlays.json"), "utf8"));
const packs = {};
for (const p of new Set(Object.values(corpus.meta.packs || {})))
  packs[p] = JSON.parse(readFileSync(join(LINEAGE, p), "utf8"));
const archive = buildArchive({ corpus, overlay, packs });
const ROOT_ID = corpus.root; // the founder root blood.html passes as founderRoot

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const EXT = ' target="_blank" rel="noopener noreferrer"'; // external-nav law, hand-written on every off-site link

/* relative → their own research page (same-origin keeps the current tab) */
function relLink (id) {
  const p = archive.getPerson(id);
  const name = p ? p.name : id;
  return `<a href="${esc(id)}.html">${esc(name)}</a>${p && p.lifespan ? ` <span class="dim">· ${esc(p.lifespan)}</span>` : ""}`;
}

/* the parent-to-child line a direct branch rides — the static mirror of the
 * panel's chainHtml: hop labels by recorded gender, per-hop evidence, no
 * elision (the 44+ generation exploration stays whole on the page) */
function branchChainHtml (rel, grandparentId, personId) {
  if (rel.kind === "self" || personId === grandparentId)
    return `<ul class="chain"><li>${relLink(personId)} <span class="dim">— the branch's own head</span></li></ul>`;
  const hops = (rel.blood && rel.blood.hopsFromRoot) || [];
  if (!hops.length) return `<ul><li class="dim">(no hop chain recorded)</li></ul>`;
  let h = `<ul class="chain"><li>${relLink(grandparentId)} <span class="dim">— the branch head</span></li>`;
  for (const hop of hops)
    h += `<li><span class="arrow">${hop.dir === "up" ? "↑" : hop.dir === "down" ? "↓" : "⚭"}</span> ${esc(hop.label)} — ${relLink(hop.to)} <span class="dim">${esc(hop.evidence)}</span></li>`;
  return h + "</ul>";
}

function grandparentHtml (id) {
  const branches = grandparentBranches(archive, ROOT_ID, id);
  if (!branches.length) return ""; // root without named grandparents: say nothing rather than invent
  const direct = branches.filter((b) => b.direct);
  let h = `<section><h2>which grandparent's branch?</h2>`;
  if (direct.length) {
    for (const b of direct) {
      const g = b.grandparent;
      const title = /^F/i.test(g.gender || "") ? "Grandma " : /^M/i.test(g.gender || "") ? "Grandpa " : "";
      h += `<p class="branch"><strong>Through ${esc(title)}${esc(g.name)}</strong></p>` +
        `<details><summary>the parent-to-child line from ${esc(g.name)} <span class="dim">(${b.relationship.blood ? b.relationship.blood.hopsFromRoot.length : 0} hops)</span></summary>` +
        branchChainHtml(b.relationship, g.id, id) + `</details>`;
    }
  } else {
    h += `<p>No direct ancestral path through the four grandparents is recorded for this person yet.</p>`;
  }
  h += `<details><summary>check all four grandparent branches</summary><ul>`;
  for (const b of branches)
    h += `<li>${esc(b.grandparent.name)} — ${b.direct ? "ancestor on this branch" : "no direct path recorded here"}</li>`;
  h += `</ul><p class="dim">This identifies the family-tree route, not an inherited DNA segment.</p></details></section>`;
  return h;
}

function familyHtml (view) {
  const groups = familyGroups(view, archive.getPerson);
  let h = `<section><h2>parents, marriages and children</h2><ul>`;
  h += (view.parents.length
    ? view.parents.map((par) => {
        const gp = archive.getPerson(par.id);
        const label = gp && /^F/i.test(gp.gender || "") ? "mother" : gp && /^M/i.test(gp.gender || "") ? "father" : "parent";
        return `<li><span class="tag">${label}</span> ${relLink(par.id)} <span class="dim">— ${esc(par.evidence)}</span></li>`;
      }).join("")
    : `<li class="dim">(no parents recorded inside the published archive)</li>`);
  if (view.ghostParents)
    h += `<li class="dim">${view.ghostParents} parent reference${view.ghostParents === 1 ? "" : "s"} wait beyond the published frontier — counted, never named</li>`;
  h += `</ul>`;
  for (const m of groups.marriages) {
    h += `<div class="marriage"><h3>marriage</h3><p>${esc(view.name)} &amp; ${relLink(m.spouse)}</p>` +
      `<div class="grp">children of this couple (${m.children.length})</div>` +
      (m.children.length
        ? `<ul>${m.children.map((c) => `<li><span class="tag">child</span> ${relLink(c)}</li>`).join("")}</ul>`
        : `<p class="dim">no children linked to both parents here yet</p>`) +
      `</div>`;
  }
  if (groups.otherChildren.length)
    h += `<div class="grp">${view.spouses.length ? "children not yet linked to a couple here" : "children"} (${groups.otherChildren.length})</div>` +
      `<ul>${groups.otherChildren.map((c) => `<li><span class="tag">child</span> ${relLink(c)}</li>`).join("")}</ul>`;
  if (!view.parents.length && !view.children.length && !view.spouses.length)
    h += `<p class="dim">no family links added yet.</p>`;
  h += `<p class="dim coverage">Children listed here may not be the complete family — this edition follows the founder's blood line; siblings, other marriages and descendants largely live beyond the published record (coverage, not contradiction).</p></section>`;
  return h;
}

function sourcesHtml (view, staged) {
  const L = view.layers;
  let h = `<section><h2>sources and research notes</h2>` +
    `<p class="dim">era ≠ support: “${esc(view.era || "—")}” dates the evidence; “${esc(view.support)}” assesses it — one never derives the other. Attribution distinguishes, never ranks.</p><ul>`;
  let any = false;
  if (L.records) {
    any = true;
    h += `<li>documentary record — FamilySearch ${esc(L.records.providerRef)}` +
      (L.records.retrieved ? ` <span class="dim">(retrieved ${esc(String(L.records.retrieved).slice(0, 10))})</span>` : "") +
      ` · <a href="${esc(L.records.recordUrl)}"${EXT}>open the provider record — opens a new tab</a></li>`;
  }
  if (view.corrected) {
    any = true;
    h += `<li>founder correction — ${esc(view.corrected.note)} <span class="dim">(${esc(view.corrected.attested)})</span></li>`;
  }
  if (view.overlay) {
    any = true;
    h += `<li>attested overlay — outside the provider walk; enters the record by evidence pack; class never rises above what its sources carry</li>`;
  }
  if (L.tradition && L.tradition.claims.length) {
    any = true;
    h += `<li>tradition — ${esc(L.tradition.attribution)}<ul>` +
      L.tradition.claims.map((c) =>
        `<li>${esc(c.claim)} <span class="dim">— ${esc(c.source)}</span>${c.url ? ` · <a href="${esc(c.url)}"${EXT}>source — opens a new tab</a>` : ""}</li>`).join("") +
      `</ul><span class="dim">citations connect the claim to its evidence; support is assessed per claim</span></li>`;
  }
  for (const t of (L.testimony || [])) {
    any = true;
    h += `<li>family testimony — ${esc(t.text)} <span class="dim">(${esc(t.author)}${t.status ? " · " + esc(t.status) : ""})</span></li>`;
  }
  for (const s of (L.spiritual || [])) {
    any = true;
    h += `<li>spiritual reflection${s.text ? ` — ${esc(s.text)}` : ""} <span class="dim">(${esc(s.author)}${s.status ? " · " + esc(s.status) : ""})</span></li>`;
  }
  for (const m of (L.meaning || [])) {
    any = true;
    h += `<li>meaning — <b>${esc(m.symbol)}</b> — ${esc(m.meaning)} <span class="dim">(${esc(m.attribution)})</span></li>`;
  }
  if (!any && !view.living)
    h += `<li class="dim">only the walked record carries this person so far — no tradition, testimony or meaning layers recorded; absence is coverage, not a finding</li>`;
  if (view.living)
    h += `<li class="dim">living — redacted stub: no records, layers or provider references are published for living people</li>`;
  h += `</ul><ul>` +
    `<li>research status: <b>${esc(staged.research?.status || "—")}</b>${staged.research?.basis ? ` — ${esc(staged.research.basis)}` : ""}</li>` +
    `<li>publication: <b>${esc(staged.publication?.status || "—")}</b>${staged.publication?.reason ? ` — ${esc(staged.publication.reason)}` : ""}</li></ul></section>`;
  return h;
}

export function renderPage (o) {
  const view = archive.getPerson(o.internalId);
  if (!view) throw new Error("no archive view for " + o.internalId + " — regenerate against the corpus that staged it");
  const id = view.id;
  const wiki = wikipediaLink(view);
  const chips = [
    `<span class="chip era">era: ${esc(view.era || o.evidence?.era || "?")}</span>`,
    `<span class="chip">support: ${esc(view.support || o.evidence?.support || "unsourced-entry")}</span>`,
    `<span class="chip">research: ${esc(o.research?.status)}</span>`,
    `<span class="chip">publication: ${esc(o.publication?.status)}${o.publication?.reason ? " — " + esc(o.publication.reason) : ""}</span>`,
    view.onSpine ? `<span class="chip gold">on the spine</span>` : "",
    view.corrected ? `<span class="chip gold">founder-corrected</span>` : "",
  ].join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="dark">
<title>${esc(view.name)} — the blood archive</title><style>
:root{--bg:#0d1410;--panel:#111a14;--well:#0a0f0b;--ink:#e2efdb;--dim:#8a9a8a;--faint:#5f6f61;--line:#243026;--gold:#FFD700;--cyan:#00E5FF;--violet:#c9a0ff}
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--ink);font:13px/1.75 'IBM Plex Mono',monospace;padding:14px 16px 96px}
main{max-width:760px;margin:0 auto}
.crumbs{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 0 12px;font-size:11px;color:var(--dim)}
.crumbs a{color:var(--cyan);display:inline-flex;align-items:center;min-height:44px}
.crumbs .sep{color:var(--faint)} .crumbs .here{color:var(--ink)}
.back-tree{display:flex;align-items:center;min-height:48px;margin:0 0 12px;padding:0 18px;width:fit-content;border:1px solid var(--gold);border-radius:10px;color:var(--gold);font-size:12.5px;text-decoration:none;background:var(--well)}
.kicker{font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--faint)}
h1{font-size:clamp(24px,5vw,36px);margin:8px 0 4px;color:var(--gold);font-weight:600}
.years{color:var(--dim);font-size:13px}
.chips{margin:12px 0;display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:9.5px;padding:2px 9px;border-radius:99px;border:1px solid var(--line);color:var(--dim)}
.chip.era{color:var(--violet);border-color:var(--violet)} .chip.gold{color:var(--gold);border-color:var(--gold)}
section{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:14px 16px;margin-top:14px}
h2{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:8px}
h3{font-size:12px;color:var(--ink);margin:8px 0 4px}
ul{list-style:none;display:grid;gap:6px;font-size:12px}
a{color:var(--cyan)} .dim{color:var(--faint)}
li a{display:inline-flex;align-items:center;min-height:44px}
ul.chain li{padding-left:2px}
.chain .arrow{display:inline-block;width:1.4em;color:var(--gold)}
.branch{margin:6px 0}
.marriage{border:1px solid var(--line);border-radius:9px;padding:8px 12px;margin-top:10px;background:var(--well)}
.grp{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-top:10px}
.tag{display:inline-block;min-width:4.2em;color:var(--violet);font-size:10.5px}
details{margin:6px 0}
summary{cursor:pointer;color:var(--cyan);min-height:44px;display:inline-flex;align-items:center}
.wiki{margin-top:14px}
.wiki a{display:inline-flex;align-items:center;min-height:48px;padding:0 18px;border:1px solid var(--cyan);border-radius:10px;text-decoration:none;background:var(--well);font-size:12.5px}
.bnr{color:var(--cyan);font-size:11px;word-break:break-all}
.coverage{margin-top:10px;line-height:1.7}
footer{margin-top:22px;color:var(--faint);font-size:10px;text-align:center;line-height:1.9}
.doors{margin-top:14px;display:flex;flex-wrap:wrap;gap:10px}
.doors a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:1px solid var(--line);border-radius:10px;text-decoration:none;font-size:12px}
</style></head><body>
<nav class="crumbs" aria-label="you are here">
 <a href="${SURFACES}/index.html">beehive nature reserve</a><span class="sep">▸</span>
 <a href="${SURFACES}/profile.html#blood-record">dynasty profile</a><span class="sep">▸</span>
 <a href="${SURFACES}/blood.html">the blood comb</a><span class="sep">▸</span>
 <span class="here">${esc(view.name)}</span>
</nav>
<main>
<a class="back-tree" href="${SURFACES}/blood.html#p=${esc(id)}">← return to the family tree — ${esc(view.name)} stays selected</a>
<div class="kicker">bnr blood archive · full research page</div>
<h1>${esc(view.name)}</h1>
<div class="years">${esc(view.lifespan || "")}</div>
<div class="chips">${chips}</div>
${wiki ? `<p class="wiki"><a href="${esc(wiki.url)}"${EXT}>${esc(wiki.label)}</a></p>` : ""}
${grandparentHtml(id)}
${familyHtml(view)}
${sourcesHtml(view, o)}
<section><h2>identity + address</h2>
 <ul><li>internal id: <b>${esc(id)}</b> <span class="dim">(provider ids are references, not identity)</span></li>
 ${view.refs.map((r) => `<li>ref: ${esc(r.provider)} ${esc(r.id)}</li>`).join("")}
 <li class="bnr">${esc(view.bnr)}</li></ul></section>
<div class="doors"><a href="${SURFACES}/blood.html#p=${esc(id)}">open in the fractal comb</a>
<a href="${SURFACES}/austras-koks.html">the austras koks tree</a>
<a href="${SURFACES}/profile.html#blood-record">the profile doorway</a></div>
<footer>generated from the staged object (${esc(o.generatedFrom)})${corpus.meta.retrieved ? " · records retrieved " + esc(corpus.meta.retrieved) : ""} · the family model, grandparent resolver and Wikipedia mapping are the panel's own (surfaces/person-panel.mjs)</footer>
</main>
<script src="${SURFACES}/tour.js?v=42"></script>
</body></html>`;
}

/* CLI only — importing this module (the test battery) must not write pages */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
}
