// e2e/ant-door-shot.mjs — THE RECEIPT for the same-origin Autonomi door:
// the surface at 390px, rendering Autonomi bytes, with EVERY network request
// logged and asserted same-origin. Run: node e2e/ant-door-shot.mjs
// BRAVE=1 runs it in founder-Brave (Shields default ON) — the honest browser.
import { chromium } from "playwright";

const URL = "https://relay.skaists.dev/ant-door.html";
const brave = process.env.BRAVE === "1";
const browser = await chromium.launch({
  args: ["--no-sandbox"],
  ...(brave ? { executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe" } : {}),
});
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
// BROKEN-IMAGE LAW: isVisible() passes on a FAILED load (alt text is "visible");
// only naturalWidth proves the bytes DECODED into pixels — the Brave-Shields
// broken-image bug shipped because the receipt never checked this.
const imgLoaded = imgOk ? await page.locator("img#content").evaluate(el => el.complete && el.naturalWidth > 0) : false;
const hasBytes = /BYTES/.test(badge);
console.log("badge:", JSON.stringify(badge));
console.log("image painted (naturalWidth):", imgLoaded, "| visible:", imgVisible, "| bytes badge:", hasBytes);

const sameOrigin = requests.filter((u) => !u.startsWith("https://relay.skaists.dev/") && !u.startsWith("data:")); // data: URLs are the RENDERED object — in-page by construction, never a network hop
console.log("requests (" + requests.length + "):");
for (const r of requests) console.log("  " + r.replace("https://relay.skaists.dev", ""));
console.log("NON-SAME-ORIGIN REQUESTS:", sameOrigin.length === 0 ? "NONE ✓" : sameOrigin);

await page.screenshot({ path: `e2e/shots-ant-door/ant-door-390${brave ? "-brave-shields" : ""}.png`, fullPage: true });
console.log(`SCREENSHOT: e2e/shots-ant-door/ant-door-390${brave ? "-brave-shields" : ""}.png`);

const pass = imgOk === 1 && imgVisible && imgLoaded && hasBytes && sameOrigin.length === 0 && requests.length > 0;
console.log((brave ? "[BRAVE·SHIELDS-ON] " : "") + (pass ? "RECEIPT PASS" : "RECEIPT FAIL"));
await browser.close();
process.exit(pass ? 0 : 1);
