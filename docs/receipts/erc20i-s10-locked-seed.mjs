#!/usr/bin/env node
// SPEC-ERC20I-MECHANICS-1 §10 — locked inscriptions: frozen seed vs recompute-from-holder.
//
// Method (the census's own): deployed bytecode read on TWO INDEPENDENT RPCs per chain,
// byte-equality asserted between oracles, live eth_calls cross-read on both, failures
// recorded as failures — never zeros. Read-only: no transaction, no key material.
//
// Evidence assembled:
//   A. bytecode:  getCode x2 RPCs -> equality + keccak256(code) + family selector scan
//   B. disasm:    dispatcher-locate the enumeration getter, census its opcodes.
//                 stored-read fingerprint  = SLOAD>0, SHA3>0, DIV==0, no CALL/STATICCALL
//                 recompute fingerprint    = DIV (balance / 10**decimals) or a
//                                            decimals()/balanceOf external call
//   C. live:      holders enumerated; stored record seeds compared against
//                 floor(balance/10^decimals) and the live spore seed. Any inequality is
//                 a behavioral counterexample to recompute-from-holder.
//
// Run: node docs/receipts/erc20i-s10-locked-seed.mjs

const CHAINS = {
  base: {
    rpcs: ['https://mainnet.base.org', 'https://base.publicnode.com'],
    chainId: '0x2105',
  },
  eth: {
    // cloudflare-eth.com rejects eth_getCode for this contract (persistent "Internal
    // error", response-size policy) — replaced by mevblocker (Flashbots). publicnode is
    // GatewayFM: two independent operators.
    rpcs: ['https://rpc.mevblocker.io', 'https://ethereum-rpc.publicnode.com'],
    chainId: '0x1',
  },
};

// Addresses two-sourced before any call: in-tree (MECHANICS-1 §0 registry,
// EXPLORER_SPEC.md ERC20I_REGISTRY) cross-checked against the probe-session scratchpad
// bs_*.json files; then shape-verified on-chain below (code present + family selectors).
const TARGETS = [
  { id: 'PEPI-BASE', chain: 'base', addr: '0x28a5e71BFc02723eAC17E39c84c5190415C0de9F', model: 'base' },
  { id: 'JELLI', chain: 'base', addr: '0xA1b9d812926a529D8B002E69FCd070c8275eC73c', model: 'base' },
  { id: 'FUNGI', chain: 'base', addr: '0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F', model: 'base' },
  { id: 'PEPI-ETH', chain: 'eth', addr: '0x3103cD1602d5fa8f4b9283F9D5a7fa2290795d51', model: 'item' },
];

// ── keccak-256 (EVM flavor: pad 0x01..0x80), self-tested before use ──────────────────
// BigInt lanes. Tables cross-checked against a working reference implementation before
// adoption; the self-tests below remain the gate: official empty/"abc" vectors plus six
// selectors already documented in-tree (COMPAT-1, inscription-explorer.html).
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
// rotation offsets, flat lane index x + 5y
const RHO = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];
const M64 = 0xffffffffffffffffn;
const rotl = (x, n) => BigInt.asUintN(64, (x << BigInt(n)) | (x >> BigInt(64 - n)));
function keccakF(s) {
  for (let round = 0; round < 24; round++) {
    // theta
    const C = [], D = [];
    for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 25; y += 5) s[x + y] = BigInt.asUintN(64, s[x + y] ^ D[x]);
    // rho + pi
    const b = new Array(25);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], RHO[x + 5 * y]);
    // chi
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 25; y += 5)
        s[x + y] = BigInt.asUintN(64, b[x + y] ^ (BigInt.asUintN(64, ~b[(x + 1) % 5 + y]) & b[(x + 2) % 5 + y]));
    // iota
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

