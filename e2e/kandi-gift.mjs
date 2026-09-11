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
const mk=async(p,word,maker,madefor)=>{
  await p.fill('#word',word); await p.click('#addword');
  if(maker) await p.fill('#maker',maker);
  if(madefor) await p.fill('#madefor',madefor);
  await p.click('#stringit'); await p.waitForTimeout(200);
};
const st=p=>p.evaluate(()=>{const S=JSON.parse(localStorage.getItem('bkandi'));
  return {right:S.right.length,left:S.left.length,cross:(S.cross||[]).length,given:S.given.length,
    rightBeads:S.right.map(k=>k.beads), givenExp:(S.given[0]&&S.given[0].export)||'',
    rightFor:S.right.map(k=>k.madefor), makers:S.right.map(k=>k.maker)};});

// ── 1. repeated give of A from [A,B] cannot retire B
{
  const p=await b.newPage();
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await mk(p,'AAA','lovis','Sam');
  await mk(p,'BBB','lovis','Ari');
  const before=await st(p);
  ok('control: two dedicated pieces sit on the right arm', before.right===2 && before.rightBeads[0]==='AAA' && before.rightBeads[1]==='BBB',
     JSON.stringify(before.rightBeads));
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await p.waitForSelector('#giftout.open',{timeout:4000});
  const giftStr=await p.inputValue('#giftstr');
  await p.waitForTimeout(200);
  const mid=await st(p);
  ok('double-tap prepare still leaves both pieces on the arm', mid.right===2 && mid.given===0, JSON.stringify(mid));
  ok('the prepared export is A, not B', /\|AAA\|/.test(giftStr), giftStr.slice(0,40));
  await p.click('#finishgift'); await p.waitForTimeout(250);
  const after=await st(p);
  ok('completing A retires only A and keeps one memory', after.right===1 && after.rightBeads[0]==='BBB' && after.given===1,
     JSON.stringify(after));
  ok('the memory reconstructs the same export', after.givenExp===giftStr, after.givenExp.slice(0,28));
  ok('phase is locally completed, not copied-as-received',
     (await p.getAttribute('#giftphase','data-phase'))==='completed');
  await p.close();
}

// ── 2. cancel / stale timer / target change
{
  const p=await b.newPage();
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await mk(p,'AAA','lovis');
  await mk(p,'BBB','lovis');
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await p.waitForSelector('#giftout.open',{timeout:4000});
  await p.click('#donegift'); await p.waitForTimeout(150);
  const afterCancel=await st(p);
  ok('close before completion leaves both pieces on the arm', afterCancel.right===2 && afterCancel.given===0,
     JSON.stringify(afterCancel));
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await p.waitForSelector('#giftout.open',{timeout:4000});
  await p.click('#right .kc:nth-child(2) .xrow button:nth-child(1)');
  await p.waitForFunction(()=>/\|BBB\|/.test(document.getElementById('giftstr').value),null,{timeout:4000});
  const switched=await st(p);
  ok('starting a gift for B does not retire A', switched.right===2 && switched.given===0, JSON.stringify(switched));
  const expB=await p.inputValue('#giftstr');
  ok('the visible export followed the new target', /\|BBB\|/.test(expB), expB.slice(0,40));
  await p.click('#right .kc:nth-child(2) .xrow button:nth-child(2)'); // offer B — the prepared target — to the crossing
  await p.waitForTimeout(150);
  await p.click('#finishgift'); await p.waitForTimeout(200);
  const stale=await st(p);
  const gerr=await p.textContent('#gerr');
  ok('completing after the target left the arm refuses and does not retire the other piece',
     stale.right===1 && stale.rightBeads[0]==='AAA' && stale.cross===1 && stale.given===0 && /no longer on this arm/.test(gerr),
     JSON.stringify(stale)+' '+gerr);
  await p.close();
}

