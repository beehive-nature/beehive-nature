// Local, opt-in telemetry after the unchanged SDK read and independent hash check.
// No signing, wallet, dispatch, network calls, replay watermark or DAO authority.
import {createObservationRequest} from './observation-request.mjs';
const enc = new TextEncoder();
const MAX_BYTES = 2 * 1024 * 1024;
const hex = bytes => Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
const digest = async bytes => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
const abort = signal => { if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError'); };

async function kernelObserver(module, address) {
  if (!(module instanceof WebAssembly.Module) || WebAssembly.Module.imports(module).length)
    throw new Error('An import-free locally selected kernel is required');
  const {exports: e} = await WebAssembly.instantiate(module, {});
  if (e.bnrose_abi_version() !== 1) throw new Error('Unsupported kernel ABI');
  const req = e.bnrose_req_arena(), out = e.bnrose_verdict_arena();
  const size = e.memory.buffer.byteLength;
  if (req + 8192 > size || out + 128 > size ||
      !(req + 8192 <= out || out + 128 <= req)) throw new Error('Invalid kernel arenas');
  const authority = crypto.getRandomValues(new Uint8Array(32)); // ephemeral local run label, not a key
  const action = await digest(enc.encode('ant/observe-verified-content/v1'));
  const encodeRequest = createObservationRequest(address, authority, action);
  let sequence = 0;
  return hash => {
    if (sequence === Number.MAX_SAFE_INTEGER) throw new Error('Observation sequence exhausted');
    const clock = Math.floor(Date.now() / 1000);
    const request = encodeRequest(clock, ++sequence, hash);
    if (request.length > 8192) throw new Error('Observation request exceeds arena');
    // No await between arena write and call: concurrent reads cannot interleave ABI access.
    new Uint8Array(e.memory.buffer, req, request.length).set(request);
    const n = e.bnrose_admit(req, request.length, out, 128);
    if (n !== 97 || new Uint8Array(e.memory.buffer, out, 1)[0] !== 1)
      return {status: 'refused'};
    return {status: 'observed', sequence};
  };
}

export async function createVerifiedDownloader(client, fixture, {enabled = false, module} = {}) {
  // Snapshot receiver-selected policy before asynchronous work or caller mutation.
  const selected = Object.freeze({address: fixture.address, sha256: fixture.sha256, size: fixture.size});
  if (!/^[a-f0-9]{64}$/.test(selected.address) || !/^[a-f0-9]{64}$/.test(selected.sha256) ||
      !Number.isSafeInteger(selected.size) || selected.size < 1 || selected.size > MAX_BYTES)
    throw new TypeError('A bounded, hash-pinned public fixture is required');
  const observe = enabled ? await kernelObserver(module, selected.address) : null;
  return Object.freeze({
    async download({signal, concurrency = 1} = {}) {
      abort(signal);
      const start = performance.now();
      // SDK authentication, content addressing and decryption are never replaced.
      const result = await client.download(selected.address, {signal, concurrency});
      abort(signal);
      const sdkEnd = performance.now();
      if (!(result.bytes instanceof Uint8Array) || result.bytes.byteLength !== selected.size)
        throw new Error('Verified-read size mismatch');
      const contentHash = await digest(result.bytes);
      abort(signal);
      if (hex(contentHash) !== selected.sha256) throw new Error('Verified-read hash mismatch');
      const verified = performance.now();
      let observation = {status: 'disabled'};
      // A diagnostic refusal/failure cannot revoke valid content or authorize an effect.
      if (observe) {
        try { observation = observe(contentHash); }
        catch { observation = {status: 'error'}; }
      }
      return {result, observation, timing: {sdk_ms: sdkEnd-start,
        verification_ms: verified-sdkEnd, observation_ms: performance.now()-verified,
        total_ms: performance.now()-start}};
    },
  });
}