// Self-tests — the selector tests cross-check against selectors already documented
// in-tree (COMPAT-1, inscription-explorer.html), an independent source.
const T = [
  ['', 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'], // PUBLIC-CONSTANT: official keccak-256 test vectors
  ['abc', '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45'], // PUBLIC-CONSTANT: official keccak-256 test vectors
  ['balanceOf(address)', '70a08231'],
  ['decimals()', '313ce567'],
  ['mushroomOfOwnerByIndex(address,uint256)', '0fd9587e'],
  ['mushroomCount(address)', '9c216508'],
  ['sporesDegree(address)', 'a775188a'],
  ['transferItem(address,uint256)', '67c65e99'],
  ['getOwnerItemsPage(address,uint256,uint256)', '92d2036d'],
  ['itemCount(address)', 'c00ae885'],
];
for (const [input, want] of T) {
  const got = input.includes('(')
    ? sel(input)
    : keccak256(Buffer.from(input)).toString('hex').slice(0, want.length);
  if (got !== want) {
    console.error(`KECCAK SELF-TEST FAILED for "${input}": got ${got} want ${want}`);
    process.exit(2);
  }
}

// ── RPC (JSON-RPC over fetch; retries; hard errors — a failed fetch is a failure) ────
async function rpcCall(url, method, params, tries = 6) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: ctl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || 'rpc error');
      return j.result;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error(`RPC ${url} ${method} FAILED after ${tries}: ${lastErr.message}`);
}
// serialize per-oracle with spacing — a parallel burst drew HTTP 429 rate limits
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
console.log(`# rpc oracles up: base=${clients.base.map((c) => c.url).join(' + ')} | eth=${clients.eth.map((c) => c.url).join(' + ')}`);

// ── helpers ─────────────────────────────────────────────────────────────────────────
const pad32 = (v) => BigInt(v).toString(16).padStart(64, '0');
const ad = (a) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const words = (hex) => (hex.slice(2).match(/.{64}/g) || []);
const eth_call = async (chain, to, data) =>
  await clients[chain][0].call('eth_call', [{ to, data: '0x' + data }, 'latest']);
const eth_callBoth = async (chain, to, data) => {
  const a = await clients[chain][0].call('eth_call', [{ to, data: '0x' + data }, 'latest']);
  const b = await clients[chain][1].call('eth_call', [{ to, data: '0x' + data }, 'latest']);
  if (a !== b) throw new Error(`ORACLE DISAGREEMENT on ${to} ${data.slice(0, 10)}: ${a} vs ${b}`);
  return a;
};

// ── minimal disassembler ─────────────────────────────────────────────────────────────
const OPNAMES = {
  0x00: 'STOP', 0x01: 'ADD', 0x02: 'MUL', 0x03: 'SUB', 0x04: 'DIV', 0x0a: 'EXP',
  0x10: 'LT', 0x11: 'GT', 0x14: 'EQ', 0x16: 'AND', 0x1c: 'SHR', 0x1d: 'SHL',
  0x20: 'SHA3', 0x30: 'ADDRESS', 0x33: 'CALLER', 0x35: 'CALLDATALOAD',
  0x36: 'CALLDATASIZE', 0x39: 'CODECOPY', 0x50: 'POP', 0x51: 'MLOAD', 0x52: 'MSTORE',
  0x54: 'SLOAD', 0x55: 'SSTORE', 0x56: 'JUMP', 0x57: 'JUMPI', 0x5b: 'JUMPDEST',
  0x5f: 'PUSH0', 0xf1: 'CALL', 0xfa: 'STATICCALL', 0xf3: 'RETURN', 0xfd: 'REVERT', 0xfe: 'INVALID',
};
function disassemble(codeBuf) {
  const instrs = [];
  const h = codeBuf.toString('hex');
  for (let pc = 0; pc < codeBuf.length; ) {
    const op = codeBuf[pc];
    let imm = null;
    if (op >= 0x60 && op <= 0x7f) {
      const n = op - 0x5f;
      imm = h.slice((pc + 1) * 2, (pc + 1 + n) * 2);
      instrs.push({ pc, op, imm, name: `PUSH${n}` });
      pc += 1 + n;
    } else {
      instrs.push({ pc, op, imm, name: OPNAMES[op] || `OP${op.toString(16)}` });
      pc += 1;
    }
  }
  return instrs;
}
// Solidity dispatcher: PUSH4 <sel> EQ [PUSH0/PUSH2 dest] JUMPI — follow to the body.
function extractBody(codeBuf, selector) {
  const instrs = disassemble(codeBuf);
  const jumpdest = new Map(instrs.filter((x) => x.op === 0x5b).map((x) => [x.pc, x]));
  for (let i = 0; i < instrs.length - 4; i++) {
    const a = instrs[i], b = instrs[i + 1], c = instrs[i + 2], d = instrs[i + 3];
    if (a.name === 'PUSH4' && a.imm === selector && b.op === 0x14 &&
        c && c.name.startsWith('PUSH') && d && d.op === 0x57) {
      const dest = parseInt(c.imm, 16);
      const start = instrs.findIndex((x) => x.op === 0x5b && x.pc === dest);
      if (start < 0) continue;
      // STRICT: the getter's own code — linear from entry, past dead guard REVERTs,
      // to the first RETURN/STOP (Solidity getters are linear)
      const strict = [];
      for (let j = start; j < instrs.length && strict.length < 700; j++) {
        strict.push(instrs[j]);
        if (instrs[j].op === 0xf3 || instrs[j].op === 0x00) break;
      }
      // UNION: strict plus every JUMPDEST reachable via PUSH immediates inside it
      // (Solidity factors shared helpers out) — an upper bound on what the getter
      // can transitively execute
      const seen = new Set();
      const queue = [start];
      const union = [];
      let guard = 0;
      while (queue.length && guard++ < 24) {
        let terminal = false;
        for (let j = queue.shift(); j < instrs.length && union.length < 2000 && !terminal; j++) {
          if (seen.has(j)) break;
          seen.add(j);
          const x = instrs[j];
          union.push(x);
          if (x.op === 0xf3 || x.op === 0x00) terminal = true;
          if (x.name && x.name.startsWith('PUSH') && x.imm && x.imm.length <= 6) {
            const t = parseInt(x.imm, 16);
            if (jumpdest.has(t)) {
              const ti = instrs.findIndex((y) => y.op === 0x5b && y.pc === t);
              if (ti >= 0 && !seen.has(ti)) queue.push(ti);
            }
          }
        }
      }
      union.sort((x, y) => x.pc - y.pc);
      return { entry: dest, strict, union };
    }
  }
  return null;
}
function census(body) {
  const count = (op) => body.filter((x) => x.op === op).length;
  return {
    len: body.length,
    SLOAD: count(0x54), SHA3: count(0x20), DIV: count(0x04), EXP: count(0x0a),
    CALL: count(0xf1), STATICCALL: count(0xfa),
  };
}

