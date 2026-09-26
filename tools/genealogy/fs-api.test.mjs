// fs-api.mjs — offline: PKCE against RFC 7636's own vector, ahnentafel
// decoding, a multi-call walk over a mocked Tree API, and the hand-off into
// the existing importWalk → publish path. No network, no real family.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pkceChallenge, pkcePair, authorizeUrl, tokenRequest, ancestryToWalkPart, walkAncestry, FS_ENV } from "./fs-api.mjs";
import { createModel, validate } from "./model.mjs";
import { importWalk } from "./fs-adapter.mjs";
import { publish } from "./publish.mjs";

test("PKCE S256 matches RFC 7636 appendix B", () => {
  assert.equal(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  const { verifier, challenge } = pkcePair();
  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(pkceChallenge(verifier), challenge);
});

test("authorize URL and token request carry PKCE, never a secret", () => {
  const u = new URL(authorizeUrl({ clientId: "KEY", redirectUri: "http://127.0.0.1:5173/callback", state: "s1", challenge: "c1" }));
  assert.equal(u.origin + u.pathname, FS_ENV.integration.ident.replace(/\/cis-web.*$/, "") + "/cis-web/oauth2/v3/authorization");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("code_challenge"), "c1");
  const t = tokenRequest({ clientId: "KEY", redirectUri: "http://127.0.0.1:5173/callback", code: "abc", verifier: "v" });
  const body = new URLSearchParams(t.init.body);
  assert.equal(body.get("code_verifier"), "v");
  assert.equal(body.get("client_secret"), null);
});

// a pedigree: root 1, parents 2/3, grandparents 4..7 (the top of a 2-generation call)
const P = (id, name, n, extra = {}) => ({ id, living: false, display: { name, lifespan: "1900–1970", gender: "Male", ascendancyNumber: String(n) }, ...extra });
const call1 = { persons: [
  { id: "ROOT-001", living: true, display: { name: "Root Living", lifespan: "1980–Living", gender: "Female", ascendancyNumber: "1" } },
  { id: "SPOU-001", living: true, display: { name: "Spouse Row", ascendancyNumber: "1-S" } },
  P("DADD-002", "Father", 2), P("MOMM-003", "Mother", 3),
  P("GPAA-004", "Grandpa A", 4), P("GMAA-005", "Grandma A", 5), P("GPAB-006", "Grandpa B", 6),
] };
const callGpaA = { persons: [P("GPAA-004", "Grandpa A", 1), P("GGPA-008", "Great A", 2), P("GGMA-009", "Great A2", 3)] };
const callEmpty = { persons: [] };

test("ahnentafel decodes to child→parents edges; spouse rows are not ancestry", () => {
  const part = ancestryToWalkPart(call1);
  assert.deepEqual(part.edges["ROOT-001"], ["DADD-002", "MOMM-003"]);
  assert.deepEqual(part.edges["DADD-002"], ["GPAA-004", "GMAA-005"]);
  assert.deepEqual(part.edges["MOMM-003"], ["GPAB-006"]);
  assert.equal(part.persons["SPOU-001"], undefined);
  assert.equal(part.persons["ROOT-001"].living, true);
});

test("the walk continues from the top generation, asks each person once, and counts the open frontier", async () => {
  const asked = [];
  const fetchJson = async (url) => {
    const pid = new URL(url).searchParams.get("person"); asked.push(pid);
    return pid === "ROOT-001" ? call1 : pid === "GPAA-004" ? callGpaA : callEmpty;
  };
  const w = await walkAncestry({ fetchJson, root: "ROOT-001", generations: 2 });
  assert.deepEqual(asked, ["ROOT-001", "GPAA-004", "GMAA-005", "GPAB-006"]);
  assert.deepEqual(w.edges["GPAA-004"], ["GGPA-008", "GGMA-009"]);
  assert.equal(w.meta.calls, 4);
  assert.equal(Object.keys(w.persons).length, 8);
});

test("a failing call is recorded, not fatal; the cap stops the walk", async () => {
  const fetchJson = async (url) => { const pid = new URL(url).searchParams.get("person"); if (pid === "GPAA-004") throw new Error("503"); return pid === "ROOT-001" ? call1 : callEmpty; };
  const w = await walkAncestry({ fetchJson, root: "ROOT-001", generations: 2 });
  assert.deepEqual(w.meta.errors, ["GPAA-004"]);
  const capped = await walkAncestry({ fetchJson: async () => call1, root: "ROOT-001", generations: 2, cap: 3 });
  assert.equal(capped.meta.calls, 1);
});

test("the API walk feeds the existing pipeline unchanged: living root held, deceased public", async () => {
  const fetchJson = async (url) => (new URL(url).searchParams.get("person") === "ROOT-001" ? call1 : callEmpty);
  const w = await walkAncestry({ fetchJson, root: "ROOT-001", generations: 2 });
  const m = createModel({ root: w.root, source: "familysearch" });
  importWalk(m, w);
  const { pub } = publish(m);
  assert.equal(pub.persons["ROOT-001"].name, "Living");
  assert.equal(pub.persons["GPAA-004"].name, "Grandpa A");
  assert.ok(!JSON.stringify(pub).includes("Root Living"));
  // FSID-keyed stub is pseudonymized by the pipeline's identity step; everything else is clean
  assert.deepEqual(validate(pub, { public: true }).filter((p) => !/provider identifier/.test(p)), []);
});
