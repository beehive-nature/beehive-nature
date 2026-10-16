// bsigner-authority.mjs — the bSigner→SETTLE nerve: the concrete
// signed-authorization lane the kernel has been waiting for.
//
// The kernel (scripts/lib/bpay-settle.mjs) is PURE — no clock, no network, no
// files — and its `settle({ authorityHash })` parameter exists precisely so a
// signature machinery "elsewhere" (the README's words: "the signing itself
// belongs to the signed-authorization lane") can prove the authority is the
// one that was signed. This file is that lane's first concrete wire: the
// signing organ is bsigner (crates/bsigner — ML-DSA, keys never leave, signs
// and never submits; its contract is frozen in crates/bsigner/CONTRACT.md),
// reached through its CLI, which is the frozen public surface.
//
// WHAT IS SIGNED, EXACTLY: the domain-separated bytes the kernel itself
// digests for `authority_hash` —
//     "bnr/settle-authority/v1" (utf8) ‖ 0x00 ‖ canonicalBytes(authority)
// so one ML-DSA signature binds BOTH the document and its domain: it cannot
// be replayed as some other kind of authorization, and "the authority is not
// the one that was signed" (the kernel's own check) becomes checkable against
// bytes the organ actually signed. The signature is an agility envelope
// (bheart.signature/1) that names its own algorithms.
//
// WHO SIGNS: the PRINCIPAL's organ (the payer's bsigner keyset). The rail
// payload signer (`signer.sign(items)` for shell-submits rails) is untouched:
// that is the rail vault's job with the chain's own curves — ML-DSA is for
// the authorization, not the transaction.
//
// SCOPE, stated plainly: this module is I/O (it spawns the organ and uses
// temp files for the organ's --file/--envelope flags). The kernel stays pure;
// nothing here decides anything about money. Verification runs BEFORE the
// kernel is called — a bad signature refuses before a single adapter verb.
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalBytes } from "../../scripts/lib/bpay-invoice-generic.mjs";
import { AUTHORITY_DOMAIN, digest, settle } from "../../scripts/lib/bpay-settle.mjs";

// The bytes a principal's signature covers: the domain the kernel hashes,
// the 0x00 separator the kernel's digest() uses, and the authority's
// canonical JSON — byte-for-byte what digest(AUTHORITY_DOMAIN, authority)
// was computed over.
export function authoritySigningBytes(authority) {
  return Buffer.concat([Buffer.from(AUTHORITY_DOMAIN, "utf8"), Buffer.from([0]), canonicalBytes(authority)]);
}

function runOrgan(bin, args) {
  const r = spawnSync(bin, args, { encoding: "utf8" });
  if (r.error) {
    const e = new Error(`bsigner could not be run (${bin}): ${r.error.message}`);
    e.code = "SETTLE_ORGAN_UNREACHABLE";
    throw e;
  }
  return r;
}

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "bsigner-authority-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Sign the authority with the organ. `recEnv` names the environment variable
// holding the owner's recovery code: bsigner keeps its keys sealed at rest
// (crates/bsigner/src/keys.rs) and unlocks one only to sign. Returns { envelope, authority_hash,
// key_id } — the envelope is bheart.signature/1 (ML-DSA), the hash is the
// kernel's own authority_hash for the same bytes.
export async function signAuthority({ authority, bin, keyId, keydir, recEnv }) {
  const bytes = authoritySigningBytes(authority);
  const envelope = await withTempDir(async (dir) => {
    const file = join(dir, "authority.bytes");
    const out = join(dir, "envelope.json");
    await writeFile(file, bytes);
    const r = runOrgan(bin, ["sign", "--key-id", keyId, "--file", file, "--keydir", keydir, "--out", out, "--rec-env", recEnv]);
    if (r.status !== 0) {
      const e = new Error(`bsigner sign refused: ${r.stderr.trim()}`);
      e.code = "SETTLE_ORGAN_REFUSED";
      throw e;
    }
    return JSON.parse(await readFile(out, "utf8"));
  });
  if (envelope.type !== "bheart.signature/1") {
    const e = new Error(`the organ emitted ${envelope.type}, not bheart.signature/1`);
    e.code = "SETTLE_AUTHORITY_SIG";
    throw e;
  }
  if (envelope.content?.bytes !== bytes.length) {
    const e = new Error("the envelope covers a different byte count than the authority's canonical bytes");
    e.code = "SETTLE_AUTHORITY_SIG";
    throw e;
  }
  return { envelope, authority_hash: digest(AUTHORITY_DOMAIN, authority), key_id: keyId };
}

// Verify, through the organ, that the envelope is the named keyset's
// signature over THESE authority bytes. The organ is the crypto authority
// (same-library sign+verify proves nothing; ML-DSA verification is the
// organ's, never reimplemented here). Throws SETTLE_AUTHORITY_SIG on refusal.
export async function verifyAuthoritySignature({ authority, envelope, bin, keyId, keydir }) {
  const bytes = authoritySigningBytes(authority);
  return withTempDir(async (dir) => {
    const file = join(dir, "authority.bytes");
    const envPath = join(dir, "envelope.json");
    await writeFile(file, bytes);
    await writeFile(envPath, JSON.stringify(envelope), "utf8");
    const r = runOrgan(bin, ["verify", "--key-id", keyId, "--file", file, "--envelope", envPath, "--keydir", keydir]);
    if (r.status === 0) return true;
    let reason = r.stderr.trim() || `exit ${r.status}`;
    try { reason = JSON.parse(r.stdout).reason || reason; } catch { /* keep stderr */ }
    const e = new Error(`the authority was not the one that was signed: ${reason}`);
    e.code = "SETTLE_AUTHORITY_SIG";
    throw e;
  });
}

// The nerve end to end: verify the principal's signature over the intent's
// authority FIRST (assert-rejection before requests — a bad signature must
// never reach an adapter verb), then hand the kernel the hash the signature
// covered. Everything else passes through to the kernel's own settle().
// Returns the kernel's run plus the envelope, so a caller can anchor both.
export async function settleSigned({ adapter, intent, invoice, envelope, bin, keyId, keydir, ...rest }) {
  await verifyAuthoritySignature({ authority: intent.authority, envelope, bin, keyId, keydir });
  const run = await settle({ adapter, intent, invoice, authorityHash: digest(AUTHORITY_DOMAIN, intent.authority), ...rest });
  return { ...run, authority_envelope: envelope };
}
