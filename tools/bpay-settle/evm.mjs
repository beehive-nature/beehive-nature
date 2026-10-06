// evm.mjs — the independent EVM reader every EVM settlement adapter shares.
//
// It answers one question from the chain itself: did token T move amount A to
// recipient R in transaction X, and is that block final? It never asks the
// wallet, the bundler or the vendor. Two RPC operators must return the same
// receipt for the strongest evidence class; one operator alone is reported
// one class lower, never rounded up (RECON-1: the class is never upgraded).
//
// Selectors and topics are computed from their signatures at load, with the
// keccak self-test from docs/receipts/erc8004-e1-read-first.mjs, so no hash
// literal is trusted from a document.

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
    for (let x = 0; x < 5; x++) for (let y = 0; y < 25; y += 5) s[x + y] = BigInt.asUintN(64, s[x + y] ^ D[x]);
    const b = new Array(25);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], RHO[x + 5 * y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 25; y += 5)
      s[x + y] = BigInt.asUintN(64, b[x + y] ^ (BigInt.asUintN(64, ~b[(x + 1) % 5 + y]) & b[(x + 2) % 5 + y]));
    s[0] = BigInt.asUintN(64, s[0] ^ RC[round]);
  }
}
export function keccak256(bytes) {
  const rate = 136;
  const padded = Buffer.alloc(Math.ceil((bytes.length + 1) / rate) * rate);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;
  const st = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      let v = 0n;
      for (let byte = 7; byte >= 0; byte--) v = (v << 8n) | BigInt(padded[off + lane * 8 + byte]);
      st[lane] = BigInt.asUintN(64, st[lane] ^ v);
    }
    keccakF(st);
  }
  const out = Buffer.alloc(32);
  for (let byte = 0; byte < 32; byte++) out[byte] = Number((st[byte >> 3] >> BigInt(8 * (byte & 7))) & 0xffn);
  return out;
}
export const selector = (sig) => "0x" + keccak256(Buffer.from(sig)).subarray(0, 4).toString("hex");
export const topic = (sig) => "0x" + keccak256(Buffer.from(sig)).toString("hex");
// self-test against selectors every EVM tool agrees on; a broken keccak stops the module
for (const [sig, want] of [["balanceOf(address)", "0x70a08231"], ["transfer(address,uint256)", "0xa9059cbb"], ["approve(address,uint256)", "0x095ea7b3"]])
  if (selector(sig) !== want) throw new Error(`keccak self-test failed on ${sig}`);

const PERM = "(address,address,address,uint160,uint48,uint48,uint48,uint256,bytes)";
export const SEL = {
  transfer: selector("transfer(address,uint256)"),
  approve: selector("approve(address,uint256)"),
  balanceOf: selector("balanceOf(address)"),
  spend: selector(`spend(${PERM},uint160)`),
  approveWithSignature: selector(`approveWithSignature(${PERM},bytes)`),
  getCurrentPeriod: selector(`getCurrentPeriod(${PERM})`),
  isOwnerAddress: selector("isOwnerAddress(address)"),
  nextOwnerIndex: selector("nextOwnerIndex()"),
  // Smart Wallet owner management and upgrade (coinbase/smart-wallet src/MultiOwnable.sol,
  // src/CoinbaseSmartWallet.sol): named only so a guard can say what it refused.
  addOwnerAddress: selector("addOwnerAddress(address)"),
  addOwnerPublicKey: selector("addOwnerPublicKey(bytes32,bytes32)"),
  removeOwnerAtIndex: selector("removeOwnerAtIndex(uint256,bytes)"),
  removeLastOwner: selector("removeLastOwner(uint256,bytes)"),
  upgradeToAndCall: selector("upgradeToAndCall(address,bytes)"),
  executeWithoutChainIdValidation: selector("executeWithoutChainIdValidation(bytes[])"),
};
export const TOPIC = {
  Transfer: topic("Transfer(address,address,uint256)"),
  UserOperationEvent: topic("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)"),
};

// ── ABI words ───────────────────────────────────────────────────────────────
export const isAddr = (a) => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
export const lc = (a) => String(a).toLowerCase();
export const word = (v) => BigInt(v).toString(16).padStart(64, "0");
export const addrWord = (a) => lc(a).slice(2).padStart(64, "0");
export function words(data) {
  const hex = lc(data).replace(/^0x/, "");
  if (hex.length < 8 || (hex.length - 8) % 64 !== 0) throw new Error("calldata is not selector + 32-byte words");
  const out = [];
  for (let i = 8; i < hex.length; i += 64) out.push(hex.slice(i, i + 64));
  return { selector: "0x" + hex.slice(0, 8), words: out };
}
export const wordAddr = (w) => "0x" + w.slice(24);
export const wordInt = (w) => BigInt("0x" + w);

