// ── fs-api: FamilySearch's OFFICIAL Tree API → the raw walk the pipeline eats ──
// The scalable path (founder order 2026-09-22): a family signs in with
// FamilySearch (OAuth2 + PKCE, their consent, their session) and their
// ancestry is read through the documented Tree API, not the website's
// internal endpoints and not an agent driving a browser.
//
//   Ancestry: GET {api}/platform/tree/ancestry?person={pid}&generations={n}
//     (developers docs, Ancestry_resource / Read_Person_Ancestry_usecase):
//     a list of persons, each with display.ascendancyNumber, an ahnentafel
//     position: 1 = the person, 2n = father of n, 2n+1 = mother of n. Up to 9
//     generations per call; the walk continues from the top generation.
//   Auth: OAuth 2.0 for native apps with PKCE (developers guide
//     oauth2-native-apps); the token is the family's, held by the caller.
//
// Output is EXACTLY the raw walk shape fs-adapter.importWalk() consumes
// ({root, persons, edges, couples, meta}), so everything downstream
// (lines.mjs join, publish.mjs, privatize(), validation) is unchanged.
// Pure: no file system, no network of its own — fetchJson is injected.
import { createHash, randomBytes } from "node:crypto";

// Hostnames per FamilySearch's developer docs; "integration" is the sandbox a
// new app key works against before production approval.
export const FS_ENV = {
  integration: { ident: "https://identint.familysearch.org/cis-web/oauth2/v3", api: "https://api-integ.familysearch.org" },
  beta: { ident: "https://identbeta.familysearch.org/cis-web/oauth2/v3", api: "https://apibeta.familysearch.org" },
  production: { ident: "https://ident.familysearch.org/cis-web/oauth2/v3", api: "https://api.familysearch.org" },
};
export const FS_ACCEPT = "application/x-fs-v1+json";
export const FSID = /^[A-Z0-9]{4}-[A-Z0-9]{3,4}$/;

// ── OAuth2 + PKCE (RFC 7636, S256)
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const pkceChallenge = (verifier) => b64url(createHash("sha256").update(verifier).digest());
export function pkcePair() {
  const verifier = b64url(randomBytes(48));
  return { verifier, challenge: pkceChallenge(verifier) };
}
export function authorizeUrl({ env = "integration", clientId, redirectUri, state, challenge, scope = "openid profile offline_access" }) {
  const u = new URL(FS_ENV[env].ident + "/authorization");
  for (const [k, v] of Object.entries({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state,
    code_challenge: challenge, code_challenge_method: "S256", scope })) u.searchParams.set(k, v);
  return u.toString();
}
export function tokenRequest({ env = "integration", clientId, redirectUri, code, verifier }) {
  return {
    url: FS_ENV[env].ident + "/token",
    init: { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, redirect_uri: redirectUri, code, code_verifier: verifier }).toString() },
  };
}

// ── one Ancestry response → persons + child→parents edges by ahnentafel
export function ancestryToWalkPart(json) {
  const byAhnen = new Map(), persons = {};
  for (const p of (json && json.persons) || []) {
    const d = p.display || {};
    const n = String(d.ascendancyNumber || "");
    if (!FSID.test(p.id || "") || !/^\d+$/.test(n)) continue; // spouse rows ("1-S") are not ancestry
    byAhnen.set(Number(n), p.id);
    persons[p.id] = { id: p.id, name: d.name || null, lifespan: d.lifespan || null, gender: d.gender ? String(d.gender).toUpperCase() : null, living: !!p.living };
  }
  const edges = {};
  for (const [n, id] of byAhnen) {
    const ps = [byAhnen.get(2 * n), byAhnen.get(2 * n + 1)].filter(Boolean);
    if (ps.length) edges[id] = ps;
  }
  return { persons, edges, byAhnen };
}

// ── the walk: ancestry calls from the root, then from each top-generation person
// whose parents the last call could not reach, until nothing is open or CAP.
// fetchJson(url) → parsed JSON (the caller adds the Bearer token and Accept).
export async function walkAncestry({ fetchJson, env = "integration", root, generations = 8, cap = 30000, onProgress }) {
  if (!FSID.test(root || "")) throw new Error("fs-api: root is not a FamilySearch person id");
  const out = { root, persons: {}, edges: {}, couples: {}, meta: { calls: 0, errors: [], method: "FamilySearch Tree API /platform/tree/ancestry" } };
  const queue = [root], asked = new Set();
  const top = 2 ** generations; // ahnentafel numbers >= top sit in the last generation returned
  while (queue.length && Object.keys(out.persons).length < cap) {
    const pid = queue.shift();
    if (asked.has(pid)) continue;
    asked.add(pid);
    let json;
    try {
      json = await fetchJson(`${FS_ENV[env].api}/platform/tree/ancestry?person=${encodeURIComponent(pid)}&generations=${generations}`);
      out.meta.calls++;
    } catch (e) { out.meta.errors.push(pid); continue; }
    const part = ancestryToWalkPart(json);
    for (const [id, p] of Object.entries(part.persons)) if (!out.persons[id]) out.persons[id] = p;
    for (const [c, ps] of Object.entries(part.edges)) if (!out.edges[c]) out.edges[c] = ps;
    for (const [n, id] of part.byAhnen) if (n >= top && !out.edges[id] && !asked.has(id)) queue.push(id);
    if (onProgress) onProgress({ calls: out.meta.calls, persons: Object.keys(out.persons).length, open: queue.length });
  }
  out.meta.open = queue.filter((id) => !asked.has(id)).length; // the frontier left for a later walk
  out.meta.pulledAt = new Date().toISOString();
  return out;
}
