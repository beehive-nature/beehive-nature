#!/usr/bin/env node
// mock-upstream.js — the throwaway upstream for the gate-semantics tests.
// Mode A (wedge): accepts everything, /health answers 200, EVERYTHING ELSE
//   (including /slots and POST generations) hangs forever — the #27388
//   server-wedge signature.
// Mode B (slowgen): POST answers 200 after 3 s (streams a little SSE first);
//   /health and /slots answer 200 instantly. Logs socket lifecycle with
//   timestamps so the tests can see whether the GATE closes the upstream
//   connection when the real client aborts.
// Usage: node mock-upstream.js <port> <A|B> <lifecycle-log>
'use strict';
const http = require('http');
const fs = require('fs');
const [port, mode, lifeLog] = [parseInt(process.argv[2]), process.argv[3], process.argv[4]];
const t = () => new Date().toISOString();
const log = (e) => fs.appendFileSync(lifeLog, `${t()} ${mode} ${e}\n`);
const server = http.createServer((req, res) => {
  log(`req ${req.method} ${req.url} from gate`);
  if (req.url.startsWith('/health')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"status":"ok"}');
    return;
  }
  if (req.url.startsWith('/slots') && mode === 'B') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('[{"id":0}]');
    return;
  }
  if (req.method === 'POST' && mode === 'B') {
    // a "generation": stream a little, finish at ~3s
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    let i = 0;
    const iv = setInterval(() => {
      res.write(`data: {"tok":${i++}}\n\n`);
      if (i >= 6) { clearInterval(iv); res.end('data: [DONE]\n\n'); }
    }, 500);
    res.on('close', () => { clearInterval(iv); log('B response socket closed early (client/gate aborted the response)'); });
    return;
  }
  // mode A: wedge — take the request, never answer
  log(`A HANGING ${req.method} ${req.url}`);
  // drain the body so the gate's pipe doesn't block, then say nothing
  req.on('data', () => {});
  req.on('end', () => log(`A body drained, still hanging ${req.url}`));
});
server.on('connection', (s) => {
  log('conn open');
  s.on('close', () => log('conn CLOSED (upstream socket ended — the gate let go)'));
});
server.listen(port, '127.0.0.1', () => log(`listening :${port}`));
