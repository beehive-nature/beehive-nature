#!/usr/bin/env node
/* watch-ux.mjs — the W@tch room, UX pass 1 (2026-09-19, founder: "no one has touched the UX so full attack").
   The empty room was all dead ends: a big round play mark that is not a button, a ticker of dashes, and the
   one thing that DOES work today (the music room) hidden as a 14px link. Now:
     · the play mark that plays nothing steps aside where no room is hosted; the screen's one action is a real,
       44px+, filled control into the music room, speaking with that room's own words (music.beeLead, 29 tongues)
     · the dash ticker hides where there is no room to report on
     · the brand is set in the house hand (burti, same-origin, names only)
     · the phone header loses a row: the room's own nav scrolls sideways instead of wrapping
     · raver gets light: a slow aurora in the screen, stilled under reduced motion
   No new strings. Asserted edits; a re-run changes nothing. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const P = 'surfaces/watch.html'; let s = readFileSync(P, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const edit = (a, b) => { if (s.includes(b)) return; if (s.split(a).length !== 2) throw new Error('DRIFT: ' + a.slice(0, 70)); s = s.replace(a, b); };
edit('<a href="music.html">SKAISTS mUsiC →</a></div>',
     '<a class="screen-cta" href="music.html"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 4 12 8-12 8Z" fill="currentColor"/></svg><span><b translate="no">SKAISTS mUsiC</b><small data-i18n="music.beeLead">A calm room. The music is already playing.</small></span></a></div>');
edit('.screen-empty a{font-size:.875rem;color:var(--screen-ink)}',
     '.screen-empty a{font-size:.875rem;color:var(--screen-ink)}' +
     '.screen-empty a.screen-cta{display:inline-flex;align-items:center;gap:12px;min-height:52px;max-inline-size:100%;padding:10px 20px 10px 16px;border-radius:999px;background:var(--primary,var(--accent));color:var(--on-accent);text-decoration:none;text-align:start;font-size:1rem}' +
     '.screen-cta svg{inline-size:22px;block-size:22px;flex:none}.screen-cta span{display:grid;min-inline-size:0}.screen-cta b{font-weight:700}.screen-cta small{font-size:.8125rem;line-height:1.35;opacity:.92;overflow-wrap:anywhere}' +
     '.screen-cta:hover{filter:brightness(1.08)}.screen-cta:focus-visible{outline:3px solid var(--screen-ink);outline-offset:4px}[dir=rtl] .screen-cta svg{transform:scaleX(-1)}' +
     'body[data-room="none"] :is(.play-mark,#ticker){display:none!important}' +
     '@font-face{font-family:burti;src:url(fonts/burti.woff2) format("woff2");font-display:swap}.brand{font-family:burti,system-ui,sans-serif;font-weight:400;font-size:1.5rem;letter-spacing:.05em}' +
     '@media(max-width:850px){.local-nav{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:18px}.local-nav::-webkit-scrollbar{display:none}.local-nav a{white-space:nowrap;flex:none;min-height:44px}.top-controls{display:contents}.topbar-inner .language-label{order:2;margin-inline-start:auto}.topbar-inner [data-register-host]{order:3}.topbar-inner{padding-block:10px;gap:8px 12px}}' +
     '@media(prefers-reduced-motion:no-preference){body[data-reg="raver"] .tile:before{background:radial-gradient(ellipse at 20% 100%,#d655bb55,transparent 60%),radial-gradient(ellipse at 85% 5%,#45c2dc40,transparent 55%),radial-gradient(ellipse at 55% 60%,#9c6fd638,transparent 60%);animation:aurora 18s ease-in-out infinite alternate}}@keyframes aurora{to{transform:scale(1.25) translate(3%,-4%);filter:hue-rotate(40deg)}}');
writeFileSync(P, crlf ? s.replace(/\n/g, '\r\n') : s);
/* the coverage floor counts VISIBLE keyed leaves: the dash ticker (2 keyed) leaves the static page, the screen
   action (1 keyed) arrives — 45 → 44, on purpose; every visible leaf is still keyed. */
{ const F = 'e2e/lang-coverage-floors.json'; const f = readFileSync(F, 'utf8'); if (!f.includes('"watch.html": 44')) { if (f.split('"watch.html": 45').length !== 2) throw new Error('DRIFT: watch floor'); writeFileSync(F, f.replace('"watch.html": 45', '"watch.html": 44')); } }
execFileSync(process.execPath, ['scripts/build-watch-languages.mjs'], { stdio: 'inherit' });
console.log('watch ux pass 1: edits asserted');
