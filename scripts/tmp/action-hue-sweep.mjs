#!/usr/bin/env node
/* action-hue-sweep.mjs — the old new-bee ACTION green (#326b39) gives way to the
   ruled face (2026-09-19), by MEANING, never by blind replace:
     a filled call to action        → magenta  #a8238c  (you — the one acting)
     a link, a headline take, accent → human purple #6e3fb8
     a hover/focus edge or outline   → ink #0c1412
   Everything where green MEANS something stays green and is not matched here:
   --leaf --verified --biomass --ok --green --fill* --ess --c-works --t-sup,
   drawn art (fill="…"), and pages that chose data-bee-accent="green".
   Re-run changes nothing. bdata.html is zCode's active lane and is skipped. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const G = '#326b39', YOU = '#a8238c', HUMAN = '#6e3fb8', INK = '#0c1412';
const RULES = [
  [/(\.door\.primary\{background:)#326b39/gi, '$1' + YOU],
  [/(a\.btn\{background:)#326b39/gi, '$1' + YOU],
  [/(button\.keep\{background:)#326b39/gi, '$1' + YOU],
  [/(button\.act:hover\{background:)#326b39/gi, '$1' + YOU],
  [/(#mkReview\{background:)#326b39/gi, '$1' + YOU],
  [/(--primary:)#326b39/gi, '$1' + YOU],
  [/(--you:)#326b39/gi, '$1' + YOU],
  [/(\.take\{color:)#326b39/gi, '$1' + HUMAN],
  [/(--accent:)#326b39/gi, '$1' + HUMAN],
  [/(--ad-accent[:,])#326b39/gi, '$1' + HUMAN],
  [/(accent-color:)#326b39/gi, '$1' + HUMAN],
  [/(--active:)#326b39/gi, '$1' + INK],
  [/(border-color:)#326b39/gi, '$1' + INK],
  [/(outline:\dpx solid )#326b39/gi, '$1' + INK],
  [/((?<![-\w])color:)#326b39/gi, '$1' + HUMAN],
];
const KEEP_GREEN_LINE = /data-bee-accent="green"/;      /* an explicit green choice stays green */
const SKIP = new Set(['surfaces/bdata.html']);
const walk = (dir, out = []) => { for (const n of readdirSync(dir)) { if (n === 'node_modules') continue; const p = join(dir, n).replace(/\\/g, '/'); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const files = [...walk('surfaces'), ...walk('e2e'), ...walk('docs/mvp-walk')].filter(f => /\.(html|js|mjs|css)$/.test(f) && !SKIP.has(f) && !/^surfaces\/fleet/.test(f));
let touched = 0, swaps = 0;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  const t = s.split('\n').map(line => { if (KEEP_GREEN_LINE.test(line) || !/#326b39/i.test(line)) return line; let l = line; for (const [re, to] of RULES) l = l.replace(re, (...m) => { swaps++; return to.replace('$1', m[1]); }); return l; }).join('\n');
  if (t !== s) { writeFileSync(f, t); touched++; }
}
console.log('action hue: ' + swaps + ' swaps in ' + touched + ' files · green kept wherever it means something');
