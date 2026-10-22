// Local component isolation, NOT network-delivery or capacity evidence.
// observer-before.mjs must be extracted from the recorded parent Git revision.
import {createVerifiedDownloader as before} from './observer-before.mjs';
import {createVerifiedDownloader as after} from './verified-observer.mjs';
const module = await WebAssembly.compile(await (
  await fetch(new URL('./kernel.wasm', import.meta.url))).arrayBuffer());
const bytes = Uint8Array.from({length:138931}, (_, i) => i % 251);
const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  b => b.toString(16).padStart(2, '0')).join('');
const fixture = {address:'a'.repeat(64), sha256, size:bytes.length};
const client = {download:async () => ({bytes})};

globalThis.runTrial = async () => {
  const readers = {
    baseline:await after(client, fixture),
    before:await before(client, fixture, {enabled:true, module}),
    after:await after(client, fixture, {enabled:true, module}),
  };
  const completed = {baseline:0, before:0, after:0};
  const block = async (arm, count) => {
    let observation_ms = 0, verification_ms = 0;
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const r = await readers[arm].download();
      completed[arm]++;
      if (r.observation.status !== (arm === 'baseline' ? 'disabled' : 'observed') ||
          (arm !== 'baseline' && r.observation.sequence !== completed[arm]))
        throw Error('Missing admission or incorrect sequence');
      observation_ms += r.timing.observation_ms;
      verification_ms += r.timing.verification_ms;
    }
    return {arm, count, elapsed_ms:performance.now()-start, observation_ms, verification_ms};
  };
  for (const arm of Object.keys(readers)) await block(arm, 100);
  const orders = [
    ['baseline','before','after'], ['after','before','baseline'],
    ['before','after','baseline'], ['baseline','after','before'],
    ['after','baseline','before'], ['before','baseline','after'],
  ];
  const blocks = [];
  for (let repeat = 0; repeat < 30; repeat++)
    for (const arm of orders[repeat % orders.length])
      blocks.push({repeat, ...await block(arm, 250)});
  return {schema:'bnrose.ant-observer-cost.v1', workload:'local immutable bytes; full SHA256 and real Rust WASM admission; no network',
    fixture_bytes:bytes.length, warmup_per_arm:100, completed, blocks};
};
