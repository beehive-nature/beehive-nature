// fuel test + deployer: push setcode/setabi through greymass (fuel may carry CPU)
// usage: node setcode.mjs <wasmPath> <abiPath>
import eosjsPkg from "eosjs";
const { Api, JsonRpc } = eosjsPkg;
import { JsSignatureProvider } from "eosjs/dist/eosjs-jssig.js";
import { readFileSync } from "node:fs";

const ACTIVE = process.env.BNRAPOLL_WIF;
const [wasmPath, abiPath] = process.argv.slice(2);
const rpc = new JsonRpc("https://jungle4.greymass.com", {});
const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([ACTIVE]),
                      textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
const wasm = readFileSync(wasmPath);
const abi = JSON.parse(readFileSync(abiPath, "utf8"));
const OPT = { blocksBehind: 3, expireSeconds: 600 };

try {
  const r = await api.transact({ actions: [{
    account: "eosio", name: "setcode",
    authorization: [{ actor: "bnrapolltest", permission: "active" }],
    data: { account: "bnrapolltest", vmtype: 0, vmversion: 0,
            code: wasm.toString("hex") },
  }]}, OPT);
  console.log("SETCODE-OK tx=" + r.transaction_id + " cpu_us=" +
    (r.processed?.receipt?.cpu_usage_us ?? r.processed?.elapsed));
} catch (e) {
  console.error("SETCODE-REFUSED:", e.json?.error?.details?.[0]?.message || e.message);
  process.exit(1);
}
try {
  const r2 = await api.transact({ actions: [{
    account: "eosio", name: "setabi",
    authorization: [{ actor: "bnrapolltest", permission: "active" }],
    data: { account: "bnrapolltest",
            abi: Buffer.from(JSON.stringify(abi), "utf8").toString("hex") },
  }]}, OPT);
  console.log("SETABI-OK tx=" + r2.transaction_id);
} catch (e) {
  console.error("SETABI-REFUSED:", e.json?.error?.details?.[0]?.message || e.message);
  process.exit(1);
}
