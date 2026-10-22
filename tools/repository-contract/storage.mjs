// Independent byte storage. Rail addresses are locators, never integrity or authority.
import { bytesDigest, canonicalDocument, parseDocument, need, record, list, hash, integer, jsonValue, acceptUpdate } from './contract.mjs';
import { requirePrivacy } from './privacy.mjs';

export const MAX_DOCUMENT = 32 * 1024 * 1024;
export function descriptor(bytes) { return { digest: bytesDigest(bytes), bytes: bytes.length }; }
export function checkBytes(desc, bytes) {
  hash(desc.digest); integer(desc.bytes);
  need(bytes instanceof Uint8Array && bytes.length === desc.bytes && bytesDigest(bytes) === desc.digest, 'STORAGE_INTEGRITY');
  return Buffer.from(bytes);
}
export function location(loc) {
  record(loc, ['scheme', 'address']);
  need(loc.scheme === 'ar' ? /^[A-Za-z0-9_-]{43}$/.test(loc.address) : loc.scheme === 'ant' && /^[0-9a-f]{64}$/.test(loc.address), 'LOCATION');
}
export function pointer(p) {
  record(p, ['digest', 'bytes', 'locations']); hash(p.digest); integer(p.bytes);
  list(p.locations, 1, 8); p.locations.forEach(location);
  need(new Set(p.locations.map(l => `${l.scheme}:${l.address}`)).size === p.locations.length, 'DUPLICATE');
}
export function packet(candidate) {
  jsonValue(candidate); record(candidate, ['policy', 'manifest', 'proposal', 'signatures', 'evidence']);
  return candidate;
}
export function payloadEntries(candidate, payloads) {
  packet(candidate);
  const entries = new Map();
  for (const entry of [...candidate.manifest.source.objects, ...candidate.manifest.files]) {
    if (entries.has(entry.digest)) need(entries.get(entry.digest).bytes === entry.bytes, 'STORAGE_INTEGRITY');
    entries.set(entry.digest, { digest: entry.digest, bytes: entry.bytes });
  }
  for (const e of candidate.evidence) {
    const id = e.statement.observation_digest; hash(id);
    const bytes = payloads.get(id); need(bytes instanceof Uint8Array, 'MISSING_OBJECT');
    entries.set(id, { digest: id, bytes: bytes.length });
  }
  return [...entries.values()].sort((a, b) => a.digest.localeCompare(b.digest));
}

// Shared wallet-owned publication boundary for update roots and batch roots.
// The publisher must perform its complete semantic preflight before calling.
export async function publishPrivateBytes({ store, bytes: plain, rails, privacy }) {
  requirePrivacy(privacy);
  need(plain instanceof Uint8Array && plain.length <= 256 * 1024 * 1024, 'RESOURCE_LIMIT');
  need(Array.isArray(rails) && rails.length > 0 && rails.length <= 8, 'RAILS');
  need(new Set(rails.map(r => r.id)).size === rails.length, 'DUPLICATE');
  need(rails.every(r => typeof r.put === 'function' && typeof r.get === 'function'), 'USER_FUNDED_WRITER_REQUIRED');
  need(rails.every(r => typeof r.id === 'string' && r.id.length > 0 && ['ant', 'ar'].includes(r.scheme)), 'RAIL');
  const plainId = bytesDigest(plain);
  const bytes = store.sealed(plainId, privacy.audience) ?? store.keepSealed(plainId, privacy.audience, await privacy.seal(plain));
  const desc = descriptor(bytes); store.put(bytes); const locations = [];
  for (const rail of rails) {
    const previous = store.publication(desc.digest, rail.id); let loc;
    if (previous?.status === 'verified') { loc = previous.location; location(loc); need(loc.scheme === rail.scheme, 'RAIL'); }
    else {
      need(!previous, 'PUBLICATION_UNKNOWN', 'Reconcile the reserved put with an exact readback; do not repeat payment');
      store.reservePublication(desc.digest, rail.id);
      loc = { scheme: rail.scheme, address: await rail.put(Buffer.from(bytes)) }; location(loc);
    }
    checkBytes(desc, await rail.get(loc.address, desc.bytes)); store.confirmPublication(desc.digest, rail.id, loc);
    if (!locations.some(x => x.scheme === loc.scheme && x.address === loc.address)) locations.push(loc);
  }
  return { ...desc, locations };
}

