import fs from 'node:fs/promises';
import path from 'node:path';
import {analyzeTrials} from './analyze.mjs';
const [directory, prefix] = process.argv.slice(2);
if (!directory || !/^[a-zA-Z0-9-]{1,20}$/.test(prefix??'')) throw Error('Usage: diagnose.mjs receipts/ prefix');
const sum = values => values.reduce((a,b)=>a+b,0);
const trials = [];
for (const repeat of [1,2,3]) for (const load of [1,4]) for (const fault of ['steady','churn'])
  for (const arm of ['baseline','shadow']) {
    const file = `${prefix}-r${repeat}-${arm}-${load}-${fault}`;
    trials.push({repeat,load,fault,arm,
      receipt:JSON.parse(await fs.readFile(path.join(directory,file+'.json'),'utf8')),
      sandbox:await fs.readFile(path.join(directory,file+'.sandbox.log'),'utf8')});
  }
const comparison = analyzeTrials(trials);
const pairs = comparison.pairs.map(pair => {
  if (!pair.comparable) return {...pair, attribution:'unqualified pair retained; not timed'};
  const arms = {};
  for (const arm of ['baseline','shadow']) {
    const t = trials.find(t=>t.repeat===pair.repeat&&t.load===pair.load&&t.fault===pair.fault&&t.arm===arm);
    const phases = t.receipt.phases.filter(p=>!(pair.fault==='churn'&&p.phase===1));
    const batch = sum(phases.map(p=>p.elapsed_ms));
    const sdk = sum(phases.map(p=>Math.max(...p.records.map(r=>r.timing.sdk_ms))));
    arms[arm] = {
      batch_ms:batch, slowest_sdk_read_per_phase_sum_ms:sdk,
      batch_minus_slowest_sdk_ms:batch-sdk,
      summed_observer_ms:sum(phases.flatMap(p=>p.records.map(r=>r.timing.observation_ms))),
      received_datachannel_bytes:t.receipt.finalTransport.received_datachannel_bytes,
      connection_instances_created:t.receipt.finalTransport.created,
      sandbox_cpu_seconds:Number(t.sandbox.match(/CPU time consumed:\s*([\d.]+)s/)?.[1]??NaN),
    };
  }
  return {repeat:pair.repeat,load:pair.load,fault:pair.fault,comparable:true,arms,
    batch_delta_ms:arms.shadow.batch_ms-arms.baseline.batch_ms,
    slowest_sdk_delta_ms:arms.shadow.slowest_sdk_read_per_phase_sum_ms-arms.baseline.slowest_sdk_read_per_phase_sum_ms,
    outside_slowest_sdk_delta_ms:arms.shadow.batch_minus_slowest_sdk_ms-arms.baseline.batch_minus_slowest_sdk_ms};
});
const valid = pairs.filter(p=>p.comparable);
console.log(JSON.stringify({schema:'bnrose.ant-webrtc.diagnosis.v1',
  interpretation:'SDK duration includes authenticated network discovery and reads plus scheduling; residual includes launch skew, verification, observation and other JS. This locates measured time, not a causal attribution of WAN variance.',
  comparable_pairs:valid.length,
  batch_delta_sum_ms:sum(valid.map(p=>p.batch_delta_ms)),
  slowest_sdk_delta_sum_ms:sum(valid.map(p=>p.slowest_sdk_delta_ms)),
  outside_slowest_sdk_delta_sum_ms:sum(valid.map(p=>p.outside_slowest_sdk_delta_ms)),
  observer:comparison.observer, pairs},null,2));
