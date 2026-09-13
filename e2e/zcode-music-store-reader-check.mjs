// zcode-music-store-reader-check.mjs — browser proof for the encrypted Store
// read adapter. The local server returns only base64 ciphertext envelopes;
// the page verifies byte count and SHA-256, then exposes no plaintext path.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const objects = new Map();
const requests = [];
let corrupt = false;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function object(text) {
  const bytes = Buffer.from(text, 'utf8');
  const sha256 = digest(bytes);
  objects.set(sha256, bytes);
  return { address:sha256, sha256, size:bytes.length };
}
const checkpointRef = object('opaque-checkpoint-ciphertext');
const itemSpecs = [
  ['channel-snapshot', 'snapshot-ciphertext'],
  ['music-recording', 'recording-ciphertext'],
  ['music-stems', 'stems-ciphertext'],
  ['music-captions', 'captions-ciphertext'],
];
const items = itemSpecs.map(([kind, body], index) => ({
  id: digest(Buffer.from(`item-${index}`)), kind, version:index === 1 ? 2 : 1, ref:object(body),
}));
const policyId = 'b'.repeat(64);
const manifest = {
  type:'bnr-manifest-envelope-v1', version:1,
  manifest:{
    channel:'plur', epoch:3, sequence:12,
    checkpoint:{ id:'a'.repeat(64), sequence:12, policy_id:policyId, ref:checkpointRef },
    encrypted_items:items,
    credits:{ creator:[{ pubkey:'c'.repeat(64), display_name:'LoVis waTer' }], source:[{
      uri:'https://beehivenature.buzz', title:'beehivenature channel', sha256:'d'.repeat(64),
    }] },
    versions:{ manifest:1, channel:1, items:1 },
    admission:{ policy_id:policyId, max_bytes:12582912, max_items:16, payment:'disabled', approval:'trezor' },
  },
};

const server = createServer(async (request, response) => {
  requests.push({ method:request.method, url:request.url });
  if (request.method === 'GET' && request.url === '/test-manifest.json') {
    response.writeHead(200, { 'content-type':'application/json', 'cache-control':'no-store' });
    response.end(JSON.stringify(manifest));
    return;
  }
  const match = request.method === 'GET' && request.url?.match(/^\/v1\/data\/public\/([a-f0-9]{64})$/);
  if (match) {
    const source = objects.get(match[1]);
    if (!source) { response.writeHead(404); response.end(); return; }
    const bytes = corrupt && match[1] === items[0].ref.address ? Buffer.from('tampered') : source;
    response.writeHead(200, { 'content-type':'application/json', 'cache-control':'no-store' });
    response.end(JSON.stringify({ data:bytes.toString('base64') }));
    return;
  }
  try {
    const file = join(ROOT, decodeURIComponent(request.url.split('?')[0]).replace(/^\//, ''));
    const body = await readFile(file);
    response.writeHead(200, { 'content-type':MIME[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch { response.writeHead(404); response.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !/net::ERR_/.test(message.text())) errors.push(message.text()); });
let pass = 0, fail = 0;
const ok = (label, condition, note='') => { if (condition) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label}${note ? ` — ${note}` : ''}`); } };

const pageUrl = `${base}/surfaces/music.html?manifest=${encodeURIComponent(`${base}/test-manifest.json`)}&store=${encodeURIComponent(base)}`;
await page.goto(pageUrl);
await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('verified'));
ok('store: page has no errors', errors.length === 0, errors.join(' | '));
ok('store: explicit endpoint enables the read action', await page.locator('#verify-store').isEnabled());
await page.locator('#verify-store').click();
await page.waitForFunction(() => document.getElementById('store-status')?.textContent.includes('4 encrypted objects verified'));
ok('store: all four encrypted objects are verified', await page.locator('#items .ready[data-store-state="verified"]').count() === 4);
ok('store: browser receives only bounded encrypted bytes', (await page.locator('#store-status').innerText()).includes('decryption remains client-side'));
ok('store: exactly four GET object requests were made', requests.filter(request => request.url.startsWith('/v1/data/public/')).length === 4);
ok('store: no write or raw x0x request was opened', !requests.some(request => request.method === 'POST' || request.url.includes('/ws')));

corrupt = true;
await page.locator('#verify-store').click();
await page.waitForFunction(() => document.getElementById('store-status')?.textContent.includes('verification refused'));
ok('store: digest mismatch fails closed', await page.locator('#items .ready[data-store-state="refused"]').count() === 4);
ok('store: refusal leaves room join state intact', await page.locator('#join').isEnabled());
ok('store: refusal still opened no write path', !requests.some(request => request.method === 'POST' || request.url.includes('/ws')));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
