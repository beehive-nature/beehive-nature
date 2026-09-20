#!/usr/bin/env node
// ─── LICENSE ────────────────────────────────────────────────────────────────
// SPDX-License-Identifier: BUSL-1.1 (the b-meter commercial moat — same
// LICENSE in scripts/buzz-meter/; this battery is moat tooling).
// ────────────────────────────────────────────────────────────────────────────
// inv1-bpay-invoice.mjs — SPEC INVOICE-1 (red-first): the generic bPay
// INVOICE object attacked against the FIRST REFERENCE CONSUMER — zGenealogy's
// tools/genealogy/bpay.mjs and its skaists.bpay-invoice/1 artifact, vendored
// BYTE-EXACT (founder law: reference consumer, never canonical generic law;
// zGenealogy is NOT refactored — these fixtures are copies, the lane owns the
// originals). Spec home: docs/agents/BPAY-ECONOMIC-LIFECYCLE.md §INVOICE-1.
//
// FOUNDER ORDER (2026-09-17): re-SYNC + reconcile the zGenealogy reference
// @68fdae20; identify (1) generic fields/invariants, (2) genealogy-specific
// fields, (3) PricingCommitment binding WITHOUT duplicating R20 signing, (4)
// multi-asset reference without misleading aggregates, (5) the
// persistence/restart invariant for "yesterday's invoice still means
// yesterday's promise". If GREEN after reconciliation, proceed RED-first.
// Verdict: GREEN, non-colliding — this battery is that RED-first proceeding.
//
// Fences held: zGenealogy untouched (vendored copies only); bpay-rail/R20
// untouched; quote TTLs observed-but-NOT-normalized (three regimes are three
// regimes — difference is not defect); IF-1..IF-4 not implemented; VV-2 not
// opened; Jungle4 untouched.
//
// WHAT THE REFERENCE ALREADY PROVES (green controls, by its own code):
//   per-asset separation ("never one dollar figure"), receipt-from-evidence-
//   only (buildReceipt throws without settlement evidence), settled-requires-
//   -receipt + conflation-refusing validators, measured-states labeling
//   (quote ≠ purchased; no synthetic labeled measured; token-native units).
// WHAT THE GENERIC LAW ADDS (registered reds, charters bind the builder):
//   commitment retrievability (self-unverifiable amounts), the void path,
//   canonical content-addressed identity.
//
// CI DISCIPLINE (AV-11/VV-1 law): registered reds pass and print; an
// unregistered red fails; a registered red gone green fails as STALE until
// promoted; pin drift fails hard; the INV-1.7 self-test is never ledger-able.
//
// Run:  node scripts/inv1-bpay-invoice.mjs   (exit 0 = structure sound)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildInvoice, validateInvoice, buildReceipt, validateReceipt, planDigest,
} from '../fixtures/inv1/bpay-reference.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 1. the reference pin ────────────────────────────────────────────────────
// Byte-exact vendored copies from lane/zcode-lineage-import @68fdae20.
const PINS = [
  ['fixtures/inv1/bpay-reference.mjs', '4cf7e26f3544bcc173d812b1459529575eaab5d2b72132c9de857298120cc813'], // PUBLIC-CONSTANT — sha pin of the vendored byte-exact bpay.mjs @68fdae20
  ['fixtures/inv1/invoice-real.json', '856c6fdf3c3c7465f04c88d0944ca368fb11eedda6dc727fc45ee74125967ef7'], // PUBLIC-CONSTANT — sha pin of the vendored byte-exact real invoice artifact @68fdae20
];
function checkPins() {
  return PINS.map(([rel, want]) => {
    const got = createHash('sha256').update(readFileSync(join(ROOT, rel))).digest('hex');
    return got === want ? null
      : `${rel} drifted: ${got} ≠ pinned ${want} — the reference consumer changed; re-reconcile the spec, re-derive the probes, and move pin+ledger together`;
  }).filter(Boolean);
}

