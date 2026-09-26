// fleet.js — the one-line unification layer. Every surface includes this and
// gains the fleet footer: same house palette, same order, one identity, while
// each page keeps its own frequency above it. Idempotent: safe to include
// twice, safe on pages that opt out (data-fleet="off" on <body>).
//
// 1st Assistant Code Surgeon — zCode (GLM 5.3) <zCode@bnature.social>, 2026-08-16.
// SPDX-License-Identifier: AGPL-3.0-only
(function(){
  if (document.currentScript && document.currentScript.dataset.fleetLoaded) return;
  const FLEET = [
    ['fLeeT',            'index.html',                    'the front door'],
    ['museum',           'museum.html',                   'what "on-chain" actually means — nine exhibits, errors on the wall'],
    ['explorer',         'inscription-explorer.html',     'art, names, and verified Bitcoin reads — one field, every chain'],
    ['studio gate',      'studio-gate.html',              'drop a PNG, meet the same WASM verdict the LaunchPad will run'],
    ['C-1 aid',          'c1-aid.html',                   'taxonomy sizing — the collision arithmetic, live'],
    ['vaulta reader',    'vaulta-reader.html',            'any contract\u2019s tables, keyless — the anchor\u2019s read path'],
  ];
  function mount(){
    if (document.getElementById('fleet-nav') || /off/.test(document.body.dataset.fleet||'')) return;
    const css = document.createElement('style');
    css.textContent =
      /* THE CLOSING ROW (founder review 2026-09-26: the bottom half of every surface). Was 11px grey
         mono at 1.4–3.3:1 with 18px targets; now a readable row of 44px pills, dressed per register. */
      '#fleet-nav{margin:56px auto 0;max-width:900px;padding-top:20px;border-top:1px solid rgba(127,127,127,.3);'+
      'display:flex;flex-wrap:wrap;gap:8px;font:15px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif}'+
      '#fleet-nav a{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border:1px solid rgba(160,170,165,.4);'+
      'border-radius:999px;color:#d7dcd9;text-decoration:none}'+
      '#fleet-nav a:hover{border-color:#f1df29;color:#f1df29}#fleet-nav a.here{color:#16edf5;border-color:#16edf5}'+
      '#fleet-nav .tag{color:inherit;opacity:.7}'+
      'body[data-reg="bee"] #fleet-nav a{color:#0c1412;background:#fffdf8;border-color:#d9d0c1}'+
      'body[data-reg="bee"] #fleet-nav a.here{color:#6e3fb8;border-color:#6e3fb8}'+
      'body[data-reg="bee"] #fleet-nav a:hover{color:#a8238c;border-color:#a8238c}'+
      'body[data-reg="cypherpunk"] #fleet-nav{font:13px/1.3 ui-monospace,Menlo,Consolas,monospace}'+
      'body[data-reg="cypherpunk"] #fleet-nav a{border-radius:4px}';
    document.head.appendChild(css);
    const nav = document.createElement('nav');
    nav.id = 'fleet-nav';
    const here = location.pathname.split('/').pop() || 'index.html';
    nav.innerHTML = FLEET.map(([name, href, tag]) => {
      const cur = (href === here) || (href === 'index.html' && /\/blight\/?$/.test(location.pathname));
      return '<a href="./' + href + '"' + (cur ? ' class="here"' : '') + '>'
           + '<span class="tag">\u25C8</span>' + name + (cur ? ' \u00B7 here' : '') + '</a>';
    }).join('');
    document.body.appendChild(nav);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
