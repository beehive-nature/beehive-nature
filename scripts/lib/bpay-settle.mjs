// bpay-settle.mjs — the bPay SETTLE boundary: one chain-neutral settlement
// adapter contract, Mesh-shaped underneath, BNR-shaped above.
//
//   QUOTE → PRICING COMMITMENT → INVOICE (INVOICE-1) → AUTHORIZATION →
//   SETTLEMENT (this file) → RECEIPT → RECONCILIATION (RECON-1)
// (the ruled seven stages, docs/agents/BPAY-ECONOMIC-LIFECYCLE.md:13-28; the
// pricing commitment is INVOICE-1's carried quote-set digest)
//
// WHAT IS REUSED, NOT REBUILT
//   • canonical bytes: INVOICE-1's canonicaliser (bpay-invoice-generic.mjs),
//     the same one the doxx tungsten receipt uses. Digests are
//     sha256(domain ‖ 0x00 ‖ canonical JSON).
//   • the invoice: an INVOICE-1 document, validated here before anything
//     settles against it. Its per-asset ceilings bound the authority.
//   • the conclusion: RECON-1's reconcileObligation over VOCAB-1-classed
//     evidence records. This file never decides SATISFIED itself.
//   • the adapter seam: SPEC-ADAPTER-CONTRACT-1 (adapters build, a signer
//     signs, the shell persists and submits, `confirmed` only from a rail
//     read). The verbs below are that contract's settlement half, named
//     after Coinbase Mesh's Construction/Data APIs so a Mesh implementation
//     can sit under an adapter unchanged.
//   • the manifest binding: bpay-rail's LegBinding idea (the authority binds
//     the adapter's declared capabilities by content hash, so an adapter
//     upgraded mid-flight cannot settle under the old authority).
//
// THE VERBS (every adapter answers all eight; absent capability = refusal
// by name, never a missing function the kernel probes for):
//   network()                     → descriptor (rail, CAIP-2 id, assets,
//                                   submit model, finality, evidence ceiling)
//   balance({address, asset})     → {asset, atto}
//   prepare(intent)               → {intent_id, expires_at, rail}   (Mesh preprocess+metadata)
//   payloads(prepared)            → {mode, items[], spend}          (Mesh payloads)
//   combine(prepared, signatures) → {signed, predicted_ref}         (Mesh combine+hash)
//   submit(signedOrPayloads, ctx) → {ref, accepted_at}              (never terminal)
//   status(ref)                   → {phase, assertion}              (the rail's or vendor's own word)
//   reconcile({intent, ref})      → {records[], observation}        (an INDEPENDENT read)
//
// WHERE BNR GOES BEYOND MESH (carried in the intent, hash-committed):
//   invoice commitment, bounded authority (never an owner privilege),
//   quote + expiry, user-asset maximum, native-fee maximum, privacy
//   requirements, proof commitment, refund/credit policy, bMeter evidence,
//   receipt hash, reconciliation state.
//
// PURE: no clock (callers pass `now`), no network, no filesystem. Adapters
// do I/O; this file judges what they return.
import { createHash } from "node:crypto";
import { canonicalBytes, validateGenericInvoice } from "./bpay-invoice-generic.mjs";
import { reconcileObligation, EVIDENCE_CLASS_LADDER } from "./recon-reconcile.mjs";

export const CONTRACT = "bnr.settle-adapter/1";
export const INTENT_SCHEMA = "bnr.settle-intent/1";
export const RECEIPT_SCHEMA = "bnr.settle-receipt/1";
export const DESCRIPTOR_DOMAIN = "bnr/settle-descriptor/v1";
export const AUTHORITY_DOMAIN = "bnr/settle-authority/v1";
export const INTENT_DOMAIN = "bnr/settle-intent/v1";
export const RECEIPT_DOMAIN = "bnr/settle-receipt/v1";
export const VERBS = ["network", "balance", "prepare", "payloads", "combine", "submit", "status", "reconcile"];
// shell-submits: the shell holds signed bytes and submits them (Vaulta, Solana).
// wallet-submits: the signer is a wallet that signs AND submits (smart accounts,
// one-call pay). combine() is then a declared refusal, and the outbox holds
// the payloads instead of signed bytes.
export const SUBMIT_MODELS = ["shell-submits", "wallet-submits"];
export const REPLAY = ["single-use"];
export const REFUND_POLICIES = ["refund-to-source", "credit-to-payer", "none-declared"];
export const PHASES = ["prepared", "submitted", "observed", "failed", "unknown"];
// Closed list. An adapter declares which it satisfies; an intent that needs one
// the route cannot meet is refused at build time, before anything is signed.
//   no-sdk-telemetry   the client library reports nothing to its vendor
//   no-vendor-account  settling needs no account at a company
//   payer-unlinkable   the chain record does not link payer to recipient
export const PRIVACY_REQUIREMENTS = ["no-sdk-telemetry", "no-vendor-account", "payer-unlinkable"];
const ATTO = /^\d+$/;
const MIN_VALUE_RANK = EVIDENCE_CLASS_LADDER.indexOf("tx-hash");
// EVM addresses are case-insensitive hex; base58 and most others are not.
// Lowercasing a Solana address would make two different keys equal.
export function sameAddress(network, a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return /^eip155:/.test(network) ? String(a).toLowerCase() === String(b).toLowerCase() : String(a) === String(b);
}

