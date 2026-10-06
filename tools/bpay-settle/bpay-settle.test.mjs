// bpay-settle.test.mjs — the SETTLE contract, the Base/Coinbase adapter and the
// tungsten route, against an honest fake and one sabotage per kill condition.
// `node --test` from this directory (CI step "bPay SETTLE adapters").
import test from "node:test";
import assert from "node:assert/strict";
import { buildGenericInvoice } from "../../scripts/lib/bpay-invoice-generic.mjs";
import { VERBS, validateDescriptor, descriptorHash, buildAuthority, buildIntent, validateIntent, assertNeutral, settle, reconcileReceipt, toAtto, fromAtto, digest } from "../../scripts/lib/bpay-settle.mjs";
import { createEvmReader, encodeSpend, decodeSpend, encodeTransfer, decodeTransfer, recordsFromObservation, SEL } from "./evm.mjs";
import { createAdapter, CHAINS, guardCalls, checkGrant, SPEND_PERMISSION_MANAGER, bindSuffix } from "./adapters/smart-account-usdc.mjs";
import { createFakeBase, addr } from "./fake-base.mjs";
import { runTungsten, verifyTungsten, KILLS, VENDOR_TERMS } from "./tungsten.mjs";

const NOW = "2026-10-05T12:00:00.000Z";
const NOT_AFTER = "2026-10-05T17:30:00.000Z";
const QUOTE_EXPIRES = "2026-10-05T18:00:00.000Z";
const CHAIN = 84532;
const ASSET = CHAINS[CHAIN].asset;
const USDC = CHAINS[CHAIN].usdc;
const RECIPIENT = addr("merchant");
const OWED = "20000"; // 0.02 USDC

function invoiceFor(asset = ASSET, owed = OWED, ceiling = OWED) {
  return buildGenericInvoice({ jobId: "tungsten-settle-1", issuedAt: NOW,
    lines: [{ kind: "service", asset, quotes: [{ quote_hash: "q-" + asset.slice(-8), amount_atto: owed }] }],
    authorization: { ceilings: { [asset]: ceiling }, authorizedBy: "test", stopConditions: [] } });
}
// put-if-absent, as the kernel requires: true only when it stored the entry
const memOutbox = () => { const m = new Map(); return { m, get: async (k) => m.get(k) || null, persist: async (k, v) => { if (m.has(k)) return false; m.set(k, v); return true; } }; };

function rig({ route = "pay", sabotage = {}, maxNativeFeeAtto, adapterFee } = {}) {
  const chain = createFakeBase({ chainId: CHAIN, sabotage });
  const mkReader = () => createEvmReader({ chainId: CHAIN, hosts: chain.hosts, fetchFn: chain.fetchFn });
  const fee = route === "pay" ? "0" : (adapterFee || "1000000000");
  const mk = (reader) => createAdapter({ chainId: CHAIN, route, reader, sdk: chain.sdk, account: chain.payer, spender: chain.spender, maxNativeFeeAtto: fee });
  const reader = mkReader();
  return { chain, reader, adapter: mk(reader), fresh: async () => mk(mkReader()), mkReader, maxNativeFeeAtto: maxNativeFeeAtto || fee };
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
const failsOn = (t, c) => {
  assert.equal(t.tungsten.verdict, "FAIL", JSON.stringify([t.tungsten.verdict_reasons, t.tungsten.findings.filter((f) => f.severity === "harness")]));
  assert.ok(t.tungsten.verdict_reasons.some((r) => r.includes(c)), `${c} ∉ ${t.tungsten.verdict_reasons}`);
};

async function payIntent(r) {
  const d = await r.adapter.network();
  const inv = invoiceFor();
  const { authority } = buildAuthority({ principal: "person:p", asset: ASSET, max_asset_atto: OWED, max_native_fee_atto: "0", recipient: RECIPIENT, not_after: NOT_AFTER, nonce: "nonce-guard-01", invoice_digest: inv.identity.contentDigest, adapter_manifest_hash: descriptorHash(d) });
  return { inv, intent: buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority, quote: { commitment: inv.commitment.digest, expires_at: QUOTE_EXPIRES }, refund: { policy: "refund-to-source" }, now: NOW }) };
}