// ── A + B: bytecode two-source equality, selector scan, getter disassembly ───────────
const ENUM_SEL = { base: '0fd9587e', item: '92d2036d' }; // mushroomOfOwnerByIndex | getOwnerItemsPage
const FAMILY_SELECTORS = {
  '0fd9587e': 'mushroomOfOwnerByIndex(address,uint256)',
  '9c216508': 'mushroomCount(address)',
  'a775188a': 'sporesDegree(address)',
  '92d2036d': 'getOwnerItemsPage(address,uint256,uint256)',
  'c00ae885': 'itemCount(address)',
  '67c65e99': 'transferItem(address,uint256)',
  'a435130b': 'getSvg(tuple3)',
  '422b9e23': 'getSvg(tuple3-alt)',
  '058e7a31': 'getSvg(tuple4-uint8)',
};
const codeCache = {};
for (const t of TARGETS) {
  const codes = await Promise.all(clients[t.chain].map((c) => c.call('eth_getCode', [t.addr, 'latest'])));
  if (codes[0] !== codes[1])
    throw new Error(`${t.id}: ORACLE DISAGREEMENT on code — refusing to proceed`);
  const buf = Buffer.from(codes[0].slice(2), 'hex');
  if (buf.length === 0) throw new Error(`${t.id}: NO CODE at ${t.addr} — wrong address?`);
  codeCache[t.id] = buf;
  const k = keccak256(buf).toString('hex');
  const present = Object.keys(FAMILY_SELECTORS).filter((s) => buf.toString('hex').includes(s));
  console.log(`\n## ${t.id} ${t.addr}`);
  console.log(`   code: ${buf.length} B, keccak256=${k}, EQUAL on both oracles: yes`);
  console.log(`   selectors in bytecode: ${present.join(' ') || 'NONE'}`);
  const body = extractBody(buf, ENUM_SEL[t.model]);
  if (!body) { console.log(`   !! enumeration getter body NOT FOUND by dispatcher scan`); continue; }
  const cs = census(body.strict), cu = census(body.union);
  const verdict = (c) => c.SLOAD > 0 && c.DIV === 0 && c.CALL === 0 && c.STATICCALL === 0
    ? 'STORED-READ (SLOAD, no DIV, no external calls)'
    : c.CALL === 0 && c.STATICCALL === 0
      ? 'no-external-calls (DIV present — shared helpers; inspect)'
      : 'external calls present — inspect';
  console.log(`   ${FAMILY_SELECTORS[ENUM_SEL[t.model]]} entry @0x${body.entry.toString(16)}`);
  console.log(`     strict (own code)     : ${JSON.stringify(cs)} => ${verdict(cs)}`);
  console.log(`     union  (+jump closure): ${JSON.stringify(cu)} => ${verdict(cu)}`);
  console.log(`     strict head: ${body.strict.slice(0, 20).map((x) => (x.imm ? `${x.name}(0x${x.imm})` : x.name)).join(' ')}`);
}

