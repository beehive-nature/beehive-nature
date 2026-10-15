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
//   node scripts/build-keychain.mjs --out DIR --origin URL --parent URL --testnet TOKEN VAULT
//                                                             a TEST BUILD: the same site, pinned in the built copy to
//                                                             the local test chain (31337) with the token and vault a
//                                                             running ant-devnet authenticates (tools/ant-testnet). It
//                                                             needs its own origin and can never carry the production
//                                                             one, so keys.skaists.dev never serves a test pin.
//
// Every mode first checks that the SOURCE pin line is the production pin (Arbitrum One, the real
// ANT token and PaymentVaultV2): a test pin can exist only in a built copy.
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
const outAt = args.indexOf('--out'), originAt = args.indexOf('--origin'), parentAt = args.indexOf('--parent'), testAt = args.indexOf('--testnet');
const replacement = originAt >= 0 ? args[originAt + 1] : null;
if (replacement && !/^https:\/\/[a-z0-9.-]+(:[0-9]+)?$/i.test(replacement)) throw new Error('--origin needs an https URL (the origin the replacement keychain will run at)');
const parents = parentAt >= 0 && args[parentAt + 1] && !args[parentAt + 1].startsWith('--') ? args[parentAt + 1] : null;
const PRODUCTION_ORIGIN = 'https://keys.skaists.dev', TEST_CHAIN = 31337;
const testnet = testAt >= 0 ? {token: String(args[testAt + 1] || '').toLowerCase(), vault: String(args[testAt + 2] || '').toLowerCase()} : null;
if (testnet) {
  if (!/^0x[0-9a-f]{40}$/.test(testnet.token) || !/^0x[0-9a-f]{40}$/.test(testnet.vault) || testnet.token === testnet.vault) throw new Error('--testnet needs the test network\'s token and vault addresses (two distinct 0x… addresses, from its browser manifest)');
  if (!replacement) throw new Error('--testnet needs --origin: a test build lives at its own origin, never at ' + PRODUCTION_ORIGIN);
  if (replacement.toLowerCase() === PRODUCTION_ORIGIN) throw new Error('a test build can never carry the production origin ' + PRODUCTION_ORIGIN);
}
// the source pin line, exactly: Arbitrum One, the real ANT token and PaymentVaultV2, not a test build
const PIN_LINE = /^([ \t]*var CHAIN = )42161(, CHAIN_NAME = )'Arbitrum One'(, TOKEN = )'0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684'(, VAULT = )'0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26'(, TEST_BUILD = )false(;[ \t]*\/\* KC-PIN)/m; // PUBLIC-CONSTANT: ANT on Arbitrum One + PaymentVaultV2
function sourcePinned() {
  const src = readFileSync('keychain/keychain.js', 'utf8');
  if (!PIN_LINE.test(src)) throw new Error('keychain/keychain.js: the KC-PIN line is not the production pin (Arbitrum One, ANT, PaymentVaultV2, TEST_BUILD false); a test pin may exist only in a built copy');
  return src;
}
sourcePinned();

function rewrittenSource() {
  // the ONE line the source marks KC-ORIGINS; the built copy alone is rewritten, so a replacement
  // origin never weakens what runs at keys.skaists.dev (no runtime override exists to abuse)
  const src = sourcePinned();
  if (!/^[ \t]*var ORIGIN = '[^']*', PARENTS = \[[^\]]*\];[ \t]*\/\* KC-ORIGINS/m.test(src)) throw new Error('keychain/keychain.js has no KC-ORIGINS line to rewrite');
  const P = parents ? "'" + parents + "'" : '';
  let n = src.replace(/^([ \t]*var ORIGIN = ')[^']*(', PARENTS = )\[[^\]]*\](;)/m, `$1${replacement}$2[${P}]$3`);
  if (n === src) throw new Error('the KC-ORIGINS line did not rewrite');
  if (testnet) {
    // the ONE line the source marks KC-PIN, rewritten only here: chain 31337, the devnet's token and vault, TEST_BUILD true
    const t = n.replace(PIN_LINE, `$1${TEST_CHAIN}$2'the local test network'$3'${testnet.token}'$4'${testnet.vault}'$5true$6`);
    if (t === n) throw new Error('the KC-PIN line did not rewrite');
    n = t;
  }
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
  console.log(JSON.stringify({site: out, files: SITE.length + Object.keys(VENDOR).length + (replacement ? 1 : 2), origin: replacement || PRODUCTION_ORIGIN, parents: parents || 'default', pin: testnet ? 'TEST BUILD: chain ' + TEST_CHAIN + ', token ' + testnet.token + ', vault ' + testnet.vault : 'production: Arbitrum One'}));
} else {
  if (replacement || testnet) throw new Error('--origin and --testnet are only meaningful together with --out');
  writeFileSync(PAGE, pinned);
  console.log(JSON.stringify({keychain: pinned === page ? 'unchanged' : 'pinned'}));
}
