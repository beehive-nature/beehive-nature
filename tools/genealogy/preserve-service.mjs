// ── the preservation service — the product's wallet-to-storage bridge ────────
//   node preserve-service.mjs [port]
//
// The founder starts this service ONCE (the only gesture outside the UI):
//   SECRET_KEY must be in the service's environment — never in chat, never
//   in the repo, never in a form field. The service holds it in process
//   memory only and passes it to the ant CLI per-upload.
//
// The UI (blood.html "Preserve this archive") calls these endpoints:
//   GET  /api/preserve/quote        → live quote against the exact tar
//   POST /api/preserve/upload       → performs the upload, returns the receipt
//   GET  /api/preserve/status       → service health + wallet (no key material)
//
// SPEND GATE ENFORCED (not printed) — CONSUMES THE EDITION GATE (PR #296
// review P1 fix, 2026-10-02): the service refuses EVERY spend while the
// canonical ETERNALIZATION-EDITION-V2.json gate is missing or its
// spendingApprovalGate.status is not "APPROVED" (fail-closed — the
// superseded pkg3 path with its own hash + old 3.2 ANT ceiling is DEAD).
// When the gate IS approved, the service binds the gate's OWN artifact
// (tarSha256, resolved against the candidate tars on disk) and the gate's
// separated ceilings — never hardcoded constants.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, writeFileSync, copyFileSync, mkdtempSync, rmSync, renameSync, unlinkSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const exec = promisify(execFile);
const PORT = parseInt(process.argv[2] || "8794", 10);
const RECEIPT_ROOT = "C:/Users/travi/family-lineage";
const DEFAULT_GATE = fileURLToPath(new URL("../../ETERNALIZATION-EDITION-V2.json", import.meta.url));
// The approved artifact is identified by HASH, not by filename — the gate
// names the tar sha; whichever candidate matches is the spendable artifact.
const CANDIDATE_TARS = [
  "C:/Users/travi/family-lineage/pkg4.tar",
  "C:/Users/travi/family-lineage/pkg3.tar",
];

// Pure, testable: read the canonical edition gate.
export function editionGate(gatePath = DEFAULT_GATE) {
  if (!existsSync(gatePath)) return { status: "NO-EDITION-GATE", raw: null };
  try {
    const raw = JSON.parse(readFileSync(gatePath, "utf8"));
    return { status: raw?.spendingApprovalGate?.status ?? "NO-GATE-STATUS", raw };
  } catch {
    return { status: "GATE-UNREADABLE", raw: null };
  }
}

// Pure, testable: resolve which candidate tar carries the approved hash.
export function resolveApprovedTar(candidates, expectedSha) {
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const sha = createHash("sha256").update(readFileSync(p)).digest("hex");
    if (sha === expectedSha) return { path: p, sha };
  }
  return null;
}

// Freeze the already hash-approved bytes under a private random directory.
// Both the last quote and the paid upload consume this same snapshot, so a
// rebuild/replacement of pkg4.tar cannot swap bytes between those operations.
export function snapshotApprovedTar(artifact, expectedSha) {
  const dir = mkdtempSync(join(tmpdir(), "zblood-approved-"));
  const path = join(dir, basename(artifact.path));
  try {
    copyFileSync(artifact.path, path);
    const sha = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (sha !== expectedSha || sha !== artifact.sha)
      throw new Error("approved artifact changed while freezing upload bytes");
    return { path, sha, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

function decimalToUnits(value, decimals, label) {
  const text = String(value ?? "").trim();
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(text)) throw new Error(label + " must be a finite nonnegative decimal");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals)))
    throw new Error(label + " exceeds supported precision");
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction.slice(0, decimals) + "0".repeat(decimals)).slice(0, decimals));
}

