/* register-audit.mjs — per-surface three-register audit against the skaists design
   system blueprint (docs/dispatches/2026-09-25-skaists-design-system-blueprint.md).
   Static, read-only. One row per surface html file in the tree. */
import fs from 'fs';
import path from 'path';

const roots = ['surfaces', 'blight', '.'];
const skipDirs = new Set(['node_modules', '.git', 'tmp']);
const REDS = ['#e5484d','#d92d20','#ff4d4f','#f44336','#dc2626','#b91c1c','#ef4444','#c0392b','#e74c3c','#ff3b30','#f87171','#eb0029','#d64545'];
const rows = [];

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!skipDirs.has(e.name)) yield* walk(p); }
    else if (e.name.endsWith('.html')) yield p;
  }
}

const files = new Set();
for (const r of roots) {
  if (r === '.') { for (const f of fs.readdirSync('.')) if (f.endsWith('.html')) files.add(f); }
  else if (fs.existsSync(r)) yieldNothing: for (const f of walk(r)) files.add(f.replaceAll('\\','/'));
}

// estate.json rows for cross-reference
let estate = [];
try {
  const d = JSON.parse(fs.readFileSync('estate.json', 'utf8'));
  const arr = Array.isArray(d) ? d : (d.surfaces || d.estate || Object.values(d).find(Array.isArray));
  estate = arr.map(r => r.path);
} catch {}

for (const f of [...files].sort()) {
  let t = '';
  try { t = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const loads = {
    tour: /tour\.js/.test(t),
    register: /register\.js/.test(t),
    railsBadge: /rails-badge\.js/.test(t),
  };
  const toggle = loads.tour || loads.register || loads.railsBadge;
  const reg = { bee: 0, raver: 0, cypherpunk: 0 };
  for (const m of t.matchAll(/data-reg=["'](bee|raver|cypherpunk)["']/g)) reg[m[1]]++;
  // dress: register-scoped style rules inside the page (body[data-reg] or [data-reg="x"] in <style>)
  const styleBlocks = [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  const dress = { bee: 0, raver: 0, cypherpunk: 0 };
  for (const m of styleBlocks.matchAll(/\[data-reg=["'](bee|raver|cypherpunk)["']\]/g)) dress[m[1]]++;
  const violations = [];
  if (/text-transform\s*:/i.test(t)) violations.push('text-transform');
  const low = t.toLowerCase();
  const red = REDS.find(r => low.includes(r));
  if (red) violations.push('red-hex ' + red);
  if (/box-shadow\s*:/i.test(styleBlocks)) violations.push('box-shadow(' + (styleBlocks.match(/box-shadow\s*:/gi) || []).length + ')');
  const gold = (low.match(/ffd700|#e8b54b/g) || []).length;
  if (gold) violations.push('gold-hex(' + gold + ')');
  const threeUx = reg.bee > 0 && reg.raver > 0 && reg.cypherpunk > 0;
  const someUx = reg.bee + reg.raver + reg.cypherpunk > 0;
  const verdict = threeUx ? 'THREE-UX' : someUx ? 'PARTIAL(' + ['bee','raver','cypherpunk'].filter(k => reg[k] > 0).join('+') + ')' : toggle ? 'TOGGLE-ONLY' : 'NO-TOGGLE';
  rows.push({ f, verdict, tour: loads.tour, reg: loads.register, badge: loads.railsBadge,
    bee: reg.bee, raver: reg.raver, cy: reg.cypherpunk,
    dressBee: dress.bee, dressRaver: dress.raver, dressCy: dress.cypherpunk,
    v: violations, inEstate: estate.includes(f) });
}

const counts = {};
for (const r of rows) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
console.log('=== VERDICT COUNTS ==='); console.log(JSON.stringify(counts, null, 1));
console.log('=== THREE-UX ===');
for (const r of rows) if (r.verdict === 'THREE-UX') console.log(r.f, JSON.stringify(r.reg), 'dress', r.dressBee + '/' + r.dressRaver + '/' + r.dressCy, r.v.join(','));
console.log('=== PARTIAL ===');
for (const r of rows) if (r.verdict.startsWith('PARTIAL')) console.log(r.f, r.verdict, r.v.join(','));
console.log('=== NO-TOGGLE ===');
for (const r of rows) if (r.verdict === 'NO-TOGGLE') console.log(r.f, r.inEstate ? '(estate)' : '(unregistered)');
console.log('=== VIOLATIONS ===');
for (const r of rows) if (r.v.length) console.log(r.f, '[' + r.verdict + ']', r.v.join(' | '));
fs.writeFileSync('scripts/tmp/register-audit.json', JSON.stringify(rows, null, 1));
console.log('=== TOTAL FILES:', rows.length, '===');
