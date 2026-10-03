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
// two belong to the same control. Review round after review round found a
// real hole (line layout, regex literals, evaluateAll, deferred callbacks,
// two locator spellings for one button), and a text reader cannot close that
// class. So the check no longer judges whether an enable is safe. The only
// code that may enable a control is enableAndClick() in
// e2e/lib/enable-click.mjs, which is pinned to its exact statement. Every
// other write to `disabled` under e2e/ fails the run unless it sits inside a
// snippet pinned on the ledger below, word for word, with its reason.
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

// THE HELPER IS PINNED, not counted. Its write is lawful only because the
// click is in the same synchronous callback; a count of one would still pass
// `evaluate(b => { b.disabled = false; }).then(() => locator.click())`, which
// is the race again at every call site. Comments aside, the file must be
// exactly this.
const HELPER = 'e2e/lib/enable-click.mjs';
const HELPER_CODE = [
  'export const enableAndClick = locator => locator.evaluate(b => {',
  "b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });",
  'const r = b.getBoundingClientRect();',
  'const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);',
  "if (!r.width || !r.height || getComputedStyle(b).visibility !== 'visible' || !(hit === b || b.contains(hit))) throw new Error('enableAndClick: the control is hidden or covered; a person could not press it');",
  'b.disabled = false;',
  'b.click();',
  '});',
].join('\n');
const codeOf = src => src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')).join('\n');

// file -> why its writes are not this race, and the exact snippets that hold
// them. Every write in the file must sit inside one of its pins: a write
// added outside them, or a pin edited by a single character (a restore
// changed to `= false`), fails. A count alone would let both through.
const ENABLE_READ_RESTORE = 'const was = act.disabled; act.disabled = false; const c = getComputedStyle(act).backgroundColor; act.disabled = was; return c;';
const LEDGER = {
  'e2e/agent-dock.test.mjs': ['mock Element in Node, no browser: field initialiser and its removeAttribute',
    ['this.hidden=false;this.disabled=false;', "if(k==='disabled')this.disabled=false;"]],
  'e2e/artist-audio-player.test.mjs': ['mock Element in Node, no browser: field initialiser',
    ['this.hidden = false; this.disabled = false;']],
  'e2e/first-click.test.mjs': ['mock Element in Node, no browser: disabled read from parsed HTML',
    [String.raw`e.disabled=/\sdisabled\b/.test(m[2]);`]],
  'e2e/first-work.test.mjs': ['mock Element in Node, no browser: Object.assign field initialiser',
    ['Object.assign(this,{id,children:[],listeners:{},attrs:{},disabled:false,']],
  'e2e/blight-gallery-eternal.test.mjs': ['enables to read the computed colour and restores in the same task; never clicked',
    [ENABLE_READ_RESTORE]],
  'e2e/blight-market-eternal.test.mjs': ['enables to read the computed colour and restores in the same task; never clicked',
    [ENABLE_READ_RESTORE]],
  'e2e/vending-machine.test.mjs': ['regex source matched against page HTML; nothing is written',
    [String.raw`\$\('papprove'\)\.disabled = true/`, String.raw`\$\('papprove'\)\.disabled = mintedHere\.has\(n\);/`]],
};

