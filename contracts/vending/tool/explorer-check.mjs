// explorer-check.mjs — open candidate explorer URLs headlessly and verify the
// account RENDERS (DOM carries bnrapolltest + real account data). Screenshot
// each hit. No guessed links pass: only what renders gets reported.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const CANDIDATES = [
  "https://eosauthority.com/account/bnrapolltest?network=jungle",
  "https://eosauthority.com/tx/d150f7d5f3b722ff05355c49d93ab2565a4437a8220da92588e40a328811d54e?network=jungle", // PUBLIC-CONSTANT: jungle4 mint txid in explorer URL
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const url of CANDIDATES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(9000); // SPAs fetch after load
    const text = (await page.locator("body").innerText().catch(() => "")) || "";
    const hasName = text.includes("bnrapolltest");
    // real data markers, not a shell: creation date, RAM, balances, tx hash, actions
    const markers = ["2026-08-29", "RAM", "EOS", "285", "260", "d150f7d5", "vending", "mint"]
      .filter(m => text.includes(m));
    console.log(JSON.stringify({ url, hasName, markers, textLen: text.length,
      title: await page.title() }));
    if (hasName) {
      const shot = "explorer-" + (url.includes("/tx/") ? "tx" : "account") + ".png";
      await page.screenshot({ path: shot, fullPage: false });
      console.log("SCREENSHOT: " + shot);
      writeFileSync("explorer-" + (url.includes("/tx/") ? "tx" : "account") + ".txt",
        "URL: " + url + "\n\n" + text.slice(0, 4000));
    }
  } catch (e) {
    console.log(JSON.stringify({ url, error: e.message.slice(0, 120) }));
  }
  await page.close();
}
await browser.close();
