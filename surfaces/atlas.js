/* Progressive enhancement: all destinations remain ordinary HTML links. */
(() => {
  'use strict';
  const { createSearch, matchesSearch } = window.BNRAtlasSearch;
  const q = document.getElementById('q');
  const family = document.getElementById('family-filter');
  const form = document.querySelector('.search-form');
  const resultCount = document.getElementById('result-count');
  const clear = document.getElementById('clear');
  const empty = document.getElementById('empty');
  const collection = document.getElementById('collection');
  const rows = [...document.querySelectorAll('#list .srf')];
  function apply() {
    const search = createSearch(q.value, family.value);
    const terms = search.terms;
    let count = 0;
    rows.forEach(row => {
      const matches = matchesSearch({ text: row.dataset.t + ' ' + row.textContent, family: row.dataset.family }, search);
      row.hidden = !matches;
      if (matches) count++;
    });
    document.querySelectorAll('#list .fam').forEach(section => {
      const hasRows = section.querySelector('.srf');
      section.hidden = hasRows ? !section.querySelector('.srf:not([hidden])') : Boolean(terms.length || family.value && family.value !== section.dataset.family);
    });
    document.querySelectorAll('#list .org').forEach(section => {
      section.hidden = !section.querySelector('.fam:not([hidden])');
    });
    resultCount.textContent = String(count);
    empty.hidden = count > 0 || !terms.length && !family.value;
    clear.hidden = !q.value && !family.value;
    document.querySelectorAll('[data-family-link]').forEach(link => {
      if (link.dataset.familyLink === family.value) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    });
  }
  q.addEventListener('input',apply);
  family.addEventListener('change',apply);
  form.addEventListener('reset',() => { q.value=''; family.value=''; apply(); q.focus(); });
  document.addEventListener('keydown',event => {
    if (event.key === '/' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')) { event.preventDefault(); collection.open=true; q.focus(); }
    if (event.key === 'Escape' && event.target === q && q.value) { q.value=''; apply(); }
  });
  document.querySelectorAll('a[href="#explore"],a[href^="#fam-"],a[href^="#org-"]').forEach(link => link.addEventListener('click',() => {
    collection.open=true;
    q.value=''; family.value=''; apply();
  }));
  function revealHash() {
    if (/^#(?:explore$|fam-|org-)/.test(location.hash)) {
      collection.open=true;
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  }
  window.addEventListener('hashchange',revealHash);
  // Translated text also becomes searchable, without rewriting the corpus.
  new MutationObserver(apply).observe(document.getElementById('list'),{subtree:true,characterData:true,childList:true});
function restoreVisibleFocus(focus){
 if(!focus?.isConnected)return;let target=focus;
 for(let node=focus.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS'&&!node.open)target=node.querySelector('summary');
 target?.focus({preventScroll:true});
}
  let lastReading=null;
  const readingChoices=new Map();
  function labelFamilies(){
    [...family.options].filter(o=>o.value).forEach(o=>{
      const gloss=window.BNRLanguage?.text('hub.gl.'+o.value,o.dataset.familyGloss)||o.dataset.familyGloss;
      o.textContent=lastReading==='cypherpunk'?o.value+' · '+gloss:gloss;
    });
  }
  function applyReading(event) {
    const reading = event?.detail?.reg || document.body.dataset.reg || 'bee';
    if(reading===lastReading)return;
    const focus=document.activeElement;
    const details=[collection,...document.querySelectorAll('.row-trace,.architecture')];
    if(lastReading)readingChoices.set(lastReading,details.map(d=>d.open));
    const previous=readingChoices.get(reading);
    details.forEach((d,i)=>d.open=previous?previous[i]:d===collection?reading!=='bee':reading==='cypherpunk');
    document.getElementById(reading==='cypherpunk'?'technical-search-slot':'search-origin').appendChild(form);
    // Keep an active search or a linked section visible when changing skins.
    if(q.value||family.value||/^#(?:explore$|fam-|org-)/.test(location.hash))collection.open=true;
    restoreVisibleFocus(focus);
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = reading === 'bee' ? '#f6f7f2' : '#06110c';
    lastReading=reading;labelFamilies();
  }
  document.addEventListener('bregister',applyReading);
  document.addEventListener('blang',labelFamilies);
  applyReading();
  revealHash();
  const modeBar=document.querySelector('.mode-bar');
  if(window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty('--mode-height',modeBar.offsetHeight+'px')).observe(modeBar);
  apply();
  const button = document.getElementById('reg'), status = document.getElementById('protocol-status');
  button.addEventListener('click',() => {
    if (!navigator.registerProtocolHandler) { status.textContent='This browser does not support custom address registration.'; return; }
    try { navigator.registerProtocolHandler('web+bnr','/r/?u=%s'); status.textContent='Request sent to your browser. Registration follows your browser’s choice.'; }
    catch { status.textContent='Registration was unavailable. Ordinary site links still work.'; }
  });
})();
