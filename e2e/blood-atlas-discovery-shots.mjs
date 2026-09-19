// Discovery-rail screenshot receipt — derived first-load cards + route reveal.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright"; // machine-level resolution (~/node_modules walk-up);

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SHOTS = join(ROOT, "e2e/shots-blood-atlas-discovery");
const PORT = 8805;
const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };

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
  for (const [vp, w, h] of [["390", 390, 844], ["desktop", 1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/tools/genealogy/blood-atlas-harness.html`);
    await page.waitForSelector('#atlas-mount[data-atlas-ready="1"]', { timeout: 30000 });
    await page.waitForSelector("#atlas-cards [data-card]", { timeout: 10000 });
    const cardKinds = await page.locator("#atlas-cards [data-card]").evaluateAll((els) => [...new Set(els.map((e) => e.dataset.card))].sort());
    ok(`${vp}: discovery rail renders all five derived kinds`, JSON.stringify(cardKinds) === JSON.stringify(["branch", "collapse", "correction", "frontier", "route"]), cardKinds.join(","));
    const nCards = await page.locator("#atlas-cards [data-card]").count();
    ok(`${vp}: bounded card set (≤24, all derived)`, nCards >= 10 && nCards <= 24, String(nCards) + " cards");
    const depthNotes = await page.locator("#atlas-cards [data-card]").allInnerTexts();
    const counted = depthNotes.filter((t) => /▾ \d+/.test(t));
    ok(`${vp}: every counted card shows its depth (the UI law)`, counted.length > 0 && counted.every((t) => /within \d+ generations|whole published archive/.test(t)), counted.length + " counted cards");
    await page.screenshot({ path: join(SHOTS, `discovery-rail-${vp}.png`), fullPage: vp === "390" });
    // route reveal: the deepest/first route card
    await page.locator("#atlas-cards [data-card='route']").first().click();
    await page.waitForSelector("#atlas-route[data-route-len]", { timeout: 10000 });
    const len = await page.locator("#atlas-route").getAttribute("data-route-len");
    const hops = await page.locator("#atlas-route [data-hop]").count();
    ok(`${vp}: route reveal draws every hop as a published person`, +len >= 5 && hops === +len + 1, len + " hops");
    await page.screenshot({ path: join(SHOTS, `route-reveal-${vp}.png`), fullPage: false });
    // clicking a hop selects
    await page.locator("#atlas-route [data-hop]").nth(2).click();
    await page.waitForSelector(".atlas-cell.atlas-sel, .atlas-row.atlas-sel", { timeout: 5000 });
    const t = await page.locator("#atlas-ctx").innerText();
    ok(`${vp}: hop click selects (navigation into the story)`, t.includes("selection:"), t.replace(/\s+/g, " ").slice(0, 90));
    // frontier card reroots to the nearest edge
    await page.locator("#atlas-cards [data-card='frontier']").click();
    await page.waitForSelector(".atlas-cell.atlas-ghost", { timeout: 10000 });
    ok(`${vp}: frontier card walks to the dashed edge (Martha Steward)`, (await page.locator(".atlas-cell.atlas-ghost").count()) === 2);
    await page.screenshot({ path: join(SHOTS, `frontier-card-${vp}.png`), fullPage: false });
    ok(`${vp}: zero page errors`, errors.length === 0, errors.join(";").slice(0, 120));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(fails === 0 ? "DISCOVERY PASS" : "DISCOVERY FAIL — " + fails);
process.exitCode = fails === 0 ? 0 : 1;