// ── units and ABI ───────────────────────────────────────────────────────────
test("decimal ↔ base units are exact, with no float anywhere", () => {
  assert.equal(toAtto("0.02", 6), "20000");
  assert.equal(toAtto("10.5", 6), "10500000");
  assert.equal(fromAtto("10500000", 6), "10.5");
  assert.throws(() => toAtto("0.0000001", 6), /more than 6 decimals/);
});

test("spend and transfer calldata round-trip through the guard's own decoder", () => {
  const p = { account: addr("a"), spender: addr("s"), token: USDC, allowance: "20000", period: 86400, start: 1, end: 2, salt: "77", extraData: "0x" + "ab".repeat(32) };
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
  const q = { commitment: inv.commitment.digest, expires_at: QUOTE_EXPIRES };
  const build = (o) => buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority, quote: q, refund: { policy: "refund-to-source" }, now: NOW, ...o });
  assert.equal(authority.owner_privilege, false);
  assert.throws(() => build({ authority: { ...authority, owner_privilege: true } }), /owner privilege/);
  assert.throws(() => build({ quote: { ...q, expires_at: "2026-10-05T13:00:00.000Z" } }), /outlives its quote/);
  assert.throws(() => build({ authority: buildAuthority({ ...base, max_asset_atto: "999999" }).authority }), /exceeds the invoice's own ceiling/);
  // the authority bound THIS adapter: a changed descriptor is refused
  assert.throws(() => build({ descriptor: { ...d, finality: "instant" } }), /another adapter manifest/);
  // a privacy requirement the route cannot meet is refused before anything is signed
  assert.throws(() => build({ privacy: { requirements: ["no-vendor-account"] } }), /cannot meet the privacy requirement no-vendor-account/);
  const intent = build({});
  assert.ok(validateIntent(intent));
  assert.throws(() => validateIntent({ ...intent, authority: { ...intent.authority, recipient: addr("thief") } }), /does not recompute/);
});

test("the kernel's objects stay vendor-neutral; a vendor name in a record is caught", () => {
  assert.ok(assertNeutral({ a: "eip155:84532", adapter_local: { sdk: "coinbase" } }, VENDOR_TERMS));
  assert.throws(() => assertNeutral({ evidence: [{ txRef: "coinbase:pay:1" }] }, VENDOR_TERMS), /vendor identifier "coinbase"/);
  assert.throws(() => assertNeutral({ evidence: [{ adapter_local: { sdk: "coinbase" } }] }, VENDOR_TERMS), /vendor identifier/, "only the top-level adapter_local is the adapter's room");
});

