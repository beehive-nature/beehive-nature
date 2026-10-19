// WB004 live lane — key custody and signing.
//
// Custody file shape (discovered live, 2026-10-12): outer JSON
// { scheme: "DPAPI-CurrentUser", created, active_wif, owner_wif } where each
// *_wif is a HEX STRING of a CurrentUser DPAPI blob (null entropy) whose
// plaintext is parsed below. Plaintext crosses only in-memory pipes; it is
// never printed, never written, never committed.
import { spawnSync } from 'node:child_process';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import {
  base58Encode, base58Decode, base58CheckDecode, base58CheckEncode,
} from './codec.mjs';

const KEY_DIR = () => process.env.LOCALAPPDATA + '\\BeehiveNature\\jungle4\\bzcodejungle';

function unprotectHexField(hexField) {
  const ps = [
    'Add-Type -AssemblyName System.Security',
    "$h='" + hexField + "'",
    '$raw=New-Object byte[] ($h.Length/2)',
    'for($i=0;$i -lt $raw.Length;$i++){$raw[$i]=[Convert]::ToByte($h.Substring($i*2,2),16)}',
    '$p=[System.Security.Cryptography.ProtectedData]::Unprotect($raw,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Console]::OpenStandardOutput().Write($p,0,$p.Length)',
  ].join('\r\n');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { maxBuffer: 1 << 20 });
  if (r.status !== 0 || !r.stdout || r.stdout.length === 0) {
    throw new Error('DPAPI unprotect failed (status ' + r.status + '): ' + (r.stderr || '').toString().slice(0, 200));
  }
  // The ceremony wrote a PowerShell Unicode (UTF-16LE) string; every plaintext
  // is a bare WIF.
  const s = r.stdout.toString('utf16le').trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{52}$/.test(s)) throw new Error('custody plaintext is not a 52-char WIF (shape refused, not printed)');
  return s;
}

function readCustodyJson() {
  const ps = [
    "Get-Content ($env:LOCALAPPDATA+'\\BeehiveNature\\jungle4\\bzcodejungle\\keys.dpapi') -Raw",
  ].join('\r\n');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { maxBuffer: 1 << 20 });
  if (r.status !== 0) throw new Error('custody read failed');
  return JSON.parse(r.stdout.toString('utf8'));
}

// Returns { active: <plaintext string>, owner: <plaintext string> } — in-memory only.
export function loadPlainKeys() {
  const j = readCustodyJson();
  const out = {};
  for (const perm of ['active', 'owner']) {
    const hexField = j[perm + '_wif'];
    if (typeof hexField !== 'string' || hexField.length === 0) throw new Error('custody: missing ' + perm + '_wif');
    out[perm] = unprotectHexField(hexField);
  }
  return out;
}

// WIF: base58check, version 0x80, payload = 32-byte secret (+optional 0x01)
export function wifToSecret(wif) {
  const payload = base58CheckDecode(wif);
  if (payload[0] !== 0x80) throw new Error('WIF: bad version byte');
  if (payload.length === 33) return payload.subarray(1);
  if (payload.length === 34 && payload[33] === 0x01) return payload.subarray(1, 33);
  throw new Error('WIF: bad payload length ' + payload.length);
}

export function secretToWif(secret) {
  return base58CheckEncode(new Uint8Array([0x80, ...secret, 0x01]));
}

export function pubEncodings(pub33) {
  if (pub33.length !== 33) throw new Error('want 33-byte compressed pubkey');
  const legacyCheck = ripemd160(pub33).subarray(0, 4);
  const k1Check = ripemd160(new Uint8Array([...pub33, ...Buffer.from('K1', 'ascii')])).subarray(0, 4);
  return {
    legacy: 'EOS' + base58Encode(new Uint8Array([...pub33, ...legacyCheck])),
    k1: 'PUB_K1_' + base58Encode(new Uint8Array([...pub33, ...k1Check])),
  };
}

export function derivePublic(secret) {
  return secp256k1.getPublicKey(secret, true); // 33-byte compressed
}

export function randomSecret() {
  return secp256k1.utils.randomSecretKey(); // rejects out-of-range scalars internally
}

// Sign a 32-byte digest; returns SIG_K1_ base58 with K1-domain checksum.
// Wire layout per fc/src/crypto/elliptic_secp256k1.cpp:141-156 (fetched and
// read at the source): byte0 = 27 + recid + 4 (compressed) ∈ 31..34, then
// r(32), s(32); checksum = ripemd160(all-65 ‖ "K1")[:4]. noble's sign()
// prehashes by DEFAULT — prehash:false is mandatory since our digest is
// already sha256(chain_id ‖ packed_trx ‖ 32 zero bytes).
// fc canonical law (elliptic_common.cpp:152-157, fetched and read at source):
//   !(c[1]&0x80) && !(c[1]==0 && !(c[2]&0x80)) && same for s at c[33]/c[34]
// i.e. r and s must not have their high bit set, and a zero lead byte must be
// followed by a high-bit byte (minimal encoding). noble does not enforce it;
// we re-sign with extra entropy until the wire form is canonical.
function fcCanonical(r0, r1, s0, s1) {
  return !(r0 & 0x80) && !(r0 === 0 && !(r1 & 0x80)) &&
         !(s0 & 0x80) && !(s0 === 0 && !(s1 & 0x80));
}

