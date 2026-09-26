#!/usr/bin/env node
/* paper-and-ink-sweep.mjs — the one-time sweep that moved the estate's new-bee
   NEUTRALS to the ruled face (2026-09-19) and gave every page the one-row
   register control. Kept as the receipt of exactly what was changed; every
   replacement is asserted, so a re-run on a swept tree changes nothing and a
   run on a drifted tree fails loudly. Semantic hues are never touched. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const MAP = { f6f7f2:'fbf7f0', edf2eb:'efe9dd', e2eadf:'e9e2d5', ccd7cf:'e6dfd2', '18362a':'0c1412', '435f4e':'4a5f55', '52695b':'5a645e', '8a9e90':'857d70' };
const SKIP = new Set(['surfaces/bdata.html', 'surfaces/atlas.css']);      /* zCode's active lane · the hub already carries the face */
const walk = (dir, out = []) => { for (const n of readdirSync(dir)) { if (n === 'node_modules') continue; const p = join(dir, n).replace(/\\/g, '/'); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const files = [...walk('surfaces'), ...walk('e2e'), ...walk('docs/mvp-walk')].filter(f => /\.(html|js|mjs|css)$/.test(f) && !SKIP.has(f));
let touched = 0;
for (const f of files) {
  const s = readFileSync(f, 'utf8'); let t = s;
  for (const [a, b] of Object.entries(MAP)) t = t.replace(new RegExp('#' + a + '([0-9a-fA-F]{2})?(?![0-9a-fA-F])', 'gi'), (m, alpha) => '#' + b + (alpha || ''));
  if (t !== s) { writeFileSync(f, t); touched++; }
}
const edit = (file, pairs) => { let s = readFileSync(file, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n'); for (const [a, b] of pairs) { if (s.includes(b)) continue; if (s.split(a).length !== 2) throw new Error('DRIFT in ' + file + ': ' + a.slice(0, 60)); s = s.replace(a, b); } writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s); };
const HOVER = "    #bregctl button:hover{border-color:var(--reg-active);text-decoration:underline;text-underline-offset:3px}\n";
edit('surfaces/register.js', [
  ['--reg-line:#857d70;--reg-active:#326b39;--reg-on:#fff;', '--reg-track:#efe9dd;--reg-line:#857d70;--reg-active:#0c1412;--reg-on:#fbf7f0;'],
  ['#bregctl{--reg-bg:#0e1b19;', '#bregctl{--reg-track:#15241f;--reg-bg:#0e1b19;'],
  ['#bregctl{--reg-bg:#06110c;', '#bregctl{--reg-track:#0c1412;--reg-radius:4px;--reg-bg:#06110c;'],
  ['--reg-active:#b7a8f7;--reg-on:#101724;', '--reg-active:#d655bb;--reg-on:#06110c;'],
  ['--reg-active:#86cc72;--reg-on:#06110c;', '--reg-active:#45c2dc;--reg-on:#06110c;'],
  [HOVER, HOVER + `    /* THE RULED FACE (2026-09-19): one row where the words fit (it wraps for long tongues, never overflows), a pill track, the pressed pill filled;
       the check mark still says "pressed" without colour. Emoji give way to words. */
    #bregctl{flex-wrap:wrap;gap:2px;padding:4px;border-radius:var(--reg-radius,26px);background:var(--reg-track)}
    #bregctl button{border-color:transparent;border-radius:var(--reg-radius,999px);background:transparent;padding:8px 12px;white-space:normal;overflow-wrap:anywhere;gap:6px}
    #bregctl button>span[aria-hidden="true"]{display:none}
    #bregctl button::before{display:none}
    #bregctl button[aria-pressed="true"]::before{display:inline-block}
    #bregctl button:focus-visible{outline:2px solid var(--reg-ink);outline-offset:3px}
`]]);
edit('e2e/bdata-surface.mjs', [["canvas.bg === 'rgb(246, 247, 242)'", "canvas.bg === 'rgb(251, 247, 240)'"]]);      /* the same canvas, spelled rgb() */
edit('surfaces/atlas.css', [      /* the hub's own copy of the control: same law — wrap, never overflow */
  ['body[data-experience=home] #bregctl{flex-wrap:nowrap;gap:2px;padding:4px;border-radius:999px;', 'body[data-experience=home] #bregctl{flex-wrap:wrap;gap:2px;padding:4px;border-radius:26px;'],
  ['padding:8px 14px;white-space:nowrap;gap:6px}', 'padding:8px 14px;white-space:normal;overflow-wrap:anywhere;gap:6px}']]);
edit('surfaces/watch.html', [['.eyebrow{font-size:.75rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}', '.eyebrow{font-size:.75rem;letter-spacing:.16em;color:var(--muted)}']]);
console.log('swept ' + touched + ' files · register control + watch eyebrow set');