// ── the call allowlist and its shape ────────────────────────────────────────
test("the guard refuses owner changes, upgrades, allowances, 7702, odd encodings and anything off the authority", () => {
  const perm = { permission: { account: addr("a"), spender: addr("s"), token: USDC, allowance: OWED, period: 86400, start: 1, end: 2, salt: "9", extraData: "0x" + "cd".repeat(32) } };
  const ctx = { permission: perm, recipient: RECIPIENT, owedAtto: OWED, usdc: USDC };
  const spendCall = { to: SPEND_PERMISSION_MANAGER, data: encodeSpend(perm.permission, BigInt(OWED)) };
  const transferCall = { to: USDC, data: encodeTransfer(RECIPIENT, OWED) };
  assert.deepEqual(guardCalls([spendCall, transferCall], ctx), { asset_atto: OWED, recipient: RECIPIENT.toLowerCase(), spent: OWED });
  const refusedWith = (calls, code) => assert.throws(() => guardCalls(calls, ctx), (e) => e.code === code, code);
  refusedWith([spendCall, { to: addr("a"), data: SEL.addOwnerAddress + "0".repeat(64) }], "REFUSED_AUTHORITY");
  refusedWith([spendCall, { to: addr("a"), data: SEL.addOwnerPublicKey + "0".repeat(128) }], "REFUSED_AUTHORITY");
  refusedWith([spendCall, { to: addr("a"), data: SEL.upgradeToAndCall + "0".repeat(128) }], "REFUSED_AUTHORITY");
  refusedWith([spendCall, { to: addr("a"), data: SEL.executeWithoutChainIdValidation + "0".repeat(64) }], "REFUSED_AUTHORITY");
  refusedWith([spendCall, { to: USDC, data: SEL.approve + "0".repeat(128) }], "REFUSED_AUTHORITY");
  refusedWith([spendCall, { ...transferCall, authorizationList: [{ address: addr("impl") }] }], "REFUSED_7702");
  refusedWith([spendCall, { to: USDC, data: encodeTransfer(addr("thief"), OWED) }], "REFUSED_RECIPIENT");
  refusedWith([spendCall, { to: USDC, data: encodeTransfer(RECIPIENT, "20001") }], "REFUSED_AMOUNT");
  refusedWith([{ to: SPEND_PERMISSION_MANAGER, data: encodeSpend(perm.permission, 20001n) }, transferCall], "REFUSED_AMOUNT");
  refusedWith([{ to: SPEND_PERMISSION_MANAGER, data: encodeSpend({ ...perm.permission, allowance: "1" }, BigInt(OWED)) }, transferCall], "REFUSED_CALL");
  refusedWith([{ to: SPEND_PERMISSION_MANAGER, data: encodeSpend({ ...perm.permission, period: 1 }, BigInt(OWED)) }, transferCall], "REFUSED_CALL");
  refusedWith([spendCall, { ...transferCall, value: 1n }], "REFUSED_VALUE");
  refusedWith([spendCall, { ...transferCall, value: "1e18" }], "REFUSED_CALL");
  refusedWith([spendCall, { to: addr("elsewhere"), data: "0x12345678" }], "REFUSED_CALL");
  // shape: one spend then one transfer (an approve may lead); nothing else, nothing twice, nothing out of order
  refusedWith([transferCall, spendCall], "REFUSED_SHAPE");
  refusedWith([spendCall, transferCall, transferCall], "REFUSED_SHAPE");
  refusedWith([transferCall], "REFUSED_SHAPE");
  // an unaligned tuple offset is an encoding Solidity reads differently: refused, never re-read
  const unaligned = spendCall.data.slice(0, 10) + "0".repeat(62) + "41" + spendCall.data.slice(74);
  assert.throws(() => guardCalls([{ to: SPEND_PERMISSION_MANAGER, data: unaligned }, transferCall], ctx), (e) => /^REFUSED_/.test(e.code));
});

// ── the tungsten route: honest ──────────────────────────────────────────────
test("TUNGSTEN pay route, honest vendor: every kill condition holds, RECON-1 says SATISFIED", async () => {
  const t = await tungsten("pay");
  for (const k of KILLS) assert.ok(okAll(t.tungsten, k), `${k}: ${JSON.stringify(check(t.tungsten, k))}`);
  assert.equal(t.tungsten.verdict, "PASS_WITH_LIMITATIONS", JSON.stringify(t.tungsten.verdict_reasons));
  assert.equal(t.receipt.reconciliation.conclusion, "SATISFIED");
  assert.equal(t.reconciliation.verdict, "reconciled");
  assert.ok(t.reconciliation.checks.some((c) => c.name === "evidence-rebuilds-from-chain" && c.ok));
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
  // the cap probe ran after approval and saw the contract's own cap error on every host
  const k2 = check(t.tungsten, "kill.2-cap-bounded")[0];
  assert.equal(k2.detail.cap_reverts, 2);
  assert.equal(k2.detail.other_reverts, 0);
  assert.ok(!t.tungsten.findings.some((f) => f.id === "cap-probe-unreachable"), "the permission read as valid on every operator");
});

