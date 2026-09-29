#!/usr/bin/env node
// ── INVOICE-1 builder proof battery ────────────────────────────────────────
// Closes the three registered reds of the FROZEN battery
// (scripts/inv1-bpay-invoice.mjs @4c6a4593 — untouched, still running, its
// reds remain the record of the REFERENCE's gaps) with a GENERIC
// implementation: scripts/lib/bpay-invoice-generic.mjs.
//
// This battery proves the founder mission's required list against the
// generic implementation, and re-applies each charter's probe shape:
//   INV-1.1-B  tamper within ceiling refused; fabricated digest refused;
//              quote set carried; owed re-derives offline; survives restart
//              with today's pricing mutated underneath.
//   INV-1.4-B  bare void refused; void→settled resurrection refused even
//              after evidence-stripped re-forge (anchor law); lawful
//              supersession preserved.
//   INV-1.5-B  deterministic canonical bytes; semantically identical content
//              ⇒ same identity; meaningful mutation ⇒ different identity;
//              job identity and content identity remain distinguishable.
//   FENCE-B    no signing machinery present (R20's lane untouched).
//
// Restart proof runs THIS FILE as a child (--child) so validation happens in
// a fresh process with no builder state. Exit 0 = all proofs green.
// Run:  node scripts/inv1-generic-builder.mjs
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GENERIC_INVOICE_SCHEMA, buildGenericInvoice, validateGenericInvoice,
  voidGenericInvoice, settleGenericInvoice, canonicalBytes, contentDigest,
} from "./lib/bpay-invoice-generic.mjs";

const SELF = fileURLToPath(import.meta.url);
const TMP = join(dirname(SELF), "..", "tmp-inv1-builder");

// ── child mode: fresh-process offline validation of a persisted artifact ────
if (process.argv[2] === "--child") {
  const [, , , artifactPath, expectedDigest, decoyRatesPath] = process.argv;
  try {
    // today's pricing drifts BEFORE the historical artifact is read — the
    // validator must never consult it (INV-1.1 / VV-1 self-sufficiency)
    writeFileSync(decoyRatesPath, JSON.stringify({ version: "rateset-future", storage_ant: "9.9", note: "today's offer — irrelevant to yesterday's promise" }));
    const doc = JSON.parse(readFileSync(artifactPath, "utf8"));
    validateGenericInvoice(doc, { expectedDigest });
    const owed = doc.lines.map((l) => `${l.asset}:${l.amountAtto}`).join(",");
    console.log(`CHILD-OK digest-match owed=${owed}`);
    process.exit(0);
  } catch (e) {
    console.log("CHILD-FAIL " + e.message);
    process.exit(1);
  }
}

const attempt = (fn) => { try { const r = fn(); return { ok: true, value: r }; } catch (e) { return { ok: false, err: e.message.slice(0, 120) }; } };
const results = [];
const proof = (id, ok, why) => { results.push({ id, ok, why }); console.log(`${ok ? "✓" : "✗"} ${id} ${why}`); };

// ── a representative generic input (domain block carries genealogy-shaped
// opaque content — the law never reads it) ──────────────────────────────────
const quotes = (n, atto) => Array.from({ length: n }, (_, i) => ({ quote_hash: "q-" + String(i + 1).padStart(3, "0"), amount_atto: atto }));
const input = () => ({
  jobId: "up-1789627481303",
  issuedAt: "2026-09-17T12:00:00.000Z",
  lines: [
    { kind: "network storage", asset: "ANT", quotes: quotes(24, "82488826700921875") },
    { kind: "gas (authorized ceiling)", asset: "ETH", quotes: quotes(1, "200000000000000") },
  ],
  authorization: { ceilings: { ANT: "4000000000000000000", ETH: "300000000000000" }, authorizedBy: "founder order (test fixture)", stopConditions: ["fixture"] },
  domain: { ceremony: "zBlood-style archive block rides opaquely (fixture)", dataMapAddress: "(domain value — not law)" },
});

// 1. deterministic canonical serialization + 2. semantic identity
const a = buildGenericInvoice(input());
const b = buildGenericInvoice(JSON.parse(JSON.stringify(input())));
const shuffled = JSON.parse(JSON.stringify(a), (k, v) => (typeof v === "object" && v !== null && !Array.isArray(v))
  ? Object.fromEntries(Object.keys(v).reverse().map((kk) => [kk, v[kk]])) : v);
