# RECEIPT — the SourceHat audit is real, covers the token, and does not describe the deployed contract

**Read 2026-08-25.** Read-only throughout: one report, three GitHub blobs, one verified-source
read. No transaction, no key material.

Prompted by the **"Audited by SourceHat"** badge in the `inscriptions.market` footer, and by a
founder recollection of reading a Fungi audit in 2024. Both check out. Neither means what the
badge placement implies.

---

## 1 · The report exists and was read

| | |
|---|---|
| URL | <https://sourcehat.com/audits/Fungi/> |
| Legacy | `solidity.finance/audits/Fungi/` → **302** to the above — continuity from the Solidity Finance era, and why a 2024 memory of it is correct |
| Assessment | **2024-04-08 → 2024-04-12** |
| Amendment 1 | 2024-04-15 (client fixes for #1, #2) |
| Amendment 2 | 2024-04-23 |
| Verdict | *Overall Contract Safety: **PASS*** |

**This was fetched and read, not inferred from a badge.** The badge on `inscriptions.market`
itself could **not** be independently verified — the site is a client-rendered SPA serving
fetchers only meta tags, and both Wayback and a rendering proxy returned 403.

## 2 · Scope — the token, and only the token

- One file: **`contracts/token/Fungi.sol`**, repo `github.com/ToddStool/fungi`
- `contract Fungi is Inscriptions, Generator, ReentrancyGuard`
- **No contract address anywhere in the report.** Scope is defined purely by commit. The
  report's own metadata names the chain as **Ethereum**; the token lives on **Base**.
- The strings **"marketplace", "inscriptions.market" and "escrow" do not appear in it.** The
  audited file contains no listing, escrow, auction or settlement logic of any kind.

> **A token audit displayed as marketplace assurance is a category error**, whether or not
> anyone intended it. Nothing in this report speaks to how a venue custodies an inscription
> during a listing — which is exactly the question `SPEC-INSCRIPTION-COMPAT-1` §2.3 exists to
> answer, and it remains unanswered by any third party.

## 3 · Findings

| # | Severity | Issue | Status in report |
|---|---|---|---|
| 1 | **HIGH** | `trySeedTransfer()` / `_owns` — multiple holders sending identical seed amounts to one recipient leaves that recipient unable to transfer all the sets | Resolved |
| 2 | **MEDIUM** | `_removeHolder()` decrements `_holdersCount` *before* indexing → data mismatch and incorrect deletion | Resolved |
| 3 | Informational | `spores_count` unmodifiable but not declared `constant` | **Open** |

Critical 0 · High 1 · Medium 1 · Low 0 · Informational 1.

**Finding #1 is our §2.2 same-seed collision, found independently from source in April 2024.**
We reached it from 8,162 burn events; a professional reviewer reached it by reading. Two
methods, one defect.

## 4 · The finding that matters most — the fixes are not on chain

| | |
|---|---|
| Deployed | `0x7d9CE55D54FF3FEddb611fC63fF63ec01F26D15F`, **Base** |
| Created | **2024-03-31T16:57:09Z**, block 12,557,441 |
| Tx | `0x10c3371fa313a621f9df2dc0f8e161a677b382c27829cdb1461bade47569f336` PUBLIC-CONSTANT: mainnet deployment txid, public by nature |
| Compiler | `v0.8.25+commit.b61c2a91` |

**The token was deployed eight days before the audit began**, and 15 and 23 days before the
two remediation commits.

| stage | commit |
|---|---|
| originally audited | `4581acb15d7975482b1960c91abc838146c63a21` |
| revision 1 (Apr 15) | `0c47ff84bd96129ff6a9932a5c03da9106a0e384` |
| revision 2 (Apr 23) — the one the report scopes | `3ac81ec2c41c7be23568371ffe39d23542ab1902` |

The deployed `_removeHolder` is character-identical to **pre-fix `4581acb`** — it still
decrements before indexing, which is Finding #2 verbatim. Corroborating the generation gap:
the deployed source declares `_spores`, `_sporesTotalCount`, `_owns`, while `3ac81ec` renamed
these to `_dynamicInscription`, **a string absent from the deployed source entirely**.

> **Every "Resolved" in that report describes GitHub, not Base.** The audited contract and the
> deployed contract are two different programs. A consumer reads the deployed one.

*Limit of this receipt:* the comparison is source-text (Blockscout verified source vs. raw
GitHub blobs). No recompilation to bytecode was performed. No FUNGI deployment was found on
Ethereum mainnet that might carry the fixed code.

## 5 · The rest of the family

**No published audit found for FROGGI, PEPi, JELLI, TRUFFI or JEDI**, by SourceHat or anyone.
`sourcehat.com/audits/Froggi/` and `/audits/InscriptionsMarket/` both soft-404 to the audits
landing page — SourceHat's pattern for unknown slugs, confirmed against a known-good page.

*This is "no evidence found", not proof of absence:* SourceHat's index is JS-rendered and its
sitemap carries no per-audit entries, so the portfolio could not be enumerated exhaustively.
The conclusion rests on targeted slug probes plus search. The Fungi whitepaper mentions no
audit and no marketplace.

---

## What this changes

1. **§2.2 gains independent corroboration** — and the harder fact that the defect is unfixed at
   the live address.
2. **§2.3 gains nothing.** No third party has ever reviewed a settlement path in this family.
   Our custody rules remain the only written ones.
3. **The museum can now say FUNGI is audited** — and, in the same breath, exactly what that
   does and does not cover. Recorded on the FUNGI row of the SOURCES & DOORS wing.
4. **A new rule for the catalog:** an audit badge names a *report*, not a *deployment*. Any
   badge we display or repeat carries its scope and its commit, or it does not go up.
