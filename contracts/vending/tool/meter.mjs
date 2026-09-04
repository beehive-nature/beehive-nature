// meter.mjs — ONE METERED SESSION on the vending contract (SPEC-VENDING-1 §x402):
//   open (ceiling signed once) → settle ZERO (nonce burns anyway) → settle
//   REPLAY (refused) → settle real credit → charge → charge past balance
//   (PAUSE AT ZERO, committed — pause-not-kill) → charge under pause
//   (refused) → top-up while paused → resume → charge to the ceiling edge →
//   over-ceiling (refused). The event log is kept for the pure audit.
// usage: node meter.mjs [jungle4|local]
import eosjsPkg from "eosjs";
const { Api, JsonRpc } = eosjsPkg;
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const TARGET = process.argv[2] || "jungle4";
const RPC = TARGET === "jungle4" ? "https://jungle4.greymass.com" : "http://127.0.0.1:8888";
const CONTRACT = TARGET === "jungle4" ? "bnrapolltest" : "vending";
const OWNER = "bnrapolltest";
const WIF = TARGET === "jungle4" ? process.env.BNRAPOLL_WIF
  : execSync(`wsl -e bash -lc "cat ~/vchain/member.key"`).toString().trim();
const rpc = new JsonRpc(RPC, {});
const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([WIF]),
                      textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
// refusal probes go through the OTHER host so the RPC can't serve a cached
// response for identical action bytes (a same-txid "OK" is a cache artifact,
// not an execution — trap banked during the first ladder run)
const RPC2 = TARGET === "jungle4" ? "https://jungle4.cryptolions.io" : RPC;
const api2 = new Api({ rpc: new JsonRpc(RPC2, {}),
  signatureProvider: new JsSignatureProvider([WIF]),
  textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
const OPT = { blocksBehind: 3, expireSeconds: 300 };
const SESS = 42;
const LOG = "meter-events-42.json";

const events = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : [];
const now = () => new Date().toISOString();
const txs = [];
const run = async (tag, name, data, expectRefusal = false) => {
  const sender = expectRefusal ? api2 : api;
  try {
    const r = await sender.transact({ actions: [{ account: CONTRACT, name,
      authorization: [{ actor: OWNER, permission: "active" }], data }] }, OPT);
    txs.push({ tag, tx: r.transaction_id, action: name });
    console.log(tag + ": OK tx=" + r.transaction_id);
    events.push({ kind: name, at: now(), ...data, tx: r.transaction_id });
    return { ok: true };
  } catch (e) {
    const msg = (e.json?.error?.details?.[0]?.message || e.message || "").replace(/^assertion failure with message: /, "").slice(0, 100);
    console.log(tag + ": " + (expectRefusal ? "REFUSED (expected) — " : "REFUSED — ") + msg);
    events.push({ tag, kind: name + "_refused", at: now(), ...data, refusal: msg });
    return { ok: false, msg };
  }
};

// the ladder
await run("opensess(ceiling 5 A, signed once)", "opensess",
  { sess: SESS, owner: OWNER, agent_name: "vendingtest2", rail: "vaulta", ceiling: "5.0000 A" });
await run("settle ZERO (nonce must burn anyway)", "settle",
  { sess: SESS, payer: OWNER, nonce: 420001, amount: "0.0000 A" });
const replay = await run("settle REPLAY same nonce", "settle",
  { sess: SESS, payer: OWNER, nonce: 420001, amount: "0.0000 A" }, true);
if (replay.ok) { console.log("REPLAY ACCEPTED — CONTRACT BUG, abort"); process.exit(1); }
await run("settle 3.0000 A (the real credit)", "settle",
  { sess: SESS, payer: OWNER, nonce: 420002, amount: "3.0000 A" });
await run("charge 2 units (0.6 × 2 = 1.2)", "charge", { sess: SESS, units: 2 });
await run("charge 1000 units (burns to zero, PAUSES)", "charge", { sess: SESS, units: 1000 });
const paused = (await rpc.get_table_rows({ json: true, code: CONTRACT, scope: CONTRACT,
  table: "sessions", limit: 100 })).rows.find(s => s.id === SESS);
console.log("session state now:", JSON.stringify({ state: paused?.state, credit: paused?.credit, burned: paused?.burned }));
await run("charge 1 unit WHILE PAUSED (must refuse)", "charge", { sess: SESS, units: 1 }, true);
await run("settle 2.0000 A top-up WHILE PAUSED (pause-not-kill: it lives)", "settle",
  { sess: SESS, payer: OWNER, nonce: 420003, amount: "2.0000 A" });
await run("resume", "resume", { sess: SESS });
await run("charge 3 units (1.8; burned → 3.0 ≤ ceiling)", "charge", { sess: SESS, units: 3 });
await run("charge 4 units (would pass ceiling 5 — refused)", "charge", { sess: SESS, units: 4 }, true);

const final = (await rpc.get_table_rows({ json: true, code: CONTRACT, scope: CONTRACT,
  table: "sessions", limit: 100 })).rows.find(s => s.id === SESS);
const nonces = (await rpc.get_table_rows({ json: true, code: CONTRACT, scope: CONTRACT,
  table: "nonces", limit: 100 })).rows.filter(n => n.session === SESS);
console.log("FINAL session:", JSON.stringify(final));
console.log("nonce rows (burned):", JSON.stringify(nonces));
writeFileSync(LOG, JSON.stringify(events, null, 2));
writeFileSync("meter-txs-42.json", JSON.stringify({ sess: SESS, txs, final, nonces }, null, 2));
console.log("METER-LADDER-DONE");
