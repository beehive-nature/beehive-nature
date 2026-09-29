// Signed-fixture generator for the watchpay Connect adapter tests.
//
// WHAT THIS PROVES: the signed transactions pinned in
// ../../tests/adapter_signing.rs are produced by @ethereumjs/tx — the exact
// serialization family @trezor/connect 9.7.3 itself depends on
// ("@ethereumjs/tx": "^10.1.0" in its package.json; serializeEthereumTx
// calls createTx(...).serialize()) — and the request/response field shapes
// match the Connect contract read from the installed package source.
//
// OFFLINE: no SDK initialization, no device, no Serve/iframe, no network of
// any kind. The synthetic keys below are PUBLIC TEST VALUES invented here —
// never a wallet, seed, keyring or token read from this machine.
//
// Run: npm install --ignore-scripts && node gen.js

'use strict';

const { createTx, createTxFromRLP } = require('@ethereumjs/tx');
const { createCustomCommon, Mainnet } = require('@ethereumjs/common');
const { bytesToHex, hexToBytes } = require('@ethereumjs/util');

// ---- Synthetic inputs (mirror crates/watchpay/src/test_support.rs) ----
const CHAIN_ID = 42161;
const VAULT = '0x00000000000000000000000000000000000000b2'; // synthetic vault fixture
const TOKEN = '0x00000000000000000000000000000000000000a1'; // synthetic token fixture
const TS = 1757717400; // SYNTH_TS in test_support.rs
const NONCE = 7;
const GAS = 500000n;
const FEE_CAP = 100000000000n; // 100 gwei
const PRIORITY = 1000000000n; // 1 gwei

// PUBLIC synthetic test key (invented for this generator; PUBLIC-CONSTANT marker
// lives where the hex is pinned in the Rust test — see tests/adapter_signing.rs).
const SEED = hexToBytes(
  '0x' + '02'.repeat(31) + '2a'
);

// payForMerkleTree calldata replicating this crate's composer layout for the
// depth-2 base batch of test_support.rs (pools: 1..=16 tagged 1, all-ones tagged 2).
function word32(bytes) {
  const out = new Uint8Array(32);
  out.set(bytes, 32 - bytes.length);
  return out;
}
function u64be(v) {
  const out = new Uint8Array(8);
  let x = BigInt(v);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}
function payForMerkleTreeCalldata() {
  const selector = hexToBytes('0x5460f240');
  const parts = [selector, word32(Uint8Array.of(2)), word32(u64be(0x60)), word32(u64be(BigInt(TS)))];
  const pools = [];
  const mkPool = (tag, amounts) => {
    const hash = new Uint8Array(32);
    hash[0] = tag;
    const pool = [...hash];
    for (let j = 0; j < 16; j++) {
      // test_support.rs synth_addr(tag * 16 + j): [18] = id>>8, [19] = id&0xff.
      const id = tag * 16 + j;
      const addr = new Uint8Array(20);
      addr[18] = id >> 8;
      addr[19] = id & 0xff;
      pool.push(...word32(addr));
      const amt = new Uint8Array(32);
      let v = BigInt(amounts[j]);
      for (let i = 31; i >= 0 && v > 0n; i--) {
        amt[i] = Number(v & 0xffn);
        v >>= 8n;
      }
      pool.push(...amt);
    }
    return Uint8Array.from(pool);
  };
  pools.push(mkPool(1, Array.from({ length: 16 }, (_, i) => i + 1)));
  pools.push(mkPool(2, Array.from({ length: 16 }, () => 1)));
  parts.push(word32(u64be(BigInt(pools.length))));
  for (const p of pools) parts.push(p);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function approveCalldata() {
  // approve(vault, 36) — the base plan's derived ceiling (sum of batch ceilings).
  const selector = hexToBytes('0x095ea7b3');
  const spender = new Uint8Array(20);
  spender[19] = 0xb2;
  const amount = new Uint8Array(32);
  amount[31] = 36;
  const out = new Uint8Array(4 + 32 + 32);
  out.set(selector, 0);
  out.set(word32(spender), 4);
  out.set(amount, 36);
  return out;
}

const common = createCustomCommon({ chainId: CHAIN_ID }, Mainnet);

function hexOf(bytes) {
  return bytesToHex(bytes);
}
function bigintHex(v) {
  return '0x' + v.toString(16);
}

function buildAndSign(kind) {
  let txData;
  if (kind === 'legacy') {
    txData = {
      type: 0,
      nonce: BigInt(NONCE),
      gasPrice: FEE_CAP,
      gasLimit: GAS,
      to: VAULT,
      value: 0n,
      data: payForMerkleTreeCalldata(),
      chainId: BigInt(CHAIN_ID),
    };
  } else if (kind === '1559') {
    txData = {
      type: 2,
      chainId: BigInt(CHAIN_ID),
      nonce: BigInt(NONCE),
      maxPriorityFeePerGas: PRIORITY,
      maxFeePerGas: FEE_CAP,
      gasLimit: GAS,
      to: VAULT,
      value: 0n,
      data: payForMerkleTreeCalldata(),
    };
  } else if (kind === 'approve-1559') {
    txData = {
      type: 2,
      chainId: BigInt(CHAIN_ID),
      nonce: 0n,
      maxPriorityFeePerGas: PRIORITY,
      maxFeePerGas: FEE_CAP,
      gasLimit: GAS,
      to: TOKEN,
      value: 0n,
      data: approveCalldata(),
    };
  } else {
    throw new Error('unknown kind ' + kind);
  }
  const tx = createTx(txData, { common });
  const signed = tx.sign(SEED);
  const v =
    kind === 'legacy'
      ? signed.v // EIP-155 form (2*chainId + 35 + recid) on the signed legacy tx
      : signed.v; // typed txs carry yParity in v ({0,1})
  return {
    kind,
    serializedTx: hexOf(signed.serialize()),
    v: bigintHex(v),
    r: bigintHex(signed.r),
    s: bigintHex(signed.s),
    sender: signed.getSenderAddress().toString(),
    txHash: hexOf(signed.hash()),
    calldata: hexOf(txData.data),
  };
}

// The EIP-155 spec's own published example transaction (chain 1, nonce 9,
// key 0x4646..46). Bytes verbatim from the EIP text; we only ask ethereumjs
// to recover its sender and hash so the Rust test can pin both against OUR
// independent decoder/ecrecover.
const EIP155_SPEC_TX =
  '0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83'; // PUBLIC-CONSTANT: EIP-155 spec's published example transaction

const specTx = createTxFromRLP(hexToBytes(EIP155_SPEC_TX));

const out = {
  generator: 'gen-connect-fixtures (this directory)',
  trezorConnectPin: require('@trezor/connect/package.json').version,
  ethereumjsTx: (() => {
    // @ethereumjs/tx is a transitive dep of @trezor/connect (hoisted here);
    // resolve its version without relying on hoisting depth.
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(require.resolve('@ethereumjs/tx'));
    return JSON.parse(fs.readFileSync(path.join(dir, '..', '..', 'package.json'))).version;
  })(),
  fixtures: [buildAndSign('legacy'), buildAndSign('1559'), buildAndSign('approve-1559')],
  eip155SpecVector: {
    serializedTx: EIP155_SPEC_TX,
    senderPerEthereumjs: specTx.getSenderAddress().toString(),
    txHashPerEthereumjs: hexOf(specTx.hash()),
    signingHashPerEthereumjs: hexOf(specTx.getHashedMessageToSign()),
  },
};
console.log(JSON.stringify(out, null, 2));
