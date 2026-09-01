// fuel probe: can greymass fuel carry a cheap transfer for our CPU-dead account?
import eosjsPkg from "eosjs";
const { Api, JsonRpc } = eosjsPkg;
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";
const ACTIVE = process.env.BNRAPOLL_WIF;
const rpc = new JsonRpc("https://jungle4.greymass.com", {});
const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([ACTIVE]),
                      textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
try {
  const r = await api.transact({ actions: [{
    account: "eosio.token", name: "transfer",
    authorization: [{ actor: "bnrapolltest", permission: "active" }],
    data: { from: "bnrapolltest", to: "bnrapolltest", quantity: "0.0001 EOS",
            memo: "vending-cpu-probe (fuel test)" },
  }]}, { blocksBehind: 3, expireSeconds: 300 });
  console.log("FUEL-TRANSFER-OK tx=" + r.transaction_id + " cpu=" +
    (r.processed?.receipt?.cpu_usage_us ?? r.processed?.elapsed));
} catch (e) {
  console.error("FUEL-TRANSFER-REFUSED:", e.json?.error?.details?.[0]?.message || e.message);
}
// powerup presence check (read-only)
for (const t of ["state", "powers"]) {
  try {
    const res = await rpc.get_table_rows({ json: true, code: "eosio", scope: "eosio",
      table: t === "state" ? "powerup.state" : "powers", limit: 1 });
    console.log("powerup." + t + ":", JSON.stringify(res.rows).slice(0, 200));
  } catch (e) { console.log("powerup." + t + ": ABSENT"); }
}
