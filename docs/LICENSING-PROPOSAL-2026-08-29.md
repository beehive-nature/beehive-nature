# LICENSING PROPOSAL — the two-license split (VALUES RULED + STAGED, 2026-08-29)

> ## ✅ PUBLISHED 2026-08-29 — the founder ruled "push and start the 4-year BSL clock now."
> **Change Date: August 29, 2030** (publish commit 2026-08-29 + 4 years). All four values final: **Licensor Travis Mark Remington
> <lovis@skaists.dev>** · **Change Date = four years from the LICENSE PUBLISH commit**
> · **Change License = GPL-2.0-or-later** · **Rails = Apache-2.0**. The files are named
> for GitHub recognition (`LICENSE` at root = Apache-2.0, `scripts/buzz-meter/LICENSE`
> = BSL 1.1, `NOTICE` present). Source headers are applied. **Nothing binds until the
> founder makes the LICENSE PUBLISH commit** — the one remaining open item is the
> Additional Use Grant wording (lawyer), flagged below and inside the BSL file.

**Ruled:** founder, 2026-08-29 — "go full speed" on the split, then all four values. This is the staged draft.

---

## THE SPLIT IN ONE LINE

**The moat is delayed-open; the rails are open.** The money-handling machinery that makes the estate commercially defensible goes under Business Source License 1.1 (source-available now, production-use gated, automatic conversion to an open license on a Change Date). The primitives everyone needs to interoperate with us — the wallet, the rail adapters, the spend-cap engine — go under a permissive license so the ecosystem can build on them freely.

**Why this shape (the Uniswap precedent, re-verified at source 2026-08-29 — correcting this doc's earlier citation):** Uniswap ships **v4-core under BSL 1.1** — Change Date "the earlier of **2027-06-15** or a date specified at v4-core-license-date.uniswap.eth", **Change License MIT** (read from `licenses/BUSL_LICENSE` at source; the earlier draft of this doc said GPL — wrong, that's v3) — with **v4-periphery MIT today**. **v3-core proves the window closes as designed:** its BSL carried Change Date **2023-04-01**, now passed, so v3 is **GPL-2.0-or-later today** (LICENSE read at source: "GNU General Public License v2.0 or later"). Consequence we measured first-hand in the xBTC raid: *no lawful self-deploy of v4 before its Change Date* — the BUSL fence is real and enforceable. Fenced core, open periphery, automatic conversion: the standard open-core shape, followed here. (Sources: the license files above read at source, 2026-08-29; MariaDB's covenants at mariadb.com/bsl11.)

---

## THE MANIFEST — which paths each license covers

### scripts/buzz-meter/LICENSE (BSL 1.1) — the commercial moat (delayed-open)
| path | what it is |
|---|---|
| `scripts/buzz-meter/meter.py` | the b-meter: SPEC-SPEND-RECEIPT-1 receipts, the P3 identity bindings, **the A/B + USDC voucher-prepay engine**, **the tithe book**, **bClaude's widened gate** (the bclaude.base.eth / bclaude@skaists.buzz voucher-prepay loop's accounting half) |
| `scripts/buzz-meter/rate_set.json` | the pricing law: tier ladder, cost bases, **the tithe law (10%, founder word alone)** |
| `scripts/buzz-meter/gate.js` | the per-key bearer gate on /compute — the paid lane's door |

*Scope note for the lawyer:* the live wiring of bClaude's paid lane also lives on the Oracle box (outside this repo); the repo manifests the accounting engine. The Licensed Work wording in the BSL TODO covers the repo paths; whether boxed deployments are "distribution" under BSL 1.1 is a lawyer question, flagged below.

### LICENSE (root, Apache-2.0) — the rails/primitives (open)
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
4. **~~MIT vs Apache-2.0 for the permissive side~~ — RULED: Apache-2.0** (2026-08-29). The MIT template is retired; the root `LICENSE` carries the canonical Apache-2.0 text (patent grant included — right for the adapters), and `NOTICE` ships per §4(d).
5. **The MariaDB covenants** — BSL 1.1's own terms require the license text be used unmodified (params only) and the MariaDB notice retained; both honored in the template.

---

## THE PUBLISH COMMIT (the founder's one remaining gesture — everything else is staged)
1. ~~Lawyer~~ — the Additional Use Grant wording remains the open lawyer item; the founder may publish with the flagged shape and amend, or hold for the lawyer. **His call, his commit.**
2. ~~Set Licensor / Change Date / Change License / copyright~~ — DONE (ruled 2026-08-29, applied).
3. ~~Rename files to GitHub-recognized names~~ — DONE: root `LICENSE` (Apache-2.0 canonical), `scripts/buzz-meter/LICENSE` (BSL 1.1, filled), `NOTICE` (§4(d) attribution).
4. ~~Add SPDX headers~~ — DONE: BUSL-1.1 headers on `meter.py` / `gate.js` + `_license` key in `rate_set.json`; Apache-2.0 headers on `wallet.html`, the three adapters, `arweave.js`.
5. **The founder's commit:** replace the Change Date formula in `scripts/buzz-meter/LICENSE` with the literal date (four years from that commit's date), commit with an explicit "LICENSE PUBLISH" message. That commit is the first binding distribution — the clock starts there.

---
*z1 (zCode), chief — staged at the founder's four-value ruling. One commit away; the commit is his.*
