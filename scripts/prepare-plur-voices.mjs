import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const page=readFileSync('surfaces/plur.html','utf8'),lang=readFileSync('surfaces/lang.js','utf8');
const words=[...page.matchAll(/data-say="([^"]+)" data-lang="([^"]+)"/g)].map(m=>({lang:m[2],text:m[1],kind:'word'}));
const block=page.match(/var LANGS = \[([^]*?)\n  \];/)[1];
const names=new Map([...block.matchAll(/\['([^']+)','([^']+)'\]/g)].map(m=>[m[1],m[2].split(' · ')[0]]));
for(const m of lang.matchAll(/\["([a-z]{2}(?:-[a-z]{2})?)","([^"]+)"/g))if(!names.has(m[1]))names.set(m[1],m[2]);
const ja={'平和':'へいわ','愛':'あい','統一':'とういつ','尊敬':'そんけい','日本語':'にほんご'};
const ar={'سلام':'سَلَام','حب':'حُبّ','وحدة':'وَحْدَة','احترام':'اِحْتِرَام','العربية':'اَلْعَرَبِيَّة'};
const entries=[...words,...[...names].map(([lang,text])=>({lang,text,kind:'sample'}))];
const unique=[...new Map(entries.map(x=>[x.lang+'|'+x.text,x])).values()];
for(const x of unique){x.id=createHash('sha256').update(x.lang+'|'+x.text).digest('hex').slice(0,16);x.file=x.id+'.wav';x.voice=({'zh-CN':'cmn',zh:'cmn','nl-be':'nl',sa:'hi'})[x.lang]||x.lang;x.input=x.lang==='ja'?(ja[x.text]||x.text):x.lang==='ar'?(ar[x.text]||x.text):x.text;x.review='native review pending';x.note=x.lang==='sa'?'Sanskrit approximation using Hindi synthesis; not a Sanskrit voice':x.lang==='nl-be'?'Dutch synthesis; Flemish accent not verified':'Synthetic pronunciation preview';}
writeFileSync('assets/plur-voices/manifest.json',JSON.stringify({engine:'eSpeak NG 1.52.0',source:'https://github.com/espeak-ng/espeak-ng',scope:'Fixed word cards and language samples, not arbitrary-text speech',languages:[...names.keys()].sort(),entries:unique},null,2)+'\n');
console.log(JSON.stringify({cards:words.length,languages:names.size,clips:unique.length}));
