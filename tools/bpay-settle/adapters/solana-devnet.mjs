// solana-devnet.mjs — crates/settle-solana behind the bnr.settle-adapter/1
// contract, on the NATIVE CARRIER of SPEC-ADAPTER-CONTRACT-1 §2: one child
// process per call, JSON on stdin, JSON on stdout. Nothing is re-implemented:
// the Rust bench composes the message (Anza constructors), verifies the
// signature (dalek verify_strict) and reconciles the finalized evidence
// against the exact signed bytes. This file maps the contract's verbs onto
// its three commands and feeds RECON-1 what the bench concluded.
//
// Devnet only, as the bench is. The bench's own boundary stands: its
// authorization_ref/proof_ref are opaque labels. Here they carry the
// settlement intent's authority hash and proof commitment, so the memo the
// bench writes on chain binds THIS authority to THIS transaction.
//
// `rpc` is injected (devnet JSON-RPC, or a fixture):
//   blockhash()        → {genesis_hash, blockhash, last_valid_block_height, observed_block_height}
//   height()           → current block height
//   genesis()          → genesis hash
//   feeFor(msgB64)     → lamports
//   sendRaw(txB64)     → signature
//   signatureStatus(s) → "finalized" | "confirmed" | "processed" | null
//   evidence(s)        → {evidence: {genesis_hash, status, transaction}, operators}
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { CONTRACT, VERBS } from "../../../scripts/lib/bpay-settle.mjs";

export const DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"; // CAIP-2 for devnet: genesis hash prefix (the bench's DEVNET_GENESIS)
export const SOL = DEVNET + "/slip44:501"; // CAIP-19 native SOL

function refuse(code, msg) { const e = new Error(msg); e.code = code; throw e; }

export function binaryRunner(bin) {
  return (command, input) => {
    const r = spawnSync(bin, [command], { input: JSON.stringify(input), encoding: "utf8", timeout: 30000 });
    if (r.error) refuse("ADAPTER_DOWN", `settle-solana did not run: ${r.error.message}`);
    if (r.status !== 0) refuse("BENCH_REFUSED", String(r.stderr || "").trim().replace(/^Refused: /, "").slice(0, 200));
    return JSON.parse(r.stdout);
  };
}

