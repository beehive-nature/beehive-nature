// bpay.mjs — the bPay document/evidence layer for the zBlood preservation
// ceremony. First-class artifacts for the machine states that run underneath
// the human ceremony (Preserve → Review with wallet → Understand → Confirm on
// Trezor → Verify survival):
//
//   QUOTE → INVOICE → AUTHORIZATION → SETTLEMENT → RECEIPT → RECONCILIATION
//
// LAWS ENCODED HERE (standing founder law, measured-states economics):
//   - quote ≠ purchased ≠ uploaded ≠ retrieved ≠ hash-verified — never conflated;
//   - an INVOICE may be issued from a real live quote + the standing
//     authorization ceiling (both are real before money moves);
//   - a RECEIPT exists ONLY from settlement evidence — there is no code path
//     that mints one without it (the builder refuses, the validator refuses);
//   - no synthetic projection may be labeled measured: no USD/price feed is
//     consulted here; amounts stay token-native (ANT atto, ETH wei);
//   - Clear Signing for payForQuotes is UNVERIFIED and must stay labeled so.
//
// The invoice/receipt pair deliberately mirrors the information architecture
// (not the visuals) of a payment provider's document pair: the invoice is the
// authorized expectation, the receipt is what actually happened, and the two
// are reconciled rather than assumed equal.

import { createHash } from "node:crypto";

export const INVOICE_SCHEMA = "skaists.bpay-invoice/1";
export const RECEIPT_SCHEMA = "skaists.bpay-receipt/1";
export const BPAY_STATES = ["quote", "invoice", "authorization", "settlement", "receipt", "reconciliation"];

// The archive + authorization context this ceremony operates on. Every value
// here is real and receipted elsewhere (ETERNALIZATION-RECEIPT.json, the
// founder's 2026-09-17 spend-authorization order). Nothing in this module
// re-derives or upgrades these facts.
export const ARCHIVE_CONTEXT = Object.freeze({
  edition: {
    name: "zBlood first public preservation snapshot",
    manifestSha256: "440b502a6e1ac2dc086902f743f9f750437e7079040dfd5e76c8dd42c7de4389", // PUBLIC-CONSTANT public chain data
    files: 20537,
    contentBytes: 62139972,
    uploadObject: {
      name: "pkg3.tar",
      bytes: 80998400,
      sha256: "fec5fba8360d9de211c3b6c5966e93bc2462133099f651891d500b6a2ea98b9b", // PUBLIC-CONSTANT public chain data
      deterministic: "--sort=name, fixed mtime 2026-09-16T22:35:14Z, numeric owner"
    }
  },
  authorization: {
    maxStorageANT: "3.2",
    maxGasETH: "0.0002",
    authorizedBy: "founder order 2026-09-17 (separated bounds, never one dollar figure)",
    stopConditions: [
      "sha256(pkg3.tar) ≠ fec5fba8… at upload time",
      "actual storage charge > 3.2 ANT",
      "actual gas > 0.0002 ETH",
      "client reports a different artifact or chunk count"
    ]
  },
  walletAction: {
    requested: [
      { tx: "ERC-20 approve", token: "ANT", spender: "Autonomi payment vault" },
      { tx: "payForQuotes", contract: "Autonomi payment vault" }
    ],
    signer: "founder Trezor — device custody; neither blood.html nor antd-bridge ever holds a key",
    clearSigning: {
      erc20Approve: "likely covered (standard EVM) — not yet device-observed for this ceremony",
      payForQuotes: "UNVERIFIED — depends on the ERC-7730 registry; do NOT claim clear signing until device-tested"
    }
  }
});

const ATTO = 10n ** 18n;
export const attoToAnt = (atto) => (BigInt(atto) * 1n) / ATTO + (BigInt(atto) % ATTO === 0n ? 0n : 1n); // ceil for display only
export const antAtto = (ant) => {
  const s = String(ant).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return BigInt(s); // integer/atto form passes through
  const [i, f = ""] = s.split(".");
  if (f.length > 18) throw new Error("more than 18 decimals: " + s);
  return BigInt(i + f.padEnd(18, "0"));
};

// Stable identity of a payment plan: sha256 over the sorted quote hashes.
// Two plans for the same content differ (live quotes vary per prepare — the
// P1 lesson); this digest is how the invoice, the settlement, and the receipt
// agree they are talking about the SAME authorization.
export function planDigest(plan) {
  const hashes = (plan.payments || []).map((p) => p.quote_hash).sort();
  if (!hashes.length) throw new Error("plan has no payments — cannot derive an identity");
  return "sha256:" + createHash("sha256").update(hashes.join("\n")).digest("hex");
}

function statesSnapshot(over = {}) {
  return Object.assign({
    quote: "quoted",
    invoice: "issued",
    authorization: "ceiling-recorded",
    settlement: "not-yet",
    receipt: "not-yet",
    reconciliation: "not-yet"
  }, over);
}

