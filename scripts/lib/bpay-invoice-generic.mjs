// bpay-invoice-generic.mjs — the generic bPay INVOICE law (INVOICE-1 builder).
// Closes the three registered reds of scripts/inv1-bpay-invoice.mjs @4c6a4593:
//   INV-1.1 commitment retrievability — the quote set is CARRIED in the
//          canonical bytes; the owed figure re-derives offline (VV-1
//          self-sufficiency: never today's mutable pricing state).
//   INV-1.4 evidenced void terminality — void requires voidEvidence;
//          settled requires settlement evidence AND no void evidence;
//          supersession stays lawful (kind:"superseded" names its successor).
//   INV-1.5 canonical content-addressed identity — deterministic
//          serialization + contentDigest over the canonical bytes INCLUDING
//          the commitment; ADDITIVE to the job-bound id (never a replacement).
//
// SEPARATION (founder order, binding): canonical invoice bytes → content
// digest proves WHICH invoice. Authority (who issued/authorized) is a
// SEPARATE signature binding made by other machinery (R20's lane — nothing
// here signs). A full re-forge (strip evidence, recompute digest) is
// detectable ONLY against a durable anchor of the digest — that is the
// honest boundary, and validate(..., {expectedDigest}) is the check.
//
// FENCES: no zGenealogy code imported or modified (their bpay.mjs is the
// reference consumer); no bpay-rail/R20 duplication; domain-specific fields
// ride in `domain` (opaque to this law); quote TTL policy untouched.
import { createHash } from "node:crypto";

export const GENERIC_INVOICE_SCHEMA = "bpay.invoice-generic/1";
export const LINE_STATES = ["issued", "void", "settled"];

// ── canonical serialization (INV-1.5) ───────────────────────────────────────
// Deterministic by construction: objects serialize with lexicographically
// sorted keys, recursively; arrays preserve order (order is content) with
// ONE documented class exception; no whitespace; numbers are NOT
// canonicalized (monetary fields MUST be strings — validated below — so
// JSON number formatting never enters canonical bytes).
//
// SEMANTIC LAW (A2q ruling, 2026-09-17): a QUOTE COLLECTION is economically
// a SET. The reference's planDigest sorts quote hashes; the P1 recovery
// proof compares quote SETS across bridge death; no law assigns meaning to
// enumeration order. Therefore any array under a `quotes` key whose entries
// carry `quote_hash` is canonicalized SORTED by quote_hash (lexicographic)
// BEFORE identity is derived — every permutation of the same quote set
// yields identical canonical bytes and identity. Corollary (the duplicate
// law): a set has unique keys — a line's quotes must carry PAIRWISE-DISTINCT
// quote_hash; duplicates are refused at build AND validation (a repeated
// quote would inflate Σ owed — never a lawful set).
export function canonicalize(value, key = null) {
  if (Array.isArray(value)) {
    const items = value.map((v) => canonicalize(v));
    if (key === "quotes"
      && items.length
      && items.every((v) => v && typeof v === "object" && typeof v.quote_hash === "string")) {
      items.sort((x, y) => (x.quote_hash < y.quote_hash ? -1 : x.quote_hash > y.quote_hash ? 1 : 0));
    }
    return items;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonicalize(value[k], k);
    return out;
  }
  return value;
}
export function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonicalize(value)), "utf8");
}

// Content digest over the WHOLE document minus the digest field itself
// (content-addressing must be contradiction-free). Everything else — lines,
// carried quotes, lifecycle state, evidence, domain block — is covered.
export function contentDigest(doc) {
  const bare = canonicalize(structuredClone(doc));
  if (bare.identity) delete bare.identity.contentDigest;
  return "sha256:" + createHash("sha256").update(canonicalBytes(bare)).digest("hex");
}

// Commitment digest: sha256 over each line's sorted quote hashes joined by
// newline — the reference planDigest SHAPE (digest over the priced plan),
// with generic inputs (per-line quote sets). Re-derived from the CARRIED
// quotes at validation; a fabricated digest is refused.
export function commitmentDigest(lines) {
  const parts = [];
  for (const line of lines) {
    const hashes = (line.quotes || []).map((q) => q.quote_hash).sort();
    if (!hashes.length) continue;
    parts.push(hashes.join("\n"));
  }
  if (!parts.length) throw new Error("no carried quotes — the commitment cannot be derived");
  return "sha256:" + createHash("sha256").update(parts.join("\n\n")).digest("hex");
}

