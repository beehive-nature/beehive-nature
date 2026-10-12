// loop.mjs — the whole hosted ANT storage purchase, end to end, on the TEST network.
//
// The real wallet page (this checkout's bytes, served under its production origin by the
// default-deny source fixture) is driven against the real local devnet (start.sh): five
// storage nodes over WebRTC Direct and the Anvil test chain. A deterministic TEST-ONLY
// keychain pays; nothing on this network has value, and no mainnet host is reachable.
//
//   node tools/ant-testnet/loop.mjs [out.json]
//
// It records what the invoice showed BEFORE authorization (the ANT total and the separate
// ETH ceiling), presses Authorize (a test identity on a test chain), waits for the upload,
// the independent retrieval and hash comparison, and the reconciled receipt, then re-reads
// the payment from the test chain itself. Exits non-zero on any failure.
import { chromium } from "../../e2e/node_modules/playwright/index.mjs";
import { installWalletFixture } from "../../e2e/lib/wallet-source-fixture.mjs";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const PROBE = Buffer.from("Agent 20 non-spending live quote probe 2026-10-10"); // the 49-byte probe
const ETH_CEILING = "0.05"; // test ETH; the person types their own on the real network
const out = { at: new Date().toISOString(), network: "local ant-devnet + Anvil 31337 (test, no value)", probe_bytes: PROBE.length,
  probe_sha256: createHash("sha256").update(PROBE).digest("hex") };
const until = async (f, ms = 300000, step = 500) => { const end = Date.now() + ms; for (;;) { const v = await f(); if (v) return v; if (Date.now() > end) throw new Error("timed out"); await new Promise((r) => setTimeout(r, step)); } };

