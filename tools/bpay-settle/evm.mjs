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
  isValid: selector(`isValid(${PERM})`),
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
// SpendPermissionManager custom errors (coinbase/spend-permissions src/SpendPermissionManager.sol):
// _useSpendPermission checks ZeroValue, then isValid → UnauthorizedSpendPermission,
// then the window, and only then the cap → ExceededSpendPermission.
export const ERR = {
  ExceededSpendPermission: selector("ExceededSpendPermission(uint256,uint256)"),
  UnauthorizedSpendPermission: selector("UnauthorizedSpendPermission()"),
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
// strict ABI: an encoding Solidity would read differently is refused, never re-read
export function decodeError(code, msg) { const e = new Error(msg); e.code = code; return e; }
export const wordAddr = (w) => {
  if (w.length !== 64 || w.slice(0, 24) !== "0".repeat(24)) throw decodeError("REFUSED_ENCODING", "address word with dirty upper bytes");
  return "0x" + w.slice(24);
};
export const wordInt = (w) => BigInt("0x" + w);
const topicAddr = (t) => wordAddr(lc(t).slice(2));

export function encodeTransfer(to, atto) { return SEL.transfer + addrWord(to) + word(atto); }
export function decodeTransfer(data) {
  const { selector: s, words: w } = words(data);
  if (s !== SEL.transfer || w.length !== 2 || w[0].slice(0, 24) !== "0".repeat(24)) return null;
  return { to: "0x" + w[0].slice(24), atto: wordInt(w[1]).toString() };
}
// permission tuple at a byte offset into the argument area (dynamic tuple:
// extraData is bytes). Offsets must be word-aligned and inside the calldata;
// the bytes must fit exactly; padding must be zero.
function decodePermissionAt(w, offsetBytes) {
  if (offsetBytes % 32n !== 0n) throw decodeError("REFUSED_ENCODING", "unaligned tuple offset");
  const i = Number(offsetBytes / 32n);
  if (i + 10 > w.length) throw decodeError("REFUSED_ENCODING", "permission tuple runs off the calldata");
  const p = {
    account: wordAddr(w[i]), spender: wordAddr(w[i + 1]), token: wordAddr(w[i + 2]),
    allowance: wordInt(w[i + 3]).toString(), period: Number(wordInt(w[i + 4])),
    start: Number(wordInt(w[i + 5])), end: Number(wordInt(w[i + 6])), salt: wordInt(w[i + 7]).toString(),
  };
  const rel = wordInt(w[i + 8]);
  if (rel % 32n !== 0n || rel < 9n * 32n) throw decodeError("REFUSED_ENCODING", "bad extraData offset");
  const eOff = i + Number(rel / 32n);
  if (eOff >= w.length) throw decodeError("REFUSED_ENCODING", "extraData offset runs off the calldata");
  const len = wordInt(w[eOff]);
  const nWords = Number((len + 31n) / 32n);
  if (eOff + 1 + nWords > w.length) throw decodeError("REFUSED_ENCODING", "extraData length runs off the calldata");
  const body = w.slice(eOff + 1, eOff + 1 + nWords).join("");
  if (!/^0*$/.test(body.slice(Number(len) * 2))) throw decodeError("REFUSED_ENCODING", "non-zero extraData padding");
  p.extraData = "0x" + body.slice(0, Number(len) * 2);
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
export function encodeIsValid(p) { return SEL.isValid + word(0x20) + encodePermission(p); }
export function decodeSpend(data) {
  const { selector: s, words: w } = words(data);
  if (s !== SEL.spend) return null;
  if (wordInt(w[0]) !== 0x40n) throw decodeError("REFUSED_ENCODING", "spend: the tuple must follow the head");
  return { permission: decodePermissionAt(w, wordInt(w[0])), value: wordInt(w[1]).toString() };
}
export function decodeApproveWithSignature(data) {
  const { selector: s, words: w } = words(data);
  if (s !== SEL.approveWithSignature) return null;
  if (wordInt(w[0]) !== 0x40n) throw decodeError("REFUSED_ENCODING", "approveWithSignature: the tuple must follow the head");
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
      if (j.error) throw Object.assign(new Error(`${host.id} refused ${method}: ${String(j.error.message || "").slice(0, 120)}`), { rpcError: true, data: typeof j.error.data === "string" ? lc(j.error.data) : null });
      return j.result;
    } finally { clearTimeout(t); }
  }
  async function each(method, params) {
    return Promise.all(hosts.map((h) => call(h, method, params).then((v) => ({ host: h.id, ok: true, v }), (e) => ({ host: h.id, ok: false, rpc: !!e.rpcError, data: e.data || null, e: String(e.message || e) }))));
  }
  return {
    chainId,
    hostIds: hosts.map((h) => h.id),
    // control: every host must answer, and on the chain we think it is
    async controlChain() {
      const rows = await each("eth_chainId", []);
      const alive = rows.filter((r) => r.ok);
      return { ok: alive.length === hosts.length && alive.every((r) => Number(r.v) === chainId), alive: alive.map((r) => r.host), rows };
    },
    async ethCall(to, data) {
      for (const r of await each("eth_call", [{ to, data }, "latest"])) if (r.ok) return r.v;
      throw new Error("no host answered eth_call");
    },
    // A simulated call from `from`: money-free. Each row says whether the host
    // ran it (ok), reverted it (with the 4-byte error selector when the host
    // returned revert data), or never answered.
    async simulate(from, to, data) {
      const rows = await each("eth_call", [{ from, to, data }, "latest"]);
      return {
        answered: rows.filter((r) => r.ok || r.rpc).length,
        succeeded: rows.filter((r) => r.ok).length,
        reverts: rows.filter((r) => !r.ok && r.rpc).map((r) => ({ host: r.host, selector: r.data && r.data.length >= 10 ? r.data.slice(0, 10) : null })),
        rows,
      };
    },
    // The value every host returned identically, or null when any host failed
    // or disagreed: a probe that rests on one witness proves nothing.
    async callAgreed(to, data, from) {
      const rows = await each("eth_call", [from ? { from, to, data } : { to, data }, "latest"]);
      const vals = new Set(rows.map((r) => (r.ok ? lc(r.v) : "!")));
      return vals.size === 1 && !vals.has("!") ? [...vals][0] : null;
    },
    async code(addr) {
      for (const r of await each("eth_getCode", [addr, "latest"])) if (r.ok) return r.v;
      throw new Error("no host answered eth_getCode");
    },
    async balanceOf(token, holder) {
      return wordInt(lc(await this.ethCall(token, SEL.balanceOf + addrWord(holder))).replace(/^0x/, "").padStart(64, "0").slice(-64)).toString();
    },
    // The observation. Every field the evidence uses must be the same on the
    // agreeing hosts (the quorum key covers them all); the calldata must agree
    // too; finality counts only hosts in the agreeing group, and every one of
    // them must say finalized.
    async observeTx(txHash, token) {
      const receipts = await each("eth_getTransactionReceipt", [txHash]);
      const got = receipts.filter((r) => r.ok && r.v);
      if (!got.length) return { found: false, tx: lc(txHash), hosts: receipts.map((r) => ({ host: r.host, ok: r.ok })), quorum: 0 };
      const key = (rc) => JSON.stringify([lc(rc.transactionHash || ""), String(rc.blockNumber), lc(rc.blockHash), rc.status, lc(rc.from || ""), String(rc.gasUsed), String(rc.effectiveGasPrice),
        (rc.logs || []).map((l) => [lc(l.address), l.topics.map(lc), lc(l.data), String(l.logIndex)])]);
      const groups = new Map();
      for (const r of got) { const k = key(r.v); groups.set(k, [...(groups.get(k) || []), r]); }
      const [best] = [...groups.values()].sort((a, b) => b.length - a.length);
      const rc = best[0].v;
      if (lc(rc.transactionHash || txHash) !== lc(txHash)) return { found: false, tx: lc(txHash), hosts: [], quorum: 0, mismatch: "a host answered for another transaction" };
      const agreeing = new Set(best.map((r) => r.host));
      const txs = (await each("eth_getTransactionByHash", [txHash])).filter((r) => agreeing.has(r.host) && r.ok && r.v);
      const inputs = new Set(txs.map((r) => lc(r.v.input || "0x")));
      const input = inputs.size === 1 && txs.length === agreeing.size ? [...inputs][0] : null; // null = not agreed
      const fin = (await each("eth_getBlockByNumber", ["finalized", false])).filter((r) => agreeing.has(r.host));
      const blockNumber = Number(rc.blockNumber);
      const finAnswers = fin.filter((r) => r.ok && r.v).map((r) => Number(r.v.number));
      const finalized = finAnswers.length === agreeing.size && finAnswers.every((n) => n >= blockNumber) && blockNumber > 0;
      const transfers = [];
      for (const l of rc.logs || []) {
        if (!(lc(l.address) === lc(token) && lc(l.topics[0]) === TOPIC.Transfer && l.topics.length === 3 && lc(l.data).length === 66)) continue;
        try { transfers.push({ from: topicAddr(l.topics[1]), to: topicAddr(l.topics[2]), atto: wordInt(lc(l.data).slice(2)).toString(), logIndex: Number(l.logIndex) }); } catch { /* malformed topic: not a transfer */ }
      }
      // a UserOperationEvent carries four data words; anything shorter is not one
      const userOps = [];
      for (const l of rc.logs || []) {
        if (!(lc(l.topics[0]) === TOPIC.UserOperationEvent && l.topics.length === 4 && lc(l.data).length >= 2 + 256)) continue;
        const d = lc(l.data).slice(2);
        try { userOps.push({ entryPoint: lc(l.address), sender: topicAddr(l.topics[2]), paymaster: topicAddr(l.topics[3]), success: wordInt(d.slice(64, 128)) === 1n, actualGasCost: wordInt(d.slice(128, 192)).toString() }); } catch { /* malformed */ }
      }
      return {
        found: true,
        quorum: best.length,
        disagree: groups.size > 1,
        hosts: receipts.map((r) => ({ host: r.host, ok: r.ok, found: !!(r.ok && r.v) })),
        tx: lc(txHash), status: rc.status, blockNumber, blockHash: lc(rc.blockHash),
        txFrom: lc(rc.from || ""), gasUsed: BigInt(rc.gasUsed || 0).toString(), effectiveGasPrice: BigInt(rc.effectiveGasPrice || 0).toString(),
        finalized, finalizedHosts: finAnswers.length,
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

// VOCAB-1 records from an observation. A Transfer to the recipient counts only
// when its sender actually acted in this transaction: as a SUCCESSFUL user
// operation (a bundle can succeed while one op inside it reverts), or as the
// transaction's own sender. `payer`, when known, must be that sender. Two
// qualifying senders paying the recipient in one transaction cannot be told
// apart here: that is a human's to look at, never value for this invoice.
export function recordsFromObservation(obs, { caip2, asset, recipient, payer = null }) {
  // submitted but not visible: an attempt, never "nothing happened" (RECON-1 → OPEN)
  if (!obs.found) return [{ kind: "attempt", asset, retryability: "unbounded", txRef: `${caip2}:${lc(obs.tx || "")}`, value_observed: "tx-hash" }];
  if (obs.status !== "0x1") return [{ kind: "attempt", asset, retryability: "human-gate", txRef: `${caip2}:${obs.tx}`, value_observed: "tx-hash" }];
  const acted = (from) => obs.userOps.length
    ? obs.userOps.some((u) => lc(u.sender) === lc(from) && u.success)
    : lc(obs.txFrom) === lc(from);
  const candidates = obs.transfers.filter((t) => lc(t.to) === lc(recipient) && acted(t.from) && (!payer || lc(t.from) === lc(payer)));
  const senders = new Set(candidates.map((t) => lc(t.from)));
  if (senders.size > 1) return [{ kind: "attempt", asset, retryability: "human-gate", txRef: `${caip2}:${obs.tx}`, value_observed: "tx-hash", ambiguous: true }];
  if (!candidates.length) return [{ kind: "attempt", asset, retryability: "human-gate", txRef: `${caip2}:${obs.tx}`, value_observed: "tx-hash", no_qualifying_transfer: true }];
  const cls = obs.quorum >= 2 && !obs.disagree ? "event-log+readback" : "tx-receipt";
  const finality = obs.finalized && obs.quorum >= 2 && !obs.disagree ? "terminal" : "as-reported";
  return candidates.map((t) => ({
    kind: "settlement", asset, amount: t.atto, value_observed: cls, finality, retryability: "never",
    txRef: `${caip2}:${obs.tx}:${t.logIndex}`, from: t.from, to: t.to,
  }));
}
