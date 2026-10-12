// live.mjs — the Coinbase tungsten route, live, on Base Sepolia (test USDC, no real money).
//
//   node live.mjs intent             build the one live intent → live/intent.json (public data only)
//   node live.mjs reconcile <file>   read the record live.html saved to Downloads, run the
//                                     five kill conditions against the chain → live/out/<tx>.json
//
// The person's part is one press on live.html (skaists.dev/tools/bpay-settle/live.html) and
// the passkey in Coinbase's window. The page records what the wallet and the vendor SAID;
// this script decides from what two independent RPC operators SHOW.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { buildGenericInvoice } from "../../scripts/lib/bpay-invoice-generic.mjs";
import { buildAuthority, buildIntent, descriptorHash, fromAtto } from "../../scripts/lib/bpay-settle.mjs";
import { createEvmReader } from "./evm.mjs";
import { createAdapter, CHAINS, bindSuffix } from "./adapters/smart-account-usdc.mjs";
import { runTungsten, verifyTungsten } from "./tungsten.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const LIVE = join(here, "live");
const CHAIN = 84532; // Base Sepolia
const ASSET = CHAINS[CHAIN].asset;
const OWED = "10000"; // 0.01 test USDC
// a burn address: test USDC sent here is gone, which is the point of a test that moves nothing of value
const RECIPIENT = "0x000000000000000000000000000000000000dEaD";
const WINDOW_DAYS = 7;
const PUBLIC = "PUBLIC-CONSTANT: digests, addresses and transaction hashes of a public test run; no key material";

const reader = () => createEvmReader({ chainId: CHAIN, hosts: CHAINS[CHAIN].hosts });
const payAdapter = (r, sdk, account) => createAdapter({ chainId: CHAIN, route: "pay", reader: r, sdk, account });

async function buildLiveIntent() {
  const now = new Date();
  now.setMilliseconds(0);
  const createdAt = now.toISOString();
  const notAfter = new Date(now.getTime() + WINDOW_DAYS * 86400000).toISOString();
  const invoice = buildGenericInvoice({
    jobId: "tungsten-live-" + createdAt.slice(0, 10), issuedAt: createdAt,
    lines: [{ kind: "service", asset: ASSET, quotes: [{ quote_hash: "q-tungsten-live-" + randomBytes(4).toString("hex"), amount_atto: OWED }] }],
    authorization: { ceilings: { [ASSET]: OWED }, authorizedBy: "founder: live tungsten run on the Base Sepolia test network", stopConditions: ["one payment"] },
  });
  const d = await payAdapter(reader(), {}).network();
  const { authority } = buildAuthority({ principal: "person:founder", asset: ASSET, max_asset_atto: OWED, max_native_fee_atto: "0", recipient: RECIPIENT,
    not_after: notAfter, nonce: "live-" + randomBytes(8).toString("hex"), invoice_digest: invoice.identity.contentDigest, adapter_manifest_hash: descriptorHash(d) });
  const intent = buildIntent({ invoice, asset: ASSET, descriptor: d, authority, quote: { commitment: invoice.commitment.digest, expires_at: notAfter },
    privacy: { requirements: ["no-sdk-telemetry"] }, proof: {}, refund: { policy: "refund-to-source" }, meter: { evidence_ref: null }, now: createdAt });
  const pay = { amount: fromAtto(OWED, 6), to: RECIPIENT, testnet: true, dataSuffix: bindSuffix(intent), telemetry: false };
  mkdirSync(LIVE, { recursive: true });
  // one line, with the scanner's same-line marker: every hex run in it is a public digest
  const doc = { schema: "bnr.settle-live-intent/1", chain_id: CHAIN, invoice, intent, pay, _public: PUBLIC };
  writeFileSync(join(LIVE, "intent.json"), JSON.stringify(doc) + "\n");
  console.log(`live intent ${intent.intent_digest}\npays ${pay.amount} test USDC to ${RECIPIENT} on Base Sepolia, valid until ${notAfter}`);
}

async function reconcileLive(file) {
  const { invoice, intent } = JSON.parse(readFileSync(join(LIVE, "intent.json"), "utf8"));
  const rec = JSON.parse(readFileSync(file, "utf8"));
  if (rec.schema !== "bnr.settle-live-record/1") throw new Error("not a live record");
  if (rec.intent_digest !== intent.intent_digest) throw new Error("the record is for another intent");
  if (!/^0x[0-9a-fA-F]{64}$/.test(rec.returned?.id || "")) throw new Error("the record carries no transaction hash");
  const payer = rec.status?.sender || rec.payer;
  if (!/^0x[0-9a-fA-F]{40}$/.test(payer || "")) throw new Error("the record names no payer account");
  // the wallet's and the vendor's words, replayed exactly as the page recorded them
  const recorded = { pay: async () => rec.returned, getPaymentStatus: async () => rec.status };
  const r = reader();
  const outbox = { m: new Map(), get: async (k) => outbox.m.get(k) || null, persist: async (k, v) => (outbox.m.has(k) ? false : (outbox.m.set(k, v), true)) };
  const run = await runTungsten({
    route: "pay", adapter: payAdapter(r, recorded, payer), freshAdapter: async () => payAdapter(reader(), recorded, payer), reader: r,
    invoice, now: intent.created_at, principal: intent.authority.principal, recipient: intent.authority.recipient,
    maxNativeFeeAtto: intent.authority.max_native_fee_atto, notAfter: intent.authority.not_after, quoteExpiresAt: intent.quote.expires_at,
    nonce: intent.authority.nonce, privacy: intent.privacy.requirements, executor: recorded, outbox, payerAccount: payer, runId: "live-" + rec.returned.id.slice(2, 14),
  });
  if (run.intent && run.intent.intent_digest !== intent.intent_digest) throw new Error("the harness rebuilt another intent than the one the page paid");
  mkdirSync(join(LIVE, "out"), { recursive: true });
  const out = join(LIVE, "out", rec.returned.id.toLowerCase() + ".json");
  writeFileSync(out, JSON.stringify({ tungsten: run.tungsten, receipt: run.receipt, record: rec, _public: PUBLIC }) + "\n");
  const v = verifyTungsten(run.tungsten);
  console.log(`verdict ${run.tungsten.verdict}${run.tungsten.verdict_reasons.length ? " — " + run.tungsten.verdict_reasons.join("; ") : ""}`);
  console.log(`recon ${run.receipt?.reconciliation.conclusion ?? "none"} · tx ${rec.returned.id} · digest ok ${v.digest_ok} · verdict recomputes ${v.verdict_ok}`);
  console.log(`wrote ${out}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "intent") await buildLiveIntent();
else if (cmd === "reconcile" && arg) await reconcileLive(arg);
else { console.error("usage: node live.mjs intent | node live.mjs reconcile <record.json>"); process.exit(2); }
