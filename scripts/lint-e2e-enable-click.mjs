// lint-e2e-enable-click.mjs — no browser test enables a control in one
// Playwright step and clicks it in the next.
//
// THE RACE (wallet check, run 37108235973 attempt 1, 2026-10-03):
// e2e/wallet-arweave.mjs set `disabled = false` on the intentionally unfunded
// publish control in one evaluate and clicked it in a second step. The page's
// own balance refresh re-disabled the button between the two, and Playwright
// waited 30 s for an enabled element. It went red on unrelated commits, and a
// dispatch had already claimed the repair. The class fix is not two lines:
// THIS check fails the run if any e2e file enables a control and then clicks
// it in a later Playwright step, so the shape cannot come back invisibly.
//
// The lawful shape is one browser task:
//   await page.locator('#x').evaluate(b => { b.disabled = false; b.click(); });
//
// LIMITS, stated so the check is never read as more than it is: it reads
// source text, not a syntax tree. An enable written inside a string passed to
// evaluate, or in a helper called from the callback, is not seen.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const E2E = join(HERE, '..', 'e2e');
const REACH = 3; // code lines after the task closes in which a separate click is the race

// Same-length copy of the source with every comment, string, template and
// regular-expression literal blanked, so parens and `.click(` are only ever
// matched in executable code. Newlines survive; offsets line up with the
// original.
const REGEX_AFTER = new Set(['return', 'typeof', 'case', 'in', 'of', 'void', 'delete', 'throw', 'await']);
function mask(text) {
  const out = text.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    let end = -1;
    if (c === '/' && n === '/') { end = text.indexOf('\n', i); if (end < 0) end = text.length; }
    else if (c === '/' && n === '*') { end = text.indexOf('*/', i + 2); end = end < 0 ? text.length : end + 2; }
    else if (c === '"' || c === "'" || c === '`') {
      for (end = i + 1; end < text.length && text[end] !== c; end++) if (text[end] === '\\') end++;
      end++;
    } else if (c === '/') {
      const before = out.slice(0, i).join('').trimEnd();
      const word = (before.match(/[A-Za-z_$]+$/) || [''])[0];
      const last = before.slice(-1);
      if (!before || '(,=:[!&|?{};+-*%<>~^'.includes(last) || REGEX_AFTER.has(word)) {
        let cls = false;
        for (end = i + 1; end < text.length && text[end] !== '\n'; end++) {
          if (text[end] === '\\') end++;
          else if (text[end] === '[') cls = true;
          else if (text[end] === ']') cls = false;
          else if (text[end] === '/' && !cls) break;
        }
        end++;
      }
    }
    if (end > i) { blank(i, end); i = end - 1; }
  }
  return out.join('');
}