// ── 3. clipboard rejection keeps selectable export
{
  const p=await b.newPage();
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await mk(p,'COPY','lovis');
  await p.evaluate(()=>{
    navigator.clipboard.writeText=()=>Promise.reject(new Error('denied'));
    document.execCommand=()=>false;
  });
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await p.waitForSelector('#giftout.open',{timeout:4000});
  await p.click('#copygift'); await p.waitForTimeout(300);
  const phase=await p.getAttribute('#giftphase','data-phase');
  const gerr=await p.textContent('#gerr');
  const still=await st(p);
  ok('clipboard rejection is copy-needed, not completed', phase==='copy-needed', phase);
  ok('rejection wording does not claim they received it', /refused|yourself/i.test(gerr) && !/received/.test((gerr||'').toLowerCase().replace('not received','')),
     gerr);
  ok('rejection does not retire the piece', still.right===1 && still.given===0, JSON.stringify(still));
  ok('the export remains selectable', (await p.inputValue('#giftstr')).startsWith('KND1|'));
  await p.close();
}

// ── 4. blocked storage: no successful-save wording, input kept
{
  const p=await b.newPage();
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await p.fill('#word','HOLD'); await p.click('#addword');
  await p.fill('#maker','lovis');
  await p.evaluate(()=>{
    const orig=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){ if(k==='bkandi') throw new DOMException('quota','QuotaExceededError'); return orig.call(this,k,v); };
  });
  await p.click('#stringit'); await p.waitForTimeout(200);
  const cerr=await p.textContent('#cerr');
  const held=await p.evaluate(()=>{
    const S=JSON.parse(localStorage.getItem('bkandi'));
    return {right:S.right.length, maker:document.getElementById('maker').value,
      wordPreview:document.querySelector('#preview svg')?true:false};
  });
  ok('full storage does not claim the bracelet was saved', /would not save/.test(cerr) && !/saved|onto my right arm/i.test(cerr), cerr);
  ok('composer keeps the name and the beads', held.maker==='lovis' && held.wordPreview && held.right===0,
     JSON.stringify(held));
  await p.close();
}

// ── 5. gift completion storage failure leaves the piece
{
  const p=await b.newPage();
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await mk(p,'KEEP','lovis');
  await p.evaluate(()=>{
    const orig=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){ if(k==='bkandi') throw new DOMException('quota','QuotaExceededError'); return orig.call(this,k,v); };
  });
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await p.waitForSelector('#giftout.open',{timeout:4000});
  const exp=await p.inputValue('#giftstr');
  await p.click('#finishgift'); await p.waitForTimeout(200);
  const after=await st(p);
  const gerr=await p.textContent('#gerr');
  ok('a failed complete does not retire and does not keep a false memory', after.right===1 && after.given===0,
     JSON.stringify(after));
  ok('export stays visible after a failed save', exp.startsWith('KND1|') && /would not save/.test(gerr), gerr);
  await p.close();
}

// ── 6. receive: preview, keep, duplicate, malformed
{
  const A=await b.newPage();
  await A.emulateMedia({reducedMotion:'reduce'});
  await A.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await A.waitForTimeout(400);
  await mk(A,'PLUR','LoVis','Sam');
  await A.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await A.waitForSelector('#giftout.open',{timeout:4000});
  const giftStr=await A.inputValue('#giftstr');
  await A.click('#finishgift');
  const B2=await b.newPage();
  await B2.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await B2.waitForTimeout(400);
  await B2.fill('#rcv','KND1|x|y|1|AB|zzzz');
  await B2.click('#rcvgo'); await B2.waitForTimeout(150);
  ok('malformed paste is refused and does not open keep',
     /refused/.test(await B2.textContent('#rerr')) && !(await B2.locator('#rcvprev.open').count()),
     await B2.textContent('#rerr'));
  await B2.fill('#rcv',giftStr);
  await B2.click('#rcvgo'); await B2.waitForTimeout(200);
  const prev=await B2.evaluate(()=>({
    open:document.getElementById('rcvprev').className.includes('open'),
    left:JSON.parse(localStorage.getItem('bkandi')).left.length,
    box:document.getElementById('rcv').value
  }));
  ok('receive is preview-first', prev.open && prev.left===1 && prev.box===giftStr, JSON.stringify(prev));
  await B2.click('#rcvkeep'); await B2.waitForTimeout(200);
  const kept=await B2.evaluate(()=>{
    const S=JSON.parse(localStorage.getItem('bkandi'));
    const last=S.left[S.left.length-1];
    return {left:S.left.length,rcv:last.rcv,maker:last.maker,
      giftBtns:[...document.querySelectorAll('#left button')].filter(x=>/gift|cross it|offer/i.test(x.textContent)).length};
  });
  ok('keep lands left, received, never re-trades', kept.left===2 && kept.rcv===true && kept.maker==='LoVis' && kept.giftBtns===0,
     JSON.stringify(kept));
  await B2.fill('#rcv',giftStr);
  await B2.click('#rcvgo'); await B2.click('#rcvkeep'); await B2.waitForTimeout(200);
  const dup=await B2.evaluate(()=>{
    const S=JSON.parse(localStorage.getItem('bkandi'));
    return {left:S.left.length, msg:document.getElementById('rerr').textContent, box:document.getElementById('rcv').value};
  });
  ok('the same payload is idempotent', dup.left===2 && /already/.test(dup.msg), JSON.stringify(dup));
  await A.close(); await B2.close();
}

