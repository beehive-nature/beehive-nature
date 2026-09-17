#!/usr/bin/env node
// ─── LICENSE ────────────────────────────────────────────────────────────────
// SPDX-License-Identifier: BUSL-1.1 (the b-meter commercial moat — same
// LICENSE in scripts/buzz-meter/; this verifier is moat tooling).
// ────────────────────────────────────────────────────────────────────────────
// recon1-oracle-verify.mjs — the RECON-1 INDEPENDENT ORACLE VERIFIER
// (economic/oracle seat, 2026-09-17). Written against the mission text and
// the FROZEN oracle bytes ONLY. The builder's proof battery
// (scripts/recon1-primitive.mjs) is NOT imported and its 23/23 is NOT
// evidence here; every expectation below is re-derived from the founder
// mission wording and the frozen case table extracted independently from
// the pinned frozen file. This seat does not repair — it rules.
//
// Usage:
//   node scripts/recon1-oracle-verify.mjs [modulePath]        # verify a primitive
//   node scripts/recon1-oracle-verify.mjs --sabotage-selftest # convict the
//                                        # committed seductive reconciler
//
// PHASES
//   0  static fences + frozen-oracle identity (sha pin, own extraction)
//   1  every frozen oracle case reproduced independently (18 + persistence)
//   2  adversarial lattice A1–A10 (finality, class-upgrade, duplicates,
//      ordering, restart, void/supersession, overpay, multi-asset, human
//      gesture, rail-native certainty)
//   3  sabotage control (selftest mode): the committed seductive
//      reconciler must be convicted on the five named seductions
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SABOTAGE = process.argv.includes("--sabotage-selftest");
const MOD = SABOTAGE
  ? fileURLToPath(new URL("./fixtures/recon1-seductive.mjs", import.meta.url))
  : (process.argv[2] || fileURLToPath(new URL("./lib/recon-reconcile.mjs", import.meta.url)));
const FROZEN = join(HERE, "recon1-closure.mjs");
const TMP = join(HERE, "..", "tmp-recon1-oracle");