const ATTO_RE = /^\d+$/;
function sumAtto(quotes) {
  let total = 0n;
  for (const q of quotes) total += BigInt(q.amount_atto);
  return total;
}

// ── builder ─────────────────────────────────────────────────────────────────
// input = {
//   jobId, issuedAt,
//   lines: [{kind, asset, quotes:[{quote_hash, amount_atto}], ceilingAtto?}],
//           // one priced asset per line; amount = Σ quotes (INV-1.1: owed is
//           // DERIVED from the carried commitment, never asserted freehand)
//   authorization: {ceilings: {<asset>: attoString}, authorizedBy, stopConditions},
//   expiration?: {model, note},          // opaque-to-law domain semantics
//   domain?: {...},                      // genealogy/Autonomi-specific block
//   priorDigest?: "sha256:…"             // version lineage (append-only docs)
// }
export function buildGenericInvoice(input) {
  if (!input || typeof input !== "object") throw new Error("invoice input required");
  if (!input.jobId) throw new Error("jobId required — the job-bound identity is never replaced");
  if (!Array.isArray(input.lines) || !input.lines.length) throw new Error("lines required (one priced asset per line)");
  const lines = input.lines.map((l) => {
    if (!l.asset || typeof l.asset !== "string") throw new Error("each line names exactly one asset");
    if (!Array.isArray(l.quotes) || !l.quotes.length)
      throw new Error(`line ${l.asset}: the quote set must be CARRIED (INV-1.1) — local-only job state is not a commitment`);
    const seenHashes = new Set();
    for (const q of l.quotes) {
      if (!q.quote_hash || !ATTO_RE.test(String(q.amount_atto)))
        throw new Error(`line ${l.asset}: quotes carry {quote_hash, amount_atto} (amount a decimal string)`);
      if (seenHashes.has(q.quote_hash))
        throw new Error(`line ${l.asset}: duplicate quote_hash ${q.quote_hash} — a quote set has unique keys (A2q duplicate law)`);
      seenHashes.add(q.quote_hash);
    }
    const amountAtto = sumAtto(l.quotes).toString();
    // stored SORTED by quote_hash: set semantics at rest as well as at
    // identity-derivation (canonicalize also sorts — storage sorting keeps
    // the serialized artifact itself permutation-stable)
    const sortedQuotes = [...l.quotes].sort((x, y) => (x.quote_hash < y.quote_hash ? -1 : x.quote_hash > y.quote_hash ? 1 : 0));
    const out = { kind: l.kind || "service", asset: l.asset, amountAtto, quotes: sortedQuotes.map((q) => ({ quote_hash: q.quote_hash, amount_atto: String(q.amount_atto) })) };
    if (l.ceilingAtto !== undefined) out.ceilingAtto = String(l.ceilingAtto);
    return out;
  });
  const ceilings = input.authorization?.ceilings;
  if (!ceilings || typeof ceilings !== "object")
    throw new Error("authorization.ceilings required (per-asset, never one dollar figure)");
  for (const line of lines) {
    const cap = ceilings[line.asset];
    if (cap === undefined)
      throw new Error(`line ${line.asset}: no ceiling declared for asset ${line.asset}`);
    if (BigInt(line.amountAtto) > BigInt(cap))
      throw new Error(`line ${line.asset}: owed ${line.amountAtto} exceeds the authorization ceiling ${cap} — refuse to invoice`);
  }
  const doc = {
    schema: GENERIC_INVOICE_SCHEMA,
    invoiceId: "inv-" + input.jobId,
    issuedAt: input.issuedAt,
    lines,
    commitment: { kind: "carried-quote-set", digest: commitmentDigest(lines) },
    authorization: {
      ceilings: Object.fromEntries(Object.entries(ceilings).map(([a, v]) => [a, String(v)])),
      authorizedBy: input.authorization.authorizedBy || "(recorded)",
      stopConditions: input.authorization.stopConditions || [],
    },
    expiration: input.expiration || null,
    domain: input.domain || null,
    states: { invoice: "issued", settlement: "not-yet" },
    state: "issued",
    identity: { jobId: input.jobId, priorDigest: input.priorDigest || null },
  };
  doc.identity.contentDigest = contentDigest(doc);
  return doc;
}

