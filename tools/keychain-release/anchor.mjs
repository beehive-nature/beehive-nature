#!/usr/bin/env node
// anchor.mjs — Hive witness anchors for keychain release records (custom_json id bnr.anchor).
//
//   build --record R --sig S --prev-json FILE --seq N [--loc L]... [--out FILE]
//       the canonical ASCII anchor json A and the full custom_json op (posting auth loviswater);
//       FILE holds the exact previous bnr.anchor json string (first release: the genesis, as
//       `genesis --out` writes it); --out writes A's exact bytes
//   verify [--account loviswater] [--subject keys.skaists.dev] [--nodes url,...] [--record R --sig S]
//       quorum read of every bnr.anchor op on the account, a class per anchor and for the release
//   genesis [--nodes url,...] [--out FILE]
//       read the genesis anchor (block 108404167) from every node and print the SHA3-256 (b64u) of
//       its json string; --out writes those exact bytes, only when two operators agree
//
// An anchor witnesses that a record existed, and in what order; it authorizes nothing. It is
// classical (Hive's secp256k1 posting key), so its class is REPORTED and never a serving gate.
// Classes: ANCHORED-TERMINAL (>= 2 operators return the same block, trx and json bytes, at or
// below their last irreversible block, and the block itself carries the op), ANCHORED-AS-REPORTED
// (one operator), SIGNED-UNANCHORED (the release's signature verifies and no anchor names it),
// DIVERGENT (operators, or one operator's two read paths, disagree; or an operator past the block
// in irreversible history omits it), INCONCLUSIVE (nothing irreversible to count yet).
// Read paths as the July receipt measured them (DISPATCH-RECEIPTS-2026-07-24.md:293-346):
// condenser_api.* takes positional params and account_history_api.* named ones; the custom_json id
// is filtered client-side; never bridge.* (HiveMind is a second layer, not consensus).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BPQ, b64u, canon, checkIdentity, cli, fields, isCount, isDigest, isId, parseRecord, parseStrict, readSig, sha256, sha3 } from './release.mjs';

export const GENESIS = Object.freeze({ block: 108404167, trx: '7d404d75b82ac38fc5b27b1dd4cf2727c9c583b8', size: 620 });
export const NODES = ['https://api.hive.blog', 'https://api.openhive.network', 'https://api.deathwing.me', 'https://techcoderx.com'];
export const ACCOUNT = 'loviswater', SUBJECT = 'keys.skaists.dev', ANCHOR_ID = 'bnr.anchor';
const CUSTOM_JSON = 262144;   // operation_filter_low bit 18, custom_json_operation (receipt :316-318)
const JSON_MAX = 8192;        // Hive's custom_json json limit (HIVE_CUSTOM_OP_DATA_MAX_LENGTH)

// ── the anchor (contract §5) ─────────────────────────────────────────────
const ANCHOR = ['loc', 'prev', 'rec', 'seq', 'sig', 'subject', 'type', 'v'];
export function parseAnchor(bytes) {
  const a = fields(parseStrict(bytes), ANCHOR, 'anchor');
  if (a.v !== 1 || a.type !== 'release') throw new Error('anchor is not v 1, type "release"');
  if (!Array.isArray(a.loc) || a.loc.some(l => typeof l !== 'string' || !l) || new Set(a.loc).size !== a.loc.length) throw new Error('anchor.loc must be distinct non-empty strings');
  if (!isDigest(a.prev)) throw new Error('anchor.prev is not a base64url SHA3-256 digest');
  fields(a.rec, ['sha256', 'sha3', 'size'], 'anchor.rec');
  if (!isDigest(a.rec.sha256) || !isDigest(a.rec.sha3) || !isCount(a.rec.size)) throw new Error('anchor.rec must carry sha256, sha3 (base64url) and size');
  if (!Number.isSafeInteger(a.seq) || a.seq < 1) throw new Error('anchor.seq must be an integer >= 1');
  fields(a.sig, ['bpq', 'sha3'], 'anchor.sig');
  if (!isId(a.sig.bpq) || !isDigest(a.sig.sha3)) throw new Error('anchor.sig must carry a bzpq1 id and the sha3 of the signature file');
  if (typeof a.subject !== 'string' || !a.subject) throw new Error('anchor.subject must be a non-empty string');
  if (bytes.length > JSON_MAX) throw new Error(`anchor json is ${bytes.length} bytes, over Hive's ${JSON_MAX}`);
  return a;
}
export function anchorJson({ loc, prev, rec, seq, sig, subject = SUBJECT }) {
  const s = canon({ loc, prev, rec, seq, sig, subject, type: 'release', v: 1 });
  parseAnchor(Buffer.from(s, 'latin1'));
  return s;
}

