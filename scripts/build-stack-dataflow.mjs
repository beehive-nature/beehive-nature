// build-stack-dataflow.mjs — the Engine Room data-loop evidence card, GENERATED.
// The card on surfaces/stack.html (#dataflow) fetches surfaces/stack-dataflow-example.json;
// every value in that file is parsed from the cited receipts at build time, never
// hand-typed — the "read mechanically from existing artifacts" law. A missing optional
// source writes an explicit null, and the page says "in review" instead of inventing
// a number. The e2e suite (e2e/engineflow.browser.mjs) re-derives the same values
// from the receipts and fails if either side drifts, so this artifact cannot rot.
//
//   node scripts/build-stack-dataflow.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INTAKE = join(ROOT, 'docs/dispatches/2026-09-17-watch-try-autonomi-intake.md');
const QUOTE = join(ROOT, 'docs/receipts/bpay-quote-try-autonomi-2026-09-17.md');
const OUT = join(ROOT, 'surfaces/stack-dataflow-example.json');

const md = readFileSync(INTAKE, 'utf8');
const miss = [];
function must(name, re, txt = md) {
  const m = txt.match(re);
  if (!m) { miss.push(name); return null; }
  return m;
}

// §1 of the intake receipt: identity + forensics of the original file.
const mBytes = must('bytes', /(\d{1,3}(?:,\d{3})+) bytes \(/);
const mSha = must('sha256', /SHA-256: `([0-9a-f]{64})`/);
const mShape = must('shape', /H\.264[\s\S]*?(\d{3,4})×(\d{3,4}),[\s\S]*?(\d{2}) fps nominal/);
const mDur = must('duration', /Duration ([\d.]+) s/);
// §2: the browser playback verdict line.
const mPlay = must('playback verdict', /VERDICT: (PASS|FAIL) \((\d+)\/(\d+) checks\)/);
// §8: the founder-banked STATE BOARD — the journey's claim register.
const boardTxt = md.split('STATE BOARD (founder-banked')[1] || '';
const boardMap = {
  'intake/preparation': ['flow.b.intake', 'GREEN'],
  'browser playback': ['flow.b.play', 'GREEN'],
  'tv playback': ['flow.b.tv', 'NOT YET'],
  'ant quote': ['flow.b.quote', 'NEXT'],
  'ant upload/address': ['flow.b.upload', 'NOT YET'],
  'W@tch playable': ['flow.b.playable', 'NOT YET'],
  'independent ant retrieval': ['flow.b.retrieval', 'NOT YET'],
};
const STATUS = { GREEN: 'verified', NEXT: 'review', 'NOT YET': 'notyet' };
const board = [];
for (const [needle, [key, expect]] of Object.entries(boardMap)) {
  const re = new RegExp('- [^\\n]*' + needle.replace(/[-/]/g, '\\$&') + '[^\\n]*:\\s*\\*\\*([^*]+)\\*\\*', 'i');
  const m = boardTxt.match(re);
  if (!m) { miss.push('state board: ' + needle); continue; }
  const raw = m[1].trim().toUpperCase();
  if (!raw.startsWith(expect)) miss.push('state board ' + needle + ': expected ' + expect + ', read ' + raw);
  board.push({ k: key, status: STATUS[expect] });
}
// (the quote-chip upgrade lives after the quote block below, where quote is in scope)

// The two doctrine stages are charter facts, not receipt rows: the privacy chooser
// is Phase B by the merged rider (8758028e) and spending stays disabled until the
// surface passes review (the merged wake charter, 71f170f7). "by design", not "not yet".
const stateBoard = [
  { k: 'flow.b.boundary', status: 'design' },
  ...board.slice(0, 2),                       // intake · browser playback (GREEN pair)
  board.find(b => b.k === 'flow.b.quote'),    // quote
  { k: 'flow.b.authority', status: 'design' },
  // the rest in journey order: upload → playable on W@tch → TV → independent retrieval
  ...['flow.b.upload', 'flow.b.playable', 'flow.b.tv', 'flow.b.retrieval'].map(k => board.find(b => b.k === k)),
];
if (stateBoard.some(s => !s)) miss.push('state board assembly lost a row');

// Optional source: the quote receipt landed with PR #113 — when present the quote row
// carries the REAL figure and the board chip flips to verified (receipt-backed); when
// absent the page renders "in review", never an invented number.
let quote = null;
if (existsSync(QUOTE)) {
  const q = readFileSync(QUOTE, 'utf8');
  // the receipt carries its facts as a markdown table — parse rows at source, anchored
  const mAmt = must('quote amount', /total ANT \|\s*\*\*[\d,]+ atto = ([\d.]+) ANT\*\*/, q);
  const mChunks = must('quote chunks', /\| chunks \| (\d+) total/, q);
  const mType = must('quote payment_type', /\| payment_type \|\s*\*\*(\w+)\*\*/, q);
  if (mAmt && mChunks && mType) {
    quote = { amountAnt: mAmt[1], quotes: Number(mChunks[1]), paymentType: mType[1], source: 'docs/receipts/bpay-quote-try-autonomi-2026-09-17.md' };
  }
}
// the frozen intake board said the quote was NEXT; a landed quote receipt upgrades the
// RENDERED chip to verified (newer evidence upgrades the render, never the record itself)
if (quote) { const qc = board.find(b => b.k === 'flow.b.quote'); if (qc) qc.status = 'verified'; }

if (miss.length) {
  console.error('build-stack-dataflow: REFUSING — could not mechanically derive:');
  for (const m of miss) console.error('  - ' + m);
  process.exit(1);
}

// The full 64-hex digest stays in the receipts (hex-law marked there); this artifact
// carries a short pin — first 12 + last 6 — enough to eyeball-match, never a key shape.
const sha = mSha[1];
const out = {
  law: 'generated by scripts/build-stack-dataflow.mjs — every value parsed from the cited receipts; do not hand-edit',
  sources: [
    'docs/dispatches/2026-09-17-watch-try-autonomi-intake.md',
    ...(quote ? [quote.source] : []),
  ],
  file: {
    name: 'try_autonomi.mp4',
    bytes: Number(mBytes[1].replace(/,/g, '')),
    sha256Short: sha.slice(0, 12) + '…' + sha.slice(-6),
    shape: mShape[1] + '×' + mShape[2] + ' · ~' + mShape[3] + ' fps',
    durationSec: Number(mDur[1]),
    playback: { verdict: mPlay[1], checks: mPlay[2] + '/' + mPlay[3] },
  },
  quote,
  stateBoard,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('build-stack-dataflow: wrote surfaces/stack-dataflow-example.json — bytes ' + out.file.bytes +
  ', playback ' + out.file.playback.verdict + ' ' + out.file.playback.checks +
  ', board ' + out.stateBoard.length + ' chips, quote ' + (quote ? quote.amountAnt + ' ANT' : 'null (in review)'));