export function digest(domain, value) {
  const h = createHash("sha256");
  h.update(domain, "utf8");
  h.update(Buffer.from([0]));
  h.update(canonicalBytes(value));
  return "sha256:" + h.digest("hex");
}

function need(cond, msg) {
  if (!cond) { const e = new Error(msg); e.code = "SETTLE_REFUSED"; throw e; }
}

// ── the adapter descriptor ──────────────────────────────────────────────────
// The descriptor is the adapter's whole declared surface. Its hash is what an
// authority binds; a changed descriptor is a different adapter.
export function validateDescriptor(d) {
  need(d && d.contract === CONTRACT, `descriptor.contract must be ${CONTRACT}`);
  need(typeof d.adapter_id === "string" && /^[a-z0-9][a-z0-9.-]{1,63}$/.test(d.adapter_id), "descriptor.adapter_id: lowercase id");
  need(typeof d.network === "string" && /^[a-z0-9-]+:[A-Za-z0-9._-]+$/.test(d.network), "descriptor.network: a CAIP-2 chain id");
  need(SUBMIT_MODELS.includes(d.submit_model), `descriptor.submit_model ∈ ${SUBMIT_MODELS.join("|")}`);
  need(d.assets && typeof d.assets === "object" && Object.keys(d.assets).length > 0, "descriptor.assets: at least one asset");
  for (const [sym, a] of Object.entries(d.assets)) {
    need(Number.isInteger(a.decimals) && a.decimals >= 0 && a.decimals <= 36, `asset ${sym}: integer decimals`);
    need(typeof a.ref === "string" && a.ref.length > 0, `asset ${sym}: ref (contract address or "native")`);
  }
  need(EVIDENCE_CLASS_LADDER.includes(d.evidence_ceiling), "descriptor.evidence_ceiling: a VOCAB-1 class");
  need(EVIDENCE_CLASS_LADDER.indexOf(d.evidence_ceiling) >= MIN_VALUE_RANK,
    "descriptor.evidence_ceiling below tx-hash: this adapter can never evidence value, so it cannot settle");
  need(Array.isArray(d.authority_models) && d.authority_models.length > 0, "descriptor.authority_models required");
  need(!d.authority_models.includes("owner"),
    "descriptor offers owner authority: an adapter that needs wallet-owner privilege to settle fails the bounded-authority law");
  need(Array.isArray(d.verbs) && VERBS.every((v) => d.verbs.includes(v)), `descriptor.verbs must list all of ${VERBS.join(",")}`);
  need(Array.isArray(d.privacy_satisfies) && d.privacy_satisfies.every((p) => PRIVACY_REQUIREMENTS.includes(p)),
    `descriptor.privacy_satisfies ⊆ ${PRIVACY_REQUIREMENTS.join("|")} (an empty list is honest)`);
  return true;
}

export function descriptorHash(d) {
  validateDescriptor(d);
  return digest(DESCRIPTOR_DOMAIN, d);
}

export function assertAdapter(adapter) {
  need(adapter && typeof adapter === "object", "adapter object required");
  for (const v of VERBS) need(typeof adapter[v] === "function", `adapter missing verb ${v}()`);
  return true;
}

