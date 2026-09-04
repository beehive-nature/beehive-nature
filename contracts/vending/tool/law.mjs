// law.mjs — write the vending contract's law rows on the target chain:
//   init(admin, max_certs) + setrate(vaulta, 0.6000 A) + settithe(1000bp -> kingbeelovis)
// usage: node law.mjs [local|jungle4]
import eosjsPkg from "eosjs";
const { Api, JsonRpc } = eosjsPkg;
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";
import { execSync } from "node:child_process";

const TARGET = process.argv[2] || "local";
const RPC = TARGET === "jungle4" ? "https://jungle4.greymass.com" : "http://127.0.0.1:8888";
const CONTRACT = TARGET === "jungle4" ? "bnrapolltest" : "vending";
const ADMIN = "bnrapolltest";
const WIF = TARGET === "jungle4"
  ? process.env.BNRAPOLL_WIF
  : execSync(`wsl -e bash -lc "cat ~/vchain/member.key"`).toString().trim();

const rpc = new JsonRpc(RPC, {});
const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([WIF]),
                      textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
const OPT = { blocksBehind: 3, expireSeconds: 300 };
const run = async (tag, actions) => {
  try {
    const r = await api.transact({ actions }, OPT);
    console.log(tag + ": OK tx=" + r.transaction_id);
    return r.transaction_id;
  } catch (e) {
    console.log(tag + ": REFUSED — " + (e.json?.error?.details?.[0]?.message || e.message).slice(0, 160));
    process.exit(1);
  }
};

await run("init", [{ account: CONTRACT, name: "init",
  authorization: [{ actor: CONTRACT, permission: "active" }],
  data: { admin: ADMIN, max_certs: 7776 } }]);
await run("setrate", [{ account: CONTRACT, name: "setrate",
  authorization: [{ actor: ADMIN, permission: "active" }],
  data: { rail: "vaulta", basis: "0.6000 A",
          label: "the b-meter basis, per call, founder-word law" } }]);
await run("settithe", [{ account: CONTRACT, name: "settithe",
  authorization: [{ actor: ADMIN, permission: "active" }],
  data: { percent_bp: 1000, destination: "kingbeelovis" } }]);

const rates = await rpc.get_table_rows({ json: true, code: CONTRACT, scope: CONTRACT, table: "rates", limit: 10 });
const tithe = await rpc.get_table_rows({ json: true, code: CONTRACT, scope: CONTRACT, table: "tithe", limit: 1 });
console.log("rates:", JSON.stringify(rates.rows));
console.log("tithe:", JSON.stringify(tithe.rows));
