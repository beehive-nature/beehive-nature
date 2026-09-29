/* Browser-side read adapter for encrypted Autonomi-compatible objects.
   The gateway returns ciphertext only. This module verifies the bounded
   response's size and SHA-256 before handing bytes to a future decryptor.
   It has no write, payment, wallet, or raw x0x transport path. */
'use strict';

import { validateManifestEnvelope, validateReference } from './manifest-reader.js';

export const STORE_LIMITS = Object.freeze({
  objectBytes: 12 * 1024 * 1024 + 64,
  batchItems: 16,
  batchBytes: 24 * 1024 * 1024,
});

const HEX = /^[0-9a-f]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function fail(code) { throw new Error(code); }

function endpointUrl(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 2048) fail('store-endpoint-refused');
  let url;
  try { url = new URL(endpoint); } catch { fail('store-endpoint-refused'); }
  if (url.username || url.password || url.search || url.hash || url.origin === 'null') fail('store-endpoint-refused');
  if (url.protocol !== 'https:'
    && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) fail('store-endpoint-refused');
  return url;
}

function strictBase64(value, maxBytes) {
  if (typeof value !== 'string' || value.length === 0 || value.length > Math.ceil(maxBytes / 3) * 4) fail('store-payload-refused');
  if (!BASE64.test(value)) fail('store-payload-refused');
  let binary;
  try { binary = atob(value); } catch { fail('store-payload-refused'); }
  if (binary.length > maxBytes || btoa(binary) !== value) fail('store-payload-refused');
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function responseBytes(response, maxBytes) {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) fail('store-response-limit');
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > maxBytes) fail('store-response-limit');
    return bytes;
  }
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        fail('store-response-limit');
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) fail('store-crypto-unavailable');
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

function checkedRef(ref) {
  validateReference(ref);
  if (!HEX.test(ref.address) || !HEX.test(ref.sha256)) fail('store-reference-refused');
  return ref;
}

export async function readEncryptedObject(ref, {
  endpoint,
  maxBytes = ref?.size,
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  checkedRef(ref);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > STORE_LIMITS.objectBytes || ref.size > maxBytes)
    fail('store-budget-refused');
  const base = endpointUrl(endpoint);
  if (typeof fetchImpl !== 'function') fail('store-fetch-unavailable');
  const url = new URL(`/v1/data/public/${ref.address}`, base.origin).href;
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET', redirect: 'error', cache: 'no-store',
      headers: { accept: 'application/json' },
    });
  } catch { fail('store-request-failed'); }
  if (!response.ok) fail('store-http-refused');
  const responseLimit = Math.ceil(maxBytes / 3) * 4 + 128;
  const body = await responseBytes(response, responseLimit);
  let envelope;
  try { envelope = JSON.parse(new TextDecoder().decode(body)); } catch { fail('store-json-refused'); }
  if (!envelope || Array.isArray(envelope) || typeof envelope !== 'object'
    || Object.keys(envelope).length !== 1 || envelope.data === undefined) fail('store-json-refused');
  const bytes = strictBase64(envelope.data, maxBytes);
  if (bytes.length !== ref.size) fail('store-size-mismatch');
  if (await sha256(bytes) !== ref.sha256) fail('store-integrity-mismatch');
  return bytes;
}

export async function readEncryptedItems(envelope, options = {}) {
  const checked = validateManifestEnvelope(envelope);
  const maxItems = options.maxItems ?? checked.manifest.encrypted_items.length;
  const maxTotalBytes = options.maxTotalBytes ?? STORE_LIMITS.batchBytes;
  if (!Number.isSafeInteger(maxItems) || maxItems < 1 || maxItems > STORE_LIMITS.batchItems
    || !Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 1 || maxTotalBytes > STORE_LIMITS.batchBytes
    || maxItems > checked.manifest.encrypted_items.length) fail('store-batch-budget-refused');
  const results = [];
  let total = 0;
  for (const item of checked.manifest.encrypted_items.slice(0, maxItems)) {
    if (total + item.ref.size > maxTotalBytes) fail('store-batch-budget-refused');
    const bytes = await readEncryptedObject(item.ref, options);
    total += bytes.length;
    results.push({ id: item.id, kind: item.kind, version: item.version, ref: item.ref, bytes });
  }
  return results;
}
