import {installTransportProbe} from './transport-probe.mjs';
import {createVerifiedDownloader} from './verified-observer.mjs';
const probe = installTransportProbe();
const {AutonomiClient} = await import('/vendor/ant-browser-sdk/0.1.2/index.js');
const fixtures = await (await fetch(new URL('./fixture.json', import.meta.url))).json();
const module = await WebAssembly.compile(await (await fetch(new URL('./kernel.wasm', import.meta.url))).arrayBuffer());

globalThis.runTrial = async ({shadow, concurrency, churn}) => {
  if (![1,4].includes(concurrency) || typeof shadow !== 'boolean' || typeof churn !== 'boolean')
    throw new Error('Unsupported bounded trial');
  const result = {schema:'bnrose.ant-webrtc.v1', shadow, concurrency, churn,
    fixtures:fixtures.map(({id,size})=>({id,size})), phases:[], lifecycle:[],
    verification:'unchanged ANT SDK plus independent expected SHA256',
    churnModel:'local client association withdrawal with pending reads; remote storage peers untouched'};
  let client;
  const connect = async () => {
    const start=performance.now();
    client=await AutonomiClient.connect({signal:AbortSignal.timeout(45000)});
    result.lifecycle.push({event:'connected',elapsed_ms:performance.now()-start});
  };
  try {
    await connect();
    for(let phase=0;phase<3;phase++) {
      if(phase===2&&churn) await connect();
      const preparing=performance.now();
      const reader=await createVerifiedDownloader(client,fixtures[phase],{enabled:shadow,module});
      const preparation_ms=performance.now()-preparing;
      const before=probe.snapshot(), started=performance.now();
      let pending=0;
      const operations=Array.from({length:concurrency},(_,id)=>{
        pending++;
        return reader.download({signal:AbortSignal.timeout(30000),concurrency:1})
          .then(r=>({id,ok:true,bytes:r.result.bytes.byteLength,
            observation:r.observation,timing:r.timing}))
          .catch(error=>({id,ok:false,error:error.code??error.name??'Error'}))
          .finally(()=>pending--);
      });
      if(phase===1&&churn) {
        // Wait for traffic while work remains pending, up to a fixed two seconds.
        // The phase uses a new file, so a hot file cache cannot satisfy this gate.
        const deadline=performance.now()+2000;
        while(pending>0 && probe.snapshot().sent_datachannel_bytes===before.sent_datachannel_bytes &&
              performance.now()<deadline) await new Promise(resolve=>setTimeout(resolve,10));
        // SDK close aborts only this locally owned client's operations. No remote mutation.
        const active=probe.snapshot();
        client.close();
        const closed=probe.closeOwned();
        result.lifecycle.push({event:'client_withdrawal',pending_reads:pending,
          sent_since_phase_start:active.sent_datachannel_bytes-before.sent_datachannel_bytes,
          active_before:active.connected,extra_closed_by_probe:closed,
          after:probe.snapshot()});
      }
      const records=await Promise.all(operations);
      result.phases.push({phase,fixture:fixtures[phase].id,preparation_ms,elapsed_ms:performance.now()-started,before,
        after:probe.snapshot(),paths:await probe.selectedPaths(),records});
    }
  } catch(error) {
    result.error={code:error.code??error.name??'Error'};
  } finally {
    client?.close();
    probe.closeOwned();
    result.finalTransport=probe.snapshot();
  }
  return result;
};
