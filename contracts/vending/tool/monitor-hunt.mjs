// monitor-hunt.mjs — the official Jungle monitor: does it render account
// state? Walk its UI, look up bnrapolltest, screenshot what shows.
import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://monitor.jungletestnet.io/", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(8000);

// what inputs and tabs exist?
const ui = await page.evaluate(() => ({
  inputs: Array.from(document.querySelectorAll("input")).map(i => ({
    placeholder: i.placeholder, type: i.type, id: i.id, name: i.name })).slice(0, 12),
  headings: Array.from(document.querySelectorAll("h1,h2,h3,a,button")).map(h =>
    (h.innerText || "").trim()).filter(Boolean).slice(0, 40),
  url: location.href,
}));
console.log(JSON.stringify(ui, null, 1).slice(0, 2500));
await page.screenshot({ path: "monitor-home.png" });
console.log("SCREENSHOT: monitor-home.png");
await browser.close();