export function encodeTransfer(to, atto) { return SEL.transfer + addrWord(to) + word(atto); }
export function decodeTransfer(data) {
  const { selector: s, words: w } = words(data);
  if (s !== SEL.transfer || w.length !== 2 || w[0].slice(0, 24) !== "0".repeat(24)) return null;
  return { to: wordAddr(w[0]), atto: wordInt(w[1]).toString() };
}
// permission tuple at a byte offset into the argument area (dynamic tuple: extraData is bytes)
function decodePermissionAt(w, offsetBytes) {
  const i = Number(offsetBytes / 32n);
  if (i + 9 > w.length) throw new Error("permission tuple runs off the calldata");
  const p = {
    account: wordAddr(w[i]), spender: wordAddr(w[i + 1]), token: wordAddr(w[i + 2]),
    allowance: wordInt(w[i + 3]).toString(), period: Number(wordInt(w[i + 4])),
    start: Number(wordInt(w[i + 5])), end: Number(wordInt(w[i + 6])), salt: wordInt(w[i + 7]).toString(),
  };
  const eOff = i + Number(wordInt(w[i + 8]) / 32n);
  const len = Number(wordInt(w[eOff]));
  const hex = w.slice(eOff + 1, eOff + 1 + Math.ceil(len / 32)).join("").slice(0, len * 2);
  p.extraData = "0x" + hex;
  return p;
}
export function encodePermission(p) {
  const extra = lc(p.extraData || "0x").replace(/^0x/, "");
  if (extra.length % 2) throw new Error("extraData: whole bytes");
  const padded = extra.padEnd(Math.ceil(extra.length / 64) * 64, "0");
  return addrWord(p.account) + addrWord(p.spender) + addrWord(p.token) + word(p.allowance) + word(p.period) +
    word(p.start) + word(p.end) + word(p.salt) + word(9 * 32) + word(extra.length / 2) + padded;
}
export function encodeSpend(p, value) { return SEL.spend + word(0x40) + word(value) + encodePermission(p); }
export function decodeSpend(data) {
  const { selector: s, words: w } = words(data);
  if (s !== SEL.spend) return null;
  return { permission: decodePermissionAt(w, wordInt(w[0])), value: wordInt(w[1]).toString() };
}
export function decodeApproveWithSignature(data) {
  const { selector: s, words: w } = words(data);
  if (s !== SEL.approveWithSignature) return null;
  return { permission: decodePermissionAt(w, wordInt(w[0])) };
}