// offset of the paren closing the one opened at `open` in masked text
function closeOf(m, open) {
  let depth = 0;
  for (let i = open; i < m.length; i++) {
    if (m[i] === '(') depth++;
    else if (m[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

// the expression a `.member` hangs off, read backwards from its dot: a chain
// such as page.locator('#x') or document.getElementById('x'), original text
function exprBefore(m, text, dot) {
  let depth = 0, j = dot - 1;
  for (; j >= 0; j--) {
    const c = m[j];
    if (c === ')' || c === ']') depth++;
    else if (c === '(' || c === '[') { if (depth === 0) break; depth--; }
    else if (depth === 0) {
      if (/[;{},=!&|?:+*<>]/.test(c)) break;
      if (/\s/.test(c)) { // whitespace belongs to the chain only beside a dot
        const next = m.slice(j).match(/^\s*(.)/), prev = m.slice(0, j + 1).match(/(\S)\s*$/);
        if (!(next && next[1] === '.') && !(prev && prev[1] === '.')) break;
      }
    }
  }
  return text.slice(j + 1, dot).replace(/\s+/g, '');
}
const literals = expr => [...expr.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map(x => x[2].replace(/[^A-Za-z0-9_-]/g, '')).filter(s => s.length > 1);
const lineOf = (text, at) => text.slice(0, at).split('\n').length;

// The boundary is the browser task, never the physical line, and the click
// that counts is a click on the control that was enabled.
//  - safe: inside the same evaluate call, after the enable, the same
//    expression that was enabled is clicked (b.disabled = false; b.click()).
//  - the race: no such click, and a Playwright click follows the call's
//    closing paren on a target that is, or may be, the enabled control.
// A following click is cleared only when both sides name their target by a
// literal and the literals share nothing; anything it cannot tell apart is
// flagged. An enable outside any evaluate call is test-side DOM (the mock
// elements) and is not this race.
function findings(text) {
  const m = mask(text);
  const tasks = [];
  for (const t of m.matchAll(/\.(evaluate|evaluateHandle|\$eval|\$\$eval)\s*\(/g)) {
    const open = t.index + t[0].length - 1, close = closeOf(m, open);
    if (close > 0) tasks.push({ dot: t.index, open, close });
  }
  const enables = [];
  for (const e of m.matchAll(/\.disabled\s*=\s*(false\b|!1)/g)) enables.push(e.index);
  for (const e of m.matchAll(/\.removeAttribute\s*\(/g)) {
    const open = e.index + e[0].length - 1;
    if (/^\(\s*['"`]disabled['"`]/.test(text.slice(open))) enables.push(e.index);
  }
  const out = [];
  for (const at of enables.sort((a, b) => a - b)) {
    const inside = tasks.filter(t => t.open < at && at < t.close);
    if (!inside.length) continue;
    const task = inside.reduce((x, y) => (y.open < x.open ? y : x)); // outermost task
    const enabled = exprBefore(m, text, at);
    const body = m.slice(at, task.close);
    let atomic = false;
    for (const c of body.matchAll(/\.click\s*\(/g)) if (exprBefore(m, text, at + c.index) === enabled) { atomic = true; break; }
    if (atomic) continue;
    const target = exprBefore(m, text, task.dot);
    const named = [...literals(target), ...literals(enabled)];
    const rest = m.slice(task.close + 1).split('\n');
    let seen = 0, off = task.close + 1;
    for (let j = 0; j < rest.length; j++) {
      const here = off;
      off += rest[j].length + 1;
      if (j > 0) { // the rest of the closing line is always in reach
        if (!rest[j].trim()) continue;
        if (++seen > REACH) break;
      }
      let hit = -1;
      for (const c of rest[j].matchAll(/\.click\s*\(/g)) {
        const clicked = exprBefore(m, text, here + c.index), theirs = literals(clicked);
        const apart = clicked !== target && named.length && theirs.length &&
          !named.some(a => theirs.some(b => a.includes(b) || b.includes(a)));
        if (!apart) { hit = here + c.index; break; }
      }
      if (hit >= 0) { out.push({ line: lineOf(text, at), click: lineOf(text, hit) }); break; }
    }
  }
  return out;
}

// the check proves it fires before it is trusted: the shape that went red
// must be caught however it is laid out, and the repaired shape must pass
// however it is laid out
const L = "await page.locator('#arw-go')";
const C = L + '.click();';
const W = 'await page.waitForFunction(() => true);\n';
const SELF = [
  ['two steps on two lines', L + '.evaluate(b => { b.disabled = false; });\n' + C + '\n', 1],
  ['two steps on one line', L + '.evaluate(b => { b.disabled = false; }); ' + C + '\n', 1],
  ['space before the call paren', L + '.evaluate (b => { b.disabled = false; });\n' + C + '\n', 1],
  ['another element clicked inside the task', L + '.evaluate(b => { b.disabled = false; document.body.click(); });\n' + C + '\n', 1],
  ['a click only in a comment inside the task', L + '.evaluate(b => { b.disabled = false; /* b.click() */ });\n' + C + '\n', 1],
  ['a click only in a string inside the task', L + ".evaluate(b => { b.disabled = false; b.title = 'b.click()'; });\n" + C + '\n', 1],
  ['a regex with a paren before the enable', L + '.evaluate(b => { if (/^[)]$/.test(b.textContent)) return; b.disabled = false; });\n' + C + '\n', 1],
  ['removeAttribute then a separate click', L + ".evaluate(b => { b.removeAttribute('disabled'); });\n" + C + '\n', 1],
  ['enable by id in page.evaluate, then a locator click', "await page.evaluate(() => { document.getElementById('arw-go').disabled = false; });\n" + C + '\n', 1],
  ['one task on one line', L + '.evaluate(b => { b.disabled = false; b.click(); });\n' + W, 0],
  ['one task across lines', L + '.evaluate(b => {\n  b.disabled = false;\n  b.click();\n});\n' + W, 0],
  ['a later click on a different named control', L + ".evaluate(b => { b.disabled = false; });\nawait page.locator('#other').click();\n", 0],
];
let bad = 0;
for (const [name, src, want] of SELF) {
  const got = findings(src).length;
  if (got !== want) { console.log(`FAIL self-test — ${name}: ${got} finding(s), want ${want}`); bad++; }
  else console.log(`PASS self-test — ${name} is ${want ? 'caught' : 'clean'}`);
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
for (const f of files) {
  const name = relative(join(E2E, '..'), f).split('\\').join('/');
  for (const hit of findings(await readFile(f, 'utf8'))) {
    bad++;
    console.log(`FAIL ${name}:${hit.line} enables a control, then clicks at :${hit.click} in a separate step — the page can re-disable it between them; do both in one evaluate`);
  }
}
if (files.length === 0) { console.log('FAIL read ZERO e2e files — a could-not-compute fails closed'); process.exit(1); }
console.log(`\n${files.length} e2e files read — ${bad ? 'FIX BEFORE PUSH' : 'no enable-then-click race shape'}`);
process.exit(bad ? 1 : 0);
