import { readFileSync, writeFileSync } from 'node:fs';
const NL = '\n';
let s = readFileSync('e2e/estate-source.mjs', 'utf8');
const lines = s.split(NL);
const i0 = lines.findIndex(l => l.trim() === 'const drift = [], seen = {};');
if (i0 < 0) { console.error('anchor miss'); process.exit(1); }
// find the 'if (!t) continue;' line after the matchAll loop
let iEnd = -1;
for (let i = i0; i < i0 + 12; i++) if (lines[i].includes('if (!t) continue;')) { iEnd = i; break; }
if (iEnd < 0) { console.error('end miss'); process.exit(1); }
const BS = String.fromCharCode(92);
const rep = [
  '      /* MARKUP-AWARE EXTRACTION (markup-swap lane): a keyed element may carry',
  '         inline tags (links, emphasis) — capture to the element\\' + BS + ''s true close with',
  '         a tag-depth counter, strip the tags, then compare decoded text. */',
  '      const extract = (html, start) => {',
  '        let i = html.indexOf(' + BS + '>', start), depth = 0, out = ' + BS + '' + BS + '';',
  '        while (i < html.length) {',
  '          const lt = html.indexOf(' + BS + '<', i);',
  '          if (lt === -1) break;',
  '          out += html.slice(i, lt);',
  '          const gt = html.indexOf(' + BS + '>', lt);',
  '          if (gt === -1) break;',
  '          const tag = html.slice(lt, gt + 1);',
  '          i = gt + 1;',
  '          if (/^<' + BS + '/.test(tag)) { depth--; if (depth < 0) break; }',
  '          else if (!/' + BS + '/' + BS + 's*' + BS + '>/' + BS + '.test(tag) && !/^<(br|img|hr|input)' + BS + 'b/i.test(tag)) depth++;',
  '        }',
  '        return out;',
  '      };',
  '      for (const f of walk(SURF)) {',
  '        const html = readFileSync(join(SURF, f), ' + BS + '' + BS + 'utf8' + BS + '' + BS + ');',
  '        for (const m of html.matchAll(/data-i18n=' + BS + '' + BS + '"([^' + BS + '' + BS + '"]+)' + BS + '' + BS + '"[^>]*>/g)) {',
  '          const k = m[1];',
  '          const t = dec(extract(html, m.index + m[0].length - 1).replace(/<[^>]+>/g, ' + BS + '' + BS + '' + BS + '' + BS + '));',
  '          if (!t) continue;'
];
lines.splice(i0, iEnd - i0 + 1, ...rep);
writeFileSync('e2e/estate-source.mjs', lines.join(NL));
console.log('patched, extract at line', i0);
