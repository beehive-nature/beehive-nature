#!/usr/bin/env node
// safe7-ceremony.mjs — Observation B, the founder-operated driver.
//
// The REAL authorization + job come from the LIVE antd-bridge (never
// regenerated); the service (BPAY_SIGN_MODE=safe7) runs the 15-law
// binding gate and drives the Safe 7 through Suite MCP; the ceremony
// ENDS AT SIGNED — no push, no settle, no upload, no broadcast.
//
// Laws baked into this driver:
// - REFUSES when no current authorization exists (the founder's press
//   is his alone — this script never creates, refreshes, or repairs one).
// - Displays the full RECONFIRM manifest BEFORE any device prompt and
//   requires typing SIGN (exact) to proceed.
// - NEVER retries: an ambiguous outcome (timeout, "device session ended
//   without a verified signature") is reported as UNKNOWN for
//   inspection — it never triggers another signature prompt.
//
// env: BPAY_SIGN (default http://127.0.0.1:8808)
//      BPAY_BRIDGE (default http://127.0.0.1:8807)
//      BPAY_BRIDGE_STATE (default C:/Users/travi/bridge-state-bpay-ui)
//      BPAY_CEREMONY_OUT (receipt copy, default ./safe7-observation-b-receipt.json)
// arg: --authorization-id <id>  (needed only if more than one is current)

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const SERVICE = process.env.BPAY_SIGN ?? "http://127.0.0.1:8808";
const BRIDGE = process.env.BPAY_BRIDGE ?? "http://127.0.0.1:8807";
const STATE_DIR = (process.env.BPAY_BRIDGE_STATE ?? "C:/Users/travi/bridge-state-bpay-ui").replace(/\\/g, "/");
const OUT = process.env.BPAY_CEREMONY_OUT ?? "./safe7-observation-b-receipt.json";
const WANT_ID = process.argv.includes("--authorization-id")
  ? process.argv[process.argv.indexOf("--authorization-id") + 1]
  : null;

const die = (code, msg) => { console.error(msg); process.exit(code); };

// ── 1. the CURRENT founder authorization (live bridge, read-only) ──
const auths = await fetch(`${BRIDGE}/v1/authorization`).then(r => r.json());
const current = auths.filter(a => a.state === "authorized-for-signing");
if (current.length === 0) {
  die(2, `LAW 1 (missing-authorization): the bridge holds ${auths.length} record(s), none authorized-for-signing.
The founder's press is required (and is his alone): open bData (My Data) → the current price →
"➜ Review what you are authorizing" → "🔑 I authorize this" — then re-run this driver.
Nothing was refreshed, regenerated, or repaired here.`);
}
const auth = WANT_ID
  ? current.find(a => a.authorization_id === WANT_ID) ?? die(2, `no authorized-for-signing record ${WANT_ID}`)
  : current.length === 1
    ? current[0]
    : die(2, `${current.length} current authorizations — pass --authorization-id:\n${current.map(a => `  ${a.authorization_id} (job ${a.upload_id})`).join("\n")}`);
console.log(`authorization: ${auth.authorization_id} · job ${auth.upload_id} · ceiling ${auth.ant_ceiling_atto} atto-ANT`);

// ── 2. the job's payment set (bridge state on disk, read-only) ─────
const jobPath = `${STATE_DIR}/jobs/${auth.artifact_sha256}/${auth.upload_id}.json`;
let job;
try { job = JSON.parse(readFileSync(jobPath, "utf8")); }
catch { die(2, `cannot read the job file ${jobPath} — is BPAY_BRIDGE_STATE right?`); }
if (job.status !== "open") die(2, `job ${auth.upload_id} is ${job.status} — only an OPEN job's quotes can be signed`);
const tuples = job.payment_intent?.payments;
if (!Array.isArray(tuples) || tuples.length === 0) die(2, "job carries no payment set");
// bridge persistence order: [quote_hash, rewards_address, amount_atto_hex]
const payments = tuples.map(([quote_hash, rewards_address, amount_hex]) => ({
  quote_hash, rewards_address,
  amount_atto: BigInt(amount_hex).toString(10),
}));
const sum = payments.reduce((a, p) => a + BigInt(p.amount_atto), 0n);
console.log(`payments: ${payments.length} · sum ${sum} atto-ANT (service re-derives + walls this)`);
if (sum !== BigInt(auth.ant_ceiling_atto)) {
  die(2, `payment sum ${sum} != authorization ceiling ${auth.ant_ceiling_atto} — REFUSING (do not proceed; inspect)`);
}

