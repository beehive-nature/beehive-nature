#!/usr/bin/env node
/* watch-ant-register.mjs — registers surfaces/watch-ant.html after read-buzz (text insertion, idempotent),
   links it from both buzz doors' neighbour, lists it in the review deck, then rebuilds the hub. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const F = 'estate.json'; let s = readFileSync(F, 'utf8'); const nl = s.includes('\r\n') ? '\r\n' : '\n';
if (!s.includes('"id": "watch-ant"')) {
  const anchor = '   "gloss": "read a public buzz message in the browser — no app, no account; private channels never shown",' + nl + '   "org": "skaists"' + nl + '  },' + nl;
  if (s.split(anchor).length !== 2) throw new Error('DRIFT: read-buzz row');
  const row = ['  {', '   "id": "watch-ant",', '   "family": "skaists",', '   "home": "skaists.dev",', '   "path": "surfaces/watch-ant.html",', '   "state": "LIVE",', '   "gloss": "watch a public autonomi video in the browser — paste an address, no app, no account",', '   "org": "skaists"', '  },', ''].join(nl);
  s = s.replace(anchor, anchor + row); JSON.parse(s); writeFileSync(F, s);
}
{ const P='surfaces/review.html'; let v=readFileSync(P,'utf8'); if(!v.includes("'watch-ant.html'")){ const a="'read.html',"; if(v.split(a).length!==2) throw new Error('DRIFT: review deck'); writeFileSync(P, v.replace(a, a+"'watch-ant.html',")); } }
execFileSync(process.execPath, ['scripts/build-atlas.mjs'], { stdio: 'inherit' });
console.log('watch-ant registered');
