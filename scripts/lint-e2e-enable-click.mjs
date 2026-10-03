// lint-e2e-enable-click.mjs — a browser test enables a control in exactly
// one place: e2e/lib/enable-click.mjs.
//
// THE RACE (wallet check, run 37108235973 attempt 1, 2026-10-03):
// e2e/wallet-arweave.mjs set `disabled = false` on the intentionally unfunded
// publish control in one evaluate and clicked it in a second step. The page's
// own balance refresh re-disabled the button between the two, and Playwright
// waited 30 s for an enabled element. It went red on unrelated commits, and a
// dispatch had already claimed the repair.
//
// WHY THIS IS A BLUNT RULE. The first cuts of this check tried to recognise
// the race itself: find the browser task, find the click, decide whether the
// two belong to the same control. Four review rounds each found a real hole
// (line layout, regex literals, evaluateAll, deferred callbacks, two locator
// spellings for one button), and a text reader cannot close that class. So
// the check no longer judges whether an enable is safe. The only code that
// may enable a control is enableAndClick() in e2e/lib/enable-click.mjs, which
// enables and clicks in one synchronous browser task. Every other write to
// `disabled` under e2e/ fails the run unless it is on the ledger below with
// its reason and its exact count.
//
// It reads raw text on purpose. A write inside a string passed to evaluate
// counts, and so does one inside a comment: nothing is skipped, so nothing
// can hide. What it cannot see is an enable that never names `disabled`
// (a helper in page code, a property set through a computed key).
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const E2E = join(ROOT, 'e2e');

// file -> exact count of writes, and why each is not this race. A count that
// drifts either way fails: a new write needs a new reason, and a stale entry
// is a false signal.
const LEDGER = {
  'e2e/lib/enable-click.mjs': [1, 'the helper itself: enable and click in one browser task'],
  'e2e/agent-dock.test.mjs': [2, 'mock Element in Node, no browser: field initialiser and its removeAttribute'],
  'e2e/artist-audio-player.test.mjs': [1, 'mock Element in Node, no browser: field initialiser'],
  'e2e/first-click.test.mjs': [1, 'mock Element in Node, no browser: disabled read from parsed HTML'],
  'e2e/blight-gallery-eternal.test.mjs': [2, 'enables to read the computed colour and restores in the same task; never clicked'],
  'e2e/blight-market-eternal.test.mjs': [2, 'enables to read the computed colour and restores in the same task; never clicked'],
  'e2e/vending-machine.test.mjs': [2, 'regex source matched against page HTML; nothing is written'],
};

// A write is any assignment to `.disabled`, or removeAttribute/toggleAttribute
// of 'disabled'. Only a whole-statement literal true is a plain disable:
// `= true;` is cleared, `= true && false` and `= 1 - 1` are not.
const END = String.raw`\s*(?:[;,)}\]]|$)`;
// the rest of the line is read by lookahead, so a second write on it still counts
const ASSIGN = /\.disabled\s*=(?!=)(?=([^\n]*))/g;
const ATTR = /\.(removeAttribute|toggleAttribute)\s*\(\s*['"`]disabled['"`](?=([^\n]*))/g;
const TRUE_RHS = new RegExp(String.raw`^\s*(?:true|!0|1)` + END);
const TRUE_FORCE = new RegExp(String.raw`^\s*,\s*(?:true|!0|1)\s*\)`);
function writes(text) {
  let n = 0;
  for (const m of text.matchAll(ASSIGN)) if (!TRUE_RHS.test(m[1])) n++;
  for (const m of text.matchAll(ATTR)) if (!(m[1] === 'toggleAttribute' && TRUE_FORCE.test(m[2]))) n++;
  return n;
}

// the check proves it fires before it is trusted
const SELF = [
  ['b.disabled = false', 'x.evaluate(b => { b.disabled = false; });', 1],
  ['b.disabled = 0', 'x.evaluate(b => { b.disabled = 0; });', 1],
  ['true && false', 'x.evaluate(b => { b.disabled = true && false; });', 1],
  ['1 - 1', 'x.evaluate(b => { b.disabled = 1 - 1; });', 1],
  ['a variable', 'x.evaluate(b => { b.disabled = was; });', 1],
  ['evaluateAll', 'x.evaluateAll(bs => { bs[0].disabled = false; });', 1],
  ['a string body', 'page.evaluate("document.querySelector(\'#go\').disabled = false");', 1],
  ['removeAttribute', "x.evaluate(b => { b.removeAttribute('disabled'); });", 1],
  ['toggleAttribute off', "x.evaluate(b => { b.toggleAttribute('disabled', false); });", 1],
  ['toggleAttribute with no force', "x.evaluate(b => { b.toggleAttribute('disabled'); });", 1],
  ['a deferred click beside it', 'x.evaluate(b => { b.disabled = false; setTimeout(() => b.click(), 9); });', 1],
  ['two on one line', 'a.disabled = false; b.disabled = false;', 2],
  ['a literal disable', 'x.evaluate(b => { b.disabled = true; });', 0],
  ['toggleAttribute on', "x.evaluate(b => { b.toggleAttribute('disabled', true); });", 0],
  ['a comparison', 'if (b.disabled == false) go(); if (b.disabled === false) go();', 0],
  ['a read', 'const was = b.disabled;', 0],
];
let bad = 0;
for (const [name, src, want] of SELF) {
  const got = writes(src);
  if (got !== want) { console.log(`FAIL self-test — ${name}: counted ${got}, want ${want}`); bad++; }
  else console.log(`PASS self-test — ${name} counts ${want}`);
}

// every JavaScript file under e2e/, nested directories included; installed
// packages and links are not ours to judge
async function walk(dir) {
  const found = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    if (d.name === 'node_modules' || d.isSymbolicLink()) continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) found.push(...await walk(p));
    else if (/\.(mjs|js|cjs)$/.test(d.name)) found.push(p);
  }
  return found;
}
const files = (await walk(E2E)).sort();
const seen = new Set();
for (const f of files) {
  const name = relative(ROOT, f).split('\\').join('/');
  const n = writes(await readFile(f, 'utf8'));
  const entry = LEDGER[name];
  if (entry) {
    seen.add(name);
    if (n !== entry[0]) { bad++; console.log(`FAIL ${name} writes to disabled ${n} time(s), ledger says ${entry[0]} — a new write needs its own reason, a removed one leaves a stale entry`); }
    else console.log(`PASS ${name} — ${n} on the ledger: ${entry[1]}`);
  } else if (n) {
    bad++;
    console.log(`FAIL ${name} writes to disabled ${n} time(s) — to press a disabled control use enableAndClick() from e2e/lib/enable-click.mjs; a separate enable and click races the page`);
  }
}
for (const name of Object.keys(LEDGER)) if (!seen.has(name)) { bad++; console.log(`FAIL ledger names ${name}, which was not read — a stale entry is a false signal`); }
if (files.length === 0) { console.log('FAIL read ZERO e2e files — a could-not-compute fails closed'); process.exit(1); }
console.log(`\n${files.length} e2e files read — ${bad ? 'FIX BEFORE PUSH' : 'the only enable is the one-task helper'}`);
process.exit(bad ? 1 : 0);