// A write is any plain or compound assignment to `.disabled` or
// `['disabled']`, an Object.assign that sets it, or removeAttribute /
// toggleAttribute of 'disabled'. Only a whole-statement literal true is a
// plain disable: `= true;` is cleared, `= true && false` and `= 1 - 1` are
// not. A compound assignment (&&=, ^=, ||=, ??= ...) is always a write: its
// result depends on the old value. The rest of the line is read by
// lookahead, so a second write on it still counts.
const END = String.raw`\s*(?:[;,)}\]]|$)`;
const ASSIGN = /(?:\.disabled|\[\s*['"`]disabled['"`]\s*\])\s*(\*\*|<<|>>>?|&&|\|\||\?\?|[-+*\/%&|^])?=(?![=>])(?=([^\n]*))/g;
const ATTR = /\.(removeAttribute|toggleAttribute)\s*\(\s*['"`]disabled['"`](?=([^\n]*))/g;
const TRUE_RHS = new RegExp(String.raw`^\s*(?:true|!0|1)` + END);
const TRUE_FORCE = new RegExp(String.raw`^\s*,\s*(?:true|!0|1)\s*\)`);
// the whole Object.assign call, across lines, to its closing paren; a bare
// object key elsewhere is a report or a mock's field, not a write
function assignCalls(text) {
  const calls = [];
  for (const m of text.matchAll(/Object\.assign\s*\(/g)) {
    let depth = 0, i = m.index + m[0].length - 1;
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')' && --depth === 0) break;
    }
    calls.push(text.slice(m.index, i + 1));
  }
  return calls;
}
function writes(text) {
  let n = 0;
  for (const m of text.matchAll(ASSIGN)) if (m[1] || !TRUE_RHS.test(m[2])) n++;
  for (const m of text.matchAll(ATTR)) if (!(m[1] === 'toggleAttribute' && TRUE_FORCE.test(m[2]))) n++;
  for (const call of assignCalls(text)) for (const m of call.matchAll(/\bdisabled['"`]?\s*:(?=([^\n]*))/g)) if (!TRUE_RHS.test(m[1])) n++;
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
  ['&&= false', 'x.evaluate(b => { b.disabled &&= false; });', 1],
  ['^= true', 'x.evaluate(b => { b.disabled ^= true; });', 1],
  ['a bracket write', "x.evaluate(b => { b['disabled'] = false; });", 1],
  ['Object.assign', 'x.evaluate(b => { Object.assign(b, { disabled: false }); });', 1],
  ['Object.assign across lines', 'x.evaluate(b => {\n  Object.assign(b, {\n    disabled: false\n  });\n});', 1],
  ['Object.assign setting true', 'Object.assign(b, {\n  disabled: true\n});', 0],
  ['a reported key is not a write', 'return { pressed: p, disabled: el.disabled };', 0],
  ['an arrow is not a write', 'const f = b => b.disabled => 1;', 0],
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

// a file passes its ledger entry only if every pin is present and the pins
// hold every write in it
function ledgerFault(text, pins) {
  const missing = pins.filter(p => !text.includes(p));
  if (missing.length) return `pinned snippet not found: ${missing[0]}`;
  const pinned = pins.reduce((n, p) => n + writes(p), 0), found = writes(text);
  return found === pinned ? null : `${found} write(s) in the file, ${pinned} inside its pins`;
}
{
  const body = 'p.evaluate(() => { ' + ENABLE_READ_RESTORE + ' });\n';
  const drifted = body.replace('act.disabled = was;', 'act.disabled = false;') + "await p.locator('#go').click();\n";
  const extra = body + 'p.evaluate(b => { b.disabled = false; });\n';
  const split = 'export const enableAndClick = locator => locator.evaluate(b => { b.disabled = false; }).then(() => locator.click());';
  const checks = [
    ['a pinned file reads clean', ledgerFault(body, [ENABLE_READ_RESTORE]) === null],
    ['a restore edited to an enable, same count, is refused', ledgerFault(drifted, [ENABLE_READ_RESTORE]) !== null],
    ['a write added outside the pins is refused', ledgerFault(extra, [ENABLE_READ_RESTORE]) !== null],
    ['the helper pin accepts itself and refuses a split helper', codeOf('// note\n' + HELPER_CODE + '\n') === HELPER_CODE && codeOf(split) !== HELPER_CODE],
  ];
  for (const [name, pass] of checks) { if (!pass) bad++; console.log(`${pass ? 'PASS' : 'FAIL'} self-test — ${name}`); }
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
  const text = (await readFile(f, 'utf8')).replace(/\r\n/g, '\n');
  seen.add(name);
  if (name === HELPER) {
    if (codeOf(text) !== HELPER_CODE) { bad++; console.log(`FAIL ${name} is not the pinned one-task helper — the actionability check, the enable and the click must stay in one synchronous evaluate callback`); }
    else console.log(`PASS ${name} — is the pinned one-task helper, word for word outside comments`);
  } else if (LEDGER[name]) {
    const [why, pins] = LEDGER[name], fault = ledgerFault(text, pins);
    if (fault) { bad++; console.log(`FAIL ${name} has left its ledger entry — ${fault}`); }
    else console.log(`PASS ${name} — every write is inside its pins: ${why}`);
  } else {
    const n = writes(text);
    if (n) { bad++; console.log(`FAIL ${name} writes to disabled ${n} time(s) — to press a disabled control use enableAndClick() from e2e/lib/enable-click.mjs; a separate enable and click races the page`); }
  }
}
for (const name of [HELPER, ...Object.keys(LEDGER)]) if (!seen.has(name)) { bad++; console.log(`FAIL ${name} is named here and was not read — a stale entry is a false signal`); }
if (files.length === 0) { console.log('FAIL read ZERO e2e files — a could-not-compute fails closed'); process.exit(1); }
console.log(`\n${files.length} e2e files read — ${bad ? 'FIX BEFORE PUSH' : 'the only enable is the one-task helper'}`);
process.exit(bad ? 1 : 0);
