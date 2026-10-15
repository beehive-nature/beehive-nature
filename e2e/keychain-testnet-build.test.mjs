// The TEST BUILD of the isolated keychain (scripts/build-keychain.mjs --testnet): a built copy
// pinned to the local test chain at its own origin. The source stays the production pin, a test
// pin can never carry the production origin, and the production site build is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, mkdtempSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const TOKEN = '0x' + '5'.repeat(40), VAULT = '0x' + '8'.repeat(40); // fixture addresses, nothing deployed
const PIN = /^[ \t]*var CHAIN = (\d+), CHAIN_NAME = '([^']*)', TOKEN = '(0x[0-9a-f]{40})', VAULT = '(0x[0-9a-f]{40})', TEST_BUILD = (true|false);[ \t]*\/\* KC-PIN/m;
const ORIGINS = /^[ \t]*var ORIGIN = '([^']*)', PARENTS = \[([^\]]*)\];[ \t]*\/\* KC-ORIGINS/m;
const run = (...args) => execFileSync(process.execPath, ['scripts/build-keychain.mjs', ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const refuses = (re, ...args) => assert.throws(() => run(...args), e => re.test(String(e.stderr || e.message)));

test('the source keychain is the production pin: Arbitrum One, ANT, PaymentVaultV2, not a test build', () => {
  const m = PIN.exec(readFileSync('keychain/keychain.js', 'utf8'));
  assert.ok(m, 'the KC-PIN line exists in the source');
  assert.deepEqual(m.slice(1), ['42161', 'Arbitrum One', '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684', '0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26', 'false']); // PUBLIC-CONSTANT: ANT on Arbitrum One + PaymentVaultV2
  assert.equal(JSON.parse(run('--check')).keychain, 'pinned');
});

test('a test build carries chain 31337, the given token and vault, TEST_BUILD true, and its own origin; the source is untouched', () => {
  const before = readFileSync('keychain/keychain.js', 'utf8');
  const out = mkdtempSync(join(tmpdir(), 'kc-test-'));
  const report = JSON.parse(run('--out', out, '--origin', 'https://keys-devnet.skaists.dev', '--parent', 'https://skaists.dev', '--testnet', TOKEN, VAULT));
  assert.match(report.pin, /^TEST BUILD: chain 31337/);
  const built = readFileSync(join(out, 'keychain.js'), 'utf8');
  assert.deepEqual(PIN.exec(built).slice(1), ['31337', 'the local test network', TOKEN, VAULT, 'true']);
  assert.deepEqual(ORIGINS.exec(built).slice(1), ['https://keys-devnet.skaists.dev', "'https://skaists.dev'"]);
  assert.equal(existsSync(join(out, 'CNAME')), false, 'a replacement-origin build writes no CNAME');
  assert.equal(readFileSync('keychain/keychain.js', 'utf8'), before, 'the source file did not change');
  // the one pin line and the one origins line are the only differences from the source
  const diff = built.split('\n').filter((l, i) => l !== before.split('\n')[i]);
  assert.equal(diff.length, 2);
});

test('a test build is refused without its own origin, at the production origin, or with a bad pin', () => {
  const out = mkdtempSync(join(tmpdir(), 'kc-test-'));
  refuses(/needs --origin/, '--out', out, '--testnet', TOKEN, VAULT);
  refuses(/never carry the production origin/, '--out', out, '--origin', 'https://keys.skaists.dev', '--testnet', TOKEN, VAULT);
  refuses(/never carry the production origin/, '--out', out, '--origin', 'https://KEYS.skaists.dev', '--testnet', TOKEN, VAULT);
  refuses(/token and vault/, '--out', out, '--origin', 'https://keys-devnet.skaists.dev', '--testnet', TOKEN, TOKEN);
  refuses(/token and vault/, '--out', out, '--origin', 'https://keys-devnet.skaists.dev', '--testnet', 'nope', VAULT);
  refuses(/only meaningful together with --out/, '--origin', 'https://keys-devnet.skaists.dev', '--testnet', TOKEN, VAULT);
});

test('the production site build still carries the production pin and the CNAME', () => {
  const out = mkdtempSync(join(tmpdir(), 'kc-prod-'));
  const report = JSON.parse(run('--out', out));
  assert.equal(report.pin, 'production: Arbitrum One');
  assert.deepEqual(PIN.exec(readFileSync(join(out, 'keychain.js'), 'utf8')).slice(1), ['42161', 'Arbitrum One', '0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684', '0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26', 'false']); // PUBLIC-CONSTANT: ANT on Arbitrum One + PaymentVaultV2
  assert.equal(readFileSync(join(out, 'CNAME'), 'utf8'), 'keys.skaists.dev\n');
});