// ── lifecycle (INV-1.4) ─────────────────────────────────────────────────────
// Transitions are EXPLICIT and produce a NEW version (append-only lineage):
// the prior version's digest rides in identity.priorDigest. Immutability is
// content-addressing, not forbidding correction — supersession is lawful.
export function voidGenericInvoice(doc, evidence) {
  assertValidCore(doc);
  if (doc.state !== "issued") throw new Error(`only an issued invoice can be voided (was ${doc.state})`);
  if (!evidence || !evidence.kind || !evidence.ref || !evidence.at)
    throw new Error('void requires evidence {kind:"abandon"|"superseded", ref, at} — a bare state flip is refused');
  if (evidence.kind === "superseded" && !evidence.successorJobId)
    throw new Error("supersession names its successor (correction stays lawful and traceable)");
  const next = structuredClone(doc);
  next.voidEvidence = { kind: evidence.kind, ref: evidence.ref, at: evidence.at, successorJobId: evidence.successorJobId || null };
  next.state = "void";
  next.states = { ...next.states, invoice: "void", settlement: "void" };
  next.identity = { ...next.identity, priorDigest: doc.identity.contentDigest };
  next.identity.contentDigest = contentDigest(next);
  return next;
}

export function settleGenericInvoice(doc, settlement) {
  assertValidCore(doc);
  if (doc.state !== "issued") throw new Error(`only an issued invoice can settle (was ${doc.state})`);
  if (!settlement || !settlement.receiptId || !settlement.receiptDigest)
    throw new Error("settlement requires {receiptId, receiptDigest} — the receipt is separate evidence, never a bare id");
  const next = structuredClone(doc);
  next.settlement = { receiptId: settlement.receiptId, receiptDigest: settlement.receiptDigest, at: settlement.at };
  next.state = "settled";
  next.states = { ...next.states, invoice: "settled", settlement: "settled" };
  next.identity = { ...next.identity, priorDigest: doc.identity.contentDigest };
  next.identity.contentDigest = contentDigest(next);
  return next;
}