// ── bounded authority ───────────────────────────────────────────────────────
// What a settling agent may do, and nothing more. It is never "owns the
// wallet": owner_privilege is false by construction and the kernel refuses
// any authority that says otherwise.
//   { principal, action:"settlement.execute", asset, max_asset_atto,
//     max_native_fee_atto, recipient, not_after, replay:"single-use", nonce,
//     invoice_digest, adapter_manifest_hash }
export function buildAuthority(input) {
  const a = {
    schema: "bnr.settle-authority/1",
    principal: input.principal,
    action: "settlement.execute",
    asset: input.asset,
    max_asset_atto: String(input.max_asset_atto),
    max_native_fee_atto: String(input.max_native_fee_atto),
    recipient: input.recipient,
    not_after: input.not_after,
    replay: "single-use",
    nonce: input.nonce,
    invoice_digest: input.invoice_digest,
    adapter_manifest_hash: input.adapter_manifest_hash,
    owner_privilege: false,
  };
  validateAuthority(a);
  return { authority: a, authority_hash: digest(AUTHORITY_DOMAIN, a) };
}

export function validateAuthority(a) {
  need(a && a.schema === "bnr.settle-authority/1", "authority schema");
  need(typeof a.principal === "string" && a.principal.length > 0, "authority.principal");
  need(a.action === "settlement.execute", "authority.action is settlement.execute, nothing wider");
  need(a.owner_privilege === false, "authority carries owner privilege: refused (an agent never owns the wallet it pays from)");
  need(ATTO.test(a.max_asset_atto) && BigInt(a.max_asset_atto) > 0n, "authority.max_asset_atto: positive integer string");
  need(ATTO.test(a.max_native_fee_atto), "authority.max_native_fee_atto: integer string (0 = the payer pays no native fee)");
  need(typeof a.recipient === "string" && a.recipient.length > 0, "authority.recipient is fixed");
  need(Number.isFinite(Date.parse(a.not_after)), "authority.not_after: RFC3339");
  need(REPLAY.includes(a.replay), "authority.replay must be single-use");
  need(typeof a.nonce === "string" && a.nonce.length >= 8, "authority.nonce: at least 8 chars");
  need(/^sha256:[0-9a-f]{64}$/.test(a.invoice_digest), "authority.invoice_digest");
  need(/^sha256:[0-9a-f]{64}$/.test(a.adapter_manifest_hash), "authority.adapter_manifest_hash");
  return true;
}

// ── the settlement intent ───────────────────────────────────────────────────
// Everything a settlement must honour, hash-committed. Built from a VALID
// INVOICE-1 document; the owed figure re-derives from its carried quotes.
export function buildIntent({ invoice, asset, descriptor, authority, quote, privacy, proof, refund, meter, now }) {
  validateGenericInvoice(invoice);
  need(invoice.state === "issued", `only an issued invoice settles (was ${invoice.state})`);
  const lines = invoice.lines.filter((l) => l.asset === asset);
  need(lines.length > 0, `invoice has no ${asset} line`);
  const owed = lines.reduce((s, l) => s + BigInt(l.amountAtto), 0n);
  const mHash = descriptorHash(descriptor);
  need(descriptor.assets[asset], `adapter ${descriptor.adapter_id} does not carry ${asset}`);
  validateAuthority(authority);
  need(authority.asset === asset, "authority names another asset");
  need(authority.invoice_digest === invoice.identity.contentDigest, "authority is for another invoice");
  need(authority.adapter_manifest_hash === mHash, "authority bound another adapter manifest (adapter changed since authorization)");
  need(owed <= BigInt(authority.max_asset_atto), `owed ${owed} exceeds the authority maximum ${authority.max_asset_atto}`);
  const ceiling = invoice.authorization?.ceilings?.[asset];
  need(ceiling !== undefined && BigInt(authority.max_asset_atto) <= BigInt(ceiling),
    "authority maximum exceeds the invoice's own ceiling");
  need(quote && /^sha256:/.test(quote.commitment) && Number.isFinite(Date.parse(quote.expires_at)), "quote {commitment, expires_at}");
  need(quote.commitment === invoice.commitment.digest, "quote commitment is not the invoice's carried quote set");
  const t = Date.parse(now);
  need(Number.isFinite(t), "now: RFC3339 (the kernel has no clock)");
  need(t < Date.parse(quote.expires_at), "quote expired");
  need(t < Date.parse(authority.not_after), "authority expired");
  need(Date.parse(authority.not_after) <= Date.parse(quote.expires_at), "authority outlives its quote");
  need(REFUND_POLICIES.includes(refund?.policy), `refund.policy ∈ ${REFUND_POLICIES.join("|")}`);
  for (const p of privacy?.requirements || []) {
    need(PRIVACY_REQUIREMENTS.includes(p), `unknown privacy requirement ${p}`);
    need(descriptor.privacy_satisfies.includes(p), `this route cannot meet the privacy requirement ${p}: choose another adapter`);
  }
  const body = {
    schema: INTENT_SCHEMA,
    invoice: {
      content_digest: invoice.identity.contentDigest,
      commitment_digest: invoice.commitment.digest,
      job_id: invoice.identity.jobId,
      asset,
      owed_atto: owed.toString(),
    },
    quote: { commitment: quote.commitment, expires_at: quote.expires_at },
    authority,
    authority_hash: digest(AUTHORITY_DOMAIN, authority),
    route: { network: descriptor.network, asset_ref: descriptor.assets[asset].ref, decimals: descriptor.assets[asset].decimals, adapter_manifest_hash: mHash },
    privacy: { requirements: [...(privacy?.requirements || [])].sort() },
    proof: { commitment: proof?.commitment || null },
    refund: { policy: refund.policy },
    meter: { evidence_ref: meter?.evidence_ref || null },
    created_at: now,
  };
  return { ...body, intent_digest: digest(INTENT_DOMAIN, body) };
}

