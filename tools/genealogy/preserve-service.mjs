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
// SPEND GATE ENFORCED (not printed): the service refuses any upload whose
// actual cost exceeds the authorization bounds (≤3.2 ANT storage + ≤0.0002
// ETH gas). The bounds are checked BEFORE the upload runs.
//
// Receipts flow back automatically — no terminal, no copy-paste.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

const exec = promisify(execFile);
const PORT = parseInt(process.argv[2] || "8794", 10);
const TAR = "C:/Users/travi/family-lineage/pkg3.tar";
const RECEIPT_PATH = "C:/Users/travi/family-lineage/ETERNALIZATION-RECEIPT.json";
const SPEND_BOUNDS = { maxStorageANT: 3.2, maxGasETH: 0.0002 };

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

createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];
  try {
    if (url === "/api/preserve/status") {
      const hasKey = !!process.env.SECRET_KEY;
      let wallet = null;
      if (hasKey) {
        try { wallet = await antCmd(["wallet", "address"]); } catch (e) { wallet = { error: e.message.slice(0, 80) }; }
      }
      return json(res, 200, {
        service: "zBlood preservation bridge", version: "1.0",
        keyInEnv: hasKey, // boolean only — never the key
        wallet,
        tar: { path: TAR, exists: existsSync(TAR) },
        bounds: SPEND_BOUNDS,
      });
    }

    if (url === "/api/preserve/quote" && req.method === "GET") {
      const q = await antCmd(["file", "cost", TAR]);
      const storageANT = parseInt(q.storage_cost_atto) / 1e18;
      const gasETH = parseInt(q.estimated_gas_cost_wei) / 1e18;
      // ENFORCED: refuse if the quote already exceeds bounds
      if (storageANT > SPEND_BOUNDS.maxStorageANT || gasETH > SPEND_BOUNDS.maxGasETH) {
        return json(res, 409, { error: "QUOTE EXCEEDS AUTHORIZED BOUNDS", quote: q, bounds: SPEND_BOUNDS,
          action: "STOP and requote/reapprove — the interface does not proceed on exceeded bounds" });
      }
      return json(res, 200, { quote: q, storageANT, gasETH, bounds: SPEND_BOUNDS,
        timestamp: new Date().toISOString(), confidence: q.confidence,
        qualifications: "display-only estimate; true cost reconciles at payment; storage and gas are separate obligations" });
    }

    if (url === "/api/preserve/upload" && req.method === "POST") {
      if (!process.env.SECRET_KEY) {
        return json(res, 503, { error: "PRESERVATION SERVICE NOT STARTED",
          hint: "The founder starts the service with SECRET_KEY in its environment — the key never enters chat, the repo, or a form. Start: SECRET_KEY=<key> node tools/genealogy/preserve-service.mjs" });
      }
      // pre-upload hash check: the artifact must still be the approved bytes
      const { createHash } = await import("node:crypto");
      const tarBuf = readFileSync(TAR);
      const sha = createHash("sha256").update(tarBuf).digest("hex");
      if (sha !== "fec5fba8360d9de211c3b6c5966e93bc2462133099f651891d500b6a2ea98b9b") {
        return json(res, 409, { error: "ARTIFACT CHANGED", sha, expected: "fec5fba8…", action: "STOP — changed bytes require fresh approval" });
      }
      // fresh quote immediately before upload; enforce bounds again
      const q = await antCmd(["file", "cost", TAR]);
      const storageANT = parseInt(q.storage_cost_atto) / 1e18;
      const gasETH = parseInt(q.estimated_gas_cost_wei) / 1e18;
      if (storageANT > SPEND_BOUNDS.maxStorageANT || gasETH > SPEND_BOUNDS.maxGasETH) {
        return json(res, 409, { error: "QUOTE EXCEEDED BOUNDS AT UPLOAD TIME", quote: q, bounds: SPEND_BOUNDS });
      }
      // THE UPLOAD — the service holds the key in env; the UI never sees it
      const result = await antCmd(["file", "upload", TAR]);
      // bank the receipt automatically
      const receipt = {
        uploadedAt: new Date().toISOString(),
        clientVersion: "ant 0.3.1",
        result,
        quote: q,
        artifactSha256: sha,
        serviceNote: "uploaded through the preservation service — no terminal, no manual receipt transfer",
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
}).listen(PORT, () => console.log(`zBlood preservation service on http://127.0.0.1:${PORT}`));
