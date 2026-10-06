// bpay-settle.test.mjs — the SETTLE contract, the Base/Coinbase adapter and the
// tungsten route, against an honest fake and one sabotage per kill condition.
// `node --test` from this directory (CI step "bPay SETTLE adapters").
import test from "node:test";
import assert from "node:assert/strict";
import { buildGenericInvoice } from "../../scripts/lib/bpay-invoice-generic.mjs";
import { VERBS, validateDescriptor, descriptorHash, buildAuthority, buildIntent, validateIntent, assertNeutral, settle, reconcileReceipt, toAtto, fromAtto } from "../../scripts/lib/bpay-settle.mjs";
import { createEvmReader, encodeSpend, decodeSpend, encodeTransfer, decodeTransfer, SEL } from "./evm.mjs";
import { createAdapter, CHAINS, guardCalls, SPEND_PERMISSION_MANAGER, bindSuffix } from "./adapters/smart-account-usdc.mjs";
import { createFakeBase, addr } from "./fake-base.mjs";
import { runTungsten, verifyTungsten, KILLS, VENDOR_TERMS } from "./tungsten.mjs";

const NOW = "2026-10-05T12:00:00.000Z";
const NOT_AFTER = "2026-10-05T17:30:00.000Z";
const QUOTE_EXPIRES = "2026-10-05T18:00:00.000Z";
const CHAIN = 84532;
const ASSET = CHAINS[CHAIN].asset;
const RECIPIENT = addr("merchant");
const OWED = "20000"; // 0.02 USDC

function invoiceFor(asset = ASSET, owed = OWED, ceiling = OWED) {
  return buildGenericInvoice({ jobId: "tungsten-settle-1", issuedAt: NOW,
    lines: [{ kind: "service", asset, quotes: [{ quote_hash: "q-" + asset.slice(-8), amount_atto: owed }] }],
    authorization: { ceilings: { [asset]: ceiling }, authorizedBy: "test", stopConditions: [] } });
}
const memOutbox = () => { const m = new Map(); return { m, persist: async (k, v) => { m.set(k, v); } }; };

function rig({ route = "pay", sabotage = {}, maxNativeFeeAtto, adapterFee } = {}) {
  const chain = createFakeBase({ chainId: CHAIN, sabotage });
  const mkReader = () => createEvmReader({ chainId: CHAIN, hosts: chain.hosts, fetchFn: chain.fetchFn });
  const fee = route === "pay" ? "0" : (adapterFee || "1000000000");
  const mk = () => createAdapter({ chainId: CHAIN, route, reader: mkReader(), sdk: chain.sdk, account: chain.payer, spender: chain.spender, maxNativeFeeAtto: fee });
  const adapter = mk();
  return { chain, adapter, reader: mkReader(), fresh: async () => {
    const a = mk();
    return a; }, maxNativeFeeAtto: maxNativeFeeAtto || fee };
}

async function tungsten(route, sabotage = {}, extra = {}) {
  const r = rig({ route, sabotage, ...extra });
  const run = await runTungsten({ route, adapter: extra.wrap ? extra.wrap(r.adapter) : r.adapter, freshAdapter: r.fresh, reader: r.reader, invoice: invoiceFor(),
    now: NOW, principal: route === "pay" ? "person:payer" : "agent:bFUzZ", recipient: RECIPIENT, maxNativeFeeAtto: r.maxNativeFeeAtto,
    notAfter: NOT_AFTER, quoteExpiresAt: QUOTE_EXPIRES, nonce: "nonce-" + route + "-0001",
    executor: route === "pay" ? r.chain.sdk : r.chain.agent, provider: {}, outbox: memOutbox(), payerAccount: route === "pay" ? r.chain.payer : undefined, runId: "t-" + route });
  return { ...run, chain: r.chain };
}
const check = (t, c) => t.observations.filter((o) => o.check === c);
const okAll = (t, c) => check(t, c).length > 0 && check(t, c).every((o) => o.ok);

// ── units and ABI ───────────────────────────────────────────────────────────
test("decimal ↔ base units are exact, with no float anywhere", () => {
  assert.equal(toAtto("0.02", 6), "20000");
  assert.equal(toAtto("10.5", 6), "10500000");
  assert.equal(fromAtto("10500000", 6), "10.5");
  assert.throws(() => toAtto("0.0000001", 6), /more than 6 decimals/);
});

