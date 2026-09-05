// live-door.mjs — THE WATCH-TOGETHER ROOM, box unit (POC 2026-09-04).
//
// One process, three jobs, on the estate's own iron:
//   1. RTMP INLET  — node-media-server listens on 127.0.0.1:1935 ONLY
//      (the laptop dials it through the x0x tailnet forward; the public
//      internet cannot reach it). Publish path: /live/<room>?s=<STREAM_KEY>.
//   2. THE PACKAGER — on publish, ffmpeg is spawned to pull the RTMP stream
//      ONCE and pack TWO renditions (480 ≈800k · 288 ≈350k, 2s segments,
//      12s window, GOP-aligned) into LIVE_DIR/<room>/ as master.m3u8 +
//      480.m3u8 + 288.m3u8 + .ts segments. Caddy serves the segments.
//   3. THE DOOR — HTTP on 127.0.0.1:8094 + 172.18.0.1:8094 (the caddy
//      bridge pattern, cf. buzz-meter-gate). It NEVER WRITES to the meter.
//      It READS the live session receipt (jungle4 `sessions` row, cached
//      4s) and refuses the playlist when the credit is out — pause, not
//      kill. Playlists are REWRITTEN on serve so the session rides every
//      poll (hls.js resolves relative URIs without the base query — the
//      rewrite threads ?session= through variant playlists; segments carry
//      it harmlessly and Caddy ignores it).
//
//        GET  /live/<room>/<name>.m3u8?session=<n>  gate + rewrite + serve
//        GET  /live/session/<n>.json                the row, read-only relay
//        GET  /live/ticker/<room>.json              the streamer's line
//        POST /live/ticker/<room>  (bearer key)     update the line
//        GET  /live/health                          publishing + numbers
//
// Fail-closed: meter RPC unreachable → 503, no playlist. A door that cannot
// read the receipt must not pretend the credit is fine.
//
// unit: buzz-live.service (pattern: buzz-meter-gate.service). env via
// /etc/buzz-watch/live.env — STREAM_KEY, RPC, CONTRACT, LIVE_DIR, ROOM.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve, sep } from 'node:path';

const env = (k, d) => process.env[k] ?? d;
const STREAM_KEY = env('STREAM_KEY', '');
const RPC = env('RPC', 'https://jungle4.greymass.com');
const CONTRACT = env('CONTRACT', 'bnrapolltest');
const LIVE_DIR = resolve(env('LIVE_DIR', '/opt/buzz/deploy/compose/live'));
const PORT = Number(env('PORT', '8094'));
const RTMP_PORT = Number(env('RTMP_PORT', '1935'));
const ROOM_DEFAULT = env('ROOM', 'general');
const SEG_MS = 2000;           // hls_time
const WINDOW_SEGS = 12;        // hls_list_size (24s window: churn gaps must not strand the player)

if (!STREAM_KEY) { console.error('live-door: STREAM_KEY is required (env file)'); process.exit(1); }
mkdirSync(LIVE_DIR, { recursive: true });

/* ── the meter read (READ-ONLY: POST is never built here) ─────────────── */
const sessCache = new Map(); // id -> {t, row|null}
const rateCache = { t: 0, rows: [] };
async function meterRow(id) {
  const hit = sessCache.get(Number(id));
  if (hit && Date.now() - hit.t < 4000) return hit.row;
  const row = await rpcTable('sessions', Number(id));
  sessCache.set(Number(id), { t: Date.now(), row });
  return row;
}
async function rateRows() {
  if (Date.now() - rateCache.t < 30000) return rateCache.rows;
  const rows = await rpcRows('rates');
  rateCache.t = Date.now(); rateCache.rows = rows;
  return rows;
}
async function rpcRows(table) { // the whole table (small: sessions/rates)
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 8000);
  try {
    // plain EOS chain-API shape — no jsonrpc envelope (greymass expects the
    // params object itself as the body; eosjs JsonRpc does the same)
    const body = JSON.stringify({ json: true, code: CONTRACT, scope: CONTRACT, table, limit: 200 });
    const r = await fetch(RPC + '/v1/chain/get_table_rows',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: ctl.signal });
    if (!r.ok) throw new Error('rpc ' + r.status);
    const j = await r.json();
    return j.rows || [];
  } finally { clearTimeout(to); }
}
async function rpcTable(table, id) { // one row by primary key
  const rows = await rpcRows(table);
  return rows.find(row => Number(row.id ?? row.sess ?? row.session) === Number(id)) ?? null;
}

