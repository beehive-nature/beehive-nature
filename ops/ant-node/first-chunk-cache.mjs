#!/usr/bin/env node
/**
 * ANT public /stream first-chunk disk cache (relay seat).
 *
 * Between Caddy and antd. Warm HIT for
 *   /(ant/)?v1/data/public/<64-hex>/stream
 * serves the first ANT_FIRST_CHUNK_BYTES (default 2 MiB) from local disk
 * immediately, then splices the remainder from upstream. Cold MISS proxies
 * through and tees the prefix to disk. Never invents stream bytes —
 * disk holds a copy of antd octets only.
 *
 * x0x stays OFF this path (may coordinate elsewhere; must not substitute
 * the stream body with a fake).
 *
 * Env:
 *   ANT_LISTEN              default 172.18.0.1:8084
 *   ANT_UPSTREAM            default http://172.18.0.1:8082
 *   ANT_FIRST_CHUNK_DIR     default /var/cache/ant-first-chunk
 *   ANT_FIRST_CHUNK_BYTES   default 2097152
 *   ANT_ALLOWED_ORIGIN      default https://skaists.dev
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

function cfg() {
  return {
    listen: process.env.ANT_LISTEN || '172.18.0.1:8084',
    upstream: process.env.ANT_UPSTREAM || 'http://172.18.0.1:8082',
    cacheDir: process.env.ANT_FIRST_CHUNK_DIR || '/var/cache/ant-first-chunk',
    chunkBytes: Number(process.env.ANT_FIRST_CHUNK_BYTES || 2 * 1024 * 1024),
    allowedOrigin: process.env.ANT_ALLOWED_ORIGIN || 'https://skaists.dev',
  };
}

const STREAM_RE =
  /^\/(?:ant\/)?v1\/data\/public\/([0-9a-fA-F]{64})\/stream\/?$/;

const inflight = new Set();

export function parseListen(spec) {
  const i = spec.lastIndexOf(':');
  if (i < 0) return { host: spec, port: 8084 };
  return { host: spec.slice(0, i), port: Number(spec.slice(i + 1)) };
}

export function streamXor(urlPath) {
  const m = STREAM_RE.exec(urlPath);
  return m ? m[1].toLowerCase() : null;
}

export function parseRange(header, size) {
  if (!header || !header.startsWith('bytes=')) return null;
  const spec = header.slice(6).trim();
  if (spec.includes(',')) return null;
  const [a, b] = spec.split('-', 2);
  let start;
  let end;
  if (a === '') {
    const n = Number(b);
    if (!Number.isFinite(n) || n <= 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === '' || b === undefined ? size - 1 : Number(b);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
    return null;
  }
  if (start >= size) return { unsatisfiable: true };
  end = Math.min(end, size - 1);
  return { start, end };
}

function cachePaths(xor) {
  const dir = cfg().cacheDir;
  return {
    bin: path.join(dir, `${xor}.bin`),
    meta: path.join(dir, `${xor}.meta.json`),
    tmp: path.join(dir, `${xor}.bin.tmp`),
  };
}

async function readMeta(xor) {
  const { bin, meta } = cachePaths(xor);
  try {
    const [raw, st] = await Promise.all([fsp.readFile(meta, 'utf8'), fsp.stat(bin)]);
    const j = JSON.parse(raw);
    if (!j) return null;
    if (j.contentLength != null && typeof j.contentLength !== 'number') return null;
    if (st.size <= 0) return null;
    return { ...j, cachedBytes: st.size, bin };
  } catch {
    return null;
  }
}

function corsHeaders(req, extra = {}) {
  const out = { ...extra };
  if (req.headers.origin === cfg().allowedOrigin) {
    out['access-control-allow-origin'] = cfg().allowedOrigin;
    out.vary = 'origin';
  }
  return out;
}

function upstreamRequest(reqPath, method, headers) {
  const u = new URL(reqPath, cfg().upstream);
  const lib = u.protocol === 'https:' ? https : http;
  const hop = { ...headers };
  delete hop.host;
  delete hop.connection;
  delete hop['proxy-connection'];
  delete hop['content-length'];
  delete hop.range;
  return lib.request({
    protocol: u.protocol,
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + u.search,
    method,
    headers: hop,
    timeout: 600_000,
  });
}

async function ensureCacheDir() {
  await fsp.mkdir(cfg().cacheDir, { recursive: true });
}

function teeFirstChunk(upstream, xor, contentLength, contentType) {
  const { bin, meta, tmp } = cachePaths(xor);
  const limit = cfg().chunkBytes;
  let written = 0;
  let done = false;
  let file = null;
  const shouldCache = !inflight.has(xor);
  if (shouldCache) inflight.add(xor);
  if (shouldCache) {
    try {
      file = fs.createWriteStream(tmp);
    } catch (e) {
      console.error('cache open failed', e);
      inflight.delete(xor);
      return upstream;
    }
  }

  const out = new Readable({ read() {} });

  const finish = async (ok) => {
    if (done) return;
    done = true;
    if (file) {
      try {
        file.end();
      } catch {
        /* ignore */
      }
    }
    try {
      if (shouldCache && ok && written > 0 && file) {
        await fsp.rename(tmp, bin);
        await fsp.writeFile(
          meta,
          JSON.stringify({
            xor,
            contentLength: contentLength ?? null,
            contentType: contentType || 'application/octet-stream',
            cachedBytes: written,
            cachedAt: new Date().toISOString(),
            chunkLimit: limit,
          }),
          'utf8',
        );
      } else if (shouldCache && file) {
        try {
          await fsp.unlink(tmp);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error('cache commit failed', e);
      try {
        await fsp.unlink(tmp);
      } catch {
        /* ignore */
      }
    } finally {
      if (shouldCache) inflight.delete(xor);
    }
  };

  upstream.on('data', (chunk) => {
    out.push(chunk);
    if (file && written < limit) {
      const slice = chunk.subarray(0, Math.min(chunk.length, limit - written));
      if (slice.length) {
        written += slice.length;
        try {
          file.write(slice);
        } catch {
          /* ignore */
        }
      }
      if (written >= limit) finish(true);
    }
  });
  upstream.on('end', () => {
    out.push(null);
    finish(written > 0);
  });
  upstream.on('error', (err) => {
    out.destroy(err);
    finish(false);
  });
  return out;
}