export function validateIntent(intent) {
  need(intent && intent.schema === INTENT_SCHEMA, "intent schema");
  const { intent_digest, ...body } = intent;
  need(intent_digest === digest(INTENT_DOMAIN, body), "intent digest does not recompute: the intent changed after it was built");
  need(intent.authority_hash === digest(AUTHORITY_DOMAIN, intent.authority), "authority hash does not recompute");
  validateAuthority(intent.authority);
  return true;
}

// ── evidence ────────────────────────────────────────────────────────────────
// An adapter's reconcile() returns VOCAB-1 records. The kernel stamps the
// invoice digest itself (an adapter does not choose which invoice money was
// for) and refuses any value-class record whose oracle is the vendor.
function checkRecords(records, descriptor, observation) {
  need(Array.isArray(records), "reconcile must return records[]");
  need(observation && typeof observation.oracle === "string", "reconcile must name the oracle it read");
  const vendorOracles = descriptor.vendor_oracles || [];
  for (const r of records) {
    const rank = EVIDENCE_CLASS_LADDER.indexOf(r.value_observed);
    need(rank >= 0, `record class ${r.value_observed} is not on the VOCAB-1 ladder`);
    need(rank <= EVIDENCE_CLASS_LADDER.indexOf(descriptor.evidence_ceiling),
      `record claims ${r.value_observed}, above what this adapter declared it can observe`);
    if (rank >= MIN_VALUE_RANK)
      need(!vendorOracles.includes(observation.oracle), "value evidence read from the vendor's own endpoint: a page is never its own witness");
  }
}

// ── the receipt ─────────────────────────────────────────────────────────────
// Three accounts of one payment must agree: what the vendor (or rail) said,
// what the chain shows to an independent reader, and what the intent
// committed. RECON-1 decides the obligation from the chain account alone.
export function threeWay(intent, assertion, records, observation) {
  const value = records.filter((r) => EVIDENCE_CLASS_LADDER.indexOf(r.value_observed) >= MIN_VALUE_RANK && r.kind !== "attempt");
  const chainAtto = value.reduce((s, r) => s + BigInt(r.amount), 0n).toString();
  const chainTo = [...new Set(value.map((r) => r.to).filter(Boolean))];
  const rows = [
    { field: "amount_atto", committed: intent.invoice.owed_atto, vendor_reported: assertion?.amount_atto ?? null, chain_observed: chainAtto },
    { field: "recipient", committed: intent.authority.recipient, vendor_reported: assertion?.recipient ?? null, chain_observed: chainTo.length === 1 ? chainTo[0] : chainTo.length ? chainTo.join(",") : null },
  ];
  for (const row of rows) {
    const eq = row.field === "recipient" ? (a, b) => sameAddress(intent.route.network, a, b) : (a, b) => a !== null && b !== null && String(a) === String(b);
    row.chain_matches_commitment = eq(row.committed, row.chain_observed);
    row.vendor_matches_chain = row.vendor_reported === null ? null : eq(row.vendor_reported, row.chain_observed);
  }
  const fee = observation?.payer_native_fee;
  const feeRow = fee && ATTO.test(String(fee.atto))
    ? { field: "payer_native_fee_atto", committed_max: intent.authority.max_native_fee_atto, chain_observed: String(fee.atto), basis: fee.basis,
        within_bound: BigInt(fee.atto) <= BigInt(intent.authority.max_native_fee_atto) }
    : null;
  return { agrees: rows.every((r) => r.chain_matches_commitment && r.vendor_matches_chain !== false) && (!feeRow || feeRow.within_bound), rows, fee: feeRow };
}

