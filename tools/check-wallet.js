/* Static checks on surfaces/wallet.html — run: node tools/check-wallet.js
   Verifies inline-script syntax, that every getElementById target exists in the
   markup, and that tags balance. Catches the class of bug that only shows up as
   a silent null-deref in the browser. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const file = path.join(ROOT, 'surfaces/wallet.html');
const html = fs.readFileSync(file, 'utf8');

let problems = 0;
const bad = m => { problems++; console.log('  FAIL ' + m); };
const good = m => console.log('  ok   ' + m);

// ── 1. inline script syntax ────────────────────────────────────────────────
console.log('\n── inline script syntax ──');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((src, i) => {
  try { new vm.Script(src); good(`inline script #${i + 1} parses (${src.split('\n').length} lines)`); }
  catch (e) { bad(`inline script #${i + 1}: ${e.message}`); }
});

// ── 2. external scripts resolve on disk ────────────────────────────────────
console.log('\n── external scripts exist ──');
[...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].forEach(m => {
  const rel = m[1].split('?')[0];
  const p = path.join(ROOT, 'surfaces', rel);
  if (fs.existsSync(p)) good(rel);
  else bad(`${rel} — not on disk at surfaces/${rel}`);
});

// ── 3. every getElementById target exists ──────────────────────────────────
console.log('\n── getElementById targets ──');
// Strip script bodies first — an id=" inside a JS string is a string the browser
// never parses as markup, and counting it produces phantom duplicates.
const markup = html.replace(/<script[\s\S]*?<\/script>/g, '');
const ids = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
// …but an id the page BUILDS in a script string is real the moment that string is
// injected. Count those separately: satisfied, and named as injected so the
// distinction stays visible instead of reading as static markup.
const injected = new Set([...scripts.join('\n').matchAll(/\bid=\\?["']([^"'\\]+)/g)].map(m => m[1]));
const wanted = new Set([...html.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]));
[...html.matchAll(/getElementById\('([^']+)'\)/g)].forEach(m => wanted.add(m[1]));
let missing = 0, viaJs = 0;
for (const w of wanted) {
  if (ids.has(w)) continue;
  if (injected.has(w)) { viaJs++; continue; }
  bad(`$('${w}') has no matching id= in markup OR in any injected string`); missing++;
}
if (!missing) good(`all ${wanted.size} referenced ids exist (${wanted.size - viaJs} static, ${viaJs} JS-injected)`);

// ── 4. duplicate ids ───────────────────────────────────────────────────────
console.log('\n── duplicate ids ──');
const seen = new Map();
[...markup.matchAll(/\bid="([^"]+)"/g)].forEach(m => seen.set(m[1], (seen.get(m[1]) || 0) + 1));
const dupes = [...seen].filter(([, n]) => n > 1);
if (dupes.length) dupes.forEach(([id, n]) => bad(`id="${id}" appears ${n}×`));
else good('no duplicate ids');

// ── 5. tag balance for the containers we care about ────────────────────────
console.log('\n── tag balance ──');
for (const tag of ['section', 'div', 'script', 'select', 'textarea', 'pre', 'main']) {
  const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  if (open === close) good(`${tag}: ${open} open / ${close} close`);
  else bad(`${tag}: ${open} open vs ${close} close`);
}

// ── 6. the integration points the splice depended on ───────────────────────
console.log('\n── integration ──');
const need = [
  ['vault section present', 'id="vault-sec"'],
  ['wordlist loaded before vault.js', null],
  ['auto-connect guard excludes the vault', "#br-wif,#br-go,#vault-sec"],
  ['bridge field still targetable', 'id="br-wif"'],
  ['bridge section still targetable', 'id="bridge-sec"'],
];
for (const [label, needle] of need) {
  if (needle === null) continue;
  if (html.includes(needle)) good(label); else bad(`${label} — missing "${needle}"`);
}
const iWl = html.indexOf('bip39-wordlist.js');
const iV = html.indexOf('vault.js');
if (iWl > -1 && iV > -1 && iWl < iV) good('wordlist loaded before vault.js');
else bad('wordlist must load before vault.js');
const iVaultJs = html.indexOf('src="vault.js');
const iWiring = html.indexOf('THE VAULT — UI wiring');
if (iVaultJs > -1 && iWiring > iVaultJs) good('engine loads before the UI wiring runs');
else bad('vault.js must load before the wiring script');

console.log('\n────────────────────────────────');
console.log(problems ? `${problems} problem(s)` : 'clean');
process.exit(problems ? 1 : 0);
