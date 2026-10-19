// Consumer of the existing BPQ sealed-object contract, not another cipher.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { bytesDigest, canonicalDocument, need, integer } from './contract.mjs';
createRequire(import.meta.url)('../../surfaces/onboarding/vendor/bpq-lib.js');
createRequire(import.meta.url)('../../surfaces/bpq.js');
const B = globalThis.BPQ;
const MAGIC = Buffer.from('bnr.repo.private/1\0');
const profiles = new WeakSet();

export function repositoryPrivacy({ self, recipients = [], credentials }) {
  need(self instanceof Uint8Array && self.length === 32 || recipients.length > 0, 'PRIVATE_REPOSITORY_REQUIRED');
  need(Array.isArray(recipients) && recipients.length <= 64 && recipients.every(c => B.verifyCard(c)), 'RECIPIENT_CARD');
  need(credentials && typeof credentials === 'object', 'PRIVATE_REPOSITORY_REQUIRED');
  self = self ? Uint8Array.from(self) : undefined;
  credentials = { ...credentials, ...(credentials.self instanceof Uint8Array ? { self: Uint8Array.from(credentials.self) } : {}) };
  const cards = recipients.map(c => ({ ...c })).sort((a, b) => a.kem.localeCompare(b.kem));
  need(new Set(cards.map(c => c.kem)).size === cards.length, 'DUPLICATE');
  // Cache identity is LOCAL. Never send this audience commitment or the keys.
  const audience = bytesDigest(canonicalDocument({ profile: 'bpq1-padded/1', self: self ? bytesDigest(self) : null, readers: cards.map(c => c.kem) }));
  const profile = Object.freeze({ profile: 'bpq1-padded/1', audience,
    async seal(bytes) {
      integer(bytes.length); const minimum = MAGIC.length + 8 + bytes.length;
      let size = 4096; while (size < minimum) size *= 2;
      need(size <= 256 * 1024 * 1024, 'RESOURCE_LIMIT');
      const padded = randomBytes(size); MAGIC.copy(padded); padded.writeBigUInt64BE(BigInt(bytes.length), MAGIC.length); Buffer.from(bytes).copy(padded, MAGIC.length + 8);
      try { return Buffer.from(await B.seal(padded, { self, to: cards.map(c => B.unb64u(c.kem)) })); }
      finally { padded.fill(0); }
    },
    async open(ciphertext) {
      need(B.isSealed(ciphertext), 'PLAINTEXT_STORAGE_REFUSED');
      const { bytes } = await B.open(ciphertext, credentials); const padded = Buffer.from(bytes);
      try {
        need(padded.subarray(0, MAGIC.length).equals(MAGIC) && padded.length >= MAGIC.length + 8, 'PRIVATE_FORMAT');
        const length = Number(padded.readBigUInt64BE(MAGIC.length)); integer(length);
        need(length <= padded.length - MAGIC.length - 8, 'PRIVATE_FORMAT');
        return Buffer.from(padded.subarray(MAGIC.length + 8, MAGIC.length + 8 + length));
      } finally { padded.fill(0); bytes.fill(0); }
    },
  });
  profiles.add(profile); return profile;
}
export function requirePrivacy(privacy) {
  need(profiles.has(privacy), 'PRIVATE_REPOSITORY_REQUIRED');
}
