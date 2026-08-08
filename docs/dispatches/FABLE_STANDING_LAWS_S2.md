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
8c. **PROVENANCE MUST SURVIVE THE RELAY — candidate law, AWAITING FOUNDER WORD (not yet adopted).** A finding, question, or claim carries **who authored it** across every hand it passes through; *addressed-to* is never rewritten as *originated-by*. *Earned:* two same-class errors — the escrow line attributed to Code that was the founder's aside, and the four earn-ANT questions authored by Fable and later described as Code's. Both were caught by the seat being miscredited flagging rather than absorbing it. Companion to LAW 8a: 8a stamps *where a claim came from in source*, 8c stamps *who made it*. **Recorded as a candidate, not adopted — a seat does not enact a law on its own read of a correction.**
8b. **Adapter-rail selection is UPSTREAM of design (ADOPTED 2026-08-08).** Measure **depth against any candidate rail BEFORE choosing it** — never design a mechanism and then discover the rail cannot carry it. *Earned:* three independent layers converged on the same conclusion — **supply binds; price mechanisms do not move it.** A rail that cannot carry the traffic makes every downstream design question moot, so rail selection is asked first, not last.
8a. **CRATE + REF stamping (ADOPTED 2026-08-08).** Every source claim carries the **crate and the ref it was read at** — `crate @ pin`, the same discipline already applied to tree heads. *Earned, not theorized:* three of one night's apparent disagreements were **"different layer" or "different pin," not real conflicts** (goose read `ant-core @ ant-client 81a0a24`; Code read `evmlib @ main` — both correct, reconciled only once the stamps were compared). An unstamped source claim is not verifiable and must not enter a spec.
9. **Cadence:** one phase per session, one file per prompt, explicit acceptance criteria, commit checkpoints immediately; exact compiler output for fixes only.
10. **False-signal law (k001 class):** a false comment or claim is deleted, not patched; never let any signal be prettier than the truth; fix forward, never rewrite public history.
11. **Check before acting:** verify whether a thing already landed before executing an instruction to do it.
12. **Digests:** Git Bash or WSL `sha256sum` on raw stdin; never PowerShell pipes.
