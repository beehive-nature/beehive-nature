// Bundle the existing corpus so the standalone watch page works under file://.
// Run after changing watch markup or its corpus; --check refuses stale output.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const pagePath = fileURLToPath(new URL('../surfaces/watch.html', import.meta.url));
const corpus = JSON.parse(readFileSync(new URL('../surfaces/lang-corpus.json', import.meta.url), 'utf8'));
const page = readFileSync(pagePath, 'utf8');
const keys = new Set([...page.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]));
for (const key of Object.keys(corpus.strings)) if (key.startsWith('watch.') || key.startsWith('reg.')) keys.add(key);
const strings = Object.fromEntries([...keys].sort().map(key => {
  if (!corpus.strings[key]) throw new Error('Missing corpus key: ' + key);
  return [key, corpus.strings[key]];
}));
const { law, langs, rtl, attested, withdrawn } = corpus._meta;
// No attestation is inherited for a subset unless it actually exists upstream.
const bundle = JSON.stringify({ _meta: { law, langs, rtl, attested, withdrawn }, strings }).replaceAll('<', '\\u003c');
const block = '<script id="bnr-language-bundle" type="application/json">' + bundle + '</script>';
const next = page.includes('<!-- WATCH_LANGUAGE_BUNDLE -->')
  ? page.replace('<!-- WATCH_LANGUAGE_BUNDLE -->', block)
  : page.replace(/<script id="bnr-language-bundle" type="application\/json">[\s\S]*?<\/script>/, block);
if (!next.includes(block)) throw new Error('Language bundle slot missing');
if (process.argv.includes('--check')) {
  if (next !== page) throw new Error('Watch language bundle is stale; run node scripts/build-watch-languages.mjs');
} else writeFileSync(pagePath, next);
console.log(`${keys.size} watch/shell language keys · ${langs.length + 1} languages · ${process.argv.includes('--check') ? 'in sync' : 'bundled'}`);
