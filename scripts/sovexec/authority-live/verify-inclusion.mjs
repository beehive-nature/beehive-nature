// SOVEXEC-002 — block-level inclusion check for every transaction the probe
// pushed: the block the pushing node named is fetched from BOTH endpoints
// through /v1/chain/get_block (no history plugin involved), the transaction
// id must be in it, and the block must be at or below each node's last
// irreversible block. Results are written back into the receipt and the
// state journal; nothing is pushed, nothing is retried.
import { Rpc, ENDPOINTS } from '../../btungsten/wb004-live/rpc.mjs';
const MARKER = 'PUBLIC-CONSTANT: on-chain transaction ids, block ids and public keys of the Jungle4 testnet; no key material';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(HERE, 'state.json');
const RECEIPT_PATH = join(HERE, '..', '..', '..', 'docs', 'receipts', 'sovexec-002', 'receipt-authority-live.json');
const rpcs = { primary: new Rpc(ENDPOINTS.primary), secondary: new Rpc(ENDPOINTS.secondary) };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function lib(name) {
  const r = await rpcs[name].get_info();
  return r.ok ? r.body.last_irreversible_block_num : null;
}
async function inBlock(name, blockNum, txid) {
  const r = await rpcs[name].call('/v1/chain/get_block', { block_num_or_id: blockNum });
  if (!r.ok) return { fetched: false, why: (r.chainMessage || r.transportError || '').slice(0, 120) };
  const ids = (r.body.transactions || []).map((t) => (t.trx && t.trx.id) || t.trx).filter((x) => typeof x === 'string');
  return { fetched: true, included: ids.includes(txid), block_id: r.body.id, timestamp: r.body.timestamp };
}

const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
const libs = { primary: await lib('primary'), secondary: await lib('secondary') };
log('lib', JSON.stringify(libs));

const checks = [];
// the block number a push returns is the pushing node's SPECULATIVE block;
// the produced block that carries the transaction can be a few later, so
// the search walks forward from it (bounded) on the primary first
async function locate(txid, from) {
  for (let b = from; b < from + 24; b++) {
    const p = await inBlock('primary', b, txid);
    if (p.fetched && p.included) return b;
  }
  return null;
}

async function check(label, txid, blockAtPush) {
  const found = await locate(txid, blockAtPush);
  const blockNum = found === null ? blockAtPush : found;
  const p = await inBlock('primary', blockNum, txid);
  const s = await inBlock('secondary', blockNum, txid);
  const row = {
    label, txid, block_num_at_push: blockAtPush, block_num: blockNum, located: found !== null,
    primary: { ...p, irreversible: libs.primary !== null && blockNum <= libs.primary },
    secondary: { ...s, irreversible: libs.secondary !== null && blockNum <= libs.secondary },
  };
  row.included_both = !!(p.included && s.included && p.block_id === s.block_id);
  checks.push(row);
  log(label, row.included_both ? 'INCLUDED both nodes, block ' + blockNum + (row.primary.irreversible ? ' irreversible' : ' not yet irreversible') : 'NOT CONFIRMED ' + JSON.stringify({ p, s }).slice(0, 160));
  return row;
}

for (const [perm, rec] of Object.entries(state.perms)) {
  if (rec.txid && rec.blockNum) await check('updateauth:' + perm, rec.txid, rec.blockNum);
}
for (const p of receipt.pushes) {
  if (p.chain.accepted && p.chain.block_num_at_push) {
    const row = await check('push:' + p.id, p.chain.txid, p.chain.block_num_at_push);
    p.chain.included = row.included_both;
    p.chain.block_num = row.included_both ? row.block_num : null;
    p.chain.irreversible = row.primary.irreversible && row.secondary.irreversible;
    if (row.included_both) delete p.chain.note;
    p.done = p.done || row.included_both;
    if (state.pushes[p.id]) state.pushes[p.id] = p;
  }
}
receipt.inclusion = { at: new Date().toISOString(), lib: libs, checks };
// one line, marker first: the same shape probe.mjs writes (the hex law)
const oneLine = (obj) => JSON.stringify({ marker: obj.marker || MARKER, ...obj }) + '\n';
writeFileSync(RECEIPT_PATH, oneLine(receipt));
writeFileSync(STATE_PATH, oneLine(state));
const bad = checks.filter((c) => !c.included_both);
log('checked', checks.length, 'not confirmed', bad.length);
process.exit(bad.length ? 1 : 0);
