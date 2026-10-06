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

export const TUNGSTEN_SCHEMA = "bnr.settle-tungsten/1";
export const VERDICTS = ["PASS", "PASS_WITH_LIMITATIONS", "FAIL", "INCONCLUSIVE"];
export const KILLS = ["kill.1-no-owner-authority", "kill.2-cap-bounded", "kill.3-vendor-not-sole-proof", "kill.4-receipt-recreatable", "kill.5-no-vendor-leak"];
export const REQUIRED = [...KILLS, "bound.native-fee", "reconcile.three-way", "reconcile.receipt"];
const CONTROLS = ["control.chain", "control.oracle-quorum", "control.token"];
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
  for (const c of CONTROLS) { if (!by.has(c)) ctl.push(`control missing: ${c}`); else if (failed(c)) ctl.push(`control failed: ${c}`); }
  // a dead probe proves nothing either way
  if (ctl.length) return { verdict: "INCONCLUSIVE", reasons: ctl };
  const blockers = (findings || []).filter((f) => f.severity === "blocker");
  const fails = REQUIRED.filter(failed);
  if (fails.length || blockers.length) return { verdict: "FAIL", reasons: [...fails.map((c) => `check failed: ${c}`), ...blockers.map((f) => `blocker: ${f.id}`)] };
  if (stopped.length) return { verdict: "INCONCLUSIVE", reasons: stopped.map((f) => `${f.severity}: ${f.id}`) };
  const missing = REQUIRED.filter((c) => !by.has(c));
  if (missing.length) return { verdict: "INCONCLUSIVE", reasons: missing.map((c) => `check not run: ${c}`) };
  const info = [...by.keys()].filter((c) => !REQUIRED.includes(c) && !CONTROLS.includes(c) && failed(c));
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
  let capture = null, receipt = null, recon = null, intent = null;

  try {
    // controls first: the chain, the operators, the token
    const cc = await reader.controlChain();
    ob("control.chain", cc.ok, { alive: cc.alive });
    ob("control.oracle-quorum", cc.alive.length >= 2, { alive: cc.alive.length });
    const descriptor = await adapter.network();
    const asset = Object.keys(descriptor.assets)[0];
    try { await adapter.balance({ address: recipient, asset }); ob("control.token", true); }
    catch (e) { ob("control.token", false, String(e.message).slice(0, 120)); }

    // 1-2 QUOTE + INVOICE: the commitment is the invoice's carried quote set
    const mHash = descriptorHash(descriptor);
    // 3 AUTHORIZATION — bounded, single-use, never owner privilege
    const owed = invoice.lines.filter((l) => l.asset === asset).reduce((s, l) => s + BigInt(l.amountAtto), 0n).toString();
    const { authority } = buildAuthority({ principal, asset, max_asset_atto: owed, max_native_fee_atto: maxNativeFeeAtto, recipient, not_after: notAfter,
      nonce, invoice_digest: invoice.identity.contentDigest, adapter_manifest_hash: mHash });
    intent = buildIntent({ invoice, asset, descriptor, authority, quote: { commitment: invoice.commitment.digest, expires_at: quoteExpiresAt },
      privacy: { requirements: privacy }, proof: {}, refund: { policy: "refund-to-source" }, meter: { evidence_ref: null }, now });

    let ownerBefore = null;
    if (route === "spend-permission") {
      try { await adapter.grantPermission(intent, { provider, now }); ob("authority.grant-exact", true); }
      catch (e) { ob("authority.grant-exact", false, e.code || String(e.message).slice(0, 120)); ob("kill.2-cap-bounded", false, "the granted permission is not the requested bound"); throw Object.assign(e, { tungstenStop: true }); }
      const own = await adapter.spenderIsOwner();
      if (!own.deployed) findings.push({ id: "account-counterfactual", severity: "limitation", text: "the owner account is not deployed yet; the spender-is-not-owner check reads it after the first settlement" });
      else ob("kill.1-no-owner-authority", own.owner === false, { spender_is_owner: own.owner });
      const probe = await adapter.capProbe();
      ob("kill.2-cap-bounded", probe.answered > 0 && probe.succeeded === 0 && probe.reverted > 0, { over_cap_simulation: { reverted: probe.reverted, succeeded: probe.succeeded } });
    }

    // 4 EXECUTE — the kernel's run, the vendor only behind the adapter
    let run;
    try {
      if (route === "pay") ownerBefore = cfg.payerAccount ? await adapter.ownerIndex(cfg.payerAccount) : null;
      run = await settle({ adapter, intent, invoice, signer: executor, outbox, now, issuedAt });
    } catch (e) {
      if (/^REFUSED_/.test(e.code || "")) {
        // the vendor flow asked for a call outside the authority: the route
        // cannot settle without wider power than BNR grants
        ob(e.code === "REFUSED_AUTHORITY" || e.code === "REFUSED_7702" ? "kill.1-no-owner-authority" : "kill.2-cap-bounded", false, e.code);
        throw Object.assign(e, { tungstenStop: true });
      }
      throw e;
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

    if (route === "pay") {
      const after = capture.account ? await adapter.ownerIndex(capture.account) : null;
      if (ownerBefore === null && after === null) findings.push({ id: "owner-check-unread", severity: "limitation", text: "the payer account's owner index could not be read before and after" });
      else ob("kill.1-no-owner-authority", ownerBefore === null ? true : ownerBefore === after, { owner_index_before: ownerBefore, owner_index_after: after });
      // the cap is the exact approved amount: the chain must show exactly it
      ob("kill.2-cap-bounded", capture.settled_atto === capture.requested_atto, { requested: capture.requested_atto, settled: capture.settled_atto });
    }

    // 6 READ — value evidence from the independent oracle, at quorum
    const top = value.every((r) => r.value_observed === "event-log+readback");
    ob("kill.3-vendor-not-sole-proof", value.length > 0 && top && run.observation.quorum >= 2 && !descriptor.vendor_oracles.includes(run.observation.oracle),
      { records: value.length, quorum: run.observation.quorum, oracle: run.observation.oracle, conclusion: receipt.reconciliation.conclusion });

    // fee within the authority
    const fee = receipt.three_way.fee;
    ob("bound.native-fee", !!fee && fee.within_bound, fee ? { paid: fee.chain_observed, max: fee.committed_max, basis: fee.basis } : "no fee evidence");

    // 7-8 RECEIPT + RECONCILE
    recon = reconcileReceipt(receipt, { invoice, intent });
    // not final yet is a timing fact, not a verdict on the vendor: run again later
    if (recon.conclusion === "FINALITY-PENDING")
      findings.push({ id: "finality-not-reached", severity: "harness", text: "the payment is observed but its block is not finalized on both operators yet; rerun reconcile after finality" });
    else ob("reconcile.receipt", recon.verdict === "reconciled" && recon.conclusion === "SATISFIED", { verdict: recon.verdict, conclusion: recon.conclusion, breaches: recon.breaches });
    ob("reconcile.three-way", receipt.three_way.agrees, receipt.three_way.rows.map((r) => ({ field: r.field, chain_matches_commitment: r.chain_matches_commitment, vendor_matches_chain: r.vendor_matches_chain })));
    if (receipt.three_way.rows.some((r) => r.vendor_matches_chain === false))
      findings.push({ id: "vendor-misreported", severity: "blocker", text: "the vendor's payment status disagrees with the chain" });

    // kill.4 — a fresh adapter and reader, given only the intent and the tx
    const fresh = freshAdapter ? await freshAdapter() : adapter;
    const again = await fresh.reconcile({ intent, ref: run.submitted.ref, related: run.status?.adapter_local?.txs });
    const a = digest("bnr/settle-evidence/v1", stripStamp(receipt.evidence)), b = digest("bnr/settle-evidence/v1", again.records);
    ob("kill.4-receipt-recreatable", a === b && again.records.length > 0, { first: a, rebuilt: b });

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