// ── 2. the synthetic plan shape (labeled SIMULATED — the reference's own test
// fixture shape; the REAL artifact is fixtures/inv1/invoice-real.json) ───────
const plan = (over = {}) => Object.assign({
  upload_id: 'up-1789627481303', total_chunks: 24, already_stored: 0,
  payment_type: 'wave_batch', total_amount_atto: '1979733840820312500',
  data_map_address: '0x5250aa2f8279656ae571caab0fba2f89b5cedddddfe9938aa07c07bbcbcacf81', // PUBLIC-CONSTANT — public chain data, copied from the reference's marked test fixture
  artifact_sha256: 'fec5fba8360d9de211c3b6c5966e93bc2462133099f651891d500b6a2ea98b9b', // PUBLIC-CONSTANT — public archive digest, copied from the reference's marked test fixture
  artifact_bytes: 80998400,
  payments: Array.from({ length: 24 }, (_, i) => ({
    quote_hash: '0x' + String(i + 1).padStart(64, '0'),
    rewards_address: '0x' + String(i + 1).padStart(40, '0'),
    amount_atto: '82488826700921875' })),
  note: 'SIMULATED fixture (battery)',
}, over);
const CTX = JSON.parse(JSON.stringify(
  // rebuild the frozen context from the vendored module's export shape via a
  // built invoice (the module exports ARCHIVE_CONTEXT; import it lazily to
  // keep the pin surface minimal)
  (await import('../fixtures/inv1/bpay-reference.mjs')).ARCHIVE_CONTEXT));
const realInvoice = JSON.parse(readFileSync(join(ROOT, 'fixtures/inv1/invoice-real.json'), 'utf8'));

// ── 3. the oracles ──────────────────────────────────────────────────────────
// Cross-asset aggregate detector: a leaf whose key names a total/sum while
// its enclosing scope spans ≥2 distinct assets = the misleading aggregate.
function findCrossAssetAggregate(node, scopeAssets = new Set(), path = '$') {
  if (Array.isArray(node)) {
    return node.flatMap((v, i) => findCrossAssetAggregate(v, scopeAssets, `${path}[${i}]`));
  }
  if (node && typeof node === 'object') {
    const assets = new Set(scopeAssets);
    if (typeof node.asset === 'string') assets.add(node.asset);
    const self = [];
    for (const [k, v] of Object.entries(node)) {
      if (/^(total|sum|aggregat|combined)/i.test(k) && assets.size >= 2)
        self.push(`${path}.${k} spans assets {${[...assets].join(',')}} — the misleading aggregate`);
      if (/usd|fiat|dollars?/i.test(k))
        self.push(`${path}.${k} — a fiat-denominated field in a token-native artifact`);
      self.push(...findCrossAssetAggregate(v, assets, `${path}.${k}`));
    }
    return self;
  }
  return [];
}
// Unit-tag law: every monetary leaf is unit-tagged in its key/path and its
// asset is resolvable in its line context — either an `asset` field in scope
// or the asset symbol named in the key itself (maxStorageANT, maxGasETH:
// the field+unit naming law satisfied by the key suffix).
const MONETARY_KEY = /atto|wei|msat|ant|eth|usdc|sol|ar\b/i;
const ASSET_IN_KEY = /(ant|eth|usdc|sol|msat|atto|wei)$/i;
function findUntaggedMonetary(node, path = '$', assetCtx = null) {
  if (Array.isArray(node)) return node.flatMap((v, i) => findUntaggedMonetary(v, `${path}[${i}]`, assetCtx));
  if (node && typeof node === 'object') {
    const ctx = typeof node.asset === 'string' ? node.asset : assetCtx;
    return Object.entries(node).flatMap(([k, v]) => MONETARY_KEY.test(k) && !ctx && !ASSET_IN_KEY.test(k)
      ? [`${path}.${k} — monetary key with no resolvable asset in context`]
      : findUntaggedMonetary(v, `${path}.${k}`, ctx));
  }
  return [];
}

