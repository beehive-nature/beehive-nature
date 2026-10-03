// ── zGeneArchive · GUX-01 slice 1 tests ─────────────────────────────────────
// Two layers:
//  1. synthetic fixtures — the uncomfortable cases from the sprint order:
//     repeated ancestors, cycles, one-parent records, aliases, disputed
//     parentage (preview never overwrites), spouse-only ≠ blood, ghost
//     frontier vs "had no children", living-person leaks, name ambiguity.
//  2. corpus invariants at the pinned public projection — counts derived from
//     the ACTUAL corpus, the named acceptance persons, full ID resolution,
//     privacy gates. Skipped (named, never silent) when the corpus file is
//     absent so the suite stays runnable outside the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createModel, addPerson, addEdge, addCouple } from "./model.mjs";
import { loadArchive } from "./archive.mjs";
import { createArchiveCore, ARCHIVE_CORE_SCHEMA } from "../../surfaces/archive-core.mjs";

function build({ root = "r", persons = [], edges = {}, couples = [] }) {
  const m = createModel({ root });
  for (const p of persons) addPerson(m, p);
  for (const [child, ps] of Object.entries(edges)) addEdge(m, child, ps);
  for (const [a, b, mar] of couples) addCouple(m, a, b, mar);
  return m;
}
const P0 = { evidence: { era: "recorded", support: "unsourced-entry", basis: "fixture" } };
const per = (id, extra = {}) => ({ id, name: extra.name ?? id.toUpperCase(), lifespan: extra.lifespan ?? null, ...P0, ...extra });

// ── 1. synthetic: the uncomfortable cases ──────────────────────────────────

test("repeated ancestor stays one person, one identity (pedigree collapse)", () => {
  const m = build({
    persons: [per("r"), per("p1"), per("p2"), per("x", { name: "Shared Ancestor" })],
    edges: { r: ["p1", "p2"], p1: ["x"], p2: ["x"] },
  });
  const a = loadArchive({ model: m });
  const rel = a.relativesOf("r");
  // x appears on BOTH parent lines but is ONE grandparent entry
  assert.equal(rel.grandparents.length, 1, "collapsed to a single grandparent entry");
  assert.equal(rel.grandparents[0].id, "x");
  assert.equal(a.resolve("x").id, "x");
  assert.equal(a.resolve("Shared Ancestor").id, "x", "name resolves to the same single identity");
});

test("cycles: traversal terminates, component reported, not hidden", () => {
  const m = build({
    persons: [per("r"), per("a"), per("b"), per("c")],
    edges: { r: ["a"], a: ["b"], b: ["c"], c: ["a"] }, // a<-b<-c<-a
  });
  const a = loadArchive({ model: m });
  const inv = a.inventory();
  assert.equal(inv.counts.cyclicComponents, 1);
  assert.equal(inv.counts.cyclicPersonIds, 3);
  const rel = a.relativesOf("a");
  assert.ok(rel.cyclicAncestry, "cycle involvement is reported, not silenced");
  assert.deepEqual(rel.cyclicAncestry.component, ["a", "b", "c"]);
  // paths through the cycle still terminate and stay deterministic
  const p1 = a.relationshipPath("r", "c");
  const p2 = a.relationshipPath("r", "c");
  assert.equal(p1.kind, "blood");
  assert.deepEqual(p1, p2);
});

test("one-parent record is stated honestly — no invented second parent", () => {
  const m = build({ persons: [per("r"), per("m"), per("f")], edges: { m: ["f"] } });
  const a = loadArchive({ model: m });
  const rel = a.relativesOf("m");
  assert.equal(rel.parents.length, 1);
  assert.equal(rel.oneParentRecord, true);
  assert.equal(a.coverage("m").parentRecordState.state, "resolved");
  assert.equal(a.coverage("m").parentRecordState.resolved, 1);
});

