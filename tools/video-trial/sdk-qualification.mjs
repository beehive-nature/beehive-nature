// SDK qualification helpers: pinned digests, local serving checks, refusal.
// Offline: everything is verified against vendor/ant-browser-sdk/<version>/.
// No network, no wallet, no payment. Pin table lives in
// vendor/ant-browser-sdk/SDK_PINS.json (generated from the vendored bytes;
// e2e/bview-sdk-qualification.test.mjs re-verifies it on every run).
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SDK_TAG_COMMIT = '7c545016555f1a351595f1ac428c394b08fc84d8'; // PUBLIC-CONSTANT: upstream tag v0.1.5 = main at qualification
export const ANT_CLIENT_REV = '458c7175490e6934a5501e51ff1d80d784f27564'; // PUBLIC-CONSTANT: embedded ant-client revision from source.json
export const WASM_SHA256 = 'eea59cc4c493308242e3bcce004fe9c4937df3f1b15cf36ec04e1e25d4ab1ebf'; // PUBLIC-CONSTANT: expected 0.1.5 WASM digest
export const SDK_VERSIONS = ['0.1.2', '0.1.5'];

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

export function sdkDir(version) {
  return join(REPO, 'vendor', 'ant-browser-sdk', version);
}

export function sdkUrlPrefix(version) {
  return `/vendor/ant-browser-sdk/${version}/`;
}

export async function loadPins() {
  const raw = await readFile(join(REPO, 'vendor', 'ant-browser-sdk', 'SDK_PINS.json'), 'utf8');
  return JSON.parse(raw);
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/// Verify a vendored SDK directory against the pin table: every pinned
/// file must match in bytes and digest, and no extra JS/WASM file may
/// be present. Throws on the first mismatch (wrong version, tampered or
/// stale bytes). Returns { files, totalBytes }.
export async function verifySdkDir(version, dir = sdkDir(version), pins = null) {
  pins = pins || await loadPins();
  const table = pins[version];
  if (!table) throw Error(`unknown SDK version ${version}`);
  const seen = new Set();
  let totalBytes = 0;
  for (const rel of Object.keys(table).sort()) {
    const body = await readFile(join(dir, rel));
    const digest = sha256Hex(body);
    if (body.length !== table[rel].bytes || digest !== table[rel].sha256) {
      throw Error(`SDK ${version} mismatch: ${rel} served ${body.length} bytes sha256 ${digest}`);
    }
    seen.add(rel);
    totalBytes += body.length;
  }
  for (const sub of ['', 'internal', 'wasm']) {
    for (const name of await readdir(join(dir, sub))) {
      if (!/[.]m?js$|[.]wasm$/.test(name)) continue;
      const rel = sub ? `${sub}/${name}` : name;
      if (!seen.has(rel)) throw Error(`SDK ${version} has unpinned file ${rel}`);
    }
  }
  return { files: seen.size, totalBytes };
}

/// Check one served SDK response: non-200, unknown path, size or digest
/// mismatch all throw. Returns { rel, bytes, sha256 } for the receipt.
export function checkServedAsset(pins, version, rel, status, body) {
  const table = pins[version];
  if (!table) throw Error(`unknown SDK version ${version}`);
  const pin = table[rel];
  if (!pin) throw Error(`SDK ${version}: unexpected asset ${rel}`);
  if (status !== 200) throw Error(`SDK ${version}: ${rel} served HTTP ${status}`);
  const bytes = body.length;
  const sha256 = sha256Hex(body);
  if (bytes !== pin.bytes || sha256 !== pin.sha256) {
    throw Error(`SDK ${version} mismatch: ${rel} served ${bytes} bytes sha256 ${sha256}`);
  }
  return { rel, bytes, sha256 };
}

/// Overlay candidate HTML: rewrite the production SDK_ROOT to the
/// selected pinned version. Production bview.html is never edited.
export function htmlWithSdk(html, version) {
  if (!SDK_VERSIONS.includes(version)) throw Error(`unknown SDK version ${version}`);
  const out = html.replaceAll('/vendor/ant-browser-sdk/0.1.2/', sdkUrlPrefix(version));
  if (!out.includes(sdkUrlPrefix(version))) throw Error('candidate HTML carries no selectable SDK root');
  return out;
}

/// All relative JS imports reachable from the SDK entry points must
/// resolve to files inside the vendored directory (closed module graph).
export async function checkModuleClosure(dir, entries = ['index.js', 'client.js', 'file-reader.js', 'save.js', 'upload-worker.js']) {
  const missing = [];
  const visit = async (rel, trail) => {
    const src = await readFile(join(dir, rel), 'utf8');
    for (const match of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const base = rel.includes('/') ? dirname(rel) : '.';
      const resolved = join(base, match[1]).replace(/\\/g, '/');
      if (resolved === '.' || resolved.startsWith('..')) {
        missing.push(`${rel} -> ${match[1]}`);
        continue;
      }
      try {
        await readFile(join(dir, resolved));
      } catch {
        missing.push(`${rel} -> ${match[1]}`);
      }
      if (!trail.includes(resolved) && resolved.endsWith('.js')) {
        trail.push(resolved);
        await visit(resolved, trail);
      }
    }
  };
  for (const entry of entries) await visit(entry, [entry]);
  if (missing.length) throw Error(`SDK module graph leaks outside the vendor dir: ${missing.join(', ')}`);
  return true;
}

/// The reader closure (what bView executes for direct retrieval) must
/// contain no bare/external imports: no wallet, no payment network.
export async function checkReaderIsWalletFree(dir, entries = ['index.js', 'client.js', 'file-reader.js', 'manifest.js', 'pointers.js']) {
  const seen = new Set();
  const bad = [];
  const visit = async (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const src = await readFile(join(dir, rel), 'utf8');
    for (const match of src.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = match[1];
      if (!spec.startsWith('.')) bad.push(`${rel} imports ${spec}`);
      else {
        const base = rel.includes('/') ? dirname(rel) : '.';
        const resolved = join(base, spec).replace(/\\/g, '/');
        if (resolved === '.' || resolved.startsWith('..')) bad.push(`${rel} escapes to ${spec}`);
        else if (resolved.endsWith('.js')) await visit(resolved);
      }
    }
  };
  for (const entry of entries) {
    try {
      await visit(entry);
    } catch (error) {
      if (!/ENOENT/.test(error.message)) throw error;
    }
  }
  if (bad.length) throw Error(`reader closure pulls external modules: ${bad.join(', ')}`);
  return [...seen];
}
