// ── GEDCOM 5.5.1 interop — export AND import ────────────────────────────────
// Round-trips the model subset we carry: INDI (NAME /Surname/, SEX, BIRT/DEAT
// year, NOTE source id), FAM (HUSB, WIFE, CHIL, MARR). Living persons export
// as "Living" with no dates and no source note when privatize=true.

import { birthYear, deathYear, privatize, evidenceClass } from "./model.mjs";

const gedName = (name) => {
  const m = String(name).match(/^(.*) (\S+)$/);
  return m ? `${m[1]} /${m[2]}/` : `${name} //`;
};

export function toGedcom(model, { privatizeLiving = true } = {}) {
  const M = privatizeLiving ? privatize(model) : model;
  const ids = Object.keys(M.persons);
  const idx = new Map(ids.map((id, i) => [id, `I${i + 1}`]));
  const esc = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();

  const head = [
    "0 HEAD", "1 SOUR beehive-genealogy", "2 NAME Beehive Nature genealogy model",
    "2 VERS 1.0", "1 DEST ANY",
    `1 DATE ${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
    "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8",
    "1 SUBM @SUB1@", "0 @SUB1@ SUBM",
  ];

  // group children by parent-pair to build FAMs
  const famChildren = new Map();
  for (const [child, ps] of Object.entries(M.edges)) {
    if (!M.persons[child]) continue;
    const key = ps.filter((p) => M.persons[p]).slice().sort().join("|");
    if (!key) continue;
    if (!famChildren.has(key)) famChildren.set(key, []);
    famChildren.get(key).push(child);
  }
  const famRef = new Map([...famChildren.keys()].map((k, i) => [k, `F${i + 1}`]));
  const famOf = new Map(); // personId -> Set(famRef) as spouse
  const famcOf = new Map(); // personId -> famRef as child
  const famLines = [];
  for (const [key, chs] of famChildren) {
    const ref = famRef.get(key);
    const parents = key.split("|");
    famLines.push(`0 @${ref}@ FAM`);
    if (parents[0]) { famLines.push(`1 HUSB @${idx.get(parents[0])}@`); add(famOf, parents[0], ref); }
    if (parents[1]) { famLines.push(`1 WIFE @${idx.get(parents[1])}@`); add(famOf, parents[1], ref); }
    for (const ch of chs) { famLines.push(`1 CHIL @${idx.get(ch)}@`); famcOf.set(ch, ref); }
    const cpl = M.couples[key];
    if (cpl?.marriage) famLines.push("1 MARR", `2 DATE ${esc(cpl.marriage)}`);
  }
  function add(map, k, v) { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(v); }

  const indi = [];
  for (const id of ids) {
    const p = M.persons[id];
    indi.push(`0 @${idx.get(id)}@ INDI`, `1 NAME ${gedName(esc(p.name))}`);
    const b = birthYear(p.lifespan), d = deathYear(p.lifespan);
    if (b) indi.push("1 BIRT", `2 DATE ${b}`);
    if (d) indi.push("1 DEAT", `2 DATE ${d}`);
    if (p.gender) indi.push(`1 SEX ${p.gender === "M" ? "M" : p.gender === "F" ? "F" : "U"}`);
    if (famcOf.get(id)) indi.push(`1 FAMC @${famcOf.get(id)}@`);
    for (const ref of famOf.get(id) || []) indi.push(`1 FAMS @${ref}@`);
    if (p.sourceId) indi.push(`1 NOTE source ${p.source}:${p.sourceId}`);
    if (p.evidence && p.evidence.class) indi.push(`1 NOTE evidence ${p.evidence.class} (${p.evidence.basis})`);
  }
  return [...head, ...indi, ...famLines, "0 TRLR"].join("\n") + "\n";
}

// import: parse the subset back into model deltas.
// living heuristic: no DEAT and birth after 1916 → living (redact-eligible).
export function fromGedcom(model, text) {
  const lines = String(text).split(/\r?\n/).map((l) => {
    const m = l.match(/^(\d+)\s+(.*)$/);
    return m ? { level: parseInt(m[1], 10), text: m[2] } : null;
  }).filter(Boolean);
  const persons = {}; // xref -> person draft
  const fams = {}; // xref -> {husb, wife, chil:[]}
  let cur = null, curEvent = null;
  for (const line of lines) {
    const xref = line.text.match(/^@([^@]+)@\s+(INDI|FAM)$/);
    if (line.level === 0 && xref) {
      cur = { kind: xref[2], xref: xref[1], noteSources: [], evidence: null };
      (xref[2] === "INDI" ? persons : fams)[xref[1]] = cur;
      curEvent = null;
      continue;
    }
    if (!cur) continue;
    if (line.level === 1) {
      curEvent = /^BIRT|^DEAT|^MARR/.test(line.text) ? line.text.split(" ")[0] : null;
      const name = line.text.match(/^NAME\s+(.*)$/);
      if (name) cur.name = unGed(name[1]);
      const sex = line.text.match(/^SEX\s+([MFU])$/);
      if (sex) cur.sex = sex[1];
      const note = line.text.match(/^NOTE\s+(.*)$/);
      if (note) {
        const src = note[1].match(/^source\s+(\S+):(.+)$/);
        if (src) cur.noteSources.push({ source: src[1], sourceId: src[2] });
        const ev = note[1].match(/^evidence\s+(\S+)\s+\((.+)\)$/);
        if (ev) cur.evidence = { class: ev[1], basis: ev[2] };
      }
      const husb = line.text.match(/^HUSB\s+@([^@]+)@/);
      if (husb) cur.husb = husb[1];
      const wife = line.text.match(/^WIFE\s+@([^@]+)@/);
      if (wife) cur.wife = wife[1];
      const chil = line.text.match(/^CHIL\s+@([^@]+)@/);
      if (chil) (cur.chil = cur.chil || []).push(chil[1]);
    }
    if (line.level === 2) {
      // subordinate DATE under the last level-1 event (BIRT/DEAT/MARR)
      const date = line.text.match(/^DATE\s+(\d{3,4})$/);
      if (date && curEvent === "BIRT") cur.birt = parseInt(date[1], 10);
      if (date && curEvent === "DEAT") cur.deat = parseInt(date[1], 10);
      if (date && curEvent === "MARR") cur.marr = date[1];
    }
  }
  // fold into model
  const idOf = new Map();
  for (const [xref, p] of Object.entries(persons)) {
    if (!p.name) continue;
    const living = p.deat === undefined && p.birt !== undefined && p.birt > 1916;
    const id = p.noteSources[0]?.sourceId || `ged:${xref}`;
    idOf.set(xref, id);
    const lifespan = p.birt || p.deat
      ? `${p.birt ?? "?"}–${p.deat ?? (living ? "Living" : "Deceased")}` : null;
    model.persons[id] = {
      name: p.name,
      lifespan,
      gender: p.sex ?? null,
      living,
      ...(p.noteSources[0]?.source ? { source: p.noteSources[0].source } : {}),
      ...(p.noteSources[0]?.sourceId ? { sourceId: p.noteSources[0].sourceId } : {}),
      // parsed evidence wins; otherwise the era heuristic labels it honestly
      evidence: p.evidence
        ? { ...p.evidence }
        : { era: evidenceClass({ living, lifespan }), support: "unsourced-entry", class: evidenceClass({ living, lifespan }), basis: "era label from dates; support unsourced" },
    };
  }
  for (const f of Object.values(fams)) {
    const parents = [f.husb, f.wife].map((x) => idOf.get(x)).filter(Boolean);
    for (const chX of f.chil || []) {
      const ch = idOf.get(chX);
      if (ch && parents.length) {
        model.edges[ch] = [...new Set([...(model.edges[ch] || []), ...parents])].filter((p) => model.persons[p]);
      }
    }
  }
  return { persons: idOf.size };
}

function unGed(name) {
  const m = name.match(/^(.*)\/(.*)\/\s*$/);
  return m ? `${m[1].trim()} ${m[2].trim()}`.trim() : name.trim();
}
