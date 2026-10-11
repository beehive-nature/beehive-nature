// build-keychain.mjs — pins and packages the isolated keychain (keychain/) for keys.skaists.dev.
//
//   node scripts/build-keychain.mjs            write the vendor integrity hashes into keychain/index.html
//   node scripts/build-keychain.mjs --check    fail if those hashes no longer match the vendor bytes
//   node scripts/build-keychain.mjs --out DIR  write the publishable site (CNAME + pinned vendor copies) to DIR
//
// The keychain loads its own copies of the wallet's derivation and signing libraries, pinned by
// Subresource Integrity, so a change at skaists.dev can never change what runs at keys.skaists.dev.
import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const VENDOR = {'vendor/bzdid-key.js': 'surfaces/onboarding/bzdid-key.js', 'vendor/bnr-sign.js': 'surfaces/onboarding/vendor/bnr-sign.js'};
const PAGE = 'keychain/index.html', SITE = ['index.html', 'keychain.js', 'genesis.js'];
const sri = f => 'sha384-' + createHash('sha384').update(readFileSync(f)).digest('base64');

const page = readFileSync(PAGE, 'utf8');
let pinned = page;
for (const [src, from] of Object.entries(VENDOR)) {
  const re = new RegExp(`(<script src="${src.replace(/[.]/g, '\\.')}" integrity=")[^"]*(")`);
  if (!re.test(pinned)) throw new Error(`${PAGE} has no pinned script tag for ${src}`);
  pinned = pinned.replace(re, `$1${sri(from)}$2`);
}
const args = process.argv.slice(2);
if (args[0] === '--check') {
  if (pinned !== page) { console.error(`${PAGE}: vendor integrity is stale; run node scripts/build-keychain.mjs`); process.exit(1); }
  console.log(JSON.stringify({keychain: 'pinned', vendor: Object.keys(VENDOR).length}));
} else if (args[0] === '--out') {
  if (pinned !== page) throw new Error('pin first: node scripts/build-keychain.mjs');
  const out = args[1]; if (!out) throw new Error('--out needs a directory');
  mkdirSync(join(out, 'vendor'), {recursive: true});
  for (const f of SITE) copyFileSync(join('keychain', f), join(out, f));
  for (const [src, from] of Object.entries(VENDOR)) copyFileSync(from, join(out, src));
  writeFileSync(join(out, 'CNAME'), 'keys.skaists.dev\n');
  writeFileSync(join(out, '.nojekyll'), '');
  console.log(JSON.stringify({site: out, files: SITE.length + Object.keys(VENDOR).length + 2}));
} else {
  writeFileSync(PAGE, pinned);
  console.log(JSON.stringify({keychain: pinned === page ? 'unchanged' : 'pinned'}));
}
