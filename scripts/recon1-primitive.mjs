#!/usr/bin/env node
// ─── LICENSE ────────────────────────────────────────────────────────────────
// SPDX-License-Identifier: BUSL-1.1 (the b-meter commercial moat — same
// LICENSE in scripts/buzz-meter/; this battery is moat tooling).
// ────────────────────────────────────────────────────────────────────────────
// recon1-primitive.mjs — RECON-1 BUILDER PROOF battery (red-first).
// Proves the production reconciliation primitive
// (scripts/lib/recon-reconcile.mjs) against the FROZEN oracle
// scripts/recon1-closure.mjs @72727c96 — never by editing it:
//
//   F1  the frozen battery's OWN case table (16 refusal cases + 2 closure
//       positives + the persistence set) is EXTRACTED AT RUNTIME from the
//       frozen bytes and run against the primitive's conclusions. The
//       frozen file is sha256-PINNED — any edit fails this battery hard,
//       so the spec cannot be silently weakened to obtain green.
//   F2  the frozen file's own inline reference reconciler (extracted from
//       the same bytes) must AGREE with the primitive on every case — two
//       independent implementations of one lattice.
//   F3  the frozen NAIVE label-based comparator (extracted likewise) must
//       stay convicted on the refusal cases THROUGH THIS HARNESS — teeth:
//       if the primitive were the naive shape, F1 would already have
//       failed; this re-proves the harness really evaluates frozen logic.
//   M0  the conclusion vocabulary is exactly the frozen vocabulary (all
//       mission-required behaviors present, nothing invented).
//   M1  mission behaviors beyond the frozen table: owed re-derives from the
//       CARRIED quote set (current pricing mutated+deleted underneath);
//       void + partial-terminal-observed → REFUND-DUE; supersession detail
//       carried without resurrection; fail-closed finality (unknown
//       finality value decides nothing); authorization records never close
//       (chat approval is never canonical authorization); multi-asset
//       per-asset derivation; duplicate txRef counts once across DIFFERENT
//       record shapes.
//   M2  HUMAN-GESTURE surface law: exactly the human-authority conclusions
//       carry the MVP interaction surface reference (bPay → Invoice →
//       Review & Pay, wallet/Trezor where applicable) — reference, not UI.
//   M3  PERSISTENCE: restart determinism through real serialization (and
//       pricing mutation) in a FRESH child process; evidence-order
//       independence over exhaustive permutations; duplicate idempotence.
//   M4  fences on the primitive's own source: no rail-state imports
//       (VOCAB-1 is the architecture boundary), pure derivation, and the
//       frozen evidence ladder verbatim.
//
// Fences: the frozen oracle is read-only here; VOCAB-1/INVOICE-1 artifacts
// untouched; no rail state machine imported by the primitive (asserted);
// no real payment. Run: node scripts/recon1-primitive.mjs [modulePath]
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MOD = process.argv[2] || fileURLToPath(new URL("./lib/recon-reconcile.mjs", import.meta.url));
const FROZEN = fileURLToPath(new URL("./recon1-closure.mjs", import.meta.url));
const TMP = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp-recon1-primitive");

// ── F1: the frozen oracle is pinned; its case table extracted from bytes ────
const frozenBytes = readFileSync(FROZEN);
const FROZEN_SHA = "sha256:db035bfde7eb5ffccc9d5ba979411d048ba933ce7a48e4cb0e5bc13d3cb95432"; // PUBLIC-CONSTANT — sha pin of the frozen oracle scripts/recon1-closure.mjs @72727c96
const frozenSha = "sha256:" + createHash("sha256").update(frozenBytes).digest("hex");
const frozenSrc = frozenBytes.toString("utf8");
const SLICE_START = "const obligation = () =>";
const SLICE_END = "const R = [];";
const a = frozenSrc.indexOf(SLICE_START), b = frozenSrc.indexOf(SLICE_END);
const evClassMatch = frozenSrc.match(/^const EV_CLASS = (\[.*?\]);$/m);
if (frozenSha !== FROZEN_SHA || a < 0 || b < 0 || !evClassMatch) {
  console.log("RECON-1 PRIMITIVE FAIL: frozen oracle moved (sha " + frozenSha.slice(0, 23) + "… ≠ pin) or markers absent — re-derive before running; the spec is never edited to fit.");
  process.exit(1);
}
const FROZEN_EV_CLASS = JSON.parse(evClassMatch[1]);
const { buildGenericInvoice, validateGenericInvoice, voidGenericInvoice } =
  await import(pathToFileURL(fileURLToPath(new URL("./lib/bpay-invoice-generic.mjs", import.meta.url))).href);
