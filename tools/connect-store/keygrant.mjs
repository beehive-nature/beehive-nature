// PQ key distribution for channel epoch keys, using SPEC-BPQ-1 sealed objects
// (docs/specs/SPEC-BPQ-1.md §4) from the estate's own surfaces/bpq.js.
//
// A grant is one bpq1 object: the 32-byte epoch key, one X-Wing slot per
// verified recipient card, signed by the channel owner's ML-DSA-65 key. The
// signed, encrypted META binds policy, channel, epoch and recipient ids. The
// public head names no recipient and the signer record sits inside the
// encryption, so a grant is ordinary bytes that any store may hold.
//
// Revocation is prospective. A recipient who opened a grant keeps that epoch
// key and can read every snapshot sealed under it. Removing a recipient issues
// epoch n+1 with a fresh random key wrapped only to the cards that remain.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { requireThat, exact, hex } from './core.mjs';

const require = createRequire(import.meta.url);
require('../../surfaces/onboarding/vendor/bpq-lib.js');
require('../../surfaces/bpq.js');
export const BPQ = globalThis.BPQ;
if (!BPQ || BPQ.version !== 1) throw new Error('bpq-unavailable');

export const GRANT_LIMITS = Object.freeze({ recipients: 32, grant: 131072 });
const GRANT_TYPE = 'bnr-channel-key-grant-v1';

function checkOwner(owner) {
  requireThat(owner && typeof owner.id === 'string' && owner.dsa?.publicKey instanceof Uint8Array
    && typeof owner.dsa.sign === 'function' && owner.succession?.commit instanceof Uint8Array, 'invalid-owner-keys');
}
function checkBinding(policyId, channel) {
  requireThat(hex(policyId) && typeof channel === 'string' && /^[a-z0-9-]{1,64}$/.test(channel), 'invalid-grant-binding');
}
// Each card must be bpq1, recompute its self-certifying id and carry a valid
// ML-DSA-65 signature before its X-Wing key receives a slot.
function recipientsOf(cards) {
  requireThat(Array.isArray(cards) && cards.length > 0 && cards.length <= GRANT_LIMITS.recipients, 'invalid-recipients');
  const recipients = cards.map(card => {
    exact(card, ['bpq', 'id', 'dsa', 'kem', 'succ', 'sig']);
    requireThat(card.bpq === 1 && BPQ.verifyCard(card), 'invalid-card', 403);
    return { id: card.id, kem: BPQ.unb64u(card.kem), card: structuredClone(card) };
  });
  requireThat(new Set(recipients.map(r => r.id)).size === recipients.length, 'duplicate-recipient');
  return recipients;
}

async function sealGrant({ owner, policyId, channel, epoch, key, cards }) {
  checkOwner(owner); checkBinding(policyId, channel);
  requireThat(Number.isSafeInteger(epoch) && epoch >= 1, 'invalid-epoch');
  requireThat(key instanceof Uint8Array && key.length === 32, 'invalid-channel-key');
  const recipients = recipientsOf(cards);
  const grant = await BPQ.seal(Uint8Array.from(key), { to: recipients.map(r => r.kem), signer: owner,
    meta: { type: GRANT_TYPE, policy_id: policyId, channel, epoch, recipients: recipients.map(r => r.id) } });
  requireThat(grant.length <= GRANT_LIMITS.grant, 'grant-limit', 413);
  return { grant, cards: recipients.map(r => r.card) };
}
export async function issueGrant(args) { return (await sealGrant(args)).grant; }

// Owner side: a fresh random epoch key, never derived from an earlier one.
// The returned state holds that key; it belongs to the owner, not to storage.
export async function newEpoch({ owner, policyId, channel, epoch, cards }) {
  const key = new Uint8Array(randomBytes(32));
  const sealed = await sealGrant({ owner, policyId, channel, epoch, key, cards });
  return { epoch, key, cards: sealed.cards, grant: sealed.grant };
}

// Roster change: epoch n+1 wrapped only to the cards that remain. An empty
// `remove` is a plain rotation to a fresh key with the same recipients.
export async function rekey(current, { owner, policyId, channel, remove }) {
  requireThat(current && Number.isSafeInteger(current.epoch) && current.epoch >= 1
    && Array.isArray(current.cards), 'invalid-epoch-state');
  requireThat(Array.isArray(remove) && remove.every(id => current.cards.some(c => c.id === id)), 'not-a-recipient');
  const cards = current.cards.filter(c => !remove.includes(c.id));
  return newEpoch({ owner, policyId, channel, epoch: current.epoch + 1, cards });
}

// Recipient side. Returns {epoch, key, recipients} only when `keys` opens a
// slot, the owner's signature verifies under the externally pinned owner id,
// and the signed binding names this policy, channel and recipient.
export async function openGrant(grant, { keys, ownerId, policyId, channel }) {
  checkBinding(policyId, channel);
  requireThat(typeof ownerId === 'string' && typeof keys?.id === 'string'
    && typeof keys.kem?.decapsulate === 'function', 'invalid-recipient-keys');
  requireThat(grant instanceof Uint8Array && grant.length <= GRANT_LIMITS.grant, 'invalid-grant', 413);
  let opened;
  try { opened = await BPQ.open(grant, { kem: keys.kem }); } catch (e) {
    // no_key: not a recipient, or a slot was altered; the two look the same.
    const notOpenable = e?.code === 'no_key';
    requireThat(false, notOpenable ? 'grant-not-openable' : 'grant-integrity', notOpenable ? 403 : 409);
  }
  const by = opened.sealedBy;
  requireThat(by?.ok === true && by.idOk === true && by.id === ownerId, 'grant-owner-signature', 403);
  const m = opened.meta;
  exact(m, ['type', 'policy_id', 'channel', 'epoch', 'recipients']);
  requireThat(m.type === GRANT_TYPE && m.policy_id === policyId && m.channel === channel
    && Number.isSafeInteger(m.epoch) && m.epoch >= 1 && Array.isArray(m.recipients)
    && m.recipients.includes(keys.id) && opened.bytes.length === 32, 'grant-binding', 409);
  return { epoch: m.epoch, key: opened.bytes, recipients: [...m.recipients] };
}