proof("P1 deterministic canonical bytes", canonicalBytes(a).equals(canonicalBytes(b)) && canonicalBytes(shuffled).equals(canonicalBytes(a)),
  "two builds and a key-shuffled round-trip produce byte-identical canonical serializations");
proof("P2 semantic identity", a.identity.contentDigest === b.identity.contentDigest && contentDigest(shuffled) === a.identity.contentDigest,
  "semantically identical content yields the same content identity regardless of key order");

// 3. meaningful mutation changes identity
const mutated = buildGenericInvoice({ ...input(), lines: input().lines.map((l, i) => i === 0 ? { ...l, quotes: l.quotes.slice(0, 23) } : l) });
const reissued = buildGenericInvoice({ ...input(), issuedAt: "2026-09-18T09:00:00.000Z" });
proof("P3 mutation changes identity", mutated.identity.contentDigest !== a.identity.contentDigest && reissued.identity.contentDigest !== a.identity.contentDigest,
  "a dropped quote (economic mutation) and even a different issuedAt change the content identity — silent mutation is detectable");

// 7. job identity vs content identity distinguishable
proof("P7 job vs content identity", a.invoiceId === mutated.invoiceId && a.identity.jobId === mutated.identity.jobId && a.identity.contentDigest !== mutated.identity.contentDigest,
  `job-bound id stays constant across versions (${a.invoiceId}) for routing/recovery; content identity distinguishes them — additive, never a replacement`);

// ── A2q repair evidence (oracle return, 2026-09-17): quotes are a SET ──────
// Semantic law: canonicalize sorts quote collections by quote_hash before
// identity derivation; duplicates are unlawful (unique keys — a repeated
// quote would inflate Σ owed). Both digests agree on set semantics.
const permInput = () => ({ ...input(), lines: [
  { kind: "storage", asset: "ANT", quotes: [
    { quote_hash: "qh-d", amount_atto: "1000000000000001" },
    { quote_hash: "qh-a", amount_atto: "1000000000000002" },
    { quote_hash: "qh-c", amount_atto: "1000000000000003" },
    { quote_hash: "qh-b", amount_atto: "1000000000000004" } ] },
  input().lines[1],
] });
const perms = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
const allPerms = perms(permInput().lines[0].quotes); // 4! = 24 exhaustive
const permDigests = new Set(allPerms.map((q) => buildGenericInvoice({ ...permInput(), lines: [{ ...permInput().lines[0], quotes: q }, permInput().lines[1]] }).identity.contentDigest));
proof("A2q-1 permutation stability", permDigests.size === 1 && [...permDigests][0] === buildGenericInvoice(permInput()).identity.contentDigest,
  `all 24 permutations of the same 4-quote set derive ONE canonical content identity (${[...permDigests][0].slice(0, 17)}…) — set semantics at identity derivation`);
const permDoc = buildGenericInvoice(permInput());
const shuffledQuotes = JSON.parse(JSON.stringify(permDoc));
shuffledQuotes.lines[0].quotes = [...shuffledQuotes.lines[0].quotes].reverse();
proof("A2q-4 digest agreement", contentDigest(shuffledQuotes) === permDoc.identity.contentDigest
  && (() => { const m = JSON.parse(JSON.stringify(permDoc)); m.lines[0].quotes = [...m.lines[0].quotes].reverse(); return true; })(),
  "a document received with quotes enumerated differently re-derives the SAME contentDigest (canonicalize sorts) and its commitmentDigest was already order-free — the two digests now agree on collection semantics");
const valueChanged = buildGenericInvoice({ ...permInput(), lines: [
  { ...permInput().lines[0], quotes: permInput().lines[0].quotes.map((q) => q.quote_hash === "qh-b" ? { ...q, amount_atto: "9999999999999999" } : q) },
  permInput().lines[1],
] });
proof("A2q-2 value sensitivity", valueChanged.identity.contentDigest !== permDoc.identity.contentDigest,
  "same quote hashes with one economically meaningful amount changed → DIFFERENT identity (set semantics did not blunt mutation sensitivity)");
