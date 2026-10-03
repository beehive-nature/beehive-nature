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
// within the next few lines, so the shape cannot come back invisibly.
//
// The lawful shape is one browser task:
//   await page.locator('#x').evaluate(b => { b.disabled = false; b.click(); });
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const E2E = join(HERE, '..', 'e2e');
const ENABLE = /\.disabled\s*=\s*(false|!1)|removeAttribute\(\s*['"]disabled['"]/;
const CLICK = /\.click\(/;
const REACH = 3; // code lines after the enable in which a separate click is the race

function findings(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!ENABLE.test(lines[i]) || CLICK.test(lines[i])) continue; // enable+click on one line is one task
    let seen = 0;
    for (let j = i + 1; j < lines.length && seen < REACH; j++) {
      const l = lines[j].trim();
      if (!l || l.startsWith('//')) continue;
      seen++;
      if (ENABLE.test(l)) break; // the next enable owns its own window
      if (CLICK.test(l)) { out.push({ line: i + 1, click: j + 1 }); break; }
    }
  }
  return out;
}

// the check proves it fires before it is trusted: the exact shape that went
// red must be caught, the repaired shape must pass
const RACE = "await page.locator('#arw-go').evaluate(b => { b.disabled = false; });\nawait page.locator('#arw-go').click();\n";
const ATOMIC = "await page.locator('#arw-go').evaluate(b => { b.disabled = false; b.click(); });\nawait page.waitForFunction(() => true);\n";
let bad = 0;
if (findings(RACE).length !== 1) { console.log('FAIL self-test — the two-step shape that went red is not caught'); bad++; }
else console.log('PASS self-test — the two-step enable-then-click shape is caught');
if (findings(ATOMIC).length !== 0) { console.log('FAIL self-test — the one-task shape is wrongly flagged'); bad++; }
else console.log('PASS self-test — the one-task shape passes');

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
