// tungsten.mjs — TUNGSTEN: COINBASE SETTLEMENT ROUTE.
//
// One run walks the eight steps and checks the five kill conditions. The
// verdict is computed from observations, never written by hand, with the
// same four verdicts and the same uniform-failure law as the doxx harness
// (tools/net-doxx/net-receipt.mjs): a failed control means the probe is
// broken, so it can only yield INCONCLUSIVE, never FAIL and never PASS.
//
//   1 QUOTE          the invoice's carried quote set, with its expiry
//     PRICING COMMITMENT  that set's digest (INVOICE-1 commitment.digest)
//   2 INVOICE        INVOICE-1, validated
//   3 AUTHORIZATION  bounded, never owner privilege (spend route: the owner's
//                    one grant, checked field by field against the request)
//   4 EXECUTE        through the injected Base Account SDK
//   5 CAPTURE        account, chain, asset, requested, settled, tx, fee, commitments
//   6 READ           the settlement, from two RPC operators that are not the vendor
//   7 RECEIPT        bnr.settle-receipt/1
//   8 RECONCILE      vendor-reported == chain-observed == committed
//
// KILL CONDITIONS (any one fails the route):
//   kill.1-no-owner-authority     BNR never hands the vendor (or the agent) owner power
//   kill.2-cap-bounded            the payment cap is enforced by contract or by the payer's own signature
//   kill.3-vendor-not-sole-proof  payment is proven without the vendor's assertion
//   kill.4-receipt-recreatable    a fresh reader rebuilds the same evidence from the chain alone
//   kill.5-no-vendor-leak         no vendor identifier reaches the kernel's objects
import { buildAuthority, buildIntent, settle, reconcileReceipt, assertNeutral, descriptorHash, digest } from "../../scripts/lib/bpay-settle.mjs";
import { canonicalBytes } from "../../scripts/lib/bpay-invoice-generic.mjs";
import { SEL, ERR, addrWord, wordInt, encodeIsValid, encodeSpend } from "./evm.mjs";
import { SPEND_PERMISSION_MANAGER } from "./adapters/smart-account-usdc.mjs";

// ── the harness's own chain probes ──────────────────────────────────────────
// Read through the harness's reader, never asked of the adapter under test,
// and only values every operator returned identically count.
const asWord = (v) => wordInt(String(v).replace(/^0x/, "").padStart(64, "0").slice(-64));
// "0x" from every operator = no code at the account (counterfactual)
async function spenderIsOwner(reader, account, spender) {
  const v = await reader.callAgreed(account, SEL.isOwnerAddress + addrWord(spender));
  if (v === null) return { readable: false };
  if (v === "0x") return { readable: true, deployed: false, owner: null };
  return { readable: true, deployed: true, owner: asWord(v) === 1n };
}
async function ownerIndex(reader, account) {
  const v = await reader.callAgreed(account, SEL.nextOwnerIndex);
  return v === null || v === "0x" ? null : asWord(v).toString();
}
// Does the CONTRACT refuse a spend above the cap? Run after approval, because
// SpendPermissionManager checks validity and the window before the cap: an
// unapproved probe reverts for another reason. Every operator must revert the
// over-cap spend with ExceededSpendPermission itself. eth_call only: no money.
async function capProbe(reader, permission) {
  const p = permission.permission;
  const valid = await reader.callAgreed(SPEND_PERMISSION_MANAGER, encodeIsValid(p), p.spender);
  const over = await reader.simulate(p.spender, SPEND_PERMISSION_MANAGER, encodeSpend({ ...p }, BigInt(p.allowance) + 1n));
  const capReverts = over.reverts.filter((r) => r.selector === ERR.ExceededSpendPermission).length;
  return { permission_valid: valid !== null && asWord(valid) === 1n, hosts: reader.hostIds.length, succeeded: over.succeeded, cap_reverts: capReverts, other_reverts: over.reverts.length - capReverts };
}