// ── C1: Base live — stored record seeds vs balance floor vs live spore ────────────────
async function probeBase(t, holderSeedAddresses) {
  const to = t.addr;
  const dec = BigInt(await eth_callBoth(t.chain, to, sel('decimals()')));
  const unit = 10n ** dec;
  console.log(`\n## ${t.id} live (decimals=${dec})`);
  if (!codeCache[t.id].toString('hex').includes('9c216508')) {
    console.log(`   mushroomCount selector ABSENT from bytecode — enumeration model diverges from the family; live probe skipped, divergence RECORDED`);
    return;
  }
  const known = [];
  try {
    const hc = await eth_callBoth(t.chain, to, sel('holdersCount()'));
    const n = Number(BigInt(hc));
    console.log(`   holdersCount=${n}`);
    // gentle sequential walk on the SECOND oracle (a parallel burst on the first drew
    // HTTP 429s); decisive reads below remain cross-verified on BOTH
    const walkN = Math.min(n, 300);
    for (let i = 0; i < walkN; i++) {
      const h = await clients[t.chain][1].call('eth_call',
        [{ to, data: '0x' + sel('getHolderByIndex(uint256)') + pad32(i) }, 'latest']);
      if (BigInt(h) !== 0n) known.push('0x' + h.slice(26));
      if (i % 25 === 24) await new Promise((r) => setTimeout(r, 150));
    }
  } catch (e) {
    console.log(`   holdersCount/getHolderByIndex FAILED: ${e.message} — proceeding with seed holders only`);
  }
  for (const h of holderSeedAddresses) if (!known.includes(h.toLowerCase())) known.push(h);

  let detailed = 0, counterexamples = 0, zeroBalWithRecords = 0, checked = 0;
  for (const h of known) {
    if (detailed >= 8) break;
    let mc;
    try { mc = await eth_call(t.chain, to, sel('mushroomCount(address)') + ad(h)); }
    catch (e) { console.log(`   mushroomCount(${h.slice(0, 10)}…) FAILED: ${e.message}`); continue; }
    if (!mc.startsWith('0x')) continue;
    const n = Number(BigInt(mc));
    if (n === 0) continue;
    checked++;
    // decisive reads cross-verified on BOTH oracles
    const bal = await eth_callBoth(t.chain, to, sel('balanceOf(address)') + ad(h));
    const balW = BigInt(bal) / unit;
    const rows = [];
    for (let i = 0; i < Math.min(n, 3); i++) {
      const r = await eth_callBoth(t.chain, to, sel('mushroomOfOwnerByIndex(address,uint256)') + ad(h) + pad32(i));
      const w = words(r);
      if (w.length < 2) {
        console.log(`     rec[${i}] return width ${w.length} words — unparseable; recorded: ${w.join(' ').slice(0, 96)}`);
        continue;
      }
      // PEPI-BASE returns 3 words (seed, seed2, extra); FUNGI measured 2 (seed, seed2)
      rows.push({
        seed: BigInt('0x' + w[0]),
        seed2: BigInt('0x' + w[1]),
        extra: w.length >= 3 ? BigInt('0x' + w[2]) : null,
      });
    }
    if (!rows.length) continue;
    let sporeSeed = null;
    try {
      const sd = await eth_callBoth(t.chain, to, sel('sporesDegree(address)') + ad(h));
      sporeSeed = BigInt('0x' + words(sd)[0]);
    } catch { sporeSeed = 'REVERT'; }
    const distinct = new Set(rows.map((x) => x.seed.toString())).size > 1;
    const mismatch = rows.some((x) => x.seed !== balW);
    const zb = balW === 0n;
    if (mismatch) counterexamples++;
    if (zb) zeroBalWithRecords++;
    detailed++;
    console.log(`   holder ${h} mushrooms=${n} balanceWhole=${balW} sporeSeed=${sporeSeed}`);
    for (const [i, x] of rows.entries())
      console.log(`     rec[${i}] seed=${x.seed} seed2=0x${x.seed2.toString(16).slice(0, 16)}…` +
        (x.extra ? ` extra=0x${x.extra.toString(16).slice(0, 16)}…` : ' (2-word record)') +
        (x.seed === balW ? '  (== balance floor)' : '  (!= balance floor — NOT balance-derived)'));
    if (distinct) console.log(`     ^^ multiple distinct stored seeds in one wallet — one balance cannot produce both`);
    if (zb) console.log(`     ^^ ZERO whole-token balance with ${n} stored record(s) — enumeration returns data with nothing to recompute from`);
  }
  console.log(`   SUMMARY ${t.id}: holders-with-records examined=${checked}, counterexamples-to-recompute=${counterexamples}, zeroBalanceWithRecords=${zeroBalWithRecords}`);
}

