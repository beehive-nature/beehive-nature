import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutCommit, jobTiming, seconds, summarizeRuns } from '../scripts/ci-run-receipt.mjs';

const sha = 'a'.repeat(40);
const log = `2026-10-19T00:00:00Z [command]/usr/bin/git log -1 --format=%H\n2026-10-19T00:00:00Z ${sha}\n`;

test('source binding reads the actual full checkout SHA from checkout output', () => {
  assert.equal(checkoutCommit(log), sha);
  assert.equal(checkoutCommit(log.replaceAll('\n', '\r\n')), sha);
});
test('missing, abbreviated and ambiguous checkout evidence is refused', () => {
  assert.throws(() => checkoutCommit(`HEAD is now at ${sha.slice(0, 8)}`));
  assert.throws(() => checkoutCommit(log.replace(sha, sha.slice(0, 8))));
  assert.throws(() => checkoutCommit(log + log));
});
test('missing or backwards timestamps stay unknown instead of zero duration', () => {
  assert.equal(seconds(null, null), null);
  assert.equal(seconds('2026-10-19T00:01:00Z', '2026-10-19T00:00:00Z'), null);
  assert.equal(seconds('2026-10-19T00:00:00Z', '2026-10-19T00:01:00Z'), 60);
});
test('empty, queued, failed, cancelled and skipped workflows are never successful qualification', () => {
  assert.equal(summarizeRuns([]).all_recorded_runs_successful, false);
  for (const [status, conclusion] of [['queued', null], ['in_progress', null], ['completed', 'failure'], ['completed', 'cancelled'], ['completed', 'skipped']]) {
    assert.equal(summarizeRuns([{ id: 1, status, conclusion, jobs: [] }]).all_recorded_runs_successful, false);
  }
});
test('queued API placeholder timestamps and cancellation before start are not execution', () => {
  const created = '2026-10-19T00:00:00Z';
  for (const status of ['queued', 'completed']) {
    assert.deepEqual(jobTiming({ status, conclusion: 'cancelled', started_at: created, completed_at: created, steps: [] }, created), {
      execution_started: false, dispatch_to_start_seconds: null, execution_seconds: null,
    });
  }
  const active = jobTiming({ status: 'in_progress', started_at: '2026-10-19T00:01:00Z',
    steps: [{ status: 'in_progress', started_at: '2026-10-19T00:01:00Z', conclusion: null }],
  }, created);
  assert.deepEqual(active, { execution_started: true, dispatch_to_start_seconds: 60, execution_seconds: null });
});
test('success, source binding and timing completeness are separate observations', () => {
  const summary = summarizeRuns([{ id: 1, status: 'completed', conclusion: 'success', jobs: [
    { id: 10, status: 'completed', conclusion: 'success', execution_started: true, execution_seconds: 3, checkout: { commit: sha, tree: sha } },
    { id: 11, status: 'completed', conclusion: 'success', execution_started: true, execution_seconds: null },
    { id: 12, status: 'completed', conclusion: 'skipped', execution_seconds: 0 },
    { id: 13, status: 'completed', conclusion: 'cancelled', execution_started: false, execution_seconds: null },
  ] }]);
  assert.equal(summary.all_recorded_runs_successful, true);
  assert.equal(summary.executed_jobs, 2);
  assert.equal(summary.jobs_with_checkout_binding, 1);
  assert.equal(summary.completed_job_execution_seconds, 3);
  assert.deepEqual(summary.timing_missing_job_ids, [11]);
  assert.deepEqual(summary.completed_jobs_without_start_evidence, [13]);
});
