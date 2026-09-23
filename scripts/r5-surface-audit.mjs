#!/usr/bin/env node
// R5 SURFACE AUDIT (AV-11) — no first-line human payment surface may ask
// the human for native gas: acquisition ("buy/get ETH"), balances, or fee
// management. R5's LAST-LINE adapters remain allowed ONLY as explicitly
// labeled fallback surfaces (data-r5-fallback marker or a "fallback"
// label within the same element/section).
//
// CHECKER-VALIDATION LAW: run with --selftest to execute the known-bad +
// known-good fixture pair; the audit is not landable without both passing.
//
// Usage:
//   node scripts/r5-surface-audit.mjs --selftest   # fixtures only
//   node scripts/r5-surface-audit.mjs [paths...]   # default: surfaces/ (recursive *.html)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Ask-shaped patterns only — educational MENTIONS of gas do not match;
// the audit fails a surface only when it ASKS the human to act on gas.
const PATTERNS = [
  { re: /buy\s+(some\s+)?eth\b/i, why: "asks the human to acquire ETH" },
  { re: /get\s+(some\s+)?eth\b(?!er)/i, why: "asks the human to acquire ETH" },
  { re: /acquire\s+(eth|gas)\b/i, why: "asks the human to acquire native gas" },
  { re: /eth\s+for\s+gas/i, why: "asks the human to hold ETH for gas" },
  { re: /gas\s+for\s+eth/i, why: "asks the human to hold gas" },
  { re: /(you\s+(need|must|have)\s+(to\s+)?(hold|buy|get))[^.<]{0,40}(eth|gas)/i, why: "human must hold/buy native gas" },
  { re: /(top[- ]?up|fund|fill)[^.<]{0,30}(gas|eth)\b(?!er)/i, why: "asks the human to fund gas" },
  { re: /gas\s+balance/i, why: "asks the human to manage a gas balance" },
  { re: /(your|manage)\s+gas\s+fees?/i, why: "asks the human to manage gas fees" },
  { re: /gas\s+(is|not)\s+(not\s+)?included/i, why: "declares gas excluded — human pays gas" },
  { re: /pay(s)?\s+the\s+gas/i, why: "human pays the gas" },
];

const FALLBACK_MARK = /data-r5-fallback/i;

function* walkHtml(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) yield* walkHtml(p);
    else if (e.endsWith(".html")) yield p;
  }
}

// Split into elements/lines; a hit inside a fallback-marked block is an
// ALLOWED last-line adapter surface (explicitly labeled fallback).
function auditText(name, text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  let fallbackZone = false;
  let zoneDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("<")) {
      // crude tag tracking for fallback zones (data-r5-fallback opens a
      // zone until its closing tag at the same nesting estimate)
      if (FALLBACK_MARK.test(line)) fallbackZone = true;
    }
    for (const { re, why } of PATTERNS) {
      const m = line.match(re);
      if (m && !fallbackZone) {
        hits.push({ name, line: i + 1, why, text: line.trim().slice(0, 120) });
      }
    }
    if (fallbackZone && /<\/(section|div|details)>/i.test(line)) {
      fallbackZone = false;
    }
  }
  return hits;
}

function run(paths) {
  const files = [];
  for (const p of paths) for (const f of walkHtml(p)) files.push(f);
  const all = [];
  for (const f of files) all.push(...auditText(f, readFileSync(f, "utf8")));
  return { files, hits: all };
}

function selftest() {
  const bad = auditText(
    "fixture-leak.html",
    `<html><body>
      <p>Deposit some funds first — you need to hold ETH for gas on this rail.</p>
     </body></html>`
  );
  const good = auditText(
    "fixture-fallback.html",
    `<html><body>
      <section data-r5-fallback="last-line adapter">
        <p>Fallback adapter: you may top up gas yourself if the sponsored rail is down.</p>
      </section>
      <p>Ethereum gas fees exist. This is an educational mention.</p>
     </body></html>`
  );
  const badOk = bad.length >= 1 && bad.some((h) => /ETH for gas/i.test(h.text));
  const goodOk = good.length === 0;
  console.log(`selftest: known-bad ${badOk ? "FIRES" : "SILENT (BROKEN)"} (${bad.length} hit), known-good ${goodOk ? "clean" : "OVER-BLOCKING: " + JSON.stringify(good)}`);
  if (!badOk || !goodOk) process.exit(2);
  console.log("selftest PASS — detector validated against both fixtures");
}

const args = process.argv.slice(2);
if (args.includes("--selftest")) {
  selftest();
} else {
  const paths = args.length ? args : ["surfaces"];
  const { files, hits } = run(paths);
  console.log(`R5 surface audit: ${files.length} html surfaces scanned under ${paths.join(", ")}`);
  if (hits.length === 0) {
    console.log("ZERO human-gas asks. R5 holds (first-line surfaces never ask the human for native gas).");
  } else {
    console.log(`HITS: ${hits.length} — first-line surfaces asking humans for native gas:`);
    for (const h of hits) console.log(`  ${h.name}:${h.line} [${h.why}] ${h.text}`);
    process.exit(1);
  }
}
