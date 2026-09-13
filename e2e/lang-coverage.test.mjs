/* Exercise the shipped counter and renderer at a DOM boundary. The browser CI
   selftest separately checks real layout for every corpus-docked language. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {inspectCoverage,validatePageSet} from './coverage-gate.mjs';
const {measureVisibleText,summarizeCoverage}=createRequire(import.meta.url)('../surfaces/lang.js');
const source=readFileSync(new URL('../surfaces/lang.js',import.meta.url),'utf8');
const corpus=JSON.parse(readFileSync(new URL('../surfaces/lang-corpus.json',import.meta.url),'utf8'));

function leaf(text,{key=null,keyAttr='data-i18n',holder=null,chrome=false,tag='P',children=[],box={width:10,height:10}}={}) {
  const element={tagName:tag,children,dataset:key===null?{}:{i18n:key},
    textContent:text,get innerHTML(){return this.textContent;},set innerHTML(v){this.textContent=v;},
    closest(selector){return selector==='[data-i18n]'||selector==='[data-i18n],[data-key]'
      ?(key===null?holder:element):(chrome?{}:null);},
    getAttribute(name){return name===keyAttr?key:null;},
    hasAttribute(name){return name===keyAttr&&key!==null;},getBoundingClientRect(){return box;}};
  return element;
}
const doc=nodes=>({querySelectorAll:()=>nodes});

test('short labels in every docked language, astral and decomposed letters count',()=>{
  const examples={en:'I',ru:'Я',lv:'Ā',th:'ก',gd:'À',tt:'Ә',uk:'Ї',cs:'Č',zh:'中',ko:'말',ar:'ع',
    'nl-be':'Ja',es:'Sí',nl:'Ja',de:'Ö',fr:'À',he:'ב',hi:'क',bn:'ক',fa:'ژ',ur:'ژ',ja:'字',
    da:'Å',nb:'Ø',sv:'Ö',fi:'Ö',tr:'İ',hu:'Ő',sa:'क'};
  assert.deepEqual(Object.keys(examples).sort(),['en',...corpus._meta.langs].sort());
  const letters=[...Object.values(examples),'𐐀','e\u0301'];
  const nodes=letters.flatMap((text,i)=>[leaf(text,{key:'label.'+i}),leaf(text)]);
  const result=measureVisibleText(doc(nodes));
  assert.equal(result.visible,62);
  assert.equal(result.keyed,31);
  assert.equal(result.keys.length,31);
  assert.equal(result.unkeyedSamples.length,3);
  // The browser CLI serializes this exact function; it must have no closure dependency.
  const serialized=vm.runInNewContext('('+measureVisibleText.toString()+')(document)',{document:doc(nodes)});
  assert.deepEqual(JSON.parse(JSON.stringify(serialized)),result);
});

test('non-letter text, chrome, drawing tags, non-leaves and empty boxes stay out',()=>{
  const nodes=['123','١٢٣','— · !','🐝',' \n ','\u0301'].map(t=>leaf(t));
  nodes.push(leaf('menu',{chrome:true}),leaf('drawn',{tag:'CANVAS'}),
    leaf('parent',{children:[{}]}),leaf('hidden',{box:{width:0,height:0}}),leaf('A',{key:'a'}));
  assert.deepEqual(measureVisibleText(doc(nodes)),{visible:1,keyed:1,keys:['a'],unkeyedSamples:[]});
});

test('rich siblings retain key occurrences and the nearest holder decides coverage',()=>{
  const outer=leaf('',{key:'outer'}),inner=leaf('',{key:'inner'});
  const measured=measureVisibleText(doc([leaf('A',{holder:outer}),leaf('B',{holder:outer}),leaf('C',{holder:inner})]));
  assert.deepEqual(measured.keys,['outer','outer','inner']);
  const counts=summarizeCoverage(measured,{outer:{ru:'Да'}},'ru');
  assert.equal(counts.filled,2);
  assert.equal(counts.missingKey,1);
});

test('missing keys and blank or invalid cells are distinct from unkeyed text',()=>{
  const keys=['valid','blank','space','number','missingLanguage','absent'];
  const measured=measureVisibleText(doc([...keys.map(key=>leaf('Source',{key})),leaf('Unkeyed')]));
  const strings={valid:{ru:'Да'},blank:{ru:''},space:{ru:' \n '},number:{ru:42},missingLanguage:{lv:'Jā'}};
  const counts=summarizeCoverage(measured,strings,'ru');
  assert.deepEqual([counts.visible,counts.keyed,counts.filled,counts.unkeyed,counts.emptyCell,counts.missingKey],[7,6,1,1,4,1]);
  assert.equal(counts.visible,counts.keyed+counts.unkeyed);
  assert.equal(counts.keyed,counts.filled+counts.emptyCell+counts.missingKey);
  assert.deepEqual(counts.emptySamples,['blank','space','number']);
  const english=summarizeCoverage(measured,null,'en');
  assert.equal(english.filled,6);
  assert.equal(english.missingKey,0);
});

test('the data-key twin counts only holders the corpus actually filled',()=>{
  /* plur-style reserved keys: a data-key holder with a row is keyed and fills;
     a reserved-but-never-filled row stays honestly unkeyed — no green paint
     for a page no tongue can reach (surface polish lane, 2026-09-13). */
  const strings={filled:{ru:'Да'}};
  const measured=measureVisibleText(doc([
    leaf('A',{key:'filled',keyAttr:'data-key'}),
    leaf('B',{key:'reserved',keyAttr:'data-key'}),
    leaf('C',{key:'plain'})
  ]),strings);
  assert.deepEqual(measured.keys,['filled','plain']);
  const counts=summarizeCoverage(measured,strings,'ru');
  assert.equal(counts.visible,3);
  assert.equal(counts.keyed,2);
  assert.equal(counts.filled,1);
  assert.equal(counts.unkeyed,1);
});