// Pure spend boundary: malformed/missing quote data and malformed gate limits
// fail closed; the fresh quote must match the approved chunk count and remain
// within both independently approved asset ceilings.
export function validateQuoteAgainstGate(q, rawGate) {
  try {
    const storageAtto = decimalToUnits(q?.storage_cost_atto, 0, "quote.storage_cost_atto");
    const gasWei = decimalToUnits(q?.estimated_gas_cost_wei, 0, "quote.estimated_gas_cost_wei");
    const storageMaxAtto = decimalToUnits(rawGate?.separatedCeilings?.storageMaxAnt, 18, "gate.storageMaxAnt");
    const gasMaxWei = decimalToUnits(rawGate?.separatedCeilings?.gasMaxEth, 18, "gate.gasMaxEth");
    const actualChunks = Number(q?.chunk_count ?? q?.chunkCount);
    const approvedChunks = Number(rawGate?.quote?.chunkCount);
    if (!Number.isSafeInteger(actualChunks) || actualChunks < 0) throw new Error("quote.chunk_count must be a nonnegative safe integer");
    if (!Number.isSafeInteger(approvedChunks) || approvedChunks < 0) throw new Error("gate.quote.chunkCount must be a nonnegative safe integer");
    if (actualChunks !== approvedChunks) throw new Error("chunk count changed: quote=" + actualChunks + " approved=" + approvedChunks);
    if (storageAtto > storageMaxAtto) throw new Error("storage quote exceeds approved ANT ceiling");
    if (gasWei > gasMaxWei) throw new Error("gas quote exceeds approved ETH ceiling");
    return {
      ok: true,
      storageANT: Number(storageAtto) / 1e18,
      gasETH: Number(gasWei) / 1e18,
      chunkCount: actualChunks,
      bounds: { maxStorageANT: Number(rawGate.separatedCeilings.storageMaxAnt), maxGasETH: Number(rawGate.separatedCeilings.gasMaxEth), chunkCount: approvedChunks },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function revalidateApproval(gatePath, initialRaw, artifactSha, quote) {
  const fresh = editionGate(gatePath);
  if (fresh.status !== "APPROVED" || fresh.raw?.artifact?.tarSha256 !== artifactSha)
    return { ok: false, error: "approval was revoked or the approved artifact changed" };
  const initialShape = JSON.stringify({
    tarSha256: initialRaw?.artifact?.tarSha256,
    storageMaxAnt: initialRaw?.separatedCeilings?.storageMaxAnt,
    gasMaxEth: initialRaw?.separatedCeilings?.gasMaxEth,
    chunkCount: initialRaw?.quote?.chunkCount,
  });
  const freshShape = JSON.stringify({
    tarSha256: fresh.raw?.artifact?.tarSha256,
    storageMaxAnt: fresh.raw?.separatedCeilings?.storageMaxAnt,
    gasMaxEth: fresh.raw?.separatedCeilings?.gasMaxEth,
    chunkCount: fresh.raw?.quote?.chunkCount,
  });
  if (freshShape !== initialShape)
    return { ok: false, error: "approval hash, ceilings, or chunk count changed during the request" };
  const check = validateQuoteAgainstGate(quote, fresh.raw);
  return check.ok ? { ok: true, gate: fresh, check } : check;
}

export function receiptPathForArtifact(artifactSha, root = RECEIPT_ROOT) {
  if (!/^[0-9a-f]{64}$/.test(artifactSha || "")) throw new Error("receipt artifact sha256 is invalid");
  return join(root, "ETERNALIZATION-RECEIPT-" + artifactSha + ".json");
}

export function bankUploadReceipt(existing, receipt, rawGate = {}) {
  if (existing?.artifact?.tarSha256 && existing.artifact.tarSha256 !== receipt.artifactSha256)
    throw new Error("receipt artifact binding mismatch; refusing cross-edition update");
  const edition = existing || {
    schema: "skaists.eternalization-receipt/2",
    createdAt: receipt.uploadedAt,
    artifact: { tarSha256: receipt.artifactSha256, tarBytes: rawGate?.artifact?.tarBytes ?? null },
    approval: {
      statusAtUpload: rawGate?.spendingApprovalGate?.status ?? "unknown",
      storageMaxAnt: rawGate?.separatedCeilings?.storageMaxAnt ?? null,
      gasMaxEth: rawGate?.separatedCeilings?.gasMaxEth ?? null,
      chunkCount: rawGate?.quote?.chunkCount ?? null,
    },
    progression: [],
  };
  const progression = Array.isArray(edition.progression) ? edition.progression : [];
  let updated = false;
  edition.progression = progression.map((p) => {
    if (p?.state !== "uploaded") return p;
    updated = true;
    return { ...p, at: receipt.uploadedAt, result: receipt.result, artifactSha256: receipt.artifactSha256 };
  });
  if (!updated) edition.progression.push({ state: "uploaded", at: receipt.uploadedAt, result: receipt.result, artifactSha256: receipt.artifactSha256 });
  return edition;
}

function writeReceiptAtomic(path, edition) {
  const temp = path + ".tmp-" + process.pid + "-" + Date.now();
  writeFileSync(temp, JSON.stringify(edition, null, 1), "utf8");
  try { renameSync(temp, path); }
  catch (error) { try { unlinkSync(temp); } catch { /* best effort */ } throw error; }
}

function gateRefusal(gate) {
  return {
    error: "EDITION NOT APPROVED FOR SPEND",
    gateStatus: gate.status,
    rule: "the ETERNALIZATION-EDITION-V2 gate binds the exact tar sha256 + separated ceilings; NO upload runs while the gate is absent, unreadable, or not APPROVED. The superseded September pkg3 spend path is disabled by code (PR #296 review).",
  };
}

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body, null, 2));
};

