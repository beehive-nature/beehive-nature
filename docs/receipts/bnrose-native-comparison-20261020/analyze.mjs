import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const dir = path.dirname(fileURLToPath(import.meta.url));
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const runs = [];
for (let run = 1; run <= 5; run++) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, `run-${run}.json`)));
  assert.equal(data.schema, 'x0x.bnrose-shadow.offline.v1');
  assert.equal(data.debug_assertions, false);
  assert.equal(data.wire_bytes, 7415);
  assert.equal(data.observer_bytes, 136);
  assert.equal(data.network_bytes_sent, 0);
  assert.equal(data.journal_fsyncs, 0);
  assert.equal(data.pairs.length, 32);
  for (const arm of ['baseline', 'shadow']) {
    const samples = data.pairs.flatMap(pair => {
      assert.equal(pair[`${arm}_ns`].length, 64);
      return pair[`${arm}_ns`];
    }).sort((a, b) => a - b);
    assert.equal(samples.length, data[arm].count);
    assert.equal(samples.length, 2048);
    for (const [name, fraction] of [['p50_ns', .5], ['p95_ns', .95], ['p99_ns', .99]]) {
      assert.equal(samples[Math.floor(samples.length * fraction)], data[arm][name]);
    }
  }
  runs.push({
    run,
    baseline_p50_us: data.baseline.p50_ns / 1000,
    shadow_p50_us: data.shadow.p50_ns / 1000,
    added_p50_us: (data.shadow.p50_ns - data.baseline.p50_ns) / 1000,
    overhead_percent: 100 * (data.shadow.p50_ns / data.baseline.p50_ns - 1),
    baseline_p95_us: data.baseline.p95_ns / 1000,
    shadow_p95_us: data.shadow.p95_ns / 1000,
    scaling: data.scaling,
  });
}
const summary = {
  source: '85633f6a6dfea44e62a0cad778aa429275fc4604',
  observations_per_arm: 10240,
  runs,
  median_run_overhead_percent: median(runs.map(r => r.overhead_percent)),
  overhead_range_percent: [Math.min(...runs.map(r => r.overhead_percent)), Math.max(...runs.map(r => r.overhead_percent))],
  median_run_added_p50_us: median(runs.map(r => r.added_p50_us)),
  medians: Object.fromEntries(['baseline_p50_us', 'shadow_p50_us', 'baseline_p95_us', 'shadow_p95_us'].map(k => [k, median(runs.map(r => r[k]))])),
  scaling: [1, 2, 4].map(observers => {
    const pairs = runs.map(r => {
      const baseline = r.scaling.find(s => s.local_observers === observers && !s.shadow);
      const shadow = r.scaling.find(s => s.local_observers === observers && s.shadow);
      assert.equal(baseline.operations, observers * 1024);
      assert.equal(shadow.operations, baseline.operations);
      return { baseline: baseline.operations_per_sec, shadow: shadow.operations_per_sec };
    });
    return {
      observers,
      baseline_median_ops_per_sec: median(pairs.map(p => p.baseline)),
      shadow_median_ops_per_sec: median(pairs.map(p => p.shadow)),
      median_run_throughput_change_percent: median(pairs.map(p => 100 * (p.shadow / p.baseline - 1))),
    };
  }),
  limitations: 'Shared VPS; five processes, alternating paired latency arms; scaling arms run baseline first. No CPU isolation, language comparison, production throughput or global user capacity proof. Historical WSL-built timing runs are a separate experiment.',
};
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, runs: undefined }, null, 2));
