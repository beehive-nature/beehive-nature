// fake-base.mjs — a small Base chain, a fake Base Account SDK and an agent
// signer, for the tests. Honest by default; each `sabotage` flag makes one
// party lie or overreach in exactly one way, so every kill condition can be
// shown to go red. No network, no keys: addresses and hashes are derived
// from labels with sha256.
import { createHash } from "node:crypto";
import { SEL, ERR, TOPIC, lc, addrWord, word, encodeTransfer, encodeSpend, decodeSpend, decodeApproveWithSignature, decodeTransfer, selector, encodePermission } from "./evm.mjs";
import { CHAINS, SPEND_PERMISSION_MANAGER } from "./adapters/smart-account-usdc.mjs";

const h = (s) => createHash("sha256").update(s).digest("hex");
export const addr = (label) => "0x" + h("addr:" + label).slice(0, 40);
const ZERO = "0x" + "0".repeat(40);
const ENTRYPOINT = "0x0000000071727de22e5e9d8baf0edac6f37da032"; // ERC-4337 EntryPoint v0.7 (public)
const toAtto6 = (dec) => { const [w, f = ""] = String(dec).split("."); return (BigInt(w) * 1000000n + BigInt((f + "000000").slice(0, 6))).toString(); };

export function createFakeBase({ chainId = 84532, payer = addr("payer-smart-account"), spender = addr("agent"), funds = 1000000000n, sabotage = {} } = {}) {
  const usdc = lc(CHAINS[chainId].usdc), spm = lc(SPEND_PERMISSION_MANAGER);
  const bal = new Map([[lc(payer), funds]]);
  const owners = new Map([[lc(payer), { list: new Set([addr("owner-passkey")]), next: 1 }]]);
  if (sabotage.agentIsOwner) { owners.get(lc(payer)).list.add(lc(spender)); owners.get(lc(payer)).next++; }
  const approved = new Map(); // permission key → spent
  const txs = new Map();
  let head = 100, finalized = 100, n = 0, reads = 0;

  const move = (from, to, atto) => {
    const b = bal.get(lc(from)) || 0n;
    if (b < BigInt(atto)) throw new Error("ERC20: transfer amount exceeds balance");
    bal.set(lc(from), b - BigInt(atto)); bal.set(lc(to), (bal.get(lc(to)) || 0n) + BigInt(atto));
  };
  const transferLog = (from, to, atto) => ({ address: usdc, topics: [TOPIC.Transfer, "0x" + addrWord(from), "0x" + addrWord(to)], data: "0x" + word(atto) });
  function mine({ from, to, input, logs, status = "0x1", gasUsed = 50000n, price = 1000n }) {
    const hash = "0x" + h(`tx:${chainId}:${++n}:${input}`);
    head++;
    if (!sabotage.neverFinal) finalized = head;
    const blockHash = "0x" + h("block:" + head);
    txs.set(hash, { receipt: { transactionHash: hash, blockNumber: "0x" + head.toString(16), blockHash, status, from: lc(from), to: lc(to), gasUsed: "0x" + gasUsed.toString(16), effectiveGasPrice: "0x" + price.toString(16),
      logs: logs.map((l, i) => ({ ...l, logIndex: "0x" + i.toString(16), blockHash })) }, tx: { hash, from: lc(from), to: lc(to), input } });
    return hash;
  }

  // ── JSON-RPC ──
  function rpc(host, method, params) {
    switch (method) {
      case "eth_chainId": return "0x" + (sabotage.wrongChain ? 1 : chainId).toString(16);
      case "eth_getCode": return "0x6080";
      case "eth_getBlockByNumber": return { number: "0x" + finalized.toString(16) };
      case "eth_getTransactionByHash": return txs.get(lc(params[0]))?.tx || null;
      case "eth_getTransactionReceipt": {
        const t = txs.get(lc(params[0]));
        if (!t) return null;
        reads++;
        // unstable: the second reading round shows a different block (a reorg the harness must catch)
        if (sabotage.unstable && reads > 2) return { ...t.receipt, blockHash: "0x" + h("reorg"), logs: t.receipt.logs.map((l) => ({ ...l, data: "0x" + word(1) })) };
        if (sabotage.lyingHost === host) return { ...t.receipt, logs: [] };
        // one host keeps everything else honest but claims block 0, so any finalized head "covers" it
        if (sabotage.lyingBlockHost === host) return { ...t.receipt, blockNumber: "0x0" };
        // one host shrinks the gas so the fee looks inside the bound
        if (sabotage.lyingGasHost === host) return { ...t.receipt, gasUsed: "0x0" };
        return t.receipt;
      }
      case "eth_call": {
        const { to, data, from } = params[0];
        const s = lc(data).slice(0, 10);
        if (lc(to) === usdc && s === SEL.balanceOf) return "0x" + word(bal.get("0x" + lc(data).slice(-40)) || 0n);
        if (owners.has(lc(to)) && s === SEL.isOwnerAddress) return "0x" + word(owners.get(lc(to)).list.has("0x" + lc(data).slice(-40)) ? 1 : 0);
        if (owners.has(lc(to)) && s === SEL.nextOwnerIndex) return "0x" + word(owners.get(lc(to)).next);
        // SpendPermissionManager as the real contract orders it: sender, then
        // isValid (approved, not revoked) → UnauthorizedSpendPermission, then
        // the cap → ExceededSpendPermission (revert data carries the selector)
        if (lc(to) === spm && s === SEL.isValid) return "0x" + word(approved.has(keyOfIsValid(data)) ? 1 : 0);
        if (lc(to) === spm && s === SEL.spend) {
          const d = decodeSpend(data);
          if (lc(from) !== lc(d.permission.spender)) throw revert("0x" + "deadbeef");
          if (!approved.has(key(d.permission))) throw revert(ERR.UnauthorizedSpendPermission);
          if (sabotage.noCap) return "0x";
          if (sabotage.wrongRevert) throw revert("0x" + "deadbeef");
          if (approved.get(key(d.permission)) + BigInt(d.value) > BigInt(d.permission.allowance)) throw revert(ERR.ExceededSpendPermission + word(d.value) + word(d.permission.allowance));
          return "0x";
        }
        throw new Error(`execution reverted: fake has no ${s} on ${to}`);
      }
      default: throw new Error(`fake rpc: ${method}`);
    }
  }
  const revert = (data) => Object.assign(new Error("execution reverted"), { data });
  const fetchFor = (host) => async (_url, init) => {
    const { id, method, params } = JSON.parse(init.body);
    if ((sabotage.downHosts || []).includes(host)) return { ok: false, status: 503, json: async () => ({}) };
    try { const result = rpc(host, method, params); return { ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id, result }) }; }
    catch (e) { return { ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id, error: { code: 3, message: e.message, ...(e.data ? { data: e.data } : {}) } }) }; }
  };
  const hosts = CHAINS[chainId].hosts.map((x) => ({ id: x.id, url: x.url }));
  const fetchFn = (url, init) => fetchFor(hosts.find((x) => x.url === url).id)(url, init);

  // ── the vendor SDK (route pay) ──
  const sdk = {
    calls: [],
    async pay(p) {
      sdk.calls.push({ method: "pay", params: p });
      const atto = sabotage.payWrongAmount ? (BigInt(toAtto6(p.amount)) + 1n).toString() : toAtto6(p.amount);
      if (sabotage.payAddsOwner) owners.get(lc(payer)).next++;
      if (sabotage.payNoTransfer) return { id: "0x" + h("phantom"), amount: p.amount, to: p.to };
      if (sabotage.thirdPartyTransfer || sabotage.twoPayersInBundle) {
        // a bundle carrying our (failed or successful) op, and a transfer to the
        // merchant from someone else: with no op of their own (third party), or
        // with a successful op of their own (two payers)
        const other = addr("someone-else");
        bal.set(lc(other), BigInt(atto)); move(other, p.to, atto);
        const op = (sender, ok) => ({ address: ENTRYPOINT, topics: [TOPIC.UserOperationEvent, "0x" + h("userop:" + sender), "0x" + addrWord(sender), "0x" + addrWord(addr("paymaster"))], data: "0x" + word(1) + word(ok ? 1 : 0) + word(1) + word(1) });
        const logs = sabotage.twoPayersInBundle
          ? (move(payer, p.to, atto), [transferLog(payer, p.to, atto), op(payer, true), transferLog(other, p.to, atto), op(other, true)])
          : [op(payer, false), transferLog(other, p.to, atto)];
        const id = mine({ from: addr("bundler"), to: ENTRYPOINT, input: "0x765e827f" + encodeTransfer(p.to, atto).slice(2) + (p.dataSuffix || "0x").slice(2), logs });
        return { id, amount: p.amount, to: p.to };
      }
      if (sabotage.otherPayerInBundle) {
        const other = addr("someone-else");
        bal.set(lc(other), BigInt(atto)); move(other, p.to, atto);
        const op = (sender, ok) => ({ address: ENTRYPOINT, topics: [TOPIC.UserOperationEvent, "0x" + h("userop:" + sender), "0x" + addrWord(sender), "0x" + addrWord(addr("paymaster"))], data: "0x" + word(1) + word(ok ? 1 : 0) + word(1) + word(1) });
        const id = mine({ from: addr("bundler"), to: ENTRYPOINT, input: "0x765e827f" + encodeTransfer(p.to, atto).slice(2) + (p.dataSuffix || "0x").slice(2), logs: [op(payer, false), transferLog(other, p.to, atto), op(other, true)] });
        return { id, amount: p.amount, to: p.to };
      }
      move(payer, p.to, atto);
      // a bundler sends the bundle; the user op is the payer's; a paymaster sponsors it
      const inner = encodeTransfer(p.to, atto) + (sabotage.dropSuffix ? "" : (p.dataSuffix || "0x").slice(2));
      const opLog = { address: ENTRYPOINT, topics: [TOPIC.UserOperationEvent, "0x" + h("userop:" + n), "0x" + addrWord(payer), "0x" + addrWord(sabotage.selfPaidGas ? ZERO : addr("paymaster"))],
        data: "0x" + word(1) + word(1) + word(sabotage.selfPaidGas ? 900000000000000n : 70000000000n) + word(70000) };
      const id = mine({ from: addr("bundler"), to: ENTRYPOINT, input: "0x765e827f" + inner.slice(2), logs: [transferLog(payer, p.to, atto), opLog] });
      return { id, amount: p.amount, to: p.to };
    },
    async getPaymentStatus({ id }) {
      if (sabotage.statusLies || txs.has(lc(id))) {
        const p = sdk.calls.find((c) => c.method === "pay")?.params;
        return { status: "completed", id, amount: p?.amount, recipient: p?.to, sender: payer };
      }
      return { status: "not_found", id };
    },
    // ── spend-permission route ──
    async requestSpendPermission(req) {
      sdk.calls.push({ method: "requestSpendPermission", params: { ...req, provider: undefined } });
      const allowance = sabotage.widerGrant ? (req.allowance * 10n).toString() : req.allowance.toString();
      return { signature: "0x" + h("owner-signature"), permission: { account: req.account, spender: req.spender, token: req.token, allowance,
        period: sabotage.shortPeriod ? 1 : req.periodInDays * 86400, start: Math.floor(req.start.getTime() / 1000), end: Math.floor(req.end.getTime() / 1000), salt: req.salt, extraData: req.extraData } };
    },
    async prepareSpendCallData(perm, amount, recipient) {
      const p = perm.permission;
      const calls = [];
      if (!approved.has(key(p))) calls.push({ to: spm, data: SEL.approveWithSignature + word(0x40) + word(0x40 + 32 * (10 + Math.ceil((p.extraData.length - 2) / 64))) + encodePermission(p) + word(65) + "11".repeat(65) + "00".repeat(31), value: 0n });
      calls.push({ to: spm, data: encodeSpend(p, amount), value: 0n });
      calls.push({ to: p.token, data: encodeTransfer(recipient, amount), value: 0n });
      if (sabotage.extraTransfer) calls.push({ to: p.token, data: encodeTransfer(recipient, amount), value: 0n });
      if (sabotage.extraOwnerCall) calls.push({ to: p.account, data: SEL.addOwnerAddress + addrWord(addr("vendor")), value: 0n });
      if (sabotage.approveAll) calls.push({ to: p.token, data: SEL.approve + addrWord(addr("vendor")) + "f".repeat(64), value: 0n });
      return calls;
    },
  };
  const key = (p) => [p.account, p.spender, p.token, p.allowance, p.salt].map(String).join("|").toLowerCase();
  // isValid(permission): selector, head offset 0x20, then the tuple — decode by re-wrapping as a spend
  const keyOfIsValid = (data) => key(decodeSpend(SEL.spend + "0".repeat(62) + "40" + "0".repeat(64) + lc(data).slice(74)).permission);

  // ── the agent's own signer (spend route) ──
  const agent = {
    async address() { return spender; },
    async send({ to, data }) {
      const s = lc(data).slice(0, 10);
      const gas = sabotage.expensiveGas ? 10n ** 12n : 1000n;
      if (lc(to) === spm && s === SEL.approveWithSignature) { approved.set(key(decodeApproveWithSignature(data).permission), 0n); return mine({ from: spender, to, input: data, logs: [], price: gas }); }
      if (lc(to) === spm && s === SEL.spend) {
        const d = decodeSpend(data), k = key(d.permission);
        if (!approved.has(k)) throw new Error("execution reverted: not approved");
        const spent = approved.get(k) + BigInt(d.value);
        if (!sabotage.noCap && spent > BigInt(d.permission.allowance)) throw new Error("execution reverted: ExceededSpendPermission");
        approved.set(k, spent);
        move(d.permission.account, spender, d.value);
        return mine({ from: spender, to, input: data, logs: [transferLog(d.permission.account, spender, d.value)], price: gas });
      }
      if (lc(to) === usdc) {
        const t = decodeTransfer(data);
        move(spender, t.to, t.atto);
        return mine({ from: spender, to, input: data, logs: [transferLog(spender, t.to, t.atto)], price: gas });
      }
      throw new Error("agent signer: refused unknown call");
    },
  };

  return { chainId, payer, spender, usdc, hosts, fetchFn, sdk, agent, balanceOf: (a) => (bal.get(lc(a)) || 0n).toString(), owners, txs, finalizeAll: () => { finalized = head; } };
}

export { selector };
