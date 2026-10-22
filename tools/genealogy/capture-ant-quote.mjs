// Banked, keyless Autonomi quote capture for one exact artifact.
// No wallet command and no upload command are reachable from this file.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const exec = promisify(execFile);

export async function captureAntQuote(artifactPath, antExecutable = "ant") {
  const path = resolve(artifactPath);
  const scratch = mkdtempSync(join(tmpdir(), "skaists-ant-quote-"));
  const snapshot = join(scratch, "artifact.tar");
  try {
    copyFileSync(path, snapshot);
    const bytes = statSync(snapshot).size;
    const sha256 = createHash("sha256").update(readFileSync(snapshot)).digest("hex");
    const versionRun = await exec(antExecutable, ["--version"], { timeout: 30000 });
    const clientVersion = versionRun.stdout.trim();
    const quoteRun = await exec(antExecutable, ["--json", "file", "cost", snapshot], { timeout: 300000 });
    const quote = JSON.parse(quoteRun.stdout.trim().split(/\r?\n/).at(-1));
    const afterBytes = statSync(snapshot).size;
    const afterSha256 = createHash("sha256").update(readFileSync(snapshot)).digest("hex");
    if (Number(quote.file_size) !== bytes) throw new Error("quote file_size does not match the hashed snapshot");
    if (afterBytes !== bytes || afterSha256 !== sha256) throw new Error("quoted snapshot changed during capture");
    return {
      schema: "skaists.ant-quote-capture/1",
      capturedAt: new Date().toISOString(),
      command: [antExecutable, "--json", "file", "cost", "<private snapshot>"],
      clientVersion,
      artifact: { path, bytes, sha256 },
      quote,
      boundary: "keyless quote on a private byte-verified snapshot; no wallet access, payment, or upload",
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  if (!process.argv[2]) throw new Error("usage: node capture-ant-quote.mjs <artifact> [ant-executable]");
  console.log(JSON.stringify(await captureAntQuote(process.argv[2], process.argv[3] || "ant"), null, 2));
}
