// narrow-register-audit.mjs — THE 390px × REGISTER SWEEP (surface polish lane, 2026-09-13).
//
// One walk, four measurements the founder's order named:
//   UNKEYED        — visible strings no tongue can reach, counted per register
//                    (the same leaf walk as lang.js's coverage counter, chrome
//                    riders excluded; bee+raver are the priority registers).
//   OVERFLOW       — the document scrolls sideways at 390px (pinch-zoom bait),
//                    with the widest offending element named.
//   HARD CLIP      — text cut by an overflow:hidden box with no ellipsis
//                    affordance (the PR#71 gallery-heading class; ellipsis is
//                    design, a silent cut is a defect).
//   DEAD END       — visible failure copy (failed / couldn't / offline …) with
//                    no actionable control (button/link) in its container —
//                    the recoverable-failure candidates for the one-click pass;
//                    raw TypeError/ReferenceError text visible to a reader is
//                    flagged separately as TECHNICAL ERROR SHOWN.
//
// Fresh context per page×register, 390×844 mobile, no wallet, no prior visit —
// the cold-stranger posture. Served under the /surfaces/ prefix so tour.js,
// register.js and the corpus fetch all ride the real deployment route (a bare
// root 404s the injectors and the swap silently no-ops — banked rail).
//
// Usage: node e2e/narrow-register-audit.mjs [--regs=bee,raver,cypherpunk]
//        [--pages=a.html,dir/b.html] [--out=file.json] [--shots=dir]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const REGS = (arg('regs') || 'bee,raver').split(',');
const PAGES = arg('pages') ? arg('pages').split(',') : ALL;
const OUT = arg('out');
const SHOTS = arg('shots');

const MEASURE = `(() => {
  const CHROME='#tbar,#adOrb,#adPanel,#tbarMore,#railsbadge,#bregctl,#blangctl,#bregbar,#bregdescription,#bregintro,#veil,#bandwrap';
  const deadRe=/\\b(failed|fail|error|unreachable|couldn't|could not|cannot|not loading|offline|refused|timed out|no data|empty)\\b/i;
  const techRe=/^(TypeError|ReferenceError|SyntaxError|Uncaught|Error)[:\\s]/i;
  const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight*3;};
  const out={unkeyed:0,unkeyedSamples:[],overflowX:0,offenders:[],clips:[],deadEnds:[],techShown:[],keyed:0};
  out.overflowX=document.documentElement.scrollWidth-document.documentElement.clientWidth;
  if(out.overflowX>2){
    let worst=null;
    document.querySelectorAll('body *').forEach(n=>{
      if(n.closest&&n.closest(CHROME))return;
      const r=n.getBoundingClientRect();
      if(r.width===0&&r.height===0)return;
      const over=Math.max(r.right-innerWidth,-r.left);
      if(over>2&&(!worst||over>worst.over))worst={over,tag:n.tagName.toLowerCase(),id:n.id||'',cls:(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className||'').toString().slice(0,40),t:(n.textContent||'').trim().slice(0,40)};
    });
    if(worst)out.offenders.push(worst);
  }
  const clipsSeen=new Set();
  document.querySelectorAll('body *').forEach(n=>{
    if(n.children.length)return;
    if(n.closest&&n.closest(CHROME))return;
    if(['SCRIPT','STYLE','NOSCRIPT','CANVAS','SVG','PATH','OPTION','TEXT','TSPAN','TITLE'].includes(n.tagName))return;
    const t=(n.textContent||'').trim();
    if(t.length<3||!/[A-Za-zА-Яа-яЀ-ӿ]/.test(t))return;
    if(!vis(n))return;
    const cs=getComputedStyle(n);
    if(cs.display==='none'||cs.visibility==='hidden')return;
    {
      const hold=n.closest('[data-i18n]');
      if(hold)out.keyed++;else{out.unkeyed++;if(out.unkeyedSamples.length<10)out.unkeyedSamples.push(t.slice(0,70));}
    }
    if(n.scrollWidth>n.clientWidth+2){
      const te=cs.textOverflow;
      if(te!=='ellipsis'){
        let anc=n.parentElement,clipped=false;
        while(anc&&anc!==document.body){const a=getComputedStyle(anc);
          if(/(auto|scroll)/.test(a.overflowX))break;
          if(/(hidden|clip)/.test(a.overflowX)||/(hidden|clip)/.test(a.overflow)){clipped=true;break;}
          anc=anc.parentElement;}
        const selfClip=/(hidden|clip)/.test(cs.overflowX)||/(hidden|clip)/.test(cs.overflow);
        if(clipped||selfClip){
          const sig=n.tagName+'|'+t.slice(0,30);
          if(!clipsSeen.has(sig)){clipsSeen.add(sig);if(out.clips.length<8)out.clips.push({tag:n.tagName.toLowerCase(),id:n.id||'',t:t.slice(0,70),sw:n.scrollWidth,cw:n.clientWidth});}
        }
      }
    }
    if(techRe.test(t))out.techShown.push(t.slice(0,80));
    if(deadRe.test(t)&&t.length<200){
      let c=n,depth=0,action=false;
      while(c&&depth<3){if(c.querySelector('button,a,[role=button],label')){action=true;break;}c=c.parentElement;depth++;}
      if(!action&&out.deadEnds.length<8&&!out.deadEnds.some(d=>t.slice(0,40).includes(d.t.slice(0,20))))out.deadEnds.push({t:t.slice(0,90)});
    }
  });
  return out;
})()`;