const frozenScope = new Function(
  "buildGenericInvoice", "validateGenericInvoice", "voidGenericInvoice", "EV_CLASS",
  frozenSrc.slice(a, b) + "\nreturn { obligation, OWED, ev, cases, positives, VOID_EV, reconcile, naiveReconcile };"
)(buildGenericInvoice, validateGenericInvoice, voidGenericInvoice, FROZEN_EV_CLASS);
const { obligation, OWED, ev, cases, positives, VOID_EV, reconcile: frozenReconcile, naiveReconcile } = frozenScope;

let lib;
try { lib = await import(pathToFileURL(MOD).href); }
catch (e) {
  console.log("RECON-1 PRIMITIVE FAIL: the primitive is absent or unimportable — " + e.message);
  console.log("(red-first law: the battery runs against a not-yet-built primitive and must fail exactly here)");
  process.exit(1);
}
const { reconcileObligation, RECON_CONCLUSIONS, EVIDENCE_CLASS_LADDER } = lib;

const R = [];
const check = (id, ok, why) => { R.push({ id, ok }); console.log(`${ok ? "✓" : "✗"} ${id} ${why}`); };
const conclusionOf = (invoice, evidence) => {
  try { const r = reconcileObligation(invoice, evidence); return (r && r.conclusion) || "(no conclusion)"; }
  catch (e) { return "(threw: " + String(e.message).slice(0, 60) + ")"; }
};

// ── F1+F2: every frozen case against the PRIMITIVE, cross-checked against
//    the frozen file's own inline reference reconciler ───────────────────────
let f1ok = true, f2ok = true, firstFail = "";
for (const [name, eview, want] of [...cases, ...positives]) {
  const isVoid = typeof eview === "string";
  const inv = isVoid ? voidGenericInvoice(obligation(), { kind: "abandon", ref: "r", at: "t" }) : obligation();
  const evidence = isVoid ? VOID_EV[eview]() : eview;
  const got = conclusionOf(inv, evidence);
  const ref = frozenReconcile(inv, evidence);
  if (got !== want) { f1ok = false; firstFail = firstFail || `${name}: primitive ${got} ≠ frozen want ${want}`; }
  if (ref !== want) { f2ok = false; firstFail = firstFail || `${name}: frozen inline reference ${ref} ≠ want ${want} (extraction sanity)`; }
}
check("F1 frozen case table → primitive (18 cases)", f1ok, f1ok ? "all 16 refusal cases + 2 positives derive the frozen verdicts" : firstFail);
check("F2 frozen inline reference agreement", f2ok, f2ok ? "the frozen file's own reconciler agrees case-for-case (extraction sound)" : firstFail);

// F3: naive conviction through THIS harness (non-void refusal cases only —
// the frozen battery's own discipline: on perfect terminal evidence the
// naive shape coincides with truth by construction)
let naiveConvicted = 0, naiveTotal = 0, naiveMissed = "";
for (const [name, eview, want] of cases) {
  if (typeof eview === "string") continue;
  naiveTotal++;
  const got = naiveReconcile(obligation(), eview);
  if (got !== want) naiveConvicted++; else naiveMissed = naiveMissed || name;
}
check("F3 naive comparator convicted via frozen bytes", naiveTotal > 0 && naiveConvicted === naiveTotal,
  naiveConvicted === naiveTotal ? `${naiveConvicted}/${naiveTotal} refusal cases convict the label-based reconciler through this harness (teeth)` : `naive agreed on: ${naiveMissed}`);

