# ar-upload.cjs — the owner field held the seed (verified, fixed, audited)

2026-09-28 · Seat 3 (Claude Code), the #230 owner session. Found while pinning the
ANS-104 fixture for PR #230; kept with that owner at the founder's direction.

## The finding, verified

`contracts/vending/tool/ar-upload.cjs` (the ed25519 upload door, meant to run on the
oracle box) had two defects. Either one was enough to put the member's **seed** in the
data item's **owner** field:

1. **The public key was never derived.** The code wrapped the seed in an SPKI
   *public-key* container and read back 32 bytes, so `pubRaw` was the seed itself.
   Checked with a throwaway key: `old derivation: pubRaw equals the seed = true`.
2. **The key order was reversed.** arbundles' `SolanaSigner` constructor reads its
   64-byte secret as `seed(32) ‖ public(32)`: `_key` is the first half and signs, `pk`
   is the second half and is published as owner (`@dha-team/arbundles` 1.0.4,
   `build/node/cjs/src/signing/chains/SolanaSigner.js`). The script packed
   `public ‖ seed`.

The library, with a throwaway in-memory key (output as printed):

```
LIB seed|pub: owner==public true · owner==SEED false · item verifies true
LIB pub|seed: owner==public false · owner==SEED true · item verifies false
```

(The committed script actually packed `seed ‖ seed`, because defect 1 made its "public
key" the seed. The outcome is the same: owner = seed, and the signature fails.)

A seed-owned item fails its own signature check, so an upload door that verifies it
refuses it (`Invalid Data Item`). None is on Arweave among the audited items below.
**Any seed ever passed through the defective script was sent to upload.ardrive.io and
is to be treated as disclosed and never reused.** The receipts name only throwaway
TESTNET keys for this door.

The 2026-09-01 receipt and SPEC-VENDING-2 both stated the order backwards. They called
`pub ‖ seed` correct, and said the probe item `F8f2GF_ToN4…` "carries its own seed as
owner". Both claims are deleted and corrected in those files.

## Past uploads, audited on Arweave (the outside witness)

**Source:** `contracts/vending/tool/arweave-owner-audit.mjs`, functions `audit()` and
`verifyEd25519Item()` (with `deepHash()` and `serializeTags()`, the ANS-104 signing
message). Reproduce with `node contracts/vending/tool/arweave-owner-audit.mjs` (reads
only). `e2e/ar-upload-signer.test.mjs` holds the verifier: it accepts a correctly signed
item, rejects one whose owner is the seed, and agrees with arbundles on an item the
library signed (where the library is installed).

The audit covered every item tagged `App-Name=skaists-vending` or
`Type=agent-birth-certificate`, plus `F8f2GF_ToN4…` by id. For each ed25519 item, the
signature was re-derived from the raw data and verified against the owner field. An
owner that held a seed could not verify it, except with negligible probability. Output
of the committed tool, as printed:

```
ITEMS 9
QpwCYL3F5m ownerLen 32 · owner==Member-Key true · sig valid under owner true · agent bee two
OJI9EzR9wL ownerLen 32 · owner==Member-Key true · sig valid under owner true · agent bee three
efqq-z8zkh ownerLen 32 · owner==Member-Key true · sig valid under owner true · agent bee
eiHVpo3lzi ownerLen 512 · owner==Member-Key false · sig valid under owner n/a (not ed25519) · agent vendingtest2
ITC5RPTM2z ownerLen 512 · owner==Member-Key false · sig valid under owner n/a (not ed25519) · agent vendingtest
XviV59rLsg ownerLen 512 · owner==Member-Key false · sig valid under owner n/a (not ed25519) · agent vendingtest
1Fg2arClLo ownerLen 512 · owner==Member-Key false · sig valid under owner n/a (not ed25519) · agent vendingtest
3Hcqk6wv13 ownerLen 512 · owner==Member-Key false · sig valid under owner n/a (not ed25519) · agent vendingtest
F8f2GF_ToN ownerLen 32 · owner==Member-Key true · sig valid under owner true · agent ?
```

**No seed is published in the owner field of any of these items** (by the check above; sound by construction, scoped to these nine).
- **The four ed25519 items** each have owner equal to their Member-Key, with a valid
  signature. Three are PR #230's in-page mints; the fourth is the 2026-09-01 probe,
  which was built correctly.
- **The five RSA items** carry throwaway RSA owners, not member keys.

**Not audited, and not reachable from this seat:**
- items that carry neither tag;
- refused uploads sent to the door;
- the copy of the script on the oracle box (`~/vending-probe/`).

`mint.mjs` calls `ar-upload-rsa.cjs` on the box, not this file. The box copy of
`ar-upload.cjs` may still be the defective version and can still be run. It is tracked as
its own GitHub issue (beehive-nature/beehive-nature#261): redeploy or delete it on the box. Every key the receipts name for
this door is a throwaway TESTNET key.

## The fix

- `ar-upload.cjs` derives the public key from the private key and packs
  `seed ‖ public`. `memberSigner()` then **refuses before any network call** unless:
  - the signer's owner is exactly the public key and not the seed; and
  - a probe signed by the signer verifies under that public key.

  Both checks hold whatever a future library version does.
- The upload now runs only when the file is executed as a script
  (`require.main === module`), so tests can load `memberSigner()` without uploading.
- `e2e/ar-upload-signer.test.mjs` runs offline, with throwaway keys and no printing:
  - a stand-in built like arbundles' constructor yields owner = public key;
  - a reversed stand-in is refused, and so is one that publishes the right owner but
    signs with another key;
  - a static check confirms the SPKI seed wrapper is gone;
  - where the library is installed (a `--no-save` dev install), a live check confirms
    the real `SolanaSigner` agrees and the item verifies.
- The test is wired into CI (`static` job).

Receipt: `node --test e2e/ar-upload-signer.test.mjs` passed 7/7 locally, including the
live library check.

## Does it block #230?

No. #230 does not ship this path. Its only upload is the in-page signer
(`surfaces/ans104.js`), and two checks cover it:
- it matches arbundles byte for byte, on a pinned fixture;
- its three live items above verify with owner = Member-Key.

#230 also deleted its own CLI copy of the defective upload.
