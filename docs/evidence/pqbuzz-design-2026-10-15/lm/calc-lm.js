// lawful-minimal design arithmetic. Every input is an assumption unless cited in the design.
const b64u = n => Math.ceil(n*4/3); // base64url, no padding
const DSA=1952, SIG=3309, SUCC=32, XW_CT=1120, W=48;
const BECH_ID = 4+1+Math.ceil(256/5)+6; // bzpq + '1' + data + checksum
// SPEC-BPQ-1 5b statement as JSON
const att = `{"bpq":1,"kind":"nostr-event","id":"${'x'.repeat(BECH_ID)}","event":"${'x'.repeat(64)}","dsa":"${'x'.repeat(b64u(DSA))}","succ":"${'x'.repeat(b64u(SUCC))}","sig":"${'x'.repeat(b64u(SIG))}"}`;
const escaped = JSON.stringify(att).length; // as a Nostr content string
const nostrOverhead = (contentLen, tagsJson) => JSON.stringify({id:'x'.repeat(64),pubkey:'x'.repeat(64),created_at:1760000000,kind:47101,tags:JSON.parse(tagsJson),content:'x'.repeat(contentLen),sig:'x'.repeat(128)}).length;
const ATT_EV = nostrOverhead(att.length+ (escaped-att.length-2), '[["e","'+'x'.repeat(64)+'"]]');
console.log({BECH_ID, attJson:att.length, attEscaped:escaped, ATT_EV});
const cpTags = '[["v","1"],["prev","'+'x'.repeat(64)+'"],["n","1024"],["range","1760000000","1760086400"]]';
const CP_FIXED = nostrOverhead(0, cpTags);
console.log({CP_FIXED});
for (const n of [1,3,10,64,100,1024]) {
  const cp = CP_FIXED + b64u(32*n);
  const per = (ATT_EV + cp)/n;
  console.log(`n=${n}: checkpoint=${cp} B, attest=${ATT_EV} B, per-event PQ overhead=${per.toFixed(1)} B, vs per-event attest ${ATT_EV} B => ${(ATT_EV/per).toFixed(1)}x`);
}
// a 200-byte kind-9 channel message
const MSG = nostrOverhead(200, '[["h","'+'x'.repeat(36)+'"]]');
console.log({MSG});
// frame limit check: max n under 65,536 B incl ["EVENT",...] wrapper
let nmax=0; for(let n=1;n<5000;n++){ if (CP_FIXED + b64u(32*n) + 12 <= 65536) nmax=n; } console.log({nmax_under_64KiB:nmax});
// workload model
const N=1e10, DAY=86400, YR=365.25;
for (const [M, CPD] of [[1,1],[10,3],[100,3]]) {
  const nPer = M/CPD;
  const pqDay = CPD*(ATT_EV + CP_FIXED) + M*b64u(32);
  const msgDay = M*MSG;
  const perMsgAttDay = M*ATT_EV;
  console.log(`M=${M} cp/day=${CPD} n~${nPer.toFixed(2)}: msgs ${msgDay} B/day, PQ(cp) ${pqDay} B/day (+${(100*pqDay/msgDay).toFixed(0)}%), PQ(per-msg) ${perMsgAttDay} B/day (+${(100*perMsgAttDay/msgDay).toFixed(0)}%)`);
  const sentTBday = N*(msgDay+pqDay)/1e12;
  console.log(`   global sent (msgs+cp) ${sentTBday.toFixed(1)} TB/day = ${(N*(msgDay+pqDay)*8/DAY/1e9).toFixed(1)} Gbps avg; per-msg-attest variant ${(N*(msgDay+perMsgAttDay)/1e12).toFixed(1)} TB/day`);
  console.log(`   ML-DSA verifies if every one of k=6 recipient devices verifies every checkpoint: ${(N*CPD*6/DAY).toExponential(3)}/s global, ${(CPD*6/2).toFixed(1)} per device per day (D=2); per-msg variant ${(M*6/2).toFixed(1)} per device per day`);
  const ownYr = (msgDay+pqDay)*YR, rcvYr = M*3*MSG*YR; // 3 recipients per msg on avg => each user receives 3M msgs/day
  const tot = ownYr+rcvYr;
  console.log(`   archive per user-yr: own ${(ownYr/1e6).toFixed(2)} MB + received ${(rcvYr/1e6).toFixed(2)} MB = ${(tot/1e6).toFixed(2)} MB; ANT chunks (yearly file) ${Math.max(3,Math.ceil(tot/4190208))}, (monthly files) ${12*Math.max(3,Math.ceil(tot/12/4190208))}; AR at $32.56/GiB = $${(tot/2**30*32.56).toFixed(3)}`);
}
// private lane sizes: bpq1 sealed object without SEAL vs with SEAL
const SLOT = JSON.stringify({to:'x-wing',ct:'x'.repeat(b64u(XW_CT)),w:'x'.repeat(b64u(W))}).length+1;
const SELF = JSON.stringify({to:'self',w:'x'.repeat(b64u(W))}).length+1;
const CORE = JSON.stringify({bpq:1,aead:'aes-256-gcm',seg:65536,len:400,oid:'x'.repeat(b64u(16)),kc:'x'.repeat(b64u(32)),rosetta:'x'.repeat(40)}).length;
const SEALJ = JSON.stringify({alg:'ml-dsa-65',pk:'x'.repeat(b64u(DSA)),sig:'x'.repeat(b64u(SIG)),id:'x'.repeat(BECH_ID),succ:'x'.repeat(b64u(SUCC))}).length + 16;
for (const r of [1,2,4,8,32]) {
  const keys = 2 + r*SLOT + SELF;
  const body = 400+16; // bChat v2 envelope ~400 B JSON incl 200 B text
  const obj = 8 + 4*4 + CORE + keys + body;
  const wire = nostrOverhead(b64u(obj), '[["p","'+'x'.repeat(64)+'"]]');
  console.log(`pq-private r=${r} recipient devices: sealed ${obj} B (+SEAL ${SEALJ} B), as kind-1059 content ${wire} B; with SEAL ${nostrOverhead(b64u(obj+SEALJ),'[["p","'+'x'.repeat(64)+'"]]')} B`);
}
console.log({SLOT, SELF, CORE, SEALJ});
// connection model
console.log('boxes @100k conns, 2e10 device conns:', 2e10/1e5, '; at 10% concurrently connected:', 2e9/1e5);
// relay communities at 10K humans each
console.log('communities @10K humans:', N/1e4);
