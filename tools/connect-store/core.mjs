// Isolated channel prototype. Gateways are trusted with the channel key;
// backing storage and notification transports are not trusted with plaintext.
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { finalizeEvent, getPublicKey, verifyEvent } from 'nostr-tools/pure';

export const LIMITS = Object.freeze({ event: 16384, events: 128, file: 1048576,
  files: 8, snapshot: 12582912, checkpoint: 16384, members: 16, writeBytesPerProcess: 33554432 });
export const hex = (s, length = 64) => typeof s === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(s);
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const encode = value => Buffer.from(JSON.stringify(value));
export const now = () => Math.floor(Date.now() / 1000);
export function requireThat(ok, code, status = 400) {
  if (!ok) throw Object.assign(new Error(code), { code, status });
}
export function parse(bytes, max) {
  requireThat(bytes.length <= max, 'size-limit', 413);
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { requireThat(false, 'invalid-json'); }
}
export function exact(value, fields) {
  requireThat(value && !Array.isArray(value) && typeof value === 'object', 'invalid-object');
  requireThat(Object.keys(value).sort().join('|') === [...fields].sort().join('|'), 'invalid-fields');
}
export function tag(event, name) {
  const matches = event.tags.filter(t => t[0] === name);
  requireThat(matches.length === 1 && matches[0].length === 2, 'ambiguous-tag');
  return matches[0][1];
}
export function checkedEvent(input, max = LIMITS.event) {
  // Drop verification-cache Symbols at every trust boundary; verify fresh bytes.
  const event = parse(encode(input), max);
  exact(event, ['id', 'pubkey', 'sig', 'kind', 'created_at', 'tags', 'content']);
  requireThat(hex(event.id) && hex(event.pubkey) && hex(event.sig, 128), 'invalid-signature');
  requireThat(Number.isSafeInteger(event.kind) && event.kind >= 0 && Number.isSafeInteger(event.created_at)
    && event.created_at >= 0 && typeof event.content === 'string', 'invalid-event');
  requireThat(Array.isArray(event.tags) && event.tags.length <= 64 && event.tags.every(t =>
    Array.isArray(t) && t.length <= 12 && t.every(s => typeof s === 'string' && s.length <= 2048)), 'invalid-tags');
  requireThat(verifyEvent(event), 'invalid-signature', 401);
  return JSON.parse(JSON.stringify(event));
}
export function signed(key, kind, tags, content, created_at = now()) {
  return JSON.parse(JSON.stringify(finalizeEvent({ kind, tags, content, created_at }, key)));
}
export function checkPolicy(input, expectedOwner, expectedId) {
  const event = checkedEvent(input);
  requireThat(hex(expectedOwner) && hex(expectedId) && event.pubkey === expectedOwner
    && event.id === expectedId && event.kind === 30078 && tag(event, 'd') === 'bnr-channel-policy-v1', 'policy-pin', 403);
  const p = parse(Buffer.from(event.content), LIMITS.event);
  exact(p, ['version', 'channel', 'origin', 'members', 'writer', 'expires_at']);
  requireThat(p.version === 1 && /^[a-z0-9-]{1,64}$/.test(p.channel), 'invalid-policy');
  let origin;
  try { origin = new URL(p.origin); } catch { requireThat(false, 'invalid-origin'); }
  requireThat(origin.protocol === 'https:' && origin.origin === p.origin && !origin.username && !origin.password, 'invalid-origin');
  requireThat(Array.isArray(p.members) && p.members.length > 0 && p.members.length <= LIMITS.members
    && p.members.every(k => hex(k)) && new Set(p.members).size === p.members.length && hex(p.writer), 'invalid-policy');
  requireThat(Number.isSafeInteger(p.expires_at) && p.expires_at > event.created_at, 'invalid-policy');
  return { event, ...p };
}
function checkRef(ref) {
  exact(ref, ['address', 'sha256', 'size']);
  requireThat(hex(ref.address) && hex(ref.sha256) && Number.isSafeInteger(ref.size)
    && ref.size > 0 && ref.size <= LIMITS.snapshot + 64, 'invalid-reference');
}
function seal(bytes, key, policyId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`bnr-channel-snapshot-v1:${policyId}`));
  return Buffer.concat([iv, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
}
function unseal(bytes, key, policyId) {
  requireThat(bytes.length >= 28, 'invalid-ciphertext');
  try {
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    cipher.setAAD(Buffer.from(`bnr-channel-snapshot-v1:${policyId}`));
    cipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]);
  } catch { requireThat(false, 'ciphertext-authentication', 409); }
}
export async function fetchRef(store, ref, max) {
  checkRef(ref);
  requireThat(ref.size <= max, 'size-limit', 413);
  const bytes = await store.get(ref.address, ref.size);
  requireThat(bytes.length === ref.size && hash(bytes) === ref.sha256, 'object-integrity', 409);
  return bytes;
}
async function putVerified(store, bytes) {
  const address = await store.put(bytes);
  const ref = { address, sha256: hash(bytes), size: bytes.length };
  await fetchRef(store, ref, bytes.length); // No acknowledgement before read-back.
  return ref;
}

