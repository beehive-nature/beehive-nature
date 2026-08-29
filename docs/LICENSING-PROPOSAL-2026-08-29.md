# LICENSING PROPOSAL — the two-license split (DRAFT, 2026-08-29)

> ## ⚠⚠ NOTHING IS LICENSED UNTIL THE FOUNDER PUBLISHES ⚠⚠
> This document and the two template files (`LICENSE-BSL.txt`, `LICENSE-PERMISSIVE.txt`)
> are a **PROPOSAL**. No source file carries a license header. The files are named
> `LICENSE-*.txt` precisely so GitHub does **not** auto-apply them. The publish action —
> the founder's alone — is: set the TODO parameters, rename to their final names, add
> source headers, and commit with an explicit publish message.

**Ruled:** founder, 2026-08-29 — "go full speed" on the split. This is the ready-to-go draft.

---

## THE SPLIT IN ONE LINE

**The moat is delayed-open; the rails are open.** The money-handling machinery that makes the estate commercially defensible goes under Business Source License 1.1 (source-available now, production-use gated, automatic conversion to an open license on a Change Date). The primitives everyone needs to interoperate with us — the wallet, the rail adapters, the spend-cap engine — go under a permissive license so the ecosystem can build on them freely.

**Why this shape (the Uniswap precedent, cited):** Uniswap Labs ships **v4-core under BSL 1.1** — Change Date **2027-06-15**, Change License **GPL-2.0-or-later** — with the consequence we measured first-hand in the xBTC raid: *no lawful self-deploy before the Change Date* (the BUSL fence is real and enforceable), while **v3-core has been plain GPL since 2023-04-01** after its own BSL window closed. Meanwhile the periphery (SDKs, interface pieces) rides MIT/Apache so integrators aren't fenced out of the parts they need to touch. That is exactly the shape here: the engine the estate monetizes is fenced; the rails it interoperates through are not. (Sources: license receipts in `docs/` bnri-xbtc lane — v4-core BUSL text read at source; v3 GPL-3.0 header read at source.)

---

## THE MANIFEST — which paths each license covers

### LICENSE-BSL.txt — the commercial moat (delayed-open)
| path | what it is |
|---|---|
| `scripts/buzz-meter/meter.py` | the b-meter: SPEC-SPEND-RECEIPT-1 receipts, the P3 identity bindings, **the A/B + USDC voucher-prepay engine**, **the tithe book**, **bClaude's widened gate** (the bclaude.base.eth / bclaude@skaists.buzz voucher-prepay loop's accounting half) |
| `scripts/buzz-meter/rate_set.json` | the pricing law: tier ladder, cost bases, **the tithe law (10%, founder word alone)** |
| `scripts/buzz-meter/gate.js` | the per-key bearer gate on /compute — the paid lane's door |

*Scope note for the lawyer:* the live wiring of bClaude's paid lane also lives on the Oracle box (outside this repo); the repo manifests the accounting engine. The Licensed Work wording in the BSL TODO covers the repo paths; whether boxed deployments are "distribution" under BSL 1.1 is a lawyer question, flagged below.

### LICENSE-PERMISSIVE.txt — the rails/primitives (open)
| path | what it is |
|---|---|
| `surfaces/wallet.html` | the bzDiD wallet — soul connect, keychain, key forge, **the spend-cap engine** (capGate/capRecord, the owner's optional tool), pay lanes |
| `surfaces/wallet-adapter-vaulta.js` | the Vaulta rail adapter (worker) |
| `surfaces/wallet-adapter-hive.js` | the Hive rail adapter (worker, read-only) |
| `surfaces/wallet-adapter-arweave.js` | the Arweave buildPublish adapter (worker) |
| `surfaces/arweave.js` | the first-party Arweave signer the adapter rides |

*Everything else in the tree is UNCLASSIFIED by this proposal* — no default license is implied for any path not listed above. A later pass (founder's call) classifies the rest.

---

## THE BSL PARAMETERS — every one a TODO, none invented

| parameter | status | the open question |
|---|---|---|
| Licensor | **[ESTATE ENTITY — founder to name]** | the legal person; must align with the tithe recipient |
| Licensed Work | proposed path manifest (above) | version pin + future-file wording |
| Additional Use Grant | **PROPOSED SHAPE, FLAGGED** | non-production use permitted — but see the tithe coupling below |
| Change Date | **[e.g. 4yr from publish — founder to set]** | BSL auto-converts at Change Date OR 4th anniversary of first public distribution, whichever FIRST |
| Change License | **[GPL-2.0-or-later or Apache-2.0]** | must satisfy the BSL covenant (GPL-2.0+ named, or lawyer-confirmed equivalent) |

---

## ⚠ LOUD: LAWYER-REVIEW FLAGS

1. **The TITHE/REVENUE COUPLING is the non-standard part.** The 10% founder tithe is not documentation — it is executable law: a distinct receipt line emitted by `meter.py`, a law block inside `rate_set.json`, with "the tithe percentage changes by founder word ALONE." A license that gates *use* of an engine whose *output* obligates a revenue share is NOT the standard BSL posture (Uniswap's grant says nothing about ongoing revenue from deployments). The lawyer must choose: **(a)** tithe as license condition (unusual, enforceability varies), **(b)** tithe as a separate commercial contract for production users, or **(c)** tithe outside license scope entirely (commercial-license matter only). **Do not publish the BSL before this is answered.**
2. **Additional Use Grant wording** — the placeholder is a shape, not text. The Uniswap/HashiCorp grants define "competitive offering" precisely; ours must define what "production use of a prepay accounting engine" means when the engine's natural deployment is internal-to-estate.
3. **Change License choice** — GPL-2.0-or-later matches the cited precedent and the BSL covenant's named option; Apache-2.0 (patent grant) is the alternative, lawyer to confirm covenant fit.
4. **MIT vs Apache-2.0 for the permissive side** — MIT drafted (shortest, maximally permissive); Apache-2.0 preferred if patent grant matters for the adapters. Founder/lawyer pick; the template swap is mechanical.
5. **The MariaDB covenants** — BSL 1.1's own terms require the license text be used unmodified (params only) and the MariaDB notice retained; both honored in the template.

---

## WHAT PUBLISHING LOOKS LIKE (the founder's checklist, when ready)
1. Lawyer answers flag #1 and blesses the Additional Use Grant text.
2. Founder sets Licensor entity, Change Date, Change License in `LICENSE-BSL.txt`; copyright line in `LICENSE-PERMISSIVE.txt`.
3. Rename files to their final names (`LICENSE` remains UNSET at repo root unless the founder wants a repo-wide default — recommended: leave root unset, carry per-directory LICENSE files so the split is enforced by path).
4. Add the corresponding SPDX header to each manifest file (the publish action — deliberately not done now).
5. Commit with an explicit "LICENSE PUBLISH" message; that commit is the first publicly available distribution event (starts the BSL four-year clock if the Change Date references it).

---
*z1 (zCode), chief — drafted at founder ruling "go full speed". Parameters are placeholders; the fences are marked; nothing here binds.*
