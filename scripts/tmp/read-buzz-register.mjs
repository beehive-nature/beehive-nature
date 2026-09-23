#!/usr/bin/env node
/* read-buzz-register.mjs — registers surfaces/read.html after buzz-directory (text insertion, idempotent),
   links it from both buzz doors' neighbour, then rebuilds the hub. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const F = 'estate.json'; let s = readFileSync(F, 'utf8'); const nl = s.includes('\r\n') ? '\r\n' : '\n';
if (!s.includes('"id": "read-buzz"')) {
  const anchor = '   "gloss": "the estate hives and the public buzz directory, verified",' + nl + '   "org": "skaists"' + nl + '  },' + nl;
  if (s.split(anchor).length !== 2) throw new Error('DRIFT: buzz-directory row');
  const row = ['  {', '   "id": "read-buzz",', '   "family": "skaists",', '   "home": "skaists.dev",', '   "path": "surfaces/read.html",', '   "state": "LIVE",', '   "gloss": "read a public buzz message in the browser — no app, no account; private channels never shown",', '   "org": "skaists"', '  },', ''].join(nl);
  s = s.replace(anchor, anchor + row); JSON.parse(s); writeFileSync(F, s);
}
execFileSync(process.execPath, ['scripts/build-atlas.mjs'], { stdio: 'inherit' });
console.log('read-buzz registered');