async function serveWarm(req, res, xor, meta) {
  const total = meta.contentLength;
  const cached = meta.cachedBytes;
  const range = parseRange(req.headers.range, total ?? cached);

  if (range?.unsatisfiable) {
    res.writeHead(
      416,
      corsHeaders(req, {
        'content-range': `bytes */${total ?? cached}`,
        'accept-ranges': 'bytes',
        'x-ant-first-chunk': 'HIT',
      }),
    );
    res.end();
    return;
  }

  if (range && range.end < cached) {
    const len = range.end - range.start + 1;
    res.writeHead(
      206,
      corsHeaders(req, {
        'content-type': meta.contentType || 'application/octet-stream',
        'content-length': String(len),
        'content-range': `bytes ${range.start}-${range.end}/${total ?? '*'}`,
        'accept-ranges': 'bytes',
        'x-ant-first-chunk': 'HIT',
        'cache-control': 'public, max-age=60',
      }),
    );
    fs.createReadStream(meta.bin, { start: range.start, end: range.end }).pipe(res);
    return;
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : total != null ? total - 1 : null;

  if (range) {
    res.writeHead(
      206,
      corsHeaders(req, {
        'content-type': meta.contentType || 'application/octet-stream',
        'content-length': String(end - start + 1),
        'content-range': `bytes ${start}-${end}/${total ?? '*'}`,
        'accept-ranges': 'bytes',
        'x-ant-first-chunk': 'HIT',
      }),
    );
  } else {
    const headers = corsHeaders(req, {
      'content-type': meta.contentType || 'application/octet-stream',
      'accept-ranges': 'bytes',
      'x-ant-first-chunk': 'HIT',
      'cache-control': 'public, max-age=60',
    });
    if (total != null) headers['content-length'] = String(total);
    res.writeHead(200, headers);
  }

  const diskStart = start;
  const diskEnd = Math.min(cached - 1, end ?? cached - 1);
  if (diskStart <= diskEnd) {
    await pipeline(fs.createReadStream(meta.bin, { start: diskStart, end: diskEnd }), res, {
      end: false,
    });
  }

  const needFrom = Math.max(cached, start);
  if ((end != null && needFrom > end) || (total != null && needFrom >= total)) {
    res.end();
    return;
  }

  await new Promise((resolve, reject) => {
    const ureq = upstreamRequest(req.url, 'GET', req.headers);
    ureq.on('response', (ures) => {
      if (ures.statusCode && ures.statusCode >= 400) {
        ures.resume();
        if (!res.writableEnded) res.end();
        resolve();
        return;
      }
      let skipped = 0;
      let sent = 0;
      const maxSend = end != null ? end - needFrom + 1 : Infinity;
      ures.on('data', (chunk) => {
        if (skipped < needFrom) {
          const remain = needFrom - skipped;
          if (chunk.length <= remain) {
            skipped += chunk.length;
            return;
          }
          chunk = chunk.subarray(remain);
          skipped = needFrom;
        }
        if (sent >= maxSend) return;
        const slice = chunk.subarray(0, Math.min(chunk.length, maxSend - sent));
        sent += slice.length;
        if (!res.write(slice)) ures.pause();
      });
      res.on('drain', () => ures.resume());
      ures.on('end', () => {
        res.end();
        resolve();
      });
      ures.on('error', reject);
    });
    ureq.on('error', reject);
    ureq.end();
  });
}

async function serveMiss(req, res, xor) {
  await new Promise((resolve, reject) => {
    const ureq = upstreamRequest(req.url, req.method, req.headers);
    ureq.on('response', (ures) => {
      const headers = { ...ures.headers };
      delete headers['transfer-encoding'];
      headers['accept-ranges'] = 'bytes';
      headers['x-ant-first-chunk'] = 'MISS';
      if (req.headers.origin === cfg().allowedOrigin) {
        headers['access-control-allow-origin'] = cfg().allowedOrigin;
      }
      const cl = headers['content-length'] ? Number(headers['content-length']) : null;
      const ct = headers['content-type'] || 'application/octet-stream';
      res.writeHead(ures.statusCode || 502, headers);

      if (ures.statusCode === 200 && req.method === 'GET') {
        const teed = teeFirstChunk(ures, xor, cl, ct);
        teed.pipe(res);
        teed.on('end', resolve);
        teed.on('error', reject);
      } else {
        ures.pipe(res);
        ures.on('end', resolve);
        ures.on('error', reject);
      }
    });
    ureq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, corsHeaders(req, { 'x-ant-first-chunk': 'UPSTREAM-ERR' }));
        res.end('upstream error');
      }
      reject(err);
    });
    ureq.end();
  });
}

