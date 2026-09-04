// e2e/ant-door-cors-shot.mjs — THE RECEIPT for the hardened door's CORS read
// grant: a page served from https://skaists.dev (GitHub Pages) cross-origin
// GETs the estate door on relay.skaists.dev and renders the Autonomi bytes.
// Proves: CORS allow-origin lands, GET-only holds, the read works from the
// estate's public front door origin. Run: node e2e/ant-door-cors-shot.mjs
import { chromium } from "playwright";

const URL = "https://skaists.dev/ant-door-cors.html";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const requests = [];
page.on("request", (r) => requests.push(r.url()));
page.on("pageerror", (e) => console.log("PAGE-ERROR:", e.message));

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(9000); // the Autonomi fetch can take a few seconds

const badge = await page.locator("#state-badge").innerText();
const imgVisible = await page.locator("img#content").isVisible();
console.log("badge:", JSON.stringify(badge));
console.log("image rendered:", imgVisible);

const doorHit = requests.some(u => u.startsWith("https://relay.skaists.dev/ant/v1/data/public/"));
const others = requests.filter(u => !u.startsWith("https://skaists.dev/") && !u.startsWith("blob:") && !u.startsWith("https://relay.skaists.dev/ant/"));
console.log("requests (" + requests.length + "):");
for (const r of requests) console.log("  " + r);
console.log("door hit (cross-origin GET):", doorHit ? "YES ✓" : "NO ✗");
console.log("unexpected third-party requests:", others.length === 0 ? "NONE ✓" : others);

await page.screenshot({ path: "e2e/shots-ant-door/ant-door-cors-390.png", fullPage: true });
console.log("SCREENSHOT: e2e/shots-ant-door/ant-door-cors-390.png");

const pass = imgVisible && /BYTES.*CROSS-ORIGIN.*LIVE/.test(badge) && doorHit && others.length === 0;
console.log(pass ? "RECEIPT PASS" : "RECEIPT FAIL");
await browser.close();
process.exit(pass ? 0 : 1);