export const TUNGSTEN_SCHEMA = "bnr.settle-tungsten/1";
export const VERDICTS = ["PASS", "PASS_WITH_LIMITATIONS", "FAIL", "INCONCLUSIVE"];
export const KILLS = ["kill.1-no-owner-authority", "kill.2-cap-bounded", "kill.3-vendor-not-sole-proof", "kill.4-receipt-recreatable", "kill.5-no-vendor-leak"];
export const REQUIRED = [...KILLS, "bound.native-fee", "reconcile.three-way", "reconcile.receipt"];
const CONTROLS = ["control.reader-is-ours", "control.chain", "control.oracle-quorum", "control.token"];
// The caller's list, never the adapter's: an adapter does not get to say what
// counts as its own vendor's name.
export const VENDOR_TERMS = ["coinbase", "base-org", "baseaccount", "base account", "keys.coinbase", "cdp", "smartwallet", "smart wallet", "paymentstatus", "permissionhash", "callsid"];

// Findings stated from source before any run. Each is a limitation, not a
// kill: the route works, and the receipt says where its bound is only a promise.
export const KNOWN = {
  "spend-permission": [
    { id: "recipient-not-contractual", severity: "limitation", text: "SpendPermissionManager.spend pays the SPENDER; forwarding to the recipient is the agent's own transfer, held to the authority only by BNR's call allowlist (signer-authoritative, not on-chain). Source: prepareSpendCallData appends a separate ERC-20 transfer." },
    { id: "sdk-telemetry-unswitchable", severity: "limitation", text: "the spend-permission helpers are wrapped in the SDK's telemetry with no off switch; a privacy requirement of no-sdk-telemetry cannot use this route." },
  ],
  pay: [
    { id: "cap-is-per-payment-approval", severity: "limitation", text: "pay() has no standing cap: the bound is the person's passkey approval of the exact amount and recipient. Fit for a person present; an agent uses the spend-permission route." },
    { id: "vendor-wallet-hosted", severity: "limitation", text: "the approval runs in the vendor-hosted wallet window; BNR sees the request it made and the chain's result, not what the window showed." },
  ],
};

export function computeVerdict(observations, findings) {
  const by = new Map();
  for (const o of observations) by.set(o.check, [...(by.get(o.check) || []), o]);
  const failed = (c) => (by.get(c) || []).some((r) => !r.ok);
  const stopped = (findings || []).filter((f) => f.severity === "harness" || f.severity === "refused");
  const ctl = [];
  for (const c of CONTROLS) if (!by.has(c)) ctl.push(`control missing: ${c}`);
  for (const c of by.keys()) if (c.startsWith("control.") && failed(c)) ctl.push(`control failed: ${c}`);
  // a dead probe proves nothing either way
  if (ctl.length) return { verdict: "INCONCLUSIVE", reasons: ctl };
  const blockers = (findings || []).filter((f) => f.severity === "blocker");
  const fails = REQUIRED.filter(failed);
  if (fails.length || blockers.length) return { verdict: "FAIL", reasons: [...fails.map((c) => `check failed: ${c}`), ...blockers.map((f) => `blocker: ${f.id}`)] };
  if (stopped.length) return { verdict: "INCONCLUSIVE", reasons: stopped.map((f) => `${f.severity}: ${f.id}`) };
  const missing = REQUIRED.filter((c) => !by.has(c));
  if (missing.length) return { verdict: "INCONCLUSIVE", reasons: missing.map((c) => `check not run: ${c}`) };
  const info = [...by.keys()].filter((c) => !REQUIRED.includes(c) && !c.startsWith("control.") && failed(c));
  const lim = [...info.map((c) => `observation failed: ${c}`), ...(findings || []).filter((f) => f.severity === "limitation").map((f) => `limitation: ${f.id}`)];
  return lim.length ? { verdict: "PASS_WITH_LIMITATIONS", reasons: lim } : { verdict: "PASS", reasons: [] };
}

// Same domain law as every bnr receipt: sha256(domain ‖ 0x00 ‖ canonical JSON)
export function tungstenDigest(body) { return digest("bnr/settle-tungsten/v1", body); }

const stripStamp = (records) => records.map(({ invoiceContentDigest, ...r }) => r);

