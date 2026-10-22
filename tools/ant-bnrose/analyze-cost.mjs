import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const median = values => {
  const sorted = [...values].sort((a,b)=>a-b), i = Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[i] : (sorted[i-1]+sorted[i])/2;
};
const sum = values => values.reduce((a,b)=>a+b,0);
const trials = [];
for (const filename of process.argv.slice(2)) {
  const r = JSON.parse(await fs.readFile(filename, 'utf8'));
  assert.equal(r.schema, 'bnrose.ant-observer-cost.v1');
  assert.equal(r.blocks.length, 90);
  const arms = {};
  for (const arm of ['baseline','before','after']) {
    assert.equal(r.completed[arm], 7600);
    const blocks = r.blocks.filter(b=>b.arm===arm);
    assert.equal(blocks.length, 30);
    assert.equal(new Set(blocks.map(b=>b.repeat)).size, 30);
    assert.ok(blocks.every(b=>b.count===250&&b.elapsed_ms>0&&b.observation_ms>=0));
    arms[arm] = {
      measured_reads:7500,
      batch_mean_per_read_median_ms:median(blocks.map(b=>b.elapsed_ms/b.count)),
      observer_mean_per_read_median_ms:median(blocks.map(b=>b.observation_ms/b.count)),
      total_elapsed_ms:sum(blocks.map(b=>b.elapsed_ms)),
      total_observation_ms:sum(blocks.map(b=>b.observation_ms)),
    };
  }
  trials.push({filename, observedAt:r.observedAt, browser:r.browser, arms,
    paired_block_median_elapsed_change_pct:median(Array.from({length:30},(_,repeat)=>{
      const get=arm=>r.blocks.find(b=>b.repeat===repeat&&b.arm===arm).elapsed_ms;
      return 100*(get('after')/get('before')-1);
    })),
    observer_total_change_pct:100*(arms.after.total_observation_ms/arms.before.total_observation_ms-1),
  });
}
assert.ok(trials.length>0, 'Supply all local component receipts, including failures');
console.log(JSON.stringify({schema:'bnrose.ant-observer-cost-comparison.v1',
  scope:'same-browser local verified bytes and actual WASM admission; no network delivery claim',
  trials},null,2));
