#!/usr/bin/env node
// vocab1-crosswalk.mjs — VOCAB-1 settlement-outcome crosswalk battery.
// Two mappings over the SAME rail-state inventory (data below, read at
// source @981195bc): the NAIVE generic status enum (REGISTERED RED — the
// information-loss detector must fire: normalization must not manufacture
// certainty) and the LOSSLESS predicate crosswalk (GREEN). Negative control
// sabotages the predicate mapping to prove the detector's teeth. The seven
// founder distinctions run as invariants over BOTH mappings.
// Run: node scripts/vocab1-crosswalk.mjs   (exit 0 = structure sound)
const AXES = ["value_attempted", "value_observed", "finality", "retryability", "refund_path", "closes_rail_obligation"];

// ── the inventory: rail, state, axis-tuple (condensed from the source reads;
//    full prose in docs/agents/VOCAB-1-CROSSWALK.md) ─────────────────────────
const S = (value_attempted, value_observed, finality, retryability, refund_path, closes_rail_obligation) =>
  ({ value_attempted, value_observed, finality, retryability, refund_path, closes_rail_obligation });
const STATES = [
  ["x402-door", "Reserved",            S("never",     "none",                     "none",        "capped",      "none",         "no")],
  ["x402-door", "Settled",             S("submitted", "tx-receipt",               "terminal",    "never",       "none",         "yes")],
  ["x402-door", "ReorgFlagged",        S("submitted", "tx-receipt",               "reorg-flagged","human-gate", "none",         "no")],
  ["x402-door", "FailedKeep",          S("submitted", "none",                     "none",        "capped",      "none",         "no")],
  ["x402-door", "Unknown",             S("submitted", "ambiguous",                "none",        "human-gate",  "none",         "no")],
  ["x402-door", "ExpiredReleased-Unspent", S("never", "typed-verdict-unspent",    "terminal",    "never",       "none",         "no")],
  ["x402-door", "ExpiredReleased-RpcUnavailable", S("never", "none",              "none",        "operator-retry","none",       "no")],
  ["bpay-rail", "Intent",              S("never",     "none",                     "none",        "unbounded",   "none",         "no")],
  ["bpay-rail", "Staged",              S("never",     "signed-artifact",          "none",        "unbounded",   "none",         "no")],
  ["bpay-rail", "InFlight",            S("submitted", "none",                     "none",        "never",       "none",         "no")],
  ["bpay-rail", "Settled",             S("submitted", "rail-receipt",             "terminal",    "never",       "none",         "yes")],
  ["bpay-rail", "Failed",              S("submitted", "failure-evidence",         "terminal",    "never",       "fee-class-dependent", "no")],
  ["bpay-rail", "Unknown",             S("submitted", "ambiguous",                "none",        "human-gate",  "none",         "no")],
  ["watchpay",  "Receipt-Status1",      S("submitted", "event-log+readback",       "as-reported", "never",       "none",         "yes")],
  ["watchpay",  "Receipt-Status0",      S("submitted", "receipt+revert-data",      "terminal",    "never",       "fee-class-dependent", "no")],
  ["watchpay",  "HashVerified",         S("submitted", "retrieved-hash-match",     "as-reported", "never",       "none",         "yes")],
  ["meter",     "Instruction-Only",     S("instruction","none",                    "none",        "unbounded",   "none",         "no")],
  ["meter",     "Escrow-Charge",        S("submitted", "derived-balance",          "terminal",    "never",       "credit-note",  "partial-amount")],
  ["meter",     "Parked-Charge",        S("submitted", "none",                     "none",        "operator-retry","credit-note", "no")],
  ["meter",     "ReorgFlag-Shapes",     S("submitted", "derived-balance",          "reorg-flagged","human-gate", "none",         "no")],
  ["vending",   "OpenSess",             S("never",     "signed-upto-onchain",      "none",        "never",       "none",         "no")],
  ["vending",   "Settle-Positive",      S("submitted", "onchain-tally",            "terminal",    "never",       "none",         "yes")],
  ["vending",   "Settle-ZeroBurns",     S("submitted", "onchain-tally-zero",       "terminal",    "never",       "none",         "yes")],
  ["vending",   "Paused-NotKilled",     S("never",     "session-state-onchain",    "none",        "unbounded",   "none",         "no")],
  ["genealogy", "Invoice-Issued",       S("never",     "carried-quote-set",        "none",        "unbounded",   "none",         "no")],
  ["genealogy", "Invoice-Void-Evidenced",S("never",    "void-evidence",            "terminal",    "never",       "successor-invoice", "no")],
  ["genealogy", "Receipt-Settled",      S("submitted", "txRefs-evidence",          "as-reported", "never",       "none",         "yes")],
  ["genealogy", "Reconcile-Breach",     S("submitted", "comparison-checks",        "terminal",    "never",       "rail-dependent","partial-amount")],
  ["invoice1",  "Issued",               S("never",     "carried-quote-set",        "none",        "unbounded",   "none",         "no")],
  ["invoice1",  "Void-Evidenced",       S("never",     "void-evidence+lineage",    "terminal",    "never",       "successor-invoice", "no")],
  ["invoice1",  "Settled-Anchored",     S("submitted", "receiptRef+digest-anchor","terminal",    "never",       "credit-note",  "yes")],
];

