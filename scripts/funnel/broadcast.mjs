#!/usr/bin/env node
/* ─── LICENSE ──────────────────────────────────────────────────────────────
 * SPDX-License-Identifier: BUSL-1.1
 * Licensor: Travis Mark Remington <lovis@skaists.dev>
 * The b-meter commercial moat — Business Source License 1.1, see LICENSE
 * in scripts/buzz-meter/. Change Date: August 29, 2030.
 * Change License: GPL-2.0-or-later.
 * ──────────────────────────────────────────────────────────────────────────
 * broadcast.mjs — the PEER FUNNEL testnet runner (SPEC-PEER-FUNNEL-1, z3.3).
 *
 * ONE broadcast, fired only when BOTH founder inputs exist:
 *   1. the tithe address — a one-line 0x-address file (founder word; the
 *      runner refuses the placeholder)
 *   2. testnet ETH on the issued funnel-test key (0xb43b…37af)
 *
 * The transaction carries the composed instruction as UTF-8 calldata so the
 * referralFees entry (the tithe, 10%) is VISIBLE in the decoded input on
 * any explorer. Compose-never-sign holds for every FOUNDER wallet; this key
 * is the seat's own throwaway TESTNET key (wallet-ceremony constitution:
 * own agent wallets — this one is testnet-only by construction).
 *
 *   node broadcast.mjs --selftest     EIP-155 vectors + sign/recover roundtrip
 *   node broadcast.mjs --compose      build + sign, print, NO send
 *   node broadcast.mjs --broadcast    the ONE send (guards first)
 *
 * Zero dependencies: RLP + BigInt ECDSA (sign AND pubkey-recover — every
 * signature is self-checked by recovering the sender before anything is
 * sent), keccak via surfaces/onboarding/vendor/bnr-sign.js. The private key
 * is read from disk (default ~/funnel-test/funnel-test.key, env
 * FUNNEL_TEST_KEY overrides) and NEVER printed. Deterministic-k note: k is
 * sha256(digest‖d) mod n — deterministic (no nonce reuse), not RFC 6979.
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
globalThis.self = globalThis;
await import(path.join(ROOT, 'surfaces', 'onboarding', 'vendor', 'bnr-sign.js'));
const keccak256 = (bytes) => new Uint8Array(self.BnrSign.keccak_256(bytes));

// ── hex plumbing ───────────────────────────────────────────────────────────
const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const hexToBytes = (h) => {
  h = String(h).replace(/^0x/, '');
  if (h.length % 2) h = '0' + h;
  return new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
};

// ── secp256k1 over BigInt ──────────────────────────────────────────────────
const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn; // PUBLIC-CONSTANT: secp256k1 field p
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n; // PUBLIC-CONSTANT: secp256k1 group order n
const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n; // PUBLIC-CONSTANT: secp256k1 generator x
const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n; // PUBLIC-CONSTANT: secp256k1 generator y
const mod = (a, m = P) => ((a % m) + m) % m;
const powMod = (a, e, m) => { let r = 1n; a = mod(a, m); while (e > 0n) { if (e & 1n) r = r * a % m; a = a * a % m; e >>= 1n; } return r; };
const invMod = (a, m) => powMod(a, m - 2n, m);                 // P and N are prime
const pointAdd = (a, b) => {
  if (a === null) return b;
  if (b === null) return a;
  const [ax, ay] = a, [bx, by] = b;
  if (ax === bx && ay === by) {
    const l = mod(3n * ax * ax * invMod(2n * ay, P), P);
    const x = mod(l * l - 2n * ax, P);
    return [x, mod(l * (ax - x) - ay, P)];
  }
  if (ax === bx) return null;                                  // point at infinity
  const l = mod((by - ay) * invMod(mod(bx - ax, P), P), P);
  const x = mod(l * l - ax - bx, P);
  return [x, mod(l * (ax - x) - ay, P)];
};
const pointMul = (k, pt = [Gx, Gy]) => {
  let r = null, acc = pt;
  k = mod(k, N);
  while (k > 0n) { if (k & 1n) r = pointAdd(r, acc); acc = pointAdd(acc, acc); k >>= 1n; }
  return r;
};
const pubHexFromPriv = (d) => {
  const [x, y] = pointMul(d);
  return '04' + x.toString(16).padStart(64, '0') + y.toString(16).padStart(64, '0');
};
const addressFromPubHex = (pubHex) => '0x' + bytesToHex(keccak256(hexToBytes(pubHex).slice(1))).slice(-40);

// sign with deterministic k = sha256(digest ‖ d) mod n; low-s enforced
function sign(d, digest) {
  const z = BigInt('0x' + (bytesToHex(digest) || '0'));
  const k = mod(BigInt('0x' + createHash('sha256')
    .update(digest).update(d.toString(16).padStart(64, '0')).digest('hex')), N) || 1n;
  const [kx, ky] = pointMul(k);
  const r = mod(kx, N);
  let s = mod(invMod(k, N) * mod(z + r * d, N), N);
  let v = ky % 2n;
  if (s > N / 2n) { s = N - s; v = 1n - v; }                   // low-s law — the flip inverts recovery parity
  return { r, s, v };
}
// recover: Q = r⁻¹(s·R − z·G)
function recover(r, s, v, digest) {
  const z = BigInt('0x' + (bytesToHex(digest) || '0'));
  const y2 = mod(r * r * r + 7n);
  const y = powMod(y2, (P + 1n) / 4n, P);
  if (mod(y * y, P) !== y2) throw new Error('no curve point for r');
  const Ry = (y % 2n) === v ? y : P - y;
  const rInv = invMod(r, N);
  const q = pointAdd(pointMul(mod(s * rInv, N), [r, Ry]), pointMul(mod((N - z) * rInv, N)));
  return q && '04' + q[0].toString(16).padStart(64, '0') + q[1].toString(16).padStart(64, '0');
}

// ── RLP (the EIP-155 subset) ───────────────────────────────────────────────
const bigIntToBytes = (n) => {
  if (n === 0n) return new Uint8Array();
  let h = n.toString(16);
  if (h.length % 2) h = '0' + h;
  return hexToBytes(h);
};
const rlp = (item) => {
  if (typeof item === 'bigint') item = bigIntToBytes(item);
  if (Array.isArray(item)) {
    const payload = item.map(rlp);
    const total = payload.reduce((n, b) => n + b.length, 0);
    const head = total < 56 ? [0xc0 + total] : (() => {
      const len = bigIntToBytes(BigInt(total));
      return [0xf7 + len.length, ...len];
    })();
    return new Uint8Array([...head, ...payload.flatMap((b) => [...b])]);
  }
  const b = item;
  if (b.length === 1 && b[0] < 0x80) return b;
  const head = b.length < 56 ? [0x80 + b.length] : (() => {
    const len = bigIntToBytes(BigInt(b.length));
    return [0xb7 + len.length, ...len];
  })();
  return new Uint8Array([...head, ...b]);
};

// ── legacy EIP-155 tx (self-checked: sender recovered from the signature) ──
function buildLegacyTx(tx, chainId, d) {
  const unsigned = [tx.nonce, tx.gasPrice, tx.gas, hexToBytes(tx.to), tx.value, tx.data, chainId, 0n, 0n];
  const hash = keccak256(rlp(unsigned));
  const { r, s, v: parity } = sign(d, hash);
  const v = 2n * chainId + 35n + parity;
  const raw = rlp([tx.nonce, tx.gasPrice, tx.gas, hexToBytes(tx.to), tx.value, tx.data, v, r, s]);
  const sender = addressFromPubHex(recover(r, s, parity, hash));
  const expect = addressFromPubHex(pubHexFromPriv(d));
  if (sender !== expect) throw new Error('SELF-CHECK FAIL: recovered ' + sender + ' != key owner ' + expect);
  return { rawTx: '0x' + bytesToHex(raw), txHash: '0x' + bytesToHex(keccak256(raw)), sender, v: v.toString() };
}

// ── selftest: canonical vectors, then the roundtrip on the real key ────────
function selftest() {
  const empty = bytesToHex(keccak256(new Uint8Array(0)));
  if (empty !== 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470') // PUBLIC-CONSTANT: keccak256(empty), the EVM canonical vector
    throw new Error('keccak vector FAIL ' + empty);
  const unsigned = [9n, 20000000000n, 21000n, hexToBytes('0x3535353535353535353535353535353535353535'),
    1000000000000000000n, new Uint8Array(), 1n, 0n, 0n];
  const h = bytesToHex(keccak256(rlp(unsigned)));
  if (h !== 'daf5a779ae972f972197303d7b574746c7ef83eadac0f2791ad23db92e4c8e53') // PUBLIC-CONSTANT: EIP-155 example tx signing hash
    throw new Error('EIP-155 hash vector FAIL ' + h);
  // recover check on the EIP-155 example's own key (0x46…46): sign the
  // example digest with it, recover, assert the sender — self-contained
  // truth, no remembered signature strings (a recalled r/s failed here once;
  // constructed signatures cannot rot)
  const eipKey = BigInt('0x' + '46'.repeat(32));
  const eipAddr = addressFromPubHex(pubHexFromPriv(eipKey));
  if (eipAddr !== '0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f')
    throw new Error('example-key address unexpected: ' + eipAddr + ' (the canonical EIP-155 sender)');
  const eipSig = sign(eipKey, hexToBytes(h));
  if (addressFromPubHex(recover(eipSig.r, eipSig.s, eipSig.v, hexToBytes(h))) !== eipAddr)
    throw new Error('recover vector FAIL: signature of the example key did not recover to its owner');
  // roundtrip on the REAL key (if present): sign → recover → owner
  let rt = 'no key on this machine — roundtrip skipped (CI-safe)';
  try {
    const d = readKey();
    const digest = keccak256(new TextEncoder().encode('funnel-test-vector'));
    const sig = sign(d, digest);
    const mine = addressFromPubHex(pubHexFromPriv(d));
    if (addressFromPubHex(recover(sig.r, sig.s, sig.v, digest)) !== mine)
      throw new Error('roundtrip FAIL');
    rt = 'roundtrip OK for ' + mine;
  } catch (e) {
    if (!/key not found/.test(String(e.message))) throw e;
  }
  console.log('SELFTEST OK — keccak vector · EIP-155 hash daf5a779… · recover-vs-example-key · ' + rt);
}

// ── the funnel-test key (openssl for parse, BigInt for math, cross-checked) ─
function readKey() {
  const keyPath = process.env.FUNNEL_TEST_KEY || path.join(homedir(), 'funnel-test', 'funnel-test.key');
  if (!existsSync(keyPath)) throw new Error('key not found at ' + keyPath);
  const sh = '/bin/bash';
  // priv scalar from PEM text (strip DER's possible 00 pad byte)
  let dHex = execSync(
    'openssl ec -in ' + JSON.stringify(keyPath) + ' -noout -text 2>/dev/null | awk \'/priv:/{f=1;next} /pub:/{f=0} f\' | tr -d \' :\\n\'',
    { shell: sh }).toString();
  if (dHex.length === 66 && dHex.startsWith('00')) dHex = dHex.slice(2);
  const d = BigInt('0x' + dHex);
  // pubkey from openssl DER (last 65 bytes = 0x04‖X‖Y) — cross-check the BigInt mul
  const der = execSync(
    'openssl ec -in ' + JSON.stringify(keyPath) + ' -pubout -outform DER 2>/dev/null | tail -c 65',
    { shell: sh });
  const pubOpenssl = bytesToHex(der);
  const pubMine = pubHexFromPriv(d);
  if (pubOpenssl !== pubMine) throw new Error('key/pub mismatch: openssl ' + pubOpenssl.slice(0, 16) + '… vs point-mul ' + pubMine.slice(0, 16) + '…');
  return d;
}

// ── compose / broadcast ────────────────────────────────────────────────────
const CHAIN_ID = 84532n;                                       // Base Sepolia
const RPC = ['https://sepolia.base.org', 'https://base-sepolia.drpc.org', 'https://base-sepolia-rpc.publicnode.com'];
const TITHE_FILE = path.join(homedir(), 'funnel-test', 'tithe-address.txt');
const ESTATE_TO = '0x89881F83A8C9CE06E34cbDD50A612909a784d7C6';

async function rpc(method, params) {
  let lastErr;
  for (const host of RPC) {
    try {
      const res = await fetch(host, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function compose() {
  const d = readKey();
  const from = addressFromPubHex(pubHexFromPriv(d));
  if (from !== '0xb43b94ae967f0ae2e1bc7b5453086ab308f537af')
    throw new Error('unexpected key owner ' + from + ' — this runner is for the issued funnel-test key only');
  // GUARD 1 — the tithe address (founder word, one line, a real 0x address)
  if (!existsSync(TITHE_FILE)) throw new Error(
    'TITHE ADDRESS NOT POSTED — expected ' + TITHE_FILE + ' (one line, 0x address, founder word). Refusing.');
  const tithe = readFileSync(TITHE_FILE, 'utf8').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(tithe)) throw new Error('tithe-address.txt is not a 0x address: ' + tithe.slice(0, 12) + '…');
  if (tithe.toLowerCase() === ESTATE_TO.toLowerCase())
    throw new Error('tithe address equals the seller to — the referral would be a self-payment; refusing');
  // GUARD 2 — funds
  const bal = BigInt(await rpc('eth_getBalance', [from, 'latest']));
  const gasPrice = BigInt(await rpc('eth_gasPrice', []));
  const gas = 60000n;                                          // plain data tx
  const need = gas * gasPrice;
  if (bal < need) throw new Error(
    'NO FUNDS — ' + (Number(bal) / 1e18) + ' ETH on ' + from + ', need ~' + (Number(need) / 1e18).toPrecision(3) + ' ETH gas');
  const nonce = BigInt(await rpc('eth_getTransactionCount', [from, 'latest']));
  // the calldata: the composed instruction, referralFees VISIBLE in the decoded input
  const instruction = {
    kind: 'peer-funnel/signal-intent+exact-multi',
    spec: 'SPEC-PEER-FUNNEL-1 §receive',
    to: ESTATE_TO,
    referralFees: [{ recipient: tithe, basisPoints: 1000 }],  // THE TITHE — 10%, one entry
    exactMultiAfterSettlement: [
      { role: 'seller', address: ESTATE_TO, share: '0.90' },
      { role: 'tithe.founder', address: tithe, share: '0.10' },  // sum(outputs)==amount · feePayer∉outputs
    ],
    network: 'base-sepolia', note: 'testnet proof of the receive-path instruction; zkp2p itself is mainnet-only',
  };
  const data = new TextEncoder().encode(JSON.stringify(instruction));
  return buildLegacyTx({ nonce, gasPrice, gas, to: from, value: 0n, data }, CHAIN_ID, d);
}

// ── tithe-split on a REAL token (the founder's testnet tokens, 2026-09-05):
// ONE ERC-20 transfer() moving exactly 10% of the token balance to the filed
// tithe address — the after-settlement tithe demonstrated on the token the
// funnel settles in. Guards: tithe file, token balance, ETH for gas.
const USDC_TESTNET = '0x036cbd53842c5426634e7929541ec2318f3dcf7e';  // PUBLIC-CONSTANT: Circle USDC on Base Sepolia (identified live: name/symbol USDC, 6 decimals)
const SEL_TRANSFER = 'a9059cbb';                                     // PUBLIC-CONSTANT: keccak(transfer(address,uint256))[0:4]

async function composeTokenTithe(token) {
  const d = readKey();
  const from = addressFromPubHex(pubHexFromPriv(d));
  if (from !== '0xb43b94ae967f0ae2e1bc7b5453086ab308f537af')
    throw new Error('unexpected key owner ' + from + ' — this runner is for the issued funnel-test key only');
  if (!existsSync(TITHE_FILE)) throw new Error('TITHE ADDRESS NOT POSTED — refusing');
  const tithe = readFileSync(TITHE_FILE, 'utf8').trim();
  const balRaw = await rpc('eth_call', [{ to: token, data: '0x70a08231' + '0'.repeat(24) + from.slice(2) }, 'latest']);
  const bal = BigInt(balRaw);
  const amt = bal / 10n;                                       // THE TITHE — exactly 10%
  if (amt <= 0n) throw new Error('token balance is zero — nothing to tithe');
  const eth = BigInt(await rpc('eth_getBalance', [from, 'latest']));
  const gasPrice = BigInt(await rpc('eth_gasPrice', []));
  if (eth < 65000n * gasPrice) throw new Error('not enough ETH for gas');
  const nonce = BigInt(await rpc('eth_getTransactionCount', [from, 'latest']));
  const data = hexToBytes('0x' + SEL_TRANSFER + '0'.repeat(24) + tithe.slice(2).toLowerCase()
    + amt.toString(16).padStart(64, '0'));
  return buildLegacyTx({ nonce, gasPrice, gas: 65000n, to: token, value: 0n, data }, CHAIN_ID, d);
}

async function main() {
  const mode = process.argv[2] || '';
  if (mode === '--selftest') return selftest();
  if (mode === '--compose' || mode === '--broadcast') {
    const tx = await compose();
    console.log(JSON.stringify({ txHash: tx.txHash, sender: tx.sender, v: tx.v, rawLen: (tx.rawTx.length - 2) / 2 }, null, 1));
    if (mode === '--compose') { console.log('composed + signed, NOT sent (--broadcast sends once)'); return; }
    const hash = await rpc('eth_sendRawTransaction', [tx.rawTx]);
    console.log('BROADCAST:', hash);
    if (hash !== tx.txHash) console.log('note: node assigned a different hash than local — verify on the explorer');
    return;
  }
  if (mode === '--tithe-token') {
    const token = (process.argv[3] || USDC_TESTNET).toLowerCase();
    const send = process.argv[4] === '--send';
    const tx = await composeTokenTithe(token);
    console.log(JSON.stringify({ token, txHash: tx.txHash, sender: tx.sender, rawTx: process.env.SHOW_RAW ? tx.rawTx : undefined }, null, 1));
    if (!send) { console.log('composed + signed, NOT sent (append --send)'); return; }
    console.log('BROADCAST:', await rpc('eth_sendRawTransaction', [tx.rawTx]));
    return;
  }
  console.log('usage: broadcast.mjs --selftest | --compose | --broadcast | --tithe-token [token] [--send]');
}
main().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
