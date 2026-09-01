// ar-upload.cjs — runs ON THE ORACLE BOX (server-side egress; the SNI wall is
// never the member's problem — onboarding law). Reads one JSON from stdin:
//   { seedB64url: <32-byte ed25519 seed>, dataB64: <bytes>, tags: [[name,value],...] }
// Signs the Arweave data item ED25519 (ANS-104 sig type 2) so the item OWNER
// equals the member's ed25519 public key — the key road of POINTER LAW.
// Prints { id, owner, winc } on stdout. The seed never touches disk here.
const { TurboFactory } = (() => { try { return require("@ardrive/turbo-sdk/node"); } catch { return require("@ardrive/turbo-sdk"); } })();
const { SolanaSigner } = require("@dha-team/arbundles");
const bs58 = require("bs58");

(async () => {
  const inp = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const seed = Buffer.from(inp.seedB64url, "base64url");
  if (seed.length !== 32) { console.error("seed must be 32 bytes"); process.exit(1); }
  const publicKey = require("crypto").createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), seed]),
    format: "der", type: "spki" });
  const pubRaw = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  const secret64 = Buffer.concat([pubRaw, seed]); // Solana layout: pub(32) ‖ seed(32) —
  // owner field = pubRaw (the member key), signing key = seed (Curve25519 signs with _key = last 32)
  const signer = new SolanaSigner(bs58.encode(secret64));
  const turbo = TurboFactory.authenticated({ signer, token: "solana" });
  const data = Buffer.from(inp.dataB64, "base64");
  const res = await turbo.uploadFile({
    fileStreamFactory: () => data,
    fileSizeFactory: () => data.length,
    dataItemOpts: { tags: inp.tags.map(([name, value]) => ({ name, value })) },
  });
  console.log(JSON.stringify({ id: res.id, owner: res.owner, winc: res.winc }));
})().catch(e => { console.error("UPLOAD-ERR:", e.message); process.exit(1); });