test("ghost frontier: referenced-but-unfetched parent ≠ absence of family", () => {
  const m = build({
    persons: [per("r"), per("m"), per("f")],
    edges: { m: ["f", "GHOST-REF"] }, // second parent referenced, record not fetched
  });
  const a = loadArchive({ model: m });
  const rel = a.relativesOf("m");
  assert.equal(rel.parents.length, 1);
  assert.deepEqual(rel.ghostParents, [{ ref: "GHOST-REF", relation: "parent", status: "referenced-not-fetched" }]);
  const cov = a.coverage("m");
  assert.equal(cov.parentRecordState.state, "partially-resolved");
  assert.deepEqual(cov.ghostParentRefs, ["GHOST-REF"]);
  assert.equal(a.inventory().ghostFrontier.danglingReferences, 1);
});

test("missing branch is coverage, never 'had no children'", () => {
  const m = build({ persons: [per("r"), per("m")], edges: {} });
  const a = loadArchive({ model: m });
  const cov = a.coverage("m");
  assert.equal(cov.childCoverage, "none-published");
  assert.match(cov.childNote, /not “this person had no children”/);
  assert.match(cov.childNote, /private-side/);
});

test("registry alias redirects a changed provider ref to the canonical identity", () => {
  const m = build({
    persons: [per("p1", { name: "One Person", refs: [{ provider: "prov", id: "OLD-REF" }] })],
    edges: {},
  });
  m.root = "p1";
  const a = loadArchive({ model: m, registry: { schema: "skaists.identity-registry/1", issued: { "OLD-REF": "p1" }, aliases: { "NEW-REF": "OLD-REF" } } });
  assert.deepEqual(a.resolve("OLD-REF"), { id: "p1", person: m.persons.p1, matched: "provider-ref" });
  const viaAlias = a.resolve("NEW-REF");
  assert.equal(viaAlias.id, "p1", "alias lands on the SAME person");
  assert.equal(viaAlias.matched, "registry-alias");
  // identity count stays one — no replacement identities get minted
  assert.equal(a.inventory().identity.issued, 1);
  assert.equal(a.inventory().identity.aliases, 1);
});

test("disputed parentage: preview is read-only and never overwrites the choice", () => {
  const m = build({
    persons: [per("r"), per("ovl-x"), per("ovl-y")],
    edges: { r: ["ovl-x"], "ovl-x": ["ovl-y"] },
  });
  const recon = {
    schema: "skaists.reconstruction/1", law: "fixture law",
    current: { id: "v1", date: "2026-09-18", author: "fixture", choices: { "ovl-x|ovl-y": "sigurd-father" }, note: "chosen" },
    versions: [
      { id: "v1", date: "2026-09-18", author: "fixture", choices: { "ovl-x|ovl-y": "sigurd-father" }, note: "chosen" },
      { id: "v2", date: "2026-09-18", author: "fixture", choices: { "ovl-x|ovl-y": "sven-father" }, note: "competing" },
    ],
  };
  const a = loadArchive({ model: m, recon });
  const panel1 = a.personPanel("ovl-x");
  assert.equal(panel1.reconstruction.disputed, true);
  assert.equal(panel1.reconstruction.current.choices["ovl-x|ovl-y"], "sigurd-father");
  const preview = panel1.reconstruction.preview("v2");
  assert.equal(preview.choices["ovl-x|ovl-y"], "sven-father", "competing hypothesis readable side by side");
  assert.match(preview.note2, /PREVIEW ONLY/);
  assert.equal(panel1.reconstruction.preview("nope"), null);
  const panel2 = a.personPanel("ovl-x");
  assert.equal(panel2.reconstruction.current.choices["ovl-x|ovl-y"], "sigurd-father", "preview did not overwrite the chosen reconstruction");
});

test("spouse-only connection is affinity, never reported as blood", () => {
  const m = build({
    persons: [per("r"), per("h", { name: "Husband" }), per("w", { name: "Wife" })],
    edges: { h: [], w: [] },
    couples: [["h", "w", "1900"]],
  });
  const a = loadArchive({ model: m });
  const path = a.relationshipPath("h", "w");
  assert.equal(path.kind, "affinity");
  assert.ok(path.spouseSteps >= 1);
  assert.match(path.note, /NOT a blood relationship/);
  assert.equal(a.relativesOf("h").spouses[0].blood, false);
  assert.equal(a.relativesOf("h").spouses[0].marriage, "1900");
  assert.equal(a.relativesOf("h").spouses[0].affinity.includes("not a blood relationship"), true);
});

