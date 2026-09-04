import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://monitor.jungletestnet.io/#accountOverview:bnrapolltest", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(9000);
// scroll the account panel into view and screenshot it
const el = page.getByText("bnrapolltest", { exact: true }).last();
await el.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: "monitor-account-view.png" });
// the Contract tab: does the vending ABI render?
try {
  await page.getByRole("generic", { name: "Contract" }).click({ timeout: 3000 }).catch(async () => {
    await page.getByText("Contract", { exact: true }).last().click();
  });
  await page.waitForTimeout(4000);
  const t = await page.locator("body").innerText();
  const actions = ["init","setrate","settithe","mint","update","release"].filter(a => t.includes(a));
  console.log("CONTRACT TAB actions visible:", JSON.stringify(actions));
  await page.screenshot({ path: "monitor-contract-tab.png" });
} catch (e) { console.log("contract tab:", e.message.slice(0,80)); }
await browser.close();