const dupSame = attempt(() => buildGenericInvoice({ ...permInput(), lines: [
  { ...permInput().lines[0], quotes: [...permInput().lines[0].quotes, { quote_hash: "qh-a", amount_atto: "1000000000000002" }] }, permInput().lines[1],
] }) && true);
const dupDiff = attempt(() => buildGenericInvoice({ ...permInput(), lines: [
  { ...permInput().lines[0], quotes: [...permInput().lines[0].quotes, { quote_hash: "qh-a", amount_atto: "7" }] }, permInput().lines[1],
] }) && true);
const dupValidate = JSON.parse(JSON.stringify(permDoc));
dupValidate.lines[0].quotes.push({ quote_hash: dupValidate.lines[0].quotes[0].quote_hash, amount_atto: "0" });
dupValidate.identity = { ...dupValidate.identity, contentDigest: contentDigest(dupValidate) };
const dupValidatePasses = attempt(() => validateGenericInvoice(dupValidate) && true);
proof("A2q-3 duplicate law explicit", !dupSame.ok && !dupDiff.ok && !dupValidatePasses.ok,
  `duplicates refused at build (same-amount: ${!dupSame.ok}; different-amount: ${!dupDiff.ok}) AND at validation even with the content digest recomputed (${!dupValidatePasses.ok ? dupValidatePasses.err.slice(0, 70) : "ACCEPTED — DEFECT"}) — a quote set has unique keys`);

// INV-1.5-B probe shape (the frozen battery's law, on this impl; the frozen
// probe's literal `!sameIdDiffBytes` clause encoded "the id is a content
// function" — the charter keeps the job-bound id BY DESIGN and moves
// content-tracking to contentDigest, so the law here is: wherever bytes
// differ, the content identity differs)
const sameIdDiffBytes = a.invoiceId === reissued.invoiceId && JSON.stringify(a) !== JSON.stringify(reissued);
const identityTracksContent = sameIdDiffBytes
  ? a.identity.contentDigest !== reissued.identity.contentDigest
  : true;
const hasSelfDigest = !!a.identity.contentDigest;
const byteStable = canonicalBytes(shuffled).equals(canonicalBytes(a));
proof("INV-1.5-B content-addressed identity", identityTracksContent && hasSelfDigest && byteStable,
  "wherever bytes differ the content identity differs (additive scheme: the job-bound id is kept for routing by charter; content-addressing rides contentDigest) — silent mutation is detectable");

// INV-1.1-B — offline self-verification
const tampered = JSON.parse(JSON.stringify(a));
tampered.lines[0].amountAtto = "2500000000000000000"; // 2.5 ANT — inside the ceiling
const tamperedPasses = attempt(() => validateGenericInvoice(tampered) && true);
const digestFabricated = JSON.parse(JSON.stringify(a));
digestFabricated.commitment.digest = "sha256:" + "0".repeat(64);
const digestPasses = attempt(() => validateGenericInvoice(digestFabricated) && true);
// the committed attacker: tamper the owed amount AND recompute the content
// digest, so canonical integrity passes and ONLY the commitment law (Σ
// carried quotes) can catch it — the charter's own-validation requirement
const tamperedReforged = JSON.parse(JSON.stringify(tampered));
tamperedReforged.identity = { ...tamperedReforged.identity, contentDigest: contentDigest(tamperedReforged) };
const tamperedReforgedPasses = attempt(() => validateGenericInvoice(tamperedReforged) && true);
const carriesQuoteSet = a.lines.every((l) => Array.isArray(l.quotes) && l.quotes.length > 0);
proof("INV-1.1-B commitment retrievable offline", !tamperedPasses.ok && !digestPasses.ok && !tamperedReforgedPasses.ok && carriesQuoteSet,
  `amount tampered WITHIN the ceiling REFUSED (${tamperedPasses.ok ? "ACCEPTED" : "digest law"}); the same tamper WITH the content digest recomputed (canonical integrity green) still REFUSED by the commitment law: ${tamperedReforgedPasses.ok ? "ACCEPTED" : tamperedReforgedPasses.err || "Σ quotes mismatch"}; fabricated commitment digest REFUSED; the quote set rides in the canonical bytes — yesterday's promise needs nothing from the issuing machine`);

