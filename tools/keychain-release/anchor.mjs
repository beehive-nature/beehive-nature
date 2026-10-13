#!/usr/bin/env node
// anchor.mjs — Hive witness anchors for keychain release records (custom_json id bnr.anchor).
//
//   build --record R --sig S --prev-json FILE --seq N [--loc L]... [--out FILE]
//       the canonical ASCII anchor json A and the full custom_json op (posting auth loviswater);
//       FILE holds the exact previous bnr.anchor json string (first release: the pinned genesis, as
//       `genesis --out` writes it); N is the record's own seq; --out writes A's exact bytes
//   verify [--account loviswater] [--subject keys.skaists.dev] [--nodes url,...] [--record R --sig S | --envelope E]
//       quorum read of every bnr.anchor op on the account, a class per anchor and for the release
//   genesis [--nodes url,...] [--out FILE]
//       read the genesis anchor (block 108404167) from every node and print the SHA3-256 (b64u) of
//       its json string; --out writes those exact bytes, only when two operators agree on the pin
//
// An anchor witnesses that a record existed, and in what order; it authorizes nothing. It is
// classical (Hive's secp256k1 posting key), so its class is REPORTED and never a serving gate.
// Classes: ANCHORED-TERMINAL (>= 2 operators return the same block, trx and json bytes, at or
// below their last irreversible block, and the block itself carries the op), ANCHORED-AS-REPORTED
// (one operator), SIGNED-UNANCHORED (the release's signature verifies and no anchor names it),
// DIVERGENT (operators, or one operator's two read paths, disagree; or an operator past the block
// in irreversible history omits it), INCONCLUSIVE (nothing irreversible to count yet).
// An operator is its scheme, host and port: --nodes listing one twice counts it once, and a
// fully qualified name's trailing dot (https://api.hive.blog.) is the same host.
// The chain starts only at the pinned genesis (block, trx AND json sha3), ANCHORED-TERMINAL, and
// links only through anchors that are not DIVERGENT. A fork is looked for in every reading of every
// anchor, DIVERGENT ones and each operator's own bytes for an op in dispute included: one operator
// that omits or alters one side of an equivocation cannot hide it and so choose the head.
// A release anchor carries its record's seq (the genesis is seq 0, so record seq 1 anchors as
// seq 1), and it names the release only when its rec digests, its sig.bpq and its sig.sha3 (of the
// signature's one byte form) all match.
// Read paths as the July receipt measured them (DISPATCH-RECEIPTS-2026-07-24.md:293-346):
// condenser_api.* takes positional params and account_history_api.* named ones; the custom_json id
// is filtered client-side; never bridge.* (HiveMind is a second layer, not consensus).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BPQ, b64u, canon, checkIdentity, cli, fields, isCount, isDigest, isId, openEnvelope, parseRecord, parseStrict, readSig, sha256, sha3, sigSha3 } from './release.mjs';

// The genesis is this block, this trx and these 620 bytes (tools/keychain-release/test/genesis-anchor.json).
// The same bytes posted again later are a repeat, never the genesis: the reader pins this trx.
export const GENESIS = Object.freeze({ block: 108404167, trx: '7d404d75b82ac38fc5b27b1dd4cf2727c9c583b8', size: 620, sha3: 'O4n0MUUDIN24chEO6f07XnGXUgFlqi16PauvsAp0zUs' });
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
  const r = checkIdentity(parseRecord(recordBytes));
  const v = BPQ.verifyFile(readSig(sigBytes), new Uint8Array(recordBytes));
  if (!v.ok) throw new Error(`the signature is not over this record: ${v.why}`);
  if (/[\r\n]$/.test(prevJson.toString('latin1'))) throw new Error('--prev-json ends in a newline; an anchor json string on chain has none (write it with genesis --out)');
  let p;
  try { p = JSON.parse(prevJson.toString('utf8')); } catch { throw new Error('--prev-json is not JSON'); }
  if (!p || !Number.isSafeInteger(p.seq) || p.seq < 0) throw new Error('--prev-json carries no integer seq');
  if (p.seq === 0 && b64u(sha3(prevJson)) !== GENESIS.sha3) throw new Error(`--prev-json is seq 0 but not the pinned genesis (sha3 ${GENESIS.sha3}); a release chain starts there only`);
  if (!Number.isSafeInteger(seq) || seq !== r.seq) throw new Error(`--seq ${seq} is not the record's seq ${r.seq}: a release anchor carries its record's seq (record seq 1 anchors as seq 1)`);
  if (seq !== p.seq + 1) throw new Error(`--seq ${seq} does not follow the previous anchor's seq ${p.seq}`);
  const json = anchorJson({
    loc, prev: b64u(sha3(prevJson)), seq,
    rec: { sha256: b64u(sha256(recordBytes)), sha3: b64u(sha3(recordBytes)), size: recordBytes.length },
    sig: { bpq: v.id, sha3: sigSha3(sigBytes) }
  });
  return { json, op: ['custom_json', { required_auths: [], required_posting_auths: [ACCOUNT], id: ANCHOR_ID, json }] };
}