await probeBase(TARGETS[0], ['0xb6764607c69c13cc66205bf80eeee1b719a1bda9']); // PEPI-BASE (+ locked.js holder)
await probeBase(TARGETS[1], []); // JELLI — family breadth; holder-list getters may not exist
await probeBase(TARGETS[2], []); // FUNGI

// ── C2: ETH item model live — stored items vs balance; art answers the stored triple ─
{
  const t = TARGETS[3], to = t.addr;
  console.log(`\n## PEPI-ETH live (item model)`);
  const unit = 10n ** BigInt(await eth_callBoth(t.chain, to, sel('decimals()')));
  // holder candidates: dEaD (prior probe), the dormant marketplace escrow, and Blockscout's list
  const cands = ['0x000000000000000000000000000000000000dEaD', '0x7261c6464975785047d050f3Dda1E9C471644388'];
  try {
    const r = await fetch(`https://eth.blockscout.com/api/v2/tokens/${to}/holders`, { signal: AbortSignal.timeout(20000) });
    if (r.ok) {
      const j = await r.json();
      for (const it of (j.items || []).slice(0, 12)) cands.push(it.address.hash);
      console.log(`   blockscout holders listed: ${(j.items || []).length}`);
    } else console.log(`   blockscout holders HTTP ${r.status} — recorded as failure, continuing with seed candidates`);
  } catch (e) { console.log(`   blockscout holders FAILED: ${e.message} — continuing with seed candidates`); }

  let shown = 0;
  for (const h of cands) {
    if (shown >= 4) break;
    let ic;
    try { ic = await eth_callBoth(t.chain, to, sel('itemCount(address)') + ad(h)); }
    catch (e) { console.log(`   itemCount(${h.slice(0, 10)}…) FAILED: ${e.message}`); continue; }
    if (!ic.startsWith('0x')) { console.log(`   itemCount(${h.slice(0, 10)}…) reverted`); continue; }
    const n = Number(BigInt(ic));
    if (n === 0) continue;
    const bal = await eth_callBoth(t.chain, to, sel('balanceOf(address)') + ad(h));
    const page = await eth_callBoth(t.chain, to, sel('getOwnerItemsPage(address,uint256,uint256)') + ad(h) + pad32(0) + pad32(Math.min(n, 3)));
    const w = words(page);
    // returns (uint[] itemIds, SeedData[] items, uint total): heads = [idsOff, itemsOff, total]
    const total = BigInt('0x' + w[2]);
    const idsA = Number(BigInt('0x' + w[0]) / 32n);   // ids array: [len, id…]
    const itemsA = Number(BigInt('0x' + w[1]) / 32n); // items array: [len, (lvl,value,seed1,seed2)…]
    console.log(`   holder ${h} itemCount=${n} balanceWhole=${BigInt(bal) / unit} pageTotal=${total}`);
    for (let i = 0; i < Math.min(n, 3); i++) {
      const id = BigInt('0x' + w[idsA + 1 + i]);
      const b0 = itemsA + 1 + 4 * i; // lvl,value,seed1,seed2
      const lvl = BigInt('0x' + w[b0]), value = BigInt('0x' + w[b0 + 1]), s1 = BigInt('0x' + w[b0 + 2]), s2 = BigInt('0x' + w[b0 + 3]);
      console.log(`     item#${id} lvl=${lvl} value=${value} seed1=0x${s1.toString(16).slice(0, 16)}… seed2=0x${s2.toString(16).slice(0, 16)}…`);
      if (shown === 0 && value > 0n && value <= 8n) {
        try {
          const svg = await eth_callBoth(t.chain, to, sel('getSvg((uint8,uint256,uint256,uint256))') + pad32(lvl) + pad32(value) + pad32(s1) + pad32(s2));
          const sw = words(svg);
          const len = BigInt(sw[1]);
          console.log(`     getSvg(stored triple) => ${len} B SVG — the art answers the STORED seeds`);
        } catch (e) { console.log(`     getSvg(stored triple) FAILED: ${e.message}`); }
      }
    }
    shown++;
  }
  if (!shown) console.log(`   !! no holder with items found among candidates — behavioral leg incomplete (bytecode+disasm legs stand)`);
}

console.log('\n# done — read-only, no transaction, no key material');
