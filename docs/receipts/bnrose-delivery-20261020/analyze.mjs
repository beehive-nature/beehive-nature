import fs from 'node:fs';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
const quantile = (values, p) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const median = v => quantile(v, .5);
const files = fs.readdirSync('.').filter(f => /^r[123]-w(8|64)-(steady|churn)-(baseline|shadow)\.json\.gz$/.test(f)).sort();
assert.equal(files.length, 24, 'complete fixed matrix required');
const rows = files.map(file => {
  const d = JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8'));
  assert.equal(d.schema, 'x0x.bnrose.direct-delivery.v1');
  assert.equal(d.pairs.length, 2);
  const pairs = d.pairs.map(pair => {
    assert.equal(pair.sends.length, 384);
    const sends = new Map(pair.sends.map(s => [s.id, s]));
    assert.equal(sends.size, 384);
    const negative = pair.deliveries.filter(r => r.id === 999999);
    assert.ok(negative.length > 0);
    assert.ok(negative.every(r => !r.accepted && r.verdict === 'Signature'));
    const delivered = new Map();
    let duplicates = 0;
    for (const r of pair.deliveries.filter(r => r.accepted)) {
      assert.ok(sends.has(r.id));
      assert.ok(r.verified_us >= sends.get(r.id).sent_us);
      if (delivered.has(r.id)) duplicates++;
      else delivered.set(r.id, r);
    }
    const phases = [0, 1, 2].map(phase => {
      const sent = pair.sends.filter(s => s.phase === phase);
      assert.equal(sent.length, 128);
      const received = sent.filter(s => delivered.has(s.id));
      const latency = received.map(s => delivered.get(s.id).verified_us - s.sent_us);
      const verification = received.map(s => delivered.get(s.id).verification_ns / 1000);
      const first = Math.min(...sent.map(s => s.sent_us));
      const last = received.length ? Math.max(...received.map(s => delivered.get(s.id).verified_us)) : null;
      return {
        phase, attempted: sent.length, send_ok: sent.filter(s => s.send_ok).length,
        delivered: received.length, missing_ids: sent.filter(s => !delivered.has(s.id)).map(s => s.id),
        p50_us: median(latency), p95_us: quantile(latency, .95), p99_us: quantile(latency, .99),
        verify_p50_us: median(verification),
        burst_goodput_mib_s: last === null ? null : received.length * pair.wire_bytes / (last-first) * 1e6 / 1048576,
      };
    });
    return {pair: pair.pair, churn: pair.churn, duplicates, phases,
      observational_replays: pair.deliveries.filter(r => r.verdict === 'Replay').length,
      lifecycle: pair.lifecycle, measured_us: pair.measured_us};
  });
  return {file, repeat: Number(file[1]), window: d.window, shadow: d.shadow, churn: d.churn, pairs};
});
const comparisons = [];
for (const window of [8,64]) for (const churn of [false,true]) {
  const runMetrics = shadow => rows.filter(r=>r.window===window&&r.churn===churn&&r.shadow===shadow).map(r=>{
    // Middle withdrawal phase is reported as loss, not mixed into active delivery latency.
    const active = r.pairs.flatMap(p=>p.phases.filter(s=>!(p.churn&&s.phase===1)));
    return {
      repeat:r.repeat, attempted:r.pairs.length*384,
      delivered:r.pairs.flatMap(p=>p.phases).reduce((a,p)=>a+p.delivered,0),
      missing_while_online:active.reduce((a,p)=>a+p.missing_ids.length,0),
      phase_p50_median_us:median(active.map(p=>p.p50_us).filter(v=>v!==null)),
      phase_p95_median_us:median(active.map(p=>p.p95_us).filter(v=>v!==null)),
      phase_verify_p50_median_us:median(active.map(p=>p.verify_p50_us).filter(v=>v!==null)),
      phase_burst_goodput_median_mib_s:median(active.map(p=>p.burst_goodput_mib_s).filter(v=>v!==null)),
      reconnect_us:r.pairs[0].lifecycle.find(e=>e.event==='receiver_rejoined')?.connect_us??null,
    };
  });
  const baseline=runMetrics(false), shadow=runMetrics(true);
  comparisons.push({window,churn,baseline,shadow,
    median_baseline_phase_p50_us:median(baseline.map(r=>r.phase_p50_median_us)),
    median_shadow_phase_p50_us:median(shadow.map(r=>r.phase_p50_median_us)),
    median_baseline_burst_goodput_mib_s:median(baseline.map(r=>r.phase_burst_goodput_median_mib_s)),
    median_shadow_burst_goodput_mib_s:median(shadow.map(r=>r.phase_burst_goodput_median_mib_s)),
    paired_phase_p50_changes_percent:baseline.map(b=>{
      const s=shadow.find(s=>s.repeat===b.repeat);
      return (s.phase_p50_median_us/b.phase_p50_median_us-1)*100;
    }),
  });
}
const summary={source_base:'85633f6a6dfea44e62a0cad778aa429275fc4604',
  harness_revision:'42a306546b0e50d3d10f33b26a09a621f400dfad',
  runs:rows.length, attempts:rows.length*768,
  delivered:rows.flatMap(r=>r.pairs).flatMap(p=>p.phases).reduce((a,p)=>a+p.delivered,0),
  online_missing:rows.flatMap(r=>r.pairs).flatMap(p=>p.phases.filter(s=>!(p.churn&&s.phase===1))).reduce((a,p)=>a+p.missing_ids.length,0),
  signature_negative_controls:rows.length*2,comparisons,rows,
  shadow_verified:rows.filter(r=>r.shadow).flatMap(r=>r.pairs).flatMap(p=>p.phases).reduce((a,p)=>a+p.delivered,0),
  shadow_observational_replay:rows.filter(r=>r.shadow).flatMap(r=>r.pairs).reduce((a,p)=>a+p.observational_replays,0),
  actual_duplicates:rows.flatMap(r=>r.pairs).reduce((a,p)=>a+p.duplicates,0),
  limitations:'Same-host isolated direct QUIC signed-announcement bursts, not WebRTC/ANT or Agent DM/gossip/WAN. Three processes per condition. Median phase quantiles are not pooled per-message quantiles. Burst goodput excludes settle intervals and handshake setup. No retransmission. Shared VPS; fixed window order, alternating arm order.'};
fs.writeFileSync('summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({runs:summary.runs,attempts:summary.attempts,delivered:summary.delivered,
  online_missing:summary.online_missing,
  comparisons:comparisons.map(c=>({window:c.window,churn:c.churn,
    baseline_p50_us:c.median_baseline_phase_p50_us,shadow_p50_us:c.median_shadow_phase_p50_us,
    baseline_mib_s:c.median_baseline_burst_goodput_mib_s,shadow_mib_s:c.median_shadow_burst_goodput_mib_s,
    paired_changes:c.paired_phase_p50_changes_percent}))},null,2));