// ── validator ───────────────────────────────────────────────────────────────
// opts.expectedDigest: the digest recorded by a DURABLE copy (restart reload,
// registry, consumer). Mismatch = re-forge detected. Omitted = offline
// self-verification of internal consistency only (the honest boundary).
export function validateGenericInvoice(doc, opts = {}) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };
  need(doc && doc.schema === GENERIC_INVOICE_SCHEMA, "schema must be " + GENERIC_INVOICE_SCHEMA);
  if (problems.length) { const e = new Error("invalid invoice: " + problems.join("; ")); e.problems = problems; throw e; }

  // INV-1.5 — canonical integrity + additive identity
  need(doc.identity && doc.identity.jobId, "identity.jobId required (the job-bound id stays — additive law)");
  need(typeof doc.identity.contentDigest === "string" && doc.identity.contentDigest.startsWith("sha256:"),
    "identity.contentDigest required (canonical content-addressed identity)");
  const recomputed = contentDigest(doc);
  need(recomputed === doc.identity.contentDigest,
    `contentDigest mismatch — canonical bytes changed (${recomputed.slice(0, 17)}… vs recorded ${String(doc.identity.contentDigest).slice(0, 17)}…): silent mutation detected`);
  if (opts.expectedDigest !== undefined)
    need(doc.identity.contentDigest === opts.expectedDigest,
      `contentDigest ≠ durable anchor ${opts.expectedDigest.slice(0, 17)}… — the document was re-forged after the anchored copy was made`);

  // INV-1.1 — the commitment is carried and the owed figure re-derives
  need(Array.isArray(doc.lines) && doc.lines.length >= 1, "lines required");
  for (const line of doc.lines) {
    need(typeof line.asset === "string" && !!line.asset, "each line names one asset");
    need(Array.isArray(line.quotes) && line.quotes.length >= 1,
      `line ${line.asset}: the quote set must be CARRIED in the canonical bytes — a commitment living only on the issuing machine is not retrievable (INV-1.1)`);
    if (Array.isArray(line.quotes) && line.quotes.length) {
      const seenHashes = new Set();
      let dup = null;
      for (const q of line.quotes) {
        if (seenHashes.has(q.quote_hash)) { dup = q.quote_hash; break; }
        seenHashes.add(q.quote_hash);
      }
      need(dup === null, `line ${line.asset}: duplicate quote_hash ${dup} — a quote set has unique keys (A2q duplicate law; survives digest recomputation)`);
      const derived = sumAtto(line.quotes).toString();
      need(line.amountAtto === derived,
        `line ${line.asset}: owed ${line.amountAtto} ≠ Σ carried quotes ${derived} — the amount does not re-derive from the commitment (INV-1.1)`);
    }
    const cap = doc.authorization?.ceilings?.[line.asset];
    need(cap !== undefined, `line ${line.asset}: no authorization ceiling declared`);
    if (cap !== undefined && line.amountAtto !== undefined && ATTO_RE.test(String(line.amountAtto)) && ATTO_RE.test(String(cap)))
      need(BigInt(line.amountAtto) <= BigInt(cap), `line ${line.asset}: owed exceeds the authorized ceiling`);
  }
  const cmd = (() => { try { return commitmentDigest(doc.lines); } catch { return null; } })();
  need(cmd !== null && doc.commitment?.digest === cmd,
    "commitment.digest does not re-derive from the carried quote set — a fabricated or substituted plan digest (INV-1.1)");

  // INV-1.4 — evidenced terminality
  need(LINE_STATES.includes(doc.state), `state must be one of ${LINE_STATES.join("|")} (was ${JSON.stringify(doc.state)})`);
  if (doc.state === "void") {
    need(doc.voidEvidence && !!doc.voidEvidence.kind && !!doc.voidEvidence.ref && !!doc.voidEvidence.at,
      'state "void" requires voidEvidence {kind, ref, at} — a bare declaration is refused (INV-1.4)');
    if (doc.voidEvidence?.kind === "superseded")
      need(!!doc.voidEvidence.successorJobId, "superseded void names its successorJobId");
  }
  if (doc.state === "settled") {
    need(doc.settlement && !!doc.settlement.receiptId && !!doc.settlement.receiptDigest,
      'state "settled" requires settlement {receiptId, receiptDigest} — never a bare receipt id (INV-1.4)');
  }
  // the resurrection law: void evidence is terminal. A document that carries
  // voidEvidence can never validate as settled, whichever field was flipped.
  need(!(doc.state === "settled" && doc.voidEvidence),
    "RESURRECTION REFUSED: this document carries voidEvidence — a voided obligation cannot become settled (void→settled is conflation; issue a superseding invoice instead)");
  need(!(doc.state === "void" && doc.settlement),
    "CONFLATION: a voided document carries settlement evidence");
  // states map agreement
  if (doc.states) {
    const s = doc.states;
    need(!(s.settlement === "settled" && doc.state !== "settled"), "states claim settlement the document state does not — conflation");
    need(!(s.settlement === "void" && doc.state !== "void"), "states claim void the document state does not — conflation");
  }

  // measured-states hygiene in canonical content: token-native only
  const canonicalText = JSON.stringify(canonicalize(doc));
  need(!/usd|fiat|dollars?\b/i.test(canonicalText.replace(/"hexLawNote":"[^"]*"/g, "")),
    "token-native law: fiat-denominated fields are forbidden in the canonical object");

  if (problems.length) { const e = new Error("invalid invoice: " + problems.join("; ")); e.problems = problems; throw e; }
  return true;
}

// core validity used by lifecycle helpers (pre-transition sanity of the
// version being advanced)
function assertValidCore(doc) {
  if (!doc || doc.schema !== GENERIC_INVOICE_SCHEMA) throw new Error("not a " + GENERIC_INVOICE_SCHEMA + " document");
  if (!doc.identity?.contentDigest || contentDigest(doc) !== doc.identity.contentDigest)
    throw new Error("the version being advanced fails canonical integrity — refusing to build on mutated bytes");
}