export class Channel extends EventEmitter {
  #key; #writer; #state = { sequence: 0, events: [], files: [] }; #pin = null; #busy = false;
  #writeRemaining = LIMITS.writeBytesPerProcess;
  constructor({ policy, owner, policyId, key, writer, store, live }) {
    super();
    this.policy = checkPolicy(policy, owner, policyId);
    // The parsed policy is private to this instance's admission decisions.
    Object.freeze(this.policy.members); Object.freeze(this.policy.event); Object.freeze(this.policy);
    requireThat(key instanceof Uint8Array && key.length === 32, 'invalid-channel-key');
    if (writer) requireThat(getPublicKey(writer) === this.policy.writer, 'writer-not-authorized', 403);
    this.#key = Buffer.from(key); this.#writer = writer && Uint8Array.from(writer);
    this.store = store; this.live = live;
  }
  get pin() { return this.#pin && structuredClone(this.#pin); }
  authorize(pubkey) {
    requireThat(now() < this.policy.expires_at, 'policy-expired', 403);
    requireThat(this.policy.members.includes(pubkey), 'membership-required', 403);
  }
  #message(input) {
    const e = checkedEvent(input);
    requireThat(e.kind === 9 && tag(e, 'h') === this.policy.channel, 'unsupported-event');
    requireThat(this.policy.members.includes(e.pubkey), 'unauthorized-author', 403);
    return e;
  }
  async #exclusive(action) {
    requireThat(!this.#busy, 'operation-in-progress', 409);
    this.#busy = true;
    try { return await action(); } finally { this.#busy = false; }
  }
  async #commit(next) {
    requireThat(this.#writer, 'read-only-gateway', 403);
    next.sequence = this.#state.sequence + 1;
    const bytes = encode(next);
    requireThat(bytes.length <= LIMITS.snapshot, 'snapshot-limit', 413);
    const data = await this.#put(seal(bytes, this.#key, this.policy.event.id));
    const checkpoint = signed(this.#writer, 30078, [['d', 'bnr-channel-checkpoint-v1']], JSON.stringify({
      version: 1, policy_id: this.policy.event.id, sequence: next.sequence,
      parent: this.#pin?.id ?? null, event_count: next.events.length, data,
    }));
    const ref = await this.#put(encode(checkpoint));
    const pin = { id: checkpoint.id, sequence: next.sequence, policy_id: this.policy.event.id, ref };
    this.#state = next; this.#pin = pin;
    this.emit('committed');
    let notificationAccepted = false;
    if (this.live) {
      try { await this.live.publish({ type: 'bnr-channel-checkpoint-v1', ...pin }); notificationAccepted = true; }
      catch { /* Stored acknowledgement stays true; live delivery is explicitly false. */ }
    }
    return { checkpoint: this.pin, stored: true, notification_accepted: notificationAccepted };
  }
  async #put(bytes) {
    requireThat(bytes.length <= this.#writeRemaining, 'process-write-budget', 429);
    // Failed attempts consume this budget too. This is a process-local resource
    // bound, not a persistent billing cap or permission to restart to spend more.
    this.#writeRemaining -= bytes.length;
    return putVerified(this.store, bytes);
  }
  async publish(pubkey, input) {
    return this.#exclusive(async () => {
      this.authorize(pubkey);
      requireThat(this.#writer, 'read-only-gateway', 403);
      const e = this.#message(input);
      requireThat(e.pubkey === pubkey && e.created_at <= now() + 60, 'author-or-time', 403);
      if (this.#state.events.some(old => old.id === e.id)) return { event_id: e.id, accepted: true,
        duplicate: true, checkpoint: this.pin, stored: true, notification_accepted: false };
      requireThat(this.#state.events.length < LIMITS.events, 'event-limit', 413);
      const receipt = await this.#commit({ ...this.#state, events: [...this.#state.events, e] });
      return { event_id: e.id, accepted: true, message: 'stored and read back', ...receipt };
    });
  }
  async upload(pubkey, bytes) {
    return this.#exclusive(async () => {
      this.authorize(pubkey);
      requireThat(this.#writer, 'read-only-gateway', 403);
      requireThat(bytes.length > 0 && bytes.length <= LIMITS.file, 'file-limit', 413);
      const digest = hash(bytes);
      if (this.#state.files.some(f => f.sha256 === digest)) return { sha256: digest, checkpoint: this.pin, stored: true, duplicate: true };
      requireThat(this.#state.files.length < LIMITS.files, 'file-count-limit', 413);
      const receipt = await this.#commit({ ...this.#state, files: [...this.#state.files,
        { sha256: digest, data: bytes.toString('base64') }] });
      return { sha256: digest, ...receipt };
    });
  }
  download(pubkey, digest) {
    this.authorize(pubkey);
    const file = this.#state.files.find(f => f.sha256 === digest);
    requireThat(file, 'file-not-found', 404);
    return Buffer.from(file.data, 'base64');
  }
  query(pubkey, filters) {
    this.authorize(pubkey);
    requireThat(Array.isArray(filters) && filters.length > 0 && filters.length <= 4, 'invalid-filters');
    const found = new Map();
    for (const f of filters) {
      requireThat(f && typeof f === 'object' && !Array.isArray(f) && Object.keys(f).every(k =>
        ['kinds', 'ids', 'authors', '#h', 'since', 'until', 'limit'].includes(k)), 'unsupported-filter');
      requireThat(Array.isArray(f['#h']) && f['#h'].length === 1 && f['#h'][0] === this.policy.channel, 'channel-required');
      for (const key of ['kinds', 'ids', 'authors']) if (f[key] !== undefined) requireThat(Array.isArray(f[key])
        && f[key].length <= LIMITS.events && f[key].every(v => key === 'kinds' ? v === 9 : hex(v)), 'unsupported-filter');
      for (const key of ['since', 'until', 'limit']) if (f[key] !== undefined) requireThat(Number.isSafeInteger(f[key])
        && f[key] >= 0 && (key !== 'limit' || f[key] <= LIMITS.events), 'invalid-filter-bound');
      let rows = this.#state.events.filter(e => (!f.kinds || f.kinds.includes(e.kind)) && (!f.ids || f.ids.includes(e.id))
        && (!f.authors || f.authors.includes(e.pubkey)) && (f.since === undefined || e.created_at >= f.since)
        && (f.until === undefined || e.created_at <= f.until));
      rows.sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id));
      rows = rows.slice(0, f.limit ?? LIMITS.events);
      for (const e of rows) found.set(e.id, e);
    }
    return structuredClone([...found.values()].sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id)));
  }
  async restore(expected) {
    return this.#exclusive(async () => {
      exact(expected, ['id', 'sequence', 'policy_id', 'ref']);
      requireThat(hex(expected.id) && expected.policy_id === this.policy.event.id && Number.isSafeInteger(expected.sequence)
        && expected.sequence > 0, 'checkpoint-pin', 409);
      if (this.#pin) {
        if (expected.id === this.#pin.id) return this.pin;
        requireThat(expected.sequence > this.#pin.sequence, 'stale-or-conflicting-checkpoint', 409);
      }
      const cp = checkedEvent(parse(await fetchRef(this.store, expected.ref, LIMITS.checkpoint), LIMITS.checkpoint));
      requireThat(cp.id === expected.id && cp.pubkey === this.policy.writer && cp.kind === 30078
        && tag(cp, 'd') === 'bnr-channel-checkpoint-v1', 'checkpoint-signature', 409);
      const m = parse(Buffer.from(cp.content), LIMITS.checkpoint);
      exact(m, ['version', 'policy_id', 'sequence', 'parent', 'event_count', 'data']);
      requireThat(m.version === 1 && m.policy_id === expected.policy_id && m.sequence === expected.sequence
        && (m.sequence === 1 ? m.parent === null : hex(m.parent)), 'checkpoint-shape', 409);
      // Streaming follow only advances one known predecessor. Cold recovery requires
      // an externally retained exact pin; the storage provider cannot choose a tip.
      if (this.#pin) requireThat(m.sequence === this.#pin.sequence + 1 && m.parent === this.#pin.id, 'checkpoint-gap-or-fork', 409);
      const snapshot = parse(unseal(await fetchRef(this.store, m.data, LIMITS.snapshot + 28),
        this.#key, this.policy.event.id), LIMITS.snapshot);
      exact(snapshot, ['sequence', 'events', 'files']);
      requireThat(snapshot.sequence === m.sequence && Array.isArray(snapshot.events) && snapshot.events.length <= LIMITS.events
        && snapshot.events.length === m.event_count && Array.isArray(snapshot.files) && snapshot.files.length <= LIMITS.files, 'snapshot-shape', 409);
      snapshot.events = snapshot.events.map(e => this.#message(e));
      requireThat(new Set(snapshot.events.map(e => e.id)).size === snapshot.events.length, 'duplicate-history', 409);
      for (const f of snapshot.files) {
        exact(f, ['sha256', 'data']);
        requireThat(hex(f.sha256) && typeof f.data === 'string' && f.data.length <= Math.ceil(LIMITS.file / 3) * 4, 'invalid-file');
        const bytes = Buffer.from(f.data, 'base64');
        requireThat(bytes.length > 0 && bytes.length <= LIMITS.file && bytes.toString('base64') === f.data && hash(bytes) === f.sha256, 'file-integrity', 409);
      }
      requireThat(new Set(snapshot.files.map(f => f.sha256)).size === snapshot.files.length, 'duplicate-files', 409);
      if (this.#pin) {
        requireThat(this.#state.events.every((e, i) => snapshot.events[i]?.id === e.id)
          && this.#state.files.every((f, i) => snapshot.files[i]?.sha256 === f.sha256), 'history-removal', 409);
      }
      this.#state = snapshot; this.#pin = structuredClone(expected);
      this.emit('committed');
      return this.pin;
    });
  }
  async follow(notice) {
    exact(notice, ['type', 'id', 'sequence', 'policy_id', 'ref']);
    requireThat(notice.type === 'bnr-channel-checkpoint-v1', 'unsupported-notice');
    const { type, ...pin } = notice;
    return this.restore(pin);
  }
}
