/* Shared Connect + Store manifest reader for browser surfaces.
   It validates the language-neutral envelope before projecting any room state.
   This module never opens x0x, writes to Autonomi, charges, or approves payment. */
'use strict';

const HEX = /^[0-9a-f]+$/;
const KIND = /^[a-z0-9-]{1,64}$/;

function fail(message) { throw new Error(message); }
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(label);
}
function text(value, max, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) fail(label);
}
function ref(value) {
  exact(value, ['address', 'sha256', 'size'], 'manifest reference refused');
  if (!HEX.test(value.address) || !HEX.test(value.sha256) || !Number.isSafeInteger(value.size)
    || value.size <= 0 || value.size > 12 * 1024 * 1024 + 64) fail('manifest reference refused');
}
function validate(envelope) {
  exact(envelope, ['type', 'version', 'manifest'], 'manifest envelope refused');
  if (envelope.type !== 'bnr-manifest-envelope-v1' || envelope.version !== 1) fail('manifest envelope refused');
  const m = envelope.manifest;
  exact(m, ['channel', 'epoch', 'sequence', 'checkpoint', 'encrypted_items', 'credits', 'versions', 'admission'], 'manifest refused');
  if (!KIND.test(m.channel) || !Number.isSafeInteger(m.epoch) || m.epoch < 0
    || !Number.isSafeInteger(m.sequence) || m.sequence <= 0) fail('manifest identity refused');
  const cp = m.checkpoint;
  exact(cp, ['id', 'sequence', 'policy_id', 'ref'], 'manifest checkpoint refused');
  if (!HEX.test(cp.id) || !HEX.test(cp.policy_id) || cp.sequence !== m.sequence) fail('manifest checkpoint refused');
  ref(cp.ref);
  if (!Array.isArray(m.encrypted_items) || m.encrypted_items.length < 1 || m.encrypted_items.length > 16) fail('manifest items refused');
  const ids = new Set();
  for (const item of m.encrypted_items) {
    exact(item, ['id', 'kind', 'version', 'ref'], 'manifest item refused');
    if (!HEX.test(item.id) || ids.has(item.id) || !KIND.test(item.kind)
      || !Number.isSafeInteger(item.version) || item.version < 1 || item.version > 255) fail('manifest item refused');
    ids.add(item.id); ref(item.ref);
  }
  exact(m.credits, ['creator', 'source'], 'manifest credits refused');
  if (!Array.isArray(m.credits.creator) || !Array.isArray(m.credits.source)) fail('manifest credits refused');
  for (const creator of m.credits.creator) {
    exact(creator, ['pubkey', 'display_name'], 'manifest creator refused');
    if (!HEX.test(creator.pubkey)) fail('manifest creator refused');
    text(creator.display_name, 256, 'manifest creator refused');
  }
  for (const source of m.credits.source) {
    exact(source, ['uri', 'title', 'sha256'], 'manifest source refused');
    text(source.uri, 2048, 'manifest source refused');
    text(source.title, 256, 'manifest source refused');
    if (!HEX.test(source.sha256)) fail('manifest source refused');
  }
  exact(m.versions, ['manifest', 'channel', 'items'], 'manifest versions refused');
  for (const value of Object.values(m.versions)) if (!Number.isSafeInteger(value) || value < 1 || value > 255) fail('manifest versions refused');
  exact(m.admission, ['policy_id', 'max_bytes', 'max_items', 'payment', 'approval'], 'manifest admission refused');
  if (!HEX.test(m.admission.policy_id) || m.admission.policy_id !== cp.policy_id
    || !Number.isSafeInteger(m.admission.max_bytes) || m.admission.max_bytes <= 0
    || m.admission.max_bytes > 12 * 1024 * 1024 || !Number.isSafeInteger(m.admission.max_items)
    || m.admission.max_items <= 0 || m.admission.max_items > 16
    || !['disabled', 'capped'].includes(m.admission.payment) || !['none', 'trezor'].includes(m.admission.approval)) fail('manifest admission refused');
  return envelope;
}

export async function loadManifest(url = new URL('../fixtures/connect-store-manifest-envelope-v1.json', import.meta.url)) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) fail('manifest fetch refused');
  return validate(await response.json());
}

export function shortRef(value) {
  return typeof value === 'string' && value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
