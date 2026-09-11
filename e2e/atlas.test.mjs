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
  assert.match(html,/<body data-reg="bee" data-experience="home">/);
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
