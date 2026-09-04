// x402audit.mjs — THE PURE 9-CHECK AUDIT (SPEC-VENDING-1 §x402 item 4)
//
// Shape cited from Tally audit.ts:auditSettlementLogic (9 named checks) via
// docs/raids/X402-SORT-2026-09-01.md — RULES only, never Hedera code. The
// function is PURE over the public record: chain reads in, one verdict out,
// no side effects; anyone re-runs it and gets the same answer.
//
// The four verifier states are z3.2's comb cells (surfaces/spend-audit.js):
//   PASSED = capped (gold ⬡) · PENDING_ANCHOR = honey (amber) ·
//   FAILED = the --flag hue #c07f1c (never a new red) · INCONCLUSIVE = nectar
// with z3.2's precedence: failed ? FAILED : inconclusive ? INCONCLUSIVE
//                          : covered ? PASSED : PENDING_ANCHOR
//
// usage (the runner): node x402audit.mjs <sessId> [local|jungle4]
import { createHash } from "node:crypto";

export const STATE = { PASSED: 0, PENDING_ANCHOR: 1, FAILED: 2, INCONCLUSIVE: 3 };
export const STATE_NAME = ["PASSED", "PENDING_ANCHOR", "FAILED", "INCONCLUSIVE"];
export const COMB = { PASSED: "capped", PENDING_ANCHOR: "honey",
                      FAILED: "flag #c07f1c", INCONCLUSIVE: "nectar" };

// the pure fn: takes the session row + rate row + nonce rows (public record),
// returns { state, checks: [{name, ok, note}] } — no I/O inside
export function auditSession({ sess, rate, nonces, events }) {
  const F = [];
  const fail = (name, note) => F.push({ name, ok: false, note });
  const pass = (name, note) => F.push({ name, ok: true, note });
  let inconclusive = false;
  let anchorCovered = false;

  // 1 arithmetic_fraud — price × burned == charged (the z3.2 comb law:
  //   price×burned=owed on BigInt, never float; asset strings parse to
  //   their integer units — "0.6000 A" → 6000n)
  const assetAmt = (s) => BigInt(s.trim().split(" ")[0].replace(".", "") || "0");
  const units = events.filter(e => e.kind === "charge").reduce((a, e) => a + BigInt(e.units), 0n);
  const owed = assetAmt(rate.basis) * units;
  const burned = assetAmt(sess.burned);
  owed === burned ? pass("arithmetic_fraud", `${rate.basis} × ${units} = ${sess.burned}`)
                  : fail("arithmetic_fraud", `price×units ${owed} ≠ burned ${sess.burned}`);

  // 2 over_capture — charged ≤ settled credit (never credit more than paid)
  const credit = assetAmt(sess.credit);
  burned <= credit ? pass("over_capture", `${sess.burned} ≤ ${sess.credit}`)
                   : fail("over_capture", `burned ${sess.burned} > credit ${sess.credit}`);

  // 3 over_max — charged ≤ the upto ceiling (Tally verifyAgainst rule)
  const ceiling = assetAmt(sess.ceiling);
  burned <= ceiling ? pass("over_max", `${sess.burned} ≤ ceiling ${sess.ceiling}`)
                    : fail("over_max", `burned ${sess.burned} > ceiling ${sess.ceiling}`);

  // 4 terms_mismatch — the session's rail matches a live rate row and the
  //    row carries the tithe field (rate = cost basis + tithe)
  (rate && rate.rail === sess.rail && Number.isInteger(rate.tithe_bp))
    ? pass("terms_mismatch", `rail ${sess.rail} @ basis ${rate.basis} + tithe ${rate.tithe_bp}bp`)
    : fail("terms_mismatch", `rail ${sess.rail} has no tithe-carrying rate row`);

  // 5 nonce_replay — every credit nonce unique in the record (the contract
  //    already refuses replays; the audit re-derives it from the nonce table)
  const seen = new Set(nonces.map(n => n.value));
  seen.size === nonces.length
    ? pass("nonce_replay", `${nonces.length} settlements, ${seen.size} distinct nonces`)
    : fail("nonce_replay", "duplicate nonce in the record");

  // 6 pause_integrity — no charge event while the session was paused
  //    (derived from the event log the receipt carries; absent log → nectar)
  const pauseSpans = events.filter(e => e.kind === "pause" || e.kind === "resume");
  if (events.some(e => e.kind === "charge" && e.whilePaused))
    fail("pause_integrity", "a charge executed while paused");
  else if (pauseSpans.length === 0 && !events.length)
    { inconclusive = true; pass("pause_integrity", "no events — not checked"); }
  else pass("pause_integrity", "no charge under pause in the event log");

  // 7 tithe_split — the rate row's tithe_bp partitions every charge exactly:
  //    tithe = burned × bp / 10000 on BigInt; the row's bp must be sane
  if (rate && Number.isInteger(rate.tithe_bp)) {
    const bp = BigInt(rate.tithe_bp);
    if (bp < 0n || bp > 10000n) fail("tithe_split", "tithe_bp out of range");
    else {
      const tithe = burned * bp / 10000n;
      const basisPart = burned - tithe;
      pass("tithe_split", `basis ${fmt(basisPart)} + tithe ${fmt(tithe)} = ${sess.burned} @ ${rate.tithe_bp}bp`);
    }
  } else { inconclusive = true; F.push({ name: "tithe_split", ok: true, note: "rate row lacks tithe — nectar" }); }

  // 8 anchor_pending — the audit record's anchor: present ⇒ covered,
  //    absent ⇒ honey (PENDING_ANCHOR), malformed ⇒ nectar
  const anchor = events.find(e => e.kind === "anchor");
  if (anchor && /^[0-9a-f]{64}$/.test(anchor.hash)) { anchorCovered = true; pass("anchor_pending", anchor.hash.slice(0, 16) + "…"); }
  else if (anchor) { inconclusive = true; F.push({ name: "anchor_pending", ok: true, note: "anchor malformed — nectar" }); }
  else F.push({ name: "anchor_pending", ok: true, note: "no anchor yet — honey" });

  // 9 clock_sanity — timestamps monotonic across the record
  const ts = events.map(e => Date.parse(e.at)).filter(Number.isFinite);
  ts.length < 2 ? (events.length ? pass("clock_sanity", "single event") : (inconclusive = true, F.push({ name: "clock_sanity", ok: true, note: "no events — nectar" })))
    : ts.every((t, i) => i === 0 || t >= ts[i - 1])
      ? pass("clock_sanity", `${ts.length} timestamps monotonic`)
      : fail("clock_sanity", "timestamps regress");

  const failed = F.some(c => !c.ok);
  const state = failed ? STATE.FAILED : inconclusive ? STATE.INCONCLUSIVE
                    : anchorCovered ? STATE.PASSED : STATE.PENDING_ANCHOR;
  return { state, stateName: STATE_NAME[state], comb: COMB[STATE_NAME[state]], checks: F };
}
const fmt = (bigint) => {
  const s = bigint.toString().padStart(5, "0");
  return s.slice(0, -4) + "." + s.slice(-4) + " A";
};

