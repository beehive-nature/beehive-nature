/* No browser required. These prove directory membership and search semantics;
   they do not stand in for a person's review of the rendered interface. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSearch, matchesSearch } = require('../surfaces/atlas-search.js');
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const estate = JSON.parse(read('estate.json'));
const html = read('surfaces/index.html');
const articles = [...html.matchAll(/<article class="srf"\s[^>]*>[\s\S]*?<\/article>/g)].map(m=>m[0]);
const escape = text => String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const match = (text, query, actualFamily='skaists', chosenFamily='') => matchesSearch({text, family:actualFamily},createSearch(query,chosenFamily));

test('empty search includes all published text; family is an exact independent filter', () => {
  assert.equal(match('Music studio',' \t\n'),true);
  assert.equal(match('Music studio','music','skaists','skaists'),true);
  assert.equal(match('Music studio skaists','music','beehivenature','skaists'),false);
});
test('all words must match; order, case and Latin accents are forgiving', () => {
  assert.equal(match('Mūzikas studija · SKAISTS','skaists muzikas'),true);
  assert.equal(match('Mūzikas studija · SKAISTS','skaists wallet'),false);
  assert.equal(match('Café gallery','cafe\u0301'),true);
});
test('non-Latin text stays searchable without transliterating its meaning', () => {
  for(const [text, query] of [['Художественная галерея','ГАЛЕРЕЯ'],['艺术画廊','艺术'],['معرض الفن','الفن'],['창작 음악','음악']]) assert.equal(match(text,query),true);
  assert.equal(match('معرض الفن','موسيقى'),false);
});
test('search input is literal, not a regular expression or HTML', () => {
  assert.equal(match('art (draft)','(draft)'),true);
  assert.equal(match('anything','.*'),false);
  assert.equal(match('artist','<script>'),false);
});
test('every presented registry row appears once as an ordinary HTML destination', () => {
  const presented = estate.surfaces.filter(s=>s.presented!==false);
  assert.equal(articles.length,presented.length);
  const hrefs = articles.map(a=>a.match(/class="surface-link" href="([^"]+)"/)[1]);
  assert.deepEqual(hrefs.toSorted(),presented.map(s=>escape(s.path.replace(/^surfaces\//,''))).toSorted());
  for (const row of presented) {
    const article = articles.find(a=>a.includes('href="'+escape(row.path.replace(/^surfaces\//,''))+'"'));
    assert.ok(article.includes('<dd>'+escape(row.id)+'</dd>'),row.id+' id');
    assert.ok(article.includes('<dd>'+escape(row.state)+'</dd>'),row.id+' state');
    assert.ok(article.includes('<dd>'+escape(row.home)+'</dd>'),row.id+' home');
    assert.ok(!article.includes('data-reg='),row.id+' must be shared by every view');
    assert.ok(existsSync(fileURLToPath(new URL('../'+row.path,import.meta.url))),row.id+' destination exists');
  }
});
test('named limits remain on the visible destination, not only inside evidence details', () => {
  const corpus=JSON.parse(read('surfaces/lang-corpus.json')).strings;
  for (const row of estate.surfaces.filter(s=>s.presented!==false&&s.limit)) {
    const article=articles.find(a=>a.includes('<dd>'+escape(row.id)+'</dd>'));
    const destination=article.split('</a><details')[0];
    assert.ok(destination.includes(escape(corpus[row.limitKey]?.en||row.limit)),row.id);
  }
});
test('the registry embedded in the page is canonical and has no per-view copies', () => {
  const embedded=html.split('<!--ESTATE-JSON-START-->')[1].split('<!--ESTATE-JSON-END-->')[0];
  assert.deepEqual(JSON.parse(embedded),estate);
  assert.equal((html.match(/id="estate"/g)||[]).length,1);
  assert.ok(html.includes('<b data-hero-number>'+estate.counts.surfaces+'</b>'));
});
test('the founder masthead is copied byte for byte, including its CSS block', () => {
  const doors=read('surfaces/doors/index.html').split('\n');
  const band=doors.map(l=>l.trim()).find(l=>l.startsWith('<div id="bandwrap"'));
  assert.ok(band&&html.includes(band));
  const start=doors.findIndex(l=>l.trim().startsWith('#bandwrap{'));
  const end=doors.findIndex(l=>l.includes('@keyframes hexdriftb'));
  assert.ok(html.includes(doors.slice(start,end+1).map(l=>'  '+l.trim()).join('\n')));
});
test('the collection is a native disclosure and all destinations survive without JS', () => {
  assert.match(html,/<body data-reg="bee" data-experience="home"[^>]*>/); /* [^>]*: the body may carry further build-baked attributes (bui Slice 1 data-state-root) - the check is the disclosure shape, not the attribute list */
  assert.match(html,/<details class="collection" id="collection"><summary>/);
  assert.equal((html.match(/data-register-host/g)||[]).length,1);
  const staticPart=html.split('<!--ATLAS-STATIC-START-->')[1].split('<!--ATLAS-STATIC-END-->')[0];
  assert.equal((staticPart.match(/class="surface-link"/g)||[]).length,articles.length);
  assert.match(html,/<noscript>/);
  assert.match(read('surfaces/atlas.css'),/prefers-reduced-motion:reduce/);
});
test('the three invitations use registered destinations and have clear language keys', () => {
  const starts=[...html.matchAll(/<a class="start-link [^>]*>[\s\S]*?<\/a>/g)].map(m=>m[0]);
  assert.equal(starts.length,3);
  for (const [i,id] of ['blight-gallery','blight-studio-music','buzz-directory'].entries()) {
    assert.ok(starts[i].includes('href="'+estate.surfaces.find(s=>s.id===id).path.replace(/^surfaces\//,'')+'"'));
  }
  for (const key of ['artAction','musicAction','peopleAction']) assert.ok(html.includes('data-i18n="atlas.'+key+'"'));
});
test('art snapshots contain no active or remote content and their served bytes match provenance', () => {
  const provenance=JSON.parse(read('surfaces/atlas-art/provenance.json'));
  for (const name of ['fungi','froggi','pepi']) {
    const svg=read('surfaces/atlas-art/'+name+'.svg');
    assert.match(svg,/<svg[\s>]/);
    assert.doesNotMatch(svg,/<script\b|<foreignObject\b|\son\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/)|url\(\s*["']?(?:https?:|\/\/)/i);
    const hash=createHash('sha256').update(svg).digest('hex');
    assert.ok(JSON.stringify(provenance).includes(hash),name+' served hash is recorded');
    if(/animation:|@keyframes/.test(svg)) assert.match(svg,/@media \(prefers-reduced-motion:reduce\)/);
  }
});
/* THE TREE OF LIFE PASS (2026-09-19). The hero is a picture of the registry:
   if a cell, a bough or a number ever disagrees with estate.json, it is a lie
   drawn beautifully — so the drawing is counted here, in all three readings. */
test('the tree of life carries exactly the registry — one cell per counted surface, in every reading', () => {
  const svgs=[...html.matchAll(/<svg class="estate-tree (et-\w+)"[\s\S]*?<\/svg>/g)];
  assert.deepEqual(svgs.map(m=>m[1]),['et-bee','et-raver','et-cypher']);
  for(const [svg,kind] of svgs){
    const boughs=[...svg.matchAll(/<g data-tree-family="([^"]+)" data-tree-count="(\d+)">([\s\S]*?)<\/g>/g)];
    assert.deepEqual(boughs.map(b=>b[1]).toSorted(),estate.families.toSorted(),kind+' names every family once');
    for(const [,family,count,body] of boughs){
      assert.equal(Number(count),estate.counts.byFamily[family]||0,kind+' '+family);
      if(kind!=='et-cypher') assert.equal((body.match(/class="et-cell (?!et-open)/g)||[]).length,Number(count),kind+' '+family+' cells');
      else assert.ok(body.includes('>'+family+'</text>')&&body.includes('>'+count+'</text>'),kind+' '+family+' is written out');
      if(Number(count)===0) assert.match(body,/et-open/,kind+' '+family+' is an open seat, never an invented cell');
    }
    assert.equal(boughs.reduce((n,b)=>n+Number(b[2]),0),estate.counts.surfaces,kind+' sums to the door number');
    assert.match(svg,/role="img" aria-labelledby="tree-caption"/);
    assert.doesNotMatch(svg,/<a[\s>]|<script\b|\son\w+=|href=/,kind+' is a picture, never a control');
  }
  const caption=html.match(/<figcaption id="tree-caption">[\s\S]*?<\/figcaption>/)?.[0]||'';
  assert.ok(caption.includes('<b>'+estate.counts.surfaces+'</b>'));
  for(const [org,n] of Object.entries(estate.counts.byOrg)) assert.ok(caption.includes(escape(org)+' <b>'+n+'</b>'),org+' is named in words beside its colour');
});
test('the keep rows promise only what their destinations say, and bGENEaLOGy stays a plain row until it is registered', () => {
  const corpus=JSON.parse(read('surfaces/lang-corpus.json')).strings;
  const keeps=[...html.matchAll(/<a class="keep-link [^>]*>[\s\S]*?<\/a>/g)].map(m=>m[0]);
  assert.equal(keeps.length,2);
  for(const [i,[id,action,help]] of [['bdata','bd.h1','bd.lead'],['watch','watch.title','watch.beeLead']].entries()){
    assert.ok(keeps[i].includes('href="'+estate.surfaces.find(s=>s.id===id).path.replace(/^surfaces\//,'')+'"'),id);
    for(const key of [action,help]) assert.ok(keeps[i].includes('data-i18n="'+key+'">'+escape(corpus[key].en)+'<'),id+' speaks with '+key);
  }
  const plain=html.match(/<div class="keep-plain line">[\s\S]*?<\/div><\/div>/)?.[0]||'';
  assert.ok(plain.includes('<strong class="bgene" translate="no" dir="ltr">b<b>GENE</b>a<b>LOG</b>y</strong>'),'the founder casing, exactly');
  assert.doesNotMatch(plain,/<a[\s>]|<button\b|disabled/,'not yet open is prose with its reason — never a dead link or a disabled button');
  assert.ok(plain.includes('data-i18n="hub.keep.line.state"'));
  assert.equal(estate.surfaces.some(s=>/genealogy/i.test(s.id+s.path)),false,'once registered, the builder refuses this row');
  const langs=['en',...JSON.parse(read('surfaces/lang-corpus.json'))._meta.langs];
  for(const key of Object.keys(corpus).filter(k=>k.startsWith('hub.keep.'))) for(const l of langs) assert.ok(corpus[key][l]?.trim(),key+'/'+l);
});
test('the house hand is same-origin, names only, and never forces case', () => {
  const css=read('surfaces/atlas.css');
  assert.match(css,/@font-face\{font-family:burti;src:url\(fonts\/burti\.woff2\) format\('woff2'\);font-display:swap\}/);
  assert.ok(existsSync(fileURLToPath(new URL('../surfaces/fonts/burti.woff2',import.meta.url))));
  assert.doesNotMatch(css,/text-transform\s*:\s*(?:uppercase|capitalize)/);
  assert.doesNotMatch(css,/url\(\s*["']?(?:https?:|\/\/)/);
  assert.match(html,/<a class="wordmark house" href="index\.html" translate="no" dir="ltr">skaists<span>\.dev<\/span><\/a>/);
});