// ── operators ────────────────────────────────────────────────────────────
// An operator is scheme://host[:port], lower case, no default port, no trailing slash and no
// trailing dot on the host (a fully qualified name is the same host): the same operator spelled
// twice is one vote, never a quorum. A path, query, fragment, credentials or an empty label is
// refused rather than guessed at; plain http only to loopback.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
export function normalizeNode(s) {
  let u;
  try { u = new URL(String(s).trim()); } catch { throw new Error(`node ${s} is not a URL`); }
  const host = u.hostname.endsWith('.') ? u.hostname.slice(0, -1) : u.hostname;
  if (!host.startsWith('[') && host.split('.').some(label => !label)) throw new Error(`node ${s}: the host has an empty label`);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && LOOPBACK.has(host))) throw new Error(`node ${s}: https only (plain http to loopback alone)`);
  if (u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) throw new Error(`node ${s}: an operator is scheme://host[:port], with no path, query, fragment or credentials`);
  return `${u.protocol}//${host}${u.port ? `:${u.port}` : ''}`.toLowerCase();
}
export function normalizeNodes(list) {
  const out = [];
  for (const s of list) { const n = normalizeNode(s); if (!out.includes(n)) out.push(n); }
  if (!out.length) throw new Error('no node');
  return out;
}
// The operator a view came from; a view whose url is not a URL (a test label) is its own name.
const operatorKey = url => { try { return normalizeNode(url); } catch { return String(url).toLowerCase().replace(/\/+$/, ''); } };

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
  return Promise.all(normalizeNodes(nodes).map(async url => {
    try {
      const lib = await lastIrreversible(url);   // first: every op at or below it is already history
      return { url, ok: true, lib, ops: await anchorsOf(url, account) };
    } catch (e) { return { url, ok: false, error: e.message }; }
  }));
}

