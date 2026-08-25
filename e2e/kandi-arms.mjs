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

// ── 1. the reported bug: make one FOR someone, expect it on the RIGHT arm
{
  const p=await b.newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR '+e.message.slice(0,120)));
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await p.fill('#word','SAM'); await p.click('#addword');
  await p.fill('#maker','lovis'); await p.fill('#madefor','Sam');
  await p.click('#stringit'); await p.waitForTimeout(300);
  const st=await p.evaluate(()=>{
    const S=JSON.parse(localStorage.getItem('bkandi'));
    return {right:S.right.length,left:S.left.length,
      rightFor:S.right.map(k=>k.madefor),
      giftBtns:document.querySelectorAll('#right button').length,
      tag:(document.querySelector('#right .tag')||{}).textContent};
  });
  ok('a kandi made FOR someone lands on the RIGHT arm', st.right===1 && st.rightFor[0]==='Sam',
     `right=${st.right} left=${st.left} for=${JSON.stringify(st.rightFor)}`);
  ok('it carries a gift button (it can actually be delivered)', st.giftBtns>=1, `buttons=${st.giftBtns}`);
  ok('it is tagged as spoken for, not generic trade stock', /for Sam/.test(st.tag||''), `tag=${st.tag}`);

  // gift it, and receive it in a second browser — it must land LEFT, never re-trading
  await p.click('#right button'); await p.waitForTimeout(3200);
  const giftStr=await p.inputValue('#giftstr');
  const after=await p.evaluate(()=>{const S=JSON.parse(localStorage.getItem('bkandi'));return {right:S.right.length,given:S.given.length};});
  ok('gifting removes it from your arm and keeps the memory line', after.right===0 && after.given===1,
     `right=${after.right} given=${after.given}`);
  ok('the gift string encodes', /^KND1\|/.test(giftStr), giftStr.slice(0,24));
  await p.close();

  const p2=await b.newPage();
  await p2.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p2.waitForTimeout(400);
  await p2.fill('#rcv',giftStr); await p2.click('#rcvgo'); await p2.waitForTimeout(300);
  const rec=await p2.evaluate(()=>{
    const S=JSON.parse(localStorage.getItem('bkandi'));
    return {left:S.left.length,right:S.right.length,
      lastRcv:S.left[S.left.length-1].rcv, lastFor:S.left[S.left.length-1].madefor,
      leftGiftBtns:document.querySelectorAll('#left button').length};
  });
  ok('the RECEIVED copy lands on the left arm, marked received', rec.lastRcv===true && rec.lastFor==='Sam',
     `rcv=${rec.lastRcv} for=${rec.lastFor}`);
  ok('the received copy has NO gift button — it never re-trades', rec.leftGiftBtns===0, `buttons=${rec.leftGiftBtns}`);
  await p2.close();
}

// ── 2. the migration: a stranded piece from the old bug is rescued
{
  const p=await b.newPage();
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'});
  await p.evaluate(()=>{ localStorage.setItem('bkandi',JSON.stringify({v:1,right:[],
    left:[{maker:'the PLUR mUseUm',madefor:'you',beads:'0P1L2U3R',ts:1,rcv:true},
          {maker:'lovis',madefor:'Ari',beads:'1A2R3I',ts:2,rcv:false}],given:[]})); });
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(500);
  const m=await p.evaluate(()=>{
    const S=JSON.parse(localStorage.getItem('bkandi'));
    return {right:S.right.map(k=>k.madefor), left:S.left.map(k=>k.madefor),
      note:(document.getElementById('rescuenote')||{}).textContent||'',
      noteShown:(document.getElementById('rescuenote')||{}).style.display};
  });
  ok('a piece stranded by the old bug moves to the right arm', m.right.length===1 && m.right[0]==='Ari',
     `right=${JSON.stringify(m.right)}`);
  ok("genuinely received kandi is NOT moved", m.left.length===1 && m.left[0]==='you',
     `left=${JSON.stringify(m.left)}`);
  ok('the move is announced, not silent', m.noteShown==='block' && /right arm now/.test(m.note), m.note.slice(0,70));
  await p.close();
}

// ── 3. control: a piece with no recipient still behaves
{
  const p=await b.newPage();
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(300);
  await p.fill('#word','PLUR'); await p.click('#addword');
  await p.click('#stringit'); await p.waitForTimeout(300);
  const st=await p.evaluate(()=>{const S=JSON.parse(localStorage.getItem('bkandi'));
    return {right:S.right.length,tag:(document.querySelector('#right .tag')||{}).textContent};});
  ok('an undedicated piece is still plain tradeable on the right arm', st.right===1 && st.tag==='tradeable',
     `right=${st.right} tag=${st.tag}`);
  await p.close();
}
await b.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
