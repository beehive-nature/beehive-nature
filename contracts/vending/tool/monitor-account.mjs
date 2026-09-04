// monitor-account.mjs — search bnrapolltest in the official Jungle monitor's
// global search; land on whatever account page it opens; verify real chain
// state renders; screenshot.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://monitor.jungletestnet.io/", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(8000);

const box = page.locator("#globalSearch");
await box.fill("bnrapolltest");
await box.press("Enter");
await page.waitForTimeout(9000); // let the account view fetch
const url = page.url();
const text = (await page.locator("body").innerText().catch(() => "")) || "";
const has = {
  name: text.includes("bnrapolltest"),
  created: text.includes("2026-08-29"),
  ram: /28[0-9][.,]?[0-9]*\s*KiB/i.test(text) || text.includes("RAM") || text.includes("ram"),
  cpu: text.includes("CPU") || /2\.2[0-9]?\s*(s|sec)/i.test(text),
  eos: text.includes("EOS"),
};
console.log(JSON.stringify({ url, has, title: await page.title(), textLen: text.length }, null, 1));
await page.screenshot({ path: "monitor-account.png", fullPage: false });
writeFileSync("monitor-account.txt", "URL: " + url + "\n\n" + text.slice(0, 5000));
console.log("SCREENSHOT: monitor-account.png  (full text in monitor-account.txt)");
await browser.close();
