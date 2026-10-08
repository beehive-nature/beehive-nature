// smart-account-usdc.mjs — the Coinbase/Base settlement adapter, behind the
// bnr.settle-adapter/1 contract (scripts/lib/bpay-settle.mjs).
//
// THIS IS THE ONLY FILE THAT KNOWS THE VENDOR. The kernel sees a descriptor,
// payload summaries and VOCAB-1 records; the vendor SDK is INJECTED (`sdk`),
// never imported, so replacing the SDK next year changes this file only.
//
// Two routes, one adapter:
//   route "pay"              — a person present: the SDK's one-call USDC pay().
//                              The person's own passkey approves the exact
//                              amount and recipient. Authority model:
//                              per-payment-approval.
//   route "spend-permission" — an agent: the owner grants the agent a Spend
//                              Permission (SpendPermissionManager, on chain)
//                              capped at the authority maximum, ending at the
//                              authority's not_after, salted by the intent and
//                              carrying the authority hash in extraData. The
//                              agent is the permission's SPENDER, never an
//                              OWNER of the smart account.
//
// Laws held here:
//   • a call the authority does not name is refused BEFORE it reaches a
//     signer: the only calls are the SpendPermissionManager's
//     approveWithSignature/spend for THIS permission and a USDC transfer of
//     the owed amount to THE recipient. Owner management, upgrades,
//     cross-chain replayable execution, ERC-20 approve and any EIP-7702
//     delegation are refused by name. (No EIP7702Proxy address is pinned
//     from a chain read, so every 7702 authorization is refused; the
//     implementation contract is never a delegation target.)
//   • value evidence comes from the independent reader (evm.mjs, two RPC
//     operators, no vendor host). The vendor's payment status is kept as a
//     self-reported assertion, compared three ways, and never closes an
//     obligation.
import { toAtto, fromAtto, CONTRACT, VERBS } from "../../../scripts/lib/bpay-settle.mjs";
import { SEL, isAddr, lc, decodeTransfer, decodeSpend, decodeApproveWithSignature, recordsFromObservation, payerNativeFee } from "../evm.mjs";

// Public chain facts, each read back from two RPC operators on 2026-10-05
// (symbol=USDC decimals=6; SpendPermissionManager code 12610 bytes on both
// chains, the address the SDK pins in sign/base-account/utils/constants.js).
export const CHAINS = {
  8453: { caip2: "eip155:8453", usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", testnet: false,
    hosts: [{ id: "base-foundation", url: "https://mainnet.base.org" }, { id: "publicnode", url: "https://base.publicnode.com" }] },
  84532: { caip2: "eip155:84532", usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", testnet: true,
    hosts: [{ id: "base-foundation", url: "https://sepolia.base.org" }, { id: "publicnode", url: "https://base-sepolia-rpc.publicnode.com" }] },
};
for (const c of Object.values(CHAINS)) c.asset = `${c.caip2}/erc20:${c.usdc.toLowerCase()}`;
export const SPEND_PERMISSION_MANAGER = "0xf85210B21cC50302F477BA56686d2019dC9b67Ad";
const REFUSED_SELECTORS = Object.fromEntries(
  ["addOwnerAddress", "addOwnerPublicKey", "removeOwnerAtIndex", "removeLastOwner", "upgradeToAndCall", "executeWithoutChainIdValidation", "approve"].map((k) => [SEL[k], k]));

function refuse(code, msg) { const e = new Error(msg); e.code = code; throw e; }

// salt and extraData derive from the intent, so one permission can serve one
// intent only: a second intent cannot reuse it, and the chain shows which
// authority it was granted under.
const hex32 = (d) => "0x" + d.replace(/^sha256:/, "");
// The on-chain binding for the pay route: "bnr1" ‖ intent digest, handed to
// the wallet as its EIP-5792 attribution suffix (pay({dataSuffix}) in
// @base-org/account 2.5.13, interface/payment/pay.js:33). Whether the wallet
// lands it in the executed calldata is OBSERVED by reconcile, never assumed.
export const bindSuffix = (intent) => "0x626e7231" + intent.intent_digest.replace(/^sha256:/, "");
export function permissionRequestFor(intent, { account, spender, chainId, now }) {
  const start = Math.floor(Date.parse(now) / 1000);
  const end = Math.floor(Date.parse(intent.authority.not_after) / 1000);
  if (!(end > start)) refuse("BAD_WINDOW", "authority window already closed");
  return {
    account, spender, token: CHAINS[chainId].usdc, chainId,
    allowance: BigInt(intent.authority.max_asset_atto),
    periodInDays: Math.max(1, Math.ceil((end - start) / 86400)),
    start: new Date(start * 1000), end: new Date(end * 1000),
    salt: BigInt(hex32(intent.intent_digest)).toString(),
    extraData: hex32(intent.authority_hash),
  };
}

