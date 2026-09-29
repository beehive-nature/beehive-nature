#!/usr/bin/env node
// ─── LICENSE ────────────────────────────────────────────────────────────────
// SPDX-License-Identifier: BUSL-1.1 (the b-meter commercial moat — same
// LICENSE in scripts/buzz-meter/; this audit is moat tooling).
// ────────────────────────────────────────────────────────────────────────────
// audit-human-gas.mjs — SPEC AV-11: the human native-gas surface audit
// (docs/agents/ADVERSARIAL-BPAY-SPECS.md, P1). Founder brief 2026-09-16:
// enumerate every first-line payment path; prove the human-facing contract
// never asks for ETH/ARB/native gas, gas balances, gas acquisition, or
// native-fee management; distinguish first-line x402/L2/LN UX from the R5
// LAST-LINE native-gas adapters; fail automatically when a future first-line
// rail introduces a human-gas surface.
//
// What this audit IS: a static scan of the human-facing strings of the
// wallet surface + every rail adapter, against a gas-surface pattern
// battery, with an explicit rail classification (FIRST_LINE / LAST_LINE)
// and a REGISTERED-FINDINGS ledger.
//
// What it ENFORCES (structural, hard-fail):
//   1. every wallet-adapter-*.js is CLASSIFIED (first-line or last-line) —
//      an unclassified future rail fails the audit until classified;
//   2. NO gas surface on a first-line rail may be UNREGISTERED — the
//      future-rail detector: a new first-line flow that asks a human for
//      gas fails immediately;
//   3. ledger entries must name their remediation (what removes the
//      finding) — no open-ended debt.
//
// What it REPORTS (registered findings, not failures): the KNOWN
// human-gas surfaces on today's first-line EVM flows — the exact gap the
// R5 redirect (gas abstraction: 4337 bundler/paymaster shapes, 7702,
// L2-native sponsorship) exists to close. Registering them keeps them
// visible and reviewable; removing one from the ledger without removing
// the surface FAILS the audit (the ledger can never lag reality).
//
// Run:  node scripts/audit-human-gas.mjs     (exit 0 = structure sound)
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SURFACES = join(ROOT, 'surfaces');

// ── the rail classification (the audit table's spine) ───────────────────────
// FIRST_LINE: the wallet PAY panel's first-line UX (the R5 ruling: LN/EVM/L2
//   first-line, BTC L1 last-line/fallback). First-line rails carry the
//   no-human-gas OBLIGATION.
// LAST_LINE: R5 fallback adapters — native-asset rails where the human
//   holding/feeing the rail's own asset IS the product (BTC L1). Gas-surface
//   patterns in these files are reported, never failed.
const CLASSIFICATION = {
  'wallet-adapter-vaulta.js': 'FIRST_LINE',   // Vaulta A — gasless CPU/NET (resource-delegation law)
  'wallet-adapter-solana.js': 'FIRST_LINE',   // Solana — fees ride the estate signer path
  'wallet-adapter-hive.js':   'FIRST_LINE',   // Hive — resource-credit delegation
  'wallet-adapter-arweave.js': 'LAST_LINE',   // Arweave — AR-denominated storage (R5 last-line)
  'wallet-adapter-bitcoin.js': 'LAST_LINE',   // BTC L1 — the ruled last-line/fallback rail
  'wallet.html': 'FIRST_LINE',                // the PAY panel itself
};

// ── the registered-findings ledger (KNOWN first-line gas surfaces) ──────────
// Each entry: file, pattern (regex source), finding (why it is a gas
// surface), remediation (the R5 work that removes it). An entry only
// registers what the scan ACTUALLY finds — a stale entry (surface removed)
// is REPORTED for ledger cleanup; an UNREGISTERED hit is a hard FAIL.
const LEDGER = [
  {
    file: 'wallet.html',
    pattern: 'tiny gas',
    finding: 'the USDC·Base top-up door tells the human the rail costs "tiny '
      + 'gas" — an ERC-20 send on Base requires the human to hold ETH for gas',
    remediation: 'R5 gas abstraction on the Base top-up (sponsored send / '
      + 'paymaster / relayer) — the human sends USDC and nothing else',
  },
  {
    file: 'wallet.html',
    pattern: 'Gas is estimated live',
    finding: 'the ANT-on-Arbitrum flow surfaces a live gas estimate to the '
      + 'human before broadcast — the human pays ARB gas to move their own ANT',
    remediation: 'R5 gas abstraction on the Arbitrum ANT flow (sponsor the '
      + 'broadcast or fold gas into the quoted price)',
  },
  {
    file: 'wallet.html',
    pattern: 'gas: reading',
    finding: 'a gas read is surfaced in a derived-address status line (the '
      + 'human-facing contract names gas as a live concern)',
    remediation: 'same R5 abstraction; display price-inclusive totals only',
  },
  {
    file: 'wallet.html',
    pattern: 'gwei',
    finding: 'the EVM panel renders gas prices in gwei — native-fee '
      + 'management in the human-facing contract',
    remediation: 'same R5 abstraction; gwei belongs in the adapter, never the panel',
  },
];

