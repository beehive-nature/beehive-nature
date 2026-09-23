// ── lines: join a private spouse line into the ONE model ────────────────────
// Pure (no file system); pipeline.mjs reads the private mapping and the walk
// files and calls joinLine(). The mapping lives on estate-local disk only:
//   { "lines": { "spouse-N": { "root": "<provider id>", "walks": ["<raw walk>", …],
//                              "rootLiving": { "gender": "FEMALE" },            // optional
//                              "links": { "<child id>": ["<parent id>", …] } } } }  // optional
// Laws:
//   · ADDITIVE — a person, edge set or couple the model already holds is never
//     overwritten, so the founder line stays byte-stable; a walk that disagrees
//     on a shared person is COUNTED (a FamilySearch sync signal), not applied.
//   · model.root is never touched: the founder stays the founder.
//   · a root absent from every walk (a living spouse walked from above) enters
//     only as an anonymous living person; `links` are founder-attested edges.
import { createModel } from "./model.mjs";

export const LINE_KEY_PRIVATE = /^spouse-[1-9]\d*$/;

// parts: already-imported walk models (fs-adapter importWalk into createModel())
export function joinLine(model, key, line, parts) {
  if (!LINE_KEY_PRIVATE.test(key) || !line?.root) throw new Error(`lines: refusing malformed line ${key}`);
  const founderRoot = model.root;
  const stats = { added: 0, shared: 0, disagreements: 0 };
  for (const part of parts) {
    for (const [id, p] of Object.entries(part.persons)) {
      const have = model.persons[id];
      if (!have) { model.persons[id] = p; stats.added++; continue; }
      stats.shared++;
      if (have.name !== p.name || have.lifespan !== p.lifespan || have.living !== p.living) stats.disagreements++;
    }
    for (const [c, ps] of Object.entries(part.edges)) if (!model.edges[c]) model.edges[c] = ps;
    for (const [k, c] of Object.entries(part.couples))
      if (!model.couples[k] && model.persons[c.p1] && model.persons[c.p2]) model.couples[k] = c;
  }
  if (!model.persons[line.root]) {
    if (!line.rootLiving) throw new Error(`lines: ${key} root is in no walk and not declared rootLiving — refusing`);
    model.persons[line.root] = { name: "Living", lifespan: null, gender: line.rootLiving.gender ?? null, living: true,
      evidence: { era: "living", support: "attested", class: "living", basis: "founder-attested private line root" } };
  }
  for (const [c, ps] of Object.entries(line.links || {})) model.edges[c] = [...new Set([...(model.edges[c] || []), ...ps])];
  model.root = founderRoot;
  model.roots = { founder: founderRoot, ...(model.roots || {}), [key]: line.root };
  return stats;
}

export const emptyPart = () => createModel({ root: null, source: "familysearch" });