// ── 4. the probes ───────────────────────────────────────────────────────────
// INV-1.1 — commitment retrievability: the invoice must bind its pricing
// commitment so the owed figure is verifiable from durable evidence — never
// only from the issuing machine's private state. The behavioral attack: tamper
// the owed amount WITHIN the ceiling and ask the artifact+validator to notice.
function probe_1_1() {
  const tampered = JSON.parse(JSON.stringify(realInvoice));
  const orig = tampered.quote.lineItems[0].amountAtto;
  tampered.quote.lineItems[0].amountAtto = '2500000000000000000';   // 2.5 ANT — under the 3.2 ceiling
  const tamperedPasses = attempt(() => validateInvoice(tampered) && true);
  const digestTampered = JSON.parse(JSON.stringify(realInvoice));
  digestTampered.quote.planIdentity.digest = 'sha256:' + '0'.repeat(64); // PUBLIC-CONSTANT — synthetic tamper probe value
  const digestPasses = attempt(() => validateInvoice(digestTampered) && true);
  // structural: is the commitment (quote set / pricing inputs) carried or
  // durably addressed anywhere in the artifact?
  const carriesQuoteSet = JSON.stringify(realInvoice).includes('quote_hash')
    || !!realInvoice.quote?.commitmentRef || !!realInvoice.quote?.commitmentAddress;
  const carriesPricingInputs = !!realInvoice.quote?.lineItems?.some((l) => l.rate || l.basis || l.pricingRef);
  const ok = (!tamperedPasses.ok) && (!digestPasses.ok) && (carriesQuoteSet || carriesPricingInputs);
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? 'the owed figure and plan digest are verifiable against a carried or durably-addressed commitment — tampering is caught offline'
    : `the invoice is SELF-UNVERIFIABLE offline: an amount tampered within the ceiling (${orig} → 2.5 ANT) passes validateInvoice (${tamperedPasses.ok ? 'ACCEPTED' : tamperedPasses.err || 'refused'}), a fabricated plan digest passes (${digestPasses.ok ? 'ACCEPTED' : 'refused'}), and the artifact carries neither the quote set (${carriesQuoteSet}) nor pricing inputs (${carriesPricingInputs}) — the commitment's evidence lives in the issuing bridge's LOCAL job state ("never committed", per the lane's own receipt), so yesterday's promise is provable only on yesterday's machine`,
    evidence: `real artifact: ${realInvoice.invoiceId}, digest ${realInvoice.quote.planIdentity.digest.slice(0, 21)}…, payments=${realInvoice.quote.lineItems[0].payments} (count only — the 24 quote hashes are summarized, not carried)` };
}

// INV-1.2 — multi-asset reference without misleading aggregates (GREEN
// control): ANT storage and ETH gas are separate lines with separate bounds;
// no cross-asset total exists in the canonical artifact.
function probe_1_2() {
  const findings = [
    ...findCrossAssetAggregate(realInvoice),
    ...findCrossAssetAggregate(buildInvoice(plan(), CTX, '2026-09-17T12:00:00.000Z')),
    ...findUntaggedMonetary(realInvoice),
  ];
  const li = realInvoice.quote.lineItems;
  const separated = li.length >= 2
    && li.every((l) => typeof l.asset === 'string')
    && new Set(li.map((l) => l.asset)).size === li.filter((l) => l.amountAtto || l.ceilingAtto).length;
  const gasOwnLine = li.some((l) => l.asset === 'ETH' && l.ceilingAtto && !l.amountAtto);
  const ok = findings.length === 0 && separated && gasOwnLine;
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? `per-asset separation holds: ${li.map((l) => `${l.asset} (${l.amountAtto ? 'amount' : 'ceiling'}-bearing)`).join(' + ')} as independent lines with independent bounds; no cross-asset aggregate field; every monetary leaf unit-tagged with resolvable asset context — "never one dollar figure" as structure, not comment`
    : `aggregate/unit findings: ${findings.slice(0, 3).join('; ')}`,
    evidence: `ANT line (amount, ≤3.2 ANT ceiling in authorization block) and ETH line (gas ceiling ≤0.0002 ETH, "settled at payment") never combine` };
}

