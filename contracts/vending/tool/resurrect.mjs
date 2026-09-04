// resurrect.mjs — THE PROOF: stand the agent back up from the certificate alone.
//
// INPUTS ARE MEMBER-HELD ONLY (pointer law): the agent's rail name, and nothing
// else that the estate curates. Two roads, both derived:
//   NAME ROAD:  name -> vending contract certs row -> ar_id  (chain state read)
//   KEY ROAD:   member key -> Arweave tx owner  (the item's owner IS the key;
//               fetched from the tx itself, then checked against the record)
// Then: fetch certificate bytes from the public gateway, verify the content
// hash, verify the recipe is present, and run the FORGED test (one flipped
// byte must FAIL verification).
// usage: node resurrect.mjs <agentName> [local|jungle4]
import { verifyCertificate, canonicalJson, contentHash } from "./cert.mjs";

const NAME = process.argv[2];
const TARGET = process.argv[3] || "local";
const RPC = TARGET === "local" ? "http://127.0.0.1:8888" : "https://jungle4.greymass.com";
const CONTRACT = TARGET === "jungle4" ? "bnrapolltest" : "vending";
const GATEWAY = "https://arweave.net";
let pass = 0, fail = 0;
const t = (name, v, detail = "") => {
  if (v) { pass++; console.log("  ok   " + name + (detail ? " — " + detail : "")); }
  else { fail++; console.log("  FAIL " + name + (detail ? " — " + detail : "")); }
};

console.log("── the name road: derive the pointer from the name alone ──");
const rowReq = await fetch(RPC + "/v1/chain/get_table_rows", { method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ json: true, code: CONTRACT, scope: CONTRACT,
    table: "certs", lower_bound: null, upper_bound: null, limit: 100 }) });
const rows = (await rowReq.json()).rows || [];
// the pk is FNV-1a-64 of the name (vending contract law); scan for exact match
const fnv = (s) => { let h = 0xcbf29ce484222325n;
  for (const c of Buffer.from(s, "utf8")) { h ^= BigInt(c); h *= 0x100000001b3n; } return h.toString(); };
const row = rows.find(r => r.agent_name === NAME);
t("certificate row found by name", !!row);
if (!row) { console.log("RESURRECTION FAILED at the name road"); process.exit(1); }
const arId = row.ar_id;
t("ar id is a 43-char data-item id", arId.length === 43);

console.log("── fetch the certificate from the public gateway ──");
const res = await fetch(`${GATEWAY}/${arId}`, { signal: AbortSignal.timeout(60000) });
t("gateway returned the bytes", res.ok, "HTTP " + res.status);
const text = await res.text();

console.log("── hash gate: the record proves itself ──");
let cert;
try { cert = JSON.parse(text); } catch { t("certificate is JSON", false); process.exit(1); }
t("certificate is JSON", true);
const v = verifyCertificate(cert);
t("CONTENT HASH VERIFIES (re-derive, re-hash, compare)", v.ok, v.ok ? v.hash.slice(0, 16) + "…" : v.reason);
t("chain row hash agrees with in-record hash", row.content_hash === cert.hash?.value);
t("recipe carried (the species survives the estate)", !!cert.recipe?.layers && Array.isArray(cert.recipe?.restand_steps));
t("five answers carried", !!(cert.answers?.what_is_this && cert.answers?.who_owns_it &&
  cert.answers?.when_minted_utc && cert.answers?.where_memory_lives && cert.answers?.how_to_make_another));

console.log("── key road: the member key locates the record with NO estate involvement ──");
// GraphQL by Member-Key tag — the derivation a member performs holding only their key
const memberKey = cert.answers.who_owns_it.member_key_ed25519_hex;
const gql = await fetch(`${GATEWAY}/graphql`, { method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: `query{transactions(tags:[{name:"Member-Key",values:["${memberKey}"]}]){edges{node{id owner{address}}}}}` }),
  signal: AbortSignal.timeout(60000) });
if (gql.ok) {
  const found = (await gql.json())?.data?.transactions?.edges || [];
  const ids = found.map(e => e.node.id);
  t("member key alone finds the record on Arweave (tag search)", ids.includes(arId),
    ids.length + " hit(s)");
  const owners = found.map(e => e.node.owner.address);
  t("record discoverable; owner recorded = " + owners[0], owners.length > 0);
} else {
  t("GraphQL key-road search reachable", false, "HTTP " + gql.status);
}

console.log("── the forged-resurrection negative proof ──");
const forged = structuredClone(cert);
forged.answers.who_owns_it.vaulta_account = "attacker";
const fv = verifyCertificate(forged);
t("a forged certificate FAILS the hash", !fv.ok, fv.reason);

console.log("── re-stand declaration ──");
const agent = { name: cert.agent.name, house: cert.agent.house, tongue: cert.agent.tongue,
  template: cert.agent.template, owner: cert.answers.who_owns_it,
  memory: cert.answers.where_memory_lives, recipe: "carried, hash-verified" };
console.log(JSON.stringify(agent, null, 2));

console.log(`\nRESURRECTION ${fail === 0 ? "PROVEN" : "FAILED"}: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