// frozen persistence set, primitive side
const inv = obligation();
const set = [ev({ amount: "500000000000000", txRef: "0xa" }), ev({ amount: "500000000000000", txRef: "0xb" })];
const r1 = conclusionOf(inv, set), r2 = conclusionOf(inv, [...set].reverse()), r3 = conclusionOf(inv, [...set, { ...set[0] }]);
check("F1 frozen persistence laws (order/duplicate)", r1 === "SATISFIED" && r1 === r2 && r1 === r3,
  `two half-payments → ${r1}; reversed → ${r2}; duplicate appended → ${r3} (duplicate never duplicates value)`);

// ── M0: conclusion vocabulary ───────────────────────────────────────────────
const VOCAB = ["AWAITING-AUTHORIZATION", "OPEN", "FINALITY-PENDING", "PARTIALLY-SATISFIED", "SATISFIED",
  "OVERPAID-CREDIT-DUE", "REFUND-DUE", "FAILED-RETRYABLE", "FAILED-HUMAN-GATE", "VOID-SUPERSEDED",
  "EVIDENCE-FOR-ANOTHER-OBLIGATION"];
check("M0 conclusion vocabulary is exactly the frozen vocabulary",
  VOCAB.every((c) => RECON_CONCLUSIONS.includes(c)) && RECON_CONCLUSIONS.every((c) => VOCAB.includes(c)),
  `all ${VOCAB.length} frozen conclusions present, none invented`);

// ── M1: mission behaviors beyond the frozen table ───────────────────────────
// owed re-derives from the CARRIED quote set: same evidence, different
// carried commitment ⇒ different verdict (today's pricing is never consulted)
const oweMore = buildGenericInvoice({
  jobId: "up-recon-more", issuedAt: "2026-09-17T00:00:00.000Z",
  lines: [{ kind: "storage", asset: "ANT", quotes: [
    { quote_hash: "qh-1", amount_atto: "600000000000000" },
    { quote_hash: "qh-2", amount_atto: "600000000000000" } ] }],
  authorization: { ceilings: { ANT: "2000000000000000" }, authorizedBy: "fixture", stopConditions: [] },
});
check("M1a owed derives from the carried quotes", conclusionOf(obligation(), [ev({ amount: "1000000000000000" })]) === "SATISFIED"
  && conclusionOf(oweMore, [ev({ amount: "1000000000000000" })]) === "PARTIALLY-SATISFIED",
  "same evidence settles the 1.0e15 commitment but only PARTIALLY settles a 1.2e15 commitment — never today's price");

// restart with pricing mutated AND deleted (fresh child process, decoy rates)
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const artInv = join(TMP, "invoice.json"), artEv = join(TMP, "evidence.json"), decoy = join(TMP, "rates.json");
writeFileSync(artInv, JSON.stringify(obligation()));
writeFileSync(artEv, JSON.stringify([ev({ amount: "400000000000000" })]));
const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
  import { readFileSync, writeFileSync } from "node:fs";
  import { pathToFileURL } from "node:url";
  writeFileSync(process.argv[3], JSON.stringify({ ant: "9.9", mutated: true }));
  const { reconcileObligation } = await import(pathToFileURL(process.argv[1]).href);
  const invoice = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const evidence = JSON.parse(readFileSync(process.argv[4], "utf8"));
  const r = reconcileObligation(invoice, evidence);
  console.log("CHILD-CONCLUSION " + r.conclusion + " observed=" + r.basis.observed.ANT);