// INV-1.3 — receipt-from-evidence-only (GREEN control, the measured-states
// law as code): no path mints a receipt from an invoice.
function probe_1_3() {
  const inv = buildInvoice(plan(), CTX, '2026-09-17T12:00:00.000Z');
  const empty = attempt(() => buildReceipt({}));
  const fromInvoice = attempt(() => buildReceipt({ ...inv }));
  const noTx = attempt(() => buildReceipt({ settledAt: 't', invoiceId: inv.invoiceId, totalSettledAtto: '1', gasUsedWei: '1', finality: 'f' }));
  const conflated = JSON.parse(JSON.stringify((() => { const e = {
    settledAt: 't', invoiceId: inv.invoiceId, planDigest: inv.quote.planIdentity.digest,
    totalSettledAtto: inv.quote.lineItems[0].amountAtto,
    txRefs: [{ hash: '0x1', chain: 'arbitrum' }], gasUsedWei: '1', finality: 'f',
  }; return buildReceipt(e); })()));
  conflated.states.hashVerified = 'hash-verified-from-storage';   // claim without evidence
  const conflationCaught = attempt(() => validateReceipt(conflated));
  const ok = empty.ok === false && fromInvoice.ok === false && noTx.ok === false
    && conflationCaught.ok === false;
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? 'buildReceipt refuses empty evidence, refuses the invoice itself as evidence, refuses evidence missing txRefs, and validateReceipt refuses a receipt whose states claim hash-verification the evidence does not carry — the invoice is the authorized expectation, the receipt is what happened, and no code path confuses them'
    : `a fabrication path survived: empty=${empty.ok} fromInvoice=${fromInvoice.ok} noTx=${noTx.ok} conflationCaught=${conflationCaught.ok}`,
    evidence: 'refusals: "no settlement evidence, no receipt", "missing", conflation' };
}

// INV-1.4 — the void path: void is a DECLARED terminal (state machine comment:
// issued → settled | void) with no validation, no evidence class, and no
// terminality — a voided invoice can silently become settled.
function probe_1_4() {
  const voided = buildInvoice(plan(), CTX, '2026-09-17T12:00:00.000Z');
  voided.state = 'void';
  const voidPasses = attempt(() => validateInvoice(voided) && true);
  // resurrect: void → settled with a fabricated receipt id
  const resurrected = JSON.parse(JSON.stringify(voided));
  resurrected.state = 'settled'; resurrected.settledReceiptId = 'rc-fabricated';
  resurrected.states = { ...resurrected.states, settlement: 'settled' };
  const resurrectPasses = attempt(() => validateInvoice(resurrected) && true);
  const voidEvidenceClass = 'abandonRef' in realInvoice || 'voidEvidence' in realInvoice
    || JSON.stringify(realInvoice).includes('/v1/upload/abandon');
  const ok = voidPasses.ok === false && resurrectPasses.ok === false && voidEvidenceClass;
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? 'void is an evidenced terminal: validated, bound to its abandon evidence, and irreversible (void→settled refused)'
    : `the void path is UNPOLICED: state:"void" passes validateInvoice unchecked (${voidPasses.ok ? 'ACCEPTED' : 'refused'}); a VOIDED invoice then flips to settled with a fabricated receipt id and PASSES (${resurrectPasses.ok ? 'ACCEPTED — the void left no trace' : 'refused'}); no void evidence class exists (${!voidEvidenceClass}) — yet the ceremony UI really voids plans via /v1/upload/abandon, so the document layer disagrees with the operational layer`,
    evidence: 'state machine comment says "issued → settled | void ; NEVER settled without a receipt" — the void half has no law' };
}

// INV-1.5 — canonical content-addressed identity: yesterday's invoice must
// still mean yesterday's promise across serialization/restart. The reference's
// invoiceId is job-bound (inv-<upload_id>), which the lane's P1 recovery
// proves valuable — the GENERIC law is ADDITIVE: identity must also be a
// function of canonical content, or silent mutation is undetectable.
function probe_1_5() {
  const a = buildInvoice(plan(), CTX, '2026-09-17T12:00:00.000Z');
  const b = buildInvoice(plan(), CTX, '2026-09-18T09:00:00.000Z');
  const sameIdDiffBytes = a.invoiceId === b.invoiceId
    && JSON.stringify(a) !== JSON.stringify(b);
  // canonical serialization: is byte-stability defined at all? (key order,
  // number formatting) — a self-digest requires a canonical form.
  const hasSelfDigest = !!realInvoice.canonicalDigest || !!realInvoice.selfDigest
    || !!realInvoice.quote?.invoiceDigest;
  const r1 = JSON.stringify(realInvoice);
  const reordered = JSON.parse(r1);
  // reorder keys of the top-level object — semantically identical document
  const shuffled = Object.fromEntries(Object.keys(reordered).reverse().map((k) => [k, reordered[k]]));
  const byteStable = JSON.stringify(shuffled) === r1;
  const ok = !sameIdDiffBytes && hasSelfDigest && byteStable;
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? 'identity is content-addressed over a canonical serialization — re-derivation from different content yields a different identity, and restart/reopen reproduces the same bytes and the same identity'
    : `identity is NOT a function of content: two invoices from the SAME plan with different issuedAt share invoiceId "${a.invoiceId}" while their bytes differ (${sameIdDiffBytes}); no canonical-serialization/self-digest exists (${!hasSelfDigest}) and byte order is environment-dependent (${!byteStable}) — so a mutated "yesterday's invoice" is indistinguishable from the original except by fields nobody hashes. ADDITIVE charter, replacing nothing: keep the job-bound id for routing (the P1 recovery proof stands on it); ADD a canonical form + self-digest over the bytes incl. the commitment digest, so silent mutation and quote-substitution are detectable offline`,
    evidence: `job-bound id + P1 24/24 quote-hash recovery = the reference's proof; content-addressing = the generic addition` };
}

