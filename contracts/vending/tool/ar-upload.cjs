// ar-upload.cjs — runs ON THE ORACLE BOX (server-side egress; the SNI wall is
// never the member's problem — onboarding law). Reads one JSON from stdin:
//   { seedB64url: <32-byte ed25519 seed>, dataB64: <bytes>, tags: [[name,value],...] }
// Signs the Arweave data item ED25519 (ANS-104 sig type 2) so the item OWNER
// equals the member's ed25519 public key — the key road of POINTER LAW.
// Prints { id, owner, winc } on stdout. The seed never touches disk here.
//
// Corrected 2026-09-28. Two defects, each enough to put the SEED in the item's
// owner field (which is sent to the upload door, and published if accepted):
//   1. the public key was "derived" by wrapping the seed in an SPKI public-key
//      container, so pubRaw WAS the seed; it is now derived from the private key;
//   2. arbundles' SolanaSigner reads its 64-byte secret as seed(32) ‖ public(32)
//      (constructor: _key = first 32 signs, pk = last 32 is the owner); the
//      order was reversed.
// memberSigner() now refuses, before any network call, unless the signer's
// owner is exactly the member's public key and not the seed.
const crypto = require("crypto");

function memberSigner(seed, { SolanaSigner, bs58 } = {}) {
  if (!Buffer.isBuffer(seed) || seed.length !== 32) throw new Error("seed must be 32 bytes");
  SolanaSigner = SolanaSigner || require("@dha-team/arbundles").SolanaSigner;
  bs58 = bs58 || require("bs58"); bs58 = bs58.default || bs58;
  const priv = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
  const pubRaw = Buffer.from(crypto.createPublicKey(priv).export({ format: "jwk" }).x, "base64url");
  const signer = new SolanaSigner(bs58.encode(Buffer.concat([seed, pubRaw])));
  const owner = Buffer.from(signer.publicKey);
  if (!owner.equals(pubRaw) || owner.equals(seed)) throw new Error("the signer's owner is not the member public key; refusing before any upload");
  /* and the half that signs must be the member key too: sign a probe with the
     signer and verify it under pubRaw, so a library that moved the signing
     half is refused as well */
  const probe = crypto.randomBytes(32);
  const sig = Promise.resolve(signer.sign(probe)).then((s) => {
    const spki = crypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pubRaw]), format: "der", type: "spki" });
    if (!crypto.verify(null, probe, spki, Buffer.from(s))) throw new Error("the signer does not sign with the member key; refusing before any upload");
  });
  return { signer, pubRaw, ready: sig };
}
module.exports = { memberSigner };

if (require.main === module) {
  (async () => {
    const inp = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const { signer, ready } = memberSigner(Buffer.from(inp.seedB64url || "", "base64url"));
    await ready;
    const { TurboFactory } = (() => { try { return require("@ardrive/turbo-sdk/node"); } catch { return require("@ardrive/turbo-sdk"); } })();
    const turbo = TurboFactory.authenticated({ signer, token: "solana" });
    const data = Buffer.from(inp.dataB64, "base64");
    const res = await turbo.uploadFile({
      fileStreamFactory: () => data,
      fileSizeFactory: () => data.length,
      dataItemOpts: { tags: inp.tags.map(([name, value]) => ({ name, value })) },
    });
    console.log(JSON.stringify({ id: res.id, owner: res.owner, winc: res.winc }));
  })().catch(e => { console.error("UPLOAD-ERR:", e.message); process.exit(1); });
}