test("spend and transfer calldata round-trip through the guard's own decoder", () => {
  const p = { account: addr("a"), spender: addr("s"), token: CHAINS[CHAIN].usdc, allowance: "20000", period: 86400, start: 1, end: 2, salt: "77", extraData: "0x" + "ab".repeat(32) };
  const d = decodeSpend(encodeSpend(p, 20000n));
  assert.equal(d.value, "20000");
  assert.equal(d.permission.spender, p.spender.toLowerCase());
  assert.equal(d.permission.extraData, p.extraData);
  assert.deepEqual(decodeTransfer(encodeTransfer(RECIPIENT, "5")), { to: RECIPIENT.toLowerCase(), atto: "5" });
});

// ── the contract ────────────────────────────────────────────────────────────
test("a descriptor that offers owner authority, or cannot evidence value, never validates", async () => {
  const { adapter } = rig();
  const d = await adapter.network();
  assert.ok(validateDescriptor(d));
  assert.deepEqual(d.verbs, VERBS);
  assert.throws(() => validateDescriptor({ ...d, authority_models: ["owner"] }), /owner authority/);
  assert.throws(() => validateDescriptor({ ...d, evidence_ceiling: "self-reported" }), /never evidence value/);
  assert.throws(() => validateDescriptor({ ...d, verbs: VERBS.slice(1) }), /verbs/);
});

test("an authority can never carry owner privilege, nor outlive its quote, nor exceed the invoice ceiling", async () => {
  const { adapter } = rig();
  const d = await adapter.network();
  const inv = invoiceFor();
  const base = { principal: "agent:x", asset: ASSET, max_asset_atto: OWED, max_native_fee_atto: "0", recipient: RECIPIENT, not_after: NOT_AFTER, nonce: "nonce-12345678",
    invoice_digest: inv.identity.contentDigest, adapter_manifest_hash: descriptorHash(d) };
  const { authority } = buildAuthority(base);
  assert.equal(authority.owner_privilege, false);
  assert.throws(() => buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority: { ...authority, owner_privilege: true }, quote: { commitment: inv.commitment.digest, expires_at: QUOTE_EXPIRES }, refund: { policy: "refund-to-source" }, now: NOW }), /owner privilege/);
  assert.throws(() => buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority, quote: { commitment: inv.commitment.digest, expires_at: "2026-10-05T13:00:00.000Z" }, refund: { policy: "refund-to-source" }, now: NOW }), /outlives its quote/);
  const wide = buildAuthority({ ...base, max_asset_atto: "999999" }).authority;
  assert.throws(() => buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority: wide, quote: { commitment: inv.commitment.digest, expires_at: QUOTE_EXPIRES }, refund: { policy: "refund-to-source" }, now: NOW }), /exceeds the invoice's own ceiling/);
  // the authority bound THIS adapter: a changed descriptor is refused
  assert.throws(() => buildIntent({ invoice: inv, asset: ASSET, descriptor: { ...d, finality: "instant" }, authority, quote: { commitment: inv.commitment.digest, expires_at: QUOTE_EXPIRES }, refund: { policy: "refund-to-source" }, now: NOW }), /another adapter manifest/);
  // a privacy requirement the route cannot meet is refused before anything is signed
  assert.throws(() => buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority, quote: { commitment: inv.commitment.digest, expires_at: QUOTE_EXPIRES }, privacy: { requirements: ["no-vendor-account"] }, refund: { policy: "refund-to-source" }, now: NOW }), /cannot meet the privacy requirement no-vendor-account/);
  const intent = buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority, quote: { commitment: inv.commitment.digest, expires_at: QUOTE_EXPIRES }, refund: { policy: "refund-to-source" }, now: NOW });
  assert.ok(validateIntent(intent));
  assert.throws(() => validateIntent({ ...intent, authority: { ...intent.authority, recipient: addr("thief") } }), /does not recompute/);
});

test("the kernel's objects stay vendor-neutral; a vendor name in a record is caught", () => {
  assert.ok(assertNeutral({ a: "eip155:84532", adapter_local: { sdk: "coinbase" } }, VENDOR_TERMS));
  assert.throws(() => assertNeutral({ evidence: [{ txRef: "coinbase:pay:1" }] }, VENDOR_TERMS), /vendor identifier "coinbase"/);
});

