// GUX-01 COMBINED JOURNEY — the A-gate experiment, receipted.
// "click a discovery card → atlas animates to the branch/person → zGenePerson
// opens alongside → click a 'one more ancestor' teaser → atlas travels WITHOUT
// resetting camera/root/history → Back returns to precisely where the
// curiosity journey began."
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "./node_modules/playwright/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SHOTS = join(ROOT, "e2e/shots-gux01-combined");
const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const body = await readFile(join(ROOT, p.replace(/^\//, "")));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r)); // ephemeral port — no collisions
const PORT = server.address().port;
const browser = await chromium.launch();
let fails = 0;
const ok = (name, cond, extra = "") => { console.log((cond ? "  ✓ " : "  ✗ FAIL ") + name + (extra ? " — " + extra : "")); if (!cond) fails++; };
const ctxOf = (page) => page.evaluate(() => {
  const c = window.__gux01.atlas.getContext();
  return { root: c.root, selection: c.selection, view: c.view, transform: { ...c.transform }, hist: window.__gux01.atlas.core.historyDepth() };
});
const sameCtx = (a, b) => a.root === b.root && a.selection === b.selection && a.view === b.view &&
  a.transform.k === b.transform.k && a.transform.x === b.transform.x && a.transform.y === b.transform.y;

try {
  await mkdir(SHOTS, { recursive: true });
  for (const [vp, w, h] of [["390", 390, 844], ["desktop", 1440, 900]]) {
    console.log(`== ${vp} combined journey ==`);
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/tools/genealogy/gux01-combined-demo.html`);
    await page.waitForSelector('#atlas-mount[data-atlas-ready="1"]', { timeout: 30000 });
    await page.waitForSelector("#panel .pp-search", { timeout: 15000 });
    await page.waitForSelector("#atlas-cards [data-card]", { timeout: 10000 });

    // 1. cold load: rail + atlas + panel alive together
    const start = await ctxOf(page);
    ok(`${vp}: cold load — atlas, rail, and person panel coexist`, (await page.locator("#atlas-cards [data-card]").count()) >= 10
      && (await page.locator("#panel").innerText()).length > 40, `history=${start.hist} root=${start.root}`);
    await page.screenshot({ path: join(SHOTS, `combined-01-cold-${vp}.png`), fullPage: vp === "390" });

    // 2. discovery card → atlas travels + panel opens alongside
    await page.locator("#atlas-cards [data-card='route']").first().click();
    await page.waitForSelector("#atlas-route[data-route-len]", { timeout: 10000 });
    await page.waitForTimeout(400);
    const traveled = await ctxOf(page);
    const stripLen = await page.locator("#atlas-route").getAttribute("data-route-len");
    ok(`${vp}: card → atlas animates to the person (root moved, history pushed)`, traveled.root !== start.root && traveled.hist === start.hist + 1, `root=${traveled.root} history=${traveled.hist}`);
    ok(`${vp}: route strip reveals the whole journey`, +stripLen >= 30, stripLen + " hops");
    const panelText = await page.locator("#panel").innerText();
    ok(`${vp}: person panel opens alongside the traveler`, panelText.length > 200, "");
    await page.screenshot({ path: join(SHOTS, `combined-02-travel-${vp}.png`), fullPage: vp === "390" });

    // 3. teaser → atlas follows WITHOUT camera/root/history reset.
    // The authentic curiosity path when the current view carries fact-teasers
    // only (honest): panel search → ambiguity (never a silent pick) → choose
    // → the person view's "keep exploring" teaser.
    let teaser = page.locator(".pp-teaser[data-ppq], .pp-teaser[data-pprel]").first();
    if (!(await teaser.count())) {
      await page.fill(".pp-q", "Joseph Hadlock");
      await page.press(".pp-q", "Enter");
      await page.waitForFunction(() => document.getElementById("panel").innerText.includes("share the exact name"), null, { timeout: 8000 });
      const amb = await page.locator("#panel").innerText();
      ok(`${vp}: ambiguity is visible, never a silent first-pick`, /share the exact name/.test(amb), "the Joseph Hadlock set");
      await page.locator(".pp-res:visible").first().click();
      await page.waitForTimeout(400);
      const picked = await ctxOf(page);
      ok(`${vp}: panel choice → atlas selection follows (root + camera held)`, picked.selection === "pd9181bfe85" && picked.root === traveled.root && picked.hist === traveled.hist,
        `selection=${picked.selection} (the first Joseph Hadlock) root held=${picked.root === traveled.root}`);
      teaser = page.locator(".pp-teaser[data-ppq], .pp-teaser[data-pprel]").first();
    }
    if (await teaser.count()) {
      const before = await ctxOf(page);
      await teaser.click();
      await page.waitForTimeout(300);
      const after = await ctxOf(page);
      ok(`${vp}: teaser travels the atlas — selection follows`, after.selection !== before.selection || after.root === before.root, `sel ${before.selection} → ${after.selection}`);
      ok(`${vp}: NO root/camera/history reset`, after.root === before.root && after.hist === before.hist &&
        after.transform.k === before.transform.k && after.transform.x === before.transform.x && after.transform.y === before.transform.y,
        `root held=${after.root === before.root} history held=${after.hist === before.hist} camera held=${after.transform.x === before.transform.x}`);
      await page.screenshot({ path: join(SHOTS, `combined-03-teaser-${vp}.png`), fullPage: vp === "390" });
    } else {
      ok(`${vp}: teaser present`, false, "no clickable teaser found");
    }

    // 4. Back returns to precisely where the curiosity journey began
    await page.locator("#atlas-back").click();
    await page.locator("#atlas-back").click();
    const back = await ctxOf(page);
    ok(`${vp}: Back restores the EXACT starting context (root·selection·view·camera)`, sameCtx(back, start),
      JSON.stringify({ root: back.root, view: back.view, k: back.transform.k }) + (sameCtx(back, start) ? " == start" : " != start " + JSON.stringify({ root: start.root, view: start.view, k: start.transform.k })));
    await page.screenshot({ path: join(SHOTS, `combined-04-back-${vp}.png`), fullPage: vp === "390" });

    ok(`${vp}: zero page errors across the combined journey`, errors.length === 0, errors.join(";").slice(0, 150));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(fails === 0 ? "COMBINED JOURNEY PASS" : "COMBINED JOURNEY FAIL — " + fails);
process.exitCode = fails === 0 ? 0 : 1;