// The permission the wallet returned must be EXACTLY the one requested. A
// wallet that hands back a wider allowance, another spender, a later end, a
// shorter period (the cap would reset inside the window) or a different
// token has substituted the authority.
export function checkGrant(granted, req) {
  const p = granted && granted.permission;
  if (!p) refuse("NO_GRANT", "the wallet returned no permission");
  const start = Math.floor(req.start.getTime() / 1000), end = Math.floor(req.end.getTime() / 1000);
  const want = { account: lc(req.account), spender: lc(req.spender), token: lc(req.token), allowance: req.allowance.toString(), period: req.periodInDays * 86400,
    start, end, salt: req.salt, extraData: lc(req.extraData) };
  const have = { account: lc(p.account), spender: lc(p.spender), token: lc(p.token), allowance: String(p.allowance), period: Number(p.period),
    start: Number(p.start), end: Number(p.end), salt: String(p.salt), extraData: lc(p.extraData) };
  for (const k of Object.keys(want)) if (want[k] !== have[k]) refuse("GRANT_SUBSTITUTED", `the granted permission differs from the request at ${k}`);
  // one period must cover the whole window, or the allowance refills inside it
  if (have.period < have.end - have.start) refuse("GRANT_SUBSTITUTED", "the permission's period is shorter than its window: the cap would reset");
  return true;
}

const PERM_FIELDS = ["account", "spender", "token", "allowance", "period", "start", "end", "salt", "extraData"];
const samePermission = (p, g) => PERM_FIELDS.every((k) => k === "account" || k === "spender" || k === "token" || k === "extraData" ? lc(p[k]) === lc(g[k]) : String(p[k]) === String(g[k]));

// The allowlist, and the shape. A spend run is exactly: at most one
// approveWithSignature, then one spend of the owed amount, then one transfer of
// that amount to the recipient — in that order, nothing else. Any call that
// does not decode exactly is refused; nothing is re-read leniently.
export function guardCalls(calls, ctx) {
  try { return guardCallsStrict(calls, ctx); }
  catch (e) { if (/^REFUSED_/.test(e.code || "")) throw e; const r = new Error(`refused: ${String(e.message).slice(0, 120)}`); r.code = "REFUSED_CALL"; throw r; }
}
function guardCallsStrict(calls, { permission, recipient, owedAtto, usdc }) {
  if (!Array.isArray(calls)) refuse("REFUSED_SHAPE", "calls must be a list");
  const shape = [];
  let spent = null, moved = null;
  for (const c of calls) {
    if (c.authorizationList || c.authorization || (c.capabilities && c.capabilities.eip7702))
      refuse("REFUSED_7702", "EIP-7702 delegation refused: no verified EIP7702Proxy is pinned, and the implementation is never a delegation target");
    if (!/^(0x0*|0|)$/i.test(String(c.value ?? "0")) && BigInt(c.value) !== 0n) refuse("REFUSED_VALUE", "a settlement call carries native value");
    if (typeof c.data !== "string" || !isAddr(c.to)) refuse("REFUSED_CALL", "a call without a target or calldata");
    const sel = lc(c.data).slice(0, 10);
    if (REFUSED_SELECTORS[sel])
      refuse("REFUSED_AUTHORITY", `refused ${REFUSED_SELECTORS[sel]}(): settlement never changes owners, upgrades the account, replays across chains or grants an allowance`);
    if (lc(c.to) === lc(SPEND_PERMISSION_MANAGER)) {
      const d = sel === SEL.spend ? decodeSpend(c.data) : sel === SEL.approveWithSignature ? decodeApproveWithSignature(c.data) : null;
      if (!d) refuse("REFUSED_CALL", `SpendPermissionManager call ${sel} is not approveWithSignature or spend`);
      if (!samePermission(d.permission, permission.permission)) refuse("REFUSED_CALL", "call names another permission than the one granted");
      if (sel === SEL.spend) {
        if (BigInt(d.value) !== BigInt(owedAtto)) refuse("REFUSED_AMOUNT", `spend of ${d.value} ≠ owed ${owedAtto}`);
        spent = d.value; shape.push("spend");
      } else shape.push("approve");
      continue;
    }
    if (lc(c.to) === lc(usdc)) {
      const t = decodeTransfer(c.data);
      if (!t) refuse("REFUSED_CALL", `token call ${sel} is not transfer`);
      if (lc(t.to) !== lc(recipient)) refuse("REFUSED_RECIPIENT", "transfer to someone the authority does not name");
      if (BigInt(t.atto) !== BigInt(owedAtto)) refuse("REFUSED_AMOUNT", `transfer of ${t.atto} ≠ owed ${owedAtto}`);
      moved = { atto: t.atto, to: t.to }; shape.push("transfer");
      continue;
    }
    refuse("REFUSED_CALL", `call to ${c.to} is outside this settlement`);
  }
  const s = shape.join(",");
  if (s !== "approve,spend,transfer" && s !== "spend,transfer") refuse("REFUSED_SHAPE", `call shape ${s} is not [approve,] spend, transfer`);
  return { asset_atto: moved.atto, recipient: moved.to, spent };
}

