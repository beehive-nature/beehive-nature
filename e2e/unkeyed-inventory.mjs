// unkeyed-inventory.mjs — the FULL unkeyed-string inventory for keylisting
// (surface polish lane, 2026-09-13). narrow-register-audit counts on-screen
// leaves; this one scrolls the whole page so below-fold prose is inventoried
// too, and dedups across the requested registers. Output: JSON list of
// {text, reg} per page — the raw material for the corpus keylist, before the
// human classifies translatable prose vs published-record English.
// Usage: node e2e/unkeyed-inventory.mjs index.html,wallet.html --regs=bee,raver [--out=file]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const arg = f => { const a = process.argv.find(x => x.startsWith('--' + f + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const PAGES = (process.argv[2] || '').split(',').filter(Boolean);
const REGS = (arg('regs') || 'bee').split(',');
const OUT = arg('out');

const COLLECT = `(() => {
  const CHROME='#tbar,#adOrb,#adPanel,#tbarMore,#railsbadge,#bregctl,#blangctl,#veil,#bandwrap';
  const seen=new Set(), items=[];
  document.querySelectorAll('body *').forEach(n=>{
    if(n.children.length)return;
    if(n.closest&&n.closest(CHROME))return;
    if(['SCRIPT','STYLE','NOSCRIPT','CANVAS','SVG','PATH','OPTION','TITLE'].includes(n.tagName))return;
    const t=(n.textContent||'').trim();
    if(t.length<3||!/[A-Za-zА-Яа-яЀ-ӿ]/.test(t))return;
    const cs=getComputedStyle(n);
    if(cs.display==='none'||cs.visibility==='hidden')return;
    const r=n.getBoundingClientRect();
    if(r.width===0&&r.height===0)return;
    const sig=t+'|'+(n.closest('[data-i18n]')?n.closest('[data-i18n]').getAttribute('data-i18n'):'');
    if(seen.has(sig))return;seen.add(sig);
    items.push({t:t.slice(0,160),keyed:!!n.closest('[data-i18n]'),tag:n.tagName.toLowerCase(),id:n.id||''});
  });
  return items;
})()`;

const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    const p = join(SURF, rel);
    const body = await readFile(p);
    s.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
    s.end(body);
  } catch { s.writeHead(404); s.end(); }
});

srv.listen(8842, '127.0.0.1', async () => {
  const b = await chromium.launch();
  const out = {};
  for (const page of PAGES) {
    const per = {};
    for (const reg of REGS) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
      await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch (e) {} }, reg);
      const p = await ctx.newPage();
      const items = [];
      try {
        await p.goto('http://127.0.0.1:8842/surfaces/' + page, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await p.waitForTimeout(500);
        const h = await p.evaluate(() => document.body.scrollHeight);
        const steps = Math.min(24, Math.ceil(h / 700));
        for (let i = 0; i <= steps; i++) {
          await p.evaluate(y => scrollTo(0, y), i * 700);
          await p.waitForTimeout(120);
          (await p.evaluate(COLLECT)).forEach(x => items.push(x));
        }
      } catch (e) { console.error(page + ' ' + reg + ': ' + String(e).slice(0, 60)); }
      const seen = new Set();
      per[reg] = items.filter(x => { const s2 = x.t + x.keyed; if (seen.has(s2)) return false; seen.add(s2); return true; });
      await ctx.close();
    }
    out[page] = per;
    for (const reg of REGS) console.log(page, reg, 'leaves:', per[reg].length, 'unkeyed:', per[reg].filter(x => !x.keyed).length);
  }
  await b.close(); srv.close();
  if (OUT) { writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('written ' + OUT); }
  else for (const [pg, per] of Object.entries(out)) for (const reg of REGS) {
    console.log('\n=== ' + pg + ' [' + reg + '] unkeyed ===');
    per[reg].filter(x => !x.keyed).forEach(x => console.log('  ' + (x.id ? '#' + x.id + ' ' : '') + x.t));
  }
});
