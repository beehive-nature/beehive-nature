// ANT Browser SDK 0.1.5 qualification (offline half).
// Live AB/BA retrieval blocks are NOT here: they need the public ANT
// network and are recorded separately. Everything below runs offline
// against vendor/ant-browser-sdk/** with zero network, wallet or payment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  ANT_CLIENT_REV,
  SDK_TAG_COMMIT,
  SDK_VERSIONS,
  WASM_SHA256,
  checkModuleClosure,
  checkReaderIsWalletFree,
  checkServedAsset,
  htmlWithSdk,
  loadPins,
  sdkDir,
  verifySdkDir,
} from '../tools/video-trial/sdk-qualification.mjs';

const root = resolve(import.meta.dirname, '..');

test('pin table matches the vendored bytes of both SDKs', async () => {
  const pins = await loadPins();
  assert.deepEqual(Object.keys(pins).filter((k) => k !== 'PUBLIC-CONSTANT').sort(), SDK_VERSIONS);
  for (const version of SDK_VERSIONS) {
    const { files, totalBytes } = await verifySdkDir(version, sdkDir(version), pins);
    assert.ok(files > 25 && totalBytes > 1_000_000, `${version}: ${files} files, ${totalBytes} bytes`);
  }
});

test('candidate provenance pins are the recorded values', async () => {
  const pins = await loadPins();
  assert.equal(pins['0.1.5']['wasm/ant_core_bg.wasm'].sha256, WASM_SHA256);
  assert.equal(WASM_SHA256, 'eea59cc4c493308242e3bcce004fe9c4937df3f1b15cf36ec04e1e25d4ab1ebf'); // PUBLIC-CONSTANT: expected candidate digest
  assert.equal(SDK_TAG_COMMIT, '7c545016555f1a351595f1ac428c394b08fc84d8');
  assert.equal(ANT_CLIENT_REV, '458c7175490e6934a5501e51ff1d80d784f27564');
  assert.notEqual(pins['0.1.5']['wasm/ant_core_bg.wasm'].sha256, pins['0.1.2']['wasm/ant_core_bg.wasm'].sha256);
  assert.notEqual(pins['0.1.5']['client.js'].sha256, pins['0.1.2']['client.js'].sha256);
});

test('module graphs stay inside the vendor dir', async () => {
  for (const version of SDK_VERSIONS) await checkModuleClosure(sdkDir(version));
});

test('reader closures import no wallet or payment modules', async () => {
  for (const version of SDK_VERSIONS) {
    const seen = await checkReaderIsWalletFree(sdkDir(version));
    assert.ok(seen.includes('client.js') && seen.includes('file-reader.js'), version);
  }
});

test('candidate HTML overlay selects the pinned SDK', async () => {
  const html = await readFile(join(root, 'surfaces', 'bview.html'), 'utf8');
  assert.ok(html.includes('/vendor/ant-browser-sdk/0.1.2/'), 'production still pins 0.1.2');
  const overlaid = htmlWithSdk(html, '0.1.5');
  assert.ok(overlaid.includes('/vendor/ant-browser-sdk/0.1.5/'));
  assert.ok(!overlaid.includes('/vendor/ant-browser-sdk/0.1.2/'), 'no stale SDK root remains');
  assert.throws(() => htmlWithSdk(html, '9.9.9'), /unknown SDK version/);
});

test('wrong-asset regression: tampered, wrong-version and failed assets are refused', async (t) => {
  const pins = await loadPins();
  const tampered = await mkdtemp(join(tmpdir(), 'sdk-wrong-'));
  t.after(async () => (await import('node:fs/promises')).rm(tampered, { recursive: true, force: true }));
  await cp(sdkDir('0.1.5'), tampered, { recursive: true });
  await writeFile(join(tampered, 'client.js'), '/* tampered */');
  await assert.rejects(verifySdkDir('0.1.5', tampered, pins), /mismatch/);
  const good = await readFile(join(sdkDir('0.1.5'), 'index.js'));
  assert.deepEqual(checkServedAsset(pins, '0.1.5', 'index.js', 200, good).sha256, pins['0.1.5']['index.js'].sha256);
  assert.throws(() => checkServedAsset(pins, '0.1.5', 'index.js', 200, Buffer.from('stale')), /mismatch/);
  assert.throws(() => checkServedAsset(pins, '0.1.5', 'index.js', 500, good), /HTTP 500/);
  assert.throws(() => checkServedAsset(pins, '0.1.5', 'nope.js', 200, good), /unexpected asset/);
  const older = await readFile(join(sdkDir('0.1.2'), 'index.js'));
  assert.throws(() => checkServedAsset(pins, '0.1.5', 'index.js', 200, older), /mismatch/, '0.1.2 bytes under 0.1.5 URLs are refused');
});

test('browser loads the real pinned SDK modules and served bytes hash clean', { timeout: 120000 }, async (t) => {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    t.skip('playwright not installed');
    return;
  }
  const pins = await loadPins();
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch {
    t.skip('no Chrome available');
    return;
  }
  const served = [];
  const context = await browser.newContext();
  try {
    await context.route('https://sdk-qual.local/**', async (route) => {
      const rel = new URL(route.request().url()).pathname.slice(1);
      try {
        const body = await readFile(join(sdkDir('0.1.5'), rel));
        served.push({ rel, status: 200, body });
        const type = rel.endsWith('.wasm') ? 'application/wasm' : 'text/javascript';
        return route.fulfill({ body, contentType: type });
      } catch {
        served.push({ rel, status: 404, body: Buffer.of() });
        return route.fulfill({ status: 404 });
      }
    });
    const page = await context.newPage();
    const exports = await page.evaluate(async () => {
      const sdk = await import('https://sdk-qual.local/index.js');
      return Object.keys(sdk).sort();
    });
    for (const name of ['AutonomiClient', 'PublicFileReader', 'decodeManifest', 'pointerAddress']) {
      assert.ok(exports.includes(name), `SDK exports ${name}: ${exports.join(',')}`);
    }
    for (const { rel, status, body } of served) {
      checkServedAsset(pins, '0.1.5', rel, status, body);
    }
    assert.ok(served.some((s) => s.rel === 'index.js'));
    assert.ok(served.some((s) => s.rel === 'client.js'));
  } finally {
    await context.close();
    await browser.close();
  }
});
