// TEST-ONLY provider fixtures, never network/storage acceptance evidence.
import { fixture, sourceGraph, reseal } from './fixtures.mjs';
import { bytesDigest } from './contract.mjs';
import { repositoryPrivacy } from './privacy.mjs';
export const privacy = repositoryPrivacy({ self: new Uint8Array(32).fill(22), credentials: { self: new Uint8Array(32).fill(22) } }); // TEST-ONLY
export function candidate(f) { return Object.fromEntries(['policy', 'manifest', 'proposal', 'signatures', 'evidence'].map(k => [k, f[k]])); }
export function bootstrap(f, ordering = { mode: 'local-shadow' }) { return { state: f.state, trusted_state_digest: f.trustedStateDigest, ordering }; }
export function competing() {
  const f = fixture(), graph = sourceGraph(f.state.head, 'competing update\n');
  f.manifest.source = graph.source; f.payloads = graph.payloads; return reseal(f);
}
export function memoryRail(scheme = 'ant') {
  const data = new Map(); let puts = 0, gets = 0;
  return { scheme, id: `TEST-ONLY:${scheme}`, data, get puts() { return puts; }, get gets() { return gets; },
    async put(bytes) { puts++; const d = bytesDigest(bytes).slice(7); const addr = scheme === 'ar' ? Buffer.from(d, 'hex').toString('base64url') : d; data.set(addr, Buffer.from(bytes)); return addr; },
    async get(addr) { gets++; if (!data.has(addr)) throw new Error('fixture unavailable'); return Buffer.from(data.get(addr)); },
  };
}
export const blockId = (height, tail = 'a') => height.toString(16).padStart(8, '0') + tail.repeat(32);
export const hiveOrdering = { mode: 'hive-shadow', account: 'repository-test', topic: bytesDigest(Buffer.from('TEST-ONLY random topic substitute')), nodes: ['https://one.example', 'https://two.example'], cursor: { height: 10, block_id: blockId(10) } };
export function block(height, ops = []) {
  return { block_id: blockId(height), previous: blockId(height - 1), transactions: ops.map(op => ({ operations: [op] })), transaction_ids: ops.map((_, i) => (i + 1).toString(16).padStart(40, '0')) };
}
export function chain(blocks, lib = 11) {
  return async (_node, method, params) => {
    if (method === 'condenser_api.get_dynamic_global_properties') return { last_irreversible_block_num: lib };
    if (method === 'condenser_api.get_block') return structuredClone(blocks.get(params[0]));
    throw new Error('unexpected method');
  };
}