test("true blood path is preferred and names the common ancestor", () => {
  const m = build({
    persons: [per("g"), per("p1"), per("p2"), per("x", { name: "Shared" })],
    edges: { p1: ["x"], p2: ["x"] },
  });
  const a = loadArchive({ model: m });
  const path = a.relationshipPath("p1", "p2");
  assert.equal(path.kind, "blood");
  assert.equal(path.commonAncestor, "x");
  assert.match(path.note, /shared ancestor/);
});

test("co-parents of the same child are NOT blood relatives (the V-shape trap)", () => {
  // mother + father of child c: a path mother ↓ c ↑ father exists through
  // edges, but consanguinity requires a common ANCESTOR — partners are affinity
  const m = build({
    persons: [per("mother"), per("father"), per("c", { name: "Child" })],
    edges: { c: ["mother", "father"] },
  });
  const a = loadArchive({ model: m });
  const path = a.relationshipPath("mother", "father");
  assert.equal(path.kind, "affinity", "partnership, never blood");
  assert.equal(path.sharedDescendant, true);
  assert.match(path.note, /NOT a blood relationship/);
  // and a couple that are ALSO cousins keeps the blood finding (monotone path exists)
  const m2 = build({
    persons: [per("g"), per("h1"), per("h2"), per("w1"), per("w2"), per("kid")],
    edges: { h1: ["g"], h2: ["g"], w1: ["h1"], w2: ["h2"], kid: ["w1", "w2"] },
  });
  const a2 = loadArchive({ model: m2 });
  const cousins = a2.relationshipPath("w1", "w2");
  assert.equal(cousins.kind, "blood", "cousins who married stay blood relatives too");
  assert.equal(cousins.commonAncestor, "g");
});

test("living-person leak: provider refs on a living stub are caught", () => {
  const m = createModel({ root: "liv-9" });
  addPerson(m, per("liv-9", { name: "Living", living: true, lifespan: null }));
  addPerson(m, per("d1"));
  addEdge(m, "liv-9", ["d1"]);
  const ok = loadArchive({ model: m });
  assert.equal(ok.validatePublic().ok, true, "anonymous stub corpus passes");

  const leak = createModel({ root: "liv-8" });
  addPerson(leak, per("liv-8", { name: "Living", living: true, lifespan: null, refs: [{ provider: "prov", id: "LEAK-REF" }] }));
  addPerson(leak, per("d2"));
  addEdge(leak, "liv-8", ["d2"]);
  const bad = loadArchive({ model: leak });
  const res = bad.validatePublic();
  assert.equal(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("carries provider refs")), "archive-level leak check fires");
});

test("ambiguous name is reported with candidates, never silently resolved", () => {
  const m = build({
    persons: [per("a", { name: "John Smith" }), per("b", { name: "John Smith" }), per("c")],
    edges: {},
  });
  const a = loadArchive({ model: m });
  const r = a.resolve("John Smith");
  assert.equal(r.ambiguous, true);
  assert.deepEqual(r.candidates.map((x) => x.id).sort(), ["a", "b"]);
});