test('browser exports exist even when the picker is already mounted',()=>{
  const context={document:{getElementById:()=>({})}};context.window=context;
  vm.runInNewContext(source,context);
  assert.equal(typeof context.BNRLanguageCoverage.measureVisibleText,'function');
  assert.equal(typeof context.BNRLanguageCoverage.summarizeCoverage,'function');
});

async function render(strings, bundle) {
  const nodes=Object.keys(strings).map(key=>leaf('Source '+key,{key}));
  const ids=new Map();
  function element(){
    const el={style:{},appendChild(){},setAttribute(){},addEventListener(){},querySelector(){return null;}};
    Object.defineProperty(el,'id',{set(id){ids.set(id,el);}});return el;
  }
  const document={readyState:'complete',body:element(),documentElement:{},
    querySelector:()=>null,getElementById:id=>ids.get(id),createElement:element,dispatchEvent(){},addEventListener(){},
    querySelectorAll:selector=>selector==='[data-i18n]'||selector==='[data-i18n],[data-key]'||selector==='body *'?nodes:[]};
  if(bundle!==undefined)ids.set('bnr-language-bundle',{textContent:bundle});
  let fetches=0;
  const context={document,location:{pathname:'/surfaces/'},localStorage:{getItem:()=> 'ru'},
    fetch:async()=>{fetches++;return {json:async()=>({strings,_meta:{}})};},addEventListener(){},CustomEvent:class{}};
  context.window=context;vm.runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {nodes,note:ids.get('blangnote'),fetches};
}

test('the actual renderer preserves English for whitespace and non-string cells',async()=>{
  const {nodes,note}=await render({valid:{ru:'Я'},blank:{ru:' \n '},invalid:{ru:7},missing:{}});
  assert.deepEqual(nodes.map(n=>n.textContent),['Я','Source blank','Source invalid','Source missing']);
  assert.equal(note.textContent,'⚙ 1/4');
  assert.match(note.title,/3 empty translations/);
});

test('bundled corpus renders without a fetch and keeps draft attribution',async()=>{
  const {nodes,note,fetches}=await render({valid:{}},JSON.stringify({_meta:{},strings:{valid:{ru:'Привет'}}}));
  assert.equal(nodes[0].textContent,'Привет');
  assert.equal(fetches,0);
  assert.equal(note.textContent,'⚙ 1/1');
});

test('bundled withdrawn translations retain the English fallback',async()=>{
  const {nodes,note,fetches}=await render({valid:{}},JSON.stringify({_meta:{withdrawn:{ru:{}}},strings:{valid:{ru:'Привет'}}}));
  assert.equal(nodes[0].textContent,'Source valid');
  assert.equal(fetches,0);
  assert.equal(note.textContent,'⚙ 0/1');
});

test('malformed language bundle uses the normal corpus loader',async()=>{
  const {nodes,fetches}=await render({valid:{ru:'Привет'}},'{broken');
  assert.equal(nodes[0].textContent,'Привет');
  assert.equal(fetches,1);
});

test('empty, malformed and duplicate requested page sets fail instead of disappearing',()=>{
  for(const invalid of [null,{},[],[''],['   '],[42],['a.html','a.html'],
    ['./a.html'],['x/../a.html'],['/a.html'],['a.html?view=1'],['a.html '],['x\\a.html']])
    assert.throws(()=>validatePageSet(invalid));
  assert.deepEqual(validatePageSet(['index.html','hardware/lab.html']),['index.html','hardware/lab.html']);
});

test('missing observations, invalid floors and floor breaches fail before formatting',()=>{
  const good={page:'index.html',visible:10,keyed:4};
  assert.equal(inspectCoverage([good],{'index.html':4},true).passed,true);
  for(const rows of [[],[good,{page:'missing.html',error:'Requested surface does not exist'}],
    [{...good,keyed:11}],[{...good,visible:NaN}]])
    assert.equal(inspectCoverage(rows).passed,false);
  for(const floor of [null,[],{'index.html':-1},{'index.html':'4'}])
    assert.equal(inspectCoverage([good],floor,true).passed,false);
  const gate=inspectCoverage([good],{'index.html':5},true);
  assert.deepEqual(gate.breaches,[{page:'index.html',keyed:4,floor:5}]);
  // JSON is a representation of the same failed gate, not an alternative gate.
  assert.equal(JSON.parse(JSON.stringify({rows:[good],gate})).gate.passed,false);
});

test('the arrival set contains current surfaces and retains every recorded floor',()=>{
  const pages=validatePageSet(JSON.parse(readFileSync(new URL('./lang-coverage-set.json',import.meta.url),'utf8')));
  const floors=JSON.parse(readFileSync(new URL('./lang-coverage-floors.json',import.meta.url),'utf8'));
  for(const page of pages) assert.ok(existsSync(new URL('../surfaces/'+page,import.meta.url)),page+' must exist');
  for(const page of Object.keys(floors)) assert.ok(pages.includes(page),page+' floor must remain measured');
});