// ── the call allowlist ──────────────────────────────────────────────────────
test("the guard refuses owner changes, upgrades, allowances, 7702 and anything off the authority", () => {
  const usdc = CHAINS[CHAIN].usdc;
  const perm = { permission: { account: addr("a"), spender: addr("s"), token: usdc, allowance: OWED, period: 86400, start: 1, end: 2, salt: "9", extraData: "0x" + "cd".repeat(32) } };
  const ctx = { permission: perm, recipient: RECIPIENT, owedAtto: OWED, usdc };
  const good = [{ to: SPEND_PERMISSION_MANAGER, data: encodeSpend(perm.permission, BigInt(OWED)) }, { to: usdc, data: encodeTransfer(RECIPIENT, OWED) }];
  assert.ok(guardCalls(good, ctx));
  const refusedWith = (calls, code) => assert.throws(() => guardCalls(calls, ctx), (e) => e.code === code);
  refusedWith([{ to: addr("a"), data: SEL.addOwnerAddress + "0".repeat(64) }], "REFUSED_AUTHORITY");
  refusedWith([{ to: addr("a"), data: SEL.addOwnerPublicKey + "0".repeat(128) }], "REFUSED_AUTHORITY");
  refusedWith([{ to: addr("a"), data: SEL.upgradeToAndCall + "0".repeat(128) }], "REFUSED_AUTHORITY");
  refusedWith([{ to: addr("a"), data: SEL.executeWithoutChainIdValidation + "0".repeat(64) }], "REFUSED_AUTHORITY");
  refusedWith([{ to: usdc, data: SEL.approve + "0".repeat(128) }], "REFUSED_AUTHORITY");
  refusedWith([{ to: usdc, data: encodeTransfer(RECIPIENT, OWED), authorizationList: [{ address: addr("impl") }] }], "REFUSED_7702");
  refusedWith([{ to: usdc, data: encodeTransfer(addr("thief"), OWED) }], "REFUSED_RECIPIENT");
  refusedWith([{ to: usdc, data: encodeTransfer(RECIPIENT, "20001") }], "REFUSED_AMOUNT");
  refusedWith([{ to: SPEND_PERMISSION_MANAGER, data: encodeSpend(perm.permission, 20001n) }], "REFUSED_AMOUNT");
  refusedWith([{ to: SPEND_PERMISSION_MANAGER, data: encodeSpend({ ...perm.permission, allowance: "1" }, BigInt(OWED)) }], "REFUSED_CALL");
  refusedWith([{ to: usdc, data: encodeTransfer(RECIPIENT, OWED), value: 1n }], "REFUSED_VALUE");
  refusedWith([{ to: addr("elsewhere"), data: "0x12345678" }], "REFUSED_CALL");
});

// ── the tungsten route: honest ──────────────────────────────────────────────
test("TUNGSTEN pay route, honest vendor: every kill condition holds, RECON-1 says SATISFIED", async () => {
  const t = await tungsten("pay");
  for (const k of KILLS) assert.ok(okAll(t.tungsten, k), `${k}: ${JSON.stringify(check(t.tungsten, k))}`);
  assert.equal(t.tungsten.verdict, "PASS_WITH_LIMITATIONS", JSON.stringify(t.tungsten.verdict_reasons));
  assert.equal(t.receipt.reconciliation.conclusion, "SATISFIED");
  assert.equal(t.reconciliation.verdict, "reconciled");
  assert.equal(t.tungsten.capture.settled_atto, OWED);
  assert.equal(t.tungsten.capture.intent_bound_on_chain, true);
  assert.equal(t.chain.balanceOf(RECIPIENT), OWED);
  // the SDK was called with telemetry off and the intent binding as its attribution suffix
  const call = t.chain.sdk.calls.find((c) => c.method === "pay").params;
  assert.equal(call.telemetry, false);
  assert.equal(call.dataSuffix, bindSuffix(t.intent));
  assert.ok(verifyTungsten(t.tungsten).digest_ok && verifyTungsten(t.tungsten).verdict_ok);
});

test("TUNGSTEN spend-permission route, honest: the agent is a spender, never an owner; the cap is the contract's", async () => {
  const t = await tungsten("spend-permission");
  for (const k of KILLS) assert.ok(okAll(t.tungsten, k), `${k}: ${JSON.stringify(check(t.tungsten, k))}`);
  assert.equal(t.tungsten.verdict, "PASS_WITH_LIMITATIONS", JSON.stringify(t.tungsten.verdict_reasons));
  assert.ok(t.tungsten.findings.some((f) => f.id === "recipient-not-contractual"));
  assert.equal(t.receipt.reconciliation.conclusion, "SATISFIED");
  const req = t.chain.sdk.calls.find((c) => c.method === "requestSpendPermission").params;
  assert.equal(req.allowance, BigInt(OWED), "the permission is capped at the authority maximum");
  assert.equal(req.end.toISOString(), NOT_AFTER, "and ends when the authority does");
  assert.equal(req.extraData, "0x" + t.intent.authority_hash.slice(7), "and carries the authority hash on chain");
  assert.equal(t.tungsten.capture.intent_bound_on_chain, true);
  assert.equal(t.chain.balanceOf(RECIPIENT), OWED);
});

