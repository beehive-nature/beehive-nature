// bViEw takes a bLink (surfaces/blink.js) and saves any public file straight from Autonomi storage
// nodes. Only the network reader is mocked; the page, blink.js and the save path are the real ones.
// The real relay and the real network are touched zero times.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ADDRESS = 'ab'.repeat(32);
const ORIGIN = 'http://127.0.0.1:8943';
const SIZE = 3 * 1048576 + 4321; // more than three 1 MiB reads
const FILE = Buffer.alloc(SIZE); for (let i = 0, x = 7; i < SIZE; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; FILE[i] = x >>> 16; }
const SHA = createHash('sha256').update(FILE).digest('hex');
let browser;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, ORIGIN).pathname;
  try {
    const body = path === '/file.bin' ? FILE : await readFile(ROOT + path);
    res.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
before(async () => { await new Promise(r => server.listen(8943, '127.0.0.1', r)); browser = await chromium.launch(); });
after(async () => { await browser.close(); await new Promise(r => server.close(r)); });
const mockSDK = `export class AutonomiClient {
  static async connect() { window.connections=(window.connections||0)+1; return window.client={closed:false, close(){this.closed=true}, async openFile(address,{signal}) {
    if(window.rejectDirect) throw Error('network offline');
    const bytes=window.hugeFile?null:new Uint8Array(await (await fetch('/file.bin',{signal})).arrayBuffer());
    let closed=false; return {address,name:'network-name.bin',size:window.hugeFile||bytes.length,contentType:'application/octet-stream',
      close(){closed=true;window.closedReaders=(window.closedReaders||0)+1},
      async read(start,length){if(closed)throw Error('closed reader');window.reads=(window.reads||0)+1;if(window.failReads&&start>=1048576&&(window.failReads==='always'||!(window.failed=(window.failed||0)+1,window.failed>2)))throw Error('range lost');if(window.slowReads)await new Promise(r=>setTimeout(r,400));return bytes.slice(start,start+length);}};
  }}; }
}`;
// picker: 'file' = a File System Access handle that records what is written; 'none' = no picker in
// this browser; 'cancel' = the person closes the save window.
async function open(hash, { picker = 'file', flags = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.addInitScript(({ picker, flags }) => {
    Object.assign(window, flags); localStorage.setItem('blang', 'en'); localStorage.setItem('bregister', 'bee');
    window.written = []; window.pickerNames = [];
    if (picker === 'none') delete window.showSaveFilePicker;
    else window.showSaveFilePicker = async options => {
      window.pickerNames.push(options.suggestedName);
      if (picker === 'cancel') throw new DOMException('closed', 'AbortError');
      return { name: options.suggestedName, createWritable: async () => ({
        write: async bytes => { window.written.push(bytes.slice()); }, close: async () => { window.closedFile = true; }, abort: async () => { window.abortedFile = true; } }) };
    };
  }, { picker, flags });
  const page = await ctx.newPage(), errors = [], relay = [];
  page.on('pageerror', e => errors.push(String(e)));
  await ctx.route('**/vendor/ant-browser-sdk/0.1.0/index.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: mockSDK }));
  await ctx.route('https://relay.skaists.dev/**', r => { relay.push(r.request().url()); return r.fulfill({ status: 503, headers: { 'access-control-allow-origin': ORIGIN }, body: '' }); });
  await page.goto(ORIGIN + '/surfaces/bview.html' + hash);
  return { ctx, page, errors, relay };
}
const status = page => page.locator('#save-status').textContent();
const saved = page => page.waitForFunction(() => /^(saved|could not|stopped|nothing|this file is)/.test(document.querySelector('#save-status').textContent), null, { timeout: 20000 });

test('a link that names a file is offered to save, never played; it is written in order as it arrives', async () => {
  const { ctx, page, errors, relay } = await open('#a=' + ADDRESS + '&n=my-mod-v1.2.zip&s=' + SIZE);
  try {
    assert.match(await status(page), /this link is a file, not a video: my-mod-v1\.2\.zip · 3\.0 MB\. press save file/);
    assert.equal(await page.inputValue('#addr'), 'autonomi://' + ADDRESS);
    assert.equal(await page.locator('#out').isHidden(), true);
    await page.click('#save-file'); await saved(page);
    assert.equal(await status(page), 'saved my-mod-v1.2.zip · 3.0 MB.');
    const got = await page.evaluate(async () => {
      const all = new Uint8Array(await new Blob(window.written).arrayBuffer());
      const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', all))].map(b => b.toString(16).padStart(2, '0')).join('');
      return { sha, writes: window.written.length, largest: Math.max(...window.written.map(b => b.byteLength)), names: window.pickerNames, closedFile: window.closedFile, aborted: !!window.abortedFile,
        readers: window.closedReaders, pool: window.client.closed, connections: window.connections, busy: document.querySelector('#save-file').disabled, stop: document.querySelector('#save-stop').hidden, pg: document.querySelector('#save-pg').hidden };
    });
    assert.equal(got.sha, SHA); assert.equal(got.writes, 4); assert.ok(got.largest <= 1048576, 'no write larger than one read');
    assert.deepEqual(got.names, ['my-mod-v1.2.zip']); assert.equal(got.closedFile, true); assert.equal(got.aborted, false);
    assert.equal(got.readers, 1); assert.equal(got.connections, 1); assert.equal(got.pool, true, 'on the relay route the connection is closed after the save');
    assert.deepEqual([got.busy, got.stop, got.pg], [false, true, true]);
    assert.equal(relay.length, 0); assert.deepEqual(errors, []);
    console.log('# save to a chosen file: ' + SIZE + ' B in ' + got.writes + ' ordered writes, sha256 matches, reader and connection closed, relay untouched');
  } finally { await ctx.close(); }
});

test('without a file picker the file is held in memory and handed to the browser as a download', async () => {
  const { ctx, page, errors, relay } = await open('#a=' + ADDRESS + '&n=notes.txt&s=5', { picker: 'none' });
  try {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save-file')]);
    assert.equal(download.suggestedFilename(), 'notes.txt');
    assert.equal(createHash('sha256').update(await readFile(await download.path())).digest('hex'), SHA);
    await saved(page);
    assert.equal(await status(page), 'saved notes.txt · 3.0 MB. look in the downloads of this browser. the link said 5 B; the network holds ' + SIZE + ' B.');
    assert.equal(relay.length, 0); assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('without a file picker a file too large for memory is refused in words before any byte is read', async () => {
  const { ctx, page, errors } = await open('#' + ADDRESS, { picker: 'none', flags: { hugeFile: 300 * 1048576 } });
  try {
    await page.click('#save-file'); await saved(page);
    assert.match(await status(page), /^this file is 300 MB\. this browser cannot write it straight to a file, and that is too large to hold in memory\./);
    assert.equal(await page.evaluate(() => window.reads || 0), 0); assert.equal(await page.evaluate(() => window.closedReaders), 1);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('with a file picker the same large file is not refused: its size never has to fit in memory', async () => {
  const { ctx, page } = await open('#' + ADDRESS, { flags: { hugeFile: 300 * 1048576, slowReads: true } });
  try {
    await page.click('#save-file');
    await page.waitForFunction(() => window.closedReaders === 1 || /^saving /.test(document.querySelector('#save-status').textContent), null, { timeout: 20000 });
    assert.doesNotMatch(await status(page), /too large/);
  } finally { await ctx.close(); }
});

test('stop ends the save, discards the partial file and says so; closing the save window saves nothing', async () => {
  const { ctx, page, errors } = await open('#' + ADDRESS, { flags: { slowReads: true } });
  try {
    await page.click('#save-file');
    await page.waitForFunction(() => window.written.length >= 1);
    assert.match(await status(page), /^saving autonomi-abababab\.bin|^saving network-name\.bin/);
    await page.click('#save-stop'); await saved(page);
    assert.equal(await status(page), 'stopped. no file was saved.');
    assert.deepEqual(await page.evaluate(() => [window.abortedFile, !!window.closedFile, window.closedReaders, document.querySelector('#save-file').disabled]), [true, false, 1, false]);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
  const second = await open('#' + ADDRESS, { picker: 'cancel' });
  try {
    await second.page.click('#save-file'); await saved(second.page);
    assert.equal(await status(second.page), 'nothing was saved: the save window was closed.');
    assert.equal(await second.page.evaluate(() => window.connections || 0), 0);
  } finally { await second.ctx.close(); }
});

test('a range that fails is asked for again; a range that keeps failing ends the save with the partial file discarded', async () => {
  const twice = await open('#' + ADDRESS, { flags: { failReads: 'twice' } });
  try {
    await twice.page.click('#save-file'); await saved(twice.page);
    assert.match(await status(twice.page), /^saved network-name\.bin · 3\.0 MB\.$/);
    const got = await twice.page.evaluate(async () => {
      const all = new Uint8Array(await new Blob(window.written).arrayBuffer());
      return { sha: [...new Uint8Array(await crypto.subtle.digest('SHA-256', all))].map(b => b.toString(16).padStart(2, '0')).join(''), reads: window.reads, writes: window.written.length };
    });
    assert.equal(got.sha, SHA); assert.equal(got.writes, 4); assert.equal(got.reads, 6, 'two failed reads were repeated, nothing was written twice');
    assert.deepEqual(twice.errors, []);
  } finally { await twice.ctx.close(); }
  const always = await open('#' + ADDRESS, { flags: { failReads: 'always' } });
  try {
    await always.page.click('#save-file'); await saved(always.page);
    assert.equal(await status(always.page), 'could not finish this file: Autonomi storage nodes stopped answering at 1.0 MB of 3.0 MB. no file was saved. try again in a few minutes.');
    assert.deepEqual(await always.page.evaluate(() => [window.reads, window.written.length, window.abortedFile, !!window.closedFile, window.closedReaders]), [4, 1, true, false, 1]);
    assert.deepEqual(always.errors, []);
  } finally { await always.ctx.close(); }
});

test('a network that does not answer ends in words, with no file', async () => {
  const { ctx, page, errors } = await open('#' + ADDRESS, { flags: { rejectDirect: true } });
  try {
    await page.click('#save-file'); await saved(page);
    assert.match(await status(page), /^could not save this file: .* no file was saved\. try again in a few minutes\.$/);
    assert.equal(await page.evaluate(() => window.written.length), 0); assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('no address: save asks for one. a pasted download-button link that names a video still plays, and keeps its name', async () => {
  const { ctx, page, errors, relay } = await open('');
  try {
    await page.click('#save-file');
    assert.match(await status(page), /^enter a complete address first/);
    await page.fill('#addr', 'https://example.org/mirror/d/?a=' + ADDRESS + '&n=first%20light.webm&s=77');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#out').dataset.addr);
    assert.equal(new URL(page.url()).hash, '#a=' + ADDRESS + '&n=first%20light.webm&s=77');
    assert.equal(await page.locator('#out').getAttribute('data-addr'), 'autonomi://' + ADDRESS);
    assert.equal(await status(page), 'this link names first light.webm · 77 B.');
    await page.waitForFunction(() => !document.querySelector('#s-fail').hidden, null, { timeout: 20000 });
    assert.ok(relay.length >= 1 && relay.every(url => url.includes(ADDRESS)), 'the player asked the (mocked) door for the address');
    await page.evaluate(() => { document.querySelector('#my-videos').open = true; }); await page.click('#save-video');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bnr.bview.playlist.v1')).videos), [{ address: ADDRESS, name: 'first light.webm' }]);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
