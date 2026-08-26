// shoot-demo.mjs — drive svgwall/index.html through its auto sequence,
// print every number from the page, screenshot both walls with their numbers.
import { chromium } from "file:///C:/Users/travi/beehive-nature/e2e/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://127.0.0.1:8947/svgwall/index.html";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 150)); });
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));

await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("foot")?.textContent.includes("Receipt."), null, { timeout: 180000 });
await page.waitForTimeout(1500);

const nums = await page.evaluate(() => ({
	fps: document.getElementById("g-fps").textContent,
	longTasks: document.getElementById("g-lt").textContent,
	longTaskMs: document.getElementById("g-ltms").textContent,
	heap: document.getElementById("g-heap").textContent,
	inline: {
		mountMs: document.getElementById("a-build").textContent,
		nodes: document.getElementById("a-nodes").textContent,
		rerenderMs: document.getElementById("a-re").textContent,
		minFps: document.getElementById("a-fps").textContent,
	},
	dataUri: {
		mountMs: document.getElementById("b-build").textContent,
		nodes: document.getElementById("b-nodes").textContent,
		rerenderMs: document.getElementById("b-re").textContent,
		minFps: document.getElementById("b-fps").textContent,
	},
	foot: document.getElementById("foot").textContent,
}));

console.log(JSON.stringify({ ...nums, consoleErrors: errs.length ? errs : "none" }, null, 1));
await page.screenshot({ path: "svgwall/shots/demo-both-walls.png", fullPage: true });
await browser.close();