export async function runTungsten(cfg) {
  const { route, adapter, freshAdapter, reader, invoice, now, issuedAt = now, principal, recipient, maxNativeFeeAtto = "0",
    notAfter, quoteExpiresAt, nonce, executor, provider, outbox, privacy = [], vendorTerms = VENDOR_TERMS, runId } = cfg;
  const observations = [];
  const findings = [...(KNOWN[route] || [])];
  const ob = (check, ok, detail) => observations.push({ check, ok: !!ok, ...(detail !== undefined ? { detail } : {}) });
  const stop = (id, text, severity = "harness") => { findings.push({ id, severity, text }); throw Object.assign(new Error(text), { tungstenStop: true }); };
  const ownOracle = "independent:" + reader.hostIds.join("+");
  let capture = null, receipt = null, recon = null, intent = null;

  try {
    // ── controls, all before anything can move money ──
    // the reader that produces the evidence must be the one we control
    ob("control.reader-is-ours", adapter.reader === reader, adapter.reader === reader ? undefined : "the adapter reads through another reader");
    const cc = await reader.controlChain();
    ob("control.chain", cc.ok, { alive: cc.alive });
    ob("control.oracle-quorum", cc.alive.length >= 2, { alive: cc.alive.length });
    const descriptor = await adapter.network();
    const asset = Object.keys(descriptor.assets)[0];
    // the token, read by OUR reader, not through the adapter under test
    try { await reader.balanceOf(descriptor.assets[asset].ref, recipient); ob("control.token", true); }
    catch (e) { ob("control.token", false, String(e.message).slice(0, 120)); }
    if (route === "pay" && !cfg.payerAccount) stop("payer-account-missing", "the pay route needs the payer's account to read its owners before and after");
    if (observations.some((o) => o.check.startsWith("control.") && !o.ok)) stop("controls-failed", "a control failed: nothing was settled");

    // 1-3 QUOTE, PRICING COMMITMENT, INVOICE, AUTHORIZATION — bounded, single-use, never owner privilege
    const mHash = descriptorHash(descriptor);
    const owed = invoice.lines.filter((l) => l.asset === asset).reduce((s, l) => s + BigInt(l.amountAtto), 0n).toString();
    const { authority, authority_hash: signedAuthority } = buildAuthority({ principal, asset, max_asset_atto: owed, max_native_fee_atto: maxNativeFeeAtto, recipient, not_after: notAfter,
      nonce, invoice_digest: invoice.identity.contentDigest, adapter_manifest_hash: mHash });
    intent = buildIntent({ invoice, asset, descriptor, authority, quote: { commitment: invoice.commitment.digest, expires_at: quoteExpiresAt },
      privacy: { requirements: privacy }, proof: {}, refund: { policy: "refund-to-source" }, meter: { evidence_ref: null }, now });

    let ownerBefore = null, granted = null;
    if (route === "spend-permission") {
      try { granted = await adapter.grantPermission(intent, { provider, now }); ob("authority.grant-exact", true); }
      catch (e) {
        if (e.code === "GRANT_SUBSTITUTED" || e.code === "NO_GRANT") { ob("authority.grant-exact", false, e.code); ob("kill.2-cap-bounded", false, "the granted permission is not the requested bound"); throw Object.assign(e, { tungstenStop: true }); }
        stop("grant-not-completed", `the owner's grant did not complete: ${String(e.message).slice(0, 120)}`);
      }
      const own = await spenderIsOwner(reader, granted.permission.account, granted.permission.spender);
      if (!own.readable) stop("owner-unreadable", "the operators did not agree on whether the spender is an owner");
      if (!own.deployed) findings.push({ id: "account-counterfactual", severity: "harness", text: "the owner account is not deployed; whether the spender is an owner cannot be read" });
      else ob("kill.1-no-owner-authority", own.owner === false, { spender_is_owner: own.owner });
      if (own.owner) stop("agent-is-owner", "the agent owns the account: nothing settles under that authority", "blocker");
    } else {
      ownerBefore = await ownerIndex(reader, cfg.payerAccount);
    }

    // 4 EXECUTE — the kernel's run, the vendor only behind the adapter
    let run;
    try {
      run = await settle({ adapter, intent, invoice, signer: executor, outbox, now, issuedAt, vendorOracles: ["vendor:"], authorityHash: signedAuthority });
    } catch (e) {
      const code = e.code || "";
      // the vendor flow, the wallet or the adapter produced something outside
      // the authority: the route cannot settle without wider power
      if (code === "REFUSED_AUTHORITY" || code === "REFUSED_7702") ob("kill.1-no-owner-authority", false, code);
      else if (code === "SETTLE_FALSE_EVIDENCE") ob("kill.3-vendor-not-sole-proof", false, e.message.slice(0, 120));
      else if (/^REFUSED_/.test(code) || code === "SETTLE_OVER_AUTHORITY") ob("kill.2-cap-bounded", false, `${code}: ${String(e.message).slice(0, 120)}`);
      else throw e; // SETTLE_REFUSED / SETTLE_REPLAY are the caller's or the harness's, never a verdict on the vendor
      throw Object.assign(e, { tungstenStop: true });
    }
    receipt = run.receipt;

    // 5 CAPTURE
    const value = receipt.evidence.filter((r) => r.kind === "settlement");
    capture = {
      account: run.observation.payer, chain_id: intent.route.network, asset, requested_atto: intent.invoice.owed_atto,
      settled_atto: value.reduce((s, r) => s + BigInt(r.amount), 0n).toString(), tx: run.submitted.ref,
      payer_native_fee: run.observation.payer_native_fee, invoice_commitment: intent.invoice.commitment_digest,
      authorization_commitment: intent.authority_hash, intent_bound_on_chain: run.observation.intent_bound_on_chain,
    };
    if (run.observation.intent_bound_on_chain === false)
      findings.push({ id: "intent-not-bound-on-chain", severity: "limitation", text: "the executed calldata does not carry the intent binding; the receipt alone joins this transaction to the invoice" });
    if (run.observation.intent_bound_on_chain === null && value.length)
      findings.push({ id: "binding-unagreed", severity: "limitation", text: "the operators did not return identical calldata, so the on-chain binding is unread" });

    if (route === "pay") {
      if (capture.account && String(capture.account).toLowerCase() !== String(cfg.payerAccount).toLowerCase())
        findings.push({ id: "paid-from-another-account", severity: "blocker", text: "the chain shows the payment from an account other than the payer's" });
      const after = await ownerIndex(reader, cfg.payerAccount);
      // unreadable before or after is not a pass: a counterfactual account deployed by this very payment could carry any owner
      if (ownerBefore === null || after === null) findings.push({ id: "owner-index-unreadable", severity: "harness", text: "the payer account's owner index could not be read both before and after" });
      else ob("kill.1-no-owner-authority", ownerBefore === after, { owner_index_before: ownerBefore, owner_index_after: after });
      // the cap is the exact approved amount: the chain must show exactly it
      ob("kill.2-cap-bounded", capture.settled_atto === capture.requested_atto, { requested: capture.requested_atto, settled: capture.settled_atto });
    } else {
      // the cap is the CONTRACT's: after approval, an over-cap spend must revert with the cap error on every host
      // a permission that does not read as valid after settling means the probe
      // cannot reach the cap check: that touches kill.2 only, never the verdict on the rest
      const probe = await capProbe(reader, granted);
      if (!probe.permission_valid) findings.push({ id: "cap-probe-unreachable", severity: "harness", text: "the permission does not read as valid on every operator after settling, so the over-cap probe cannot reach the cap check" });
      else ob("kill.2-cap-bounded", probe.succeeded === 0 && probe.cap_reverts === probe.hosts && probe.other_reverts === 0, probe);
    }

    // 6 READ — value evidence from OUR reader, at quorum
    const top = value.every((r) => r.value_observed === "event-log+readback");
    // operators that answered but disagree (or only one found it) are a broken
    // probe, not a vendor verdict: the run says so and stops short of a kill
    if (run.observation.quorum < 2) findings.push({ id: "operators-disagree", severity: "harness", text: `only ${run.observation.quorum} operator(s) returned the same receipt` });
    else ob("kill.3-vendor-not-sole-proof", value.length > 0 && top && run.observation.quorum >= 2 && run.observation.oracle === ownOracle,
      { records: value.length, quorum: run.observation.quorum, oracle: run.observation.oracle, conclusion: receipt.reconciliation.conclusion });

    // fee within the authority; an unreadable run leaves it unknown, never 0
    if (run.observation.fee_incomplete) findings.push({ id: "fee-incomplete", severity: "harness", text: "a transaction of the run could not be read, so the native fee is unknown" });
    else {
      const fee = receipt.three_way.fee;
      ob("bound.native-fee", !!fee && fee.within_bound, fee ? { paid: fee.chain_observed, max: fee.committed_max, basis: fee.basis } : "no fee evidence");
    }

    // kill.4 — a fresh adapter and reader, given only the intent and the tx
    const fresh = freshAdapter ? await freshAdapter() : adapter;
    const again = await fresh.reconcile({ intent, ref: run.submitted.ref, related: run.status?.adapter_local?.txs });
    const a = digest("bnr/settle-evidence/v1", stripStamp(receipt.evidence)), b = digest("bnr/settle-evidence/v1", again.records);
    ob("kill.4-receipt-recreatable", a === b && again.records.length > 0, { first: a, rebuilt: b });

    // 7-8 RECEIPT + RECONCILIATION — against our oracle and the chain rebuild
    recon = reconcileReceipt(receipt, { invoice, intent, expectedOracle: ownOracle, rebuiltRecords: again.records });
    // not final yet is a timing fact, not a verdict on the vendor: run again later
    if (recon.conclusion === "FINALITY-PENDING")
      findings.push({ id: "finality-not-reached", severity: "harness", text: "the payment is observed but its block is not finalized on every agreeing operator yet; rerun reconcile after finality" });
    else ob("reconcile.receipt", recon.verdict === "reconciled" && recon.conclusion === "SATISFIED", { verdict: recon.verdict, conclusion: recon.conclusion, breaches: recon.breaches });
    ob("reconcile.three-way", receipt.three_way.agrees, receipt.three_way.rows.map((r) => ({ field: r.field, chain_matches_commitment: r.chain_matches_commitment, vendor_matches_chain: r.vendor_matches_chain })));
    if (receipt.three_way.rows.some((r) => r.vendor_matches_chain === false))
      findings.push({ id: "vendor-misreported", severity: "blocker", text: "the vendor's payment status disagrees with the chain" });

    // kill.5 — the kernel's objects carry no vendor identifier
    try { assertNeutral(intent, vendorTerms); assertNeutral(receipt, vendorTerms); ob("kill.5-no-vendor-leak", true); }
    catch (e) { ob("kill.5-no-vendor-leak", false, String(e.message).slice(0, 160)); }
  } catch (e) {
    if (!e.tungstenStop) findings.push({ id: "harness-error", severity: "harness", text: String(e.code ? `${e.code}: ${e.message}` : e.message).slice(0, 240) });
  }

  const { verdict, reasons } = computeVerdict(observations, findings);
  const body = {
    schema: TUNGSTEN_SCHEMA, run_id: runId || null, issued_at: issuedAt, route,
    lifecycle: { quote: "carried", pricing_commitment: "committed", invoice: "issued", authorization: intent ? "bounded" : "not-built", execution: receipt ? receipt.phase : "not-run",
      receipt: receipt ? "issued" : "absent", reconciliation: recon ? recon.verdict : "not-run" },
    intent_digest: intent?.intent_digest || null,
    receipt_digest: receipt?.receipt_digest || null,
    capture, observations, findings, verdict, verdict_reasons: reasons,
  };
  return { tungsten: { ...body, tungsten_digest: tungstenDigest(body) }, receipt, intent, reconciliation: recon };
}

export function verifyTungsten(t) {
  const { tungsten_digest, ...body } = t;
  const re = computeVerdict(t.observations, t.findings);
  return { digest_ok: tungsten_digest === tungstenDigest(body), verdict_ok: re.verdict === t.verdict, recomputed: re.verdict };
}

export { canonicalBytes };
