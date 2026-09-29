// mobile-comprehension.mjs — the phone-readability census (founder order
// 2026-09-16: stop hunting geometry, start measuring whether humans can
// understand and use the estate on a phone).
//
// Four measurements per surface, bee register, 390×844:
//   WALLS      — dense prose blocks: ≥48 words of body copy in ONE unbroken
//                element, not inside any disclosure. A phone reader meets
//                these as walls of text. (48 ≈ 9–10 phone lines.)
//   JARGON     — technical tokens per wall: the estate's own crypto/systems
//                vocabulary appearing unglossed in bee-visible prose.
//   TOUCH      — interactive controls under 44px rendered height or width
//                (buttons, links, selects, inputs, role=button) — below the
//                estate's own 44px canon (register.js pills).
//   DISCLOSURE — <details> count vs section count: how much of the page is
//                progressively disclosed vs flat.
// Nothing here changes any page. Ranking output only.
// Usage: node e2e/mobile-comprehension.mjs [--pages=a.html,b.html] [--out=f.json]
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
const DEFAULT = ['wallet.html', 'b4b.html', 'blight/index.html', 'blight/workbench.html', 'blight/gallery.html',
  'blight/museum.html', 'blight/market.html', 'blight/coop.html', 'blight/demo.html', 'blight/farmers.html',
  'blight/hearth.html', 'blight/pulse.html', 'blight/inscription-explorer.html', 'blight/vaulta-reader.html',
  'blight/c1-aid.html', 'blight/compare.html', 'blight/studio-gate.html', 'blight/studio-music.html',
  'blight/midi.html', 'blight/midivault.html', 'record.html', 'stack.html', 'privacy-lens.html'];
const PAGES = arg('pages') ? arg('pages').split(',') : DEFAULT;
const OUT = arg('out');

const JARGON = ['secp256k1', 'ed25519', 'PBKDF2', 'AES-256-GCM', 'nonce', 'RPC', 'memo', 'hash-chain', 'hash-chained',
  'adaptor', 'signature', 'keypass', 'seed phrase', 'derivation', 'canonical JSON', 'kind-10100', 'NIP-', 'x402',
  'escrow', 'tithe', 'BIP-', 'PSBT', 'UTXO', 'arweave', 'autonomi', 'jungle4', 'testnet', 'mainnet', 'txid',
  'anchor', 'receipt', 'on-chain', 'keyless', 'bzDiD', 'passkey', 'PRF', 'TOFU', 'quota', 'replay'];

const MEASURE = `(() => {
  const CHROME='#tbar,#tbarMore,#adOrb,#adWin,#adPanel,#bregbar,#bregctl,#blangctl,#veil,#bandwrap,#railsbadge';
  const out={walls:[],jargonTotal:0,touchSmall:[],details:0,sections:0};
  const words=t=>((t||'').trim().match(/\\S+/g)||[]).length;
  // walls: leaf-ish prose elements (p, div, span with only text), not disclosed
  document.querySelectorAll('body p, body div, body span').forEach(n=>{
    if(n.closest(CHROME))return;
    if(n.querySelector('p,div:not([data-x]),button,a,table,ul,ol,canvas,svg,section'))return; // containers skip
    if(n.closest('details')&&!n.closest('details').open)return;
    const cs=getComputedStyle(n);
    if(cs.display==='none'||cs.visibility==='hidden')return;
    const t=(n.textContent||'').trim();
    const w=words(t);
    if(w<48)return;
    const r=n.getBoundingClientRect();
    if(r.width===0&&r.height===0)return;
    const low=t.toLowerCase();
    let j=0; ${JSON.stringify(JARGON)}.forEach(k=>{const m=low.split(k.toLowerCase()).length-1;if(m)j+=m;});
    out.walls.push({tag:n.tagName.toLowerCase(),id:n.id||'',w,j,t:t.slice(0,90)});
    out.jargonTotal+=j;
  });
  // touch: interactive controls under 44px
  document.querySelectorAll('button,a,select,input,[role=button],summary').forEach(n=>{
    if(n.closest(CHROME))return;
    if(n.closest('#tbar'))return;
    const cs=getComputedStyle(n);
    if(cs.display==='none'||cs.visibility==='hidden')return;
    const r=n.getBoundingClientRect();
    if(r.width===0&&r.height===0)return;
    if(r.height>0&&r.height<44&&n.tagName!=='A') out.touchSmall.push({tag:n.tagName.toLowerCase(),id:n.id||'',t:(n.textContent||'').trim().slice(0,26),h:Math.round(r.height),w:Math.round(r.width)});
    else if(n.tagName==='A'&&r.height>0&&r.height<32&&r.width<160&&words(n.textContent)<=2) out.touchSmall.push({tag:'a-inline',t:(n.textContent||'').trim().slice(0,26),h:Math.round(r.height),w:Math.round(r.width)});
  });
  out.details=document.querySelectorAll('details').length;
  out.sections=document.querySelectorAll('section').length;
  out.walls.sort((a,b)=>b.w-a.w);
  out.touchSmall=out.touchSmall.slice(0,12);
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

srv.listen(8865, '127.0.0.1', async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const page of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('bregister', 'bee'); localStorage.setItem('blang', 'en'); } catch (e) {} });
    const p = await ctx.newPage();
    let rec = { page };
    try {
      await p.goto('http://127.0.0.1:8865/surfaces/' + page, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await p.waitForTimeout(1600);
      rec = { page, ...(await p.evaluate(MEASURE)) };
    } catch (e) { rec.error = String(e).slice(0, 60); }
    rows.push(rec);
    const wallWords = (rec.walls || []).reduce((a, w2) => a + w2.w, 0);
    console.log(page.padEnd(38), 'walls:' + String((rec.walls || []).length).padStart(2), 'wallWords:' + String(wallWords).padStart(4), 'jargon:' + String(rec.jargonTotal ?? 0).padStart(3), 'touch<44:' + String((rec.touchSmall || []).length).padStart(2), 'details:' + rec.details + '/' + rec.sections);
    await ctx.close();
  }
  await b.close();
  srv.close();
  if (OUT) { writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), rows }, null, 1)); console.log('written ' + OUT); }
  rows.sort((a, b2) => (b2.walls || []).reduce((x, w2) => x + w2.w, 0) - (a.walls || []).reduce((x, w2) => x + w2.w, 0));
  console.log('\n=== RANKED by wall words ===');
  rows.filter(r => !r.error).slice(0, 10).forEach(r => {
    const ww = r.walls.reduce((a, w2) => a + w2.w, 0);
    console.log(String(ww).padStart(5), r.page, '· worst wall:', r.walls[0] ? r.walls[0].w + 'w/' + r.walls[0].j + 'j' : '-', JSON.stringify((r.walls[0] || {}).t || '').slice(0, 60));
  });
});
