// Thin Node/Playwright transport for the native Rust SDK qualifier.
// Hashing, pin checks, HTML selection, module-graph policy and receipt
// qualification run in tools/ant-sdk-qualification. No fallback verifier.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SDK_TAG_COMMIT = '7c545016555f1a351595f1ac428c394b08fc84d8'; // PUBLIC-CONSTANT: upstream v0.1.5
export const ANT_CLIENT_REV = '458c7175490e6934a5501e51ff1d80d784f27564'; // PUBLIC-CONSTANT: embedded ant-client
export const WASM_SHA256 = 'eea59cc4c493308242e3bcce004fe9c4937df3f1b15cf36ec04e1e25d4ab1ebf'; // PUBLIC-CONSTANT: candidate WASM
export const SDK_VERSIONS = ['0.1.2', '0.1.5'];

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const MAX_BYTES = 64 * 1024 * 1024;

export function nativeQualification(op, args = {}) {
  const binary = process.env.BNR_SDK_QUALIFIER || join(REPO, 'target', 'ant-sdk-qualification', 'release',
    process.platform === 'win32' ? 'ant-sdk-qualification.exe' : 'ant-sdk-qualification');
  let output;
  try {
    output = execFileSync(binary, [], {
      input: JSON.stringify({ op, repo: REPO, ...args }),
      encoding: 'utf8',
      maxBuffer: MAX_BYTES,
      timeout: 30_000,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Error('native SDK qualifier is not built; run cargo build --manifest-path tools/ant-sdk-qualification/Cargo.toml --locked --release --target-dir target/ant-sdk-qualification');
    }
    throw Error(String(error.stderr || error.message).trim());
  }
  return JSON.parse(output);
}

export function sdkDir(version) {
  return join(REPO, 'vendor', 'ant-browser-sdk', version);
}

export function sdkUrlPrefix(version) {
  return `/vendor/ant-browser-sdk/${version}/`;
}

export async function loadPins() {
  return JSON.parse(await readFile(join(REPO, 'vendor', 'ant-browser-sdk', 'SDK_PINS.json'), 'utf8'));
}

export function sha256Hex(bytes) {
  return nativeQualification('sha256', { body_b64: Buffer.from(bytes).toString('base64') });
}

export async function verifySdkDir(version, dir = sdkDir(version), pins = null) {
  return nativeQualification('verify-dir', { version, dir, ...(pins ? { pins } : {}) });
}

export function checkServedAsset(pins, version, rel, status, body) {
  return nativeQualification('served', { pins, version, rel, status, body_b64: Buffer.from(body).toString('base64') });
}

export function htmlWithSdk(html, version) {
  return nativeQualification('overlay', { html, version });
}

export async function checkModuleClosure(dir, entries = ['index.js', 'client.js', 'file-reader.js', 'save.js', 'upload-worker.js']) {
  return nativeQualification('module-closure', { dir, entries });
}

export async function checkReaderIsWalletFree(dir, entries = ['index.js', 'client.js', 'file-reader.js', 'manifest.js', 'pointers.js']) {
  return nativeQualification('reader-closure', { dir, entries });
}