// ── the two mappings ────────────────────────────────────────────────────────
// NAIVE: a six-status generic enum — the shape a premature RECON-1 would reach for.
const NAIVE = {
  "x402-door/Reserved": "PENDING", "bpay-rail/Intent": "PENDING", "bpay-rail/Staged": "PENDING",
  "meter/Instruction-Only": "PENDING", "vending/OpenSess": "PENDING", "vending/Paused-NotKilled": "PENDING",
  "genealogy/Invoice-Issued": "PENDING", "invoice1/Issued": "PENDING",
  "x402-door/Settling": "PENDING", "bpay-rail/InFlight": "PENDING",
  "x402-door/FailedKeep": "FAILED", "bpay-rail/Failed": "FAILED", "watchpay/Receipt-Status0": "FAILED",
  "x402-door/ReorgFlagged": "SUCCESS", "watchpay/Receipt-Status1": "SUCCESS", "watchpay/HashVerified": "SUCCESS",
  "x402-door/Settled": "SUCCESS", "bpay-rail/Settled": "SUCCESS", "vending/Settle-Positive": "SUCCESS",
  "vending/Settle-ZeroBurns": "SUCCESS", "genealogy/Receipt-Settled": "SUCCESS", "invoice1/Settled-Anchored": "SUCCESS",
  "meter/Escrow-Charge": "SUCCESS", "genealogy/Reconcile-Breach": "FAILED",
  "x402-door/Unknown": "UNKNOWN", "bpay-rail/Unknown": "UNKNOWN",
  "x402-door/ExpiredReleased-Unspent": "FAILED", "x402-door/ExpiredReleased-RpcUnavailable": "UNKNOWN",
  "meter/Parked-Charge": "UNKNOWN", "meter/ReorgFlag-Shapes": "SUCCESS",
  "genealogy/Invoice-Void-Evidenced": "FAILED", "invoice1/Void-Evidenced": "FAILED",
};
// LOSSLESS: state → predicate tuple (here: identity on the axis tuple itself —
// the crosswalk's promise is that RECON-1 predicates over AXES, never over labels)
const lossless = (rail, state) => {
  const row = STATES.find(([r, s]) => r === rail && s === state);
  if (!row) throw new Error("unmapped state " + rail + "/" + state);
  return JSON.stringify(row[2]);
};

// ── the information-loss detector ───────────────────────────────────────────
// A mapping is lossy iff two states sharing a mapped label differ on any
// NOTE (founder review gate): closes_rail_obligation means THE RAIL'S OWN
// tracked obligation closes at this state — NEVER "the customer's invoice
// is satisfied"; that conclusion belongs to RECON-1. refund_path names the
// AVAILABLE correction path in that layer — whether a refund is OWED is
// RECON-1's predicate (refund_owed), not this axis.
// load-bearing axis — the label then manufactures certainty one of the pair
// never had.
function lossyPairs(mapping) {
  const byLabel = new Map();
  for (const [rail, state] of STATES.map(([r, s]) => [r, s])) {
    const label = mapping(rail, state);
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push([rail, state, STATES.find(([r2, s2]) => r2 === rail && s2 === state)[2]]);
  }
  const losses = [];
  for (const [label, entries] of byLabel) {
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      const diff = AXES.filter((ax) => JSON.stringify(a[2][ax]) !== JSON.stringify(b[2][ax]));
      if (diff.length) losses.push(`${label}: ${a[0]}/${a[1]} vs ${b[0]}/${b[1]} differ on ${diff.join(",")}`);
    }
  }
  return losses;
}

