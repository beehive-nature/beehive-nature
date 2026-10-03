import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const registry=JSON.parse(readFileSync(resolve(root,'estate.json'),'utf8')).surfaces;
const tracked=execFileSync('git',['ls-files','-z','surfaces/*.html'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const paths=[...new Set([...tracked,...registry.map(s=>s.path)])].sort();
const source=p=>`<a href="https://github.com/beehive-nature/beehive-nature/blob/main/${esc(p)}" target="_blank" rel="noopener noreferrer">${esc(p)} ↗</a>`;
const rows=paths.map(path=>{
 if(!existsSync(resolve(root,path)))throw Error('Missing surface '+path);
 const text=readFileSync(resolve(root,path),'utf8');
 const reg=registry.find(s=>s.path===path);
 const name=reg?.id||path.replace(/^surfaces\//,'').replace(/\.html$/,'');
 // Only executable script tags are dependencies. Text mentions are not integrations.
 const scripts=[...text.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
 const deps=[...new Set(scripts)].map(src=>{
  if(/^(?:https?:)?\/\//.test(src))return `<span>${esc(src)} (external script reference)</span>`;
  const file=src.split(/[?#]/)[0];
  const p=relative(root,file.startsWith('/')?resolve(root,'.'+file):resolve(root,dirname(path),file)).replace(/\\/g,'/');
  return existsSync(resolve(root,p))?source(p):`<span>${esc(src)} — unresolved local reference</span>`;
 });
 const inline=/<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(text);
 const evidence=deps.length?`${deps.length} direct script references${inline?'; inline code also present':''}`:inline?'Inline code; no direct script references':'No direct script references';
 return `<tr data-surface="${esc(path)}" data-search="${esc([path,name,reg?.gloss||'',...scripts].join(' ').toLowerCase())}"><td><a href="${esc(path.replace(/^surfaces\//,''))}">${esc(name)}</a><small>${esc(reg?.gloss||'Tracked page; not yet in estate registry')}</small></td><td>${esc(evidence)}<details><summary>Inspect dependencies</summary>${deps.length?deps.map(d=>`<div>${d}</div>`).join(''):'<p>Inspect page source for inline code, dynamic imports and service calls.</p>'}</details></td><td><span>${reg?'Registered surface':'Registration gap'}</span><small>Runtime integration: unverified by this inventory.</small>${source(path)}</td></tr>`;
});
const html=`<!-- SURFACE DIRECTORY START -->
<section id="surfaceDirectory" lang="en" aria-labelledby="surfaceDirectoryTitle">
<h2 id="surfaceDirectoryTitle">Which door runs on what — all ${paths.length} surfaces</h2>
<p>Every tracked HTML surface and every estate registry route, generated from this checkout. ${registry.length} registered routes; ${paths.filter(p=>!registry.some(s=>s.path===p)).length} additional tracked pages. All three views share this complete directory.</p>
<p>Dependencies below are direct script references in page source, not a fresh runtime audit or proof that a chain is used. Inline code, dynamic imports and backend dependencies require inspection through the source links. A page with no script references is not certified offline. Source links open a new tab.</p>
<label for="surfaceSearch">Find any surface or dependency</label><input id="surfaceSearch" type="search" placeholder="Try blood, wallet, fleet, vaulta…">
<p id="surfaceCount" role="status">${paths.length} of ${paths.length} surfaces</p>
<div class="scroll"><table id="surfaceDirectoryTable"><thead><tr><th>Door / purpose</th><th>Implementation dependencies</th><th>Registration / evidence</th></tr></thead><tbody>${rows.join('\n')}</tbody></table></div>
<p id="surfaceEmpty" hidden>No surfaces match. Clear the search to see every door.</p>
</section>
<style>
#surfaceDirectory{scroll-margin-top:24px}#surfaceDirectory input{box-sizing:border-box;width:100%;min-height:44px;margin-top:8px;padding:12px;background:var(--sk-bg);color:var(--sk-ink);border:1px solid var(--sk-line)}
#surfaceDirectory table{width:100%;min-width:0;table-layout:fixed}#surfaceDirectory th,#surfaceDirectory td{overflow-wrap:anywhere;font-size:14px;letter-spacing:normal;text-transform:none;padding:12px;vertical-align:top}#surfaceDirectory small{display:block;margin:8px 0;color:var(--sk-ink-mut)}#surfaceDirectory details div{margin:8px 0}#surfaceDirectory summary{min-height:44px;cursor:pointer}#surfaceDirectory [hidden]{display:none!important}
body[data-reg="raver"] #surfaceDirectory tbody tr{border-top:3px solid var(--sk-sovereign)}body[data-reg="cypherpunk"] #surfaceDirectory{font-family:var(--sk-font-mono)}
@media(max-width:700px){#surfaceDirectory thead{display:none}#surfaceDirectory table,#surfaceDirectory tbody,#surfaceDirectory tr,#surfaceDirectory td{display:block;width:auto}#surfaceDirectory tr{border:1px solid var(--sk-line);margin:16px 0;padding:8px}#surfaceDirectory td{border:0;padding:8px}}
</style>
<script>
(function(){var rows=Array.from(document.querySelectorAll('#surfaceDirectory [data-surface]')),q=document.getElementById('surfaceSearch');q.addEventListener('input',function(){var value=q.value.trim().toLowerCase(),n=0;rows.forEach(function(row){row.hidden=!row.dataset.search.includes(value);if(!row.hidden)n++;});document.getElementById('surfaceCount').textContent=n+' of '+rows.length+' surfaces';document.getElementById('surfaceEmpty').hidden=n!==0;});})();
</script>
<!-- SURFACE DIRECTORY END -->`;
const file=resolve(root,'surfaces/stack.html');
const page=readFileSync(file,'utf8');
const marker=/<!-- SURFACE DIRECTORY START -->[^]*?<!-- SURFACE DIRECTORY END -->/;
const old=/<section>\s*<p class="law">Historical surface survey:[^]*?<\/section>/;
if(!marker.test(page)&&!old.test(page))throw Error('Missing directory insertion point');
const next=page.replace(marker.test(page)?marker:old,html);
if(process.argv.includes('--check')){if(next!==page)throw Error('Surface directory needs regeneration');}
else writeFileSync(file,next);
console.log(JSON.stringify({surfaces:paths.length,registered:registry.length,unregistered:paths.length-registry.length,mode:process.argv.includes('--check')?'checked':'generated'}));
