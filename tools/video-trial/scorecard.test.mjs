import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { compare, report } from './scorecard.mjs';
const input = JSON.parse(readFileSync(new URL('./shu-2026-10-07.json', import.meta.url)));
test('poster gain does not erase long-clip stall regression or invent warm results', () => {
  const { rows } = report(input);
  assert.ok(Math.abs(rows[0].changePercent + 43.269230769) < 0.00001);
  assert.ok(Math.abs(rows[12].changePercent - 30.39647577) < 0.00001);
  assert.equal(rows[13].direction, 'unknown');
  assert.equal(rows[13].changePercent, null);
});
test('zero baseline is not an infinite percentage or a missing value', () => {
  const row = input.rows[8];
  assert.equal(compare([row])[0].direction, 'unchanged');
  assert.equal(compare([{ ...row, trialSeconds: 2 }])[0].changePercent, null);
  assert.equal(compare([{ ...row, trialSeconds: 2 }])[0].deltaSeconds, 2);
});
test('bad inputs and misleading provenance fail closed', () => {
  for (const value of [-1, '5', undefined, Infinity]) {
    assert.throws(() => compare([{ ...input.rows[0], trialSeconds: value }]));
  }
  assert.throws(() => compare([]));
  assert.throws(() => compare([input.rows[0], input.rows[0]]));
  assert.throws(() => report({ ...input, evidence: 'measured' }));
});
test('capture preserves unknowns, distinguishes cache, bounds samples and excludes sensitive fields', () => {
  let tick, cleared = false;
  const context = { window: { __bviewEngine: () => ({ path: 'cache', source: {kind:'cache'},
    bytes: 12, ttffMs: null, door: 'SECRET', sha: 'SECRET', direct: null,
    video: { paused: false, ended: true } }) },
    document: { hidden: false }, performance: { now: () => 10 },
    setInterval: f => { tick = f; return 1; }, clearInterval: () => { cleared = true; } };
  runInNewContext(readFileSync(new URL('./capture.js', import.meta.url), 'utf8'), context);
  context.window.bviewTrial.mark('play');
  assert.throws(() => context.window.bviewTrial.mark('SECRET'));
  for (let i = 0; i < 7198; i++) tick();
  const text = context.window.bviewTrial.export(), result = JSON.parse(text);
  assert.equal(result.rows.length, 7200);
  assert.equal(result.stopped, true);
  assert.equal(cleared, true);
  assert.equal(result.rows[0].source, 'cache');
  assert.equal(result.rows[0].ttffMs, null);
  assert.equal(text.includes('SECRET'), false);
});