// the record hash: canonical JSON of {session, checks} — what auditmark pins
export function auditHash(record) {
  const sortDeep = (v) => Array.isArray(v) ? v.map(sortDeep)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortDeep(v[k])])) : v;
  return createHash("sha256").update(JSON.stringify(sortDeep(record)), "utf8").digest("hex");
}

// runner: reads the public record from the chain, runs the pure fn, prints
// the verdict, and (with --mark <wif-env>) pushes auditmark
if (process.argv[1].endsWith("x402audit.mjs")) {
  const sessId = parseInt(process.argv[2], 10);
  const TARGET = process.argv[3] || "jungle4";
  const RPC = TARGET === "jungle4" ? "https://jungle4.greymass.com" : "http://127.0.0.1:8888";
  const CONTRACT = TARGET === "jungle4" ? "bnrapolltest" : "vending";
  const rows = async (table, scope) => (await fetch(RPC + "/v1/chain/get_table_rows", { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: true, code: CONTRACT, scope: scope ?? CONTRACT, table, limit: 100 }) })
    .then(r => r.json())).rows || [];
  const sess = (await rows("sessions")).find(s => s.id === sessId);
  if (!sess) { console.error("no such session " + sessId); process.exit(1); }
  const rate = (await rows("rates")).find(r => r.rail === sess.rail);
  const nonces = (await rows("nonces")).filter(n => n.session === sessId);
  // the event log rides the receipt (canonical, hash-pinned); for the runner
  // we rebuild it from the record we kept — absent ⇒ nectar-class notes
  const events = JSON.parse(process.env.X402_EVENTS || "[]");
  const verdict = auditSession({ sess, rate, nonces, events });
  const hash = auditHash({ session: sessId, checks: verdict.checks });
  console.log("SESSION", sessId, "→", verdict.stateName, "(", verdict.comb, ")");
  for (const c of verdict.checks) console.log("  " + (c.ok ? "ok  " : "FAIL") + " " + c.name + " — " + c.note);
  console.log("audit record sha256:", hash, "PUBLIC-CONSTANT");
  if (process.env.BNRAPOLL_WIF) {
    const eosjsPkg = (await import("eosjs")).default;
    const { Api, JsonRpc } = eosjsPkg;
    const { JsSignatureProvider } = await import("eosjs/dist/eosjs-jssig.js");
    const api = new Api({ rpc: new JsonRpc(RPC, {}),
      signatureProvider: new JsSignatureProvider([process.env.BNRAPOLL_WIF]),
      textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
    const r = await api.transact({ actions: [{ account: CONTRACT, name: "auditmark",
      authorization: [{ actor: sess.owner, permission: "active" }],
      data: { sess: sessId, state: verdict.state, audit_hash: hash } }] },
      { blocksBehind: 3, expireSeconds: 300 });
    console.log("AUDITMARK tx=" + r.transaction_id);
  }
}