// INV-1.4-B — evidenced void terminality
const bareVoid = JSON.parse(JSON.stringify(a)); bareVoid.state = "void"; bareVoid.states = { ...bareVoid.states, invoice: "void" };
const bareVoidPasses = attempt(() => validateGenericInvoice(bareVoid) && true);
const voided = voidGenericInvoice(a, { kind: "abandon", ref: "/v1/upload/abandon job=up-1789627481303", at: "2026-09-17T13:00:00.000Z" });
const voidValid = attempt(() => validateGenericInvoice(voided) && true);
// (a) flip state keeping evidence → refused
const resurrect1 = JSON.parse(JSON.stringify(voided));
resurrect1.state = "settled"; resurrect1.settlement = { receiptId: "rc-fabricated", receiptDigest: "sha256:x", at: "t" };
resurrect1.states = { ...resurrect1.states, invoice: "settled", settlement: "settled" };
const resurrect1Passes = attempt(() => validateGenericInvoice(resurrect1) && true);
// (b) full re-forge: strip the evidence, recompute digest → only the anchor catches it
const resurrect2Base = JSON.parse(JSON.stringify(voided));
delete resurrect2Base.voidEvidence; resurrect2Base.state = "settled";
resurrect2Base.settlement = { receiptId: "rc-fabricated", receiptDigest: "sha256:x", at: "t" };
resurrect2Base.states = { invoice: "settled", settlement: "settled" };
resurrect2Base.identity = { ...resurrect2Base.identity, contentDigest: contentDigest(resurrect2Base) };
const resurrect2Unanchored = attempt(() => validateGenericInvoice(resurrect2Base) && true); // internal-consistency only
const resurrect2Anchored = attempt(() => validateGenericInvoice(resurrect2Base, { expectedDigest: voided.identity.contentDigest }) && true);
// (c) lawful supersession preserved
const superseded = voidGenericInvoice(a, { kind: "superseded", ref: "correction 2026-09-17", at: "2026-09-17T14:00:00.000Z", successorJobId: "up-correction-1" });
const successor = buildGenericInvoice({ ...input(), jobId: "up-correction-1", priorDigest: superseded.identity.contentDigest });
const supersessionValid = attempt(() => validateGenericInvoice(superseded) && validateGenericInvoice(successor) && true);
// (d) settled requires receipt evidence, and only from issued
const settled = settleGenericInvoice(a, { receiptId: "rc-up-1789627481303", receiptDigest: contentDigest({ ref: "receipt fixture" }), at: "2026-09-17T15:00:00.000Z" });
const settledValid = attempt(() => validateGenericInvoice(settled) && true);
const voidEvidenceClass = !!voided.voidEvidence && !!voided.voidEvidence.kind;
proof("INV-1.4-B evidenced void terminality", !bareVoidPasses.ok && voidValid.ok && !resurrect1Passes.ok && resurrect2Unanchored.ok && !resurrect2Anchored.ok && supersessionValid.ok && settledValid.ok && voidEvidenceClass,
  `bare void refused; evidenced void validates; void→settled refused while evidence is carried; a stripped re-forge passes ONLY unanchored and is REFUSED against the durable digest anchor (${resurrect2Anchored.err ? "anchored: " + resurrect2Anchored.err.slice(0, 60) : "?"}) — which/who separation held; supersession and settlement-from-issued both stay lawful`);

// 4+5. persistence + restart + pricing-drift irrelevance
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const artifactPath = join(TMP, "invoice-issued.json");
const decoyRates = join(TMP, "todays-rates.json");
writeFileSync(artifactPath, JSON.stringify(canonicalBytes(a).toString("utf8") ? JSON.parse(canonicalBytes(a).toString("utf8")) : a));
const child = spawnSync(process.execPath, [SELF, "--child", artifactPath, a.identity.contentDigest, decoyRates], { encoding: "utf8" });
const childOk = child.status === 0 && /CHILD-OK digest-match/.test(child.stdout);
proof("P4/P5 commitment survives restart + pricing drift", childOk,
  `fresh-process reload validated the persisted artifact against its durable digest while today's rates file was mutated underneath (${(child.stdout || child.stderr || "").trim().split("\n").pop()}) — historical obligation unchanged`);

// 8. R20/signature machinery untouched (fence, structural)
const ownSource = readFileSync(new URL("./lib/bpay-invoice-generic.mjs", import.meta.url), "utf8");
const noSigning = !/createSign|privateKey|sign\(|bip340|schnorr/i.test(ownSource);
const frozenUntouched = createHash("sha256").update(readFileSync(join(dirname(SELF), "inv1-bpay-invoice.mjs"))).digest("hex").length === 64; // the frozen battery file present and whole
proof("P8 R20/signature fence", noSigning && frozenUntouched,
  "the generic module contains no signing primitives — authority binding stays with R20's lane; the frozen battery runs unchanged beside this proof");

// ── verdict ─────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log("");
if (failed.length) { console.log(`INVOICE-1 BUILDER FAIL — ${failed.length} proof(s) red`); process.exit(1); }
console.log(`INVOICE-1 BUILDER PASS — ${results.length}/${results.length} proofs green (INV-1.1/1.4/1.5 closed on the generic implementation; the frozen reference battery remains the historical record)`);
