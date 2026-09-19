// gux01-curiosity-analyze.mjs — the human A-gate verdict from a curiosity
// receipt. Usage: node tools/genealogy/gux01-curiosity-analyze.mjs <receipt.json>
// The receipt carries navigation events ONLY (no typed queries, no browsing
// content). The behavioral A gate, per the founder's own criterion:
//   cold open → no coaching → first discovery click → second distinct-person
// click, voluntarily.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = process.argv[2];
if (!path) {
  console.error("usage: node tools/genealogy/gux01-curiosity-analyze.mjs <gux01-curiosity-receipt.json>");
  process.exit(2);
}
const receipt = JSON.parse(readFileSync(path, "utf8"));
const ev = receipt.events || [];
const fmt = (e) => "  " + (e.t / 1000).toFixed(1) + "s  " + e.type + (e.kind ? " (" + e.kind + ")" : "") + (e.name ? " — " + e.name : "") + (e.results != null ? " — " + e.results + " results" : "");

console.log("GUX-01 CURIOSITY RECEIPT — " + (receipt.startedAt || "?") + " · " + ev.length + " navigation events");
for (const e of ev) console.log(fmt(e));

const cold = ev.find((e) => e.type === "cold");
const card = ev.find((e) => e.type === "card");
const personOpens = ev.filter((e) => e.type === "person-open" || e.type === "panel-nav");
const verdict = (line) => console.log("\nVERDICT: " + line);

if (!cold) verdict("no cold event recorded — was ?study=1 on when the page opened?");
if (!card) verdict("no discovery card clicked — the A gate is NOT met by this session.");
const after = card ? ev.filter((e) => (e.type === "person-open" || e.type === "panel-nav") && e.t >= card.t) : [];
const first = after[0];
const second = after.find((e) => first && e.iid && e.iid !== first.iid);
if (card && first && second) {
  verdict("A-GATE BEHAVIOR MET — first discovery click (" + (card.kind || "?") + " at " + (card.t / 1000).toFixed(1) +
    "s), then " + first.name + ", then a SECOND DISTINCT person (" + second.name + ") at " + (second.t / 1000).toFixed(1) +
    "s. The second click was voluntary under a no-coaching protocol.");
} else if (card && first) {
  verdict("first discovery click and one person opened — the second distinct-person click did not occur in this session.");
} else {
  verdict("insufficient navigation for the behavioral gate.");
}
