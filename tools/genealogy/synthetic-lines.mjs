// SYNTHETIC two-line family for the Tree of Life contract and harness. Every
// name, date, and claim here is invented for testing; none describes a real
// person. The first real spouse root is wired only from a private record the
// founder supplies, and never through this file.
//
//   founder line                    spouse-1 line
//   fg1(†) fg2(†)                   s-aaa(†)          s-aba(†)
//      \   /                           |                 |
//      fp1*  fp2*                   s-aa(†)  uncle*   s-ab*
//        \   /                          \   /           |
//        founder*  ─ married ─  spouse*   s-a* ─────────┘   s-b(†)
//                                  \________________________/
// (* living)  spouse's parents: s-a*, s-b(†); s-a's parents: s-aa(†), s-ab*
import { createModel, addPerson, addEdge, addCouple } from "./model.mjs";

export const SRC = "synthetic parish register, entry 12";

export function syntheticLines() {
  const m = createModel({ root: "founder", source: "synthetic" });
  const P = (id, name, lifespan, living, gender, extra = {}) => addPerson(m, { id, name, lifespan, living, gender, ...extra });
  P("founder", "Founder Private", "1980–", true, "M");
  P("fp1", "Founder Parent One", "1950–", true, "M");
  P("fp2", "Founder Parent Two", "1952–", true, "F");
  P("fg1", "Founder Grand One", "1920–1990", false, "M");
  P("fg2", "Founder Grand Two", "1922–1999", false, "F");
  P("spouse", "Spouse Private Name", "1985–", true, "F", {
    cultureClaims: [{ kind: "language", value: "Latvian", from: 1985, source: SRC }],
  });
  P("s-a", "Spouse Parent Living", "1955–", true, "M");
  P("s-b", "Spouse Parent Deceased", "1940–2001", false, "F");
  P("s-aa", "Spouse Grand Deceased", "1901–1970", false, "M", {
    cultureClaims: [
      { kind: "language", value: "Latvian", from: 1901, to: 1970, source: SRC },
      { kind: "religion", value: "Lutheran", from: 1901, to: 1940, source: SRC, sourceId: "reg-12" },
    ],
  });
  P("s-ab", "Spouse Grand Living", "1935–", true, "F");
  P("s-aaa", "Spouse Great Grand", "1870–1930", false, "M", {
    cultureClaims: [
      { kind: "region", value: "Vidzeme", from: 1870, to: 1930, source: SRC },
      { kind: "polity", value: "Governorate of Livonia", from: 1870, to: 1918, source: SRC },
      { kind: "language", value: "German", from: 1890, to: 1918, source: SRC, note: "synthetic: a second language of administration" },
    ],
  });
  P("s-aba", "Spouse Great Grand Two", "1880–1950", false, "F");
  P("uncle", "Living Uncle Name", "1958–", true, "M");
  addEdge(m, "founder", ["fp1", "fp2"]);
  addEdge(m, "fp1", ["fg1", "fg2"]);
  addEdge(m, "spouse", ["s-a", "s-b"]);
  addEdge(m, "s-a", ["s-aa", "s-ab"]);
  addEdge(m, "uncle", ["s-aa"]);
  addEdge(m, "s-aa", ["s-aaa"]);
  addEdge(m, "s-ab", ["s-aba"]);
  addCouple(m, "founder", "spouse");
  addCouple(m, "fp1", "fp2");
  m.roots = { founder: "founder", "spouse-1": "spouse" };
  return m;
}