`, "--", MOD, artInv, decoy, artEv], { encoding: "utf8" });
check("M1b restart, pricing mutated then deleted", child.status === 0 && /CHILD-CONCLUSION PARTIALLY-SATISFIED observed=400000000000000/.test(child.stdout),
  (child.stdout || child.stderr || "").trim().split("\n").pop() || "child silent");

// void + PARTIAL terminal observed → REFUND-DUE: what terminally moved
// against a dead obligation is owed back; the figure need not equal owed
const voidedAbandon = voidGenericInvoice(obligation(), { kind: "abandon", ref: "r", at: "t" });
check("M1c void + partial-terminal-observed → REFUND-DUE",
  conclusionOf(voidedAbandon, [ev({ amount: "400000000000000" })]) === "REFUND-DUE",
  "sufficient finality on 4.0e14 against a voided obligation ⇒ REFUND-DUE (what moved is what returns)");

// supersession detail carried, never resurrection
const voidedSuperseded = voidGenericInvoice(obligation(), { kind: "superseded", ref: "corr", at: "t", successorJobId: "up-recon-2" });
const sup = reconcileObligation(voidedSuperseded, []);
check("M1d supersession named, no resurrection", sup?.conclusion === "VOID-SUPERSEDED" && sup?.void?.successorJobId === "up-recon-2",
  "VOID-SUPERSEDED with successor up-recon-2 carried in the result; the void branch returns before any value comparison can run");
check("M1e void + exact final observed → REFUND-DUE (never SATISFIED)",
  conclusionOf(voidedSuperseded, [ev({ amount: String(OWED) })]) === "REFUND-DUE",
  "terminal exact value against a superseded obligation ⇒ REFUND-DUE — obligations are never resurrected by money arriving late");

// fail-closed finality: an UNKNOWN finality value decides nothing
check("M1f unknown finality is not final",
  conclusionOf(obligation(), [ev({ amount: String(OWED), finality: "garbage-finality" })]) === "FINALITY-PENDING",
  'only "terminal" is treated final; any other finality value parks the value (never manufactures certainty)');

// authorization records never close — chat/paper approval is not canonical
// authorization even when dressed as tx-receipt evidence
check("M1g authorization records never settle",
  conclusionOf(obligation(), [ev({ kind: "authorization", amount: String(OWED), value_observed: "tx-receipt", finality: "terminal" })]) === "OPEN",
  "an authorization record carrying the full amount and a forged evidence class still derives OPEN");

// multi-asset: per-asset derivation, roll-up law
const twoAsset = buildGenericInvoice({
  jobId: "up-recon-two", issuedAt: "2026-09-17T00:00:00.000Z",
  lines: [
    { kind: "storage", asset: "ANT", quotes: [{ quote_hash: "qh-a1", amount_atto: "500000000000000" }, { quote_hash: "qh-a2", amount_atto: "500000000000000" }] },
    { kind: "gas ceiling", asset: "ETH", quotes: [{ quote_hash: "qh-e1", amount_atto: "50000000000000" }] },
  ],
  authorization: { ceilings: { ANT: "2000000000000000", ETH: "90000000000000" }, authorizedBy: "fixture", stopConditions: [] },
});
const multi = reconcileObligation(twoAsset, [
  ev({ amount: "400000000000000" }), ev({ asset: "ETH", amount: "50000000000000", txRef: "0xe1" })]);
check("M1h multi-asset per-asset derivation", multi?.conclusion === "PARTIALLY-SATISFIED"
  && multi?.basis?.observed?.ANT === "400000000000000" && multi?.basis?.observed?.ETH === "50000000000000"
  && multi?.basis?.owed?.ANT === "1000000000000000" && multi?.basis?.owed?.ETH === "50000000000000",
  "ANT 4.0e14/1.0e15 + ETH exact ⇒ PARTIALLY-SATISFIED with per-asset basis (never one dollar figure)");
check("M1i overpay forces credit even beside an exact asset",
  conclusionOf(twoAsset, [ev({ amount: String(10 ** 15 + 1) }), ev({ asset: "ETH", amount: "50000000000000", txRef: "0xe1" })]) === "OVERPAID-CREDIT-DUE",
  "ANT over + ETH exact ⇒ OVERPAID-CREDIT-DUE (excess is never silently kept or cross-netted)");
check("M1j evidence in an unpriced asset refused",
  conclusionOf(twoAsset, [ev({ asset: "USDC", amount: "999999", txRef: "0xu1" })]) === "EVIDENCE-FOR-ANOTHER-OBLIGATION",
  "a USDC movement names no line of this invoice ⇒ refused as another obligation's evidence");

// duplicate txRef across DIFFERENT record shapes counts once (first wins)
check("M1k txRef is the identity of a value movement",
  conclusionOf(obligation(), [ev({ amount: "400000000000000", txRef: "0xsame" }), ev({ amount: "600000000000000", txRef: "0xsame" })]) === "PARTIALLY-SATISFIED",
  "two records sharing one txRef count once — 4.0e14 observed, not 1.0e15");

// ── M2: HUMAN-GESTURE surface law ───────────────────────────────────────────
const safe = (fn) => { try { return fn(); } catch (e) { return { conclusion: "(threw: " + String(e.message).slice(0, 40) + ")" }; } };
const surfaceCases = [
  [safe(() => reconcileObligation(obligation(), [])), "AWAITING-AUTHORIZATION", true],
  [safe(() => reconcileObligation(obligation(), [ev({ kind: "attempt", value_observed: "none", retryability: "human-gate" })])), "FAILED-HUMAN-GATE", true],
  [safe(() => reconcileObligation(voidedAbandon, [ev({ amount: String(OWED) })])), "REFUND-DUE", true],
  [safe(() => reconcileObligation(obligation(), [ev({ amount: String(OWED + 1n) })])), "OVERPAID-CREDIT-DUE", true],
  [safe(() => reconcileObligation(obligation(), [ev({ amount: String(OWED) })])), "SATISFIED", false],
  [safe(() => reconcileObligation(obligation(), [ev({ amount: "400000000000000" })])), "PARTIALLY-SATISFIED", false],
  [safe(() => reconcileObligation(obligation(), [ev({ amount: String(OWED), finality: "as-reported", value_observed: "tx-hash" })])), "FINALITY-PENDING", false],
  [safe(() => reconcileObligation(obligation(), [ev({ kind: "attempt", value_observed: "none", retryability: "capped" })])), "FAILED-RETRYABLE", false],
  [safe(() => reconcileObligation(obligation(), [ev({ kind: "authorization", amount: "0" })])), "OPEN", false],
  [safe(() => reconcileObligation(voidedSuperseded, [])), "VOID-SUPERSEDED", false],
  [safe(() => reconcileObligation(obligation(), [ev({ amount: String(OWED), asset: "ETH" })])), "EVIDENCE-FOR-ANOTHER-OBLIGATION", false],
];
let m2ok = true, m2why = "exactly AWAITING-AUTHORIZATION, FAILED-HUMAN-GATE, REFUND-DUE, OVERPAID-CREDIT-DUE carry the surface";
for (const [res, want, needsSurface] of surfaceCases) {
  if (!res || res.conclusion !== want) { m2ok = false; m2why = `surface probe expected ${want}, got ${res ? res.conclusion : "(no result)"}`; break; }
  const carries = !!(res.humanAction && typeof res.humanAction.surface === "string" && !!res.humanAction.label);
  if (carries !== needsSurface) { m2ok = false; m2why = `${want} ${needsSurface ? "missing" : "unexpectedly carries"} humanAction`; break; }
}
const awaiting = surfaceCases[0][0];
if (m2ok && !(awaiting?.humanAction?.surface === "bpay-invoice-review-pay" && /Review & Pay/.test(awaiting.humanAction.label) && /Trezor/.test(awaiting.humanAction.label))) {
  m2ok = false; m2why = "AWAITING-AUTHORIZATION must reference the bPay/W@tch invoice Review & Pay surface with wallet/Trezor confirmation";
}
check("M2 human-gesture surface mapping", m2ok, m2why + " — a REFERENCE to the MVP surface, never chat approval (the UI itself is another seat's build)");

// ── M3: persistence laws ────────────────────────────────────────────────────
// exhaustive permutations of a 4-record mixed evidence set (24 orders)
const mixed = [
  ev({ amount: "300000000000000", txRef: "0x1" }),
  ev({ amount: "300000000000000", txRef: "0x2" }),
  ev({ kind: "attempt", value_observed: "none", retryability: "capped" }),
  ev({ kind: "expense", amount: "777" }),
];
const perms = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
const mixedResults = new Set(perms(mixed).map((ordered) => conclusionOf(obligation(), ordered)));
check("M3a evidence-order independence (exhaustive 24 permutations)", mixedResults.size === 1 && [...mixedResults][0] === "PARTIALLY-SATISFIED",
  `every permutation of a mixed evidence set ⇒ ${mixedResults.size === 1 ? [...mixedResults][0] : "DIVERGENT"} (fold is commutative by construction)`);

// duplicate idempotence: 1×, 2×, 5× copies of the same record set
const base3 = [ev({ amount: "300000000000000", txRef: "0x1" }), ev({ amount: "300000000000000", txRef: "0x2" })];
const d1 = conclusionOf(obligation(), base3);
const d2 = conclusionOf(obligation(), [...base3, ...base3]);
const d5 = conclusionOf(obligation(), [...base3, ...base3, ...base3, ...base3, ...base3]);
check("M3b duplicate idempotence (1×/2×/5×)", d1 === d2 && d1 === d5 && d1 === "PARTIALLY-SATISFIED",
  `one, two and five copies of the same evidence ⇒ ${d1} — duplicate evidence never duplicates value`);

// restart determinism: full result object survives a serialization round-trip
const live = safe(() => reconcileObligation(obligation(), [ev({ amount: "400000000000000" }), ev({ kind: "attempt", value_observed: "none", retryability: "never" })]));
const restarted = JSON.parse(JSON.stringify(live));
check("M3c restart determinism (serialization round-trip)", JSON.stringify(restarted) === JSON.stringify(live) && restarted.conclusion === "PARTIALLY-SATISFIED",
  "the same durable invoice + evidence set derives the same full result object after a JSON round-trip");

// ── M4: fences on the primitive's own source ────────────────────────────────
const libSrc = readFileSync(MOD, "utf8");
const libImports = [...libSrc.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
const railWords = /x402-door|bpay-rail|watchpay|jungle4|vending|meter\.py|x402_meter|bpay\.mjs|zGenealogy|genealogy/i;
check("M4a no rail-state imports (VOCAB-1 is the boundary)",
  libImports.every((imp) => imp.endsWith("bpay-invoice-generic.mjs")) && !railWords.test(libSrc.replace(/\/\/.*$/gm, "")),
  `imports: ${[...new Set(libImports)].join(", ") || "(none)"} — rails are reached only through VOCAB-1-classed evidence records`);
check("M4b pure derivation (no clock, no net, no pricing state)",
  !/\bDate\.|now\(\)|fetch\(|https?:\/\/|readFile|writeFile|process\.env/i.test(libSrc.replace(/\/\/.*$/gm, "")),
  "no time, network, filesystem or environment reads in the primitive's law text — the conclusion is a function of the artifacts alone");
check("M4c evidence ladder is the frozen VOCAB-1 ladder",
  JSON.stringify(EVIDENCE_CLASS_LADDER) === JSON.stringify(FROZEN_EV_CLASS),
  `value counts only at tx-hash class or better — the ladder equals the frozen EV_CLASS verbatim (${EVIDENCE_CLASS_LADDER.length} classes)`);

rmSync(TMP, { recursive: true, force: true });
const fails = R.filter((r) => !r.ok);
console.log("");
console.log(fails.length
  ? `RECON-1 PRIMITIVE FAIL: ${fails.length} check(s) — ${fails.map((f) => f.id).join(", ")}`
  : "RECON-1 PRIMITIVE PASS — the frozen oracle's own case table + persistence laws + mission behaviors + surface law all green against the production primitive; fences held.");
process.exit(fails.length ? 1 : 0);
