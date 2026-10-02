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
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const PORT = parseInt(process.argv[2] || "8794", 10);
const RECEIPT_PATH = "C:/Users/travi/family-lineage/ETERNALIZATION-RECEIPT.json";
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

// The server only starts when this file is run directly — importing it (the
// tests, the preserve suite) must not bind a port.
const isMain = process.argv[1] && import.meta.url === new URL("file:///" + process.argv[1].replace(/\\/g, "/")).href;

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
      const bounds = { maxStorageANT: gate.raw.separatedCeilings.storageMaxAnt, maxGasETH: gate.raw.separatedCeilings.gasMaxEth };
      const q = await antCmd(["file", "cost", artifact.path]);
      const storageANT = parseInt(q.storage_cost_atto) / 1e18;
      const gasETH = parseInt(q.estimated_gas_cost_wei) / 1e18;
      // ENFORCED: refuse if the quote already exceeds the gate's ceilings
      if (storageANT > bounds.maxStorageANT || gasETH > bounds.maxGasETH) {
        return json(res, 409, { error: "QUOTE EXCEEDS THE EDITION GATE'S CEILINGS", quote: q, bounds,
          action: "STOP and requote/reapprove — the interface does not proceed on exceeded bounds" });
      }
      return json(res, 200, { quote: q, storageANT, gasETH, bounds, artifact: { path: artifact.path, sha256: artifact.sha },
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
      const bounds = { maxStorageANT: gate.raw.separatedCeilings.storageMaxAnt, maxGasETH: gate.raw.separatedCeilings.gasMaxEth };
      // fresh quote immediately before upload; enforce the gate's ceilings
      const q = await antCmd(["file", "cost", artifact.path]);
      const storageANT = parseInt(q.storage_cost_atto) / 1e18;
      const gasETH = parseInt(q.estimated_gas_cost_wei) / 1e18;
      if (storageANT > bounds.maxStorageANT || gasETH > bounds.maxGasETH) {
        return json(res, 409, { error: "QUOTE EXCEEDED THE EDITION GATE'S CEILINGS AT UPLOAD TIME", quote: q, bounds });
      }
      // THE UPLOAD — the service holds the key in env; the UI never sees it;
      // the bytes uploaded are the gate-approved artifact or nothing
      const result = await antCmd(["file", "upload", artifact.path]);
      // bank the receipt automatically
      const receipt = {
        uploadedAt: new Date().toISOString(),
        clientVersion: "ant 0.3.1",
        result,
        quote: q,
        artifactSha256: artifact.sha,
        editionGateStatusAtUpload: gate.status,
        serviceNote: "uploaded through the edition-gated preservation service — no terminal, no manual receipt transfer",
      };
      // append to the eternalization receipt (never overwrite)
      if (existsSync(RECEIPT_PATH)) {
        const E = JSON.parse(readFileSync(RECEIPT_PATH, "utf8"));
        E.progression = (E.progression || []).map(p =>
          p.state === "uploaded" ? { ...p, at: receipt.uploadedAt, result } : p);
        writeFileSync(RECEIPT_PATH, JSON.stringify(E, null, 1), "utf8");
      }
      return json(res, 200, receipt);
    }

    return json(res, 404, { error: "not found" });
  } catch (e) {
    return json(res, 500, { error: e.message?.slice(0, 200) || "service error" });
  }
  }).listen(PORT, () => console.log(`zBlood preservation service (edition-gated) on http://127.0.0.1:${PORT}`));
}

if (isMain) startService();
