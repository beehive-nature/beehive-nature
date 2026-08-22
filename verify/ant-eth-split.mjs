#!/usr/bin/env node
/* ant-eth-split.mjs — the receipts-not-formulas tool for the ANT/ETH upload-split dispute.
   Give it Arbitrum One tx hashes of Autonomi payment-vault transactions; it prints, per tx
   and summed: the all-in ETH fee (Blockscout's fee field is L1-poster-inclusive — verified
   against Arbiscan to the digit in RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md §3) and
   the ANT actually transferred on-chain, then the USD split at live CoinGecko prints.
   Keyless, no deps, anyone can run it:  node verify/ant-eth-split.mjs 0xHASH [0xHASH...]
   Every number it emits is a measurement or a named price print — never a model. */

const ANT = "0xa78d8321B20c4Ef90eCd72f2588AA985A4BDb684"; // PUBLIC-CONSTANT: the ANT ERC-20 token address on Arbitrum One
const BS = "https://arbitrum.blockscout.com/api/v2";

const hashes = process.argv.slice(2).filter(h => /^0x[0-9a-fA-F]{64}$/.test(h));
if (!hashes.length) {
  console.error("usage: node verify/ant-eth-split.mjs 0xTXHASH [0xTXHASH ...]");
  console.error("       (Arbitrum One transactions to the Autonomi payment vault)");
  process.exit(1);
}

const j = async (url) => {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
};

const rows = [];
for (const h of hashes) {
  try {
    const tx = await j(`${BS}/transactions/${h}`);
    const feeEth = Number(tx.fee?.value ?? 0) / 1e18; // wei -> ETH, L1-inclusive per Blockscout
    let ant = 0, other = 0;
    const tt = await j(`${BS}/transactions/${h}/token-transfers`);
    for (const t of tt.items ?? []) {
      const addr = (t.token?.address_hash ?? t.token?.address ?? "").toLowerCase();
      const dec = Number(t.total?.decimals ?? t.token?.decimals ?? 18);
      const val = Number(t.total?.value ?? 0) / 10 ** dec;
      if (addr === ANT.toLowerCase()) ant += val; else other += val;
    }
    const method = tx.decoded_input?.method_call?.split("(")[0] ?? tx.method ?? "?";
    rows.push({ h, when: tx.timestamp, method, feeEth, ant, other });
    console.log(`${h.slice(0, 14)}…  ${tx.timestamp ?? "?"}  ${method}  fee ${feeEth.toExponential(4)} ETH  ANT ${ant.toFixed(6)}${other ? `  (+${other} non-ANT transfers ignored)` : ""}`);
  } catch (e) {
    console.log(`${h.slice(0, 14)}…  FAILED — ${e.message} (declared, not zeroed; excluded from the sum)`);
  }
}

const ok = rows.length;
if (!ok) { console.error("no transactions decoded — nothing to sum"); process.exit(1); }

const sumEth = rows.reduce((a, r) => a + r.feeEth, 0);
const sumAnt = rows.reduce((a, r) => a + r.ant, 0);

let px = null;
try {
  px = await j("https://api.coingecko.com/api/v3/simple/price?ids=autonomi,ethereum&vs_currencies=usd");
} catch (e) {
  console.log(`price fetch FAILED (${e.message}) — raw sums only, split needs a price print`);
}

console.log("—".repeat(72));
console.log(`SUM over ${ok} tx: ${sumEth.toExponential(6)} ETH gas (all-in, L1 incl.)  vs  ${sumAnt.toFixed(6)} ANT paid`);
if (px?.autonomi?.usd && px?.ethereum?.usd) {
  const usdEth = sumEth * px.ethereum.usd, usdAnt = sumAnt * px.autonomi.usd, tot = usdEth + usdAnt;
  console.log(`at CoinGecko prints ANT $${px.autonomi.usd} / ETH $${px.ethereum.usd} (fetched now):`);
  console.log(`  ANT $${usdAnt.toFixed(4)}  |  ETH gas $${usdEth.toFixed(4)}  |  split ANT/ETH = ${(100 * usdAnt / tot).toFixed(1)}/${(100 * usdEth / tot).toFixed(1)}`);
  console.log(`the split is size-dependent BY DESIGN — quote a file size with any number you repeat.`);
}
console.log(`method: Blockscout v2 (keyless) fee + on-chain ANT Transfer events; nothing modeled.`);
console.log(`full 150-tx receipt: docs/dispatches/RECEIPT_zCode_ANT_ETH_GAS_SPLIT_2026-08-21.md`);
