import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SURF=join(ROOT,'surfaces');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
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
const b=await chromium.launch();
const mk=async(p,word,maker)=>{ await p.fill('#word',word); await p.click('#addword');
  await p.fill('#maker',maker); await p.click('#stringit'); await p.waitForTimeout(200); };
const st=p=>p.evaluate(()=>{const S=JSON.parse(localStorage.getItem('bkandi'));
  return {right:S.right.length,left:S.left.length,cross:(S.cross||[]).length,given:S.given.length,
    lastLeft:S.left[S.left.length-1]||null, lastGiven:S.given[S.given.length-1]||null};});

// ── A · offer to the crossing, and take it back
const A=await b.newPage(); A.on('pageerror',e=>console.log('  PAGEERROR '+e.message.slice(0,110)));
await A.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await A.waitForTimeout(400);
await mk(A,'GOLD','lovis');
ok('a new piece starts on the right arm',(await st(A)).right===1);
await A.click('#right .xrow button:nth-child(2)'); await A.waitForTimeout(250);
let s1=await st(A);
ok('offering moves it to the crossing, off the right arm', s1.cross===1&&s1.right===0, JSON.stringify(s1));
await A.click('#cross .xrow button:nth-child(2)'); await A.waitForTimeout(250);
s1=await st(A);
ok('taking it back returns it to the right arm', s1.cross===0&&s1.right===1, JSON.stringify(s1));
await A.click('#right .xrow button:nth-child(2)'); await A.waitForTimeout(250);

// ── B · the other artist makes theirs
const B2=await b.newPage();
await B2.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await B2.waitForTimeout(400);
await mk(B2,'SILVER','ari');
await B2.click('#right .xrow button:nth-child(2)'); await B2.waitForTimeout(250);
await B2.click('#cross .xrow button:nth-child(1)'); await B2.waitForTimeout(250);
const bStr=await B2.inputValue('#xmine');
ok('the crossing panel shows your own string to hand over', /^KND1\|ari\|/.test(bStr), bStr.slice(0,26));

// ── C · A crosses with B's piece
await A.click('#cross .xrow button:nth-child(1)'); await A.waitForTimeout(250);
const aStr=await A.inputValue('#xmine');
await A.fill('#xtheirs', aStr);
await A.click('#xdo'); await A.waitForTimeout(250);
ok('crossing with your OWN string is refused', /two hands/.test(await A.textContent('#xerr')),
   await A.textContent('#xerr'));
await A.fill('#xtheirs','KND1|x|y|1|AB|zzzz');
await A.click('#xdo'); await A.waitForTimeout(250);
ok('a tampered string is refused by checksum', /refused/.test(await A.textContent('#xerr')),
   await A.textContent('#xerr'));
await A.fill('#xtheirs', bStr);
await A.click('#xdo'); await A.waitForTimeout(350);
const sA=await st(A);
ok('the crossing completes: mine leaves the crossing', sA.cross===0, JSON.stringify(sA));
ok('theirs lands on my LEFT arm, received and eternal',
   sA.lastLeft && sA.lastLeft.maker==='ari' && sA.lastLeft.rcv===true && sA.lastLeft.crossed===true,
   JSON.stringify(sA.lastLeft));
ok('my piece retires to the memory line, marked crossed',
   sA.lastGiven && sA.lastGiven.crossed===true && sA.lastGiven.to==='ari', JSON.stringify(sA.lastGiven));
const leftBtns=await A.evaluate(()=>document.querySelectorAll('#left .xrow button').length);
const leftGift=await A.evaluate(()=>[...document.querySelectorAll('#left .xrow button')].some(x=>/gift|cross it/.test(x.textContent)));
ok('what I received can never be gifted or re-crossed', leftBtns>0 && !leftGift, `buttons=${leftBtns} hasTrade=${leftGift}`);

// ── D · show and tell emits a POINTER, and the link opens ready to receive
await A.click('#left .xrow button'); await A.waitForTimeout(250);
const ptr=await A.inputValue('#showout');
ok('show it emits a [bX kandi] pointer in the estate grammar', /^\[bX kandi\]/.test(ptr), ptr.slice(0,60));
ok('the pointer carries a link, not the bracelet itself', /kandi\.html\?k=/.test(ptr) && ptr.length<300, String(ptr.length));
const url=(ptr.match(/https?:\/\/\S+/)||[])[0];
const C=await b.newPage();
await C.goto(url,{waitUntil:'load'}); await C.waitForTimeout(600);
const pre=await C.inputValue('#rcv');
ok('opening the pointer pre-loads the piece but does NOT auto-take it',
   /^KND1\|/.test(pre) && (await st(C)).left===1, `rcv=${pre.slice(0,18)}`);
await C.click('#rcvgo'); await C.waitForTimeout(250);
ok('pressing receive takes it onto the left arm', (await st(C)).left===2);

await b.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