export function buildAnchor({ recordBytes, sigBytes, prevJson, seq, loc = [] }) {
  checkIdentity(parseRecord(recordBytes));
  const v = BPQ.verifyFile(readSig(sigBytes), new Uint8Array(recordBytes));
  if (!v.ok) throw new Error(`the signature is not over this record: ${v.why}`);
  if (/[\r\n]$/.test(prevJson.toString('latin1'))) throw new Error('--prev-json ends in a newline; an anchor json string on chain has none (write it with genesis --out)');
  let p;
  try { p = JSON.parse(prevJson.toString('utf8')); } catch { throw new Error('--prev-json is not JSON'); }
  if (!p || !Number.isSafeInteger(p.seq) || p.seq < 0) throw new Error('--prev-json carries no integer seq');
  if (!Number.isSafeInteger(seq) || seq !== p.seq + 1) throw new Error(`--seq ${seq} does not follow the previous anchor's seq ${p.seq}`);
  const json = anchorJson({
    loc, prev: b64u(sha3(prevJson)), seq,
    rec: { sha256: b64u(sha256(recordBytes)), sha3: b64u(sha3(recordBytes)), size: recordBytes.length },
    sig: { bpq: v.id, sha3: b64u(sha3(sigBytes)) }
  });
  return { json, op: ['custom_json', { required_auths: [], required_posting_auths: [ACCOUNT], id: ANCHOR_ID, json }] };
}

