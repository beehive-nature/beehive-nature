// loop.mjs — the whole hosted ANT storage purchase, end to end, on the TEST network.
//
// The real wallet page (this checkout's bytes, served under its production origin by the
// default-deny source fixture, or with --live the deployed skaists.dev bytes) is driven against
// the real local devnet (start.sh): ten storage nodes over WebRTC Direct and the Anvil test
// chain. Deterministic TEST-ONLY identities pay; nothing on this network has value, and no
// mainnet host is reachable.
//
//   node tools/ant-testnet/loop.mjs [out.json] [--live] [--keychain] [--probe "text"]
//
//   (default)    this wallet page's own keychain pays (a disposable recovery code typed into
//                the page): custody = the wallet page's JavaScript realm
//   --keychain   the ISOLATED keychain pays, as a TEST BUILD (scripts/build-keychain.mjs
//                --testnet, pinned to chain 31337 and this devnet's own token and vault) served
//                at its own origin, https://keys-devnet.skaists.dev, by route fulfilment. The
//                wallet page's own keychain is ALSO open, so the run proves the page funds,
//                displays, invoices and pays from the isolated account and never the page's.
//                custody = the keychain's own origin; the page never holds the key
//   --probe      the bytes to store (default: the 49-byte Agent 20 probe). A network that
//                already holds the bytes needs no payment, so a second paid run on the same
//                network needs a new probe.
//
// It records what the invoice showed BEFORE authorization (the ANT total and the separate
// ETH ceiling), presses Authorize (a test identity on a test chain), waits for the upload,
// the independent retrieval and hash comparison, and the reconciled receipt, then re-reads
// the payment from the test chain itself. Exits non-zero on any failure.
import { chromium } from "../../e2e/node_modules/playwright/index.mjs";
import { installWalletFixture } from "../../e2e/lib/wallet-source-fixture.mjs";
import { writeFile, readFile, mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const argAfter = (k) => { const i = process.argv.indexOf(k); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null; };
const LIVE = process.argv.includes("--live"), KEYCHAIN = process.argv.includes("--keychain");
const PROBE = Buffer.from(argAfter("--probe") || "Agent 20 non-spending live quote probe 2026-10-10"); // the 49-byte probe by default
const ETH_CEILING = "0.05"; // test ETH; the person types their own on the real network
const DEVNET = "http://127.0.0.1:25000", KEYS_DEVNET = "https://keys-devnet.skaists.dev";
const outPath = (() => { const a = process.argv.slice(2).filter((x, i, all) => !x.startsWith("--") && !(i > 0 && all[i - 1] === "--probe")); return a[0] || "tools/ant-testnet/last-loop.json"; })();
const out = { schema: "bnr.ant-testnet-loop/1", at: new Date().toISOString(), network: "local ant-devnet + Anvil 31337 (test, no value)", probe_bytes: PROBE.length,
  probe_sha256: createHash("sha256").update(PROBE).digest("hex"),
  identity: KEYCHAIN ? "TEST-ONLY deterministic keychains, both present: the isolated TEST BUILD keychain pays; the wallet page's own keychain is open and must not pay" : "TEST-ONLY deterministic keychain in the wallet page, never a person’s key" };
const until = async (f, ms = 300000, step = 500) => { const end = Date.now() + ms; for (;;) { const v = await f(); if (v) return v; if (Date.now() > end) throw new Error("timed out"); await new Promise((r) => setTimeout(r, step)); } };

// the running devnet's own pin, read before anything else: the TEST BUILD keychain is pinned to it
const manifest = await (await fetch(DEVNET + "/api/browser-manifest.json", { redirect: "error" })).json();
const pay = manifest.payment_network || manifest.payment || {};
out.devnet = { network_id: manifest.network_id, chain_id: Number(pay.chain_id), token: String(pay.payment_token_address || "").toLowerCase(), vault: String(pay.payment_vault_address || "").toLowerCase() };
assert.equal(out.devnet.chain_id, 31337, "the running network is the local test chain");

let keysDir = null;
if (KEYCHAIN) {
  keysDir = await mkdtemp(join(tmpdir(), "kc-devnet-"));
  execFileSync(process.execPath, ["scripts/build-keychain.mjs", "--out", keysDir, "--origin", KEYS_DEVNET, "--parent", "https://skaists.dev", "--testnet", out.devnet.token, out.devnet.vault], { stdio: "inherit" });
  out.keychain_build = { origin: KEYS_DEVNET, served_by: "route fulfilment from a build of this checkout (no DNS, no host)", keychain_js_sha256: createHash("sha256").update(readFileSync(join(keysDir, "keychain.js"))).digest("hex"), pin: `chain 31337, token ${out.devnet.token}, vault ${out.devnet.vault}` };
}

const browser = await chromium.launch();
if (!LIVE) await installWalletFixture(browser, process.cwd());
out.source = LIVE ? "deployed skaists.dev" : "this checkout (production-origin fixture)";
out.signer = KEYCHAIN ? `isolated TEST BUILD keychain at ${KEYS_DEVNET}` : "wallet page's own keychain (bzDiD storage signer pinned to the test chain)";
out.custody = KEYCHAIN ? "the key lives in the keychain origin; the wallet page can ask, never sign" : "the key shares the wallet page's JavaScript realm";
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
// the devnet is the only other place this page may reach: its manifest and its test chain, on loopback
await ctx.route(/^http:\/\/127\.0\.0\.1:\d+\//, (route) => route.continue());
if (KEYCHAIN) await ctx.route(KEYS_DEVNET + "/**", (route) => {
  const p = new URL(route.request().url()).pathname, file = p === "/" ? "index.html" : p.slice(1);
  try { return route.fulfill({ body: readFileSync(join(keysDir, file)), contentType: file.endsWith(".js") ? "text/javascript" : "text/html" }); } catch (e) { return route.fulfill({ status: 404, body: "" }); }
});
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
    // TEST-ONLY: deterministic throwaway identity for the wallet page's own keychain, never a person's key
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
  // the wallet page's own test account, for the "never this one" assertions
  out.wallet_page_account = await page.evaluate(({ token, vault }) => BNRPAY.antStorageSigner({ testnet: { token, vault } }).address(), out.devnet);

  let kc = null;
  if (KEYCHAIN) {
    await page.locator("#ant-buy-keychain iframe").waitFor({ timeout: 20000 });
    kc = page.frames().find((f) => f.url().startsWith(KEYS_DEVNET + "/"));
    assert.ok(kc, "the TEST BUILD keychain frame is mounted from its own origin");
    await kc.getByText("TEST BUILD").first().waitFor({ timeout: 20000 });
    // TEST-ONLY: a different deterministic throwaway identity for the isolated keychain
    const code = await page.evaluate(() => BZDIDKEY.encodeRecoveryCode(new Uint8Array(32).fill(43)));
    await kc.getByText("Open with a recovery code").click();
    await kc.getByLabel("Recovery code").fill(code);
    await kc.getByRole("button", { name: "Open", exact: true }).click();
    await page.getByText("Your isolated TEST BUILD keychain is open and pays from its own account").waitFor({ timeout: 20000 });
    out.session = await page.locator("#ant-session-message").innerText();
    out.isolated_account = (await kc.locator("dd.mono").nth(1).innerText()).trim().toLowerCase();
    assert.match(out.isolated_account, /^0x[0-9a-f]{40}$/);
    assert.notEqual(out.isolated_account, out.wallet_page_account.toLowerCase(), "the isolated keychain is a different account than the wallet page's keychain");
    assert.ok(out.session.toLowerCase().includes(out.isolated_account), "the session line names the isolated account as the paying account");
  } else {
    out.session = await page.locator("#ant-session-message").innerText();
    assert.match(out.session, /This page’s own test keychain pays/, "the session line says plainly that the page's own keychain pays");
  }
  const expectedPayer = (KEYCHAIN ? out.isolated_account : out.wallet_page_account).toLowerCase();

  // test funds for the paying account's own test address
  await page.getByRole("button", { name: "Get test ANT and test ETH", exact: true }).click();
  out.funding = await until(async () => { const t = await page.locator("#ant-funding").innerText(); return /Funded|stopped/.test(t) ? t : null; }, 60000);
  assert.match(out.funding, /Funded on the test network/, out.funding);
  assert.ok(out.funding.toLowerCase().includes(expectedPayer), "the funded address is the paying account");
  if (KEYCHAIN) assert.ok(!out.funding.toLowerCase().includes(out.wallet_page_account.toLowerCase()), "the wallet page's own account was not funded");

  // prepare: the probe and a separate ETH ceiling
  await page.locator("#ant-buy-file").setInputFiles({ name: "agent20-public-probe.txt", mimeType: "text/plain", buffer: PROBE });
  await page.locator("#ant-buy-gas").fill(ETH_CEILING);
  await page.locator("#ant-buy-start").click();
  const authorize = page.getByRole("button", { name: "Authorize this invoice and ask my wallet" });
  await until(async () => (await authorize.count()) > 0 || /stopped|Stored and retrieved/i.test(await page.locator("#ant-buy-status").innerText()), 600000);
  // a file this network already holds needs no payment: correct, but not a proof of the paid path
  if (!(await authorize.count()) && /Stored and retrieved/.test(await page.locator("#ant-buy-status").innerText()))
    throw new Error("this test network already holds the probe, so no payment was needed; start a fresh network (start.sh) or pass --probe with new bytes for a paid run");
  out.status_before_authorize = await page.locator("#ant-buy-status").innerText();
  assert.equal(await authorize.count(), 1, out.status_before_authorize);
  // what the invoice says BEFORE anything is signed
  out.invoice = { ant_total: await page.locator("#ant-invoice-total").innerText(), eth_ceiling: await page.locator("#ant-invoice-eth").innerText(),
    text: (await page.locator("#ant-buy-invoice").innerText()).slice(0, 1200) };
  const payer = (out.invoice.text.match(/Paying account: (0x[0-9a-fA-F]{40})/) || [])[1];
  assert.equal(String(payer).toLowerCase(), expectedPayer, "the invoice's paying account is the account that was funded and displayed");

  // authorize, then upload, independent retrieval and hash comparison, reconciled receipt
  await authorize.click();
  out.keychain_presses = 0;
  const settledText = () => page.locator("#ant-buy-status").innerText();
  const settled = () => until(async () => {
    if (KEYCHAIN && kc) {
      // each payment is decoded and confirmed inside the isolated keychain: one trusted press per transaction
      const sign = kc.getByRole("button", { name: "Sign this payment" });
      if (await sign.count()) {
        await page.locator("#ant-buy-keychain iframe").evaluate((f) => f.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(900);
        if (await sign.count()) { await sign.click(); out.keychain_presses++; }
      }
    }
    return /Stored and retrieved|Storage stopped/.test(await settledText());
  }, 900000, 1000);
  await settled();
  out.status_final = await settledText();
  // a confirmation still pending is resumed with the same file, as the page says: never a second payment
  for (let i = 0; i < 3 && /Confirmation is pending/.test(out.status_final); i++) {
    out.resumed = (out.resumed || 0) + 1;
    await page.locator("#ant-buy-start").click();
    await settled();
    out.status_final = await settledText();
  }
  assert.match(out.status_final, /Stored and retrieved/, out.status_final);
  out.receipt = JSON.parse(await page.locator("#ant-buy-receipt").textContent()); // inside a closed disclosure: textContent, not innerText
  assert.equal(out.receipt.schema, "bpay.ant.reconciled/1");
  assert.equal(String(out.receipt.retrievedBytes), String(PROBE.length));
  assert.equal(out.receipt.retrievedSha256, out.probe_sha256, "retrieved bytes hash to the original probe");
  if (KEYCHAIN) assert.equal(out.keychain_presses, out.receipt.transactions.length, "every transaction was confirmed by a press inside the isolated keychain");
  // the payment record can leave this browser: what was signed and sent, never a key
  const record = page.locator("#ant-buy-record");
  assert.equal(await record.evaluate((a) => a.hidden), false, "the payment record is offered after the purchase (inside the resuming disclosure)");
  out.record_name = await record.getAttribute("download");

  // the payment, read back from the test chain itself (not the page's word)
  const devnet = await (await fetch(DEVNET + "/api/devnet-manifest.json", { redirect: "error" })).json();
  const rpc = new URL(devnet.evm.rpc_url); rpc.hostname = "127.0.0.1";
  const call = async (method, params) => (await (await fetch(rpc.origin, { method: "POST", redirect: "error", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
  out.chain = [];
  for (const t of out.receipt.transactions) {
    const [rc, tx] = [await call("eth_getTransactionReceipt", [t.hash]), await call("eth_getTransactionByHash", [t.hash])];
    out.chain.push({ kind: t.kind, hash: t.hash, status: rc && rc.status, block: rc && Number(rc.blockNumber), from: tx && tx.from, to: tx && tx.to, chainId: tx && Number(tx.chainId), type: tx && tx.type });
    assert.equal(rc && rc.status, "0x1", `${t.kind} mined successfully`);
    assert.equal(String(tx.from).toLowerCase(), expectedPayer, `${t.kind} sent by the paying account itself`);
    if (KEYCHAIN) assert.notEqual(String(tx.from).toLowerCase(), out.wallet_page_account.toLowerCase(), `${t.kind} was not sent by the wallet page's own account`);
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
  out._public = "PUBLIC-CONSTANT: digests, test addresses and test-chain transaction hashes of a local test run; no key material, nothing of value";
  await writeFile(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, signer: out.signer, invoice: out.invoice, status: out.status_final || out.status_at_failure, error: out.error && out.error.slice(0, 300) }, null, 2));
  process.exit(out.ok ? 0 : 1);
}