// ── 7. stale-tab writes: merge safely, refuse garbage
{
  const p=await b.newPage();
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await mk(p,'AAA','lovis');
  await p.evaluate(()=>{
    const S=JSON.parse(localStorage.getItem('bkandi'));
    S.right.push({maker:'other',madefor:'',beads:'BBB',ts:99});
    localStorage.setItem('bkandi',JSON.stringify(S));
  });
  await mk(p,'CCC','lovis');
  const merged=await p.evaluate(()=>{
    const S=JSON.parse(localStorage.getItem('bkandi'));
    return S.right.map(k=>k.beads).slice().sort();
  });
  ok('a missed event reads the latest committed arms before writing',
     merged.join(',')==='AAA,BBB,CCC', merged.join(','));
  await p.evaluate(()=>localStorage.setItem('bkandi','%%%not-json%%%'));
  await p.fill('#word','DDD'); await p.click('#addword'); await p.fill('#maker','lovis');
  await p.click('#stringit'); await p.waitForTimeout(200);
  const refused=await p.evaluate(()=>({
    raw:localStorage.getItem('bkandi'),
    maker:document.getElementById('maker').value,
    err:document.getElementById('cerr').textContent+' '+document.getElementById('armerr').textContent
  }));
  ok('unreadable other-tab arms are refused, not overwritten',
     refused.raw==='%%%not-json%%%' && refused.maker==='lovis' && /cannot read|would not save|overwrite/i.test(refused.err),
     JSON.stringify(refused));
  await p.close();
}

// ── 8. Unicode names stay; bead leftovers are explained
{
  const p=await b.newPage();
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await p.fill('#word','Jānis'); await p.click('#addword'); await p.waitForTimeout(150);
  const beadErr=await p.textContent('#cerr');
  const word=await p.inputValue('#word');
  ok('unsupported bead letters are named before the word is lost',
     /cannot be beads/.test(beadErr) && /ā/.test(beadErr) && word==='Jānis', beadErr+' / '+word);
  await p.fill('#word','PLUR'); await p.click('#addword');
  await p.fill('#maker','Jānis'); await p.fill('#madefor','Анна');
  await p.click('#stringit'); await p.waitForTimeout(200);
  const named=await p.evaluate(()=>{
    const S=JSON.parse(localStorage.getItem('bkandi'));
    const k=S.right[0];
    return {maker:k.maker,for:k.madefor,beads:k.beads};
  });
  ok('Unicode names are kept without transliteration',
     named.maker==='Jānis' && named.for==='Анна' && named.beads==='PLUR', JSON.stringify(named));
  await p.close();
}