// ── reading Hive ─────────────────────────────────────────────────────────
async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message || JSON.stringify(j.error)}`);
  if (j.result == null) throw new Error(`${method}: empty result`);
  return j.result;
}
async function lastIrreversible(url) {
  const n = (await rpc(url, 'condenser_api.get_dynamic_global_properties', [])).last_irreversible_block_num;
  if (!Number.isSafeInteger(n)) throw new Error('no last_irreversible_block_num');
  return n;
}
const postedBy = (v, account) => Array.isArray(v.required_posting_auths) && v.required_posting_auths.length === 1 &&
  v.required_posting_auths[0] === account && (!v.required_auths || !v.required_auths.length) && typeof v.json === 'string';

async function anchorsOf(url, account) {
  const ops = new Map();
  let start = -1;
  for (let page = 0; page < 100; page++) {
    const limit = start < 0 ? 1000 : Math.min(1000, start + 1);
    const h = (await rpc(url, 'account_history_api.get_account_history', { account, start, limit, include_reversible: true, operation_filter_low: CUSTOM_JSON })).history;
    if (!Array.isArray(h)) throw new Error('account history carries no history array');
    for (const [, x] of h) {
      const v = x && x.op && x.op.type === 'custom_json_operation' ? x.op.value : null;
      if (v && v.id === ANCHOR_ID && postedBy(v, account)) ops.set(`${x.trx_id}:${x.op_in_trx}`, { block: x.block, trx: x.trx_id, op_in_trx: x.op_in_trx, json: v.json });
    }
    const lowest = Math.min(...h.map(e => e[0]));
    if (h.length < limit || lowest <= 0) return ops;
    start = lowest - 1;
  }
  throw new Error('over 100 pages of custom_json history; refusing to guess');
}
// The second read path on the same operator: the block itself must carry the op, byte for byte.
async function inBlock(url, a) {
  const ops = await rpc(url, 'condenser_api.get_ops_in_block', [a.block, false]);
  return ops.some(o => o.trx_id === a.trx && o.op_in_trx === a.op_in_trx && Array.isArray(o.op) && o.op[0] === 'custom_json' &&
    o.op[1] && o.op[1].id === ANCHOR_ID && o.op[1].json === a.json);
}
export async function readNodes(nodes, account) {
  return Promise.all(nodes.map(async url => {
    try {
      const lib = await lastIrreversible(url);   // first: every op at or below it is already history
      return { url, ok: true, lib, ops: await anchorsOf(url, account) };
    } catch (e) { return { url, ok: false, error: e.message }; }
  }));
}

// ── classes ──────────────────────────────────────────────────────────────
const RANK = ['ANCHORED-TERMINAL', 'ANCHORED-AS-REPORTED', 'INCONCLUSIVE', 'DIVERGENT'];
async function classify(views, key, confirm) {
  const live = views.filter(v => v.ok), reporters = live.filter(v => v.ops.has(key));
  const first = reporters[0].ops.get(key), out = { key, block: first.block, trx: first.trx, op_in_trx: first.op_in_trx, json: null, operators: reporters.length, confirmed: 0 };
  if (new Set(reporters.map(v => `${v.ops.get(key).block}\n${v.ops.get(key).json}`)).size > 1) return { ...out, class: 'DIVERGENT', why: 'operators return different bytes for this op' };
  out.json = first.json;
  const omit = live.filter(v => !v.ops.has(key) && v.lib >= first.block).map(v => v.url);
  if (omit.length) return { ...out, class: 'DIVERGENT', why: `irreversible history at ${omit.join(', ')} omits it` };
  for (const v of reporters.filter(r => first.block <= r.lib)) {
    let c = null;
    try { c = await confirm(v.url, first); } catch { c = null; }
    if (c === false) return { ...out, class: 'DIVERGENT', why: `${v.url}: account history lists it, block ${first.block} does not carry it` };
    if (c) out.confirmed++;
  }
  return { ...out, class: out.confirmed >= 2 ? RANK[0] : out.confirmed === 1 ? RANK[1] : RANK[2] };
}
const brief = a => a && { ...(a.anchor ? { seq: a.anchor.seq } : {}), block: a.block, trx: a.trx, class: a.class, ...(a.why ? { why: a.why } : {}) };

// views: per operator {url, ok, lib, ops: Map(trx:op_in_trx -> {block, trx, op_in_trx, json})};
// confirm(url, op) -> true | false | null (unknown). The chain is genesis, then the subject's
// release anchors linked by prev (sha3 of the previous json) and seq (previous seq + 1).
export async function assess(views, confirm, { subject = SUBJECT, recordBytes, sigBytes } = {}) {
  const live = views.filter(v => v.ok);
  const anchors = [];
  for (const key of new Set(live.flatMap(v => [...v.ops.keys()]))) anchors.push(await classify(views, key, confirm));
  const genesis = anchors.find(a => a.trx === GENESIS.trx && a.block === GENESIS.block) || null;
  const releases = [], malformed = [];
  let other = 0;
  for (const a of anchors) {
    let j = null;
    try { j = a.json === null ? null : JSON.parse(a.json); } catch { j = null; }
    if (!j || j.subject !== subject) { if (a !== genesis) other++; continue; }
    try { releases.push({ ...a, anchor: parseAnchor(Buffer.from(a.json, 'utf8')) }); } catch (e) { malformed.push({ block: a.block, trx: a.trx, why: e.message }); }
  }
  const chain = [], used = new Set();
  let cur = genesis && genesis.class !== 'DIVERGENT' ? genesis.json : null, seq = 0, fork = null;
  while (cur !== null) {
    const want = b64u(sha3(Buffer.from(cur, 'utf8'))), next = releases.filter(a => a.anchor.prev === want && a.anchor.seq === seq + 1);
    if (!next.length) break;
    if (new Set(next.map(a => a.json)).size > 1) { fork = { seq: seq + 1, anchors: next.map(brief) }; break; }
    next.sort((x, y) => x.block - y.block);   // the same json posted again is a repeat; the earliest is the anchor
    next.forEach(a => used.add(a.key));
    chain.push(next[0]); cur = next[0].json; seq++;
  }
  const out = {
    subject, operators: views.map(v => (v.ok ? { url: v.url, ok: true, lib: v.lib, anchors: v.ops.size } : { url: v.url, ok: false, error: v.error })),
    genesis: genesis ? { block: genesis.block, trx: genesis.trx, class: genesis.class, ...(genesis.json !== null ? { size: Buffer.byteLength(genesis.json), sha3: b64u(sha3(Buffer.from(genesis.json, 'utf8'))) } : {}) } : null,
    chain: chain.map(a => ({ ...brief(a), rec_sha3: a.anchor.rec.sha3, signer: a.anchor.sig.bpq })),
    fork, orphans: releases.filter(a => !used.has(a.key)).map(brief), malformed, other_anchors: other,
    divergent: anchors.filter(a => a.json === null).map(brief),
    head: chain.length ? brief(chain[chain.length - 1]) : null
  };
  if (recordBytes) {
    checkIdentity(parseRecord(recordBytes));
    const v = BPQ.verifyFile(readSig(sigBytes), new Uint8Array(recordBytes));
    if (!v.ok) throw new Error(`the signature is not over this record: ${v.why}`);
    const rec = { sha256: b64u(sha256(recordBytes)), sha3: b64u(sha3(recordBytes)), size: recordBytes.length };
    const hits = releases.filter(a => a.anchor.rec.sha3 === rec.sha3 && a.anchor.rec.sha256 === rec.sha256 && a.anchor.rec.size === rec.size)
      .sort((x, y) => (used.has(y.key) - used.has(x.key)) || RANK.indexOf(x.class) - RANK.indexOf(y.class));
    out.release = hits.length
      ? { sha3: rec.sha3, signer: v.id, class: hits[0].class, on_chain: used.has(hits[0].key), anchor: brief(hits[0]) }
      // no anchor names it: unanchored only if two operators answered and none returned bytes in dispute
      : { sha3: rec.sha3, signer: v.id, class: live.length < 2 ? 'INCONCLUSIVE' : anchors.some(a => a.json === null) ? 'DIVERGENT' : 'SIGNED-UNANCHORED', anchor: null };
  }
  return out;
}

export async function readGenesis(nodes) {
  const views = await Promise.all(nodes.map(async url => {
    try {
      const lib = await lastIrreversible(url);
      const hits = (await rpc(url, 'condenser_api.get_ops_in_block', [GENESIS.block, false]))
        .filter(o => o.trx_id === GENESIS.trx && Array.isArray(o.op) && o.op[0] === 'custom_json' && o.op[1] && o.op[1].id === ANCHOR_ID);
      if (hits.length !== 1) throw new Error(`${hits.length} bnr.anchor ops in trx ${GENESIS.trx}`);
      if (!postedBy(hits[0].op[1], ACCOUNT)) throw new Error(`the genesis op is not posted by ${ACCOUNT} alone`);
      const json = Buffer.from(hits[0].op[1].json, 'utf8');
      return { url, ok: true, lib, irreversible: GENESIS.block <= lib, size: json.length, sha3: b64u(sha3(json)), json };
    } catch (e) { return { url, ok: false, error: e.message }; }
  }));
  const live = views.filter(v => v.ok), final = live.filter(v => v.irreversible);
  const distinct = new Set(live.map(v => v.sha3));
  const agree = distinct.size === 1 ? final.length : 0;
  const cls = distinct.size > 1 ? 'DIVERGENT' : agree >= 2 ? 'ANCHORED-TERMINAL' : agree === 1 ? 'ANCHORED-AS-REPORTED' : 'INCONCLUSIVE';
  const one = distinct.size === 1 ? live[0] : null;
  return {
    block: GENESIS.block, trx: GENESIS.trx, class: cls, agree,
    size: one ? one.size : null, size_matches_contract: one ? one.size === GENESIS.size : false, sha3: one ? one.sha3 : null,
    operators: views.map(({ json, ...v }) => v), json: one ? one.json : null
  };
}

// ── command line ─────────────────────────────────────────────────────────
const nodesOf = o => (o.nodes ? o.nodes.split(',').map(s => s.trim()).filter(Boolean) : NODES);
const COMMANDS = {
  build: [{ value: ['record', 'sig', 'prev-json', 'seq', 'out'], list: ['loc'] }, o => {
    for (const k of ['record', 'sig', 'prev-json', 'seq']) if (o[k] === undefined) throw new Error(`--${k} is required`);
    if (!/^[1-9][0-9]*$/.test(o.seq)) throw new Error('--seq must be an integer >= 1');
    const { json, op } = buildAnchor({ recordBytes: readFileSync(o.record), sigBytes: readFileSync(o.sig), prevJson: readFileSync(o['prev-json']), seq: Number(o.seq), loc: o.loc || [] });
    if (o.out) writeFileSync(o.out, json);
    return { json, size: json.length, sha3: b64u(sha3(Buffer.from(json, 'latin1'))), op };
  }],
  verify: [{ value: ['account', 'subject', 'nodes', 'record', 'sig'] }, async o => {
    if (!o.record !== !o.sig) throw new Error('--record and --sig go together');
    const account = o.account || ACCOUNT, nodes = nodesOf(o);
    const views = await readNodes(nodes, account);
    return { account, ...(await assess(views, inBlock, { subject: o.subject || SUBJECT, recordBytes: o.record && readFileSync(o.record), sigBytes: o.sig && readFileSync(o.sig) })) };
  }],
  genesis: [{ value: ['nodes', 'out'] }, async o => {
    const { json, ...g } = await readGenesis(nodesOf(o));
    const good = g.class === 'ANCHORED-TERMINAL' && g.size_matches_contract;
    if (good && o.out) writeFileSync(o.out, json);
    if (!good) process.exitCode = 1;
    return { ...g, out: good && o.out ? o.out : null };
  }]
};

const self = fileURLToPath(import.meta.url), argv1 = process.argv[1] ? resolve(process.argv[1]) : '';
if (process.platform === 'win32' ? self.toLowerCase() === argv1.toLowerCase() : self === argv1) {
  await cli(COMMANDS, process.argv.slice(2), 'usage: anchor.mjs build|verify|genesis (see the header of tools/keychain-release/anchor.mjs)');
}
