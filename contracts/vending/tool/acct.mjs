// vending lane — Jungle4 account prep for bnrapolltest (TESTNET-ONLY key, Lane 2 throwaway)
// fixes the exhausted CPU limit and buys RAM for the contract deploy + law rows.
// usage: node acct.mjs <delegatebw|buyram|status>
import eosjsPkg from "eosjs";
const { Api, JsonRpc } = eosjsPkg;
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";

const ACTIVE = process.env.BNRAPOLL_WIF;
if (!ACTIVE) { console.error("missing BNRAPOLL_WIF env"); process.exit(1); }
const rpc = new JsonRpc("https://jungle4.greymass.com", {});
const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([ACTIVE]),
                      textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
const ACCT = "bnrapolltest";
const OPT = { blocksBehind: 3, expireSeconds: 300 };

const cmd = process.argv[2] || "status";
if (cmd === "status") {
  const a = await rpc.get_account(ACCT);
  console.log(JSON.stringify({
    cpu: a.cpu_limit, net: a.net_limit, ram_quota: a.ram_quota, ram_usage: a.ram_usage,
    liquid: a.core_liquid_balance,
  }, null, 2));
} else if (cmd === "delegatebw") {
  const r = await api.transact({ actions: [{
    account: "eosio", name: "delegatebw",
    authorization: [{ actor: ACCT, permission: "active" }],
    data: { from: ACCT, receiver: ACCT,
            stake_net_quantity: "1.0000 EOS", stake_cpu_quantity: "20.0000 EOS",
            transfer: false },
  }]}, OPT);
  console.log("delegatebw OK tx=" + r.transaction_id);
} else if (cmd === "buyram") {
  const amt = process.argv[3] || "40.0000 EOS";
  const r = await api.transact({ actions: [{
    account: "eosio", name: "buyram",
    authorization: [{ actor: ACCT, permission: "active" }],
    data: { payer: ACCT, receiver: ACCT, quant: amt },
  }]}, OPT);
  console.log("buyram OK tx=" + r.transaction_id);
}
