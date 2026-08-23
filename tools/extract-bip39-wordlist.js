const fs = require('fs');
const src = fs.readFileSync('onboarding/bzdid-key.js', 'utf8');
const start = src.indexOf('var wordlist =');
if (start < 0) { console.error('no wordlist decl'); process.exit(1); }
const tickOpen = src.indexOf('`', start);
const tickClose = src.indexOf('`', tickOpen + 1);
if (tickOpen < 0 || tickClose < 0) { console.error('no template literal'); process.exit(1); }
const words = src.slice(tickOpen + 1, tickClose).split('\n');
if (words.length !== 2048) { console.error('bad count ' + words.length); process.exit(1); }
if (words[0] !== 'abandon' || words[2047] !== 'zoo') { console.error('bad bounds'); process.exit(1); }
const header =
'/* BIP-39 English wordlist (2048 words) — extracted verbatim from onboarding/bzdid-key.js\n' +
'   (@scure/bip39, MIT — Patricio Palladino, Paul Miller). Exposed as a global so the vault\n' +
'   validates seed phrases against the exact same list the bzDiD recovery lane already uses,\n' +
'   and so the keypass generator can draw its words from it. Regenerate with:\n' +
'   node tools/extract-bip39-wordlist.js */\n';
const body = 'window.BIP39_WORDLIST = Object.freeze(' + JSON.stringify(words) + ');\n';
fs.writeFileSync('onboarding/vendor/bip39-wordlist.js', header + body);
console.log('wrote onboarding/vendor/bip39-wordlist.js');
console.log('words=' + words.length + '  first=' + words[0] + '  last=' + words[2047]);