test("panel keeps era and support separate and mints no confidence score", () => {
  const m = build({
    persons: [per("r"), per("m", { name: "Me", lifespan: "1800–1870" })],
    edges: { m: [] },
  });
  const dir = mkdtempSync(join(tmpdir(), "gux01-"));
  writeFileSync(join(dir, "r.json"), JSON.stringify({
    internalId: "r", bnr: "bnr:fixture", identity: { name: "Root", lifespan: null },
    refs: [], evidence: { era: "living", support: "unsourced-entry" },
    research: { status: "incomplete" }, publication: { status: "public" },
    relationships: {}, layers: { records: { recordUrl: "https://example.test/record", provider: "prov", retrieved: "2026-09-16" }, tradition: { pack: "pack-x" }, testimony: [], meaning: [] },
    onSpine: true, generatedFrom: "fixture",
  }));
  const a = loadArchive({ model: m, personsDir: dir });
  const panel = a.personPanel("r");
  assert.equal(panel.layersSource, "staged-object");
  assert.equal(panel.layers.records.recordUrl, "https://example.test/record");
  assert.equal(panel.research.status, "incomplete");
  assert.equal(panel.onSpine, true);
  assert.ok(panel.identity.bnr);
  // the two evidence axes exist; no confidence verdict exists anywhere
  assert.ok(panel.evidence.era && panel.evidence.support);
  assert.equal(/"confidence/i.test(JSON.stringify(panel)), false, "no confidence score is ever minted");
  const bare = a.personPanel("m");
  assert.equal(bare.layersSource, "corpus-only");
  assert.equal(bare.layers, null);
});

// ── 2. corpus invariants at the pinned public projection ───────────────────
const CORPUS = join(process.cwd(), "assets", "profile-archive", "lineage", "remington-bloodline.json");
const haveCorpus = existsSync(CORPUS);

test("corpus: inventory counts derived from the actual corpus", { skip: haveCorpus ? false : "corpus not present (outside-repo run)" }, () => {
  const a = loadArchive({ corpusPath: CORPUS });
  const inv = a.inventory();
  assert.equal(inv.counts.persons, 10259);
  assert.equal(inv.counts.edges, 7204);
  assert.equal(inv.counts.couples, 4854);
  assert.equal(inv.counts.livingStubs, 3);
  assert.equal(inv.counts.cyclicComponents, 8);
  assert.equal(inv.counts.cyclicPersonIds, 44);
  assert.equal(inv.counts.bloodlineParentward, 10097, "matches the corpus's own meta.stats.bloodlinePersons");
  assert.equal(inv.counts.bloodlineParentward, a.model.meta.stats.bloodlinePersons);
  assert.deepEqual(inv.parentShape, { noParentRecord: 3055, oneParentRecord: 992, twoPlusParentRecord: 6212 });
  assert.equal(inv.ghostFrontier.danglingReferences, 1959);
  assert.ok(inv.ghostFrontier.distinctUnfetchedTargets > 0);
  assert.equal(inv.stagedObjects, 10259);
  // reconciliation explains every non-public person — nobody silently disappears
  assert.equal(inv.reconciliation.published, 10259);
  assert.equal(inv.reconciliation.rawPersons, 18575);
});

test("corpus: named acceptance persons resolve through their published paths", { skip: haveCorpus ? false : "corpus not present (outside-repo run)" }, () => {
  const a = loadArchive({ corpusPath: CORPUS });
  const expect = { "KWCL-VNB": "p7b1078c886", "LNQ5-BSF": "p455afa9256", "LNQ5-BSG": "p4ceb2ace98", "KWJ4-XBD": "p72d226cedf" };
  for (const [ref, id] of Object.entries(expect)) {
    const r = a.resolve(ref);
    assert.equal(r?.id, id, `${ref} resolves to ${id}`);
    assert.equal(r.matched, "provider-ref");
  }
  const apr = a.resolve("Albert Perry Rockwood");
  assert.equal(apr.id, "p72d226cedf");
  assert.equal(apr.matched, "name");
  assert.equal(a.personPanel("p7b1078c886").identity.name, "Donna Ruth Lawton");
  assert.equal(a.personPanel("p4ceb2ace98").identity.name, "Don Ray Remington");
  assert.equal(a.personPanel("p455afa9256").identity.name, "Marilyn Lowry");
});

test("corpus: full ID resolution — every internal id and every indexed ref resolves", { skip: haveCorpus ? false : "corpus not present (outside-repo run)" }, () => {
  const a = loadArchive({ corpusPath: CORPUS });
  const ids = Object.keys(a.model.persons);
  for (const id of ids) assert.equal(a.resolve(id).id, id);
  const refs = Object.keys(a.model.refsIndex);
  assert.equal(refs.length, 10253);
  for (const ref of refs) assert.ok(a.resolve(ref), `ref ${ref} resolves`);
});

test("corpus: founder → Albert Perry Rockwood is a blood path; spouse-only couples exist and are labeled affinity", { skip: haveCorpus ? false : "corpus not present (outside-repo run)" }, () => {
  const a = loadArchive({ corpusPath: CORPUS });
  const path = a.relationshipPath("founder", "p72d226cedf");
  assert.equal(path.kind, "blood", "the public entrance person is a blood ancestor of the founder");
  const dup = a.relationshipPath("founder", "p72d226cedf");
  assert.deepEqual(path, dup, "deterministic");
  // property: within the first couples there is a spouse-only pair (no blood
  // path between the partners) and it is reported as affinity, never blood
  const couples = Object.values(a.model.couples).slice(0, 5);
  const affinity = couples.find((cp) => a.relationshipPath(cp.p1, cp.p2).kind === "affinity");
  assert.ok(affinity, "a spouse-only couple exists in the scanned window");
  const rel = a.relativesOf(affinity.p1);
  assert.ok(rel.spouses.every((s) => s.blood === false));
});

test("corpus: privacy gate passes on its own terms; parent-graph cycles are REPORTED with witnesses, never conflated", { skip: haveCorpus ? false : "corpus not present (outside-repo run)" }, () => {
  const a = loadArchive({ corpusPath: CORPUS });
  const res = a.validatePublic();
  const comps = res.problems.filter((p) => p.startsWith("cycle-component:"));
  const wits = res.problems.filter((p) => p.startsWith("witness:"));
  const other = res.problems.filter((p) => !p.startsWith("cycle-component:") && !p.startsWith("witness:"));

  // THE PRIVACY CLAIM, said directly instead of through res.ok: not one
  // problem outside the parent-graph-cycle class. res.ok was only ever true
  // because the checker was blind to cycles (model.validate gained cycle
  // reporting in d47ba87f), so asserting ok === true encoded "this corpus has
  // no cyclic parent edges" as a PREMISE of the privacy gate. It is not one.
  assert.deepEqual(other, [], "no privacy or integrity problem of any other class");

  // THE KNOWN DEFECT, held open on purpose. Eight cyclic components in the
  // parent graph are a question about the corpus, not about this test, and
  // they get their own slice. These two numbers are the tripwire: nothing may
  // quietly resolve them, and nothing may quietly add more.
  assert.equal(comps.length, 8, "the eight known cyclic components are reported, not swallowed");
  assert.equal(wits.length, comps.length, "every reported component carries a witness path");

  // The witness is JUDGED, not counted: each must be a closed walk whose every
  // hop is a real child -> parent edge, over ids one reported component named.
  const compSets = comps.map((c) => new Set(c.slice("cycle-component:".length).trim().split(",")));
  for (const w of wits) {
    const hops = w.slice("witness:".length).trim().split(" -> ");
    assert.ok(hops.length >= 2, `witness is a walk, not a point: ${w}`);
    assert.equal(hops[0], hops[hops.length - 1], `witness closes on itself: ${w}`);
    for (let i = 0; i + 1 < hops.length; i++)
      assert.ok((a.model.edges[hops[i]] || []).includes(hops[i + 1]), `hop ${hops[i]} -> ${hops[i + 1]} is a real parent edge`);
    const owner = compSets.filter((s) => hops.every((h) => s.has(h)));
    assert.equal(owner.length, 1, `witness belongs to exactly one reported component: ${w}`);
  }

  // Everything below this line never executed while res.ok was assertion one.
  assert.equal(res.ghostFrontier.reportedByModel, 1959);
  assert.equal(res.ghostFrontier.countedHere, 1959);
  const living = Object.entries(a.model.persons).filter(([, p]) => p.living);
  assert.equal(living.length, 3);
  for (const [id, p] of living) {
    assert.equal(p.name, "Living");
    assert.equal((p.refs || []).length, 0, `${id} carries no refs`);
  }
  // name search surfaces only anonymous stubs for the living
  const s = a.searchNames("living");
  assert.ok(s.results.length > 0);
  assert.ok(s.results.every((x) => !x.living || x.name === "Living"));
});

test("corpus: panel for the entrance person carries staged layers with attribution", { skip: haveCorpus ? false : "corpus not present (outside-repo run)" }, () => {
  const a = loadArchive({ corpusPath: CORPUS });
  const panel = a.personPanel("p72d226cedf");
  assert.equal(panel.layersSource, "staged-object");
  assert.ok(panel.layers.records?.recordUrl, "provider record link present");
  assert.ok(panel.layers.tradition?.pack, "tradition pack present, attributed separately");
  assert.equal(a.coverage("p72d226cedf").publishedChildren, 1, "APR names exactly one published child");
  assert.equal(/"confidence/i.test(JSON.stringify(panel)), false);
});

test("corpus: an ordinary 19th-century relative is reachable and covered honestly", { skip: haveCorpus ? false : "corpus not present (outside-repo run)" }, () => {
  const a = loadArchive({ corpusPath: CORPUS });
  const s = a.searchNames("Sarah Ann Frampton");
  assert.equal(s.results.length, 1);
  const id = s.results[0].id;
  const panel = a.personPanel(id);
  assert.equal(panel.identity.name, "Sarah Ann Frampton");
  assert.ok(panel.coverage, "coverage stated for an ordinary relative, not only highlighted lines");
  const rel = a.relativesOf(id);
  assert.ok(Array.isArray(rel.parents) && Array.isArray(rel.spouses) && Array.isArray(rel.siblings), "relatives shape is classified arrays");
});

// ── 3. Archive 1.1: hop arrays, onBloodline, ref-collision guard ───────────

test("1.1 F1: every blood path starts at a, ends at b, no duplicate hops (up/down/sibling/cousin)", () => {
  const m = build({
    persons: [per("g"), per("w1"), per("h1"), per("h2"), per("w2"), per("kid")],
    edges: { h1: ["g"], h2: ["g"], w1: ["h1"], w2: ["h2"], kid: ["w1"] },
  });
  const a = loadArchive({ model: m });
  const cases = [
    ["w2", "g", "upward: descendant to ancestor"],
    ["g", "w2", "downward: ancestor to descendant"],
    ["h1", "h2", "siblings through the shared parent"],
    ["w1", "w2", "cousins through the grandparent"],
  ];
  for (const [x, y, why] of cases) {
    for (const [p, s] of [[x, y], [y, x]]) {
      const path = a.relationshipPath(p, s);
      assert.equal(path.kind, "blood", why);
      assert.equal(path.path[0].id, p, `${why}: path starts at a`);
      assert.equal(path.path[path.path.length - 1].id, s, `${why}: path ends at b`);
      const ids = path.path.map((h) => h.id);
      assert.equal(new Set(ids).size, ids.length, `${why}: no duplicated id`);
      const apexAt = ids.indexOf(path.commonAncestor);
      assert.ok(apexAt >= 0, `${why}: apex present`);
      assert.equal(ids.indexOf(path.commonAncestor, apexAt + 1), -1, `${why}: apex appears exactly once`);
      for (let i = 1; i <= apexAt; i++) assert.equal(path.path[i].via, "parent", `${why}: climb steps`);
      for (let i = apexAt + 1; i < path.path.length; i++) assert.equal(path.path[i].via, "child", `${why}: descend steps`);
    }
  }
});

test("1.1 F1: corpus collateral pair renders a well-formed hop array (Hadlock)", { skip: haveCorpus ? false : "corpus not present (outside-repo run)" }, () => {
  const a = loadArchive({ corpusPath: CORPUS });
  // Samuel Arthur Hadlock vs Joseph Hadlock -- the pair that exposed the defect
  const path = a.relationshipPath("pb8e0a7cd75", "pd9181bfe85");
  assert.equal(path.kind, "blood");
  assert.equal(path.path[0].id, "pb8e0a7cd75");
  assert.equal(path.path[path.path.length - 1].id, "pd9181bfe85", "endpoint b is no longer dropped");
  const ids = path.path.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length, "apex no longer duplicated");
  const back = a.relationshipPath("pd9181bfe85", "pb8e0a7cd75");
  assert.deepEqual(back.path.map((h) => h.id), ids.slice().reverse(), "fwd/rev mirror");
});

test("1.1 F2: personPanel().onBloodline is filled and agrees with bloodlineSet()", { skip: haveCorpus ? false : "corpus not present (outside-repo run)" }, () => {
  const a = loadArchive({ corpusPath: CORPUS });
  const bl = a.bloodlineSet();
  assert.equal(a.personPanel("p72d226cedf").onBloodline, true, "APR is a blood ancestor of the founder");
  let seenFalse = 0;
  for (const id of Object.keys(a.model.persons)) {
    const v = a.personPanel(id).onBloodline;
    assert.equal(typeof v, "boolean", `onBloodline is never null (${id})`);
    assert.equal(v, bl.has(id), `panel agrees with bloodlineSet (${id})`);
    if (!v) seenFalse++;
  }
  assert.ok(seenFalse > 0, "the corpus does contain persons off the parentward bloodline");
});

test("1.1 F2 (synthetic): onBloodline is true on the parent line, false for a married-in spouse", () => {
  const m = build({
    persons: [per("r"), per("p"), per("inlaw")],
    edges: { r: ["p"] },
    couples: [["p", "inlaw", "1900"]],
  });
  const a = loadArchive({ model: m });
  assert.equal(a.personPanel("r").onBloodline, true, "root is on its own bloodline");
  assert.equal(a.personPanel("p").onBloodline, true, "ancestor is on the bloodline");
  assert.equal(a.personPanel("inlaw").onBloodline, false, "married-in spouse is not");
});

test("1.1 F3: a provider ref resolving to two persons fails the load, not last-wins", () => {
  const m = build({
    persons: [
      per("da", { refs: [{ provider: "prov", id: "DUP-REF" }] }),
      per("db", { refs: [{ provider: "prov", id: "DUP-REF" }] }),
    ],
    edges: {},
  });
  assert.throws(() => loadArchive({ model: m }), /DUP-REF/, "collision is named and the load fails");
  // the same ref repeated on the SAME person stays one identity -- no throw
  const m2 = build({
    persons: [per("solo", { refs: [{ provider: "prov", id: "OK-REF" }, { provider: "prov", id: "OK-REF" }] })],
    edges: {},
  });
  const a2 = loadArchive({ model: m2 });
  assert.equal(a2.resolve("OK-REF").id, "solo");
});

// ── 4. Archive core — one resolver, two environments (founder ruling bdf59735) ─

test("core: ZERO imports — the resolver is browser-consumable by construction", () => {
  const src = readFileSync(new URL("../../surfaces/archive-core.mjs", import.meta.url), "utf8");
  assert.equal(/^import[\s{"']/m.test(src), false, "no static import statements of any kind (law: zero imports)");
  assert.equal(/\bimport\s*\(/.test(src), false, "no dynamic import either");
  assert.equal(/\brequire\s*\(/.test(src), false, "no require");
  assert.equal(/\bfrom\s+["']/.test(src), false, "no module specifier anywhere in code");
});

test("core-direct: the founder contract on a bare parsed model, no fs wrapper", () => {
  const m = build({
    root: "r",
    persons: [per("r"), per("g"), per("h1"), per("h2"), per("w1"), per("w2")],
    edges: { r: ["w1"], h1: ["g"], h2: ["g"], w1: ["h1"], w2: ["h2"] },
  });
  const core = createArchiveCore(m);
  assert.equal(core.schema, ARCHIVE_CORE_SCHEMA);
  const path = core.relationshipPath("w1", "w2");
  assert.equal(path.kind, "blood");
  assert.equal(path.commonAncestor, "g");
  assert.deepEqual(path.path.map((h) => h.id), ["w1", "h1", "g", "h2", "w2"], "collateral shape survives extraction byte-for-behavior");
  assert.equal(core.resolve("w1").id, "w1", "canonical lookup by id");
  const bl = core.bloodlineSet();
  for (const id of ["r", "w1", "h1", "g"]) assert.equal(bl.has(id), true, `${id} is on the parentward bloodline`);
  assert.equal(bl.has("w2"), false, "the collateral cousin is off it");
  const s = core.searchNames("w2");
  assert.ok(s.results.some((x) => x.id === "w2"), "search over the person table the core already owns");
  assert.equal(core.cyclicAncestryOf("w1"), null, "no cycle, no disputed state");
});