// ── the reader ──────────────────────────────────────────────────────────────
// hosts: [{id, url}] — at least two operators for the top class. `fetchFn`
// is injected so tests drive the reader without a network.
export function createEvmReader({ chainId, hosts, fetchFn = globalThis.fetch, timeoutMs = 9000 }) {
  if (!Array.isArray(hosts) || hosts.length === 0) throw new Error("reader needs hosts");
  let id = 0;
  async function call(host, method, params) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchFn(host.url, { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
      if (!r.ok) throw new Error(`${host.id} HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(`${host.id} refused ${method}: ${String(j.error.message || "").slice(0, 120)}`);
      return j.result;
    } finally { clearTimeout(t); }
  }
  async function each(method, params) {
    return Promise.all(hosts.map((h) => call(h, method, params).then((v) => ({ host: h.id, ok: true, v }), (e) => ({ host: h.id, ok: false, e: String(e.message || e) }))));
  }
  return {
    chainId,
    hostIds: hosts.map((h) => h.id),
    // control: every host answering must be on the chain we think it is
    async controlChain() {
      const rows = await each("eth_chainId", []);
      const alive = rows.filter((r) => r.ok);
      return { ok: alive.length > 0 && alive.every((r) => Number(r.v) === chainId), alive: alive.map((r) => r.host), rows };
    },
    async ethCall(to, data) {
      for (const r of await each("eth_call", [{ to, data }, "latest"])) if (r.ok) return r.v;
      throw new Error("no host answered eth_call");
    },
    // A simulated call from `from`: money-free. reverted=true only when a host
    // answered with an execution error; a host that never answered is unknown.
    async simulate(from, to, data) {
      const rows = await each("eth_call", [{ from, to, data }, "latest"]);
      const ok = rows.filter((r) => r.ok);
      const refused = rows.filter((r) => !r.ok && /revert|execution/i.test(r.e));
      return { answered: ok.length + refused.length, succeeded: ok.length, reverted: refused.length, rows };
    },
    async code(addr) {
      for (const r of await each("eth_getCode", [addr, "latest"])) if (r.ok) return r.v;
      throw new Error("no host answered eth_getCode");
    },
    async balanceOf(token, holder) {
      return wordInt(lc(await this.ethCall(token, SEL.balanceOf + addrWord(holder))).replace(/^0x/, "").padStart(64, "0").slice(-64)).toString();
    },
    // The observation. Returns the hosts' agreement, the Transfer logs from
    // `token`, the 4337 fee evidence, and finality from the `finalized` tag.
    async observeTx(txHash, token) {
      const receipts = await each("eth_getTransactionReceipt", [txHash]);
      const got = receipts.filter((r) => r.ok && r.v);
      if (!got.length) return { found: false, tx: lc(txHash), hosts: receipts.map((r) => ({ host: r.host, ok: r.ok })), quorum: 0 };
      const key = (rc) => JSON.stringify([lc(rc.blockHash), rc.status, (rc.logs || []).map((l) => [lc(l.address), l.topics.map(lc), lc(l.data)])]);
      const groups = new Map();
      for (const r of got) { const k = key(r.v); groups.set(k, [...(groups.get(k) || []), r]); }
      const [best] = [...groups.values()].sort((a, b) => b.length - a.length);
      const rc = best[0].v;
      const txs = await each("eth_getTransactionByHash", [txHash]);
      const input = lc((txs.find((r) => r.ok && r.v && r.v.input) || { v: { input: "0x" } }).v.input);
      const fin = await each("eth_getBlockByNumber", ["finalized", false]);
      const finNums = fin.filter((r) => r.ok && r.v).map((r) => Number(r.v.number));
      const blockNumber = Number(rc.blockNumber);
      const finalizedBy = finNums.filter((n) => n >= blockNumber).length;
      const transfers = (rc.logs || []).filter((l) => lc(l.address) === lc(token) && lc(l.topics[0]) === TOPIC.Transfer && l.topics.length === 3 && lc(l.data).length === 66)
        .map((l) => ({ from: wordAddr(lc(l.topics[1]).slice(2)), to: wordAddr(lc(l.topics[2]).slice(2)), atto: wordInt(lc(l.data).slice(2)).toString(), logIndex: Number(l.logIndex) }));
      // a UserOperationEvent carries four data words; anything shorter is not one
      const userOps = (rc.logs || []).filter((l) => lc(l.topics[0]) === TOPIC.UserOperationEvent && l.topics.length === 4 && lc(l.data).length >= 2 + 256).map((l) => {
        const d = lc(l.data).slice(2);
        return { entryPoint: lc(l.address), sender: wordAddr(lc(l.topics[2]).slice(2)), paymaster: wordAddr(lc(l.topics[3]).slice(2)), success: wordInt(d.slice(64, 128)) === 1n, actualGasCost: wordInt(d.slice(128, 192)).toString() };
      });
      return {
        found: true,
        quorum: best.length,
        disagree: groups.size > 1,
        hosts: receipts.map((r) => ({ host: r.host, ok: r.ok, found: !!(r.ok && r.v) })),
        tx: lc(rc.transactionHash || txHash), status: rc.status, blockNumber, blockHash: lc(rc.blockHash),
        txFrom: lc(rc.from || ""), gasUsed: BigInt(rc.gasUsed || 0).toString(), effectiveGasPrice: BigInt(rc.effectiveGasPrice || 0).toString(),
        finalized: finNums.length > 0 && finalizedBy === finNums.length, finalizedBy, finalizedHosts: finNums.length,
        transfers, userOps, input,
      };
    },
  };
}

// What the payer paid in native fee on this transaction, from chain evidence:
// a 4337 operation with a paymaster cost the sender nothing; without one, the
// sender paid actualGasCost; a plain transaction from the payer paid
// gasUsed × effectiveGasPrice; a transaction someone else sent cost the payer 0.
export function payerNativeFee(obs, payer) {
  const op = obs.userOps.find((u) => lc(u.sender) === lc(payer));
  if (op) return { atto: /^0x0{40}$/.test(op.paymaster) ? op.actualGasCost : "0", basis: /^0x0{40}$/.test(op.paymaster) ? "userop-self-paid" : "userop-paymaster" };
  if (obs.txFrom && lc(obs.txFrom) === lc(payer)) return { atto: (BigInt(obs.gasUsed) * BigInt(obs.effectiveGasPrice)).toString(), basis: "eoa-tx" };
  return { atto: "0", basis: "sent-by-another" };
}

// VOCAB-1 records from an observation. One Transfer to the recipient is one
// value movement; its identity is chain:tx:logIndex.
export function recordsFromObservation(obs, { caip2, asset, recipient }) {
  // submitted but not visible: an attempt, never "nothing happened" (RECON-1 → OPEN)
  if (!obs.found) return [{ kind: "attempt", asset, retryability: "unbounded", txRef: `${caip2}:${lc(obs.tx || "")}`, value_observed: "tx-hash" }];
  if (obs.status !== "0x1") return [{ kind: "attempt", asset, retryability: "human-gate", txRef: `${caip2}:${obs.tx}`, value_observed: "tx-hash" }];
  const cls = obs.quorum >= 2 && !obs.disagree ? "event-log+readback" : "tx-receipt";
  const finality = obs.finalized && obs.quorum >= 2 && !obs.disagree ? "terminal" : "as-reported";
  return obs.transfers.filter((t) => lc(t.to) === lc(recipient)).map((t) => ({
    kind: "settlement", asset, amount: t.atto, value_observed: cls, finality, retryability: "never",
    txRef: `${caip2}:${obs.tx}:${t.logIndex}`, from: t.from, to: t.to,
  }));
}
