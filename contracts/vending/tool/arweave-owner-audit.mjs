#!/usr/bin/env node
/* arweave-owner-audit.mjs — did any vending item put a seed in its owner field?

     node contracts/vending/tool/arweave-owner-audit.mjs

   For every item Arweave's index lists with App-Name=skaists-vending or
   Type=agent-birth-certificate (plus the 2026-09-01 ed25519 probe by id), it
   reports the owner's length, whether the owner equals the item's Member-Key
   tag, and, for ed25519 items (32-byte owner), whether the item's signature
   verifies under its owner field (verifyEd25519Item). An owner that held a
   seed cannot verify a signature the item carries, except with negligible
   probability, so "sig valid under owner true" rules out a published seed for
   that item. It prints booleans, lengths and id prefixes only; no key material
   is read or printed. Network: arweave.net GraphQL and /raw only (reads).

   Scope: tagged items and the named probe only. Items without these tags,
   uploads the door refused, and the door's own logs are not seen by this. */
import { createPublicKey, verify as edVerify, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const te = new TextEncoder();
const sha384 = (b) => new Uint8Array(createHash('sha384').update(b).digest());
const concat = (parts) => Buffer.concat(parts.map((p) => Buffer.from(p)));

/* arweave's deepHash (ANS-104 signing message): blobs tagged "blob"+len,
   lists "list"+len, SHA-384 throughout */
export function deepHash(x) {
  if (Array.isArray(x)) {
    let acc = sha384(concat([te.encode('list'), te.encode(String(x.length))]));
    for (const el of x) acc = sha384(concat([acc, deepHash(el)]));
    return acc;
  }
  return sha384(concat([sha384(concat([te.encode('blob'), te.encode(String(x.length))])), sha384(x)]));
}

/* the ANS-104 tags encoding: avro array of {name, value} strings, zigzag varints */
const zz = (n) => { let v = (n << 1) ^ (n >> 31); const out = []; while (v & ~0x7f) { out.push((v & 0x7f) | 0x80); v >>>= 7; } out.push(v); return Uint8Array.from(out); };
const avroString = (s) => { const b = te.encode(s); return concat([zz(b.length), b]); };
export function serializeTags(tags) {
  if (!tags.length) return new Uint8Array(0);
  return concat([zz(tags.length), ...tags.flatMap((t) => [avroString(t.name), avroString(t.value)]), Uint8Array.from([0])]);
}

/* does an ed25519 (signature type 2) item's signature verify under its owner field? */
export function verifyEd25519Item({ owner, signature, target = new Uint8Array(0), anchor = new Uint8Array(0), tags, data }) {
  if (owner.length !== 32) return null;
  const msg = deepHash([te.encode('dataitem'), te.encode('1'), te.encode('2'), owner, target, anchor, serializeTags(tags), data]);
  const key = createPublicKey({ key: concat([Buffer.from('302a300506032b6570032100', 'hex'), owner]), format: 'der', type: 'spki' });
  return edVerify(null, msg, key, Buffer.from(signature));
}

const b64 = (s) => (s ? new Uint8Array(Buffer.from(s, 'base64url')) : new Uint8Array(0));
async function gql(query, variables) {
  const r = await fetch('https://arweave.net/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(30000) });
  return (await r.json()).data;
}

export async function audit(log = console.log) {
  const F = 'id owner{key} signature recipient anchor tags{name value}';
  const seen = new Map();
  for (const t of [[{ name: 'App-Name', values: ['skaists-vending'] }], [{ name: 'Type', values: ['agent-birth-certificate'] }]]) {
    let after = null;
    for (;;) {
      const d = await gql(`query($t:[TagFilter!],$a:String){transactions(first:100,after:$a,tags:$t){pageInfo{hasNextPage} edges{cursor node{${F}}}}}`, { t, a: after });
      for (const e of d.transactions.edges) seen.set(e.node.id, e.node);
      if (!d.transactions.pageInfo.hasNextPage) break; after = d.transactions.edges.at(-1).cursor;
    }
  }
  const probe = await gql(`query($ids:[ID!]){transactions(ids:$ids){edges{node{${F}}}}}`, { ids: ['F8f2GF_ToN4oRZbohhHGiaIo7MXZ-RdVPOje3jAZ7U4'] });
  for (const e of probe.transactions.edges) seen.set(e.node.id, e.node);
  log('ITEMS', seen.size);
  for (const n of seen.values()) {
    const owner = b64(n.owner.key); const mk = n.tags.find((t) => t.name === 'Member-Key')?.value || '';
    let sig = 'n/a (not ed25519)';
    if (owner.length === 32) {
      try {
        /* a gateway error page is not the item's data: say unchecked, never "false" */
        const res = await fetch('https://arweave.net/raw/' + n.id, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error('gateway HTTP ' + res.status);
        const data = new Uint8Array(await res.arrayBuffer());
        sig = String(verifyEd25519Item({ owner, signature: b64(n.signature), target: b64(n.recipient), anchor: b64(n.anchor), tags: n.tags.map(({ name, value }) => ({ name, value })), data }));
      } catch (e) { sig = 'unchecked: ' + String(e.message).slice(0, 40); }
    }
    log(`${n.id.slice(0, 10)} ownerLen ${owner.length} · owner==Member-Key ${Buffer.from(owner).toString('hex') === mk} · sig valid under owner ${sig} · agent ${n.tags.find((t) => t.name === 'Agent-Name')?.value || '?'}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await audit();