export function buildReceipt({ intent, invoice, descriptor, ref, assertion, records, observation, phase, issuedAt, adapterLocal }) {
  validateIntent(intent);
  checkRecords(records, descriptor, observation);
  need(PHASES.includes(phase), `phase ∈ ${PHASES.join("|")}`);
  const stamped = records.map((r) => ({ ...r, invoiceContentDigest: intent.invoice.content_digest }));
  const recon = reconcileObligation(invoice, stamped);
  const body = {
    schema: RECEIPT_SCHEMA,
    issued_at: issuedAt,
    intent_digest: intent.intent_digest,
    invoice_digest: intent.invoice.content_digest,
    authority_hash: intent.authority_hash,
    adapter_manifest_hash: intent.route.adapter_manifest_hash,
    network: intent.route.network,
    ref,
    phase,
    lifecycle: {
      quote: { state: "carried", expires_at: intent.quote.expires_at },
      pricing_commitment: { state: "committed", digest: intent.quote.commitment },
      invoice: { state: "issued", digest: intent.invoice.content_digest },
      authorization: { state: "bounded", authority_hash: intent.authority_hash },
      settlement: { state: phase, ref },
      receipt: { state: "issued" },
      reconciliation: { state: recon.conclusion, by: "RECON-1" },
    },
    vendor_assertion: assertion ? { class: "self-reported", digest: digest("bnr/settle-assertion/v1", assertion) } : null,
    observation,
    evidence: stamped,
    three_way: threeWay(intent, assertion, records, observation),
    reconciliation: recon,
    meter: intent.meter,
    adapter_local: adapterLocal || null,
  };
  return { ...body, receipt_digest: digest(RECEIPT_DOMAIN, body) };
}

// Recompute everything a receipt asserts from what it carries plus the
// invoice and intent it names. A receipt that only re-states a vendor's word
// does not reconcile.
export function reconcileReceipt(receipt, { invoice, intent }) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, ...(detail ? { detail } : {}) });
  const { receipt_digest, ...body } = receipt;
  add("receipt-digest", receipt_digest === digest(RECEIPT_DOMAIN, body));
  let intentOk = true;
  try { validateIntent(intent); } catch { intentOk = false; }
  add("intent-recomputes", intentOk);
  add("intent-named", receipt.intent_digest === intent.intent_digest);
  add("invoice-named", receipt.invoice_digest === invoice.identity.contentDigest);
  const re = reconcileObligation(invoice, receipt.evidence);
  add("recon-recomputes", re.conclusion === receipt.reconciliation.conclusion, re.conclusion);
  const tw = threeWay(intent, null, receipt.evidence, receipt.observation);
  add("chain-matches-commitment", tw.rows.every((r) => r.chain_matches_commitment) || re.conclusion !== "SATISFIED");
  add("native-fee-within-authority", !tw.fee || tw.fee.within_bound, tw.fee ? tw.fee.chain_observed : undefined);
  add("value-from-independent-oracle", receipt.evidence.every((r) => EVIDENCE_CLASS_LADDER.indexOf(r.value_observed) < MIN_VALUE_RANK) || !!receipt.observation?.oracle);
  const breaches = checks.filter((c) => !c.ok).map((c) => c.name);
  return { schema: "bnr.settle-reconciliation/1", verdict: breaches.length ? "breach" : "reconciled", conclusion: re.conclusion, breaches, checks };
}

