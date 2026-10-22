import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const median = xs => [...xs].sort((a,b) => a-b)[Math.floor(xs.length/2)];
const rows = [];
for (const arm of ['before','after']) {
  for (let run=2; run<=6; run++) {
    const file = `nixos-${arm}-${run}.json`;
    const data = JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
    assert.equal(data.debug_assertions,false);
    assert.equal(data.wire_bytes,7415);
    assert.equal(data.observer_bytes,136);
    assert.equal(data.network_bytes_sent,0);
    assert.equal(data.pairs.length,32);
    for (const label of ['baseline','shadow']) {
      const ns = data.pairs.flatMap(pair => {
        assert.equal(pair[`${label}_ns`].length,64);
        return pair[`${label}_ns`];
      }).sort((a,b)=>a-b);
      assert.equal(data[label].count,ns.length);
      assert.equal(data[label].p50_ns,ns[ns.length/2]);
      assert.equal(data[label].p95_ns,ns[Math.floor(ns.length*.95)]);
      assert.equal(data[label].p99_ns,ns[Math.floor(ns.length*.99)]);
      assert.equal(data[label].mean_ns,ns.reduce((a,b)=>a+b,0)/ns.length);
    }
    rows.push({arm,run,file,baseline:data.baseline,shadow:data.shadow,
      extra_p50_ns:data.shadow.p50_ns-data.baseline.p50_ns,
      p50_overhead_percent:100*(data.shadow.p50_ns/data.baseline.p50_ns-1),
      mean_overhead_percent:100*(data.shadow.mean_ns/data.baseline.mean_ns-1),
      scaling:data.scaling});
  }
}
const groups = Object.fromEntries(['before','after'].map(arm=>{
  const rs=rows.filter(r=>r.arm===arm);
  const costs=rs.map(r=>r.p50_overhead_percent);
  return [arm,{runs:rs.length,median_p50_overhead_percent:median(costs),
    p50_overhead_range_percent:[Math.min(...costs),Math.max(...costs)],
    median_extra_p50_ns:median(rs.map(r=>r.extra_p50_ns)),
    median_mean_overhead_percent:median(rs.map(r=>r.mean_overhead_percent))}];
}));
const result={schema:'x0x.bnrose-shadow.nixos-comparison.v1',groups,rows,
  relative_reduction_in_median_p50_overhead_percent:
    100*(1-groups.after.median_p50_overhead_percent/groups.before.median_p50_overhead_percent),
  limitations:['Offline signed announcement verification, not mesh throughput.',
    'Shared KVM host; no CPU affinity or dedicated hardware.',
    'Independent ephemeral signing fixtures each process; identical wires within each baseline/shadow pair.',
    'Linux release artifacts built on WSL; executed on NixOS using pinned Nix runtime libraries.',
    'Five interleaved old/new runs; preflight runs are retained separately, not substituted into this cohort.']};
fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(groups,null,2));