// ── one sabotage per kill condition ─────────────────────────────────────────
test("kill 1: a vendor flow that adds an owner to the account is refused, and the route FAILS", async () => {
  failsOn(await tungsten("spend-permission", { extraOwnerCall: true }), "kill.1-no-owner-authority");
});
test("kill 1: an agent that already owns the account FAILS the route, and nothing settles", async () => {
  const t = await tungsten("spend-permission", { agentIsOwner: true });
  failsOn(t, "kill.1-no-owner-authority");
  assert.equal(t.chain.balanceOf(RECIPIENT), "0");
});
test("kill 1: a pay that changes the payer's owners FAILS the route", async () => {
  failsOn(await tungsten("pay", { payAddsOwner: true }), "kill.1-no-owner-authority");
});
test("kill 1: an unlimited ERC-20 approve in the vendor's calls is a grant of authority, and FAILS", async () => {
  failsOn(await tungsten("spend-permission", { approveAll: true }), "kill.1-no-owner-authority");
});
test("kill 2: a wallet that grants a wider permission than asked FAILS", async () => {
  failsOn(await tungsten("spend-permission", { widerGrant: true }), "kill.2-cap-bounded");
});
test("kill 2: a permission whose period is shorter than its window (the cap would refill) FAILS", async () => {
  failsOn(await tungsten("spend-permission", { shortPeriod: true }), "kill.2-cap-bounded");
});
test("kill 2: a contract that lets the spender exceed the cap FAILS", async () => {
  failsOn(await tungsten("spend-permission", { noCap: true }), "kill.2-cap-bounded");
});
test("kill 2: an extra transfer in the vendor's calls breaks the run's shape and FAILS", async () => {
  failsOn(await tungsten("spend-permission", { extraTransfer: true }), "kill.2-cap-bounded");
});
test("kill 2: a pay that moves more than approved FAILS", async () => {
  failsOn(await tungsten("pay", { payWrongAmount: true }), "kill.2-cap-bounded");
});
test("kill 3: the vendor says completed but the chain shows nothing — FAIL, never SATISFIED", async () => {
  const t = await tungsten("pay", { payNoTransfer: true, statusLies: true });
  assert.equal(t.tungsten.verdict, "FAIL");
  assert.notEqual(t.receipt.reconciliation.conclusion, "SATISFIED");
  assert.ok(t.tungsten.findings.some((f) => f.id === "vendor-misreported"));
});
test("kill 3: value read from an endpoint under the vendor prefix FAILS", async () => {
  const wrap = (a) => ({ ...a, reconcile: async (x) => { const o = await a.reconcile(x); return { ...o, observation: { ...o.observation, oracle: "vendor:status-mirror" } }; } });
  failsOn(await tungsten("pay", {}, { wrap }), "kill.3-vendor-not-sole-proof");
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

// ── broken probes are INCONCLUSIVE, never FAIL and never PASS — and move no money ──
test("one RPC operator down: INCONCLUSIVE, and nothing was paid", async () => {
  const t = await tungsten("pay", { downHosts: ["publicnode"] });
  assert.equal(t.tungsten.verdict, "INCONCLUSIVE", JSON.stringify(t.tungsten.verdict_reasons));
  assert.equal(t.chain.sdk.calls.length, 0);
});
test("the reader is on the wrong chain: INCONCLUSIVE, and nothing was paid", async () => {
  const t = await tungsten("pay", { wrongChain: true });
  assert.equal(t.tungsten.verdict, "INCONCLUSIVE");
  assert.equal(t.chain.balanceOf(RECIPIENT), "0");
});
test("an adapter reading through a reader the harness did not control: INCONCLUSIVE", async () => {
  const wrap = (a) => ({ ...a, reader: { ...a.reader } });
  const t = await tungsten("pay", {}, { wrap });
  assert.equal(t.tungsten.verdict, "INCONCLUSIVE");
  assert.ok(t.tungsten.verdict_reasons.includes("control failed: control.reader-is-ours"));
});
test("observed but not final: INCONCLUSIVE, and RECON-1 holds it at FINALITY-PENDING", async () => {
  const t = await tungsten("pay", { neverFinal: true });
  assert.equal(t.tungsten.verdict, "INCONCLUSIVE");
  assert.equal(t.receipt.reconciliation.conclusion, "FINALITY-PENDING");
});
test("one host lying about the block number cannot make an unfinalized payment terminal", async () => {
  const t = await tungsten("pay", { lyingBlockHost: "base-foundation", neverFinal: true });
  assert.notEqual(t.receipt.reconciliation.conclusion, "SATISFIED");
  assert.ok(t.receipt.evidence.every((r) => r.finality !== "terminal"));
  assert.equal(t.tungsten.verdict, "INCONCLUSIVE");
});
test("one operator's receipt is reported one class lower and never terminal", async () => {
  const chain = createFakeBase({ chainId: CHAIN, sabotage: { downHosts: ["publicnode"] } });
  const reader = createEvmReader({ chainId: CHAIN, hosts: chain.hosts, fetchFn: chain.fetchFn });
  const { id } = await chain.sdk.pay({ amount: "0.02", to: RECIPIENT, testnet: true });
  const obs = await reader.observeTx(id, USDC);
  assert.equal(obs.quorum, 1);
  const [rec] = recordsFromObservation(obs, { caip2: "eip155:84532", asset: ASSET, recipient: RECIPIENT });
  assert.equal(rec.value_observed, "tx-receipt");
  assert.equal(rec.finality, "as-reported");
});
test("a wallet that drops the binding suffix still settles for a known payer, and the receipt says it is unbound", async () => {
  const t = await tungsten("pay", { dropSuffix: true });
  assert.equal(t.tungsten.capture.intent_bound_on_chain, false);
  assert.ok(t.tungsten.findings.some((f) => f.id === "intent-not-bound-on-chain"));
  assert.equal(t.tungsten.verdict, "PASS_WITH_LIMITATIONS");
});

// ── attribution ─────────────────────────────────────────────────────────────
test("a bundle where our op reverted and someone else paid the merchant is never our payment", async () => {
  const t = await tungsten("pay", { otherPayerInBundle: true });
  assert.notEqual(t.receipt?.reconciliation.conclusion, "SATISFIED");
  assert.ok(!["PASS", "PASS_WITH_LIMITATIONS"].includes(t.tungsten.verdict), t.tungsten.verdict);
});
test("an unknown payer without the on-chain binding is not attributed: a human looks", async () => {
  const chain = createFakeBase({ chainId: CHAIN, sabotage: { dropSuffix: true } });
  const reader = createEvmReader({ chainId: CHAIN, hosts: chain.hosts, fetchFn: chain.fetchFn });
  const a = createAdapter({ chainId: CHAIN, route: "pay", reader, sdk: chain.sdk });
  const { inv, intent } = await payIntent({ adapter: a });
  const run = await settle({ adapter: a, intent, invoice: inv, signer: chain.sdk, outbox: memOutbox(), now: NOW });
  assert.equal(run.receipt.reconciliation.conclusion, "FAILED-HUMAN-GATE");
});

// ── the kernel at settle time ───────────────────────────────────────────────
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
test("the caller's vendor list wins over the adapter's own declaration", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  const sly = { ...r.adapter, reconcile: async (x) => { const o = await r.adapter.reconcile(x); return { ...o, observation: { ...o.observation, oracle: "mirror.example:status" } }; } };
  await assert.rejects(settle({ adapter: sly, intent, invoice: inv, signer: r.chain.sdk, outbox: memOutbox(), now: NOW, vendorOracles: ["mirror.example"] }), /never its own witness/);
});
test("an intent past its authority's not_after is refused at settle time, before the wallet is asked", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  await assert.rejects(settle({ adapter: r.adapter, intent, invoice: inv, signer: r.chain.sdk, outbox: memOutbox(), now: "2026-10-05T17:31:00.000Z" }), /authority expired/);
  assert.equal(r.chain.sdk.calls.length, 0);
});
test("a hand-edited intent with recomputed digests is refused: out of bounds by the rebuild, in bounds by the signed hash", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  const edit = (authority) => { const { intent_digest, ...b0 } = { ...intent, authority, authority_hash: digest("bnr/settle-authority/v1", authority) }; return { ...b0, intent_digest: digest("bnr/settle-intent/v1", b0) }; };
  const outlives = edit({ ...intent.authority, not_after: "2026-10-05T19:00:00.000Z" });
  assert.ok(validateIntent(outlives), "the forger's digests are self-consistent");
  await assert.rejects(settle({ adapter: r.adapter, intent: outlives, invoice: inv, signer: r.chain.sdk, outbox: memOutbox(), now: NOW }), /outlives its quote/);
  const feeier = edit({ ...intent.authority, max_native_fee_atto: "999999999" });
  await assert.rejects(settle({ adapter: r.adapter, intent: feeier, invoice: inv, signer: r.chain.sdk, outbox: memOutbox(), now: NOW, authorityHash: intent.authority_hash }), /not the one that was signed/);
  assert.equal(r.chain.sdk.calls.length, 0);
});
test("single-use: settling the same intent twice pays once", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  const outbox = memOutbox();
  await settle({ adapter: r.adapter, intent, invoice: inv, signer: r.chain.sdk, outbox, now: NOW });
  await assert.rejects(settle({ adapter: r.adapter, intent, invoice: inv, signer: r.chain.sdk, outbox, now: NOW }), (e) => e.code === "SETTLE_REPLAY");
  assert.equal(r.chain.sdk.calls.filter((c) => c.method === "pay").length, 1);
});
test("the outbox holds the payloads before the wallet is asked to pay", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  const order = [];
  const outbox = { get: async () => null, persist: async (k) => { order.push("persist:" + k.slice(0, 22)); return true; } };
  const exec = { pay: async (p) => { order.push("pay"); return r.chain.sdk.pay(p); } };
  await settle({ adapter: r.adapter, intent, invoice: inv, signer: exec, outbox, now: NOW });
  assert.deepEqual(order, ["persist:" + ("authority:" + intent.authority_hash).slice(0, 22), "pay"]);
});

