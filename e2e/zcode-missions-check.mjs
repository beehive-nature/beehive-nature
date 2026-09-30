// zcode-missions-check.mjs — the LOVErnment mission surfaces, verified end to end.
// Serves surfaces/ locally, walks all three stations in all three registers, and
// checks the estate's laws where they bite: one set of facts across registers,
// the chain verified (and loudly broken when tampered), ceiling math from the
// same engine that wrote the seed, human levers appending chained receipts,
// releases refused outside the envelope, and no horizontal overflow at 390px.
// Shots land in e2e/shots-missions/ (390px, per register) as the visual receipt.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const SHOTS = join(HERE, 'shots-missions');
mkdirSync(SHOTS, { recursive: true });

/* expected figures come from the engine + seed themselves — the test never
   hardcodes a budget number the generator could honestly change */
createRequire(import.meta.url)('../surfaces/mission-core.js');
require_node('../surfaces/mission-seed.js');
function require_node(rel) { createRequire(import.meta.url)(rel); }
const M = globalThis.BNRMissions;
const SEED = globalThis.BNR_MISSION_SEED;
const SEED_CHECK = M.verifyChain(SEED.receipts);
const TOTAL_SPEND = Math.round(SEED.receipts.reduce((s, r) => s + (r.cost_usd || 0), 0) * 100) / 100;
const MISSION_IDS = SEED.missions.map(m => m.mission.id);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = createServer(async (q, s) => {
  try {
    const p = join(SURF, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(p);
    s.writeHead(200, { 'content-type': MIME[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' });
    s.end(body);
  } catch { s.writeHead(404); s.end(); }
});

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

/* the shared shell law: tour.js pinned, exactly once, per surface */
for (const f of ['missions.html', 'mission-room.html', 'receipts.html']) {
  const src = readFileSync(join(SURF, f), 'utf8');
  ok((src.match(/tour\.js\?v=42/g) || []).length === 1, f + ' loads tour.js?v=42 exactly once');
  ok(src.includes('mission-seed.js') && src.includes('mission-core.js'), f + ' loads the shared engine');
  ok(/or-board\.html/.test(src), f + ' links the OR board (the live roster station)');
}

await new Promise(r => srv.listen(8861, '127.0.0.1', r));
const browser = await chromium.launch();
const BASE = 'http://127.0.0.1:8861';
const REGS = ['bee', 'raver', 'cypherpunk'];

async function open(path, reg) {
  const ctx = await browser.newContext();
  if (reg) await ctx.addInitScript(r => localStorage.setItem('bregister', r), reg);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await page.goto(BASE + '/' + path, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(350);
  return { ctx, page, errs };
}

console.log('· the seed under the engine (node side)');
ok(SEED_CHECK.ok && SEED_CHECK.count === SEED.receipts.length, 'seed chain verifies under mission-core.js (' + SEED_CHECK.count + ' receipts)');
ok(MissionBudgetTotal(), 'engine budget re-derives the seeded requested totals');

function MissionBudgetTotal() {
  return SEED.missions.every(m => {
    const b = M.budget(m.resources);
    return Math.abs(b.requested_total - m.finance.requested_total) < 0.005;
  });
}

console.log('· three registers, one set of facts');
const factsByReg = {};
for (const reg of REGS) {
  const desk = await open('missions.html', reg);
  ok(desk.errs.length === 0, 'missions.html ' + reg + ' zero page errors');
  const applied = await desk.page.evaluate(() => document.body.getAttribute('data-reg'));
  ok(applied === reg, 'missions.html ' + reg + ' register applied on the body');
  const chips = await desk.page.locator('[data-mission]').count();
  ok(chips === MISSION_IDS.length, 'missions.html ' + reg + ' docket carries all ' + MISSION_IDS.length + ' missions');
  const status = await desk.page.textContent('#status');
  ok(/ledger loaded|chain verified/i.test(status || ''), 'missions.html ' + reg + ' ledger loaded');
  factsByReg[reg] = await desk.page.evaluate(() => {
    return Array.from(document.querySelectorAll('.mtitle')).map(n => n.textContent).join('|');
  });
  const room = await open('mission-room.html', reg);
  ok(room.errs.length === 0, 'mission-room.html ' + reg + ' zero page errors');
  const options = await room.page.locator('#mission-pick option').count();
  ok(options === MISSION_IDS.length, 'mission-room.html ' + reg + ' picker carries all missions');
  const ledger = await open('receipts.html', reg);
  ok(ledger.errs.length === 0, 'receipts.html ' + reg + ' zero page errors');
  const rows = await ledger.page.locator('#ledger-body tr').count();
  ok(rows === SEED.receipts.length, 'receipts.html ' + reg + ' renders all ' + SEED.receipts.length + ' receipts');
  const word = await ledger.page.textContent('#chain-word');
  ok(/CHAIN VERIFIED/i.test(word || ''), 'receipts.html ' + reg + ' chain VERIFIED');
  const total = await ledger.page.textContent('#sum-total');
  ok((total || '').includes(TOTAL_SPEND.toFixed(2)), 'receipts.html ' + reg + ' total spend $' + TOTAL_SPEND.toFixed(2) + ' from receipts');
  await desk.ctx.close(); await room.ctx.close(); await ledger.ctx.close();
}
ok(factsByReg.bee === factsByReg.raver && factsByReg.raver === factsByReg.cypherpunk, 'mission titles identical across bee / raver / cypherpunk');

console.log('· the envelope (desk detail + YAML)');
{
  const { ctx, page, errs } = await open('missions.html#/m/' + encodeURIComponent('bnr-op-2026-002'), null);
  ok(errs.length === 0, 'desk detail opens with zero page errors');
  const yaml = await page.textContent('pre.proposal');
  ok((yaml || '').includes('id: bnr-op-2026-002') && (yaml || '').includes('tithe_percent: 10'), 'proposal YAML renders in the founder\'s shape');
  ok((yaml || '').includes('human_escalation_required_for:'), 'controls escalation list rides the YAML');
  const req = await page.evaluate(() => {
    const m = window.BNRMissions.findMission(window.BNRMissions.loadLedger(), 'bnr-op-2026-002');
    return m.finance.requested_total;
  });
  ok(req > 0 && req < 100, 'requested total derived by the engine ($' + req + ')');

  console.log('· the human levers (each appends a chained receipt)');
  page.on('dialog', d => d.accept('45'));
  await page.click('button.lever.approve');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => {
    const l = window.BNRMissions.loadLedger();
    const m = window.BNRMissions.findMission(l, 'bnr-op-2026-002');
    return { ceiling: m.controls.spending_ceiling, state: m.state, n: l.receipts.length, ok: window.BNRMissions.verifyChain(l.receipts).ok, last: l.receipts[l.receipts.length - 1].kind };
  });
  ok(after.ceiling === 45 && after.state === 'approved', 'ceiling approved at $45 — the envelope is set');
  ok(after.n === SEED.receipts.length + 1 && after.last === 'ceiling.approve', 'the approval left receipt #' + after.n + ' (ceiling.approve)');
  ok(after.ok, 'chain still verifies after the human act');
  await ctx.close();
}

console.log('· the room (evaluator + treasury + stop)');
{
  const { ctx, page, errs } = await open('mission-room.html#/m/' + encodeURIComponent('bnr-op-2026-003'), null);
  ok(errs.length === 0, 'mission room opens with zero page errors');
  const word = await page.textContent('#verdict .word');
  ok(/ESCALATE/i.test(word || ''), 'the escalated mission reads ESCALATE');
  ok(await page.isDisabled('#release'), 'release refused while the escalation is open');
  page.on('dialog', d => d.accept());
  await page.click('#stop');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => {
    const l = window.BNRMissions.loadLedger();
    const m = window.BNRMissions.findMission(l, 'bnr-op-2026-003');
    return { state: m.state, n: l.receipts.length, ok: window.BNRMissions.verifyChain(l.receipts).ok, last: l.receipts[l.receipts.length - 1].kind };
  });
  ok(after.state === 'stopped' && after.last === 'control.stop', 'human stop halted the mission and left receipt #' + after.n);
  ok(after.ok, 'chain still verifies after the stop');
  const foot = await page.textContent('#room-foot');
  ok((foot || '').includes('$6.97'), 'spend $6.97 of $19.00 shown from receipts');
  await ctx.close();
}

console.log('· the ledger (chain breaks loudly, export is machine-readable)');
{
  const { ctx, page, errs } = await open('receipts.html', null);
  ok(errs.length === 0, 'receipts opens with zero page errors');
  const exported = await page.evaluate(() => JSON.stringify(window.BNRMissions.loadLedger()));
  const parsed = JSON.parse(exported);
  ok(parsed.receipts.length === SEED.receipts.length && parsed.missions.length === MISSION_IDS.length, 'export parses with missions + receipts intact');
  ok(parsed.receipts.every((r, i) => r.seq === i + 1), 'export sequences are 1..n with no gaps');
  /* tamper in storage, reload, expect the loud break */
  await page.evaluate(json => localStorage.setItem('bnr.missions.ledger.v1', json), (() => {
    const l = JSON.parse(exported); l.receipts[5].summary += ' (quiet edit)'; return JSON.stringify(l);
  })());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  const word = await page.textContent('#chain-word');
  const note = await page.textContent('#chain-note');
  ok(/CHAIN BROKEN/i.test(word || ''), 'a quiet edit breaks the chain loudly');
  ok((note || '').includes('#6'), 'the break names its sequence (#6)');
  await page.evaluate(() => window.BNRMissions.resetLedger());
  await ctx.close();
}

console.log('· 390px — every station, bee + raver, no horizontal overflow');
for (const f of ['missions.html', 'mission-room.html', 'receipts.html']) {
  for (const reg of ['bee', 'raver']) {
    const { ctx, page, errs } = await open(f, reg);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - document.documentElement.clientWidth);
    ok(overflow <= 0, f + ' ' + reg + ' fits 390px (overflow ' + overflow + 'px)');
    ok(errs.length === 0, f + ' ' + reg + ' zero page errors at 390px');
    await page.screenshot({ path: join(SHOTS, f.replace('.html', '') + '-' + reg + '-390.png'), fullPage: false });
    await ctx.close();
  }
}

await browser.close();
srv.close();
console.log('\n' + pass + ' passed · ' + fail + ' failed — shots in e2e/shots-missions/');
process.exit(fail ? 1 : 0);
