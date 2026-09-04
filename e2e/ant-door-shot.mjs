// e2e/ant-door-shot.mjs — THE RECEIPT for the same-origin Autonomi door:
// the surface at 390px, rendering Autonomi bytes, with EVERY network request
// logged and asserted same-origin. Run: node e2e/ant-door-shot.mjs
import { chromium } from "playwright";

const URL = "https://relay.skaists.dev/ant-door.html";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const requests = [];
page.on("request", (r) => requests.push(r.url()));
page.on("pageerror", (e) => console.log("PAGE-ERROR:", e.message));

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(9000); // the Autonomi fetch can take a few seconds (network)

// assertions — every success renders a named value
const badge = await page.locator("#state-badge").innerText();
const imgOk = await page.locator("img#content").count();
const imgVisible = imgOk ? await page.locator("img#content").isVisible() : false;
const hasBytes = /BYTES/.test(badge);
console.log("badge:", JSON.stringify(badge));
console.log("image rendered:", imgOk === 1 && imgVisible, "| bytes badge:", hasBytes);

const sameOrigin = requests.filter((u) => !u.startsWith("https://relay.skaists.dev/") && !u.startsWith("blob:")); // blob: URLs are the RENDERED object — same origin by construction, never a network hop
console.log("requests (" + requests.length + "):");
for (const r of requests) console.log("  " + r.replace("https://relay.skaists.dev", ""));
console.log("NON-SAME-ORIGIN REQUESTS:", sameOrigin.length === 0 ? "NONE ✓" : sameOrigin);

await page.screenshot({ path: "e2e/shots-ant-door/ant-door-390.png", fullPage: true });
console.log("SCREENSHOT: e2e/shots-ant-door/ant-door-390.png");

const pass = imgOk === 1 && imgVisible && hasBytes && sameOrigin.length === 0 && requests.length > 0;
console.log(pass ? "RECEIPT PASS" : "RECEIPT FAIL");
await browser.close();
process.exit(pass ? 0 : 1);
