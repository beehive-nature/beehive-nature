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
// in a later Playwright step, so the shape cannot come back invisibly.
//
// The lawful shape is one browser task:
//   await page.locator('#x').evaluate(b => { b.disabled = false; b.click(); });
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const E2E = join(HERE, '..', 'e2e');
const ENABLE = /\.disabled\s*=\s*(false|!1)|removeAttribute\(\s*['"]disabled['"]/g;
const TASK = /\.(evaluate|evaluateHandle|\$eval|\$\$eval)\(/g; // a call whose callback runs as one browser task
const CLICK = /\.click\(/;
const REACH = 3; // code lines after the task closes in which a separate click is the race

// offset of the paren closing the one opened at `open`, skipping strings and
// comments; -1 if it never closes
function closeOf(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2); if (i < 0) return -1; i++;
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return -1;
}
const lineOf = (text, at) => text.slice(0, at).split('\n').length;

// The boundary is the browser task, never the physical line: an enable is
// safe only if the click sits inside the same evaluate call. A click that
// follows the call's closing paren is a second Playwright step, whether it is
// on the next line or the same one. An enable outside any evaluate call is
// test-side DOM (the mock elements) and is not this race.
function findings(text) {
  const tasks = [];
  for (const m of text.matchAll(TASK)) {
    const open = m.index + m[0].length - 1, close = closeOf(text, open);
    if (close > 0) tasks.push({ open, close });
  }
  const out = [];
  for (const m of text.matchAll(ENABLE)) {
    const inside = tasks.filter(t => t.open < m.index && m.index < t.close);
    if (!inside.length) continue;
    const task = inside.reduce((x, y) => (y.open < x.open ? y : x)); // outermost task
    if (CLICK.test(text.slice(m.index, task.close))) continue; // enabled and clicked in one task
    const after = text.slice(task.close + 1).split('\n');
    let seen = 0, off = task.close + 1;
    for (let j = 0; j < after.length; j++) {
      const l = after[j].trim(), here = off;
      off += after[j].length + 1;
      if (j > 0) { // the rest of the closing line is always in reach
        if (!l || l.startsWith('//')) continue;
        if (++seen > REACH) break;
        if (new RegExp(ENABLE.source).test(l)) break; // the next enable owns its own window
      }
      const k = after[j].search(CLICK);
      if (k >= 0) { out.push({ line: lineOf(text, m.index), click: lineOf(text, here + k) }); break; }
    }
  }
  return out;
}

// the check proves it fires before it is trusted: the shape that went red
// must be caught however it is laid out, and the repaired shape must pass
// however it is laid out
const E = "await page.locator('#arw-go').evaluate(b => { b.disabled = false; });";
const C = "await page.locator('#arw-go').click();";
const W = 'await page.waitForFunction(() => true);\n';
const SELF = [
  ['two steps on two lines', E + '\n' + C + '\n', 1],
  ['two steps on one line', E + ' ' + C + '\n', 1],
  ['one task on one line', "await page.locator('#arw-go').evaluate(b => { b.disabled = false; b.click(); });\n" + W, 0],
  ['one task across lines', "await page.locator('#arw-go').evaluate(b => {\n  b.disabled = false;\n  b.click();\n});\n" + W, 0],
];
let bad = 0;
for (const [name, src, want] of SELF) {
  const got = findings(src).length;
  if (got !== want) { console.log(`FAIL self-test — ${name}: ${got} finding(s), want ${want}`); bad++; }
  else console.log(`PASS self-test — ${name} is ${want ? 'caught' : 'clean'}`);
}

const files = (await readdir(E2E)).filter(f => /\.(mjs|js|cjs)$/.test(f)).sort();
for (const f of files) {
  for (const hit of findings(await readFile(join(E2E, f), 'utf8'))) {
    bad++;
    console.log(`FAIL e2e/${f}:${hit.line} enables a control, then clicks at :${hit.click} in a separate step — the page can re-disable it between them; do both in one evaluate`);
  }
}
if (files.length === 0) { console.log('FAIL read ZERO e2e files — a could-not-compute fails closed'); process.exit(1); }
console.log(`\n${files.length} e2e files read — ${bad ? 'FIX BEFORE PUSH' : 'no enable-then-click race shape'}`);
process.exit(bad ? 1 : 0);
