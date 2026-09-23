// ── publish: the ONE path from a raw model to its public corpus ─────────────
// Two decisions, kept apart on purpose:
//   SCOPE   — who the published house lines are (a publishing choice): every
//             declared root's bloodline, the spouses of those bloodlines, and
//             attested overlay persons. In-law deep ancestry stays private-side.
//   PRIVACY — what of them may be seen. Decided ONLY by model.privatize(): no
//             second privacy law lives here or in pipeline.mjs. Before
//             2026-09-22 the pipeline carried its own inline copy; it is gone.
// Pure: no file system, no provider knowledge. pipeline.mjs calls it; the
// synthetic tests (publish.test.mjs) call it directly.
import { createModel, bloodline, privatize, roots as lineRoots } from "./model.mjs";

// every root's bloodline (founder + any declared spouse line) ∪ spouses of
// those bloodlines ∪ the extra ids (attested overlay persons)
export function publicScope(model, extraIds = []) {
  const blood = new Set();
  for (const id of Object.values(lineRoots(model)))
    for (const x of bloodline({ ...model, root: id })) blood.add(x);
  const scope = new Set(blood);
  for (const c of Object.values(model.couples || {})) {
    if (blood.has(c.p1)) scope.add(c.p2);
    if (blood.has(c.p2)) scope.add(c.p1);
  }
  for (const id of extraIds) if (model.persons[id]) scope.add(id);
  return scope;
}

// scope the raw model, then privatize it. Raw person entries pass through
// untouched so privatize() sees exactly what the provider walk said.
export function publish(model, { extraIds = [] } = {}) {
  const scope = publicScope(model, extraIds);
  const scoped = createModel({ root: model.root, source: model.source });
  scoped.meta = model.meta;
  for (const [id, p] of Object.entries(model.persons)) if (scope.has(id)) scoped.persons[id] = p;
  // edges keep their dangling parent refs (the ghost frontier), as they always have
  for (const [c, ps] of Object.entries(model.edges)) if (scoped.persons[c]) scoped.edges[c] = ps;
  for (const [k, c] of Object.entries(model.couples))
    if (scoped.persons[c.p1] && scoped.persons[c.p2]) scoped.couples[k] = c;
  if (model.roots) {
    scoped.roots = {};
    for (const [k, id] of Object.entries(model.roots)) if (scoped.persons[id]) scoped.roots[k] = id;
  }
  return { pub: privatize(scoped), scope };
}