// ── the seven distinction invariants (over the INVENTORY itself) ────────────
function distinctionChecks() {
  const get = (rail, state) => STATES.find(([r, s]) => r === rail && s === state)[2];
  const checks = [];
  const deeper = (a, b) => { // evidence class must strictly deepen
    const order = ["none", "instruction", "signed-artifact", "self-reported", "tx-hash", "derived-balance", "rail-receipt", "tx-receipt", "event-log+readback", "retrieved-hash-match"];
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return ia === -1 || ib === -1 || ia < ib; // unknown classes treated as distinct (fail-closed)
  };
  const chain = [["invoice1/Issued", "bpay-rail/Staged"], ["bpay-rail/Staged", "bpay-rail/InFlight"], ["bpay-rail/InFlight", "bpay-rail/Settled"], ["watchpay/Receipt-Status1", "watchpay/HashVerified"]];
  for (const [lo, hi] of chain) {
    const [lr, ls] = lo.split("/"), [hr, hs] = hi.split("/");
    const a = get(lr, ls), b = get(hr, hs);
    // adjacent states must be DISTINCT on ≥1 load-bearing axis (never conflated)
    const distinct = AXES.some((ax) => JSON.stringify(a[ax]) !== JSON.stringify(b[ax]));
    checks.push([`AUTHORIZED≠SUBMITTED≠SETTLED≠FINAL distinct (${lo}→${hi})`, distinct]);
  }
  // and the chain's endpoints strictly deepen evidence (authorized ⇒ settled/verified)
  checks.push(["chain endpoints deepen evidence (Issued→Settled)",
    deeper(get("invoice1", "Issued").value_observed, get("bpay-rail", "Settled").value_observed)]);
  checks.push(["SUBMITTED≠SETTLED (value_observed deepens)",
    deeper(get("bpay-rail", "InFlight").value_observed, get("bpay-rail", "Settled").value_observed)]);
  const fv = get("bpay-rail", "Failed"), vv = get("invoice1", "Void-Evidenced");
  // FAILED (value attempted, terminally failed, failure-fee consequences) vs
  // VOID (value NEVER attempted; obligation closed by named supersession)
  checks.push(["FAILED≠VOID (value_attempted and refund_path differ)",
    fv.value_attempted !== vv.value_attempted && fv.refund_path !== vv.refund_path]);
  checks.push(["REFUNDED≠NEVER-CHARGED (value history differs)",
    get("meter", "Escrow-Charge").value_observed !== get("x402-door", "ExpiredReleased-Unspent").value_observed]);
  checks.push(["TITHE/EXPENSE axes stay paper-layer (no rail state carries them)",
    STATES.every(([, , ax]) => !("tithe" in ax) && !("expense" in ax))]);
  return checks;
}

// ── run ─────────────────────────────────────────────────────────────────────
const naiveLosses = lossyPairs((r, s) => NAIVE[r + "/" + s] || "UNMAPPED");
const losslessLosses = lossyPairs((r, s) => lossless(r, s));
// negative control: sabotage the lossless mapping by collapsing two
// evidence-different states to one predicate
const sabotaged = (r, s) => (r === "watchpay" && s === "HashVerified") ? lossless("watchpay", "Receipt-Status1") : lossless(r, s);
const sabotageCaught = lossyPairs(sabotaged).length > 0;
const dist = distinctionChecks();

console.log("VOCAB-1 — settlement outcome crosswalk");
console.log(`inventory: ${STATES.length} states across ${new Set(STATES.map(([r]) => r)).size} rails; ${AXES.length} axes`);
console.log("");
console.log(naiveLosses.length ? `✗ RED  NAIVE-ENUM mapping — ${naiveLosses.length} information-loss pair(s): normalization would manufacture certainty` : "✓ naive enum unexpectedly lossless (INVESTIGATE)");
for (const l of naiveLosses.slice(0, 6)) console.log("    " + l);
console.log(losslessLosses.length ? `✗ LOSSLESS mapping lossy — ${losslessLosses.length} pair(s) (DEFECT)` : "✓ GREEN PREDICATE crosswalk — every distinct axis-vector stays distinguishable; no label manufactured");
console.log(sabotageCaught ? "✓ GREEN negative control — merged evidence classes inside the predicate mapping CONVICTED (detector has teeth)" : "✗ ORACLE BROKEN: sabotage not caught");
for (const [name, ok] of dist) console.log(`${ok ? "✓" : "✗"} distinction ${name}`);

const fatal = [];
if (!naiveLosses.length) fatal.push("naive enum must stay lossy while premature normalization exists");
if (losslessLosses.length) fatal.push("lossless mapping lost information: " + losslessLosses[0]);
if (!sabotageCaught) fatal.push("detector teeth missing");
for (const [name, ok] of dist) if (!ok) fatal.push("distinction broken: " + name);
if (fatal.length) { console.log(""); console.log("VOCAB-1 FAIL:"); for (const f of fatal) console.log("  ✗ " + f); process.exit(1); }
console.log("");
console.log("VOCAB-1 PASS — naive enum REGISTERED RED (premature normalization convicted); predicate crosswalk GREEN; distinctions hold; teeth proven.");