// ── one sabotage per kill condition ─────────────────────────────────────────
const failsOn = (t, c) => { assert.equal(t.tungsten.verdict, "FAIL", JSON.stringify([t.tungsten.verdict_reasons, t.tungsten.findings.filter((f) => f.severity === "harness")])); assert.ok(t.tungsten.verdict_reasons.some((r) => r.includes(c)), `${c} ∉ ${t.tungsten.verdict_reasons}`); };

test("kill 1: a vendor flow that adds an owner to the account is refused, and the route FAILS", async () => {
  failsOn(await tungsten("spend-permission", { extraOwnerCall: true }), "kill.1-no-owner-authority");
});
test("kill 1: an agent that already owns the account FAILS the route", async () => {
  failsOn(await tungsten("spend-permission", { agentIsOwner: true }), "kill.1-no-owner-authority");
});
test("kill 1: a pay that changes the payer's owners FAILS the route", async () => {
  failsOn(await tungsten("pay", { payAddsOwner: true }), "kill.1-no-owner-authority");
});
test("kill 2: a wallet that grants a wider permission than asked FAILS", async () => {
  failsOn(await tungsten("spend-permission", { widerGrant: true }), "kill.2-cap-bounded");
});
test("kill 2: a contract that lets the spender exceed the cap FAILS", async () => {
  failsOn(await tungsten("spend-permission", { noCap: true }), "kill.2-cap-bounded");
});
test("kill 2: an unlimited ERC-20 approve in the vendor's calls FAILS", async () => {
  failsOn(await tungsten("spend-permission", { approveAll: true }), "kill.1-no-owner-authority");
});
test("kill 2: a pay that moves more than approved FAILS", async () => {
  failsOn(await tungsten("pay", { payWrongAmount: true }), "kill.2-cap-bounded");
});
test("kill 3: the vendor says completed but the chain shows nothing — FAIL, never SATISFIED", async () => {
  const t = await tungsten("pay", { payNoTransfer: true, statusLies: true });
  failsOn(t, "kill.3-vendor-not-sole-proof");
  assert.notEqual(t.receipt.reconciliation.conclusion, "SATISFIED");
  assert.ok(t.tungsten.findings.some((f) => f.id === "vendor-misreported"));
});
test("kill 4: a chain whose second reading differs FAILS recreation", async () => {
  failsOn(await tungsten("pay", { unstable: true }), "kill.4-receipt-recreatable");
});
test("kill 5: an adapter that leaks a vendor identifier into the evidence FAILS", async () => {
  const wrap = (a) => ({ ...a, reconcile: async (x) => { const r = await a.reconcile(x); return { ...r, records: r.records.map((e) => ({ ...e, txRef: "coinbase:" + e.txRef })) }; } });
  failsOn(await tungsten("pay", {}, { wrap }), "kill.5-no-vendor-leak");
});
test("bound: a payer charged more native fee than the authority allows FAILS", async () => {
  failsOn(await tungsten("pay", { selfPaidGas: true }), "bound.native-fee");
});

// ── broken probes are INCONCLUSIVE, never FAIL and never PASS ───────────────
test("one RPC operator down: INCONCLUSIVE (a single witness proves nothing)", async () => {
  const t = await tungsten("pay", { downHosts: ["publicnode"] });
  assert.equal(t.tungsten.verdict, "INCONCLUSIVE", JSON.stringify(t.tungsten.verdict_reasons));
});
test("the reader is on the wrong chain: INCONCLUSIVE", async () => {
  assert.equal((await tungsten("pay", { wrongChain: true })).tungsten.verdict, "INCONCLUSIVE");
});
test("observed but not final: INCONCLUSIVE, and RECON-1 holds it at FINALITY-PENDING", async () => {
  const t = await tungsten("pay", { neverFinal: true });
  assert.equal(t.tungsten.verdict, "INCONCLUSIVE");
  assert.equal(t.receipt.reconciliation.conclusion, "FINALITY-PENDING");
});
test("a wallet that drops the binding suffix still settles, and the receipt says it is unbound", async () => {
  const t = await tungsten("pay", { dropSuffix: true });
  assert.equal(t.tungsten.capture.intent_bound_on_chain, false);
  assert.ok(t.tungsten.findings.some((f) => f.id === "intent-not-bound-on-chain"));
  assert.equal(t.tungsten.verdict, "PASS_WITH_LIMITATIONS");
});