// ── receipts ────────────────────────────────────────────────────────────────
test("a tampered receipt does not reconcile — even with its digest recomputed, the chain rebuild catches it", async () => {
  const t = await tungsten("pay");
  const forged = { ...t.receipt, evidence: t.receipt.evidence.map((e) => ({ ...e, amount: "1" })) };
  assert.equal(reconcileReceipt(forged, { invoice: invoiceFor(), intent: t.intent }).verdict, "breach");
  const { receipt_digest, ...body } = forged;
  const reforged = { ...body, receipt_digest: digest("bnr/settle-receipt/v1", body) };
  const again = await createAdapter({ chainId: CHAIN, route: "pay", reader: createEvmReader({ chainId: CHAIN, hosts: t.chain.hosts, fetchFn: t.chain.fetchFn }), sdk: t.chain.sdk, account: t.chain.payer })
    .reconcile({ intent: t.intent, ref: t.receipt.ref });
  const r = reconcileReceipt(reforged, { invoice: invoiceFor(), intent: t.intent, rebuiltRecords: again.records });
  assert.equal(r.verdict, "breach");
  assert.ok(r.breaches.includes("evidence-rebuilds-from-chain"));
  assert.ok(!r.breaches.includes("receipt-digest"), "the forger's digest recomputes; only the chain catches it");
  assert.equal(reconcileReceipt(t.receipt, { invoice: invoiceFor(), intent: t.intent, expectedOracle: "vendor:payment-status" }).verdict, "breach");
});
test("a tampered tungsten verdict or capture does not verify", async () => {
  const t = await tungsten("pay");
  assert.equal(verifyTungsten({ ...t.tungsten, verdict: "PASS" }).verdict_ok, false);
  assert.equal(verifyTungsten({ ...t.tungsten, capture: { ...t.tungsten.capture, settled_atto: "1" } }).digest_ok, false);
});

