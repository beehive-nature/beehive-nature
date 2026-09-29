#!/usr/bin/env node
/* vending-machine.mjs — the machine seat's half of the mint.

   The mint happens in the member's own browser (surfaces/vending.html): the
   member's ed25519 key is made there, signs the certificate, and is handed to
   the member; this machine never makes, sees or keeps a member key. What the
   page cannot do is sign the chain's pointer row — `mint` in
   contracts/vending/src/vending.cpp wants the seat's own signature. This
   script is that one step, run on the machine whose environment holds the
   seat key (BNRAPOLL_WIF, the variable the receipted tool used):

     node scripts/vending-machine.mjs --row <name> <ar id>

     1. the certificate is fetched from a gateway and re-hashed; a record that
        does not hash true for <name> is refused
     2. the item's OWNER is read from Arweave's index and must equal the member
        key the certificate names; unreadable or different ⇒ refused
     3. a name already on the certs table under a different member key is
        refused, never hijacked; the same key re-points its own row (`update`)
     4. the row is signed with the seat key; absent ⇒ refused, nothing written

   `<name> --dry-run` composes a hash-true certificate under a throwaway key
   held in memory only (never written), to prove the recipe offline.
   Every step is reported as a named row; every failure is a named refusal.
   Nothing here prints, logs, writes or returns a private key. */
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, '..', 'contracts', 'vending', 'tool');
const require = createRequire(join(TOOL, 'package.json'));
const cert = await import('../contracts/vending/tool/cert.mjs');
const a1 = await import('../contracts/vending/tool/a1.mjs');

export const RPC = 'https://jungle4.greymass.com';
export const CONTRACT = 'bnrapolltest';        /* TESTNET-ONLY rehearsal seat */
export const MEMBER_ACCT = 'bnrapolltest';     /* rehearsal stand-in for the member's Vaulta account (mint.mjs) */
export const KEY_ENV = 'BNRAPOLL_WIF';
const ZW = /[​-‍⁠﻿ ]/;

/* the page's canonicalization law, mirrored (surfaces/vending.html canonicalName) */
export function canonicalName(raw, tongue) {
  const s = String(raw || '').normalize('NFC');
  if (ZW.test(s)) throw refuse('name', 'the name carries a zero-width or non-breaking character; it is refused, never silently stripped');
  const collapsed = s.trim().replace(/\s+/g, ' ');
  if (!collapsed) throw refuse('name', 'the name is empty');
  if (collapsed.length > 64) throw refuse('name', 'the name is longer than 64 characters');
  const loc = { latvian: 'lv', turkish: 'tr', english: 'en' }[tongue] || undefined;
  return loc ? collapsed.toLocaleLowerCase(loc) : collapsed.toLowerCase();
}

export function refuse(step, why) { const e = new Error(why); e.step = step; e.refused = true; return e; }

/* a throwaway key for the dry run: in memory only, gone when the process ends */
function throwawayKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { seed: Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url'), pubHex: publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex') };
}

/* the item's owner from Arweave's own index, as hex of the 32-byte ed25519 key */
export async function itemOwnerHex(arId, fetchImpl = fetch) {
  const r = await fetchImpl('https://arweave.net/graphql', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'query($ids:[ID!]){transactions(ids:$ids){edges{node{owner{key}}}}}', variables: { ids: [arId] } }),
    signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const key = (await r.json())?.data?.transactions?.edges?.[0]?.node?.owner?.key;
  return typeof key === 'string' ? Buffer.from(key, 'base64url').toString('hex') : null;
}

/* the pointer row, signed with the machine seat's key from the environment */
async function writePointerRow({ canon, pubHex, arId, hash, template, tongue }) {
  const wif = process.env[KEY_ENV];
  if (!wif) throw refuse('sign', KEY_ENV + ' is not in this machine\'s environment; nothing was written');
  const { Api, JsonRpc } = require('eosjs');
  const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig.js');
  const rpc = new JsonRpc(RPC, { fetch });
  const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([wif]), textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
  const existing = await rpc.get_table_rows({ json: true, code: CONTRACT, scope: CONTRACT, table: 'certs', limit: 100 });
  const held = (existing.rows || []).find((r) => r.agent_name === canon);
  if (held && held.member_key !== pubHex) throw refuse('collision', canon + ' is already held by another member key; refused, never hijacked');
  const already = !!held;
  const r = await api.transact({ actions: [{
    account: CONTRACT, name: already ? 'update' : 'mint',
    authorization: [{ actor: MEMBER_ACCT, permission: 'active' }],
    data: already
      ? { agent_name: canon, owner: MEMBER_ACCT, member_key: pubHex, ar_id: arId, content_hash: hash }
      : { agent_name: canon, owner: MEMBER_ACCT, member_key: pubHex, ar_id: arId, content_hash: hash, templ: template, tongue },
  }] }, { blocksBehind: 3, expireSeconds: 300 });
  return { trx: r.transaction_id, action: already ? 'update' : 'mint' };
}

