// One ANT object: header, embedded playlists/index, then media ranges.
// No HTTP media fallback, wallet access, chain call or telemetry upload.
export const SCHEMA = 'bnr.ant-hls/1';
export const MAGIC = new TextEncoder().encode('BNRANTHLS001');
export const HEADER_BYTES = 16;
export const LIMITS = Object.freeze({ manifestBytes: 512 * 1024, files: 4096,
  objectBytes: 4 * 1024 * 1024, packBytes: 1_000_000_000, sessionBytes: 512 * 1024 * 1024,
  requests: 4096, concurrency: 3, cacheBytes: 24 * 1024 * 1024, timeoutMs: 90000 });
const HEX = /^[a-f0-9]{64}$/;
const PATH = /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/;
const abortError = () => new DOMException('Cancelled', 'AbortError');
export function parseAntHls(raw) {
  return /^ant-hls:\/\/([a-f0-9]{64})$/i.exec(String(raw).trim())?.[1].toLowerCase() || null;
}
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function headerLength(bytes) {
  if (bytes.length !== HEADER_BYTES || !MAGIC.every((v, i) => bytes[i] === v)) throw Error('Invalid ANT video pack header');
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(12, true);
  if (length < 2 || length > LIMITS.manifestBytes) throw Error('Invalid manifest size');
  return length;
}
export function validateManifest(m, payloadBytes) {
  if (!m || m.schema !== SCHEMA || !HEX.test(m.bundleId) || !HEX.test(m.sourceAddress) ||
      !Array.isArray(m.files) || !m.files.length || m.files.length > LIMITS.files) throw Error('Invalid adaptive manifest');
  const files = new Map(); let end = 0;
  for (const f of m.files) {
    if (!f || !PATH.test(f.path) || files.has(f.path) || !HEX.test(f.sha256) ||
        !Number.isSafeInteger(f.bytes) || f.bytes < 1 || f.bytes > LIMITS.objectBytes) throw Error('Invalid adaptive asset');
    if (f.path.endsWith('.m3u8')) {
      if (typeof f.text !== 'string' || new TextEncoder().encode(f.text).length !== f.bytes || !f.text.startsWith('#EXTM3U')) throw Error('Invalid playlist');
    } else {
      if (f.text !== undefined || !/\.(mp4|m4s)$/.test(f.path) || f.offset !== end) throw Error('Invalid media range');
      end += f.bytes;
    }
    files.set(f.path, Object.freeze({ ...f }));
  }
  if (end !== payloadBytes || !files.get('master.m3u8')?.text) throw Error('Invalid pack extent or missing master');
  // Closed finite VOD subset: unsupported URI-bearing tags cannot escape the pack.
  for (const f of files.values()) if (f.text) {
    if (f.path !== 'master.m3u8' && !f.text.includes('#EXT-X-ENDLIST')) throw Error('Only finite VOD is supported');
    for (const line of f.text.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
      if (line.startsWith('#') && !/^#(?:EXTM3U|EXTINF:[0-9.,]+|EXT-X-(?:VERSION:\d+|TARGETDURATION:\d+|MEDIA-SEQUENCE:\d+|PLAYLIST-TYPE:VOD|INDEPENDENT-SEGMENTS|ENDLIST|STREAM-INF:[A-Za-z0-9=.," -]+|MAP:URI="[a-zA-Z0-9_./-]+"))$/.test(line)) throw Error('Unsupported playlist feature');
      const refs = line.startsWith('#') ? [...line.matchAll(/URI="([^"]+)"/g)].map(x => x[1]) : [line];
      for (const ref of refs) {
        const path = f.path.slice(0, f.path.lastIndexOf('/') + 1) + ref;
        if (!PATH.test(ref) || !files.has(path)) throw Error('Playlist reference outside publication');
        const target = files.get(path);
        if (f.path === 'master.m3u8' ? !target.text || path === f.path : target.text) throw Error('Playlist nesting refused');
      }
    }
  }
  return files;
}

export async function createAntSession({ address, client, signal, limits = {}, onReceipt = () => {} }) {
  if (!HEX.test(address)) throw Error('Invalid pack address');
  const bound = { ...LIMITS, ...limits };
  for (const key of Object.keys(LIMITS)) if (!Number.isSafeInteger(bound[key]) || bound[key] < 1 || bound[key] > LIMITS[key]) throw Error('Invalid delivery limit');
  const stop = new AbortController(), queue = [], cache = new Map();
  let reader, active = 0, cacheBytes = 0;
  const stats = { schema: 'bnr.delivery-measurement/1', source: 'autonomi', opens: 0, requests: 0,
    reservedBytes: 0, verifiedBytes: 0, readBytes: 0, cacheBytes: 0, cacheHits: 0, rejected: 0, peakConcurrent: 0,
    boundary: 'plaintext returned by SDK; partial/aborted reads, SDK wire traffic and payment costs unmeasured', paid: false };
  const publishStats = () => { stats.cacheBytes = cacheBytes; onReceipt({ ...stats }); };
  const cancel = () => {
    stop.abort();
    try { reader?.close(); } catch {}
    while (queue.length) queue.shift().reject(abortError());
    cache.clear(); cacheBytes = 0;
  };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  async function slot(localSignal) {
    if (stop.signal.aborted || localSignal?.aborted) throw abortError();
    if (active < bound.concurrency) { active++; return; }
    await new Promise((resolve, reject) => {
      const item = {}; queue.push(item);
      const abort = () => { const i = queue.indexOf(item); if (i >= 0) { queue.splice(i, 1); item.reject(abortError()); } };
      item.resolve = () => { localSignal?.removeEventListener('abort', abort); resolve(); };
      item.reject = e => { localSignal?.removeEventListener('abort', abort); reject(e); };
      localSignal?.addEventListener('abort', abort, { once: true });
    });
  }
  function release() { if (queue.length) queue.shift().resolve(); else active--; }
  async function bounded(fn, localSignal) {
    const controller = new AbortController(), abort = () => controller.abort();
    stop.signal.addEventListener('abort', abort, { once: true });
    localSignal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, bound.timeoutMs);
    try {
      if (stop.signal.aborted || localSignal?.aborted) throw abortError();
      // SDK abort races WASM; close on failure rather than retry over unobserved work.
      const result = await fn(controller.signal);
      if (controller.signal.aborted) throw abortError();
      return result;
    } catch (e) { stats.rejected++; cancel(); throw e; }
    finally { clearTimeout(timer); stop.signal.removeEventListener('abort', abort); localSignal?.removeEventListener('abort', abort); }
  }
  async function read(start, size, expected, localSignal) {
    await slot(localSignal);
    try {
      if (stop.signal.aborted || localSignal?.aborted) throw abortError();
      if (stats.requests >= bound.requests || stats.reservedBytes + size > bound.sessionBytes) throw Error('Read budget exhausted');
      // Never refund uncertain/aborted reservations; caps bound all admitted reads.
      stats.requests++; stats.reservedBytes += size;
      stats.peakConcurrent = Math.max(stats.peakConcurrent, active);
      return await bounded(async readSignal => {
        const bytes = new Uint8Array(await reader.read(start, size, { signal: readSignal }));
        stats.readBytes += bytes.byteLength;
        if (bytes.length !== size || (expected && await digest(bytes) !== expected.sha256)) throw Error('Media integrity mismatch');
        if (expected) stats.verifiedBytes += bytes.length;
        return bytes;
      }); // Active reads keep their slot until completion; caller abort only suppresses delivery.
    } finally { release(); publishStats(); }
  }
  let manifest, files, payloadStart;
  try {
    stats.opens++;
    await bounded(async openSignal => { reader = await client.openFile(address, { signal: openSignal }); });
    if (!Number.isSafeInteger(reader.size) || reader.size < HEADER_BYTES + 2 || reader.size > bound.packBytes) throw Error('Pack size refused');
    const length = headerLength(await read(0, HEADER_BYTES));
    if (length > bound.manifestBytes || length + HEADER_BYTES > reader.size) throw Error('Manifest size refused');
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await read(HEADER_BYTES, length)));
    payloadStart = HEADER_BYTES + length;
    files = validateManifest(manifest, reader.size - payloadStart);
    if (files.size > bound.files) throw Error('Manifest asset budget exhausted');
    for (const f of files.values()) {
      if (f.bytes > bound.objectBytes) throw Error('Media range budget exhausted');
      if (f.text && await digest(new TextEncoder().encode(f.text)) !== f.sha256) throw Error('Playlist integrity mismatch');
    }
  } catch (e) { cancel(); signal?.removeEventListener('abort', cancel); throw e; }
  const origin = 'https://ant-hls.invalid/' + address + '/';
  async function load(url, localSignal) {
    if (stop.signal.aborted || localSignal?.aborted) throw abortError();
    if (!url.startsWith(origin)) throw Error('Cross-publication request refused');
    const f = files.get(url.slice(origin.length));
    if (!f) throw Error('Unlisted asset refused');
    if (f.text) return new TextEncoder().encode(f.text);
    if (cache.has(f.path)) {
      const bytes = cache.get(f.path); cache.delete(f.path); cache.set(f.path, bytes);
      stats.cacheHits++; publishStats(); return bytes.slice();
    }
    const bytes = await read(payloadStart + f.offset, f.bytes, f, localSignal);
    if (!stop.signal.aborted && !localSignal?.aborted && bytes.length <= bound.cacheBytes && !cache.has(f.path)) {
      while (cacheBytes + bytes.length > bound.cacheBytes && cache.size) {
        const key = cache.keys().next().value; cacheBytes -= cache.get(key).length; cache.delete(key);
      }
      cache.set(f.path, bytes.slice()); cacheBytes += bytes.length;
    }
    publishStats(); return bytes;
  }
  class Loader {
    constructor() {
      this.stats = { aborted: false, loaded: 0, total: 0, retry: 0, chunkCount: 0, bwEstimate: 0,
        loading: { start: 0, first: 0, end: 0 }, parsing: { start: 0, end: 0 }, buffering: { start: 0, first: 0, end: 0 } };
    }
    load(context, config, callbacks) {
      this.context = context; this.controller = new AbortController(); this.stats.loading.start = performance.now();
      load(context.url, this.controller.signal).then(bytes => {
        if (this.stats.aborted) return;
        this.stats.loaded = this.stats.total = bytes.length; this.stats.chunkCount = 1;
        this.stats.loading.end = performance.now();
        // SDK returns a whole range, without an observable HTTP-style first byte.
        // Charge all waiting time to ABR throughput; otherwise hls.js subtracts
        // the entire transfer as TTFB and estimates a nearly instantaneous link.
        this.stats.loading.first = this.stats.loading.start;
        callbacks.onSuccess({ url: context.url, data: context.responseType === 'arraybuffer' ? bytes.buffer : new TextDecoder().decode(bytes) }, this.stats, context, null);
      }).catch(error => { if (!this.stats.aborted) callbacks.onError({ code: 0, text: error.message }, context, null, this.stats); });
    }
    abort() { this.stats.aborted = true; this.controller?.abort(); }
    destroy() { this.abort(); }
    getCacheAge() { return null; }
    getResponseHeader() { return null; }
  }
  return { manifest, Loader, load, url: origin + 'master.m3u8', stats,
    close() { cancel(); signal?.removeEventListener('abort', cancel); publishStats(); } };
}