// ── the second review's findings ────────────────────────────────────────────
test("single-use belongs to the authority: a fresh intent from the same authority a minute later is refused", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  const outbox = memOutbox();
  await settle({ adapter: r.adapter, intent, invoice: inv, signer: r.chain.sdk, outbox, now: NOW });
  const d = await r.adapter.network();
  const fresh = buildIntent({ invoice: inv, asset: ASSET, descriptor: d, authority: intent.authority, quote: intent.quote, refund: intent.refund, now: "2026-10-05T12:01:00.000Z" });
  assert.notEqual(fresh.intent_digest, intent.intent_digest);
  await assert.rejects(settle({ adapter: r.adapter, intent: fresh, invoice: inv, signer: r.chain.sdk, outbox, now: "2026-10-05T12:01:00.000Z" }), (e) => e.code === "SETTLE_REPLAY");
  assert.equal(r.chain.sdk.calls.filter((c) => c.method === "pay").length, 1);
});
test("a replayed authority is refused before the adapter is asked anything", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  let prepares = 0;
  const counted = { ...r.adapter, prepare: async (...x) => { prepares++; return r.adapter.prepare(...x); } };
  const outbox = memOutbox();
  await settle({ adapter: counted, intent, invoice: inv, signer: r.chain.sdk, outbox, now: NOW });
  await assert.rejects(settle({ adapter: counted, intent, invoice: inv, signer: r.chain.sdk, outbox, now: NOW }), (e) => e.code === "SETTLE_REPLAY");
  assert.equal(prepares, 1);
});
test("two concurrent settlements of one authority pay once: the put-if-absent claim decides", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  const outbox = memOutbox();
  const runs = await Promise.allSettled([1, 2].map(() => settle({ adapter: r.adapter, intent, invoice: inv, signer: r.chain.sdk, outbox, now: NOW })));
  assert.equal(runs.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(runs.find((x) => x.status === "rejected").reason.code, "SETTLE_REPLAY");
  assert.equal(r.chain.sdk.calls.filter((c) => c.method === "pay").length, 1);
});
test("a host that lies about gas only on the run's approve and spend cannot fit the fee inside the bound", async () => {
  const t = await tungsten("spend-permission", { lyingGasRelatedHost: "base-foundation", expensiveGas: true });
  assert.ok(!["PASS", "PASS_WITH_LIMITATIONS"].includes(t.tungsten.verdict), t.tungsten.verdict);
  assert.ok(t.tungsten.findings.some((f) => f.id === "fee-incomplete"));
});
test("a caller's own mistake is INCONCLUSIVE, never a FAIL charged to the vendor", async () => {
  const r = rig();
  const t = await runTungsten({ route: "pay", adapter: r.adapter, reader: r.reader, freshAdapter: r.fresh, invoice: invoiceFor(), now: NOW, principal: "person:p", recipient: RECIPIENT,
    notAfter: NOT_AFTER, quoteExpiresAt: QUOTE_EXPIRES, nonce: "nonce-no-get-1", executor: r.chain.sdk, outbox: { persist: async () => true }, payerAccount: r.chain.payer });
  assert.equal(t.tungsten.verdict, "INCONCLUSIVE");
  assert.ok(!t.tungsten.observations.some((o) => o.check === "kill.2-cap-bounded" && !o.ok));
});
test("a cap probe that cannot run after settling does not hide a later FAIL", async () => {
  const wrap = (a) => ({ ...a, reconcile: async (x) => { const r = await a.reconcile(x); return { ...r, records: r.records.map((e) => ({ ...e, txRef: "coinbase:" + e.txRef })) }; } });
  const t = await tungsten("spend-permission", { isValidFlakyHost: "publicnode" }, { wrap });
  assert.ok(t.tungsten.findings.some((f) => f.id === "cap-probe-unreachable"));
  failsOn(t, "kill.5-no-vendor-leak");
});