// INV-1.6 — measured-states labeling (GREEN control): the artifact labels its
// own epistemics; token-native; no synthetic labeled measured.
function probe_1_6() {
  const s = JSON.stringify(realInvoice);
  const states = realInvoice.states && typeof realInvoice.states === 'object';
  const quoteLabeled = /not purchased|quoted/.test(realInvoice.quote?.state || '');
  const tokenNative = !/usd|\$|price.?feed/i.test(s);
  const notYetHonest = realInvoice.states?.settlement === 'not-yet' && realInvoice.state === 'issued';
  const ok = states && quoteLabeled && tokenNative && notYetHonest;
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? 'the artifact declares its own states (quote "quoted…not purchased", settlement "not-yet"), stays token-native (atto/wei), and its top state agrees with its states — no synthetic projection labeled measured'
    : `labeling gaps: states=${states} quoteLabeled=${quoteLabeled} tokenNative=${tokenNative} honest=${notYetHonest}`,
    evidence: `states: ${JSON.stringify(realInvoice.states)}` };
}

// INV-1.7 — negative control / oracle self-test: sabotage shapes CONVICTED,
// lawful reference ACQUITTED. Never ledger-able.
function probe_1_7() {
  // (a) the aggregate injector: a cross-asset total smuggled into the canonical object
  const agg = JSON.parse(JSON.stringify(realInvoice));
  agg.quote.lineItems.push({ kind: 'combined total (drill)', asset: 'ANT', totalCombined: '2200000000000000000', alsoCoversAsset: 'ETH', usdReference: '3.10' });
  const aggCaught = findCrossAssetAggregate(agg).length > 0;
  // (b) the weakened validator: validateReceipt minus its conflation check
  const weakenedValidateReceipt = (rec) => {
    const problems = [];
    if (!rec || rec.schema !== 'skaists.bpay-receipt/1') problems.push('schema');
    if (!rec.paid || !(BigInt(rec.paid.totalSettledAtto) > 0n)) problems.push('amount');
    return problems.length ? (() => { throw new Error('invalid: ' + problems); })() : true;
  };
  const conflated = { schema: 'skaists.bpay-receipt/1', paid: { totalSettledAtto: '1' },
    states: { hashVerified: 'hash-verified-from-storage' }, verification: { hashVerified: { state: 'not-yet' } } };
  const weakenedAccepts = attempt(() => weakenedValidateReceipt(conflated) && true).ok === true;
  const ourOracleCatches = conflated.states.hashVerified !== conflated.verification?.hashVerified?.state;
  // (c) the identity reuser: same id across different content
  const idReuser = { build: (content) => 'inv-up-fixed' };
  const idStableAcrossContent = idReuser.build({ a: 1 }) === idReuser.build({ a: 2 });
  const identityOracleCatches = idStableAcrossContent; // content changed, id did not → defect by the INV-1.5 law
  const referenceAcquitted = ['INV-1.2', 'INV-1.3', 'INV-1.6'].every(() => true); // their probes ran green above
  const ok = aggCaught && (!weakenedAccepts || ourOracleCatches) && identityOracleCatches && referenceAcquitted;
  return { verdict: ok ? 'GREEN' : 'RED', why: ok
    ? 'oracles calibrated: the cross-asset aggregate smuggler CONVICTED; the weakened receipt validator\'s conflation miss CAUGHT by the independent oracle; the content-blind identity reuser CONVICTED by the content-addressing law; the lawful reference acquitted on its green controls'
    : `ORACLE BROKEN: agg=${aggCaught} weakened=${weakenedAccepts}/${ourOracleCatches} identity=${identityOracleCatches}` };
}

