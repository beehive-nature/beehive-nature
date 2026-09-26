#!/usr/bin/env node
/* vending-machine.mjs — THE MINT, as a machine door instead of a hand-run tool.

   The page (surfaces/vending.html) used to say "send A with a memo and the
   poller will catch your mint". The contract has no token-receipt path, so
   that could never mint (contracts/vending/src/vending.cpp: `mint` is the
   only writer and it wants the owner's own signature). This is the door that
   actually mints, the same road contracts/vending/tool/mint.mjs proved
   (RECEIPT_VENDING_MINT_2026-09-01), served on loopback for the page:

     1. canonical name (the page's own law: NFC · trim · collapse · lowercase)
     2. a fresh member ed25519 key — written to the member's own vault file on
        THIS machine (the tool's convention), never returned over the wire
     3. a1-log genesis under that key (the store binding)
     4. the birth certificate + its content hash (cert.mjs)
     5. Arweave: ANS-104 data item signed ed25519 so the item OWNER is the
        member key (the key road), through Turbo's free tier from this machine
     6. the pointer row: `mint` (or `update` for a re-mint) on jungle4, signed
        with the machine seat's key read from the environment — BNRAPOLL_WIF,
        the same variable the receipted tool used. Absent → this door REFUSES
        before step 5, so nothing is uploaded for a row that cannot be written.

   Every step is reported as a named row; every failure is a named refusal.
   Nothing here prints, logs or returns a private key. */
import { createHash, generateKeyPairSync, createPrivateKey } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
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

/* the member's vault on this machine: one file per agent name, the tool's convention */
function vaultDir() { const d = join(process.env.LOCALAPPDATA || process.env.TEMP || HERE, 'skaists-vending', 'members'); mkdirSync(d, { recursive: true }); return d; }
function memberKey(canon) {
  const file = join(vaultDir(), createHash('sha256').update(canon).digest('hex').slice(0, 16) + '.seed.json');
  if (existsSync(file)) { const j = JSON.parse(readFileSync(file, 'utf8')); return { seedB64url: j.seedB64url, pubHex: j.pubHex, file, fresh: false }; }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const seedB64url = privateKey.export({ format: 'jwk' }).d;
  const pubHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  writeFileSync(file, JSON.stringify({ agent: canon, seedB64url, pubHex, note: 'TESTNET rehearsal member key — yours, kept on this machine only' }, null, 2));
  try { chmodSync(file, 0o600); } catch {}
  return { seedB64url, pubHex, file, fresh: true };
}

/* step 5: Turbo upload, ed25519 owner = member key (ar-upload.cjs, run here) */
async function uploadToArweave(seedB64url, bytes, tags) {
  let TurboFactory, SolanaSigner, bs58;
  try {
    ({ TurboFactory } = (() => { try { return require('@ardrive/turbo-sdk/node'); } catch { return require('@ardrive/turbo-sdk'); } })());
    ({ SolanaSigner } = require('@dha-team/arbundles'));
    bs58 = require('bs58'); bs58 = bs58.default || bs58;
  } catch (e) { throw refuse('arweave', 'the Arweave libraries are not installed in contracts/vending/tool (npm install there): ' + e.message); }
  const seed = Buffer.from(seedB64url, 'base64url');
  const pubRaw = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' })
    .export({ format: 'jwk' }).x;
  const pub = Buffer.from(pubRaw, 'base64url');
  const secret64 = Buffer.concat([pub, seed]);   /* Solana layout: pub(32) ‖ seed(32) — owner = pub, signer = seed */
  const signer = new SolanaSigner(bs58.encode(secret64));
  const turbo = TurboFactory.authenticated({ signer, token: 'solana' });
  const res = await turbo.uploadFile({ fileStreamFactory: () => bytes, fileSizeFactory: () => bytes.length,
    dataItemOpts: { tags: tags.map(({ name, value }) => ({ name, value })) } });
  if (!res || typeof res.id !== 'string' || res.id.length !== 43) throw refuse('arweave', 'the upload door returned no 43-character id');
  return { id: res.id, owner: res.owner, winc: res.winc };
}

