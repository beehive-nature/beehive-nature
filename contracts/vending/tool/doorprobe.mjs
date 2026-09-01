// door probe: try resource-acquiring actions through every live Jungle4 endpoint
// (fuel coverage differs per provider) + one powerup shot.
import eosjsPkg from "eosjs";
const { Api, JsonRpc } = eosjsPkg;
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";
const WIF = process.env.BNRAPOLL_WIF;
const OPT = { blocksBehind: 3, expireSeconds: 300 };

for (const host of ["https://jungle4.cryptolions.io", "https://jungle4.eosphere.io"]) {
  const rpc = new JsonRpc(host, {});
  const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([WIF]),
                        textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
  for (const [tag, act, data] of [
    ["delegatebw", "delegatebw", { from: "bnrapolltest", receiver: "bnrapolltest",
      stake_net_quantity: "1.0000 EOS", stake_cpu_quantity: "20.0000 EOS", transfer: false }],
    ["buyram", "buyram", { payer: "bnrapolltest", receiver: "bnrapolltest", quant: "20.0000 EOS" }],
    ["powerup", "powerup", { payer: "bnrapolltest", receiver: "bnrapolltest", days: 1,
      net_frac: 0, cpu_frac: 10000000, max_payment: "5.0000 EOS" }],
  ]) {
    try {
      const r = await api.transact({ actions: [{ account: "eosio", name: act === "powerup" && false ? "" : act,
        authorization: [{ actor: "bnrapolltest", permission: "active" }], data }] }, OPT);
      console.log(`${host} ${tag}: OK tx=${r.transaction_id}`);
      process.exit(0);
    } catch (e) {
      console.log(`${host} ${tag}: REFUSED ` +
        ((e.json?.error?.details?.[0]?.message || e.message || String(e)).slice(0, 130)));
    }
  }
}
console.log("ALL DOORS REFUSED");