// ── classes ──────────────────────────────────────────────────────────────
const RANK = ['ANCHORED-TERMINAL', 'ANCHORED-AS-REPORTED', 'INCONCLUSIVE', 'DIVERGENT'];
// json is the bytes every reporting operator agrees on (null when they disagree). It stays on a
// DIVERGENT anchor whose bytes agree (an omission, a block that does not carry it) so the release
// verdict can name it; assess() never links a DIVERGENT anchor into the chain. versions is every
// distinct json string an operator returned for the op, so a fork is seen in bytes in dispute too.
async function classify(views, key, confirm) {
  const live = views.filter(v => v.ok), reporters = live.filter(v => v.ops.has(key));
  const first = reporters[0].ops.get(key), versions = [...new Set(reporters.map(v => v.ops.get(key).json))];
  const out = { key, block: first.block, trx: first.trx, op_in_trx: first.op_in_trx, json: null, versions, operators: reporters.length, confirmed: 0 };
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
const jsonSha3 = s => b64u(sha3(Buffer.from(s, 'utf8')));

// views: per operator {url, ok, lib, ops: Map(trx:op_in_trx -> {block, trx, op_in_trx, json})};
// confirm(url, op) -> true | false | null (unknown). The chain is the pinned genesis, then the
// subject's release anchors linked by prev (sha3 of the previous json) and seq (previous seq + 1).
export async function assess(views0, confirm, { subject = SUBJECT, recordBytes, sigBytes } = {}) {
  // one operator, one view: a second spelling of an operator already read is dropped, not counted
  const seen = new Set(), views = [], duplicates = [];
  for (const v of views0) {
    const k = operatorKey(v.url);
    if (seen.has(k)) duplicates.push(v.url); else { seen.add(k); views.push(v); }
  }
  const live = views.filter(v => v.ok);
  const anchors = [];
  for (const key of new Set(live.flatMap(v => [...v.ops.keys()]))) anchors.push(await classify(views, key, confirm));
  const genesis = anchors.find(a => a.trx === GENESIS.trx && a.block === GENESIS.block) || null;
  const genesisSha3 = genesis && genesis.json !== null ? jsonSha3(genesis.json) : null;
  const genesisWhy = !genesis ? `no operator returns block ${GENESIS.block} trx ${GENESIS.trx}`
    : genesis.class !== 'ANCHORED-TERMINAL' ? `the genesis is ${genesis.class}, not ANCHORED-TERMINAL`
    : genesisSha3 !== GENESIS.sha3 ? `the genesis json sha3 ${genesisSha3} is not the pin ${GENESIS.sha3}` : null;
  const releases = [], malformed = [], repeats = [];
  let other = 0;
  for (const a of anchors) {
    if (a === genesis) continue;
    if (a.json !== null && jsonSha3(a.json) === GENESIS.sha3) { repeats.push(brief(a)); continue; }
    let j = null;
    try { j = a.json === null ? null : JSON.parse(a.json); } catch { j = null; }
    if (!j || j.subject !== subject) { other++; continue; }
    try { releases.push({ ...a, anchor: parseAnchor(Buffer.from(a.json, 'utf8')) }); } catch (e) { malformed.push({ block: a.block, trx: a.trx, why: e.message }); }
  }
  // Every reading that parses as this subject's release anchor: each agreed anchor, DIVERGENT ones
  // included, and each operator's own bytes for an op in dispute. Forks are looked for here, so an
  // operator that omits or alters one side of an equivocation cannot hide it and pick the head;
  // only an anchor that is not DIVERGENT ever links.
  const readings = [];
  for (const a of anchors) {
    if (a === genesis) continue;
    for (const json of a.versions) {
      if (jsonSha3(json) === GENESIS.sha3) continue;
      let anchor = null;
      try { const j = JSON.parse(json); if (j && j.subject === subject) anchor = parseAnchor(Buffer.from(json, 'utf8')); } catch { anchor = null; }
      if (anchor) readings.push({ a, json, anchor });
    }
  }
  const rivalsOf = xs => [...new Map(xs.map(x => [`${x.a.key}\n${x.json}`, x])).values()]
    .map(x => ({ seq: x.anchor.seq, ...brief(x.a), rec_sha3: x.anchor.rec.sha3, signer: x.anchor.sig.bpq }));
  const chain = [], used = new Set();
  let cur = genesisWhy === null ? genesis.json : null, seq = 0, fork = null;
  while (cur !== null) {
    const want = jsonSha3(cur), rivals = readings.filter(x => x.anchor.prev === want && x.anchor.seq === seq + 1);
    if (!rivals.length) break;
    if (new Set(rivals.map(x => x.json)).size > 1) { fork = { seq: seq + 1, anchors: rivalsOf(rivals) }; break; }
    const next = releases.filter(a => a.class !== 'DIVERGENT' && a.json === rivals[0].json);
    if (!next.length) break;   // its one reading is on DIVERGENT anchors only: the chain stops before it
    next.sort((x, y) => x.block - y.block);   // the same json posted again is a repeat; the earliest is the anchor
    next.forEach(a => used.add(a.key));
    chain.push(next[0]); cur = next[0].json; seq++;
  }
  const out = {
    subject, operators: views.map(v => (v.ok ? { url: v.url, ok: true, lib: v.lib, anchors: v.ops.size } : { url: v.url, ok: false, error: v.error })),
    ...(duplicates.length ? { duplicate_operators: duplicates } : {}),
    genesis: genesis
      ? { block: genesis.block, trx: genesis.trx, class: genesis.class, ...(genesis.json !== null ? { size: Buffer.byteLength(genesis.json), sha3: genesisSha3 } : {}), pinned: genesisSha3 === GENESIS.sha3, starts_chain: genesisWhy === null, ...(genesisWhy ? { why: genesisWhy } : {}) }
      : { block: GENESIS.block, trx: GENESIS.trx, class: null, pinned: false, starts_chain: false, why: genesisWhy },
    genesis_repeats: repeats,
    chain: chain.map(a => ({ ...brief(a), rec_sha3: a.anchor.rec.sha3, signer: a.anchor.sig.bpq })),
    fork, orphans: releases.filter(a => !used.has(a.key) && a.class !== 'DIVERGENT').map(brief), malformed, other_anchors: other,
    divergent: anchors.filter(a => a.class === 'DIVERGENT').map(brief),
    head: chain.length ? brief(chain[chain.length - 1]) : null
  };
  if (recordBytes) {
    const r = checkIdentity(parseRecord(recordBytes));
    const v = BPQ.verifyFile(readSig(sigBytes), new Uint8Array(recordBytes));
    if (!v.ok) throw new Error(`the signature is not over this record: ${v.why}`);
    const rec = { sha256: b64u(sha256(recordBytes)), sha3: b64u(sha3(recordBytes)), size: recordBytes.length };
    const sig = { bpq: v.id, sha3: sigSha3(sigBytes) };
    const named = releases.filter(a => a.anchor.rec.sha3 === rec.sha3 && a.anchor.rec.sha256 === rec.sha256 && a.anchor.rec.size === rec.size);
    const mismatch = a => a.anchor.sig.bpq !== sig.bpq ? `it witnesses a signature by ${a.anchor.sig.bpq}, not ${sig.bpq}`
      : a.anchor.sig.sha3 !== sig.sha3 ? `it witnesses another signature file (sha3 ${a.anchor.sig.sha3}, not ${sig.sha3})`
      : a.anchor.seq !== r.seq ? `anchor seq ${a.anchor.seq} is not the record's seq ${r.seq}` : null;
    const hits = named.filter(a => mismatch(a) === null)
      .sort((x, y) => (used.has(y.key) - used.has(x.key)) || RANK.indexOf(x.class) - RANK.indexOf(y.class));
    const elsewhere = named.filter(a => mismatch(a) !== null).map(a => ({ ...brief(a), not_this_release: mismatch(a) }));
    out.release = hits.length
      ? { sha3: rec.sha3, seq: r.seq, signer: v.id, sig_sha3: sig.sha3, class: hits[0].class, on_chain: used.has(hits[0].key), anchor: brief(hits[0]) }
      // no anchor names it: unanchored only if two operators answered and none returned bytes in dispute
      : { sha3: rec.sha3, seq: r.seq, signer: v.id, sig_sha3: sig.sha3, class: live.length < 2 ? 'INCONCLUSIVE' : anchors.some(a => a.json === null) ? 'DIVERGENT' : 'SIGNED-UNANCHORED', anchor: null };
    if (elsewhere.length) out.release.same_record_other_anchors = elsewhere;
  }
  return out;
}

export async function readGenesis(nodes) {
  const views = await Promise.all(normalizeNodes(nodes).map(async url => {
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
    pinned: one ? one.sha3 === GENESIS.sha3 : false,
    operators: views.map(({ json, ...v }) => v), json: one ? one.json : null
  };
}

// ── command line ─────────────────────────────────────────────────────────
const nodesOf = o => normalizeNodes(o.nodes ? o.nodes.split(',').map(s => s.trim()).filter(Boolean) : NODES);
const COMMANDS = {
  build: [{ value: ['record', 'sig', 'prev-json', 'seq', 'out'], list: ['loc'] }, o => {
    for (const k of ['record', 'sig', 'prev-json', 'seq']) if (o[k] === undefined) throw new Error(`--${k} is required`);
    if (!/^[1-9][0-9]*$/.test(o.seq)) throw new Error('--seq must be an integer >= 1');
    const { json, op } = buildAnchor({ recordBytes: readFileSync(o.record), sigBytes: readFileSync(o.sig), prevJson: readFileSync(o['prev-json']), seq: Number(o.seq), loc: o.loc || [] });
    if (o.out) writeFileSync(o.out, json);
    return { json, size: json.length, sha3: b64u(sha3(Buffer.from(json, 'latin1'))), op };
  }],
  verify: [{ value: ['account', 'subject', 'nodes', 'record', 'sig', 'envelope'] }, async o => {
    if (!o.record !== !o.sig) throw new Error('--record and --sig go together');
    if (o.envelope && o.record) throw new Error('--envelope or --record/--sig, not both');
    const account = o.account || ACCOUNT, nodes = nodesOf(o);
    // an envelope is the same evidence: its record bytes and canon(sig), the relsig file's one byte form
    const e = o.envelope ? openEnvelope(readFileSync(o.envelope)) : null;
    const recordBytes = e ? e.recordBytes : o.record && readFileSync(o.record), sigBytes = e ? e.sigBytes : o.sig && readFileSync(o.sig);
    const views = await readNodes(nodes, account);
    return { account, nodes, ...(await assess(views, inBlock, { subject: o.subject || SUBJECT, recordBytes, sigBytes })) };
  }],
  genesis: [{ value: ['nodes', 'out'] }, async o => {
    const { json, ...g } = await readGenesis(nodesOf(o));
    const good = g.class === 'ANCHORED-TERMINAL' && g.size_matches_contract && g.pinned;
    if (good && o.out) writeFileSync(o.out, json);
    if (!good) process.exitCode = 1;
    return { ...g, out: good && o.out ? o.out : null };
  }]
};

const self = fileURLToPath(import.meta.url), argv1 = process.argv[1] ? resolve(process.argv[1]) : '';
if (process.platform === 'win32' ? self.toLowerCase() === argv1.toLowerCase() : self === argv1) {
  await cli(COMMANDS, process.argv.slice(2), 'usage: anchor.mjs build|verify|genesis (see the header of tools/keychain-release/anchor.mjs)');
}
