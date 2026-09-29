// orb-coverage.mjs — what does the agent-dock orb COVER? (founder order 2026-09-13)
// The orb (#adOrb, fixed left:16 bottom:66, 52×52) is estate chrome: every
// census excluded it, so nothing measured what it hides. This walks every LIVE
// surface at 390×844 in bee+en, at the top AND bottom of the scroll, and
// reports every visible non-chrome element whose box intersects the orb's box
// by more than a graze (intersection ≥ 25% of the smaller box's area).
// Usage: node e2e/orb-coverage.mjs [--out=file.json] [--pages=a.html,b.html]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const estate = JSON.parse(readFileSync(join(ROOT, 'estate.json'), 'utf8'));
const ALL = estate.surfaces.filter(s => s.state === 'LIVE').map(s => s.path.replace(/^surfaces\//, ''));
const arg = f => { const a = process.argv.find(x => x.startsWith('--' + f + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const PAGES = arg('pages') ? arg('pages').split(',') : ALL;
const OUT = arg('out');

const MEASURE = `(() => {
  const CHROME='#adOrb,#adWin,#tbar,#tbarMore,#bregbar,#bregctl,#blangctl,#veil,#bandwrap,#adPanel';
  const orb=document.getElementById('adOrb');
  if(!orb) return {orb:false,items:[]};
  const o=orb.getBoundingClientRect();
  const out={orb:true,orbRect:{x:Math.round(o.x),y:Math.round(o.y),w:Math.round(o.width),h:Math.round(o.height)},items:[]};
  const bar=document.getElementById('tbar');
  const br=bar?bar.getBoundingClientRect():null;
  const inter=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  document.querySelectorAll('body *').forEach(n=>{
    if(n.closest(CHROME))return;
    if(orb.contains(n)||n.contains(orb))return; /* the orb's own subtree and its ancestors cannot be covered by it */
    const cs=getComputedStyle(n);
    if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return;
    let r=n.getBoundingClientRect();
    if(r.width<4||r.height<4)return;
    /* clip to the viewport: a 6000px container's raw rect spans every row —
       only what a reader can actually see can be covered */
    const cl={left:Math.max(r.left,0),right:Math.min(r.right,innerWidth),top:Math.max(r.top,0),bottom:Math.min(r.bottom,innerHeight)};
    if(cl.right-cl.left<4||cl.bottom-cl.top<4)return;
    /* the tour bar's own row is reserved chrome — content behind it is the
       bar's concern, not the orb's */
    if(br&&cl.bottom>br.top&&cl.top<br.bottom)return;
    r=cl;
    const ov=inter(r,o);
    if(ov<=0)return;
    const small=Math.min((r.right-r.left)*(r.bottom-r.top),o.width*o.height);
    if(ov/small<0.25)return; /* graze, not a cover */
    const t=(n.textContent||'').trim();
    out.items.push({tag:n.tagName.toLowerCase(),id:n.id||'',cls:String(n.className||'').slice(0,30),
      pos:cs.position,t:t.slice(0,44),x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.right-r.left),h:Math.round(r.bottom-r.top),
      coverPct:Math.round(ov/small*100)});
  });
  /* keep the outermost cover per subtree: drop items whose parent is already listed */
  return out;
})()`;

const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    const ct = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    const body = await readFile(join(SURF, rel));
    if (!s.headersSent) s.writeHead(200, { 'content-type': ct });
    s.end(body);
  } catch { if (!s.headersSent) s.writeHead(404); s.end(); }
});

srv.listen(8854, '127.0.0.1', async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const page of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const p = await ctx.newPage();
    const rec = { page, top: [], bottom: [], orbRect: null, orbMounted: false };
    try {
      await p.goto('http://127.0.0.1:8854/surfaces/' + page, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await p.waitForTimeout(2400); /* orb mounts via the page include, then seats (DOMContentLoaded + retries) */
      const top = await p.evaluate(MEASURE);
      rec.orbMounted = top.orb;
      rec.orbRect = top.orbRect;
      rec.top = top.items;
      await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await p.waitForTimeout(500);
      const bot = await p.evaluate(MEASURE);
      rec.bottom = bot.items;
    } catch (e) { rec.error = String(e).slice(0, 70); }
    rows.push(rec);
    const nTop = rec.top.length, nBot = rec.bottom.length;
    if (nTop || nBot || rec.error || !rec.orbMounted) {
      console.log(page.padEnd(40), rec.error ? 'ERR ' + rec.error : (!rec.orbMounted ? 'NO ORB' : ''), nTop ? 'top:' + nTop : '', nBot ? 'bottom:' + nBot : '');
      [...rec.top, ...rec.bottom].slice(0, 3).forEach(i => console.log('    ', i.tag, i.id ? '#' + i.id : '', i.cls, i.pos, `${i.x},${i.y} ${i.w}×${i.h}`, i.coverPct + '%', JSON.stringify(i.t.slice(0, 34))));
    }
    await ctx.close();
  }
  await b.close();
  srv.close();
  if (OUT) { writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), rows }, null, 1)); console.log('written ' + OUT); }
  const flagged = rows.filter(r => r.top.length || r.bottom.length);
  console.log('PAGES WITH ORB COVERAGE:', flagged.length, 'of', rows.length);
});
