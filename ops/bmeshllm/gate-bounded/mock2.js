#!/usr/bin/env node
// mock2.js — upstream mocks for the bounded-gate battery.
//   normal       POST streams a chunk every 500 ms, done ~3 s; /slots,/health 200
//   slowchunks   POST streams a chunk every 3500 ms (idle-timeout bait); rest 200
//   wedgeslots   /slots HANGS (the #27388 signature); POST hangs too; /health 200
//   headerhang   /slots 200 fast; POST accepts and NEVER responds (headers never sent)
// Usage: node mock2.js <port> <mode> <lifecycle-log>
'use strict';
const http = require('http');
const fs = require('fs');
const [port, mode, lifeLog] = [parseInt(process.argv[2]), process.argv[3], process.argv[4]];
const t = () => new Date().toISOString();
const log = (e) => fs.appendFileSync(lifeLog, `${t()} ${mode} ${e}\n`);
const server = http.createServer((req, res) => {
  log(`req ${req.method} ${req.url}`);
  req.on('data', () => {});
  if (req.url.startsWith('/health')) { res.writeHead(200, {'content-type':'application/json'}); return res.end('{"status":"ok"}'); }
  if (req.url.startsWith('/slots') && mode !== 'wedgeslots') { res.writeHead(200, {'content-type':'application/json'}); return res.end('[{"id":0}]'); }
  if (req.method !== 'POST') { res.writeHead(404); return res.end(); }
  if (mode === 'wedgeslots') { log(`HANGING ${req.url}`); return; }               // take it, never answer
  if (mode === 'headerhang') { log(`HANGING-POST ${req.url}`); return; }          // slots fine, generation wedges
  const gap = mode === 'slowchunks' ? 3500 : 500;
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.write(`data: {"tok":0}\n\n`);            // flush headers + first chunk at once (node headers are lazy)
  let i = 1;
  const iv = setInterval(() => {
    res.write(`data: {"tok":${i++}}\n\n`);
    if (i >= 6) { clearInterval(iv); res.end('data: [DONE]\n\n'); log('POST finished naturally'); }
  }, gap);
  res.on('close', () => { clearInterval(iv); log('response socket closed EARLY'); });
});
server.on('connection', (s) => { log('conn open'); s.on('close', () => log('conn CLOSED (natural or gate let go)')); });
server.listen(port, '127.0.0.1', () => log(`listening :${port} ${mode}`));