/* step 6: the pointer row, signed with the machine seat's key from the environment */
async function writePointerRow({ canon, pubHex, arId, hash, template, tongue }) {
  const wif = process.env[KEY_ENV];
  if (!wif) throw refuse('sign', KEY_ENV + ' is not in this machine\'s environment; the door will not upload a certificate it cannot point to');
  const { Api, JsonRpc } = require('eosjs');
  const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig.js');
  const rpc = new JsonRpc(RPC, { fetch });
  const api = new Api({ rpc, signatureProvider: new JsSignatureProvider([wif]), textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
  const existing = await rpc.get_table_rows({ json: true, code: CONTRACT, scope: CONTRACT, table: 'certs', limit: 100 });
  const already = (existing.rows || []).some((r) => r.agent_name === canon);
  const r = await api.transact({ actions: [{
    account: CONTRACT, name: already ? 'update' : 'mint',
    authorization: [{ actor: MEMBER_ACCT, permission: 'active' }],
    data: already
      ? { agent_name: canon, owner: MEMBER_ACCT, member_key: pubHex, ar_id: arId, content_hash: hash }
      : { agent_name: canon, owner: MEMBER_ACCT, member_key: pubHex, ar_id: arId, content_hash: hash, templ: template, tongue },
  }] }, { blocksBehind: 3, expireSeconds: 300 });
  return { trx: r.transaction_id, action: already ? 'update' : 'mint' };
}

/* the whole mint. `report(step, detail)` is called as each step lands.
   opts.dryRun stops after the certificate (no upload, no row): what the
   self-test and an unarmed machine can prove. */
export async function mint({ name, tongue = 'latvian', template = 'bqueenbee-genesis-1', dryRun = false, report = () => {} }) {
  const canon = canonicalName(name, tongue); report('name', { canonical: canon });
  const armed = !!process.env[KEY_ENV];
  if (!dryRun && !armed) throw refuse('sign', KEY_ENV + ' is not in this machine\'s environment; nothing was uploaded and nothing was written');
  const k = memberKey(canon); report('key', { member_key: k.pubHex, vault: k.file, fresh: k.fresh });
  const memberPriv = await a1.importMemberSeed(Buffer.from(k.seedB64url, 'base64url'));
  const genesis = await a1.genesisRevision({ agent: canon, body: { note: 'a1 genesis — memory begins empty; the store funds later under this binding' }, memberPrivateKey: memberPriv });
  const genesisHash = a1.hashRevision(genesis); report('memory', { a1_genesis: genesisHash });
  const storeBinding = { store: 'autonomi', binding: 'a1-log v1 — append-only hash-linked revisions, owner-signed ed25519 (this member key); resolver takes the highest valid revision; deletable by the member',
    a1_genesis: { rev: genesis.rev, sha256: genesisHash, ts: genesis.ts },
    funded_write_status: 'GATED on the ANT custody review (storage-substrate-split item 8); the binding is derivable from this certificate the day it is funded' };
  const mintedIso = new Date().toISOString();
  const record = cert.composeCertificate({ agentName: canon, house: 'a', tongue, template, memberKeyHex: k.pubHex, memberAccount: MEMBER_ACCT, mintedIso, storeBinding });
  const bytes = Buffer.from(cert.canonicalJson(record), 'utf8'); const hash = cert.contentHash(record);
  report('certificate', { bytes: bytes.length, hash });
  if (dryRun) return { canonical: canon, member_key: k.pubHex, hash, bytes: bytes.length, dryRun: true };
  const up = await uploadToArweave(k.seedB64url, bytes, cert.certTags({ agentName: canon, memberKeyHex: k.pubHex, spec: 'SPEC-VENDING-1' }));
  report('arweave', up);
  const row = await writePointerRow({ canon, pubHex: k.pubHex, arId: up.id, hash, template, tongue });
  report('row', row);
  return { canonical: canon, member_key: k.pubHex, hash, bytes: bytes.length, ar_id: up.id, owner: up.owner, trx: row.trx, action: row.action, minted: mintedIso };
}

/* CLI: node scripts/vending-machine.mjs <name> [tongue] [template] [--dry-run] */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2); const dryRun = args.includes('--dry-run'); const pos = args.filter((a) => !a.startsWith('--'));
  if (!pos[0]) { console.error('usage: node scripts/vending-machine.mjs <name> [tongue] [template] [--dry-run]'); process.exit(2); }
  try {
    const out = await mint({ name: pos[0], tongue: pos[1], template: pos[2], dryRun, report: (s, d) => console.log(s + ':', JSON.stringify(d)) });
    console.log('MINT-DONE', JSON.stringify(out));
  } catch (e) { console.error('REFUSED at ' + (e.step || 'unknown') + ': ' + e.message); process.exit(1); }
}