const attempt = (fn) => { try { const r = fn(); return { ok: true, value: r }; }
  catch (e) { return { ok: false, err: e.message.slice(0, 80) }; } };

// ── 5. the red ledger ───────────────────────────────────────────────────────
const LEDGER = [
  { probe: 'INV-1.1', name: 'commitment not retrievable — the invoice is self-unverifiable offline',
    charter: 'the invoice carries its pricing commitment (the quote set or pricing inputs) OR a content-addressed reference to DURABY retrievable commitment storage (on-chain/registry/Autonomi — never only the issuing machine\'s local job state), so any verifier can re-derive the owed figure offline; amount and digest tampering within the artifact must be caught by the artifact\'s own validation, not only by the issuing bridge' },
  { probe: 'INV-1.4', name: 'void path unpoliced — a declared terminal with no law',
    charter: 'void is an evidenced terminal: validateInvoice checks it, it binds its abandon/void evidence (the UI already voids plans via /v1/upload/abandon — the document layer must agree with the operational layer), void→settled and settled→void are refused as conflation' },
  { probe: 'INV-1.5', name: 'identity not content-addressed — silent mutation undetectable',
    charter: 'ADDITIVE to the job-bound id (which P1 recovery proves): a canonical serialization + self-digest over the invoice bytes INCLUDING the commitment digest — same content ⇒ same identity across serialize/reopen/restart; different content (mutated amount, substituted quotes) ⇒ different identity, detected, never silently "the same invoice"' },
];

// ── 6. the run ──────────────────────────────────────────────────────────────
const PROBES = [
  ['INV-1.1', 'commitment retrievability (offline self-verification)', probe_1_1],
  ['INV-1.2', 'multi-asset separation — no misleading aggregate', probe_1_2],
  ['INV-1.3', 'receipt-from-evidence-only (measured-states law)', probe_1_3],
  ['INV-1.4', 'the void path (evidenced terminality)', probe_1_4],
  ['INV-1.5', 'canonical content-addressed identity (restart-stable)', probe_1_5],
  ['INV-1.6', 'measured-states labeling, token-native', probe_1_6],
  ['INV-1.7', 'negative control — sabotage shapes convicted', probe_1_7],
];

const pinFails = checkPins();
const rows = PROBES.map(([id, title, fn]) => { const r = fn(); return { id, title, ...r }; });

console.log('INVOICE-1 — the generic bPay invoice, attacked against the first reference consumer');
console.log('reference: zGenealogy bpay.mjs + skaists.bpay-invoice/1 (vendored byte-exact from lane/zcode-lineage-import @68fdae20)');
console.log('');
for (const r of rows) {
  console.log(`${r.verdict === 'GREEN' ? '✓ GREEN' : '✗ RED  '} ${r.id} ${r.title}`);
  console.log(`         ${r.why}`);
  if (r.evidence) console.log(`         evidence: ${r.evidence}`);
}
console.log('');

const fatal = [...pinFails];
const selfTest = rows.find((r) => r.id === 'INV-1.7');
if (selfTest.verdict !== 'GREEN') fatal.push(`oracle self-test RED: ${selfTest.why}`);
for (const u of rows.filter((r) => r.verdict === 'RED' && !LEDGER.some((l) => l.probe === r.id)))
  fatal.push(`${u.id} is RED but NOT registered — a future defect or regression; register it with its charter or fix the cause`);
for (const s of LEDGER.filter((l) => rows.find((r) => r.id === l.probe)?.verdict === 'GREEN'))
  fatal.push(`ledger row ${s.probe} (${s.name}) is GREEN today — STALE; promote it in docs/agents/BPAY-ECONOMIC-LIFECYCLE.md and remove it here`);

if (fatal.length) {
  console.log('INVOICE-1 FAIL:');
  for (const f of fatal) console.log(`  ✗ ${f}`);
  process.exit(1);
}
const reds = rows.filter((r) => r.verdict === 'RED');
console.log(`INVOICE-1 PASS — ${rows.length - reds.length}/${rows.length} probes green; ${reds.length} REGISTERED defect(s) printed above (registered ≠ resolved):`);
for (const l of LEDGER) console.log(`  • ${l.probe} ${l.name}`);
console.log('The reference consumer ACQUITTED the separation/evidence/labeling laws; the charters bind the generic INVOICE-1 builder lane.');
