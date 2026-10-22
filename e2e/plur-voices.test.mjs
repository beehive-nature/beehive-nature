import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync('surfaces/plur.html','utf8'),manifest=JSON.parse(readFileSync('assets/plur-voices/manifest.json','utf8'));
const words=[...page.matchAll(/data-say="([^"]+)" data-lang="([^"]+)"/g)].map(m=>({say:m[1],lang:m[2]}));
const script=[...page.matchAll(/<script\b[^>]*>([^]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('window.bvoice={'));
function element(dataset={}){var classes=new Set();return {dataset:{...dataset},children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},addEventListener(){},replaceChildren(){this.children=[];},appendChild(x){this.children.push(x);},append(...xs){this.children.push(...xs);}};}
async function setup(native=[],preferred='',noEngine=false){
 const nodes=new Map(),cards=words.map(element),played=[],spoken=[];
 const synth={getVoices:()=>native,cancel(){},addEventListener(){},speak:u=>spoken.push(u)};
 const ctx={window:{speechSynthesis:noEngine?null:synth,addEventListener(){}},document:{querySelectorAll:()=>cards,getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:()=>element(),dispatchEvent(){}},localStorage:{getItem:()=>preferred,setItem(){}},SpeechSynthesisUtterance:function(t){this.text=t;},Audio:function(src){this.src=src;this.play=()=>{played.push(this);return Promise.resolve();};this.pause=()=>{};},CustomEvent:function(){},fetch:async()=>({ok:true,json:async()=>manifest})};
 vm.runInNewContext(script,ctx);await new Promise(resolve=>setImmediate(resolve));return {ctx,nodes,cards,played,spoken};
}
test('every actual word and offered language has a non-silent WAV preview',()=>{
 for(const w of words)assert.ok(manifest.entries.some(e=>e.lang===w.lang&&e.text===w.say));
 const offered=[...page.match(/var LANGS = \[([^]*?)\n  \];/)[1].matchAll(/\['([^']+)','/g)].map(m=>m[1]);
 for(const l of offered)assert.ok(manifest.entries.some(e=>e.lang===l&&e.kind==='sample'));
 for(const e of manifest.entries){const b=readFileSync('assets/plur-voices/'+e.file);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');let offset=12,data;while(offset+8<=b.length){const n=b.readUInt32LE(offset+4);if(b.toString('ascii',offset,offset+4)==='data'){data=b.subarray(offset+8,offset+8+n);break;}offset+=8+n+(n%2);}assert.ok(data?.length>4410,e.file);let peak=0;for(let i=0;i+1<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));assert.ok(peak>100,e.file);}
});
test('no browser speech engine still supports every fixed word without claiming arbitrary speech',async()=>{
 const {ctx,cards,played,nodes}=await setup([], '',true);assert.equal(cards.filter(w=>w.dataset.voiceSource==='synthetic').length,words.length);assert.equal(nodes.get('voiceCoverageRows').children.length,manifest.languages.length);assert.equal(ctx.window.bvoice.has('lv'),false);assert.equal(ctx.window.bvoice.has('lv','miers'),true);ctx.window.bvoice.speak('miers','lv');assert.equal(played.length,1);
});
test('English preference cannot override Latvian; voiceURI survives ordering changes',async()=>{
 const en={lang:'en-US',voiceURI:'english',name:'English'},lv={lang:'lv-LV',voiceURI:'latvian',name:'Latvian'};
 const {ctx,spoken}=await setup([lv,en],'english');ctx.window.bvoice.speak('fresh text','lv');assert.equal(spoken[0].voice.voiceURI,'latvian');assert.equal(ctx.window.bvoice.has('sa'),false);
});
test('cancelled preview cannot trigger the next greeting; unavailable text is reported',async()=>{
 const {ctx,played}=await setup([], '',true);let called=0;ctx.window.bvoice.speak('miers','lv',()=>called++);const ended=played[0].onended;ctx.window.bvoice.stop();ended();assert.equal(called,0);let result;ctx.window.bvoice.speak('not in catalog','sa',ok=>result=ok);assert.equal(result,false);
});
test('Sanskrit approximation and all synthetic assets remain marked for native review',()=>{
 for(const e of manifest.entries){assert.equal(e.review,'native review pending');if(e.lang==='sa'){assert.equal(e.voice,'hi');assert.match(e.note,/approximation/);}}
});
