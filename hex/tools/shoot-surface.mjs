// shoot-surface.mjs — drive the LIVE pixelrefiner surface at 390px: FUNGI
// sheet → square refine → hex refine. Screenshots both. Estate playwright rail.
import { chromium } from "file:///C:/Users/travi/beehive-nature/e2e/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "..", "shots");
const URL = process.argv[2] ?? "http://127.0.0.1:8946/surfaces/blight/pixelrefiner.html";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

await page.goto(URL, { waitUntil: "load" });
await page.click("#fungi");
await page.waitForFunction(() => document.getElementById("dl")?.disabled === false, null, { timeout: 20000 });
await page.waitForTimeout(400);

const status = () => page.textContent("#status");
const outSize = () => page.textContent("#outSize");

console.log("square status:", await status());
console.log("square outSize:", await outSize());
await page.screenshot({ path: join(SHOTS, "surface-square-390.png"), fullPage: true });

// → hex cells + hex diffusion + REFINE
await page.selectOption("#shape", "hex");
await page.selectOption("#dither", "hex-diffuse");
await page.click("#go");
await page.waitForFunction(() => document.getElementById("outSize")?.textContent.includes("hexes"), null, { timeout: 20000 });
await page.waitForTimeout(400);
console.log("hex status:", await status());
console.log("hex outSize:", await outSize());
await page.screenshot({ path: join(SHOTS, "surface-hex-390.png"), fullPage: true });

// flat-top sanity (no screenshot needed for the receipt)
await page.selectOption("#orient", "flat");
await page.click("#go");
await page.waitForFunction(() => document.getElementById("outSize")?.textContent.includes("flat-top"), null, { timeout: 20000 });
console.log("flat outSize:", await outSize());

// back to square — the default path must still work after hex ran
await page.selectOption("#shape", "square");
await page.click("#go");
await page.waitForFunction(() => document.getElementById("outSize")?.textContent.includes("px"), null, { timeout: 20000 });
console.log("back-to-square status:", await status());
await page.screenshot({ path: join(SHOTS, "surface-back-to-square-390.png"), fullPage: true });

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
console.log("OK shots ->", SHOTS);