const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    const p = join(SURF, rel);
    const body = await readFile(p);
    s.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
    s.end(body);
  } catch { s.writeHead(404); s.end(); }
});

srv.listen(8841, '127.0.0.1', async () => {
  const b = await chromium.launch();
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const rows = [];
  for (const page of PAGES) {
    const row = { page, regs: {} };
    for (const reg of REGS) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await ctx.addInitScript(r => { try { localStorage.setItem('bregister', r); } catch (e) {} }, reg);
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(String(e).slice(0, 90)));
      const rec = { pageerrors: errs };
      try {
        await p.goto('http://127.0.0.1:8841/surfaces/' + page, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await p.waitForTimeout(700);
        Object.assign(rec, await p.evaluate(MEASURE));
        rec.pageerrors = errs.concat(rec.pageerrors || []);
        if (SHOTS && reg === REGS[0]) await p.screenshot({ path: join(SHOTS, page.replace(/[\/\\]/g, '__') + '.png'), fullPage: false });
      } catch (e) { rec.loadError = String(e).slice(0, 90); rec.pageerrors = errs; }
      row.regs[reg] = rec;
      await ctx.close();
    }
    rows.push(row);
    const r0 = row.regs[REGS[0]] || {};
    console.log(page.padEnd(42),
      Object.entries(row.regs).map(([r, m]) => r[0] + ':unk' + (m.unkeyed ?? '?')).join(' '),
      (r0.overflowX > 2 ? 'OVF+' + r0.overflowX : ''),
      ((r0.clips || []).length ? 'CLIP' + r0.clips.length : ''),
      Object.values(row.regs).some(m => (m.deadEnds || []).length) ? 'DEAD' : '',
      Object.values(row.regs).some(m => (m.techShown || []).length || (m.pageerrors || []).length) ? 'ERR' : '');
  }
  await b.close();
  srv.close();
  if (OUT) { writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), pages: PAGES, regs: REGS, rows }, null, 1)); console.log('written ' + OUT); }
  const tot = { unkeyed: {} };
  REGS.forEach(r => tot.unkeyed[r] = rows.reduce((a, x) => a + ((x.regs[r] || {}).unkeyed || 0), 0));
  console.log('TOTALS unkeyed:', JSON.stringify(tot.unkeyed));
});
