// meter.mjs — WATCH-ROOM session ops on the box (POC 2026-09-04).
// The payer/customer side of the jungle4 meter (contract bnrapolltest,
// SPEC-VENDING-1 §x402): open a session with credit, charge units while
// watching, top up while paused, resume. The DOOR never runs this — the
// door only reads. This tool is the consumption side, run by the operator
// (or the e2e harness over ssh); the key stays on the box, mode 600.
//
// usage (on the box, from /opt/buzz-watch):
//   node meter.mjs open   <sess> <creditA> <ceilingA>   opensess + settle
//   node meter.mjs charge <sess> <units>                 burn credit
//   node meter.mjs topup  <sess> <amountA>               settle while paused
//   node meter.mjs resume <sess>                         ACTIVE again
//   node meter.mjs status <sess>                         the chain row
// Ladder shape lifted from contracts/vending/tool/meter.mjs (the x402
// receipt ladder, session 42) — one action per call here, exit code 1 on
// refusal, so the e2e can assert each rung.
import eosjsPkg from 'eosjs';
const { Api, JsonRpc } = eosjsPkg;
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig.js';
import { readFileSync } from 'node:fs';

const RPC = process.env.RPC || 'https://jungle4.greymass.com';
const RPC2 = process.env.RPC2 || 'https://jungle4.cryptolions.io'; // refusal probes: never share the RPC with the original (cache trap, banked)
const CONTRACT = process.env.CONTRACT || 'bnrapolltest';
const OWNER = process.env.OWNER || 'bnrapolltest';
const AGENT = process.env.AGENT || 'watch-poc';
const KEY_FILE = process.env.KEY_FILE || '/etc/buzz-watch/bnrapolltest.active.wif';
const WIF = readFileSync(KEY_FILE, 'utf8').trim();

const rpc = new JsonRpc(RPC, {});
const mk = (host) => new Api({ rpc: new JsonRpc(host, {}),
  signatureProvider: new JsSignatureProvider([WIF]),
  textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
const api = mk(RPC);
const OPT = { blocksBehind: 3, expireSeconds: 300 };
const nonce = () => Number(Date.now() + String(process.pid % 1000)); // unique per run

const [cmd, ...a] = process.argv.slice(2);
const S = Number(a[0]);
const act = (name, data) => api.transact({ actions: [{ account: CONTRACT, name,
  authorization: [{ actor: OWNER, permission: 'active' }], data }] }, OPT);

const status = async () => {
  const rows = (await rpc.get_table_rows({ json: true, code: CONTRACT, scope: CONTRACT,
    table: 'sessions', limit: 200 })).rows;
  const row = rows.find(r => Number(r.id) === S);
  console.log(row ? JSON.stringify(row) : 'NO SESSION ' + S);
  return row;
};

try {
  if (cmd === 'open') {
    const [credit, ceiling] = [a[1], a[2]];
    let r = await act('opensess', { sess: S, owner: OWNER, agent_name: AGENT, rail: 'vaulta', ceiling: `${Number(ceiling).toFixed(4)} A` });
    console.log('opensess OK', r.transaction_id);
    r = await act('settle', { sess: S, payer: OWNER, nonce: nonce(), amount: `${Number(credit).toFixed(4)} A` });
    console.log('settle OK', r.transaction_id);
  } else if (cmd === 'charge') {
    const r = await act('charge', { sess: S, units: Number(a[1]) });
    console.log('charge OK', r.transaction_id);
  } else if (cmd === 'topup') {
    const r = await act('settle', { sess: S, payer: OWNER, nonce: nonce(), amount: `${Number(a[1]).toFixed(4)} A` });
    console.log('settle OK', r.transaction_id);
  } else if (cmd === 'resume') {
    const r = await act('resume', { sess: S });
    console.log('resume OK', r.transaction_id);
  } else if (cmd === 'status') {
    await status();
  } else {
    console.log('usage: meter.mjs open|charge|topup|resume|status <sess> [args]');
    process.exit(2);
  }
} catch (e) {
  const msg = (e.json?.error?.details?.[0]?.message || e.message || '').replace(/^assertion failure with message: /, '').slice(0, 140);
  console.log('REFUSED —', msg);
  process.exit(1);
}