const browser = await chromium.launch();
await installWalletFixture(browser, process.cwd());
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
// the devnet is the only other place this page may reach: its manifest and its test chain, on loopback
await ctx.route(/^http:\/\/127\.0\.0\.1:\d+\//, (route) => route.continue());
// the one browser permission the person grants when asked: this page may reach apps on this device
await ctx.grantPermissions(["local-network-access"], { origin: "https://skaists.dev" });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e.message)));
try {
  await page.addInitScript(() => { try { localStorage.setItem("bnr_soul", "gatesoul"); } catch (e) {} });
  await page.goto("https://skaists.dev/surfaces/wallet.html?net=devnet#bpay-sec");
  await page.waitForFunction(() => window.BZDIDKEY && window.BNRPAY && BNRPAY.coreArmed(), null, { timeout: 60000 });
  await page.evaluate(() => {
    // TEST-ONLY: deterministic throwaway identity, never a person's key
    const code = BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(42));
    document.getElementById("kc-rec-scaffold").open = true;
    document.getElementById("kc-rec").value = code; document.getElementById("kc-recgo").click();
  });
  await page.waitForFunction(() => /keychain live/.test(document.getElementById("kc-stat").textContent), null, { timeout: 30000 });
  await page.locator("[data-wallet-store]").click(); await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
  if (!(await page.locator("#ant-purchase").count())) await page.locator('[data-audience="public"]').click();
  if (!(await page.locator("#ant-purchase").evaluate((el) => el.open))) await page.locator("#ant-purchase summary").first().click();
  out.banner = await page.locator(".ant-test-banner").innerText();
  assert.match(out.banner, /TEST NETWORK/);

  // test funds for the keychain's own test address
  await page.getByRole("button", { name: "Get test ANT and test ETH", exact: true }).click();
  out.funding = await until(async () => { const t = await page.locator("#ant-funding").innerText(); return /Funded|stopped/.test(t) ? t : null; }, 60000);
  assert.match(out.funding, /Funded on the test network/, out.funding);

  // prepare: the 49-byte probe and a separate ETH ceiling
  await page.locator("#ant-buy-file").setInputFiles({ name: "agent20-public-probe.txt", mimeType: "text/plain", buffer: PROBE });
  await page.locator("#ant-buy-gas").fill(ETH_CEILING);
  await page.locator("#ant-buy-start").click();
  const authorize = page.getByRole("button", { name: "Authorize this invoice and ask my wallet" });
  await until(async () => (await authorize.count()) > 0 || /stopped/i.test(await page.locator("#ant-buy-status").innerText()), 600000);
  out.status_before_authorize = await page.locator("#ant-buy-status").innerText();
  assert.equal(await authorize.count(), 1, out.status_before_authorize);
  // what the invoice says BEFORE anything is signed
  out.invoice = { ant_total: await page.locator("#ant-invoice-total").innerText(), eth_ceiling: await page.locator("#ant-invoice-eth").innerText(),
    text: (await page.locator("#ant-buy-invoice").innerText()).slice(0, 1200) };

  // authorize, then upload, independent retrieval and hash comparison, reconciled receipt
  await authorize.click();
  const settled = () => until(async () => /Stored and retrieved|Storage stopped/.test(await page.locator("#ant-buy-status").innerText()), 900000, 1000);
  await settled();
  out.status_final = await page.locator("#ant-buy-status").innerText();
  // a confirmation still pending is resumed with the same file, as the page says: never a second payment
  for (let i = 0; i < 3 && /Confirmation is pending/.test(out.status_final); i++) {
    out.resumed = (out.resumed || 0) + 1;
    await page.locator("#ant-buy-start").click();
    await settled();
    out.status_final = await page.locator("#ant-buy-status").innerText();
  }
  assert.match(out.status_final, /Stored and retrieved/, out.status_final);
  out.receipt = JSON.parse(await page.locator("#ant-buy-receipt").textContent()); // inside a closed disclosure: textContent, not innerText
  assert.equal(out.receipt.schema, "bpay.ant.reconciled/1");
  assert.equal(String(out.receipt.retrievedBytes), String(PROBE.length));

  assert.equal(out.receipt.retrievedSha256, out.probe_sha256, "retrieved bytes hash to the original probe");
  // the payment, read back from the test chain itself (not the page's word)
  const manifest = await (await fetch("http://127.0.0.1:25000/api/devnet-manifest.json")).json();
  const rpc = new URL(manifest.evm.rpc_url); rpc.hostname = "127.0.0.1";
  const call = async (method, params) => (await (await fetch(rpc.origin, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
  const payer = (out.invoice.text.match(/Paying account: (0x[0-9a-fA-F]{40})/) || [])[1];
  out.chain = [];
  for (const t of out.receipt.transactions) {
    const [rc, tx] = [await call("eth_getTransactionReceipt", [t.hash]), await call("eth_getTransactionByHash", [t.hash])];
    out.chain.push({ kind: t.kind, hash: t.hash, status: rc && rc.status, block: rc && Number(rc.blockNumber), from: tx && tx.from, to: tx && tx.to, chainId: tx && Number(tx.chainId), type: tx && tx.type });
    assert.equal(rc && rc.status, "0x1", `${t.kind} mined successfully`);
    assert.equal(String(tx.from).toLowerCase(), String(payer).toLowerCase(), `${t.kind} sent by the keychain's own address`);
    assert.equal(Number(tx.chainId), 31337, "test chain only");
  }
  assert.ok(out.chain.some((c) => c.kind === "payment"), "a payment transaction is on the test chain");
  out.console_errors = consoleErrors;
  out.ok = true;
} catch (e) {
  out.ok = false; out.error = String(e && e.stack || e).slice(0, 2000);
  out.status_at_failure = await page.locator("#ant-buy-status").innerText().catch(() => null);
  out.console_errors = consoleErrors;
} finally {
  await browser.close();
  await writeFile(process.argv[2] || "tools/ant-testnet/last-loop.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, invoice: out.invoice, status: out.status_final || out.status_at_failure, error: out.error && out.error.slice(0, 300) }, null, 2));
  process.exit(out.ok ? 0 : 1);
}