/* the recipe, offline: `report(step, detail)` is called as each step lands.
   Only the dry run lives here. A member key is made in the member's own
   browser, never on this machine, so a real mint refuses and names the page. */
export async function mint({ name, tongue = 'latvian', template = 'bqueenbee-genesis-1', dryRun = false, report = () => {} }) {
  if (!dryRun) throw refuse('mint', 'a member key is made in the member\'s own browser (surfaces/vending.html), never on this machine; this door writes the pointer row only: --row <name> <ar id>');
  const canon = canonicalName(name, tongue); report('name', { canonical: canon });
  const k = throwawayKey(); report('key', { member_key: k.pubHex, kept: 'nowhere, memory only' });
  const memberPriv = await a1.importMemberSeed(k.seed);
  const genesis = await a1.genesisRevision({ agent: canon, body: { note: 'a1 genesis — memory begins empty; the store funds later under this binding' }, memberPrivateKey: memberPriv });
  const genesisHash = a1.hashRevision(genesis); report('memory', { a1_genesis: genesisHash });
  const storeBinding = { store: 'autonomi', binding: 'a1-log v1 — append-only hash-linked revisions, owner-signed ed25519 (this member key); resolver takes the highest valid revision; deletable by the member',
    a1_genesis: { rev: genesis.rev, sha256: genesisHash, ts: genesis.ts },
    funded_write_status: 'GATED on the ANT custody review (storage-substrate-split item 8); the binding is derivable from this certificate the day it is funded' };
  const mintedIso = new Date().toISOString();
  const record = cert.composeCertificate({ agentName: canon, house: 'a', tongue, template, memberKeyHex: k.pubHex, memberAccount: MEMBER_ACCT, mintedIso, storeBinding });
  const bytes = Buffer.from(cert.canonicalJson(record), 'utf8'); const hash = cert.contentHash(record);
  report('certificate', { bytes: bytes.length, hash });
  return { canonical: canon, member_key: k.pubHex, hash, bytes: bytes.length, dryRun: true };
}

/* the pointer row for a certificate the page already put on the permaweb
   (the page cannot sign the row; the seat can): fetch, re-hash, check the
   owner, refuse a hijack, then mint/update. */
export async function row({ name, arId, tongue = 'latvian', template = 'bqueenbee-genesis-1', report = () => {}, ownerOf = itemOwnerHex }) {
  const canon = canonicalName(name, tongue);
  if (!/^[A-Za-z0-9_-]{43}$/.test(arId || '')) throw refuse('arweave', 'not a 43-character arweave id');
  let rec = null;
  for (const g of ['https://arweave.net']) {
    try { const r = await fetch(g + '/' + arId, { signal: AbortSignal.timeout(15000) }); if (r.ok) { rec = await r.json(); report('fetched', { from: g }); break; } } catch {}
  }
  if (!rec) throw refuse('arweave', 'the certificate is not readable from a gateway yet');
  const v = cert.verifyCertificate(rec);
  if (!v.ok || !rec.agent || rec.agent.name !== canon) throw refuse('hash', 'the record does not hash true for ' + canon);
  const pubHex = rec.answers?.who_owns_it?.member_key_ed25519_hex;
  if (!/^[0-9a-f]{64}$/.test(pubHex || '')) throw refuse('hash', 'the record names no ed25519 member key');
  const owner = await ownerOf(arId).catch(() => null);
  if (!owner) throw refuse('owner', 'Arweave has not indexed the item\'s owner yet; try again in a few minutes');
  if (owner !== pubHex) throw refuse('owner', 'the item was signed by a different key than the certificate names');
  report('verified', { hash: v.hash, member_key: pubHex, owner: 'matches' });
  const out = await writePointerRow({ canon, pubHex, arId, hash: v.hash, template: rec.agent.template || template, tongue: rec.agent.tongue || tongue });
  report('row', out); return { canonical: canon, ar_id: arId, hash: v.hash, ...out };
}

/* CLI: node scripts/vending-machine.mjs --row <name> <ar id>
        node scripts/vending-machine.mjs <name> [tongue] [template] --dry-run   */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2); const dryRun = args.includes('--dry-run'); const pos = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--row')) {
    try { const out = await row({ name: pos[0], arId: pos[1], report: (s, d) => console.log(s + ':', JSON.stringify(d)) }); console.log('ROW-DONE', JSON.stringify(out)); }
    catch (e) { console.error('REFUSED at ' + (e.step || 'unknown') + ': ' + e.message); process.exit(1); }
    process.exit(0);
  }
  if (!pos[0]) { console.error('usage: node scripts/vending-machine.mjs --row <name> <ar id> | <name> [tongue] [template] --dry-run'); process.exit(2); }
  try {
    const out = await mint({ name: pos[0], tongue: pos[1], template: pos[2], dryRun, report: (s, d) => console.log(s + ':', JSON.stringify(d)) });
    console.log('MINT-DONE', JSON.stringify(out));
  } catch (e) { console.error('REFUSED at ' + (e.step || 'unknown') + ': ' + e.message); process.exit(1); }
}
