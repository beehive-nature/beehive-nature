import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir='assets/plur-voices/',raw=readFileSync(dir+'manifest.json'),m=JSON.parse(raw);
const hash=b=>createHash('sha256').update(b).digest('hex');
const page=readFileSync('surfaces/plur.html','utf8');
const cards=[...page.matchAll(/data-say="([^"]+)" data-lang="([^"]+)"/g)].map(x=>({text:x[1],lang:x[2]}));
const ids=new Set();
const entries=m.entries.map(e=>{
 assert.ok(!ids.has(e.id),'Duplicate audio ID: '+e.id);ids.add(e.id);
 assert.match(e.file,/^[a-f0-9]{16}\.wav$/);
 const b=readFileSync(dir+e.file);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
 let format,data;for(let o=12;o+8<=b.length;){const size=b.readUInt32LE(o+4);assert.ok(o+8+size<=b.length,'Truncated WAV');const type=b.toString('ascii',o,o+4);if(type==='fmt ')format=b.subarray(o+8,o+8+size);if(type==='data')data=b.subarray(o+8,o+8+size);o+=8+size+(size%2);}
 assert.ok(format&&data,'WAV chunks missing');assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(14),16);
 let peak=0;for(let i=0;i+1<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));assert.ok(peak>100,'Silent: '+e.id);
 const duration=data.length/format.readUInt32LE(8);assert.ok(duration>.1);assert.ok(Math.abs(duration-e.durationSeconds)<.002,'Stale duration: '+e.id);
 // A review must bind the exact audio AND text; a bare status string cannot promote it.
 const approved=e.review==='native reviewed'&&e.reviewEvidence?.audioSha256===hash(b)&&e.reviewEvidence?.text===e.text&&e.reviewEvidence?.reviewer&&e.reviewEvidence?.date&&e.reviewEvidence?.reference;
 return {id:e.id,lang:e.lang,kind:e.kind,text:e.text,synthesisInput:e.input,engineVoice:e.voice,file:e.file,'sha256_PUBLIC-CONSTANT':hash(b),bytes:b.length,durationSeconds:e.durationSeconds,mechanical:'decoded non-silent PCM',linguistic:approved?'native reviewed':'native review pending',reviewEvidence:approved?e.reviewEvidence:null,priority:['sa','nl-be','ja','ar'].includes(e.lang)?'approximation or transformed input':'unreviewed pronunciation'};
});
for(const c of cards)assert.ok(entries.some(e=>e.kind==='word'&&e.lang===c.lang&&e.text===c.text),'Missing card '+c.lang+' '+c.text);
for(const l of m.languages)assert.equal(entries.filter(e=>e.kind==='sample'&&e.lang===l).length,1,'Missing/duplicate sample '+l);
const report={schema:1,scope:'Published PLUR fixed previews; mechanical checks do not establish translation or pronunciation quality',engine:m.engine,'manifestSha256_PUBLIC-CONSTANT':hash(raw),counts:{wordCards:cards.length,languageLocaleSamples:m.languages.length,clips:entries.length,nativeReviewed:entries.filter(e=>e.linguistic==='native reviewed').length},reviewCriteria:['Meaning and context match PLUR intent','Dialect and script are correct','Pronunciation and stress are intelligible','Names and cultural terms are preserved','Reviewer evidence binds these exact audio bytes and text'],entries};
const out=JSON.stringify(report,null,2)+'\n',dest=dir+'quality.json';
if(process.argv.includes('--check'))assert.equal(readFileSync(dest,'utf8'),out,'Stale quality ledger; rebuild after changing text, manifest or audio');else writeFileSync(dest,out);
console.log(JSON.stringify(report.counts));
