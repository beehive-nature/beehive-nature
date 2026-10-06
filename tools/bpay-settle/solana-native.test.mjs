// solana-native.test.mjs — the same SETTLE contract, a second rail: the real
// crates/settle-solana binary on the native carrier. A contract with one
// implementation has not been tested as a contract (SPEC-ADAPTER-CONTRACT-1 §9.7).
//
// Needs the built binary: SETTLE_SOLANA_BIN=target/debug/settle-solana (the CI
// `test` job builds it). Without it the suite is SKIPPED by name, never passed.
// The keypair is generated per run; it is a test vector on devnet shape only
// and no RPC is contacted: the devnet answers below are a fixture.
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign, createHash } from "node:crypto";
import { buildGenericInvoice } from "../../scripts/lib/bpay-invoice-generic.mjs";
import { buildAuthority, buildIntent, descriptorHash, settle, reconcileReceipt, validateDescriptor } from "../../scripts/lib/bpay-settle.mjs";
import { createAdapter, binaryRunner, DEVNET, SOL } from "./adapters/solana-devnet.mjs";

const BIN = process.env.SETTLE_SOLANA_BIN;
const skip = BIN ? false : "SETTLE_SOLANA_BIN not set: build crates/settle-solana first";
const GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1"; // PUBLIC-CONSTANT: Solana devnet genesis prefix
const NOW = "2026-10-05T12:00:00.000Z";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes) {
  let n = BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0")), out = "";
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}
const rawPub = (k) => k.export({ format: "der", type: "spki" }).subarray(-32);
function keypair() { const { publicKey, privateKey } = generateKeyPairSync("ed25519"); return { address: b58(rawPub(publicKey)), privateKey }; }

function devnet({ swapBytes = false, operators = 2, disagree = false } = {}) {
  const sent = new Map();
  const blockhash = b58(createHash("sha256").update("bh").digest());
  return {
    sent,
    blockhash: async () => ({ genesis_hash: GENESIS, blockhash, last_valid_block_height: 1000, observed_block_height: 900 }),
    height: async () => 901, genesis: async () => GENESIS, feeFor: async () => 5000,
    sendRaw: async (b64) => { const tx = Buffer.from(b64, "base64"); const sig = b58(tx.subarray(1, 65)); sent.set(sig, b64); return sig; },
    signatureStatus: async (s) => (sent.has(s) ? "finalized" : null),
    evidence: async (s) => {
      let b64 = sent.get(s);
      if (swapBytes) { const t = Buffer.from(b64, "base64"); t[t.length - 1] ^= 1; b64 = t.toString("base64"); }
      const ev = (slot) => ({ genesis_hash: GENESIS, status: { confirmationStatus: "finalized", err: null, slot }, transaction: { slot, meta: { err: null, fee: 5000 }, transaction: [b64, "base64"] } });
      // one row per operator; a disagreeing operator reports another slot
      return Array.from({ length: operators }, (_, i) => ({ operator: "op-" + i, evidence: ev(disagree && i === 1 ? 124 : 123) }));
    },
  };
}

async function run(opts = {}) {
  const payer = keypair(), recipient = keypair();
  const rpc = devnet(opts);
  if (opts.evidence) { const real = rpc.evidence; rpc.evidence = (s) => opts.evidence(s, real); }
  const adapter = createAdapter({ run: binaryRunner(BIN), rpc, payer: payer.address });
  const d = await adapter.network();
  const invoice = buildGenericInvoice({ jobId: "solana-native-1", issuedAt: NOW, lines: [{ asset: SOL, quotes: [{ quote_hash: "q-sol-1", amount_atto: "1000" }] }],
    authorization: { ceilings: { [SOL]: "1000" }, authorizedBy: "test" } });
  const { authority } = buildAuthority({ principal: "agent:bFUzZ", asset: SOL, max_asset_atto: "1000", max_native_fee_atto: "5000", recipient: recipient.address,
    not_after: "2026-10-05T17:30:00.000Z", nonce: "nonce-sol-0001", invoice_digest: invoice.identity.contentDigest, adapter_manifest_hash: descriptorHash(d) });
  const intent = buildIntent({ invoice, asset: SOL, descriptor: d, authority, quote: { commitment: invoice.commitment.digest, expires_at: "2026-10-05T18:00:00.000Z" },
    privacy: { requirements: ["no-sdk-telemetry", "no-vendor-account"] }, refund: { policy: "refund-to-source" }, now: NOW });
  // the vault: signs exactly the bytes the adapter built, nothing else
  const signer = { sign: async (items) => items.map((i) => ({ signature_hex: edSign(null, Buffer.from(i.bytes_b64, "base64"), payer.privateKey).toString("hex") })) };
  const outbox = { m: new Map(), get: async (k) => outbox.m.get(k) || null, persist: async (k, v) => outbox.m.set(k, v) };
  const out = await settle({ adapter, intent, invoice, signer, outbox, now: NOW });
  return { ...out, intent, invoice, outbox };
}

test("the Solana bench answers the same contract: descriptor validates, CAIP-2 devnet", { skip }, async () => {
  const d = await createAdapter({ run: binaryRunner(BIN), rpc: devnet(), payer: "x" }).network();
  assert.ok(validateDescriptor(d));
  assert.equal(d.network, DEVNET);
  assert.equal(d.submit_model, "shell-submits");
});

test("prepare → sign → combine → PERSIST → submit → reconcile through the real binary: SATISFIED", { skip }, async () => {
  const r = await run();
  assert.equal(r.receipt.reconciliation.conclusion, "SATISFIED", JSON.stringify(r.receipt.reconciliation));
  assert.equal(r.outbox.m.get(r.intent.intent_digest).kind, "signed", "the signed bytes were persisted before submit");
  assert.equal(r.observation.payer_native_fee.atto, "5000");
  assert.ok(r.receipt.three_way.agrees);
  // the bench's memo binds THIS authority: its intent hash covers authorization_ref = the authority hash
  assert.match(r.observation.intent_hash, /^[0-9a-f]{64}$/);
  assert.equal(reconcileReceipt(r.receipt, { invoice: r.invoice, intent: r.intent }).verdict, "reconciled");
});

test("evidence whose bytes differ from the signed transaction is refused by the bench: never SATISFIED", { skip }, async () => {
  const r = await run({ swapBytes: true });
  assert.equal(r.receipt.reconciliation.conclusion, "FAILED-HUMAN-GATE");
  assert.match(r.observation.refused, /differ/);
});

test("one RPC operator is not finality: FINALITY-PENDING", { skip }, async () => {
  const r = await run({ operators: 1 });
  assert.equal(r.receipt.reconciliation.conclusion, "FINALITY-PENDING");
});

test("two operators that disagree are one witness at most: FINALITY-PENDING", { skip }, async () => {
  const r = await run({ operators: 2, disagree: true });
  assert.equal(r.receipt.reconciliation.conclusion, "FINALITY-PENDING");
});

test("the same operator twice is still one operator", { skip }, async () => {
  const r = await run({ evidence: async (s, real) => (await real(s)).map((x) => ({ ...x, operator: "op-0" })) });
  assert.equal(r.receipt.reconciliation.conclusion, "FINALITY-PENDING");
});