async function antCmd(args) {
  const { stdout } = await exec("ant", ["--json", ...args], {
    env: { ...process.env },
    timeout: 300000,
  });
  return JSON.parse(stdout.trim().split("\n").pop());
}

async function antVersion() {
  const { stdout } = await exec("ant", ["--version"], { env: { ...process.env }, timeout: 30000 });
  return stdout.trim();
}

// The server only starts when this file is run directly — importing it (the
// tests, the preserve suite) must not bind a port.
export function isDirectExecution(argvPath = process.argv[1], moduleUrl = import.meta.url) {
  return !!argvPath && resolve(argvPath) === resolve(fileURLToPath(moduleUrl));
}
const isMain = isDirectExecution();

function startService() {
  createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];
  try {
    const gate = editionGate();
    const approved = gate.status === "APPROVED" && gate.raw?.artifact?.tarSha256;

    if (url === "/api/preserve/status") {
      const hasKey = !!process.env.SECRET_KEY;
      let wallet = null;
      if (hasKey) {
        try { wallet = await antCmd(["wallet", "address"]); } catch (e) { wallet = { error: e.message.slice(0, 80) }; }
      }
      let artifact = null;
      if (approved) artifact = resolveApprovedTar(CANDIDATE_TARS, gate.raw.artifact.tarSha256);
      return json(res, 200, {
        service: "zBlood preservation bridge", version: "2.0 (edition-gated)",
        keyInEnv: hasKey, // boolean only — never the key
        wallet,
        editionGate: { status: gate.status, approvedTarOnDisk: !!artifact, ceilings: gate.raw?.separatedCeilings ?? null },
        candidates: CANDIDATE_TARS.map((p) => ({ path: p, exists: existsSync(p) })),
      });
    }

    if (url === "/api/preserve/quote" && req.method === "GET") {
      if (!approved) return json(res, 409, gateRefusal(gate));
      const artifact = resolveApprovedTar(CANDIDATE_TARS, gate.raw.artifact.tarSha256);
      if (!artifact) return json(res, 409, { error: "APPROVED ARTIFACT NOT ON DISK", expectedSha: gate.raw.artifact.tarSha256, candidates: CANDIDATE_TARS });
      const q = await antCmd(["file", "cost", artifact.path]);
      const check = validateQuoteAgainstGate(q, gate.raw);
      if (!check.ok) {
        return json(res, 409, { error: "QUOTE REFUSED BY THE EDITION GATE", reason: check.error, quote: q,
          action: "STOP and requote/reapprove — the interface does not proceed on exceeded bounds" });
      }
      return json(res, 200, { quote: q, storageANT: check.storageANT, gasETH: check.gasETH, bounds: check.bounds, artifact: { path: artifact.path, sha256: artifact.sha },
        timestamp: new Date().toISOString(), confidence: q.confidence,
        qualifications: "display-only estimate; true cost reconciles at payment; storage and gas are separate obligations" });
    }

    if (url === "/api/preserve/upload" && req.method === "POST") {
      if (!process.env.SECRET_KEY) {
        return json(res, 503, { error: "PRESERVATION SERVICE NOT STARTED",
          hint: "The founder starts the service with SECRET_KEY in its environment — the key never enters chat, the repo, or a form. Start: SECRET_KEY=<key> node tools/genealogy/preserve-service.mjs" });
      }
      if (!approved) return json(res, 409, gateRefusal(gate));
      const artifact = resolveApprovedTar(CANDIDATE_TARS, gate.raw.artifact.tarSha256);
      if (!artifact) return json(res, 409, { error: "APPROVED ARTIFACT NOT ON DISK", expectedSha: gate.raw.artifact.tarSha256, action: "STOP — the exact approved bytes must be present before any spend" });
      const frozen = snapshotApprovedTar(artifact, gate.raw.artifact.tarSha256);
      try {
        // Optional metadata is captured before the irreversible operation and
        // cannot turn a successful paid upload into a 500 afterward.
        let clientVersion;
        try { clientVersion = await antVersion(); }
        catch (versionError) { clientVersion = "unavailable before upload: " + String(versionError.message || versionError).slice(0, 120); }
        // Fresh quote immediately before upload; both commands read the same
        // frozen, independently hash-verified snapshot.
        const q = await antCmd(["file", "cost", frozen.path]);
        const check = validateQuoteAgainstGate(q, gate.raw);
        if (!check.ok) return json(res, 409, { error: "UPLOAD REFUSED BY THE EDITION GATE", reason: check.error, quote: q });
        const finalApproval = revalidateApproval(DEFAULT_GATE, gate.raw, frozen.sha, q);
        if (!finalApproval.ok)
          return json(res, 409, { error: "UPLOAD REFUSED: APPROVAL CHANGED DURING REQUEST", reason: finalApproval.error });
        // THE UPLOAD — the service holds the key in env; the UI never sees it.
        const result = await antCmd(["file", "upload", frozen.path]);
        const receipt = {
          uploadedAt: new Date().toISOString(),
          clientVersion,
          result,
          quote: q,
          artifactSha256: frozen.sha,
          editionGateStatusAtUpload: gate.status,
          serviceNote: "uploaded from an immutable hash-verified snapshot through the edition-gated preservation service",
        };
        // Return the irreversible result even if the local progression file
        // cannot be updated; the response names that banking failure.
        try {
          const receiptPath = receiptPathForArtifact(frozen.sha);
          const existing = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : null;
          const editionReceipt = bankUploadReceipt(existing, receipt, finalApproval.gate.raw);
          writeReceiptAtomic(receiptPath, editionReceipt);
          receipt.receiptBank = "recorded in edition-specific receipt";
          receipt.receiptPath = receiptPath;
        } catch (bankError) {
          receipt.receiptBank = "FAILED: " + String(bankError.message || bankError).slice(0, 120);
        }
        return json(res, 200, receipt);
      } finally {
        try { frozen.cleanup(); } catch { /* paid result and response must survive best-effort cleanup failure */ }
      }
    }

    return json(res, 404, { error: "not found" });
  } catch (e) {
    return json(res, 500, { error: e.message?.slice(0, 200) || "service error" });
  }
  }).listen(PORT, () => console.log(`zBlood preservation service (edition-gated) on http://127.0.0.1:${PORT}`));
}

if (isMain) startService();
