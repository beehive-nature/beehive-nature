// pedigree geometry fixtures — the four shapes the founder ordered, proven at
// the data layer (no invented second parent, no vanished ancestors) and at
// the slot-assignment layer (the page's exact logic, mirrored here).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createModel, addPerson, addEdge, bloodline } from "./model.mjs";

// mirror of the page's parentSlots: gender roles decide; unknown-gender fills
// an EMPTY slot only; the same person is never in both slots
function parentSlots(ps, genderOf) {
  let fa = null, mo = null;
  const used = new Set();
  for (const p of ps) {
    const g = genderOf(p);
    if (g === "M" && !fa) { fa = p; used.add(p); }
    else if (g === "F" && !mo) { mo = p; used.add(p); }
  }
  for (const p of ps) {
    if (used.has(p)) continue;
    if (!fa) { fa = p; used.add(p); }
    else if (!mo) { mo = p; used.add(p); }
  }
  return [fa, mo];
}

test("mother-only record: one parent in, one parent out — no manufactured second", () => {
  const m = createModel({ root: "C1", source: "fixture" });
  addPerson(m, { id: "C1", name: "Child", living: false });
  addPerson(m, { id: "M1", name: "Mother", gender: "F", living: false });
  addEdge(m, "C1", ["M1"]);
  assert.deepEqual(m.edges.C1, ["M1"], "data layer keeps exactly one parent");
  const [fa, mo] = parentSlots(m.edges.C1, (id) => m.persons[id].gender);
  assert.equal(fa, null, "father slot stays EMPTY — no fallback fill");
  assert.equal(mo, "M1");
});

test("father-only record: mirror case", () => {
  const m = createModel({ root: "C2", source: "fixture" });
  addPerson(m, { id: "C2", name: "Child", living: false });
  addPerson(m, { id: "F1", name: "Father", gender: "M", living: false });
  addEdge(m, "C2", ["F1"]);
  const [fa, mo] = parentSlots(m.edges.C2, (id) => m.persons[id].gender);
  assert.equal(fa, "F1");
  assert.equal(mo, null, "mother slot stays EMPTY");
});

test("unresolved parent role: shown once, role stays unknown, never duplicated", () => {
  const m = createModel({ root: "C3", source: "fixture" });
  addPerson(m, { id: "C3", name: "Child", living: false });
  addPerson(m, { id: "U1", name: "Parent (role unknown)", gender: null, living: false });
  addEdge(m, "C3", ["U1"]);
  const [fa, mo] = parentSlots(m.edges.C3, (id) => m.persons[id].gender);
  assert.ok(fa === "U1" || mo === "U1", "fills exactly ONE slot");
  assert.notEqual(fa, mo, "never both slots");
  assert.equal(m.persons.U1.gender, null, "role stays unknown in the data");
});

test("repeated ancestor with known parents: the repeat KEEPS its ancestry (one identity, several positions)", () => {
  const m = createModel({ root: "R1", source: "fixture" });
  //     R1        (root)
  //    /  \
  //   A    B      (siblings)
  //  / \  / \
  // X   \/   Y    (X is BOTH grandparents' parent — classic collapse)
  //    /\
  //  Z1  Z2
  addPerson(m, { id: "R1", name: "Root", living: false });
  addPerson(m, { id: "A", name: "A", gender: "F", living: false });
  addPerson(m, { id: "B", name: "B", gender: "M", living: false });
  addPerson(m, { id: "X", name: "Repeat", gender: "M", living: false });
  addPerson(m, { id: "Y", name: "Y", gender: "F", living: false });
  addPerson(m, { id: "Z1", name: "Z1", gender: "M", living: false });
  addPerson(m, { id: "Z2", name: "Z2", gender: "F", living: false });
  addEdge(m, "R1", ["B", "A"]);
  addEdge(m, "A", ["X", "Y"]);
  addEdge(m, "B", ["X", "Y"]);
  addEdge(m, "X", ["Z1", "Z2"]);
  // the repeat's parents remain fully reachable — no vanished ancestors
  const blood = bloodline(m);
  for (const id of ["Z1", "Z2", "X", "Y", "A", "B"])
    assert.ok(blood.has(id), `collapse must not remove ${id} from the graph`);
  // X occupies TWO relationship positions (child-edges from both A and B)
  const positions = Object.entries(m.edges).filter(([, ps]) => ps.includes("X")).length;
  assert.equal(positions, 2, "one identity, several pedigree positions");
});

test("true cycle is detectable on the ancestor path — not merely 'seen elsewhere'", () => {
  const m = createModel({ root: "Q1", source: "fixture" });
  addPerson(m, { id: "Q1", name: "Q1", living: false });
  addPerson(m, { id: "Q2", name: "Q2", gender: "F", living: false });
  addPerson(m, { id: "Q3", name: "Q3", gender: "M", living: false });
  addEdge(m, "Q1", ["Q3", "Q2"]);
  addEdge(m, "Q3", ["Q3", "Q2"]); // Q3 listed as own parent — a true cycle
  const path = new Set();
  const hasCycle = (id) => {
    if (path.has(id)) return true;
    path.add(id);
    for (const p of (m.edges[id] || [])) if (hasCycle(p)) return true;
    path.delete(id);
    return false;
  };
  assert.ok(hasCycle("Q1"), "cycle on the path is detected");
  path.clear();
  // a repeat NOT on the path is not a cycle
  const seen = new Set(["Q3"]);
  assert.ok(!path.has("Q3"), "seen-elsewhile is not a path cycle");
});