async function proxyBypass(req, res) {
  await new Promise((resolve, reject) => {
    const ureq = upstreamRequest(req.url, req.method, req.headers);
    ureq.on('response', (ures) => {
      const headers = { ...ures.headers };
      headers['x-ant-first-chunk'] = 'BYPASS';
      res.writeHead(ures.statusCode || 502, headers);
      ures.pipe(res);
      ures.on('end', resolve);
      ures.on('error', reject);
    });
    ureq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'x-ant-first-chunk': 'UPSTREAM-ERR' });
        res.end('upstream error');
      }
      reject(err);
    });
    if (req.method === 'GET' || req.method === 'HEAD') ureq.end();
    else req.pipe(ureq);
  });
}

export async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    const xor = streamXor((req.url || '').split('?')[0]);
    if (xor) {
      res.writeHead(
        204,
        corsHeaders(req, {
          'access-control-allow-methods': 'GET, HEAD, OPTIONS',
          'access-control-allow-headers':
            req.headers['access-control-request-headers'] || 'range',
          'access-control-max-age': '600',
        }),
      );
      res.end();
      return;
    }
  }

  const urlPath = (req.url || '/').split('?')[0];
  const xor = streamXor(urlPath);

  if (!xor || (req.method !== 'GET' && req.method !== 'HEAD')) {
    await proxyBypass(req, res);
    return;
  }

  const meta = await readMeta(xor);
  if (meta && meta.cachedBytes > 0) {
    if (req.method === 'HEAD') {
      res.writeHead(
        200,
        corsHeaders(req, {
          'content-type': meta.contentType || 'application/octet-stream',
          'content-length': String(meta.contentLength ?? meta.cachedBytes),
          'accept-ranges': 'bytes',
          'x-ant-first-chunk': 'HIT',
        }),
      );
      res.end();
      return;
    }
    await serveWarm(req, res, xor, meta);
    return;
  }

  if (req.method === 'HEAD') {
    await proxyBypass(req, res);
    return;
  }
  await serveMiss(req, res, xor);
}

export function createServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      if (err && err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
      console.error('handler error', err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('cache error');
      } else {
        try {
          res.destroy(err);
        } catch {
          /* ignore */
        }
      }
    });
  });
}

async function main() {
  await ensureCacheDir();
  const { host, port } = parseListen(cfg().listen);
  const server = createServer();
  server.listen(port, host, () => {
    console.log(
      JSON.stringify({
        msg: 'ant-first-chunk-cache listening',
        listen: `${host}:${port}`,
        upstream: cfg().upstream,
        cacheDir: cfg().cacheDir,
        chunkBytes: cfg().chunkBytes,
      }),
    );
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