// ── PHASE 0: frozen identity + static fences ────────────────────────────────
const frozenBytes = readFileSync(FROZEN);
const FROZEN_SHA = "sha256:db035bfde7eb5ffccc9d5ba979411d048ba933ce7a48e4cb0e5bc13d3cb95432"; // PUBLIC-CONSTANT — sha pin of the frozen oracle scripts/recon1-closure.mjs @72727c96
const frozenSha = "sha256:" + createHash("sha256").update(frozenBytes).digest("hex");
const frozenSrc = frozenBytes.toString("utf8");
const R = [];
const verdict = (id, ok, why) => { R.push({ id, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${why}`); };
if (frozenSha !== FROZEN_SHA) {
  console.log("ORACLE ABORT: frozen oracle bytes moved (" + frozenSha.slice(0, 23) + "… ≠ pin) — the spec itself changed; re-derive this verifier before ruling.");
  process.exit(1);
}
verdict("0a frozen oracle byte identity", true, "sha256 " + frozenSha.slice(7, 23) + "… = pin @72727c96");

const modSrc = readFileSync(MOD, "utf8");
const modImports = [...modSrc.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
const RAIL_IMPORT = /x402|bpay-rail|watchpay|jungle|vending|meter|x402_meter|bpay\.mjs|genealogy|zGenealogy/i;
const NET_OR_MONEY = /\bfetch\s*\(|https?:\/\/|createSign|privateKey|generateKey|mnemonic|\bseed\b|schnorr|ecdsa|secp|process\.env|Date\.|Math\.random|readFileSync|writeFileSync|child_process|spawn|require\(|\bnet\b|\btls\b|WebSocket/i;
verdict("0b no rail-native state-machine imports", modImports.every((i) => i.endsWith("bpay-invoice-generic.mjs")) && !RAIL_IMPORT.test(modSrc.replace(/\/\/.*$/gm, "")),
  `imports: ${[...new Set(modImports)].join(", ") || "(none)"}`);
verdict("0c no payment/signing/network behavior", !NET_OR_MONEY.test(modSrc.replace(/\/\/.*$/gm, "")),
  "no network, signing, key, clock, env or fs tokens in the module's law text");

// ── frozen case table — THIS SEAT'S OWN EXTRACTION from the pinned bytes ────
const evClassSrc = frozenSrc.match(/^const EV_CLASS = (\[.*?\]);$/m);
const sliceFrom = frozenSrc.indexOf("const obligation = () =>");
const sliceTo = frozenSrc.indexOf("const R = [];");
if (!evClassSrc || sliceFrom < 0 || sliceTo < 0) { console.log("ORACLE ABORT: extraction markers absent"); process.exit(1); }
const FROZEN_EV_CLASS = JSON.parse(evClassSrc[1]);
const { buildGenericInvoice, validateGenericInvoice, voidGenericInvoice, settleGenericInvoice } =
  await import(pathToFileURL(join(HERE, "lib/bpay-invoice-generic.mjs")).href);
const F = new Function("buildGenericInvoice", "validateGenericInvoice", "voidGenericInvoice", "EV_CLASS",
  frozenSrc.slice(sliceFrom, sliceTo) + "\nreturn { obligation, OWED, ev, cases, positives, VOID_EV, reconcile, naiveReconcile };"
)(buildGenericInvoice, validateGenericInvoice, voidGenericInvoice, FROZEN_EV_CLASS);
const { obligation, OWED, ev, cases, positives, VOID_EV, reconcile: frozenRef } = F;

let lib;
try { lib = await import(pathToFileURL(MOD).href); }
catch (e) { console.log("ORACLE FAIL: module under test unimportable — " + e.message); process.exit(1); }
const { reconcileObligation, RECON_CONCLUSIONS, EVIDENCE_CLASS_LADDER } = lib;
const C = (invoice, evidence) => {
  try { const r = reconcileObligation(invoice, evidence); return (r && r.conclusion) || "(no conclusion)"; }
  catch (e) { return "(threw)"; }
};
const run = (invoice, evidence) => {
  try { return reconcileObligation(invoice, evidence) || null; }
  catch (e) { return { conclusion: "(threw)", humanAction: null, basis: null }; }
};

// ── PHASE 1: every frozen case reproduced independently ─────────────────────
let p1ok = true, p1why = "all frozen verdicts reproduced";
for (const [name, eview, want] of [...cases, ...positives]) {
  const isVoid = typeof eview === "string";
  const inv = isVoid ? voidGenericInvoice(obligation(), { kind: "abandon", ref: "r", at: "t" }) : obligation();
  const evidence = isVoid ? VOID_EV[eview]() : eview;
  const got = C(inv, evidence);
  const ref = frozenRef(inv, evidence);
  if (got !== want || ref !== want) { p1ok = false; p1why = `${name}: got ${got}, frozen-ref ${ref}, want ${want}`; break; }
}
verdict("1 frozen case table reproduced (18 cases, own extraction + frozen-ref cross-check)", p1ok, p1why);
{
  const inv = obligation();
  const halves = [ev({ amount: "500000000000000", txRef: "0xa" }), ev({ amount: "500000000000000", txRef: "0xb" })];
  const a = C(inv, halves), b = C(inv, [...halves].reverse()), c = C(inv, [...halves, { ...halves[0] }]);
  verdict("1b frozen persistence set (order + duplicate)", a === "SATISFIED" && a === b && a === c, `halves → ${a}/${b}/${c}`);
}

// ── PHASE 2: adversarial lattice (expectations derived from the mission) ────
const VOID = () => voidGenericInvoice(obligation(), { kind: "abandon", ref: "r", at: "t" });

// A1 — unknown/unrecognized finality must fail closed, and FINALITY-PENDING
// is the CORRECT generic result for value-bearing records (OPEN would deny
// the observation; refusing would manufacture absence). Zero-value records
// decide nothing either way.
{
  const weird = ["garbage", "none", undefined, "Terminal", "terminal ", 42];
  let ok = weird.every((f) => C(obligation(), [ev({ amount: String(OWED), finality: f })]) === "FINALITY-PENDING");
  const zero = C(obligation(), [ev({ amount: "0", finality: "garbage" })]);
  verdict("A1 unrecognized finality fails closed → FINALITY-PENDING", ok && zero === "OPEN",
    ok ? `value observed under {${weird.map(String).join(", ")}} parks; zero-value weird-finality → ${zero} (nothing observed, nothing pending)` : "an unrecognized finality value decided something");
}
// A2 — evidence-class upgrading: no dressing makes weak kinds into settlement
{
  const dresses = [
    ["instruction", ev({ kind: "instruction", amount: String(OWED), value_observed: "tx-receipt", finality: "terminal" })],
    ["authorization", ev({ kind: "authorization", amount: String(OWED), value_observed: "tx-receipt", finality: "terminal" })],
    ["attempt", ev({ kind: "attempt", amount: String(OWED), value_observed: "tx-receipt", finality: "terminal" })],
    ["expense", ev({ kind: "expense", amount: String(OWED), value_observed: "tx-receipt", finality: "terminal" })],
    ["self-reported", ev({ amount: String(OWED), value_observed: "self-reported", finality: "terminal" })],
    ["signed-artifact", ev({ amount: String(OWED), value_observed: "signed-artifact", finality: "terminal" })],
    ["novel-class", ev({ amount: String(OWED), value_observed: "oracle-attested", finality: "terminal" })],
    ["notarized-class", ev({ amount: String(OWED), value_observed: "notarized", finality: "terminal" })],
    ["missing-class", ev({ amount: String(OWED), value_observed: undefined, finality: "terminal" })],
  ];
  const bad = dresses.filter(([, e]) => C(obligation(), [e]) !== "OPEN");
  verdict("A2 no normalization upgrades weak evidence to settlement", bad.length === 0,
    bad.length ? `upgraded: ${bad.map(([n]) => n).join(", ")}` : `all ${dresses.length} dressings (kind-dressed, below-ladder, novel, missing) stay OPEN`);
}
// A3 — duplicates never duplicate value (conclusion-arithmetic probes, no
// internal coupling): three copies of a 4e14 movement sharing a txRef count
// 4e14 (PARTIAL — counting all three would read 1.2e15 and force credit);
// a duplicated half plus a DISTINCT half counts 1.0e15 exactly (SATISFIED —
// counting the duplicate's twin would read 1.5e15 and force credit)
{
  const t1 = C(obligation(), Array(3).fill(ev({ amount: "400000000000000", txRef: "0xdup" })));
  const t2 = C(obligation(), [ev({ amount: "500000000000000", txRef: "0xa" }), ev({ amount: "500000000000000", txRef: "0xa" }), ev({ amount: "500000000000000", txRef: "0xb" })]);
  verdict("A3 duplicate evidence cannot duplicate value", t1 === "PARTIALLY-SATISFIED" && t2 === "SATISFIED",
    `triplicated 4e14 → ${t1} (4e14 counted, not 1.2e15); duplicated half + distinct half → ${t2} (1.0e15 counted, not 1.5e15)`);
}
// A4 — evidence ordering: exhaustive permutations of a consistent mixed set
{
  const recs = [
    ev({ amount: "300000000000000", txRef: "0x1" }),
    ev({ amount: "300000000000000", txRef: "0x2" }),
    ev({ kind: "attempt", value_observed: "none", retryability: "capped" }),
    ev({ kind: "expense", amount: "777" }),
  ];
  const perms = (xs) => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
  const outcomes = new Set(perms(recs).map((o) => C(obligation(), o)));
  verdict("A4 evidence-order independence (24 exhaustive permutations)", outcomes.size === 1 && [...outcomes][0] === "PARTIALLY-SATISFIED",
    outcomes.size === 1 ? `every order ⇒ ${[...outcomes][0]}` : `DIVERGENT: ${[...outcomes].join(", ")}`);
}
// A5 — restart: fresh processes, pricing MUTATED then ABSENT, durable anchor
{
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
  const invPath = join(TMP, "invoice.json"), evPath = join(TMP, "evidence.json"), rates = join(TMP, "rates.json");
  writeFileSync(invPath, JSON.stringify(obligation()));
  writeFileSync(evPath, JSON.stringify([ev({ amount: "400000000000000" })]));
  const childCode = `
    import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
    import { pathToFileURL } from "node:url";
    const mode = process.argv[2];
    const lib = await import(pathToFileURL(process.argv[1]).href);
    if (mode === "mutate") writeFileSync(process.argv[3], JSON.stringify({ ant: "9.9", mutated: true }));
    if (mode === "absent" && existsSync(process.argv[3])) unlinkSync(process.argv[3]);
    const invoice = JSON.parse(readFileSync(process.argv[4], "utf8"));
    const evidence = JSON.parse(readFileSync(process.argv[5], "utf8"));
    const r = lib.reconcileObligation(invoice, evidence);
    console.log("CHILD " + r.conclusion + " " + JSON.stringify(r.basis && r.basis.observed));
  `;
  const mk = (mode) => spawnSync(process.execPath, ["--input-type=module", "-e", childCode, "--", MOD, mode, rates, invPath, evPath], { encoding: "utf8" });
  const c1 = mk("mutate"), c2 = mk("absent");
  const ok = c1.status === 0 && c2.status === 0
    && /CHILD PARTIALLY-SATISFIED \{"ANT":"400000000000000"\}/.test(c1.stdout)
    && /CHILD PARTIALLY-SATISFIED \{"ANT":"400000000000000"\}/.test(c2.stdout);
  verdict("A5 restart determinism without mutable pricing", ok,
    ok ? "fresh processes under mutated and absent pricing derive identical results" : `mutate: ${(c1.stdout || c1.stderr || "").trim().slice(0, 80)} | absent: ${(c2.stdout || c2.stderr || "").trim().slice(0, 80)}`);
}
// A6 — void/supersession: weak later movement NEVER manufactures REFUND-DUE;
// sufficiently-final movement against a dead obligation CAN
{
  const weak = [
    ["instruction", [ev({ kind: "instruction", amount: String(OWED), value_observed: "instruction" })]],
    ["authorization", [ev({ kind: "authorization", amount: String(OWED) })]],
    ["attempt", [ev({ kind: "attempt", value_observed: "none", retryability: "never" })]],
    ["expense", [ev({ kind: "expense", amount: String(OWED) })]],
    ["self-reported", [ev({ amount: String(OWED), value_observed: "self-reported", finality: "terminal" })]],
    ["submitted-not-observed", [ev({ kind: "attempt", value_observed: "none", retryability: "never", amount: String(OWED) })]],
  ];
  const manufactured = weak.filter(([, es]) => { const c = C(VOID(), es); return c === "REFUND-DUE" || c === "OVERPAID-CREDIT-DUE"; });
  const pendingLattice = C(VOID(), [ev({ amount: String(OWED), finality: "as-reported", value_observed: "tx-hash" })]) === "FINALITY-PENDING"
    && C(VOID(), [ev({ amount: String(OWED), finality: "reorg-flagged" })]) === "FINALITY-PENDING";
  const refundPartial = C(VOID(), [ev({ amount: "400000000000000" })]) === "REFUND-DUE";
  const refundExact = C(VOID(), [ev({ amount: String(OWED) })]) === "REFUND-DUE";
  const sup = run(voidGenericInvoice(obligation(), { kind: "superseded", ref: "c", at: "t", successorJobId: "up-next" }), []);
  const resurrection = [...weak, ["terminal-partial", [ev({ amount: "400000000000000" })]], ["terminal-exact", [ev({ amount: String(OWED) })]]]
    .some(([, es]) => ["SATISFIED", "PARTIALLY-SATISFIED"].includes(C(VOID(), es)));
  verdict("A6 void/supersession lattice", manufactured.length === 0 && pendingLattice && refundPartial && refundExact && !resurrection
    && sup?.conclusion === "VOID-SUPERSEDED" && sup?.void?.successorJobId === "up-next",
    manufactured.length ? `refund manufactured from: ${manufactured.map(([n]) => n).join(", ")}` : "weak→VOID-SUPERSEDED; pending/reorg→FINALITY-PENDING; terminal partial & exact→REFUND-DUE; successor carried; no resurrection anywhere in the matrix");
  const settledClaim = settleGenericInvoice(obligation(), { receiptId: "rc-1", receiptDigest: "sha256:x", at: "t" });
  const sc = C(settledClaim, []);
  verdict("A6b settled-state claim is not observation evidence", !["SATISFIED", "PARTIALLY-SATISFIED", "OVERPAID-CREDIT-DUE", "REFUND-DUE"].includes(sc),
    `invoice whose own state says settled, with zero observation records → ${sc} (a state claim never closes; only evidence closes)`);
}
// A7 — overpayment: weak/pending excess cannot manufacture CREDIT-DUE
{
  const pend = C(obligation(), [ev({ amount: String(OWED + 1n), finality: "as-reported", value_observed: "tx-hash" })]);
  const reorg = C(obligation(), [ev({ amount: String(OWED + 1n), finality: "reorg-flagged" })]);
  const weird = C(obligation(), [ev({ amount: String(OWED + 1n), finality: "trust-me" })]);
  const fin = C(obligation(), [ev({ amount: String(OWED + 1n) })]);
  const dupded = run(obligation(), [ev({ amount: String(OWED + 1n), txRef: "0xover" }), ev({ amount: String(OWED + 1n), txRef: "0xover" })]);
  verdict("A7 overpayment credit requires final observed excess", pend === "FINALITY-PENDING" && reorg === "FINALITY-PENDING" && weird === "FINALITY-PENDING" && fin === "OVERPAID-CREDIT-DUE"
    && dupded?.conclusion === "OVERPAID-CREDIT-DUE" && dupded?.basis?.observed?.ANT === String(OWED + 1n),
    `pending→${pend}; reorg→${reorg}; unknown→${weird}; terminal→${fin}; duplicated excess counted once (${dupded?.basis?.observed?.ANT})`);
}
// A8 — MULTI-ASSET: per-asset reconciliation, no implicit FX, no
// cross-netting, wrong-asset refused
const TWO = () => buildGenericInvoice({
  jobId: "up-oracle-two", issuedAt: "2026-09-17T00:00:00.000Z",
  lines: [
    { kind: "storage", asset: "ANT", quotes: [{ quote_hash: "qh-a1", amount_atto: "500000000000000" }, { quote_hash: "qh-a2", amount_atto: "500000000000000" }] },
    { kind: "gas ceiling", asset: "ETH", quotes: [{ quote_hash: "qh-e1", amount_atto: "50000000000000" }] },
  ],
  authorization: { ceilings: { ANT: "2000000000000000", ETH: "90000000000000" }, authorizedBy: "oracle fixture", stopConditions: [] },
});
const ETH_ONLY = () => buildGenericInvoice({
  jobId: "up-oracle-eth", issuedAt: "2026-09-17T00:00:00.000Z",
  lines: [{ kind: "gas ceiling", asset: "ETH", quotes: [{ quote_hash: "qh-e1", amount_atto: "50000000000000" }] }],
  authorization: { ceilings: { ETH: "90000000000000" }, authorizedBy: "oracle fixture", stopConditions: [] },
});
const ETH_OWE = "50000000000000";
{
  const a = C(TWO(), [ev({ amount: "1000000000000000" })]);                       // ANT exact, ETH nothing
  const b = run(TWO(), [ev({ amount: "1200000000000000", txRef: "0xover" })]);    // ANT excess, ETH deficient
  const c = C(TWO(), [ev({ asset: "USDC", amount: "999999", txRef: "0xu" })]);    // unpriced asset
  const d = C(ETH_ONLY(), [ev({ amount: "50000000000000", txRef: "0xant" })]);    // ANT value, ETH-only invoice
  const e = C(TWO(), [ev({ amount: "1000000000000000" }), ev({ asset: "ETH", amount: ETH_OWE, txRef: "0xe1" })]); // both exact
  const f = C(TWO(), [ev({ amount: "1000000000000000" }), ev({ asset: "ETH", amount: ETH_OWE, txRef: "0xe1", finality: "as-reported", value_observed: "tx-hash" })]); // ETH pending
  const g = C(TWO(), [ev({ asset: "ant", amount: "1000000000000000", txRef: "0xlower" })]); // asset case-sensitivity
  const h = run(TWO(), [ev({ amount: "400000000000000", txRef: "0xp1" }), ev({ asset: "ETH", amount: ETH_OWE, txRef: "0xe1" })]); // ANT partial + ETH exact
  const crossNet = b && ["SATISFIED", "PARTIALLY-SATISFIED"].includes(b.conclusion) === false && b.conclusion === "OVERPAID-CREDIT-DUE"
    && b.basis && b.basis.observed && b.basis.observed.ANT === "1200000000000000" && b.basis.observed.ETH === "0"
    && b.basis.owed && b.basis.owed.ETH === ETH_OWE;
  verdict("A8a one satisfied asset + one deficient ⇒ never SATISFIED", a === "PARTIALLY-SATISFIED", `ANT exact + ETH nothing → ${a}`);
  verdict("A8b excess ANT cannot satisfy missing ETH (no cross-netting)", !!crossNet,
    b ? `ANT 1.2e15/1.0e15 + ETH 0/5e13 ⇒ ${b.conclusion} with per-asset basis exposing BOTH the excess and the deficiency (credit forced, never netted)` : "no result");
  verdict("A8c wrong-asset evidence refused", c === "EVIDENCE-FOR-ANOTHER-OBLIGATION" && d === "EVIDENCE-FOR-ANOTHER-OBLIGATION" && g === "EVIDENCE-FOR-ANOTHER-OBLIGATION",
    `USDC→${c}; ANT-value-on-ETH-only→${d}; lowercase-ant→${g} (no implicit FX anywhere)`);
  verdict("A8d both exact ⇒ SATISFIED; per-asset partial visible", e === "SATISFIED" && h?.conclusion === "PARTIALLY-SATISFIED"
    && h?.basis?.observed?.ANT === "400000000000000" && h?.basis?.observed?.ETH === ETH_OWE,
    `exact pair→${e}; ANT 4e14 + ETH exact→${h?.conclusion} with per-asset figures`);
  verdict("A8e any asset's unfinalized value parks exact closure", f === "FINALITY-PENDING", `ANT terminal + ETH as-reported → ${f}`);
}
// A9 — HUMAN GESTURE: intent ≠ authorization; surface reference ≠ readiness
{
  const probes = [
    [[], "AWAITING-AUTHORIZATION", true],
    [[ev({ kind: "attempt", value_observed: "none", retryability: "human-gate" })], "FAILED-HUMAN-GATE", true],
    [[ev({ amount: String(OWED) })], "SATISFIED", false],
    [[ev({ amount: "400000000000000" })], "PARTIALLY-SATISFIED", false],
    [[ev({ amount: String(OWED), finality: "as-reported", value_observed: "tx-hash" })], "FINALITY-PENDING", false],
    [[ev({ kind: "attempt", value_observed: "none", retryability: "capped" })], "FAILED-RETRYABLE", false],
    [[ev({ kind: "authorization", amount: "0" })], "OPEN", false],
    [[ev({ amount: String(OWED), asset: "ETH" })], "EVIDENCE-FOR-ANOTHER-OBLIGATION", false],
  ];
  let surfaceOk = true, surfaceWhy = "exactly the human-authority conclusions carry a surface reference";
  for (const [es, want, needs] of probes) {
    const r = run(obligation(), es);
    if (!r || r.conclusion !== want) { surfaceOk = false; surfaceWhy = `probe ${want} → ${r?.conclusion}`; break; }
    const carries = !!(r.humanAction && r.humanAction.surface && r.humanAction.label);
    if (carries !== needs) { surfaceOk = false; surfaceWhy = `${want} ${needs ? "missing" : "unexpectedly carries"} humanAction`; break; }
  }
  const refundR = run(VOID(), [ev({ amount: String(OWED) })]);
  const overR = run(obligation(), [ev({ amount: String(OWED + 1n) })]);
  const awaiting = run(obligation(), []);
  const noAuthorizedVerb = RECON_CONCLUSIONS.includes("AWAITING-AUTHORIZATION")
    && RECON_CONCLUSIONS.every((c) => !/^(AUTHORIZED|APPROVED|CONFIRMED)/i.test(c));
  const noReadiness = [awaiting?.humanAction, refundR?.humanAction, overR?.humanAction].every((h) => h && !/ready|live|available|routed|exists/i.test(h.surface + " " + h.label) && !/[:/]/.test(h.surface));
  const namesSurface = awaiting?.humanAction?.surface === "bpay-invoice-review-pay" && /Review & Pay/.test(awaiting.humanAction.label) && /Trezor/.test(awaiting.humanAction.label);
  // SURFACE_MISSING projection: independently scan the tree for an actual
  // Review & Pay UI route. None exists today; the day one appears, this
  // check FAILS and forces a SURFACE_READY re-ruling with live exercise.
  const surfacesDir = join(HERE, "..", "surfaces");
  const htmlFiles = existsSync(surfacesDir) ? readdirSync(surfacesDir).filter((f) => f.endsWith(".html")) : [];
  const routeFound = htmlFiles.some((f) => /Review & Pay|review-pay|bpay-invoice-review-pay/i.test(readFileSync(join(surfacesDir, f), "utf8")));
  verdict("A9a authorization records cannot masquerade as settlement", C(obligation(), [ev({ kind: "authorization", amount: String(OWED), value_observed: "tx-receipt", finality: "terminal" })]) === "OPEN",
    "full-amount authorization dressed as tx-receipt terminal evidence still derives OPEN — chat/paper intent is never canonical authorization");
  verdict("A9b no affirmative AUTHORIZED conclusion exists", noAuthorizedVerb, `conclusions: ${RECON_CONCLUSIONS.join(", ")} — AWAITING-AUTHORIZATION (the waiting state) is lawful; no AUTHORIZED/APPROVED/CONFIRMED state exists for chat intent to mint`);
  verdict("A9c surface references claim no readiness", surfaceOk && noReadiness && namesSurface && !routeFound,
    surfaceOk && noReadiness && namesSurface
      ? (routeFound ? "a Review & Pay route EXISTS in surfaces/ — SURFACE_READY must be re-ruled with independent exercise" : "references only; no ready/live/route claims; independent tree scan finds NO Review & Pay UI — projection stands at SURFACE_MISSING → bPay / Invoice / Review & Pay")
      : surfaceWhy);
}
// A10 — rail-native certainty is never upgraded by RECON
{
  const railSaysSettled = ev({ kind: "settlement", status: "Settled", closes_rail_obligation: "yes", value_observed: "self-reported", amount: String(OWED), finality: "terminal" });
  const a = C(obligation(), [railSaysSettled]);
  const b = C(obligation(), [ev({ amount: String(OWED), value_observed: "rail-receipt", finality: "as-reported" })]);
  const c = C(obligation(), [ev({ amount: String(OWED), value_observed: "rail-receipt", finality: "terminal" })]);
  const ladderFrozen = JSON.stringify(EVIDENCE_CLASS_LADDER) === JSON.stringify(FROZEN_EV_CLASS);
  verdict("A10 rail closure ≠ customer closure; ladder frozen", a === "OPEN" && b === "FINALITY-PENDING" && c === "SATISFIED" && ladderFrozen,
    `rail-labels with self-reported class → ${a}; rail-receipt as-reported → ${b}; rail-receipt terminal exact → ${c} (the rail's own obligation closing never settles THIS invoice below tx-hash class or above as-reported finality)`);
}

rmSync(TMP, { recursive: true, force: true });

// ── PHASE 3 + verdict ───────────────────────────────────────────────────────
const fails = R.filter((r) => !r.ok);
const namedSeductions = ["A2", "A3", "A6", "A8", "A9"]; // class-upgrade, duplicates, void-refund manufacture, cross-netting, human-gesture
if (SABOTAGE) {
  const ids = new Set(fails.map((f) => (f.id.match(/^A\d+/) || [])[0]));
  const convicted = namedSeductions.filter((k) => ids.has(k));
  const allNamed = convicted.length === namedSeductions.length;
  console.log("");
  console.log(allNamed && fails.length >= 6
    ? `SABOTAGE CONVICTED — the seductive reconciler fails ${fails.length} checks incl. all five named seductions (${convicted.join(", ")}); the verifier has teeth.`
    : `SABOTAGE NOT CONVICTED (only ${convicted.join(", ") || "none"} of the named seductions) — verifier lacks teeth; INVESTIGATE.`);
  process.exit(allNamed && fails.length >= 6 ? 0 : 1);
}
console.log("");
console.log(fails.length
  ? `RECON-1 ORACLE VERDICT: ${fails.length} FAILED — ${fails.map((f) => f.id).join("; ")}`
  : "RECON-1 ORACLE VERDICT: GREEN — every attack passed; frozen cases reproduced independently; sabotage teeth proven separately (--sabotage-selftest).");
process.exit(fails.length ? 1 : 0);
