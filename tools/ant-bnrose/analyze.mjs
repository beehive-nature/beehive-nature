import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const sum = values => values.reduce((a,b)=>a+b,0);
const median = values => {
  if(!values.length) return null;
  const a=[...values].sort((a,b)=>a-b), middle=Math.floor(a.length/2);
  return a.length%2?a[middle]:(a[middle-1]+a[middle])/2;
};
const percentile = (values,q) => values.length
  ? [...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(q*values.length)-1)] : null;
const sizeByPhase=[138931,183550,321035];
const direct = p => !p.paths.some(s=>s.localType==='relay'||s.remoteType==='relay') &&
  p.paths.some(s=>s.state==='succeeded'&&s.protocol==='udp'&&
  ['host','srflx','prflx'].includes(s.localType)&&
  ['host','srflx','prflx'].includes(s.remoteType)&&s.dtlsState==='connected');
const withdrawal = r => {
  const w=r.lifecycle?.find(l=>l.event==='client_withdrawal');
  return Boolean(w&&w.pending_reads>0&&w.sent_since_phase_start>0&&w.active_before>0);
};

export function analyzeTrials(trials) {
  assert.equal(trials.length,24,'Require all 24 fixed-matrix receipts, including failures');
  const unique=new Set(), records=[], normalPhases=[], interventions=[], recovery=[];
  const paths=[], observerTimes=[], preparationTimes=[];
  const summary={schema:'bnrose.ant-webrtc.comparison.v1',trials:24,complete_trials:0,
    successful_reads:0,expected_withdrawal_cancellations:0,unexpected_read_failures:0,
    incomplete_trials:[],logical_verified_bytes:0,received_datachannel_bytes:0,
    observations:{observed:0,disabled:0,refused:0,error:0},pairs:[],groups:[]};
  for(const t of trials) {
    assert.ok([1,2,3].includes(t.repeat));
    assert.ok([1,4].includes(t.load));
    assert.ok(['steady','churn'].includes(t.fault));
    assert.ok(['baseline','shadow'].includes(t.arm));
    const key=[t.repeat,t.load,t.fault,t.arm].join('/');
    assert.ok(!unique.has(key),'Duplicate matrix cell'); unique.add(key);
    const r=t.receipt;
    if(r.schema!=='bnrose.ant-webrtc.v1') {summary.incomplete_trials.push(key);continue;}
    assert.equal(r.shadow,t.arm==='shadow');
    assert.equal(r.concurrency,t.load); assert.equal(r.churn,t.fault==='churn');
    assert.ok(r.phases.length<=3);
    const seenPhases=new Set();
    for(const p of r.phases) {
      assert.ok([0,1,2].includes(p.phase));assert.ok(!seenPhases.has(p.phase));
      seenPhases.add(p.phase); assert.equal(p.records.length,t.load);
      assert.ok(Number.isFinite(p.elapsed_ms)&&p.elapsed_ms>=0);
      const withdrawn=r.churn&&p.phase===1;
      const rx=p.after.received_datachannel_bytes-p.before.received_datachannel_bytes;
      assert.ok(rx>=0);
      if(!withdrawn) normalPhases.push({key,phase:p.phase,rx,
        allVerified:p.records.every(r=>r.ok),
        direct:direct(p)});
      paths.push(...p.paths);
      if(r.shadow) preparationTimes.push(p.preparation_ms);
      for(const record of p.records) {
        records.push(record);
        if(record.ok) {
          assert.equal(record.bytes,sizeByPhase[p.phase],'Unexpected verified length');
          assert.ok(Object.hasOwn(summary.observations,record.observation.status));
          for(const timing of Object.values(record.timing))
            assert.ok(Number.isFinite(timing)&&timing>=0);
          summary.successful_reads++;
          summary.logical_verified_bytes+=record.bytes;
          summary.observations[record.observation.status]++;
          if(r.shadow) observerTimes.push(record.timing.observation_ms);
        } else if(withdrawn&&[20,'AbortError'].includes(record.error))
          summary.expected_withdrawal_cancellations++;
        else summary.unexpected_read_failures++;
      }
    }
    const complete=!r.error&&seenPhases.size===3;
    if(complete) summary.complete_trials++; else summary.incomplete_trials.push(key);
    summary.received_datachannel_bytes+=r.finalTransport?.received_datachannel_bytes??0;
    if(r.churn) {
      interventions.push(withdrawal(r));
      const phase=r.phases.find(p=>p.phase===2);
      const connects=r.lifecycle.filter(l=>l.event==='connected');
      recovery.push(Boolean(phase&&phase.records.every(r=>r.ok)&&
        phase.after.received_datachannel_bytes>phase.before.received_datachannel_bytes&&connects.length===2));
    }
  }
  summary.attempted_reads=records.length;
  summary.normal_phases={expected:60,observed:normalPhases.length,
    all_verified_with_received_bytes_and_direct_path:
      normalPhases.filter(p=>p.allVerified&&p.rx>0&&p.direct).length,
    without_received_bytes:normalPhases.filter(p=>p.rx===0).length};
  summary.churn={expected:12,observed:interventions.length,
    active_with_pending_reads_and_sent_bytes:interventions.filter(Boolean).length,
    full_verified_network_recovery:recovery.filter(Boolean).length};
  summary.paths={observations:paths.length,relay_observations:
    paths.filter(p=>p.localType==='relay'||p.remoteType==='relay').length,
    dtls_ciphers:[...new Set(paths.map(p=>p.dtlsCipher).filter(Boolean))]};
  summary.observer={samples:observerTimes.length,
    median_ms:median(observerTimes),p95_ms:percentile(observerTimes,.95),
    max_ms:observerTimes.length?Math.max(...observerTimes):null,
    total_ms:sum(observerTimes),preparation_median_ms:median(preparationTimes)};
  for(const load of [1,4]) for(const fault of ['steady','churn']) {
    const pairs=[];
    for(const repeat of [1,2,3]) {
      const pair={repeat,load,fault,comparable:true};
      for(const arm of ['baseline','shadow']) {
        const r=trials.find(t=>t.repeat===repeat&&t.load===load&&t.fault===fault&&t.arm===arm).receipt;
        const normal=r.phases?.filter(p=>!(fault==='churn'&&p.phase===1))??[];
        const expected=fault==='churn'?2:3;
        const allOK=!r.error&&normal.length===expected&&(fault!=='churn'||withdrawal(r))&&normal.every(p=>
          p.records.every(x=>x.ok&&x.observation.status===(arm==='shadow'?'observed':'disabled'))&&
          p.after.received_datachannel_bytes>p.before.received_datachannel_bytes&&direct(p));
        pair.comparable&&=allOK;
        pair[arm]={normal_read_batch_ms:allOK?sum(normal.map(p=>p.elapsed_ms)):null,
          connect_ms:sum((r.lifecycle??[]).filter(l=>l.event==='connected').map(l=>l.elapsed_ms))};
      }
      pair.delta_percent=pair.comparable
        ?(pair.shadow.normal_read_batch_ms/pair.baseline.normal_read_batch_ms-1)*100:null;
      pairs.push(pair);summary.pairs.push(pair);
    }
    const valid=pairs.filter(p=>p.comparable);
    summary.groups.push({load,fault,comparable_pairs:valid.length,
      baseline_median_read_batch_ms:median(valid.map(p=>p.baseline.normal_read_batch_ms)),
      shadow_median_read_batch_ms:median(valid.map(p=>p.shadow.normal_read_batch_ms)),
      median_paired_delta_percent:median(valid.map(p=>p.delta_percent)),
      paired_deltas_percent:valid.map(p=>p.delta_percent)});
  }
  return summary;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const [directory,prefix]=process.argv.slice(2);
  if(!directory||!/^[a-zA-Z0-9-]{1,20}$/.test(prefix??'')) throw Error('Usage: analyze.mjs receipts/ prefix');
  const trials=[];
  for(const repeat of [1,2,3]) for(const load of [1,4]) for(const fault of ['steady','churn'])
    for(const arm of ['baseline','shadow']) {
      const name=`${prefix}-r${repeat}-${arm}-${load}-${fault}.json`;
      trials.push({repeat,load,fault,arm,receipt:JSON.parse(await fs.readFile(path.join(directory,name),'utf8'))});
    }
  process.stdout.write(JSON.stringify(analyzeTrials(trials),null,2)+'\n');
}
