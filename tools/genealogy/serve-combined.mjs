// serve-combined.mjs — one command to hand the combined prototype to a human.
//   node tools/genealogy/serve-combined.mjs [--study]
// Prints the URL (with ?study=1 when --study) and serves the worktree root.
// For the curiosity receipt: open the printed URL, browse with NO COACHING,
// click the receipt chip when done, then run:
//   node tools/genealogy/gux01-curiosity-analyze.mjs <downloaded json>
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const study = process.argv.includes("--study");

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const body = await readFile(join(ROOT, p.replace(/^\//, "")));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("no"); }
});
server.listen(8790, "127.0.0.1", () => {
  console.log("combined prototype: http://127.0.0.1:8790/tools/genealogy/gux01-combined-demo.html" + (study ? "?study=1" : ""));
  if (study) console.log("curiosity study ON — navigation events only; download the receipt chip when done, then:\n  node tools/genealogy/gux01-curiosity-analyze.mjs gux01-curiosity-receipt.json");
  console.log("ctrl+c to stop");
});