/* credit arithmetic on STRINGS (no float ever touches a quantity) */
function units(s) {
  const m = String(s ?? '').trim().match(/^(\d+)\.(\d+)/);
  if (!m) { const w = String(s ?? '').trim().match(/^(\d+)$/); return w ? BigInt(w[1]) * 10000n : 0n; }
  return BigInt(m[1]) * 10000n + BigInt((m[2] + '0000').slice(0, 4));
}
function fmtA(n) {
  const f = (n % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
  return (n / 10000n).toString() + (f ? '.' + f : '') + ' A';
}

/* ── stream state ─────────────────────────────────────────────────────── */
const streams = new Map(); // room -> {ffmpeg, since, room}
const ROOM_RE = /^[a-z0-9][a-z0-9-]{0,23}$/;
function safeRoom(room) { return ROOM_RE.test(room) ? room : null; }
function roomDir(room) { const r = safeRoom(room); if (!r) return null; return join(LIVE_DIR, r); }

/* ── the packager ─────────────────────────────────────────────────────── */
// SINGLE-WRITER LAW: exactly one ffmpeg may write a room's HLS at any
// moment. Publisher churn + exit-retry timers can otherwise leak a second
// writer whose different sequence counter interleaves playlist rewrites and
// deletes segments the other just listed (players see 404s at the live
// edge). Every spawn reaps ALL known packagers for the room first.
const packagers = new Map(); // room -> Set<ChildProcess>
function killAllPackagers(room) {
  for (const ff of packagers.get(room) ?? []) { try { ff.kill('SIGKILL'); } catch {} }
  packagers.set(room, new Set());
}
function startPackager(room) {
  const dir = roomDir(room); mkdirSync(dir, { recursive: true });
  killAllPackagers(room);
  const args = [
    '-hide_banner', '-loglevel', 'warning',
    '-rw_timeout', '15000000',
    '-i', `rtmp://127.0.0.1:${RTMP_PORT}/live/${room}`,
    '-filter_complex', '[0:v]split=2[v1][v2];[v1]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:-1:-1,setsar=1[v1o];[v2]scale=w=512:h=288:force_original_aspect_ratio=decrease,pad=512:288:-1:-1,setsar=1[v2o]',
    '-map', '[v1o]', '-map', '0:a:0?', '-map', '[v2o]', '-map', '0:a:0?',
    '-c:v:0', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
      '-profile:v:0', 'main', '-b:v:0', '800k', '-maxrate:v:0', '856k', '-bufsize:v:0', '1200k',
    '-c:v:1', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
      '-profile:v:1', 'baseline', '-b:v:1', '350k', '-maxrate:v:1', '380k', '-bufsize:v:1', '560k',
    '-c:a:0', 'aac', '-b:a:0', '96k', '-ar', '44100', '-ac', '2',
    '-c:a:1', 'aac', '-b:a:1', '64k', '-ar', '44100', '-ac', '2',
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    '-f', 'hls',
    '-hls_time', String(SEG_MS / 1000),
    '-hls_list_size', String(WINDOW_SEGS),
    '-hls_delete_threshold', '18',
    '-hls_flags', 'delete_segments+independent_segments+append_list+omit_endlist',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', join(dir, '%v_%06d.ts'),
    '-master_pl_name', 'master.m3u8',
    '-master_pl_publish_rate', '2',
    '-var_stream_map', 'v:0,a:0,name:480 v:1,a:1,name:288',
    '-rw_timeout', '10000000', '-y', join(dir, '%v.m3u8'),
  ];
  const ff = spawn('/usr/bin/ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  packagers.get(room).add(ff);
  let lastLine = '';
  ff.stderr.on('data', (d) => { lastLine = String(d).trim().split('\n').pop(); });
  ff.on('exit', (code) => {
    packagers.get(room)?.delete(ff);
    if (streams.get(room)?.ffmpeg === ff) {
      console.log(`packager[${room}]: exited code=${code} last="${lastLine.slice(0, 140)}"`);
      // the inlet may still be publishing (packager hiccup): retry once after a beat
      const s = streams.get(room);
      if (s && s.retries < 2) { s.retries++; setTimeout(() => {
        if (streams.get(room) === s && !s.ffmpeg.killed) startPackagerInto(s, room); }, 2500); }
      else streams.delete(room);
    }
  });
  const s = streams.get(room);
  if (s) { s.ffmpeg = ff; }
  return ff;
}
function startPackagerInto(s, room) { console.log(`packager[${room}]: respawn`); startPackager(room); }

/* ── the RTMP inlet ───────────────────────────────────────────────────── */
// node-media-server v4: sessions carry .streamPath + .streamQuery; a refused
// publish is session.close(). bind loopback — the ONLY road in is the x0x
// tailnet forward. http/rtmps/record stay unset (v4 skips un-ported servers).
const { default: NodeMediaServer } = await import('node-media-server');
const nms = new NodeMediaServer({
  rtmp: { port: RTMP_PORT },
  bind: '127.0.0.1',
  store: { path: '/opt/buzz-watch/data' },
});
const roomOf = (streamPath) => {
  const m = String(streamPath || '').match(/^\/live\/([a-z0-9-]+)$/);
  return m ? safeRoom(m[1]) : null;
};
// NMS v4 event semantics (read from source): prePublish/postPublish fire on
// EVERY publish attempt (the "already has a publisher" refusal comes AFTER
// both), donePublish fires TWICE per loss (disconnect + grace expiry). So:
// validate on prePublish; (re)spawn the packager on postPublish — kill-any-
// existing-then-spawn keeps exactly ONE packager per room, last publish wins;
// ignore donePublish entirely (the packager exits on its own when the
// publisher is gone and retries at most twice).
nms.on('prePublish', (session) => {
  const room = roomOf(session.streamPath);
  const key = session.streamQuery && typeof session.streamQuery === 'object' ? session.streamQuery.s : null;
  if (!room || key !== STREAM_KEY) {
    console.log(`inlet: REFUSED ${session.streamPath} (bad ${!room ? 'room' : 'key'})`);
    session.close();
  }
});
nms.on('postPublish', (session) => {
  const room = roomOf(session.streamPath);
  const key = session.streamQuery && typeof session.streamQuery === 'object' ? session.streamQuery.s : null;
  if (!room || key !== STREAM_KEY) return; // already closed on prePublish
  const s = streams.get(room);
  if (s?.ffmpeg) { try { s.ffmpeg.kill('SIGTERM'); } catch {} }
  console.log(`inlet: PUBLISH room=${room}`);
  // FRESH ERA LAW: a (re-)publish starts a clean playlist. append_list across
  // publisher gaps accumulates PTS resets without #EXT-X-DISCONTINUITY and
  // the segments stop parsing (hls.js fragParsingError). Wipe and restart.
  killAllPackagers(room);
  const dir = roomDir(room);
  try { for (const f of readdirSync(dir)) if (f.endsWith('.ts') || f.endsWith('.m3u8')) { try { unlinkSync(join(dir, f)); } catch {} } } catch {}
  streams.set(room, { ffmpeg: null, since: Date.now(), room, retries: 0 });
  startPackager(room);
});
await nms.run();

/* ── the door ─────────────────────────────────────────────────────────── */
const handler = async (req, res) => {
  const send = (code, body, type = 'application/json', extra = {}) => {
    res.writeHead(code, { 'content-type': type + '; charset=utf-8', 'cache-control': 'no-store', ...extra });
    // Buffers ride as bytes — JSON.stringify(Buffer) would serve
    // {"type":"Buffer",…} text and starve every player (the POC's
    // fragParsingError, found by the local-reference differential)
    res.end(Buffer.isBuffer(body) ? body : typeof body === 'string' ? body : JSON.stringify(body));
  };
  try {
    const u = new URL(req.url, 'http://door');
    const parts = u.pathname.split('/').filter(Boolean); // [live, ...]

    /* health — publishing + honest numbers */
    if (u.pathname === '/live/health') {
      const rooms = [...streams.entries()].map(([room, s]) => {
        const dir = roomDir(room);
        let newest = 0, kbps = {};
        try {
          const segs = readdirSync(dir).filter(f => f.endsWith('.ts'));
          for (const f of segs) { const m = statSync(join(dir, f)).mtimeMs; if (m > newest) newest = m; }
          for (const v of ['480', '288']) {
            // segment naming: <variant>_<seq>.ts (480_000012.ts)
            const named = segs.filter(f => f.split('_')[0] === v).sort();
            const take = named.slice(-5);
            if (take.length >= 2) {
              const bytes = take.reduce((a, f) => a + statSync(join(dir, f)).size, 0);
              const secs = (statSync(join(dir, take[take.length - 1])).mtimeMs - statSync(join(dir, take[0])).mtimeMs) / 1000;
              if (secs > 0) kbps[v] = Math.round(bytes * 8 / secs / 1000);
            }
          }
        } catch {}
        return { room, publishing: !!s.ffmpeg, since: s.since,
                 newest_segment_age_ms: newest ? Date.now() - newest : null,
                 measured_kbps: kbps };
      });
      return send(200, { ok: true, door: 'read-only', rooms, ts: Date.now() });
    }

    /* the session receipt — read-only relay for the surface */
    if (parts[0] === 'live' && parts[1] === 'session' && parts[2]?.endsWith('.json')) {
      const id = parts[2].replace(/\.json$/, '');
      if (!/^\d+$/.test(id)) return send(404, { ok: false, reason: 'no such receipt' });
      const row = await meterRow(id);
      if (!row) return send(404, { ok: false, reason: 'no session ' + id });
      const rates = await rateRows().catch(() => []);
      const rate = rates.find(r => r.rail === row.rail) ?? null;
      const rem = units(row.credit) - units(row.burned);
      return send(200, { ok: true, sess: row, remaining: fmtA(rem),
                         live: row.state === 0 && rem > 0n, rate });
    }

    /* the ticker — the streamer's line */
    if (parts[0] === 'live' && parts[1] === 'ticker') {
      const room = safeRoom(parts[2]?.replace(/\.json$/, '') || '');
      const dir = room && parts[2]?.endsWith('.json') ? roomDir(room) : null;
      if (req.method === 'GET' && dir) {
        try { return send(200, readFileSync(join(dir, 'ticker.json'), 'utf8'), 'application/json');
        } catch { return send(200, { now: null, set: null, next: null }); }
      }
      if (req.method === 'POST' && room) {
        if (req.headers.authorization !== 'Bearer ' + STREAM_KEY)
          return send(401, { ok: false, reason: 'the ticker answers to the stream key' });
        let body = '';
        for await (const c of req) body += c;
        const j = JSON.parse(body);
        const clean = (v) => String(v ?? '').slice(0, 140) || null;
        const out = { now: clean(j.now), set: clean(j.set), next: clean(j.next), at: Date.now() };
        mkdirSync(roomDir(room), { recursive: true });
        writeFileSync(join(roomDir(room), 'ticker.json'), JSON.stringify(out));
        return send(200, { ok: true, ticker: out });
      }
      return send(405, { ok: false });
    }

    /* SEGMENTS — served by the door itself (one road for the whole /live
       tree; the playlist is the gate, segments ride whatever query they
       carry). Caddy proxies everything /live/* here. */
    if (parts[0] === 'live' && parts.length === 3 && parts[2]?.endsWith('.ts')) {
      const room = safeRoom(parts[1]);
      if (room && /^(480|288)_\d+$/.test(parts[2].replace(/\.ts$/, ''))) {
        try {
          return send(200, readFileSync(join(roomDir(room), parts[2])), 'video/mp2t');
        } catch { return send(404, { ok: false, reason: 'segment gone (live window)' }); }
      }
      return send(404, { ok: false, reason: 'no such segment' });
    }

    /* THE PLAYLIST DOOR — the one gate. read-only. */
    if (parts[0] === 'live' && parts[2]?.endsWith('.m3u8')) {
      const room = safeRoom(parts[1]);
      const file = parts[2].replace(/\.m3u8$/, '');
      if (!room || !/^(master|480|288)$/.test(file)) return send(404, { ok: false, reason: 'no such playlist' });
      const sessQ = u.searchParams.get('session');
      if (!sessQ || !/^\d+$/.test(sessQ))
        return send(402, { ok: false, reason: 'a receipt № is the ticket — ?session=<n>' });
      let row;
      try { row = await meterRow(sessQ); }
      catch { return send(503, { ok: false, reason: 'meter unreachable — door fail-closed' }); }
      if (!row) return send(402, { ok: false, reason: 'no session ' + sessQ, state: null });
      const rem = units(row.credit) - units(row.burned);
      if (!(row.state === 0 && rem > 0n))
        return send(402, { ok: false, paused: true, reason: row.state === 1
            ? 'session paused — resume lifts it (pause, not kill)'
            : 'credit at zero — top up the receipt; the session lives',
          state: row.state, credit: row.credit, burned: row.burned, remaining: fmtA(rem) });
      let text;
      try { text = readFileSync(join(roomDir(room), file + '.m3u8'), 'utf8'); }
      catch { return send(503, { ok: false, reason: 'the packager has not landed the playlist yet' }); }
      // thread the session through every child URI (variants + segments ride it)
      text = text.split('\n').map(l => (l && !l.startsWith('#') && !l.includes('session='))
        ? l + '?session=' + sessQ : l).join('\n');
      return send(200, text, 'application/vnd.apple.mpegurl');
    }

    return send(404, { ok: false, reason: 'the door serves playlists, receipts and the ticker' });
  } catch (e) {
    send(500, { ok: false, reason: 'door error: ' + String(e.message || e).slice(0, 120) });
  }
};
// two binds, one door: loopback (x0x tailnet forwards) + the docker bridge
// (caddy's 172.18.0.1 pattern — unreachable from the public internet)
for (const host of ['127.0.0.1', '172.18.0.1']) {
  await new Promise((res) => createServer(handler).listen(PORT, host, () => {
    console.log(`door: listening on ${host}:${PORT} (read-only meter gate)`); res();
  }));
}
console.log(`live-door: inlet :${RTMP_PORT} (loopback only) · packager ffmpeg ×2 renditions · LIVE_DIR ${LIVE_DIR}`);