// ── the pattern battery ─────────────────────────────────────────────────────
// What counts as a human-gas surface. Deliberately broad; "gasless" is a
// POSITIVE claim (reported as clean, never a finding).
const GAS_PATTERNS = [
  /tiny\s+gas/i,
  /gas\s*:?\s*(price|fee|limit|balance|estimate|estimated|reading)/i,
  /gas\s+is\s+estimated/i,
  /\bgwei\b/i,
  /\bbuy\s+(eth|arb|native)/i,
  /\bget\s+(eth|arb)\s+for\s+gas/i,
  /\bacquire\s+(eth|native\s+token)/i,
  /native[- ]token\s+(balance|for)/i,
  /\bfuel\s+(up|your)/i,
  /stake\s+.*(cpu|net)/i,
];

const POSITIVE = /gasless|no\s+gas|gas[- ]free|sponsor/i;   // abstraction claims — clean

// ── human-facing candidates ─────────────────────────────────────────────────
// The audit's charter is the HUMAN-FACING contract — labels, prompts, error
// strings — never the signing plumbing. Candidates are:
//   (a) HTML text nodes — extracted over the WHOLE file with line mapping
//       (a node's opening '>' may sit on the previous line);
//   (b) quoted JS string literals with sentence shape, or a bare unit word
//       the panel renders to humans (checked BEFORE the identifier
//       exclusion — 'gwei' is identifier-shaped AND human-facing).
// 'eth_gasPrice' RPC methods and variable names never become candidates.
const UNITS = /^(gwei|wei|gas|eth|arb|fuel)$/i;

function humanStringsOnLine(line) {
  const out = [];
  for (const m of line.matchAll(/'([^']*)'|"([^"]*)"/g)) {
    const s = (m[1] ?? m[2] ?? '').trim();
    if (!s) continue;
    // length cap: human strings are short; a long capture means odd quote
    // parity flipped pairing and the "literal" is code between apostrophes
    if (s.length > 80) continue;
    if (/^[A-Za-z0-9_]+$/.test(s) && !UNITS.test(s)) continue;   // plumbing identifier
    if (/\s/.test(s) || UNITS.test(s)) out.push(s);
  }
  return out;
}

/** HTML text nodes across the whole file, mapped to 1-based line numbers.
 * Script/style bodies are blanked first (newlines kept, so line numbers
 * survive): the code between a `>` and a `<` OPERATOR inside a script is
 * not human-facing text — script literals are covered by pass (b). */
function htmlTextNodes(text) {
  const blanked = text.replace(
    /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,
    m => m.replace(/[^\n]/g, ' '),
  );
  const nodes = [];
  const re = />([^<>]+)</g;
  let m;
  while ((m = re.exec(blanked)) !== null) {
    const s = m[1].trim();
    if (!s) continue;
    const line = blanked.slice(0, m.index).split('\n').length;
    nodes.push({ line, text: s });
  }
  return nodes;
}

