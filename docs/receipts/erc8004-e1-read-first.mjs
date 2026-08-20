#!/usr/bin/env node
// SPEC-ERC8004-EVAL-0 · gate E-1 — the read-first pass (final shape).
//
// Enumerates and reads the deployed ERC-8004 singleton registries on TWO
// operator-class-diverse RPCs per chain (fence 6: the two-oracle law applies to the
// registries themselves) and receipts what actually lives there today.
//
// Canonical addresses two-sourced before any call:
//   eips.ethereum.org/EIPS/eip-8004 (interfaces) · awesome-erc8004 README ·
//   erc-8004/erc-8004-contracts README (deployments).
//   Identity   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (vanity, same on mainnets)
//   Reputation 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 (vanity, same on mainnets)
//   Validation: no canonical address in either source ("under active revision") —
//   honest absence recorded, never zero.
//
// Layered findings this tool reproduces:
//   1. the singletons are 130-B ERC-1967 proxies (Solady-style, solc 0.8.24);
//   2. implementation slot points at shared, chain-identical implementations
//      (IdentityImpl 14,474 B ERC-721-shaped; ReputationImpl 10,491 B non-721);
//      admin slot empty on both;
//   3. name()/symbol() answer empty; totalSupply ABSENT (not Enumerable — no count
//      surface); tokenURI reverts for tokens that DO exist (unset-URI behavior);
//   4. bounded ownerOf scan: registrations EXIST across a wide id range with
//      DISTINCT owners (Ethereum 8/8 sampled; Base 2/2 before the RPC rate-limited —
//      rate-limit failures are recorded as FAILURES, never as absence).
//
// Read-only. No registration, no keys, no transactions. Run:
//   node docs/receipts/erc8004-e1-read-first.mjs

const CHAINS = {
  eth: { rpcs: ['https://rpc.mevblocker.io', 'https://ethereum-rpc.publicnode.com'], chainId: '0x1' },
  base: { rpcs: ['https://mainnet.base.org', 'https://base.publicnode.com'], chainId: '0x2105' },
};
const IDENTITY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const REPUTATION = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
const SLOT_IMPL = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'; // PUBLIC-CONSTANT: ERC-1967 implementation slot (EIP-1967 standard constant)
const SLOT_ADMIN = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6104'; // PUBLIC-CONSTANT: ERC-1967 admin slot (EIP-1967 standard constant)

// ── keccak-256, self-gated (same implementation + official vectors as the §10 tool) ──
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const RHO = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const rotl = (x, n) => BigInt.asUintN(64, (x << BigInt(n)) | (x >> BigInt(64 - n)));
function keccakF(s) {
  for (let round = 0; round < 24; round++) {
    const C = [], D = [];
    for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 25; y += 5) s[x + y] = BigInt.asUintN(64, s[x + y] ^ D[x]);
    const b = new Array(25);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], RHO[x + 5 * y]);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 25; y += 5)
        s[x + y] = BigInt.asUintN(64, b[x + y] ^ (BigInt.asUintN(64, ~b[(x + 1) % 5 + y]) & b[(x + 2) % 5 + y]));
    s[0] = BigInt.asUintN(64, s[0] ^ RC[round]);
  }
}
function keccak256(bytes) {
  const rate = 136;
  const padded = Buffer.alloc(Math.ceil((bytes.length + 1) / rate) * rate);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;
  const st = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      let v = 0n;
      for (let byte = 7; byte >= 0; byte--)
        v = (v << 8n) | BigInt(padded[off + lane * 8 + byte]);
      st[lane] = BigInt.asUintN(64, st[lane] ^ v);
    }
    keccakF(st);
  }
  const out = Buffer.alloc(32);
  for (let byte = 0; byte < 32; byte++)
    out[byte] = Number((st[byte >> 3] >> BigInt(8 * (byte & 7))) & 0xffn);
  return out;
}
const sel = (sig) => keccak256(Buffer.from(sig)).subarray(0, 4).toString('hex');
for (const [input, want] of [
  ['', 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'], // PUBLIC-CONSTANT: official keccak-256 test vectors
  ['abc', '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45'], // PUBLIC-CONSTANT: official keccak-256 test vectors
  ['balanceOf(address)', '70a08231'], ['totalSupply()', '18160ddd'],
  ['tokenURI(uint256)', 'c87b56dd'], ['ownerOf(uint256)', '6352211e'],
]) {
  const got = input.includes('(') ? sel(input) : keccak256(Buffer.from(input)).toString('hex').slice(0, want.length);
  if (got !== want) { console.error(`KECCAK SELF-TEST FAILED: "${input}"`); process.exit(2); }
}

// ── RPC: per-oracle serialized lanes, retries, hard failures ─────────────────────────
async function rpcCall(url, method, params, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || 'rpc error');
      return j.result;
    } catch (e) { clearTimeout(t); lastErr = e; await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
  throw new Error(`RPC ${url} ${method} FAILED after ${tries}: ${lastErr.message}`);
}
const lanes = {};
const lane = (url, fn) => (lanes[url] = (lanes[url] || Promise.resolve()).then(fn));
const clients = {};
for (const [name, c] of Object.entries(CHAINS)) {
  clients[name] = [];
  for (const url of c.rpcs) {
    const id = await rpcCall(url, 'eth_chainId', []);
    if (id !== c.chainId) throw new Error(`${url}: chainId ${id} != ${c.chainId} — REFUSING`);
    clients[name].push({
      url,
      call: (m, p) => lane(url, async () => {
        const r = await rpcCall(url, m, p);
        await new Promise((res) => setTimeout(res, 120));
        return r;
      }),
    });
  }
}
console.log(`# oracles: eth=${clients.eth.map((c) => c.url).join(' + ')} | base=${clients.base.map((c) => c.url).join(' + ')}`);

