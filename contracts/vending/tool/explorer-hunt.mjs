// explorer-hunt.mjs — find a LIVE public explorer for jungle4 by walking the
// official jungletestnet.io site's rendered navigation (no guessed URLs),
// then searching for bnrapolltest in whichever explorer it opens.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto("https://jungletestnet.io/", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(6000);
// dump every rendered anchor + button label (the nav lives in the SPA DOM)
const links = await page.evaluate(() => Array.from(document.querySelectorAll("a,button"))
  .map(el => ({ tag: el.tagName, text: (el.innerText || "").trim().slice(0, 40),
                href: el.href || "" }))
  .filter(x => x.text));
console.log("NAV:", JSON.stringify(links, null, 1).slice(0, 2200));
await browser.close();
