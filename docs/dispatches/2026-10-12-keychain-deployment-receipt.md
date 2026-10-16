# Isolated keychain at keys.skaists.dev: deployment receipt and handoff

Date: 2026-10-12 (America/Denver). From: the Claude seat that built the isolated keychain (PR #404). To: the hosted ANT storage purchasing owner (agent20), who continues the authorized live purchase. This seat runs no payment lane.

## Status, kept separate

| | Status | Evidence |
|---|---|---|
| Deployment | **VERIFIED** | Every row of the deployment table below |
| Keychain connection from the live wallet | **VERIFIED** | Every row of the connection table below |
| Live purchase | **NOT VERIFIED** | Nothing here signed, paid, created a passkey or made an identity. The first two rows do not imply this one. |

## Deployment

| Item | Value |
|---|---|
| URL | https://keys.skaists.dev/ |
| Source | beehive-nature/beehive-nature `af9df15e1248d88fa0af0288d36ae6b8faa70a65` (main after #404), built with `node scripts/build-keychain.mjs --out` |
| Site repository | beehive-nature/keys `42d0453eaa8c52070bc0b9400dde0af05976ed01`, GitHub Pages (legacy build) from `main`, path `/` |
| DNS | Namecheap record: CNAME `keys` → `beehive-nature.github.io.`. Public resolution checked at 8.8.8.8. Added 2026-10-11 (America/Denver); no other record was changed. |
| Certificate | GitHub Pages state `approved` for `keys.skaists.dev`, expires 2027-01-10. curl/schannel verified it with no warning and no bypass. |
| HTTPS | `https_enforced: true`. `http://keys.skaists.dev/` returns 301 to `https://keys.skaists.dev/`. |

Asset SHA-256. All three columns match: the build output, the keys-repo blob, and the bytes served over HTTPS.

| File | SHA-256 |
|---|---|
| index.html | `67cc66baa85314849ebce3220fef80dcb944e5eb38c0b9fe31337eb1aa5d7b4a` <!-- PUBLIC-CONSTANT: public asset digest --> |
| keychain.js | `2e5cd27e68fc82203493b1fb1b01d3833c04c2850981f6bfd9f80e7d1baf1c79` <!-- PUBLIC-CONSTANT: public asset digest --> |
| genesis.js | `109831fe9733e62b58ba56602bfeba517b00e5492bd7295b6f0266c7c8980b46` <!-- PUBLIC-CONSTANT: public asset digest --> |
| vendor/bzdid-key.js | `0261df46896fa152c987b6c8b3f2dc4c17d4f744157096733817a343218056fe` <!-- PUBLIC-CONSTANT: public asset digest --> |
| vendor/bnr-sign.js | `33a4c646c79f966854cf2d5de8b29c340bc47825db39b6b4f7e395a1ae75c378` <!-- PUBLIC-CONSTANT: public asset digest --> |

The two vendor files are also pinned in index.html by SRI (sha384). `scripts/build-keychain.mjs --check` runs in CI.

Certificate history, for the record: the custom domain was attached before the DNS record existed. GitHub issued no certificate for 50 minutes. One detach and re-attach of the domain, done once DNS resolved, got it approved within a minute.

## Keychain connection from the live wallet

Read-only, at https://skaists.dev/surfaces/wallet.html#bpay-sec.

| Check | Result |
|---|---|
| Scripts loaded | `ant-pay.js?v=10`, `keychain-client.js?v=1`, `bpay-invoice.js?v=12` |
| Before the certificate | No frame was mounted, and the panel asked only for the wallet keychain. `window.ethereum` was never touched. Nothing fell back to an extension or another account. |
| After the certificate | The frame mounted at `https://keys.skaists.dev/` with `allow="publickey-credentials-get/-create https://keys.skaists.dev"`. Its resize message arrived (cross-origin postMessage works). The wallet page's attempt to read the frame document was **blocked**. |
| What the frame showed | Its own locked view: "Make my keychain", "I already have one", "Open with a recovery code". Nothing was pressed. |
| Origin and source validation | Unchanged: the keychain accepts messages only from `https://skaists.dev` as its parent, and the client only from `https://keys.skaists.dev` as the frame's own window. |

## For the purchasing owner

- The live purchase needs the key holder in the hosted wallet: create the keychain with a new passkey, prepare an invoice, type the ETH limit, authorize, and confirm both payments inside the keychain. Then verify retrieval and `bpay.ant.reconciled/1`.
- The keychain's Arbitrum account is new. It holds no ANT and no ETH until the key holder funds it, which is the founder-ruled rotation.
- The keychain signs only Autonomi storage payments: approve to the pinned vault, or payForQuotes, at most 100 ANT, on Arbitrum One, at value 0.
- Each press needs Chrome, Edge or Brave. Elsewhere the keychain refuses because it cannot prove that nothing covers the confirm card.
- `ant-pay.js` `checkEnvelope` still verifies every envelope the keychain returns.

## Dependencies, not authorities

- **Current hosting:** GitHub Pages and the `skaists.dev` domain registered at Namecheap. They serve the keychain; they are not the identity. The identity is the BDID-GENESIS-V1 DID, which is the hash of its own bytes.
- **Domain loss is open.** The passkey's RP ID is `keys.skaists.dev`. If the domain is lost, that passkey can no longer unlock the keychain, and TLS does nothing about it. Today the recovery path is the recovery code typed inside a keychain served from a replacement origin. For the keychain owner, still to be built and tested:
  - a host-replacement procedure;
  - re-enrolling a passkey on the new origin from the recovery code;
  - a signed record of the new origin.
- **Single host:** losing GitHub as a host takes the keychain offline. Rebuilding it from source is reproducible: `--out` produces identical bytes, as the hashes above show.

## Relayed observation (not verified by this seat)

The founder relayed a message from David Irvine (Autonomi), dated 2026-10-10: "All our nodes use PQC TLS with no classical fallback." This seat has not checked it. It belongs in the PQ migration inventory as an Autonomi-transport claim, to be cited or marked UNVERIFIED.