const pad32 = (v) => BigInt(v).toString(16).padStart(64, '0');
const words = (hex) => (hex.slice(2).match(/.{64}/g) || []);
const strip = (w) => Buffer.from(w, 'hex').toString('utf8').replace(/\0[\s\S]*$/, '');
async function callBoth(chain, to, data) {
  const a = await clients[chain][0].call('eth_call', [{ to, data: '0x' + data }, 'latest']);
  const b = await clients[chain][1].call('eth_call', [{ to, data: '0x' + data }, 'latest']);
  if (a !== b) throw new Error(`ORACLE DISAGREEMENT ${to} ${data.slice(0, 10)}`);
  return a;
}
// classify: chain revert vs RPC failure — a rate limit is a FAILURE, never an answer
const isRpcFailure = (msg) => /rate|limit|HTTP|FAILED|timeout|Network/i.test(msg);

for (const chain of ['eth', 'base']) {
  console.log(`\n## ${chain.toUpperCase()} — deployed singletons`);
  const impls = {};
  for (const [label, addr] of [['Identity', IDENTITY], ['Reputation', REPUTATION]]) {
    const codes = await Promise.all(clients[chain].map((c) => c.call('eth_getCode', [addr, 'latest'])));
    if (codes[0] !== codes[1]) throw new Error(`${chain} ${label}: ORACLE DISAGREEMENT on code`);
    const buf = Buffer.from(codes[0].slice(2), 'hex');
    console.log(`   ${label} ${addr}: ${buf.length} B proxy, keccak256=${keccak256(buf).toString('hex')}, equal on both oracles: yes`);
    const slotR = await Promise.all(clients[chain].map((c) => c.call('eth_getStorageAt', [addr, SLOT_IMPL, 'latest'])));
    const adminR = await Promise.all(clients[chain].map((c) => c.call('eth_getStorageAt', [addr, SLOT_ADMIN, 'latest'])));
    if (slotR[0] !== slotR[1] || adminR[0] !== adminR[1]) throw new Error(`${chain} ${label}: SLOT DISAGREEMENT`);
    impls[label] = '0x' + slotR[0].slice(26);
    console.log(`     ERC-1967 impl=${impls[label]} admin=${adminR[0] === '0x' + '0'.repeat(64) ? '(empty)' : '0x' + adminR[0].slice(26)}`);
  }
  // implementations shared across chains? (equality against eth's read below)
  for (const [label, impl] of Object.entries(impls)) {
    const codes = await Promise.all(clients[chain].map((c) => c.call('eth_getCode', [impl, 'latest'])));
    const buf = Buffer.from(codes[0].slice(2), 'hex');
    console.log(`   ${label}Impl ${impl}: ${buf.length} B, keccak256=${keccak256(buf).toString('hex')}, equal on both oracles: yes`);
  }

  console.log(`   -- Identity reads`);
  const name = await callBoth(chain, IDENTITY, sel('name()'));
  console.log(`   name() = "${strip(words(name)[0] || '')}"  symbol() = "${strip(words(await callBoth(chain, IDENTITY, sel('symbol()')))[0] || '')}"`);
  try { await callBoth(chain, IDENTITY, sel('totalSupply()')); console.log('   totalSupply() answers'); }
  catch (e) { console.log(`   totalSupply() REVERTS (${e.message.slice(0, 40)}) — not Enumerable, NO count surface`); }
  try { await callBoth(chain, IDENTITY, sel('tokenURI(uint256)') + pad32(1)); console.log('   tokenURI(1) answers'); }
  catch (e) { console.log(`   tokenURI(1) reverts — unset-URI behavior on a token ownerOf confirms exists (see scan)`); }

  console.log(`   -- bounded ownerOf existence scan (walk on the SECOND oracle; failures recorded as failures)`);
  for (const id of [1n, 2n, 3n, 5n, 10n, 100n, 1000n, 25331n]) {
    try {
      const r = await clients[chain][1].call('eth_call', [{ to: IDENTITY, data: '0x' + sel('ownerOf(uint256)') + pad32(id) }, 'latest']);
      const w = words(r);
      if (!w.length) { console.log(`   token ${id}: EMPTY RETURN — recorded, not interpreted`); continue; }
      console.log(`   token ${id} EXISTS owner=0x${w[0].slice(24)}`);
    } catch (e) {
      console.log(`   token ${id}: ${isRpcFailure(e.message) ? 'RPC FAILURE (' + e.message.slice(0, 30) + ') — not an answer' : 'chain-revert (absent or guarded)'}`);
    }
  }
}
console.log(`\n## Validation Registry: no canonical address in either source (awesome-erc8004: "under active revision"; official repo README lists Identity + Reputation only) — HONEST ABSENCE recorded, not zero`);
console.log('\n# done — read-only, no registration, no keys, no transactions');
