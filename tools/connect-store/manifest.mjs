import { exact, hex, LIMITS, parse, requireThat } from './core.mjs';

// This JSON shape is intentionally transport-neutral. Node, W@tch and Music
// Jam clients can validate the same envelope without importing this module.
export const MANIFEST_LIMITS = Object.freeze({ bytes: 2 * LIMITS.checkpoint, items: 16, credits: 16 });

function boundedText(value, max, code = 'invalid-manifest') {
  requireThat(typeof value === 'string' && value.length > 0 && value.length <= max, code);
}

function checkedRef(ref) {
  exact(ref, ['address', 'sha256', 'size']);
  requireThat(hex(ref.address) && hex(ref.sha256) && Number.isSafeInteger(ref.size)
    && ref.size > 0 && ref.size <= LIMITS.snapshot + 64, 'invalid-manifest-reference');
  return ref;
}

function checkedCheckpoint(checkpoint, sequence) {
  exact(checkpoint, ['id', 'sequence', 'policy_id', 'ref']);
  requireThat(hex(checkpoint.id) && hex(checkpoint.policy_id) && checkpoint.sequence === sequence,
    'invalid-manifest-checkpoint');
  checkedRef(checkpoint.ref);
  return checkpoint;
}

function checkedItems(items) {
  requireThat(Array.isArray(items) && items.length > 0 && items.length <= MANIFEST_LIMITS.items,
    'invalid-manifest-items');
  for (const item of items) {
    exact(item, ['id', 'kind', 'version', 'ref']);
    requireThat(hex(item.id) && /^[a-z0-9-]{1,64}$/.test(item.kind)
      && Number.isSafeInteger(item.version) && item.version >= 1 && item.version <= 255,
    'invalid-manifest-item');
    checkedRef(item.ref);
  }
  requireThat(new Set(items.map(item => item.id)).size === items.length, 'duplicate-manifest-item');
  return items;
}

function checkedCredits(credits) {
  exact(credits, ['creator', 'source']);
  for (const [role, rows] of Object.entries(credits)) {
    requireThat(Array.isArray(rows) && rows.length <= MANIFEST_LIMITS.credits, 'invalid-manifest-credits');
    for (const row of rows) {
      if (role === 'creator') {
        exact(row, ['pubkey', 'display_name']);
        requireThat(hex(row.pubkey), 'invalid-manifest-creator');
        boundedText(row.display_name, 256, 'invalid-manifest-creator');
      } else {
        exact(row, ['uri', 'title', 'sha256']);
        boundedText(row.uri, 2048, 'invalid-manifest-source');
        boundedText(row.title, 256, 'invalid-manifest-source');
        requireThat(hex(row.sha256), 'invalid-manifest-source');
      }
    }
  }
  return credits;
}

function checkedVersions(versions) {
  exact(versions, ['manifest', 'channel', 'items']);
  for (const value of Object.values(versions))
    requireThat(Number.isSafeInteger(value) && value >= 1 && value <= 255, 'invalid-manifest-version');
  return versions;
}

function checkedAdmission(admission) {
  exact(admission, ['policy_id', 'max_bytes', 'max_items', 'payment', 'approval']);
  requireThat(hex(admission.policy_id)
    && Number.isSafeInteger(admission.max_bytes) && admission.max_bytes > 0
    && admission.max_bytes <= LIMITS.writeBytesPerProcess
    && Number.isSafeInteger(admission.max_items) && admission.max_items > 0
    && admission.max_items <= MANIFEST_LIMITS.items
    && ['disabled', 'capped'].includes(admission.payment)
    && ['none', 'trezor'].includes(admission.approval), 'invalid-manifest-admission');
  return admission;
}

export function parseManifestEnvelope(input) {
  const envelope = Buffer.isBuffer(input) ? parse(input, MANIFEST_LIMITS.bytes) : input;
  exact(envelope, ['type', 'version', 'manifest']);
  requireThat(envelope.type === 'bnr-manifest-envelope-v1' && envelope.version === 1, 'invalid-manifest-envelope');
  const manifest = envelope.manifest;
  exact(manifest, ['channel', 'epoch', 'sequence', 'checkpoint', 'encrypted_items', 'credits', 'versions', 'admission']);
  requireThat(/^[a-z0-9-]{1,64}$/.test(manifest.channel)
    && Number.isSafeInteger(manifest.epoch) && manifest.epoch >= 0
    && Number.isSafeInteger(manifest.sequence) && manifest.sequence > 0, 'invalid-manifest');
  checkedCheckpoint(manifest.checkpoint, manifest.sequence);
  checkedItems(manifest.encrypted_items);
  checkedCredits(manifest.credits);
  checkedVersions(manifest.versions);
  checkedAdmission(manifest.admission);
  requireThat(manifest.admission.policy_id === manifest.checkpoint.policy_id, 'manifest-policy-mismatch');
  return structuredClone(envelope);
}

export function checkpointNotice(manifestEnvelope) {
  const envelope = parseManifestEnvelope(manifestEnvelope);
  const { checkpoint } = envelope.manifest;
  return { type: 'bnr-channel-checkpoint-v1', ...checkpoint };
}
