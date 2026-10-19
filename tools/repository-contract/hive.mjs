// Hive is an optional ordered witness, never a replacement for repository signatures.
// Reuse keychain-release's normalized operator identities and custom_json/LIB model.
import { normalizeNodes } from '../keychain-release/anchor.mjs';
import { canonicalDocument, parseDocument, need, record, list, hash, integer, oid } from './contract.mjs';
import { pointer, retrieveBundle } from './storage.mjs';

export const HIVE_ID = 'bnr.repository';
export function validateNotice(n) {
  record(n, ['schema', 'topic', 'bundle']);
  need(n.schema === 'bnr.repository-checkpoint/2', 'VERSION'); hash(n.topic); pointer(n.bundle);
  need(canonicalDocument(n).length <= 8192, 'RESOURCE_LIMIT'); return n;
}
export function hiveOperation(account, n) {
  need(typeof account === 'string' && /^[a-z][a-z0-9.-]{2,15}$/.test(account), 'HIVE_ACCOUNT');
  validateNotice(n);
  return ['custom_json', { required_auths: [], required_posting_auths: [account], id: HIVE_ID, json: canonicalDocument(n).toString() }];
}

export async function rpc(url, method, params) {
  const res = await fetch(url, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(20_000) });
  need(res.ok, 'RPC_UNAVAILABLE');
  const reader = res.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) { const r = await reader.read(); if (r.done) break; size += r.value.length; need(size <= 8 * 1024 * 1024, 'RESOURCE_LIMIT'); chunks.push(r.value); }
  } finally { await reader.cancel(); }
  const j = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  need(j.id === 1 && !j.error && j.result != null, 'RPC_UNAVAILABLE'); return j.result;
}
export function blockView(raw, height) {
  oid(raw.block_id); oid(raw.previous); integer(height, 1);
  need(Number.parseInt(raw.block_id.slice(0, 8), 16) === height, 'BLOCK_HEIGHT');
  list(raw.transactions, 0, 100_000); list(raw.transaction_ids, 0, 100_000);
  need(raw.transactions.length === raw.transaction_ids.length, 'BLOCK_SHAPE');
  raw.transaction_ids.forEach(oid); need(new Set(raw.transaction_ids).size === raw.transaction_ids.length, 'DUPLICATE');
  const transactions = raw.transactions.map(t => { list(t.operations, 1); return t.operations; });
  // Compare every transaction's operations, not just matching notices; an RPC
  // cannot silently omit an earlier competing proposal from an agreeing view.
  return { height, block_id: raw.block_id, previous: raw.previous, transaction_ids: raw.transaction_ids, transactions };
}
async function agreedBlock(nodes, height, call) {
  const views = await Promise.all(nodes.map(async n => blockView(await call(n, 'condenser_api.get_block', [height]), height)));
  const first = canonicalDocument(views[0]);
  need(views.every(v => canonicalDocument(v).equals(first)), 'ORACLE_DIVERGENCE'); return views[0];
}

export async function syncHiveBlock({ store, rails, maxBytes, privacy, call = rpc }) {
  const ordering = store.bootstrap.ordering; need(ordering.mode === 'hive-shadow', 'ORDERING'); integer(maxBytes, 1);
  const nodes = normalizeNodes(ordering.nodes); need(nodes.length >= 2, 'ORACLES');
  const current = store.current(), cursor = current.cursor;
  const libs = await Promise.all(nodes.map(async n => {
    const p = await call(n, 'condenser_api.get_dynamic_global_properties', []);
    integer(p.last_irreversible_block_num, 1); return p.last_irreversible_block_num;
  }));
  need(libs.every(n => n >= cursor.height), 'FINALITY_REGRESSION');
  const previous = await agreedBlock(nodes, cursor.height, call);
  need(previous.block_id === cursor.block_id, 'FINALIZED_FORK');
  if (Math.min(...libs) === cursor.height) return { waiting: true, mode: 'hive-shadow', cursor };
  const block = await agreedBlock(nodes, cursor.height + 1, call);
  need(block.previous === cursor.block_id, 'CHAIN_GAP');
  const prepared = [];
  for (let transaction = 0; transaction < block.transactions.length; transaction++) {
    const ops = block.transactions[transaction];
    for (let operation = 0; operation < ops.length; operation++) {
      const op = ops[operation], v = op?.[1];
      if (op?.[0] !== 'custom_json' || v?.id !== HIVE_ID || !Array.isArray(v.required_auths) || v.required_auths.length ||
          !Array.isArray(v.required_posting_auths) || v.required_posting_auths.length !== 1 || v.required_posting_auths[0] !== ordering.account) continue;
      const item = { transaction, operation }; let n;
      try { need(typeof v.json === 'string' && Buffer.byteLength(v.json) <= 8192, 'RESOURCE_LIMIT'); n = validateNotice(parseDocument(Buffer.from(v.json))); }
      catch { prepared.push({ ...item, refusal: 'NOTICE_MALFORMED' }); continue; }
      if (n.topic !== ordering.topic) continue;
      // All bytes are fetched before advancing this block. Missing/corrupt
      // storage is UNKNOWN, not an invalid vote which a later vote can overtake.
      const { candidate, payloads } = await retrieveBundle(n.bundle, { store, rails, maxBytes, privacy });
      if (candidate.proposal.repository !== current.state.repository || candidate.proposal.ref !== current.state.ref) prepared.push({ ...item, refusal: 'NOTICE_BINDING' });
      else prepared.push({ ...item, candidate, payloads });
    }
  }
  const receipt = { schema: 'bnr.repository-hive-observation/1', nodes, irreversible_heights: libs, block,
    trust: 'configured RPC agreement; not a light-client consensus proof', authority: 'shadow; GitHub stage one unchanged' };
  return store.applyHiveBlock({ expectedCursor: cursor, block, prepared, receipt });
}
