import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SURF=join(ROOT,'surfaces');
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json'};
const srv=createServer(async(req,res)=>{try{
  let rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')||'index.html';
  if(rel.endsWith('/'))rel+='index.html'; const orig=rel;
  rel=rel.replace(/^surfaces\//,''); const p=join(SURF,rel);
  let b; try{ b=await readFile(extname(p)?p:join(p,'index.html')); }
  catch{ const q=join(ROOT,orig); b=await readFile(extname(q)?q:join(q,'index.html')); }
  res.writeHead(200,{'content-type':MIME[extname(rel)]||'application/octet-stream'});res.end(b);
}catch{res.writeHead(404);res.end('nf');}});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${srv.address().port}`;
let pass=0,fail=0;
const ok=(n,c,note='')=>{ if(c){pass++;console.log('PASS '+n);} else {fail++;console.log('FAIL '+n+(note?' — '+note:''));} };

const readBracelet = p => p.evaluate(() => {
  const svg = document.querySelector('#preview svg'); if (!svg) return '';
  const kids = [...svg.children].slice(1);
  const COLS = ['#39c5cf','#D655BB','#e6b32e','#a78bfa','#7ddf8f','#45C2DC','#ff8c5a','#ece5f7','#5b4a86','#f4e04d'];
  let out = '';
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (n.tagName.toLowerCase() !== 'circle') continue;
    const nxt = kids[i + 1];
    if (nxt && nxt.tagName.toLowerCase() === 'text') { out += nxt.textContent; i++; }
    else {
      const f = (n.getAttribute('fill') || '').toLowerCase();
      const k = COLS.findIndex(c => c.toLowerCase() === f);
      out += (k < 0 ? '?' : String(k));
    }
  }
  return out;
});
const beadCount = p => p.evaluate(() => {
  const svg = document.querySelector('#preview svg'); if (!svg) return 0;
  return [...svg.children].slice(1).filter(n => n.tagName.toLowerCase() === 'circle').length;
});

const b=await chromium.launch();
const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,100)));
await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(500);

// OFF by default — nobody's habit changes
await p.fill('#word','PLUR'); await p.click('#addword'); await p.waitForTimeout(150);
let d=await readBracelet(p);
ok('threading is OFF by default — a word is still pure letter beads', d==='PLUR', d);
ok('the hint tells you letters are white beads',
   /letters are white beads/i.test(await p.evaluate(()=>document.body.innerText)));

// ON: colour between, never trailing
await p.click('#clear');
await p.click('#thread');
await p.fill('#word','PLUR'); await p.click('#addword'); await p.waitForTimeout(150);
d=await readBracelet(p);
ok('threading puts a colour BETWEEN each pair of letters', /^P\dL\dU\dR$/.test(d), d);
ok('it never trails a colour on the end', !/\d$/.test(d), d);
ok('the bracelet actually paints colour now',
   await p.evaluate(()=>{const c=[...document.querySelectorAll('#preview circle')].map(n=>n.getAttribute('fill'));
     return c.filter(x=>x&&x!=='none'&&x!=='#ece5f7').length>=3;}));

// the artist's chosen colour wins
await p.click('#clear');
await p.click('#pal button:nth-child(2)');           // magenta = index 1
await p.click('#undo');                              // drop the tapped bead, keep the choice
await p.fill('#word','ABC'); await p.click('#addword'); await p.waitForTimeout(150);
d=await readBracelet(p);
ok('it threads the colour the artist last tapped', d==='A1B1C', d);

// a single letter has no gap to fill
await p.click('#clear');
await p.fill('#word','X'); await p.click('#addword'); await p.waitForTimeout(150);
ok('a one-letter word is left alone', (await readBracelet(p))==='X');

/* THE CASE THE NEW GUARD EXISTS FOR. The page already refused a word that
   would not fit — but it measured the word's LETTERS. Threading makes a word
   longer than its letters, so 36 beads + "ABC" reads as 39 and passes the old
   check while actually laying 41. That is the gap, and it is the only one
   worth a new message. */
await p.click('#clear');
await p.click('#thread');                            // off
for(let i=0;i<3;i++){ await p.fill('#word','ABCDEFGHIJKL'); await p.click('#addword'); }
await p.fill('#word','X'); await p.click('#addword'); // 37 beads, all letters
await p.click('#thread');                            // on
const before=await beadCount(p);
await p.fill('#word','ABC'); await p.click('#addword'); await p.waitForTimeout(150);
const n=await beadCount(p);
ok('threading cannot overflow the forty-bead string', n===before && n<=40, 'before='+before+' after='+n);
ok('and it says so instead of silently dropping beads',
   /forty beads is the string/.test(await p.textContent('#cerr')), await p.textContent('#cerr'));

// toggling back off restores plain letters
await p.click('#clear'); await p.click('#thread');
await p.fill('#word','OFF'); await p.click('#addword'); await p.waitForTimeout(150);
ok('turning it back off returns to plain letter beads', (await readBracelet(p))==='OFF');
ok('zero page errors', errs.length===0, errs.join(' | '));
await b.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