// The caller explicitly supplies funded/authorized rails. This function neither
// selects a wallet nor invokes bPay. Atmirror still owns each put/get contract.
// Persist the reservation BEFORE calling put: an interrupted/ambiguous paid put
// must be reconciled by readback, never blindly re-issued after restart.
export async function publishBundle({ store, state, trustedStateDigest, candidate, payloads, rails, privacy }) {
  requirePrivacy(privacy);
  need(Array.isArray(rails) && rails.length > 0 && rails.length <= 8, 'RAILS');
  need(new Set(rails.map(r => r.id)).size === rails.length, 'DUPLICATE');
  need(rails.every(r => typeof r.put === 'function' && typeof r.get === 'function'), 'USER_FUNDED_WRITER_REQUIRED');
  const verdict = acceptUpdate({ state, trustedStateDigest, ...packet(candidate), payloads });
  need(verdict.accepted, verdict.code ?? 'ACCEPTANCE');
  const entries = payloadEntries(candidate, payloads);
  const limit = candidate.policy.max_bytes;
  need(entries.reduce((n, e) => n + e.bytes, 0) <= limit, 'RESOURCE_LIMIT');
  const publish = bytes => publishPrivateBytes({ store, bytes, rails, privacy });
  const objects = [];
  for (const e of entries) objects.push({ ...e, sealed: await publish(checkBytes(e, payloads.get(e.digest))) });
  const root = { schema: 'bnr.repository-storage/1', candidate, objects };
  const bytes = canonicalDocument(root); need(bytes.length <= MAX_DOCUMENT, 'RESOURCE_LIMIT');
  return { bundle: await publish(bytes), proposal_digest: verdict.proposal_digest, scope: 'byte-readback; retention and chain inclusion are separate' };
}

export async function reconcilePublication({ store, digest: id, rail, location: loc }) {
  location(loc); need(loc.scheme === rail.scheme, 'RAIL');
  need(store.publication(id, rail.id)?.status === 'reserved', 'PUBLICATION_STATE');
  const bytes = store.get(id); need(bytes, 'MISSING_OBJECT');
  checkBytes(descriptor(bytes), await rail.get(loc.address, bytes.length));
  store.confirmPublication(id, rail.id, loc);
}

export async function retrieve(p, { store, rails, maxBytes }) {
  pointer(p); integer(maxBytes); need(p.bytes <= maxBytes, 'RESOURCE_LIMIT');
  const local = store.get(p.digest);
  if (local) return checkBytes(p, local);
  for (const loc of p.locations) {
    for (const rail of rails.filter(r => r.scheme === loc.scheme)) {
      try {
        const bytes = checkBytes(p, await rail.get(loc.address, p.bytes));
        store.put(bytes); return bytes;
      } catch { /* Corrupt/unavailable replicas confer no authority; try the next. */ }
    }
  }
  need(false, 'STORAGE_UNAVAILABLE', `No verified bytes for ${p.digest}`);
}

export async function retrieveBundle(bundle, options) {
  requirePrivacy(options.privacy);
  const rootBytes = await options.privacy.open(await retrieve(bundle, { ...options, maxBytes: 2 * MAX_DOCUMENT + 65536 }));
  need(rootBytes.length <= MAX_DOCUMENT, 'RESOURCE_LIMIT');
  const root = parseDocument(rootBytes);
  record(root, ['schema', 'candidate', 'objects']); need(root.schema === 'bnr.repository-storage/1', 'VERSION');
  const candidate = packet(root.candidate); list(root.objects, 1);
  for (const o of root.objects) { record(o, ['digest', 'bytes', 'sealed']); hash(o.digest); integer(o.bytes); pointer(o.sealed); }
  need(new Set(root.objects.map(e => e.digest)).size === root.objects.length, 'DUPLICATE');
  const max = Math.min(options.maxBytes, candidate.policy.max_bytes); integer(max, 1);
  need(root.objects.reduce((n, e) => n + e.bytes, 0) <= max, 'RESOURCE_LIMIT');
  const payloads = new Map();
  for (const e of root.objects) {
    need(e.sealed.bytes <= Math.max(65536, 2 * e.bytes + 65536), 'RESOURCE_LIMIT');
    payloads.set(e.digest, checkBytes(e, await options.privacy.open(await retrieve(e.sealed, { ...options, maxBytes: Math.max(65536, 2 * max + 65536) }))));
  }
  const expected = payloadEntries(candidate, payloads);
  need(expected.length === root.objects.length && expected.every(e => root.objects.some(o => o.digest === e.digest && o.bytes === e.bytes)), 'OBJECT_SET');
  return { candidate, payloads };
}

export function notice({ topic, bundle }) {
  hash(topic); pointer(bundle);
  // Random wallet-held routing topic, not a hash of a guessable repo/name/DID.
  return { schema: 'bnr.repository-checkpoint/2', topic, bundle };
}
