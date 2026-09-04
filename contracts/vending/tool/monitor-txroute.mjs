// monitor-txroute.mjs — discover the monitor's tx deep-link route: search a
// known tx id in the global search, read the URL it lands on + the data it
// renders. usage: node monitor-txroute.mjs <txid>
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const txid = process.argv[2];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://monitor.jungletestnet.io/", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(8000);
const box = page.locator("#globalSearch");
await box.fill(txid);
await box.press("Enter");
await page.waitForTimeout(10000);
const url = page.url();
const text = (await page.locator("body").innerText().catch(() => "")) || "";
const i = text.indexOf(txid.slice(0, 12));
console.log(JSON.stringify({
  url,
  txRendered: i >= 0,
  context: i >= 0 ? text.slice(Math.max(0, i - 300), i + 900) : "(tx not in DOM)",
}, null, 1));
await page.screenshot({ path: "monitor-tx-route.png" });
writeFileSync("monitor-tx-route.txt", "URL: " + url + "\n\n" + text);
await browser.close();
