#!/usr/bin/env node
/* read-buzz-review.mjs — the review deck lists every surface; read.html joins it beside buzz-directory. Asserted, idempotent. */
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'surfaces/review.html'; let s = readFileSync(P, 'utf8');
if (!s.includes("'read.html'")) { const a = "'buzz-directory.html',"; if (s.split(a).length !== 2) throw new Error('DRIFT: review deck'); s = s.replace(a, a + "'read.html',"); writeFileSync(P, s); }
console.log('review deck lists read.html');
