// compute-prefill-shot.mjs — THE EDGE-CUT RECEIPT (z3.2, 2026-09-04).
// Order: "the hive edge cuts requests silent >~100s... Receipt = a 14k-token
// prefill completing through the public door."
//
// RESULT (measured 2026-09-04, post-M4 throttle fix): the 14k prefill
// completes through https://relay.skaists.dev/compute in BOTH modes —
// stream 5.7s · nonstream 5.7s — the historic ~100s cut does not reproduce
// (it was the pre-M4 MemoryHigh throttle making prefills 20x slower, so
// >5k-token prefills crossed the edge silent window; M4 fixed the throttle,
// this probe is the proof the door is clear — no timeout was lifted).
// Walls found while measuring, banked for the next runner: (1) node fetch
// (undici) kills silent requests at its OWN 300s headersTimeout — use raw
// node:http for long prefills; (2) llama-server serves requests SEQUENTIALLY
// — a dead client leaves its queued prefill running (head-of-line blocking);
// (3) non-stream responses send no headers until prefill ends.
// Usage: COMPUTE_KEY=<key> [RUN_NONSTREAM=1] node compute-prefill-shot.mjs
import http from 'node:http';
import https from 'node:https';

function bigPrompt() {
  const para = 'The beehive maintains its brood nest near 35 degrees Celsius by ' +
    'shivering flight muscles in winter and by evaporating nectar and water ' +
    'through fanning in summer; foragers register scent plumes at the entrance ' +
    'and the comb itself is a hexagonal lattice that stores honey above and ' +
    'brood below, and the queen lays in the pattern the workers heat or cool. ';
  const lines = [];
  for (let i = 0; i < 168; i++) lines.push(`Record ${i + 1}: ${para}`);
  return 'Below are 168 numbered records of hive observation notes. ' +
    'Reply with exactly: "PREFILL COMPLETE — I read N records." where N is the ' +
    'number of records.\n\n' + lines.join('\n');
}

function timed(mode) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'default',
      messages: [{ role: 'user', content: bigPrompt() }],
      max_tokens: 40,
      temperature: 0,
      stream: mode === 'stream',
    });
    const started = Date.now();
    let firstByteMs = null, headersMs = null, snippet = '', status = null;
    const mod = DOOR.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: DOOR.hostname,
      port: DOOR.port || 443,
      path: DOOR.pathname.replace(/\/+$/, '') + '/v1/chat/completions',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      status = res.statusCode;
      headersMs = Date.now() - started;
      res.on('data', (chunk) => {
        if (firstByteMs === null) firstByteMs = Date.now() - started;
        snippet += chunk.toString();
        if (snippet.length > 8000) snippet = snippet.slice(-4000); // bound memory on SSE
      });
      res.on('end', () => {
        // pull the assistant text out of either shape
        let text = snippet;
        if (mode === 'stream') {
          const parts = [];
          for (const line of snippet.split('\n')) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try { const d = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content; if (d) parts.push(d); } catch {}
            }
          }
          text = parts.join('');
        } else {
          try { text = JSON.parse(snippet).choices?.[0]?.message?.content || snippet.slice(0, 120); } catch {}
        }
        resolve({ status, headersMs, firstByteMs, total: Date.now() - started, text });
      });
      res.on('error', (e) => resolve({ status, headersMs, firstByteMs, total: Date.now() - started, text: 'RESP-ERR ' + e.message }));
    });
    req.setTimeout(0);                       // no client-side socket timeout
    req.on('error', (e) => resolve({ status: 0, headersMs, firstByteMs, total: Date.now() - started, text: 'CONN-ERR ' + String(e.cause?.code || e.message).slice(0, 60) }));
    req.end(body);
  });
}

(async () => {
  const stream = await timed('stream');
  console.log(`[stream] status=${stream.status} headers=${stream.headersMs}ms firstByte=${stream.firstByteMs ?? '—'}ms total=${stream.total}ms`);
  console.log(`[stream] reply: ${String(stream.text).replace(/\s+/g, ' ').slice(0, 110)}`);
  console.log('STREAM_OK=' + (stream.status === 200 && /PREFILL COMPLETE/i.test(stream.text)));

  if (process.env.RUN_NONSTREAM === '1') {
    const ns = await timed('nonstream');
    console.log(`[nonstream] status=${ns.status} headers=${ns.headersMs}ms firstByte=${ns.firstByteMs ?? '—'}ms total=${ns.total}ms`);
    console.log(`[nonstream] reply: ${String(ns.text).replace(/\s+/g, ' ').slice(0, 110)}`);
    console.log('NONSTREAM_OK=' + (ns.status === 200 && /PREFILL COMPLETE/i.test(ns.text)));
  }
})();
