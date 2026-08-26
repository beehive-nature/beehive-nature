// shoot.mjs — 390px receipt screenshots for the hex demo (square vs hex).
// Uses the estate's playwright from beehive-nature/e2e (on-disk, zero install).
import { chromium } from "file:///C:/Users/travi/beehive-nature/e2e/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "..", "shots");
const URL = "http://127.0.0.1:8944/demo/";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("console", (m) => {
	if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200));
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("st-cells")?.textContent !== "—", null, { timeout: 15000 });
await page.waitForTimeout(400); // paint settle

const stats = async () => ({
	cells: await page.textContent("#st-cells"),
	colours: await page.textContent("#st-colours"),
	ms: await page.textContent("#st-ms"),
});

// square mode (default)
console.log("square:", JSON.stringify(await stats()));
await page.screenshot({ path: join(SHOTS, "square-390.png"), fullPage: true });

// hex mode, pointy-top, diffusion
await page.click('#seg-mode button[data-v="hex"]');
await page.waitForTimeout(500);
console.log("hex pointy:", JSON.stringify(await stats()));
await page.screenshot({ path: join(SHOTS, "hex-pointy-390.png"), fullPage: true });

// hex flat-top
await page.click('#seg-orient button[data-v="flat"]');
await page.waitForTimeout(500);
console.log("hex flat:", JSON.stringify(await stats()));
await page.screenshot({ path: join(SHOTS, "hex-flat-390.png"), fullPage: true });

// hex ordered dither
await page.click('#seg-orient button[data-v="pointy"]');
await page.click('#seg-dither button[data-v="ordered"]');
await page.waitForTimeout(500);
console.log("hex ordered:", JSON.stringify(await stats()));
await page.screenshot({ path: join(SHOTS, "hex-ordered-390.png"), fullPage: true });

await browser.close();
console.log("OK shots ->", SHOTS);