export function createAdapter({ run, rpc, payer, path = "m/44'/501'/0'" }) {
  if (typeof run !== "function") refuse("BAD_CONFIG", "run(command, input) required (binaryRunner(bin))");
  const memo = new Map(); // intent_id → bench input (the same input every command sees)

  const descriptor = {
    contract: CONTRACT,
    adapter_id: "solana-devnet.native",
    network: DEVNET,
    verbs: VERBS,
    submit_model: "shell-submits",
    assets: { [SOL]: { decimals: 9, ref: "native", symbol: "SOL" } },
    authority_models: ["signer-held-bound"],
    finality: "finalized-commitment",
    replay: "single-use",
    // the bench reconciles RPC observations, not consensus proofs: two
    // operators agreeing is the most this adapter can claim
    evidence_ceiling: "tx-receipt",
    vendor_oracles: [],
    privacy_satisfies: ["no-sdk-telemetry", "no-vendor-account"],
    oracles: ["devnet-rpc"],
  };

  const benchInput = (intent, observation) => ({
    intent: {
      job_id: intent.invoice.job_id,
      authorization_ref: intent.authority_hash,
      proof_ref: intent.proof.commitment || "none",
      payer,
      recipient: intent.authority.recipient,
      lamports: Number(intent.invoice.owed_atto),
      max_lamports: Number(intent.authority.max_asset_atto),
      max_fee_lamports: Number(intent.authority.max_native_fee_atto),
      path,
    },
    observation,
  });

  return {
    async network() { return descriptor; },
    async balance() { refuse("UNSUPPORTED", "the devnet bench reads no balances; wallet-adapter-solana.js does"); },

    async prepare(intent) {
      if (intent.route.network !== DEVNET) refuse("BAD_NETWORK", "intent is for another network");
      if (intent.invoice.asset !== SOL) refuse("UNSUPPORTED", "only native SOL settles on this bench");
      for (const v of [intent.invoice.owed_atto, intent.authority.max_asset_atto, intent.authority.max_native_fee_atto])
        if (BigInt(v) > BigInt(Number.MAX_SAFE_INTEGER)) refuse("BAD_AMOUNT", "lamport figure beyond exact JSON integers");
      const input = benchInput(intent, await rpc.blockhash());
      const out = run("prepare", input);
      memo.set(intent.intent_digest, input);
      return { intent_id: intent.intent_digest, expires_at: intent.authority.not_after, intent, rail: { message_base64: out.message_base64, intent_hash: out.intent_hash } };
    },

    async payloads(prepared) {
      const bytes = Buffer.from(prepared.rail.message_base64, "base64");
      const { intent } = prepared;
      return { mode: "shell-submits",
        spend: { asset_atto: intent.invoice.owed_atto, recipient: intent.authority.recipient, max_native_fee_atto: intent.authority.max_native_fee_atto },
        items: [{ kind: "sign-bytes", signer: payer, bytes_b64: prepared.rail.message_base64, digest: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
          summary: `send ${intent.invoice.owed_atto} lamports to ${intent.authority.recipient}` }] };
    },

    async combine(prepared, signatures) {
      const input = memo.get(prepared.intent_id);
      if (!input) refuse("NOT_PREPARED", "combine before prepare");
      const sig = signatures && signatures[0] && signatures[0].signature_hex;
      if (!/^[0-9a-f]{128}$/.test(sig || "")) refuse("BAD_SIGNATURE", "one 64-byte hex Ed25519 signature");
      const full = { ...input, signature_hex: sig, current_genesis: await rpc.genesis(), current_block_height: await rpc.height(), fee_lamports: await rpc.feeFor(prepared.rail.message_base64) };
      const out = run("verify", full);
      memo.set(prepared.intent_id, full);
      return { signed: { transaction_base64: out.transaction_base64, signature: out.signature, intent_id: prepared.intent_id }, predicted_ref: out.signature };
    },

    async submit(signed) {
      const got = await rpc.sendRaw(signed.transaction_base64);
      if (got !== signed.signature) refuse("REF_MISMATCH", "the RPC acknowledged another signature than the one signed");
      return { ref: got, accepted_at: null };
    },

    async status(ref) {
      const s = await rpc.signatureStatus(ref);
      return { phase: s === "finalized" ? "observed" : s ? "submitted" : "unknown", assertion: null, adapter_local: { commitment: s } };
    },

    async reconcile({ intent, ref }) {
      const input = memo.get(intent.intent_digest);
      if (!input || !input.signature_hex) refuse("NOT_COMBINED", "reconcile needs the verified transaction this adapter combined");
      const { evidence, operators } = await rpc.evidence(ref);
      let out;
      try { out = run("reconcile", { ...input, evidence: { ...evidence, requested_signature: ref } }); }
      // the bench refused the evidence (other bytes, not final, failed, over the fee bound): a human looks
      catch (e) { return { records: [{ kind: "attempt", asset: SOL, retryability: "human-gate", txRef: `${DEVNET}:${ref}`, value_observed: "tx-hash" }], observation: { oracle: "devnet-rpc", operators, refused: String(e.message) } }; }
      const records = [{
        kind: "settlement", asset: SOL, amount: String(out.lamports), value_observed: "tx-receipt",
        finality: operators >= 2 ? "terminal" : "as-reported", retryability: "never",
        txRef: `${DEVNET}:${out.signature}`, from: out.payer, to: out.recipient,
      }];
      return { records, observation: { oracle: "devnet-rpc", operators, slot: out.slot, payer: out.payer, payer_native_fee: { atto: String(out.fee_lamports), basis: "fee-payer" }, intent_hash: out.intent_hash } };
    },
  };
}
