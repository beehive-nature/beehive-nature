// build-keychain.mjs — pins and packages the isolated keychain (keychain/) for keys.skaists.dev.
//
//   node scripts/build-keychain.mjs                          write the vendor integrity hashes into keychain/index.html
//   node scripts/build-keychain.mjs --check                  fail if those hashes no longer match the vendor bytes
//   node scripts/build-keychain.mjs --out DIR                write the publishable site (CNAME + pinned vendor copies) to DIR
//   node scripts/build-keychain.mjs --out DIR --origin URL [--parent URL]
//                                                             the same site built to live at a REPLACEMENT origin (host
//                                                             loss / domain loss): the built keychain.js carries the new
//                                                             origin and embedder allowlist, and no CNAME is written.
//                                                             The source line stays the production truth; nothing at
//                                                             keys.skaists.dev gains an override.
//
// The keychain loads its own copies of the wallet's derivation, signing and Hive libraries, pinned
// by Subresource Integrity, so a change at skaists.dev can never change what runs at keys.skaists.dev.
import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const VENDOR = {'vendor/bzdid-key.js': 'surfaces/onboarding/bzdid-key.js', 'vendor/bnr-sign.js': 'surfaces/onboarding/vendor/bnr-sign.js', 'vendor/hive-tx.min.js': 'surfaces/onboarding/vendor/hive-tx.min.js'};
const PAGE = 'keychain/index.html', SITE = ['index.html', 'prelude.js', 'keychain.js', 'genesis.js'];
const sri = f => 'sha384-' + createHash('sha384').update(readFileSync(f)).digest('base64');

const page = readFileSync(PAGE, 'utf8');
let pinned = page;
for (const [src, from] of Object.entries(VENDOR)) {
  const re = new RegExp(`(<script src="${src.replace(/[.]/g, '\\.')}" integrity=")[^"]*(")`);
  if (!re.test(pinned)) throw new Error(`${PAGE} has no pinned script tag for ${src}`);
  pinned = pinned.replace(re, `$1${sri(from)}$2`);
}
const args = process.argv.slice(2);
const outAt = args.indexOf('--out'), originAt = args.indexOf('--origin'), parentAt = args.indexOf('--parent');
const replacement = originAt >= 0 ? args[originAt + 1] : null;
if (replacement && !/^https:\/\/[a-z0-9.-]+(:[0-9]+)?$/i.test(replacement)) throw new Error('--origin needs an https URL (the origin the replacement keychain will run at)');
const parents = parentAt >= 0 && args[parentAt + 1] && !args[parentAt + 1].startsWith('--') ? args[parentAt + 1] : null;

function rewrittenSource() {
  // the ONE line the source marks KC-ORIGINS; the built copy alone is rewritten, so a replacement
  // origin never weakens what runs at keys.skaists.dev (no runtime override exists to abuse)
  const src = readFileSync('keychain/keychain.js', 'utf8');
  if (!/^[ \t]*var ORIGIN = '[^']*', PARENTS = \[[^\]]*\];[ \t]*\/\* KC-ORIGINS/m.test(src)) throw new Error('keychain/keychain.js has no KC-ORIGINS line to rewrite');
  const P = parents ? "'" + parents + "'" : '';
  const n = src.replace(/^([ \t]*var ORIGIN = ')[^']*(', PARENTS = )\[[^\]]*\](;)/m, `$1${replacement}$2[${P}]$3`);
  if (n === src) throw new Error('the KC-ORIGINS line did not rewrite');
  return n;
}

if (args[0] === '--check') {
  if (pinned !== page) { console.error(`${PAGE}: vendor integrity is stale; run node scripts/build-keychain.mjs`); process.exit(1); }
  console.log(JSON.stringify({keychain: 'pinned', vendor: Object.keys(VENDOR).length}));
} else if (outAt >= 0) {
  const out = args[outAt + 1]; if (!out) throw new Error('--out needs a directory');
  if (pinned !== page) throw new Error('pin first: node scripts/build-keychain.mjs');
  mkdirSync(join(out, 'vendor'), {recursive: true});
  for (const f of SITE) {
    if (f === 'keychain.js' && replacement) writeFileSync(join(out, f), rewrittenSource());
    else copyFileSync(join('keychain', f), join(out, f));
  }
  for (const [src, from] of Object.entries(VENDOR)) copyFileSync(from, join(out, src));
  if (!replacement) { writeFileSync(join(out, 'CNAME'), 'keys.skaists.dev\n'); }
  writeFileSync(join(out, '.nojekyll'), '');
  console.log(JSON.stringify({site: out, files: SITE.length + Object.keys(VENDOR).length + (replacement ? 1 : 2), origin: replacement || 'https://keys.skaists.dev', parents: parents || 'default'}));
} else {
  if (replacement) throw new Error('--origin is only meaningful together with --out');
  writeFileSync(PAGE, pinned);
  console.log(JSON.stringify({keychain: pinned === page ? 'unchanged' : 'pinned'}));
}