// ── the run ─────────────────────────────────────────────────────────────────
// build → (sign) → PERSIST → submit → status → independent reconcile → receipt.
// `signer` is the vault (shell-submits: sign(items) → signatures) or the wallet
// executor (wallet-submits: handed to adapter.submit, which knows its API).
// `outbox.persist(intent_digest, entry)` must resolve before submit is called;
// on resubmission the identical stored entry is replayed, never rebuilt.
export async function settle({ adapter, intent, invoice, signer, outbox, now, issuedAt }) {
  assertAdapter(adapter);
  validateIntent(intent);
  const descriptor = await adapter.network();
  need(descriptorHash(descriptor) === intent.route.adapter_manifest_hash,
    "the adapter's live descriptor differs from the one the authority bound — refuse, never settle under a changed adapter");
  const prepared = await adapter.prepare(intent, { now });
  need(prepared && prepared.intent_id === intent.intent_digest, "prepare must key on the intent digest (idempotency key)");
  const pl = await adapter.payloads(prepared);
  need(pl && Array.isArray(pl.items) && pl.items.length > 0, "payloads.items required");
  need(pl.mode === descriptor.submit_model, "payload mode differs from the declared submit model");
  need(pl.spend && ATTO.test(pl.spend.asset_atto), "payloads.spend.asset_atto: what the payloads move, as the adapter decoded it");
  need(BigInt(pl.spend.asset_atto) === BigInt(intent.invoice.owed_atto), "payloads move a different amount than the invoice owes");
  need(BigInt(pl.spend.asset_atto) <= BigInt(intent.authority.max_asset_atto), "payloads exceed the authority maximum");
  need(sameAddress(intent.route.network, pl.spend.recipient, intent.authority.recipient), "payloads pay someone the authority does not name");
  need(ATTO.test(pl.spend.max_native_fee_atto) && BigInt(pl.spend.max_native_fee_atto) <= BigInt(intent.authority.max_native_fee_atto),
    "payloads' native-fee bound exceeds the authority");

  let submitted;
  if (descriptor.submit_model === "shell-submits") {
    const sigs = await signer.sign(pl.items);
    const combined = await adapter.combine(prepared, sigs);
    await outbox.persist(intent.intent_digest, { kind: "signed", signed: combined.signed });
    submitted = await adapter.submit(combined.signed, { prepared });
  } else {
    await outbox.persist(intent.intent_digest, { kind: "payloads", payloads: pl.items });
    submitted = await adapter.submit(pl, { prepared, executor: signer });
  }
  need(submitted && typeof submitted.ref === "string" && submitted.ref.length > 0, "submit must return a ref");
  const st = await adapter.status(submitted.ref);
  const { records, observation } = await adapter.reconcile({ intent, ref: submitted.ref });
  const phase = records.some((r) => EVIDENCE_CLASS_LADDER.indexOf(r.value_observed) >= MIN_VALUE_RANK && r.kind !== "attempt") ? "observed"
    : st?.phase === "failed" ? "failed" : "submitted";
  const receipt = buildReceipt({ intent, invoice, descriptor, ref: submitted.ref, assertion: st?.assertion || null, records, observation, phase, issuedAt: issuedAt || now, adapterLocal: st?.adapter_local || null });
  return { descriptor, prepared, payloads: pl, submitted, status: st, records, observation, receipt };
}

// Kill condition 5 made mechanical: no vendor identifier in the kernel's
// objects. `terms` come from the CALLER (the tungsten harness), never from the
// adapter under test. adapter_local is the adapter's own room and is skipped.
export function assertNeutral(value, terms, path = "$") {
  if (typeof value === "string") {
    for (const t of terms) if (value.toLowerCase().includes(t.toLowerCase())) throw Object.assign(new Error(`vendor identifier "${t}" at ${path}`), { code: "SETTLE_LEAK" });
    return true;
  }
  if (Array.isArray(value)) { value.forEach((v, i) => assertNeutral(v, terms, `${path}[${i}]`)); return true; }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "adapter_local") continue;
      for (const t of terms) if (k.toLowerCase().includes(t.toLowerCase())) throw Object.assign(new Error(`vendor identifier "${t}" as key ${path}.${k}`), { code: "SETTLE_LEAK" });
      assertNeutral(v, terms, `${path}.${k}`);
    }
  }
  return true;
}

// exact decimal ↔ base units (no float): "0.01" USDC → "10000" at 6 decimals
export function toAtto(decimal, decimals) {
  need(/^\d+(\.\d+)?$/.test(String(decimal)), `not a decimal amount: ${decimal}`);
  const [w, f = ""] = String(decimal).split(".");
  need(f.length <= decimals, `${decimal} has more than ${decimals} decimals`);
  return (BigInt(w) * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals) || "0")).toString();
}
export function fromAtto(atto, decimals) {
  const s = BigInt(atto).toString().padStart(decimals + 1, "0");
  const w = s.slice(0, s.length - decimals), f = s.slice(s.length - decimals).replace(/0+$/, "");
  return f ? `${w}.${f}` : w;
}