function scan(file, text) {
  const raw = [];
  const lines = text.split('\n');
  const lineIsPositive = (idx) => POSITIVE.test(lines[idx] ?? '');
  // (a) HTML text nodes, whole-file
  for (const node of htmlTextNodes(text)) {
    if (lineIsPositive(node.line - 1)) continue;
    for (const re of GAS_PATTERNS) {
      if (re.test(node.text)) {
        raw.push({ file, line: node.line, pattern: re.source, match: node.text,
                   text: node.text.slice(0, 110) });
        break;
      }
    }
  }
  // (b) quoted literals per line
  lines.forEach((line, i) => {
    const candidates = humanStringsOnLine(line);
    if (!candidates.length || lineIsPositive(i)) return;
    for (const re of GAS_PATTERNS) {
      const matched = candidates.find(c => re.test(c));
      if (matched !== undefined) {
        raw.push({ file, line: i + 1, pattern: re.source, match: matched,
                   text: line.trim().slice(0, 110) });
        break;                                              // one finding per line
      }
    }
  });
  // dedupe: same file+line reported once (HTML pass and literal pass agree)
  const seen = new Set();
  return raw.filter(h => {
    const k = `${h.file}:${h.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── the audit ───────────────────────────────────────────────────────────────
const files = readdirSync(SURFACES).filter(f => f === 'wallet.html' || f.startsWith('wallet-adapter-'));
let failures = 0;
const fail = (msg) => { console.error(`  FAIL: ${msg}`); failures++; };

console.log('AV-11 HUMAN-GAS SURFACE AUDIT — rail classification + findings\n');
console.log('  rail                          class        gas-surface findings');
console.log('  ────────────────────────────  ──────────   ─────────────────────');

const ledgerUsed = new Set();
for (const file of files) {
  const cls = CLASSIFICATION[file];
  if (!cls) {
    fail(`UNCLASSIFIED RAIL: surfaces/${file} — classify FIRST_LINE or `
      + 'LAST_LINE in this audit; a first-line classification carries the '
      + 'no-human-gas obligation');
    console.log(`  ${file.padEnd(30)} UNCLASSIFIED`);
    continue;
  }
  const hits = scan(file, readFileSync(join(SURFACES, file), 'utf8'));
  if (cls === 'LAST_LINE') {
    console.log(`  ${file.padEnd(30)} LAST_LINE    ${hits.length} (reported — native-asset rail, R5 last-line)`);
    for (const h of hits) console.log(`      · ${h.line}: ${h.text}`);
    continue;
  }
  const unregistered = [];
  for (const h of hits) {
    const entry = LEDGER.find(e => e.file === file
      && (h.match.match(new RegExp(e.pattern, 'i')) || h.text.match(new RegExp(e.pattern, 'i'))));
    if (entry) {
      ledgerUsed.add(entry);
      console.log(`  ${file.padEnd(30)} FIRST_LINE   ${h.line}: REGISTERED — ${entry.remediation}`);
    } else {
      unregistered.push(h);
    }
  }
  if (!hits.length) console.log(`  ${file.padEnd(30)} FIRST_LINE   0 — clean`);
  for (const h of unregistered) {
    fail(`UNREGISTERED GAS SURFACE on a FIRST-LINE rail: ${file}:${h.line} `
      + `"${h.text}" (pattern ${h.pattern}) — this is the future-rail `
      + 'detector: fix the flow (sponsor/abstract) or register the finding '
      + 'with its remediation in this audit');
  }
}

// ledger hygiene: every entry must still match reality (no stale debt, and
// the ledger can never lag the surfaces)
for (const entry of LEDGER) {
  if (!ledgerUsed.has(entry)) {
    fail(`STALE LEDGER ENTRY: ${entry.file} / "${entry.pattern}" no longer matches any surface line `
      + '— clean the ledger when the remediation lands (never before)');
  }
}

// the mirror surface: meter.py's voucher view (the serve bridge's top-up
// door labels ride BOTH surfaces — a gas label there is the same finding,
// riding the SAME registration as the wallet's; the two surfaces must tell
// one story)
{
  const meterPath = join(ROOT, 'scripts/buzz-meter/meter.py');
  const meter = readFileSync(meterPath, 'utf8');
  const lineNo = meter.split('\n').findIndex(l => /tiny gas/i.test(l)) + 1;
  const registered = LEDGER.some(e => e.pattern === 'tiny gas');
  if (lineNo > 0 && !registered) {
    fail(`UNREGISTERED GAS SURFACE: scripts/buzz-meter/meter.py:${lineNo} `
      + 'voucher_view rail_usdc label says "tiny gas" — the serve bridge and '
      + 'the wallet must tell the SAME story');
  }
  if (lineNo > 0) console.log(`  meter.py voucher_view           FIRST_LINE   ${lineNo}: REGISTERED — same finding + R5 remediation as wallet.html`);
}

console.log('');
if (failures) {
  console.error(`AV-11: ${failures} failure(s) — the human-facing contract has unregistered gas surfaces or unclassified rails`);
  process.exit(1);
}
console.log('AV-11: structure sound — every rail classified, every first-line gas '
  + 'surface REGISTERED with its remediation, no stale ledger entries.');
console.log('       The registered findings are the R5 gas-abstraction backlog, kept '
  + 'visible here on purpose: registered ≠ resolved.');
console.log('\n=== AV-11 HUMAN-GAS AUDIT — PASS (structure) ===');
