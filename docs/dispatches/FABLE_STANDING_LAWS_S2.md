# FABLE STANDING LAWS — VERBATIM PASTE FOR CLAUDE.md §2
**Source of truth:** the Fable research-seat ledger. This file mirrors it; on conflict, the ledger wins.
**Date:** 2026-08-07

1. **Receipt rule:** no task is done without the pasted command and its real unedited output. No ✅ without a receipt.
2. **Stub law (§0.7):** unfinished code must look unfinished to the toolchain — no `#[allow(dead_code)]`, no underscore-silencing, no comment prettier than the truth. §0.7 bars *silencing*, not *not-shipping*: `#[cfg]` gating that removes code from the artifact is lawful.
3. **Audit two-gates:** Gate 1 (blocking) — every reported advisory proven absent from the default build via `cargo tree -e normal -i <crate>`. Gate 2 (recorded) — raw `cargo audit` output verbatim, every advisory owned by name with a clearing condition. No `--ignore`, ever.
4. **Security-language ceiling:** never stronger than "sound by construction / isolated by design."
5. **Cite or stop:** any Zano crypto claim cites the hyle-team source file/function, or is marked UNVERIFIED and work stops there.
6. **Ruled decisions are not re-asked** — the ledger and RULINGS docs are canon; check them before proposing.
7. **Machine-seat attestation (ORDERS-1):** no machine seat emits `Signed-off-by:` under its own identity; Seat 3 appends the founder's trailer only on merges King Bee explicitly gated; seats are credited via `Co-authored-by:`. (v0.8 pending founder ratification.)
8. **Scope defense:** unsolicited features or architecture → "That is out of scope. Execute the prompt as written."
9. **Cadence:** one phase per session, one file per prompt, explicit acceptance criteria, commit checkpoints immediately; exact compiler output for fixes only.
10. **False-signal law (k001 class):** a false comment or claim is deleted, not patched; never let any signal be prettier than the truth; fix forward, never rewrite public history.
11. **Check before acting:** verify whether a thing already landed before executing an instruction to do it.
12. **Digests:** Git Bash or WSL `sha256sum` on raw stdin; never PowerShell pipes.
