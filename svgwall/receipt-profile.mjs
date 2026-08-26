// receipt-profile.mjs — LIVE receipt for the holder surface: 390px phone,
// real address, real chain art, and the complete request ledger proving
// zero off-origin beyond the public RPC.
import { chromium } from "file:///C:/Users/travi/beehive-nature/e2e/node_modules/playwright/index.mjs";

const PAGE = "https://beehive-nature.github.io/beehive-nature/surfaces/blight/profile.html";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const ledger = [];
await page.route("**/*", async (route) => {
	ledger.push({ host: new URL(route.request().url()).host, type: route.request().resourceType() });
	await route.continue();
});
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });

await page.goto(PAGE, { waitUntil: "load" });
await page.click("#chip-founder");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("rendered from chain"), null, { timeout: 90000 });
await p2c();
await page.waitForTimeout(2500);
const d = await p2c();
console.log(JSON.stringify(d, null, 1));
const hosts = {};
for (const r of ledger) hosts[r.host] = (hosts[r.host] ?? 0) + 1;
console.log("REQUEST LEDGER:", JSON.stringify(ledger.map((r) => r.host)));
console.log("HOST SUMMARY:", JSON.stringify(hosts));
console.log("ERRORS:", errs.length ? errs : "none");
await page.screenshot({ path: "svgwall/shots/profile-live-390.png", fullPage: true });
await browser.close();

async function p2c() {
	return page.evaluate(() => ({
		short: document.getElementById("short").textContent,
		pieces: document.getElementById("st-pieces").textContent,
		reads: document.getElementById("st-reads").textContent,
		tokens: document.getElementById("st-tokens").textContent,
		pfpSvg: !!document.querySelector("#pfp svg"),
		wall: document.querySelectorAll("#wall .piece").length,
		chips: [...document.querySelectorAll("#chips .chip")].map((c) => c.textContent.trim()),
		msg: document.getElementById("msg").textContent,
	}));
}