// createAdapter({ chainId, route, reader, sdk, account?, spender?, maxNativeFeeAtto })
//   reader: evm.mjs createEvmReader (the independent oracle)
//   sdk:    { pay, getPaymentStatus }                     for route "pay"
//           { requestSpendPermission, prepareSpendCallData } for route "spend-permission"
export function createAdapter({ chainId, route, reader, sdk, account, spender, maxNativeFeeAtto = "0", grant = null }) {
  const chain = CHAINS[chainId];
  if (!chain) refuse("BAD_CHAIN", `chain ${chainId} is not carried`);
  if (!["pay", "spend-permission"].includes(route)) refuse("BAD_ROUTE", "route is pay or spend-permission");
  if (reader.chainId !== chainId) refuse("BAD_READER", "the reader reads another chain");
  if (route === "spend-permission" && !(isAddr(account) && isAddr(spender))) refuse("BAD_PARTIES", "spend-permission needs the owner account and the agent spender");
  if (route === "spend-permission" && lc(account) === lc(spender)) refuse("BAD_PARTIES", "the spender is the account itself");
  let permission = grant;
  const sent = new Map(); // ref → adapter-local detail (all tx hashes of a spend run)

  const descriptor = {
    contract: CONTRACT,
    adapter_id: route === "pay" ? "smart-account-usdc.pay" : "smart-account-usdc.spend",
    network: chain.caip2,
    verbs: VERBS,
    submit_model: "wallet-submits",
    // keyed by CAIP-19: the kernel names assets by chain id, never by ticker
    assets: { [chain.asset]: { decimals: 6, ref: lc(chain.usdc), symbol: "USDC" } },
    authority_models: route === "pay" ? ["per-payment-approval"] : ["spend-permission"],
    // pay() is called with telemetry:false; the spend-permission helpers wrap
    // every call in the SDK's telemetry and expose no switch. Both routes need
    // the vendor's account and its hosted wallet.
    privacy_satisfies: route === "pay" ? ["no-sdk-telemetry"] : [],
    finality: "l2-finalized-tag",
    replay: "single-use",
    evidence_ceiling: "event-log+readback",
    vendor_oracles: ["vendor:payment-status"],
    oracles: reader.hostIds,
  };

  const adapter = {
    // the reader is exposed so a harness can prove the evidence comes from the
    // reader it controlled, not one the adapter chose
    reader,
    async network() { return descriptor; },

    async balance({ address, asset }) {
      if (asset !== chain.asset) refuse("UNSUPPORTED", `${asset} is not carried`);
      if (!isAddr(address)) refuse("BAD_PARAMS", "not an EVM address");
      return { asset, atto: await reader.balanceOf(chain.usdc, address) };
    },

    async prepare(intent, { now } = {}) {
      if (intent.route.network !== chain.caip2) refuse("BAD_NETWORK", "intent is for another network");
      if (intent.invoice.asset !== chain.asset) refuse("UNSUPPORTED", "only USDC settles here");
      if (lc(intent.route.asset_ref) !== lc(chain.usdc)) refuse("BAD_ASSET", "intent names another token contract");
      if (!isAddr(intent.authority.recipient)) refuse("BAD_PARAMS", "recipient is not an EVM address");
      if (BigInt(intent.authority.max_native_fee_atto) < BigInt(maxNativeFeeAtto)) refuse("FEE_BOUND", "this route may cost the payer more native fee than the authority allows");
      const base = { intent_id: intent.intent_digest, expires_at: intent.authority.not_after, intent };
      if (route === "pay") return { ...base, rail: { amount: fromAtto(intent.invoice.owed_atto, 6), to: intent.authority.recipient, testnet: chain.testnet, dataSuffix: bindSuffix(intent), telemetry: false } };
      if (!permission) refuse("NO_GRANT", "no spend permission granted for this intent (grant it first: the owner's one gesture)");
      const req = permissionRequestFor(intent, { account, spender, chainId, now: now || intent.created_at });
      if (String(permission.permission.salt) !== req.salt || lc(permission.permission.extraData) !== lc(req.extraData))
        refuse("GRANT_FOR_ANOTHER_INTENT", "the granted permission was issued for another intent");
      return { ...base, rail: { permission, recipient: intent.authority.recipient, owed: intent.invoice.owed_atto } };
    },

    // `spend` is what the payloads actually move, decoded from them — never
    // copied from the intent — so the kernel's check compares two things.
    async payloads(prepared) {
      if (route === "pay") {
        const r = prepared.rail;
        return { mode: "wallet-submits", spend: { asset_atto: toAtto(r.amount, 6), recipient: r.to, max_native_fee_atto: String(maxNativeFeeAtto) },
          items: [{ kind: "wallet-request", request: "pay", params: r, summary: `pay ${r.amount} USDC to ${r.to}` }] };
      }
      const calls = await sdk.prepareSpendCallData(prepared.rail.permission, BigInt(prepared.rail.owed), prepared.rail.recipient);
      const moved = guardCalls(calls, { permission: prepared.rail.permission, recipient: prepared.rail.recipient, owedAtto: prepared.rail.owed, usdc: chain.usdc });
      return { mode: "wallet-submits", spend: { asset_atto: moved.asset_atto, recipient: moved.recipient, max_native_fee_atto: String(maxNativeFeeAtto) },
        items: calls.map((c) => ({ kind: "evm-call", to: c.to, data: c.data, value: "0x0",
          summary: lc(c.to) === lc(chain.usdc) ? `forward ${fromAtto(prepared.rail.owed, 6)} USDC to ${prepared.rail.recipient}` : `spend permission call ${lc(c.data).slice(0, 10)}` })) };
    },

    async combine() { refuse("UNSUPPORTED", "wallet-submits: the wallet signs and submits; there are no detached signatures to combine"); },

    async submit(pl, { executor } = {}) {
      if (route === "pay") {
        const r = await (executor || sdk).pay(pl.items[0].params);
        if (!r || !/^0x[0-9a-fA-F]{64}$/.test(r.id)) refuse("NO_REF", "the wallet returned no transaction hash");
        sent.set(lc(r.id), { route, returned: { amount: r.amount, to: r.to } });
        return { ref: lc(r.id), accepted_at: null };
      }
      // the agent's own signer: { address(), send({to,data}) → txHash }
      if (!executor || typeof executor.send !== "function") refuse("NO_SIGNER", "the agent signer is required");
      const from = await executor.address();
      if (lc(from) !== lc(spender)) refuse("WRONG_SIGNER", "the signer is not the permission's spender");
      guardCalls(pl.items, { permission, recipient: pl.spend.recipient, owedAtto: pl.spend.asset_atto, usdc: chain.usdc });
      const hashes = [];
      for (const c of pl.items) hashes.push(lc(await executor.send({ to: c.to, data: c.data })));
      const ref = hashes[hashes.length - 1];
      sent.set(ref, { route, txs: hashes });
      return { ref, accepted_at: null };
    },

    async status(ref) {
      if (route !== "pay" || !sdk.getPaymentStatus) return { phase: "submitted", assertion: null, adapter_local: sent.get(lc(ref)) || null };
      let s, amount = null;
      try { s = await sdk.getPaymentStatus({ id: ref, testnet: chain.testnet }); } catch (e) { return { phase: "unknown", assertion: null, adapter_local: { status_error: String(e.message || e).slice(0, 120) } }; }
      try { amount = s.amount ? toAtto(s.amount, 6) : null; } catch { amount = "unparseable"; } // a vendor quirk never blocks the receipt
      const phase = s.status === "completed" ? "observed" : s.status === "failed" ? "failed" : s.status === "pending" ? "submitted" : "unknown";
      return { phase, assertion: { status: s.status, amount_atto: amount, recipient: s.recipient ? lc(s.recipient) : null, sender: s.sender ? lc(s.sender) : null },
        adapter_local: sent.get(lc(ref)) || null };
    },

    // `related`: the other transactions of a spend run (approve + spend before
    // the forwarding transfer). A fresh adapter rebuilding a receipt from the
    // chain gets them from the receipt's adapter_local; nothing else is needed.
    async reconcile({ intent, ref, related }) {
      const obs = await reader.observeTx(ref, chain.usdc);
      // the payer is known for the agent (the spender) and, when the wallet shared
      // it, for the person (the account); otherwise attribution rests on the binding
      const known = route === "pay" ? (isAddr(account) ? account : null) : spender;
      const records = recordsFromObservation(obs, { caip2: chain.caip2, asset: chain.asset, recipient: intent.authority.recipient, payer: known });
      const payer = known || (records.find((r) => r.kind === "settlement")?.from ?? null);
      const others = route === "pay" ? [] : (related || sent.get(lc(ref))?.txs || []).filter((h) => lc(h) !== lc(ref));
      const otherObs = [];
      for (const h of others) otherObs.push(await reader.observeTx(h, chain.usdc));
      // the fee is the whole run's; a run transaction nobody can read leaves it unknown, never 0
      let fee = obs.found && payer ? payerNativeFee(obs, payer) : null;
      const agreed = (o) => o.found && o.quorum >= 2 && !o.disagree;
      const feeIncomplete = otherObs.some((o) => !agreed(o));
      if (fee && feeIncomplete) fee = null;
      else if (fee) for (const o of otherObs) fee = { atto: (BigInt(fee.atto) + BigInt(payerNativeFee(o, payer).atto)).toString(), basis: fee.basis + "+run" };
      // pay: the attribution suffix in the executed calldata; spend: the
      // authority hash (the permission's extraData) in the spend call. Only
      // calldata the agreeing hosts returned identically counts.
      const binding = route === "pay" ? bindSuffix(intent).slice(2) : hex32(intent.authority_hash).slice(2);
      const inputs = [obs, ...otherObs].filter(agreed).map((o) => o.input);
      const bound = !obs.found ? null : inputs.some((i) => typeof i === "string" && i.includes(binding)) ? true
        : (!agreed(obs) || otherObs.some((o) => !agreed(o)) || inputs.some((i) => i === null)) ? null : false;
      // an unknown payer AND no observed binding: whoever paid the recipient in
      // this transaction cannot be shown to be this invoice's payer
      if (!known && bound !== true && records.some((r) => r.kind === "settlement"))
        records.splice(0, records.length, { kind: "attempt", asset: chain.asset, retryability: "human-gate", txRef: `${chain.caip2}:${lc(ref)}`, value_observed: "tx-hash", unattributed: true });
      return { records, observation: { oracle: "independent:" + reader.hostIds.join("+"), quorum: obs.quorum || 0, finalized: !!obs.finalized, block: obs.blockNumber ?? null, payer, payer_native_fee: fee,
        fee_incomplete: feeIncomplete, intent_bound_on_chain: bound, related: others } };
    },

    // ── the owner's one gesture (spend-permission route) ──
    async grantPermission(intent, { provider, now }) {
      if (route !== "spend-permission") refuse("UNSUPPORTED", "grant is the spend-permission route's");
      const req = permissionRequestFor(intent, { account, spender, chainId, now });
      const g = await sdk.requestSpendPermission({ ...req, provider });
      checkGrant(g, req);
      permission = g;
      return g;
    },

  };
  return adapter;
}