// ── 9. Show is a preview; view toggle keeps the prepared gift
{
  const p=await b.newPage();
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await mk(p,'SHOW','LoVis');
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(3)');
  const ptr=await p.inputValue('#showout');
  const hint=await p.textContent('#shownote');
  ok('show still emits a fragment pointer', /kandi\.html#k=/.test(ptr) && !/\?k=/.test(ptr), ptr.slice(0,80));
  ok('show names itself a preview, not exclusive title', /preview/i.test(hint), hint);
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await p.waitForSelector('#giftout.open',{timeout:4000});
  await p.evaluate(()=>localStorage.setItem('bregister','cypherpunk'));
  await p.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'bregister'})));
  await p.waitForTimeout(200);
  const kept=await p.evaluate(()=>({
    open:document.getElementById('giftout').className.includes('open'),
    exp:document.getElementById('giftstr').value,
    right:JSON.parse(localStorage.getItem('bkandi')).right.length,
    reg:document.body.getAttribute('data-reg')
  }));
  ok('view toggle preserves the prepared export and does not retire it',
     kept.open && /^KND1\|/.test(kept.exp) && kept.right===1, JSON.stringify(kept));
  const labels=await p.evaluate(()=>[...document.querySelectorAll('#giftphase[data-phase="prepared"] [data-reg]')]
    .filter(el=>el.offsetParent!==null).map(el=>el.getAttribute('data-reg')));
  ok('only the active view\'s prepared label is painted', labels.length===1 && labels[0]==='cypherpunk',
     JSON.stringify(labels));
  await p.close();
}

// ── 10. pipe in a name is refused, not stripped
{
  const p=await b.newPage();
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await p.fill('#word','PLUR'); await p.click('#addword');
  await p.fill('#maker','Ann|a');
  await p.click('#stringit'); await p.waitForTimeout(200);
  const pipe=await p.evaluate(()=>({
    maker:document.getElementById('maker').value,
    err:document.getElementById('cerr').textContent,
    right:JSON.parse(localStorage.getItem('bkandi')).right.length
  }));
  ok('a | in a name is refused visibly and not saved as a silent strip',
     pipe.maker==='Ann|a' && pipe.right===0 && /\|/.test(pipe.err) && /refused|not stripped/i.test(pipe.err),
     JSON.stringify(pipe));
  await p.close();
}

// ── 11. real 650ms timers: delayed cancel, delayed switch, leftover finish
{
  const p=await b.newPage();
  await p.goto(`${BASE}/kandi.html`,{waitUntil:'load'}); await p.waitForTimeout(400);
  await mk(p,'AAA','lovis');
  await mk(p,'BBB','lovis');
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await p.evaluate(()=>document.getElementById('finishgift').click());
  await p.waitForTimeout(150);
  const early=await p.evaluate(()=>({
    right:JSON.parse(localStorage.getItem('bkandi')).right.length,
    given:JSON.parse(localStorage.getItem('bkandi')).given.length,
    err:document.getElementById('gerr').textContent,
    open:document.getElementById('giftout').classList.contains('open')
  }));
  ok('finish during the handshake is refused and does not retire',
     early.right===2 && early.given===0 && !early.open && /preparing/.test(early.err), JSON.stringify(early));
  await p.evaluate(()=>document.getElementById('donegift').click());
  await p.waitForTimeout(2800);
  const afterCancel=await st(p);
  const lateErr=await p.textContent('#gerr');
  ok('a leftover 650ms timer after cancel does not retire or claim a stale complete',
     afterCancel.right===2 && afterCancel.given===0 && !/stale gift was not completed/.test(lateErr||''),
     JSON.stringify(afterCancel)+' '+lateErr);
  await p.click('#right .kc:nth-child(1) .xrow button:nth-child(1)');
  await p.waitForTimeout(800);
  await p.click('#right .kc:nth-child(2) .xrow button:nth-child(1)');
  await p.waitForFunction(()=>/\|BBB\|/.test(document.getElementById('giftstr').value),null,{timeout:5000});
  const switched=await st(p);
  ok('a delayed target switch under 650ms timers leaves both pieces on the arm',
     switched.right===2 && switched.given===0 && /\|BBB\|/.test(await p.inputValue('#giftstr')),
     JSON.stringify(switched));
  await p.close();
}

await b.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
