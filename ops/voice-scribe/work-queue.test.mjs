import test from 'node:test';
import assert from 'node:assert/strict';
import { createSerialQueue, runChild } from './work-queue.mjs';

test('four jobs share one worker, overflow is rejected, failures release capacity', async () => {
  const queue = createSerialQueue(4);
  let active = 0, peak = 0;
  const seen = [];
  const jobs = Array.from({ length: 4 }, (_, i) => queue.run(async () => {
    active++; peak = Math.max(peak, active); seen.push(i);
    try {
      await new Promise(resolve => setTimeout(resolve, 15));
      if (i === 1) throw new Error('spool unavailable');
      return i;
    } finally { active--; }
  }));
  const results = Promise.allSettled(jobs);
  await assert.rejects(queue.run(() => assert.fail('overflow ran')), { statusCode: 503 });
  assert.equal(queue.depth, 4);
  const outcomes = await results;
  assert.equal(peak, 1);
  assert.deepEqual(seen, [0, 1, 2, 3]);
  assert.equal(outcomes[1].status, 'rejected');
  assert.equal(queue.depth, 0);
  assert.equal(await queue.run(() => 9), 9);
});

test('a synchronously failing spool setup releases its slot', async () => {
  const queue = createSerialQueue(1);
  await assert.rejects(queue.run(() => { throw new Error('ENOSPC'); }));
  assert.equal(queue.depth, 0);
  assert.equal(await queue.run(() => 'recovered'), 'recovered');
});

test('hung probes are killed and a later child still runs', async () => {
  await assert.rejects(runChild(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 150 }), /too long/);
  assert.equal(await runChild(process.execPath, ['-e', 'process.stdout.write("1.25")'], { timeoutMs: 2000, capture: true }), '1.25');
});

test('probe output is bounded and tool stderr is not reproduced', async () => {
  await assert.rejects(runChild(process.execPath, ['-e', 'process.stdout.write("a".repeat(10000)); setInterval(() => {}, 1000)'], { timeoutMs: 2000, capture: true }), /too much output/);
  await assert.rejects(runChild(process.execPath, ['-e', 'process.stderr.write("private audio metadata");process.exit(1)'], { timeoutMs: 2000 }), { message: 'the audio processing tool failed' });
});

test('missing executables settle instead of stranding a worker', async () => {
  await assert.rejects(runChild('bnr-deliberately-missing-audio-tool', [], { timeoutMs: 2000 }), { code: 'ENOENT' });
});