// ── guards the mutation run reached only through these ──────────────────────

const unknownPayerRun = async (sabotage) => {
  const chain = createFakeBase({ chainId: CHAIN, sabotage });
  const a = createAdapter({ chainId: CHAIN, route: "pay", reader: createEvmReader({ chainId: CHAIN, hosts: chain.hosts, fetchFn: chain.fetchFn }), sdk: chain.sdk });
  const { inv, intent } = await payIntent({ adapter: a });
  return (await settle({ adapter: a, intent, invoice: inv, signer: chain.sdk, outbox: memOutbox(), now: NOW })).receipt;
};
test("a transfer from a third party with no operation of its own is never this payment", async () => {
  assert.equal((await unknownPayerRun({ thirdPartyTransfer: true })).reconciliation.conclusion, "FAILED-HUMAN-GATE");
});
test("two payers paying the merchant in one bundle cannot be told apart: a human looks", async () => {
  assert.equal((await unknownPayerRun({ twoPayersInBundle: true })).reconciliation.conclusion, "FAILED-HUMAN-GATE");
});
test("a host that shrinks the gas cannot fit an over-bound fee inside the authority", async () => {
  const t = await tungsten("spend-permission", { lyingGasHost: "base-foundation", expensiveGas: true });
  assert.ok(!["PASS", "PASS_WITH_LIMITATIONS"].includes(t.tungsten.verdict), t.tungsten.verdict);
});
test("kill 2: a contract that reverts the over-cap spend for another reason has not shown a cap: FAIL", async () => {
  failsOn(await tungsten("spend-permission", { wrongRevert: true }), "kill.2-cap-bounded");
});
test("a reader with one operator fails the quorum control: INCONCLUSIVE", async () => {
  const chain = createFakeBase({ chainId: CHAIN });
  const one = createEvmReader({ chainId: CHAIN, hosts: chain.hosts.slice(0, 1), fetchFn: chain.fetchFn });
  const a = createAdapter({ chainId: CHAIN, route: "pay", reader: one, sdk: chain.sdk, account: chain.payer });
  const t = await runTungsten({ route: "pay", adapter: a, reader: one, invoice: invoiceFor(), now: NOW, principal: "person:p", recipient: RECIPIENT, notAfter: NOT_AFTER,
    quoteExpiresAt: QUOTE_EXPIRES, nonce: "nonce-one-host", executor: chain.sdk, outbox: memOutbox(), payerAccount: chain.payer });
  assert.equal(t.tungsten.verdict, "INCONCLUSIVE");
  assert.ok(t.tungsten.verdict_reasons.includes("control failed: control.oracle-quorum"));
  assert.equal(chain.sdk.calls.length, 0);
});
test("a grant whose single period does not cover its window is refused, even when it matches the request", () => {
  const req = { account: addr("a"), spender: addr("s"), token: USDC, allowance: 5n, periodInDays: 1, start: new Date(0), end: new Date(3 * 86400 * 1000), salt: "1", extraData: "0x" + "ab".repeat(32) };
  const g = { permission: { account: req.account, spender: req.spender, token: req.token, allowance: "5", period: 86400, start: 0, end: 3 * 86400, salt: "1", extraData: req.extraData } };
  assert.throws(() => checkGrant(g, req), /cap would reset/);
});
test("a record naming another asset than the settlement is refused", async () => {
  const r = rig();
  const { inv, intent } = await payIntent(r);
  const other = { ...r.adapter, reconcile: async (x) => { const o = await r.adapter.reconcile(x); return { ...o, records: o.records.map((e) => ({ ...e, asset: "eip155:84532/erc20:0x" + "1".repeat(40) })) }; } };
  await assert.rejects(settle({ adapter: other, intent, invoice: inv, signer: r.chain.sdk, outbox: memOutbox(), now: NOW }), /another asset/);
});