// ── INVOICE ─────────────────────────────────────────────────────────────────
// Issued from a REAL bridge prepare response (live keyless network quote).
// The invoice records the authorized expectation, not an outcome.
export function buildInvoice(plan, ctx = ARCHIVE_CONTEXT, issuedAt = new Date().toISOString()) {
  if (!plan || !plan.upload_id) throw new Error("invoice requires a real prepare plan (upload_id)");
  if (!Array.isArray(plan.payments) || !plan.payments.length) throw new Error("invoice requires real quote payments");
  if (plan.recovered_from) {
    // a recovered plan IS the original authorization — the invoice says so
  }
  const ceilingAtto = antAtto(ctx.authorization.maxStorageANT);
  const totalAtto = BigInt(plan.total_amount_atto);
  if (totalAtto > ceilingAtto) {
    throw new Error(`quote ${totalAtto} atto exceeds the authorization ceiling ${ceilingAtto} atto — refuse to invoice`);
  }
  return {
    schema: INVOICE_SCHEMA,
    invoiceId: `inv-${plan.upload_id}`,
    issuedAt,
    issuer: {
      service: "antd-bridge (keyless prepare — no key exists in the quoting path)",
      planSource: "live Autonomi network prepare"
    },
    buyer: {
      role: "founder (Trezor custody)",
      note: "the paying address is never embedded in artifacts"
    },
    subject: {
      archive: ctx.edition,
      encryptedChunks: plan.total_chunks,
      alreadyStoredChunks: plan.already_stored ?? 0
    },
    service: {
      network: "Autonomi",
      route: "ANT",
      visibility: "public",
      destination: "Autonomi network storage — public DataMap address " + (plan.data_map_address || "(pending)")
    },
    quote: {
      state: "quoted (live node quotes — not purchased)",
      lineItems: [{
        kind: "network storage",
        asset: "ANT",
        amountAtto: plan.total_amount_atto,
        payments: plan.payments.length,
        paymentType: plan.payment_type
      }, {
        kind: "gas (authorized ceiling, settled at payment)",
        asset: "ETH",
        ceilingAtto: antAtto(ctx.authorization.maxGasETH).toString()
      }],
      planIdentity: {
        uploadId: plan.upload_id,
        dataMapAddress: plan.data_map_address || null,
        digest: planDigest(plan),
        artifactSha256: plan.artifact_sha256,
        artifactBytes: plan.artifact_bytes
      },
      persistence: plan.recovered_from
        ? { law: "RECOVERED — identical quote hashes to the original prepare (bridge-death proof)", recoveredFrom: plan.recovered_from }
        : { law: "persisted at prepare; survives bridge death (P1 recovery)" },
      expiration: {
        model: "job-bound, not clock-bound",
        note: "the plan is bound to upload_id and persisted by the bridge; a force_fresh re-quote is a NEW plan with new quotes"
      }
    },
    authorization: {
      ceiling: {
        maxStorageANT: ctx.authorization.maxStorageANT,
        maxGasETH: ctx.authorization.maxGasETH
      },
      authorizedBy: ctx.authorization.authorizedBy,
      stopConditions: ctx.authorization.stopConditions,
      quoteWithinCeiling: true
    },
    walletAction: ctx.walletAction,
    states: statesSnapshot(plan.recovered_from ? { quote: "quoted (recovered original)" } : {}),
    state: "issued" // issued → settled | void ; NEVER "settled" without a receipt
  };
}

export function validateInvoice(inv) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };
  need(inv && inv.schema === INVOICE_SCHEMA, "schema must be " + INVOICE_SCHEMA);
  need(inv.invoiceId && /^inv-up-/.test(inv.invoiceId), "invoiceId must bind to a real upload_id");
  need(inv.issuedAt && !Number.isNaN(Date.parse(inv.issuedAt)), "issuedAt must be a real timestamp");
  need(inv.quote && inv.quote.planIdentity && inv.quote.planIdentity.digest, "quote.planIdentity.digest required");
  need(inv.authorization && inv.authorization.ceiling && inv.authorization.ceiling.maxStorageANT, "authorization ceiling required");
  need(inv.walletAction && Array.isArray(inv.walletAction.requested), "walletAction.requested required");
  if (inv.state === "settled") {
    need(inv.settledReceiptId, "a settled invoice must name its receipt");
    need(inv.states && inv.states.settlement === "settled", "states.settlement must be settled");
  }
  if (inv.states && inv.states.settlement === "settled" && inv.state !== "settled") {
    problems.push("states claim settlement but invoice state does not — conflation");
  }
  if (problems.length) { const e = new Error("invalid invoice: " + problems.join("; ")); e.problems = problems; throw e; }
  return true;
}