// ── receipts ────────────────────────────────────────────────────────────────
test("a tampered receipt or tungsten verdict does not reconcile", async () => {
  const t = await tungsten("pay");
  const forged = { ...t.receipt, evidence: t.receipt.evidence.map((e) => ({ ...e, amount: "1" })) };
  assert.equal(reconcileReceipt(forged, { invoice: invoiceFor(), intent: t.intent }).verdict, "breach");
  assert.equal(verifyTungsten({ ...t.tungsten, verdict: "PASS" }).verdict_ok, false);
  assert.equal(verifyTungsten({ ...t.tungsten, capture: { ...t.tungsten.capture, settled_atto: "1" } }).digest_ok, false);
});

test("the outbox holds the payloads before the wallet is asked to pay", async () => {
  const r = rig();
  const d = await r.adapter.network();
  const inv = invoiceFor();
  const { authority } = buildAuthority({ principal: "person:p", asset: ASSET, max_asset_atto: OWED, max_native_fee_atto: "0", recipient: RECIPIENT, not_after: NOT_AFTER, nonce: "nonce-outbox-1", invoice_digest: inv.identity.contentDigest, adapter_manifest_hash: descriptorHash(d) });
  const intent = buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority, quote: { commitment: inv.commitment.digest, expires_at: QUOTE_EXPIRES }, refund: { policy: "refund-to-source" }, now: NOW });
  const order = [];
  const outbox = { persist: async (k) => { order.push("persist:" + k.slice(0, 12)); } };
  const exec = { pay: async (p) => { order.push("pay"); return r.chain.sdk.pay(p); } };
  await settle({ adapter: r.adapter, intent, invoice: inv, signer: exec, outbox, now: NOW });
  assert.deepEqual(order, ["persist:" + intent.intent_digest.slice(0, 12), "pay"]);
});

// ── guards the mutation run (prove.mjs) found untested ──────────────────────
async function payIntent(r) {
  const d = await r.adapter.network();
  const inv = invoiceFor();
  const { authority } = buildAuthority({ principal: "person:p", asset: ASSET, max_asset_atto: OWED, max_native_fee_atto: "0", recipient: RECIPIENT, not_after: NOT_AFTER, nonce: "nonce-guard-01", invoice_digest: inv.identity.contentDigest, adapter_manifest_hash: descriptorHash(d) });
  return { inv, intent: buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority, quote: { commitment: inv.commitment.digest, expires_at: QUOTE_EXPIRES }, refund: { policy: "refund-to-source" }, now: NOW }) };
}

test("an adapter whose payloads move another amount than the invoice owes is refused before the wallet is asked", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  const lying = { ...r.adapter, payloads: async (p) => { const pl = await r.adapter.payloads(p); return { ...pl, spend: { ...pl.spend, asset_atto: "19999" } }; } };
  await assert.rejects(settle({ adapter: lying, intent, invoice: inv, signer: r.chain.sdk, outbox: memOutbox(), now: NOW }), /different amount/);
  assert.equal(r.chain.sdk.calls.length, 0, "nothing reached the wallet");
});

test("value evidence read from the vendor's own endpoint is refused: a page is never its own witness", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  const selfWitness = { ...r.adapter, reconcile: async (x) => { const o = await r.adapter.reconcile(x); return { ...o, observation: { ...o.observation, oracle: "vendor:payment-status" } }; } };
  await assert.rejects(settle({ adapter: selfWitness, intent, invoice: inv, signer: r.chain.sdk, outbox: memOutbox(), now: NOW }), /never its own witness/);
});

test("one operator's receipt is reported one class lower and never terminal", async () => {
  const chain = createFakeBase({ chainId: CHAIN, sabotage: { downHosts: ["publicnode"] } });
  const reader = createEvmReader({ chainId: CHAIN, hosts: chain.hosts, fetchFn: chain.fetchFn });
  const { id } = await chain.sdk.pay({ amount: "0.02", to: RECIPIENT, testnet: true });
  const obs = await reader.observeTx(id, CHAINS[CHAIN].usdc);
  assert.equal(obs.quorum, 1);
  const [rec] = (await import("./evm.mjs")).recordsFromObservation(obs, { caip2: "eip155:84532", asset: ASSET, recipient: RECIPIENT });
  assert.equal(rec.value_observed, "tx-receipt");
  assert.equal(rec.finality, "as-reported");
});
