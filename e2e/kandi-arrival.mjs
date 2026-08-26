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
const b=await chromium.launch();

// LoVis makes one for a stranger and shows it
const A=await b.newPage();
await A.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await A.waitForTimeout(400);
await A.fill('#word','PLUR'); await A.click('#addword');
await A.fill('#maker','LoVis'); await A.click('#stringit'); await A.waitForTimeout(250);
await A.click('#right .xrow button:nth-child(3)'); await A.waitForTimeout(250);
const ptr=await A.inputValue('#showout');
const url=(ptr.match(/http:\/\/\S+/)||[])[0];
await A.close();

// a stranger opens it, cold
const S=await b.newPage();
const errs=[]; S.on('pageerror',e=>errs.push(e.message.slice(0,110)));
await S.goto(url,{waitUntil:'load'}); await S.waitForTimeout(1200);
const a1=await S.evaluate(()=>{
  const box=document.getElementById('arrival');
  return {open:box.className.indexOf('open')>=0,
    text:(box.innerText||'').replace(/\s+/g,' ').trim().slice(0,150),
    piece:box.querySelectorAll('svg').length,
    keep:!!document.getElementById('arKeep'),
    back:!!document.getElementById('arBack'),
    stored:JSON.parse(localStorage.getItem('bkandi')).left.length};
});
ok('the arrival opens on the bracelet, not a form', a1.open && a1.piece>=1, JSON.stringify({open:a1.open,svg:a1.piece}));
ok('it names who made it', /made by LoVis/.test(a1.text), a1.text.slice(0,80));
ok('nothing is written to the stranger\'s arm before they say so', a1.stored===1, 'left='+a1.stored);
ok('one tap to keep it, one tap to answer', a1.keep && a1.back);
ok('zero page errors on arrival', errs.length===0, errs.join(' | '));

// "make one back" points the composer at the maker
await S.click('#arBack'); await S.waitForTimeout(300);
ok('"make one back" pre-aims the composer at the maker',
   (await S.inputValue('#madefor'))==='LoVis', await S.inputValue('#madefor'));

// keep it
await S.reload({waitUntil:'load'}); await S.waitForTimeout(1000);
await S.click('#arKeep'); await S.waitForTimeout(350);
const a2=await S.evaluate(()=>{
  const st=JSON.parse(localStorage.getItem('bkandi'));
  return {left:st.left.length, last:st.left[st.left.length-1],
    text:(document.getElementById('arrival').innerText||'').replace(/\s+/g,' ').slice(0,90),
    leftCards:document.querySelectorAll('#left .kc').length};
});
ok('keeping it puts it on the left arm, marked received',
   a2.left===2 && a2.last.rcv===true && a2.last.maker==='LoVis', JSON.stringify(a2.last));
ok('the arm repaints without a reload', a2.leftCards===2, 'cards='+a2.leftCards);
ok('the arrival turns into "it is yours"', /it is yours/i.test(a2.text), a2.text.slice(0,60));

// a mangled string is refused, and says so like a person
const M=await b.newPage();
await M.goto(`${BASE}/kandi.html#k=KND1%7Cx%7Cy%7C1%7CAB%7Czzzz`,{waitUntil:'load'});
await M.waitForTimeout(900);
const a3=await M.evaluate(()=>({open:document.getElementById('arrival').className.indexOf('open')>=0,
  text:(document.getElementById('arrival').innerText||'').replace(/\s+/g,' ').slice(0,120),
  stored:JSON.parse(localStorage.getItem('bkandi')).left.length}));
ok('a mangled kandi is refused in plain words, nothing stored',
   a3.open && /did not survive/i.test(a3.text) && a3.stored===1, a3.text.slice(0,80));

await b.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
