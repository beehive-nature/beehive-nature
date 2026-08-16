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
      '#fleet-nav{margin-top:56px;padding-top:18px;border-top:1px solid #242433;'+
      'display:flex;flex-wrap:wrap;gap:6px 22px;font:11px ui-monospace,Menlo,Consolas,monospace}'+
      '#fleet-nav a{color:#7e8c85;text-decoration:none;letter-spacing:.05em}'+
      '#fleet-nav a:hover{color:#f1df29}#fleet-nav a.here{color:#16edf5}'+
      '#fleet-nav .tag{color:#3d3d52;margin-right:6px}';
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
