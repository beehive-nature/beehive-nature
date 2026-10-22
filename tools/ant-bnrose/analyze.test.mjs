import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTrials} from './analyze.mjs';

// Synthetic controls for receipt interpretation; never performance evidence.
function matrix() {
  const trials=[];
  for(const repeat of [1,2,3]) for(const load of [1,4])
    for(const fault of ['steady','churn']) for(const arm of ['baseline','shadow']) {
      const churn=fault==='churn',shadow=arm==='shadow';
      const phases=[0,1,2].map(phase=>({phase,elapsed_ms:shadow?110:100,preparation_ms:1,
        before:{received_datachannel_bytes:0},after:{received_datachannel_bytes:1000},
        paths:[{state:'succeeded',protocol:'udp',localType:'host',remoteType:'host',dtlsState:'connected'}],
        records:Array.from({length:load},()=>churn&&phase===1?{ok:false,error:20}:{
          ok:true,bytes:[138931,183550,321035][phase],observation:{status:shadow?'observed':'disabled'},
          timing:{sdk_ms:99,verification_ms:1,observation_ms:shadow?10:0,total_ms:shadow?110:100}})}));
      const lifecycle=[{event:'connected',elapsed_ms:10}];
      if(churn) lifecycle.push({event:'client_withdrawal',pending_reads:load,sent_since_phase_start:100,
        active_before:1},{event:'connected',elapsed_ms:10});
      trials.push({repeat,load,fault,arm,receipt:{schema:'bnrose.ant-webrtc.v1',shadow,concurrency:load,
        churn,phases,lifecycle,finalTransport:{received_datachannel_bytes:3000}}});
    }
  return trials;
}
test('counts controlled cancellation separately and retains all fixed workload cells',()=>{
  const s=analyzeTrials(matrix());
  assert.equal(s.successful_reads,150);assert.equal(s.expected_withdrawal_cancellations,30);
  assert.equal(s.observations.observed,75);assert.equal(s.churn.full_verified_network_recovery,12);
  assert.ok(s.pairs.every(p=>Math.abs(p.delta_percent-10)<1e-10));
  assert.throws(()=>analyzeTrials(matrix().slice(1)),/all 24/);
});
test('failed reads and launch failures remain visible and disqualify their paired timing',()=>{
  const rows=matrix();rows[0].receipt.phases[0].records[0]={ok:false,error:'TimeoutError'};
  rows[1].receipt={schema:'bnrose.ant-webrtc.launch-failure.v1',error:'controlled test failure'};
  const s=analyzeTrials(rows);
  assert.equal(s.unexpected_read_failures,1);assert.equal(s.incomplete_trials.length,1);
  assert.equal(s.pairs[0].comparable,false);assert.equal(s.pairs[0].delta_percent,null);
});
test('cached phases, relay paths, false churn and refused observers cannot qualify as a comparison',()=>{
  for(const change of [
    r=>r.phases[0].after.received_datachannel_bytes=0,
    r=>r.phases[0].paths[0].remoteType='relay',
    r=>r.phases[0].paths.push({...r.phases[0].paths[0],remoteType:'relay'}),
    r=>r.lifecycle.find(x=>x.event==='client_withdrawal').pending_reads=0,
    r=>r.phases[0].records[0].observation.status='refused',
  ]) {
    const rows=matrix(),row=rows.find(r=>r.repeat===1&&r.load===1&&r.fault==='churn'&&r.arm==='shadow');
    change(row.receipt);
    const s=analyzeTrials(rows),pair=s.pairs.find(p=>p.repeat===1&&p.load===1&&p.fault==='churn');
    assert.equal(pair.comparable,false);assert.equal(pair.delta_percent,null);
  }
});
