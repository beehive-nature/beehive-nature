// pauseproof.mjs — exercise pause-at-zero + paused-refusal + top-up + resume
// on session 42 (the meter ladder's pause-not-kill leg, inside the ceiling)
import eosjsPkg from "eosjs";
const { Api, JsonRpc } = eosjsPkg;
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";

const WIF = process.env.BNRAPOLL_WIF;
const rpc = new JsonRpc("https://jungle4.greymass.com", {});
const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([WIF]),
                      textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
const api2 = new Api({ rpc: new JsonRpc("https://jungle4.cryptolions.io", {}),
  signatureProvider: new JsSignatureProvider([WIF]),
  textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
const OPT = { blocksBehind: 3, expireSeconds: 300 };
const A = (name, data) => ({ account: "bnrapolltest", name,
  authorization: [{ actor: "bnrapolltest", permission: "active" }], data });
const run = async (tag, acts, refusal) => {
  try {
    const r = await (refusal ? api2 : api).transact({ actions: acts }, OPT);
    console.log(tag + ": OK tx=" + r.transaction_id);
  } catch (e) {
    console.log(tag + ": REFUSED" + (refusal ? " (expected)" : "") + " — " +
      (e.json?.error?.details?.[0]?.message || e.message).slice(0, 90));
  }
};
const read = async () => {
  await new Promise(r => setTimeout(r, 3500));
  const t = await rpc.get_table_rows({ json: true, code: "bnrapolltest",
    scope: "bnrapolltest", table: "sessions", limit: 100 });
  return t.rows.find(s => s.id === 42);
};

await run("charge 2 (burns to zero, PAUSES)", [A("charge", { sess: 42, units: 2 })]);
console.log("state:", JSON.stringify(await read()));
await run("charge 1 WHILE PAUSED", [A("charge", { sess: 42, units: 1 })], true);
await run("settle 2.0000 top-up WHILE PAUSED", [A("settle", { sess: 42, payer: "bnrapolltest", nonce: 420004, amount: "2.0000 A" })]);
console.log("state:", JSON.stringify(await read()));
await run("resume", [A("resume", { sess: 42 })]);
console.log("FINAL:", JSON.stringify(await read()));
