// mint.mjs — THE MINT, end to end:
//   1. load the member's ed25519 key (member-held material — the temp vault)
//   2. compose the birth certificate (five answers + recipe), hash it
//   3. upload to Arweave MAINNET via the box (ed25519-signed: owner = member key)
//   4. write the pointer row on the Vaulta chain (name road)
// usage: node mint.mjs <agentName> <tongue> <template> [local|jungle4]
import { generateKeyPairSync, createHash } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { composeCertificate, canonicalJson, certTags, contentHash } from "./cert.mjs";

const NAME = process.argv[2];
const TONGUE = process.argv[3] || "latvian";
const TEMPLATE = process.argv[4] || "bqueenbee-genesis-1";
const TARGET = process.argv[5] || "local";
const MEMBER_ACCT = "bnrapolltest"; // rehearsal stand-in for the member's Vaulta account

// 1. member key — fresh or from the temp vault (TESTNET-ONLY, never committed)
const KEYFILE = process.env.TEMP + "\\vending-member.seed.json";
let seedB64url, pubHex;
if (existsSync(KEYFILE)) {
  ({ seedB64url, pubHex } = JSON.parse(readFileSync(KEYFILE, "utf8")));
} else {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" });
  seedB64url = jwk.d;
  pubHex = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
  writeFileSync(KEYFILE, JSON.stringify({ seedB64url, pubHex }, null, 2));
  chmodSync(KEYFILE, 0o600);
  console.log("member key generated (TESTNET-ONLY vault:", KEYFILE + ")");
}
console.log("member ed25519 pub (hex):", pubHex, "PUBLIC-CONSTANT");

// 2. the store binding: a REAL signed A1 genesis revision under the member key
//    (format proven; the funded Autonomi write is custody-gated — stated in-record)
import { genesisRevision, hashRevision, importMemberSeed } from "./a1.mjs";
const memberPrivObj = await importMemberSeed(Buffer.from(seedB64url, "base64url"));
const a1Genesis = await genesisRevision({
  agent: NAME, body: { note: "a1 genesis — memory begins empty; the store funds later under this binding" },
  memberPrivateKey: memberPrivObj });
const a1GenesisHash = hashRevision(a1Genesis);
const storeBinding = {
  store: "autonomi",
  binding: "a1-log v1 — append-only hash-linked revisions, owner-signed ed25519 (this member key); resolver takes the highest valid revision; deletable by the member",
  a1_genesis: { rev: a1Genesis.rev, sha256: a1GenesisHash, ts: a1Genesis.ts },
  funded_write_status: "GATED on the ANT custody review (storage-substrate-split item 8); the binding is derivable from this certificate the day it is funded",
};

// 3. compose + hash
const mintedIso = new Date().toISOString();
const cert = composeCertificate({
  agentName: NAME, house: "a", tongue: TONGUE, template: TEMPLATE,
  memberKeyHex: pubHex, memberAccount: MEMBER_ACCT, mintedIso,
  storeBinding,
});
const canon = canonicalJson(cert);
const hash = contentHash(cert);
const bytes = Buffer.from(canon, "utf8");
console.log("certificate bytes:", bytes.length, "hash:", hash, "PUBLIC-CONSTANT");

// 4. upload via the box (RSA free door; the Member-Key tag carries the key road)
const tags = certTags({ agentName: NAME, memberKeyHex: pubHex, spec: "SPEC-VENDING-1" });
const stdinJson = JSON.stringify({ dataB64: bytes.toString("base64"),
  tags: tags.map(t => [t.name, t.value]) });
const out = execSync(
  `ssh -i ~/.ssh/bnr_key.lf ubuntu@129.153.202.144 "node ~/vending-probe/ar-upload-rsa.cjs"`,
  { input: stdinJson, timeout: 180000 }).toString().trim();
const up = JSON.parse(out);
console.log("AR UPLOAD:", JSON.stringify(up), "PUBLIC-CONSTANT");
if (!up.id || up.id.length !== 43) { console.error("no ar id — abort"); process.exit(1); }

writeFileSync("last-mint.json", JSON.stringify({
  name: NAME, memberKeyHex: pubHex, arId: up.id, owner: up.owner, winc: up.winc,
  hash, certBytes: bytes.length, mintedIso, cert, a1Genesis,
}, null, 2));

// 5. the pointer row on the Vaulta chain (name road); re-mints ride vending::update
//    (the bounded in-place path — one row per agent, history lives on Arweave)
if (TARGET === "local") {
  const wif = execSync(`wsl -e bash -lc "cat ~/vchain/member.key"`).toString().trim();
  const eosjsPkg = (await import("eosjs")).default;
  const { Api, JsonRpc } = eosjsPkg;
  const { JsSignatureProvider } = await import("eosjs/dist/eosjs-jssig.js");
  const rpc = new JsonRpc("http://127.0.0.1:8888", {});
  const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([wif]),
                        textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
  const existing = await rpc.get_table_rows({ json: true, code: "vending", scope: "vending",
    table: "certs", limit: 100 });
  const already = (existing.rows || []).some(r => r.agent_name === NAME);
  const r = await api.transact({ actions: [{
    account: "vending", name: already ? "update" : "mint",
    authorization: [{ actor: MEMBER_ACCT, permission: "active" }],
    data: already
      ? { agent_name: NAME, owner: MEMBER_ACCT, member_key: pubHex, ar_id: up.id, content_hash: hash }
      : { agent_name: NAME, owner: MEMBER_ACCT, member_key: pubHex,
          ar_id: up.id, content_hash: hash, templ: TEMPLATE, tongue: TONGUE },
  }]}, { blocksBehind: 3, expireSeconds: 60 });
  console.log("VAULTA POINTER ROW (" + (already ? "update" : "mint") + ", local rehearsal) tx=" + r.transaction_id);
}
console.log("MINT-DONE ar=" + up.id + " hash=" + hash.slice(0, 16) + "…");
