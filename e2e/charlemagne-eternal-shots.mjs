// Charlemagne + Jack eternalized pages — screenshot receipt (390 + desktop).
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./node_modules/playwright/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SHOTS = join(ROOT, "e2e/shots-charlemagne-eternal");
const PORT = 8803;
const TYPES = { ".html": "text/html", ".json": "application/json", ".css": "text/css", ".mjs": "text/javascript" };

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const body = await readFile(join(ROOT, p.replace(/^\//, "")));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch();
let fails = 0;
const ok = (name, cond, extra = "") => { console.log((cond ? "  ✓ " : "  ✗ FAIL ") + name + (extra ? " — " + extra : "")); if (!cond) fails++; };

try {
  await mkdir(SHOTS, { recursive: true });
  for (const [label, file] of [["charlemagne", "p1790a81049.html"], ["jack-sutphen", "p3d44ccaffd.html"]]) {
    for (const [vp, w, h] of [["390", 390, 844], ["desktop", 1440, 900]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`http://127.0.0.1:${PORT}/assets/profile-archive/lineage/persons/${file}`);
      const h1 = await page.locator("h1").innerText();
      ok(`${label} ${vp}: page renders with identity`, h1.length > 3, h1);
      const packLink = await page.locator(`a[href*="evidence/"]`).count();
      ok(`${label} ${vp}: evidence-pack link present`, packLink >= 1);
      const bnr = await page.locator(".bnr").innerText();
      ok(`${label} ${vp}: BNR address present`, bnr.startsWith("bnr://skaists.dev/blood/"));
      const chip = await page.locator(".chip").first().innerText();
      ok(`${label} ${vp}: evidence chips render`, /era:/.test(chip));
      ok(`${label} ${vp}: zero page errors`, errors.length === 0, errors.join(";").slice(0, 120));
      await page.screenshot({ path: join(SHOTS, `${label}-${vp}.png`), fullPage: vp === "390" });
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(fails === 0 ? "SHOTS PASS" : "SHOTS FAIL — " + fails);
process.exitCode = fails === 0 ? 0 : 1;