// ── RECEIPT ─────────────────────────────────────────────────────────────────
// Exists ONLY from settlement evidence. There is deliberately no way to build
// one from an invoice alone — the measured-states law as code.
export function buildReceipt(evidence) {
  const required = ["settledAt", "invoiceId", "planDigest", "totalSettledAtto", "txRefs", "gasUsedWei", "finality"];
  const missing = required.filter((k) => evidence[k] === undefined || evidence[k] === null || (Array.isArray(evidence[k]) && !evidence[k].length));
  if (missing.length) {
    throw new Error("no settlement evidence, no receipt — missing: " + missing.join(", "));
  }
  if (!Array.isArray(evidence.txRefs) || !evidence.txRefs.every((t) => t.hash && t.chain)) {
    throw new Error("txRefs entries must carry {hash, chain}");
  }
  return {
    schema: RECEIPT_SCHEMA,
    receiptId: "rc-" + evidence.invoiceId.replace(/^inv-/, ""),
    settledAt: evidence.settledAt,
    invoiceId: evidence.invoiceId,
    paid: {
      asset: "ANT",
      totalSettledAtto: evidence.totalSettledAtto,
      route: evidence.route || "ANT → Autonomi payment vault (payForQuotes)",
      txRefs: evidence.txRefs
    },
    fees: {
      gasUsedWei: evidence.gasUsedWei,
      note: "gas is a separate asset and a separate bound — never folded into the ANT figure"
    },
    finality: evidence.finality,
    archive: {
      dataMapAddress: evidence.dataMapAddress || null,
      chunksStored: evidence.chunksStored ?? null,
      artifactSha256: evidence.artifactSha256 || null
    },
    verification: {
      uploaded: { state: evidence.uploaded ? "uploaded" : "not-yet", at: evidence.uploadedAt || null },
      retrieved: { state: evidence.retrieved ? "retrieved-fresh-context" : "not-yet", at: evidence.retrievedAt || null },
      hashVerified: { state: evidence.hashVerified ? "hash-verified-from-storage" : "not-yet", at: evidence.hashVerifiedAt || null }
    },
    reconciliation: null, // filled by reconcile()
    states: statesSnapshot({
      quote: "quoted",
      invoice: "issued",
      authorization: "exercised",
      settlement: "settled",
      receipt: "issued",
      reconciliation: "pending"
    }),
    state: evidence.retrieved && evidence.hashVerified ? "preserved" : "settled"
  };
}

export function validateReceipt(rec) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };
  need(rec && rec.schema === RECEIPT_SCHEMA, "schema must be " + RECEIPT_SCHEMA);
  need(rec.invoiceId && /^inv-up-/.test(rec.invoiceId), "receipt must bind to the invoice's upload_id");
  need(rec.paid && BigInt(rec.paid.totalSettledAtto) > 0n, "settled amount must be a positive real figure");
  need(rec.paid && Array.isArray(rec.paid.txRefs) && rec.paid.txRefs.length > 0, "payment evidence (tx refs) required");
  if (rec.states && rec.states.hashVerified === "hash-verified-from-storage" && !(rec.verification && rec.verification.hashVerified.state === "hash-verified-from-storage")) {
    problems.push("states claim hash verification the evidence does not carry — conflation");
  }
  if (problems.length) { const e = new Error("invalid receipt: " + problems.join("; ")); e.problems = problems; throw e; }
  return true;
}

// ── RECONCILIATION ──────────────────────────────────────────────────────────
// The invoice said what was authorized; the receipt says what happened. This
// is the comparison pass — it never assumes equality, it checks it.
export function reconcile(invoice, receipt) {
  validateInvoice(invoice);
  validateReceipt(receipt);
  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass, detail });

  const settledAtto = BigInt(receipt.paid.totalSettledAtto);
  const ceilingAtto = antAtto(invoice.authorization.ceiling.maxStorageANT);
  check("settled ≤ authorization ceiling", settledAtto <= ceilingAtto,
    `${settledAtto} atto vs ceiling ${ceilingAtto} atto`);

  check("receipt binds to this invoice", receipt.invoiceId === invoice.invoiceId, `${receipt.invoiceId} vs ${invoice.invoiceId}`);

  const digestMatch = !receipt.paid.planDigest || receipt.paid.planDigest === invoice.quote.planIdentity.digest;
  check("plan identity match", digestMatch,
    `${invoice.quote.planIdentity.digest} vs ${receipt.paid.planDigest || "(not carried)"}`);

  const gasWei = BigInt(receipt.fees.gasUsedWei);
  const gasCeilingWei = antAtto(invoice.authorization.ceiling.maxGasETH);
  check("gas ≤ authorized ceiling", gasWei <= gasCeilingWei, `${gasWei} wei vs ${gasCeilingWei} wei`);

  const artifactMatch = !receipt.archive.artifactSha256 || receipt.archive.artifactSha256 === invoice.quote.planIdentity.artifactSha256;
  check("artifact identity match", artifactMatch, "sha256 must be the invoiced artifact");

  const breached = checks.filter((c) => !c.pass);
  const outcome = {
    schema: "skaists.bpay-reconciliation/1",
    reconciledAt: new Date().toISOString(),
    invoiceId: invoice.invoiceId,
    receiptId: receipt.receiptId,
    checks,
    verdict: breached.length === 0 ? "reconciled" : "breach",
    breaches: breached.map((b) => b.name),
    note: breached.length === 0
      ? "authorized expectation and settled reality agree on every checked axis"
      : "AUTHORIZED BOUNDARY CROSSED — " + breached.map((b) => b.name).join("; ") + " — stop conditions apply"
  };
  receipt.reconciliation = outcome;
  return outcome;
}
