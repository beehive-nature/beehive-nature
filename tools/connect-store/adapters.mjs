import { mkdir, open, lstat } from 'node:fs/promises';
import path from 'node:path';
import { hash, hex, exact, requireThat, parse, encode, LIMITS } from './core.mjs';

// A local content-addressed fixture, not an Autonomi implementation. Separate
// instances may recover from the same explicitly retained object directory.
export class DirectoryStore {
  constructor(root) { this.root = path.resolve(root); }
  async put(bytes) {
    requireThat(bytes.length > 0 && bytes.length <= LIMITS.snapshot + 64, 'object-size', 413);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const address = hash(bytes);
    let file;
    try { file = await open(path.join(this.root, address), 'wx', 0o600); }
    catch (err) { if (err.code === 'EEXIST') return address; throw new Error('store-create-failed'); }
    try { await file.writeFile(bytes); await file.sync(); }
    finally { await file.close(); }
    // Parent fsync on Unix covers the file entry; no recursive directory-creation
    // durability claim. Windows power-loss persistence remains unproven.
    if (process.platform !== 'win32') {
      const dir = await open(this.root, 'r');
      try { await dir.sync(); } finally { await dir.close(); }
    }
    return address;
  }
  async get(address, max) {
    requireThat(hex(address) && Number.isSafeInteger(max) && max > 0 && max <= LIMITS.snapshot + 64, 'invalid-object-request');
    let file;
    try {
      const name = path.join(this.root, address);
      const stat = await lstat(name);
      requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size <= max, 'object-size', 413);
      file = await open(name, 'r');
      // Read a bounded buffer even if the file grows after stat.
      const bytes = Buffer.alloc(max + 1);
      let count = 0;
      while (count < bytes.length) {
        const result = await file.read(bytes, count, bytes.length - count, null);
        if (!result.bytesRead) break;
        count += result.bytesRead;
      }
      requireThat(count <= max, 'object-size', 413);
      return bytes.subarray(0, count);
    } catch (err) {
      if (err.code === 'ENOENT') throw Object.assign(new Error('object-missing'), { status: 409 });
      throw err;
    } finally { await file?.close(); }
  }
}

// Explicit endpoint, no discovery, redirects, retries, or daemon startup. The
// cap counts attempted request/response bytes; it is not a router traffic cap.
export class BoundedHttp {
  constructor(base, { token, maxCalls = 32, maxBytes = 32 * 1024 * 1024, timeoutMs = 10000 } = {}) {
    const url = new URL(base);
    requireThat(url.origin === base && !url.username && !url.password &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))), 'unsafe-adapter-endpoint');
    requireThat(Number.isSafeInteger(maxCalls) && maxCalls >= 1 && maxCalls <= 128 && Number.isSafeInteger(maxBytes)
      && maxBytes >= 1 && maxBytes <= 64 * 1024 * 1024 && Number.isSafeInteger(timeoutMs)
      && timeoutMs >= 1 && timeoutMs <= 30000, 'invalid-adapter-budget');
    this.base = base; this.token = token; this.maxCalls = maxCalls; this.remainingBytes = maxBytes;
    this.timeoutMs = timeoutMs; this.usage = { calls: 0, sent: 0, received: 0 };
  }
  async request(method, route, body, max = LIMITS.checkpoint) {
    requireThat(route.startsWith('/') && !route.startsWith('//') && Number.isSafeInteger(max) && max > 0
      && max <= LIMITS.snapshot * 2, 'invalid-adapter-request');
    requireThat(this.usage.calls < this.maxCalls, 'adapter-call-budget', 429);
    const bytes = body === undefined ? undefined : encode(body);
    requireThat((bytes?.length ?? 0) <= this.remainingBytes, 'adapter-byte-budget', 429);
    this.usage.calls++; this.usage.sent += bytes?.length ?? 0; this.remainingBytes -= bytes?.length ?? 0;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.base + route, { method, body: bytes, redirect: 'error', signal: abort.signal,
        headers: { ...(bytes ? { 'content-type': 'application/json' } : {}), ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) } });
      requireThat(response.ok, 'adapter-http-error', 502);
      requireThat(!response.headers.has('content-length') || Number(response.headers.get('content-length')) <= max, 'adapter-response-limit', 413);
      const chunks = []; let size = 0;
      for await (const part of response.body) {
        size += part.length; this.usage.received += part.length; this.remainingBytes -= part.length;
        requireThat(size <= max && this.remainingBytes >= 0, 'adapter-response-limit', 413);
        chunks.push(part);
      }
      return parse(Buffer.concat(chunks), max);
    } catch (err) {
      if (err.code && err.status) throw err;
      throw Object.assign(new Error('adapter-request-failed'), { status: 502 });
    } finally { abort.abort(); clearTimeout(timer); }
  }
}

// antd 0.12.0 REST: GET /v1/data/public/:address -> {data: base64}.
// Source: WithAutonomi/ant-sdk v0.12.0 antd-js/src/rest-client.ts dataGetPublic.
// Writes intentionally unavailable: the auto-paying upload endpoint has no
// atomic operator-specified cost ceiling. Quoting alone is not enforcement.
export class AutonomiReadStore {
  constructor(http) { this.http = http; }
  async put() { throw Object.assign(new Error('autonomi-paid-write-not-enabled'), { status: 503 }); }
  async get(address, max) {
    requireThat(hex(address) && Number.isSafeInteger(max) && max > 0 && max <= LIMITS.snapshot + 64, 'invalid-object-request');
    const result = await this.http.request('GET', `/v1/data/public/${address}`, undefined, Math.ceil(max / 3) * 4 + 1024);
    requireThat(result && typeof result.data === 'string' && result.data.length <= Math.ceil(max / 3) * 4, 'invalid-ant-data');
    const bytes = Buffer.from(result.data, 'base64');
    requireThat(bytes.length <= max && bytes.toString('base64') === result.data, 'invalid-ant-data');
    return bytes;
  }
}

// Only encrypted-archive checkpoint references travel here. SignedPublic x0x
// messages are not a place for channel plaintext or owner keys.
export class X0xNotifications {
  constructor(http, group) { requireThat(hex(group), 'invalid-x0x-group'); this.http = http; this.group = group; }
  async publish(notice) {
    exact(notice, ['type', 'id', 'sequence', 'policy_id', 'ref']);
    exact(notice.ref, ['address', 'sha256', 'size']);
    requireThat(notice.type === 'bnr-channel-checkpoint-v1' && hex(notice.id) && hex(notice.policy_id)
      && hex(notice.ref.address) && hex(notice.ref.sha256) && Number.isSafeInteger(notice.sequence) && notice.sequence > 0
      && Number.isSafeInteger(notice.ref.size) && notice.ref.size > 0 && notice.ref.size <= LIMITS.checkpoint, 'invalid-notice');
    requireThat(encode(notice).length <= LIMITS.checkpoint, 'notice-size', 413);
    const result = await this.http.request('POST', `/groups/${this.group}/send`, { body: JSON.stringify(notice), kind: 'announcement' });
    requireThat(result?.ok === true, 'x0x-not-accepted', 502);
    // x0xd acceptance is not evidence that a remote member received it.
  }
}