export function signDigest(secret, digest32) {
  if (digest32.length !== 32) throw new Error('digest must be 32 bytes');
  for (let attempt = 0; attempt < 64; attempt++) {
    const entropy = new Uint8Array(4);
    new DataView(entropy.buffer).setUint32(0, attempt);
    const rec65 = secp256k1.sign(digest32, secret, { format: 'recovered', prehash: false, extraEntropy: entropy });
    const rec = rec65[0];
    if (rec > 3) throw new Error('recovery id ' + rec);
    const r0 = rec65[1], r1 = rec65[2], s0 = rec65[33], s1 = rec65[34];
    if (!fcCanonical(r0, r1, s0, s1)) continue;
    const payload = new Uint8Array([31 + rec, ...rec65.subarray(1, 33), ...rec65.subarray(33, 65)]);
    const check = ripemd160(new Uint8Array([...payload, ...Buffer.from('K1', 'ascii')])).subarray(0, 4);
    return 'SIG_K1_' + base58Encode(new Uint8Array([...payload, ...check]));
  }
  throw new Error('no fc-canonical signature in 64 attempts');
}

// Recover the signer's public key from an Antelope K1 signature over a digest
// (the inverse of signDigest — used for ground-truth checks against chain data).
export function recoverFromK1(sigStr, digest32) {
  const raw = base58Decode(sigStr.slice('SIG_K1_'.length));
  if (raw.length !== 69) throw new Error('K1 payload length ' + raw.length);
  const v = raw[0];
  if (v < 27 || v >= 35) throw new Error('v byte out of fc range: ' + v);
  const payload = raw.subarray(0, 65);
  const check = raw.subarray(65);
  const expect = ripemd160(new Uint8Array([...payload, ...Buffer.from('K1', 'ascii')])).subarray(0, 4);
  if (Buffer.compare(Buffer.from(check), Buffer.from(expect)) !== 0) throw new Error('K1 checksum mismatch');
  const rec = (v - 27) & 3;
  const noble65 = new Uint8Array([rec, ...payload.subarray(1, 33), ...payload.subarray(33, 65)]);
  return secp256k1.recoverPublicKey(noble65, digest32, { prehash: false });
}

// --- lane key set -------------------------------------------------------------

// Returns { active: {secret, pub}, owner: {secret, pub} } — secrets never leave.
export function loadAccountKeys() {
  const plain = loadPlainKeys();
  const out = {};
  for (const perm of Object.keys(plain)) {
    const secret = wifToSecret(plain[perm]);
    out[perm] = { secret, pub: pubEncodings(derivePublic(secret)) };
  }
  return out;
}

// wb004signr delegated-permission generations: { K2, K3, ... } — each value a
// DPAPI-hex blob in wb004signr.dpapi, same custody rules as the account keys.
function protectString(plain) {
  // hex of the DPAPI blob comes back on stdout; plaintext in via stdin pipe
  const ps = [
    'Add-Type -AssemblyName System.Security',
    '$in=[Console]::In.ReadToEnd().Trim()',
    '$b=[Text.Encoding]::UTF8.GetBytes($in)',
    '$p=[System.Security.Cryptography.ProtectedData]::Protect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '$h=[BitConverter]::ToString($p) -replace "-",""',
    '[Console]::Write($h)',
  ].join('\r\n');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    input: plain, maxBuffer: 1 << 20,
  });
  if (r.status !== 0) throw new Error('DPAPI protect failed: ' + (r.stderr || '').toString().slice(0, 200));
  return r.stdout.toString('ascii').trim().toUpperCase();
}

function unprotectString(hexBlob) {
  const ps = [
    'Add-Type -AssemblyName System.Security',
    "$h='" + hexBlob + "'",
    '$raw=New-Object byte[] ($h.Length/2)',
    'for($i=0;$i -lt $raw.Length;$i++){$raw[$i]=[Convert]::ToByte($h.Substring($i*2,2),16)}',
    '$p=[System.Security.Cryptography.ProtectedData]::Unprotect($raw,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Console]::OpenStandardOutput().Write($p,0,$p.Length)',
  ].join('\r\n');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { maxBuffer: 1 << 20 });
  if (r.status !== 0 || !r.stdout || r.stdout.length === 0) throw new Error('DPAPI unprotect failed');
  return r.stdout.toString('utf8').trim();
}

function readLaneFile() {
  const ps = ["Get-Content ($env:LOCALAPPDATA+'\\BeehiveNature\\jungle4\\bzcodejungle\\wb004signr.dpapi') -Raw"];
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps.join('\r\n')], { maxBuffer: 1 << 20 });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout.toString('utf8')); } catch { return null; }
}

function writeLaneFile(j) {
  const ps = [
    "$in=[Console]::In.ReadToEnd()",
    "[IO.File]::WriteAllText($env:LOCALAPPDATA+'\\BeehiveNature\\jungle4\\bzcodejungle\\wb004signr.dpapi',$in)",
  ].join('\r\n');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    input: JSON.stringify(j), maxBuffer: 1 << 20,
  });
  if (r.status !== 0) throw new Error('lane key write failed');
}

export function loadLaneKeys() {
  const f = readLaneFile();
  const out = {};
  if (!f) return out;
  for (const gen of Object.keys(f)) {
    const wif = unprotectString(f[gen]);
    if (!/^[1-9A-HJ-NP-Za-km-z]{52}$/.test(wif)) throw new Error('lane key gen ' + gen + ': bad WIF shape');
    const secret = wifToSecret(wif);
    out[gen] = { secret, pub: pubEncodings(derivePublic(secret)) };
  }
  return out;
}

export function saveLaneKey(gen, secret) {
  const f = readLaneFile() || {};
  f[gen] = protectString(secretToWif(secret));
  writeLaneFile(f);
  const back = loadLaneKeys();
  if (!back[gen] || Buffer.compare(back[gen].secret, secret) !== 0) {
    throw new Error('lane key save/load equality FAILED for ' + gen);
  }
  return pubEncodings(derivePublic(secret));
}