// ── 3. the binding review (15 laws, service-side) ──────────────────
const st = await fetch(`${SERVICE}/v1/sign/state`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ authorization_id: auth.authorization_id, upload_id: auth.upload_id, payments }),
}).then(r => r.json());
if (!st.ok) die(2, `binding gate REFUSED: ${JSON.stringify(st.refusal ?? st, null, 1)}`);
const r = st.review, t = r.transport ?? {};
console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  OBSERVATION B — the two real bPay transactions, Safe 7 signatures ║
╠════════════════════════════════════════════════════════════════════╣
  mode            ${r.mode} (chain ${r.chain_id} — REAL shape, SIGNED NOT BROADCAST)
  authorization   ${r.authorization_id} · job ${r.upload_id}
  artifact        sha256:${r.artifact_sha256.slice(0, 16)}… · ${r.artifact_bytes} bytes · audience ${r.audience}
  ANT ceiling     ${r.ant_ceiling_atto} atto (EXACT — never above)
  gas             SEPARATE (Arbitrum ETH, wallet-side)
  token           ${r.token}
  vault           ${r.vault}
  payer (Safe 7)  ${r.payer}
  path            ${r.path}

  SIGNATURES EXPECTED: ${r.transaction_count}
    ${(t.slot_manifest ?? []).join("\n    ")}
  broadcast        ${t.broadcast}  ← structural; no settlement exists in this mode
  STOP             ${t.stop ?? "SIGNED · NOT BROADCAST · NOT PAID · NOT UPLOADED"}

  The device screen is the truth: approve ONLY what matches this manifest.
╚════════════════════════════════════════════════════════════════════╝`);

// ── 4. the founder's typed reconfirm (no default, no timeout skip) ─
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question('type SIGN to send the two requests to the Safe 7 (anything else aborts): ')).trim();
rl.close();
if (answer !== "SIGN") die(1, "aborted before any device prompt — nothing was sent");

// ── 5. BEGIN — slot 1 approve → wall → slot 2 payForQuotes → wall ──
console.log("\nbegin — APPROVE slot 1/2 ON THE DEVICE when it appears (exact ANT approve), then slot 2/2 (payForQuotes)…");
let begin;
try {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15 * 60 * 1000);
  begin = await fetch(`${SERVICE}/v1/sign/begin`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
    body: JSON.stringify({ authorization_id: auth.authorization_id, upload_id: auth.upload_id, payments, path: "m/44'/60'/0'/0/0" }),
  }).then(r => r.json());
  clearTimeout(timer);
} catch (e) {
  die(3, `UNKNOWN OUTCOME (transport ${e.name === "AbortError" ? "timeout" : "error"}): the service may hold an open
intent and the device state is uncertain — INSPECT before any re-run; this driver never retries:
  GET ${SERVICE}/v1/sign/receipt?authorization_id=${auth.authorization_id}`);
}
if (!begin.ok) {
  const why = begin.why ?? begin.refusal?.why ?? JSON.stringify(begin);
  const unknown = /device session ended|Network Error|timeout/i.test(why);
  console.error(`signing did not complete: ${why}`);
  die(unknown ? 3 : 1, unknown
    ? `UNKNOWN OUTCOME — the intent may be open and the device state uncertain. INSPECT the receipt before any re-run:
  GET ${SERVICE}/v1/sign/receipt?authorization_id=${auth.authorization_id}`
    : "refusal recorded; nothing signed beyond what the receipt holds");
}

// ── 6. the SIGNED receipt — print, bank, STOP ──────────────────────
const rec = begin.receipt;
writeFileSync(OUT, JSON.stringify(rec, null, 1));
console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  SIGNED BY TREZOR SAFE 7 · VERIFIED LOCALLY · NOT BROADCAST        ║
╚════════════════════════════════════════════════════════════════════╝
  state           ${rec.state}
  authorization   ${rec.authorization_id}
  slots:`);
for (const s of rec.slots ?? []) {
  console.log(`    ${s.slot} · ${s.operation}
      tx_hash ${s.tx_hash}
      signer  ${s.signer}
      nonce ${s.nonce} · signed_at ${s.signed_at_unix_secs}`);
}
console.log(`  broadcast:${rec.broadcast} paid:${rec.paid} uploaded:${rec.uploaded} finalized:${rec.finalized}
  receipt copy → ${OUT}
  service copy → GET ${SERVICE}/v1/sign/receipt?authorization_id=${auth.authorization_id}

STOPPED AT SIGNED — inspect the receipt BEFORE any settlement gesture. This driver settles nothing.`);
