# Workload Distribution — Claude / zcode / goose
### Attach this to bnr-sprint-pack-2026-08-18.zip · the pinned vector is the contract between all agents

## The split, by nature of work

**Claude — design, architecture, judgment, words.** High-context, low-grind: specs and ADRs, API/wire-format decisions (anything expensive to change later), UX copy and ceremony language ("the words are the product"), code review of the other agents' output, synthesis after parallel work, and anything touching ratified law (BDID-v1 labels, lane assignments, ethics law). Claude holds the map; it should never be burning tokens on mechanical porting.

**zcode — heavy generative grind.** Token-hungry, well-specified, verifiable-by-test: the **Rust port of bdid-key** (WS-2 companion — derivation, BIP39, fingerprint words; done when it reproduces the pinned vector byte-identically), **bsafe-messages** protobuf generation from trezor-firmware, the **b-indexer** implementation from WS-7's spec (Rust+SQLite, Vaulta first), UR/BC-UR integration for WS-5, and expanding the e2e/bench harnesses. Every zcode task in the pack already has a machine-checkable done-line — hand it the task, the tests, and the vector; don't hand it design latitude.

**goose — adversarial verification and evidence-hunting.** Your own tree already shows goose's superpower (record_sig.rs: "goose then located the published vectors" that upgraded an exclusion-why into a genuine control). Same role here: hunt published test vectors and speccheck suites for everything we derive, try to BREAK the key build (malleable sigs, bad phrases, UV-downgrade attempts), run fido2-tests/trezor-user-env against bSAFE builds, verify reproducible builds, and audit that zcode's ports match the vector rather than trusting that they do. Goose is the lab's "science" half in agent form — and per BNR-LAB-1, its findings publish even when they're about our own code.

## Assignment table (sprint map WS → agent)

| WS | Work | Lead | Verify |
|---|---|---|---|
| WS-1 | Land key build in-tree + CI | zcode (wiring) | goose (CI green + vector) |
| WS-2 | Anchoring (genesis, DID-log) | **Claude designs**, zcode implements | goose |
| WS-3 | Recovery tool hardening | zcode | goose (air-gap test) |
| WS-4 | Safe 7 BLE spike | **human + hardware**; Claude pairs live | goose (channel tests) |
| WS-5 | UR framing | Claude (format ruling), zcode (integration) | goose (lossy-capture test) |
| WS-6 | Tier policy types | **Claude** (law-shaped code) | goose |
| WS-7 | b-indexer | Claude (spec) → zcode (build) | goose (mainnet arrival proof) |
| WS-8 | Dice entropy | zcode | goose (re-derivation + RNG-flag CI check) |
| Site | Pages deploy + beta | **human** (push), Claude (copy iterations) | goose (link/no-network audit) |

## What the zip does NOT carry — keep these with humans

Repo write access (agents propose branches/patches; a human merges), the Safe 7 hardware, any real seed or passkey, and founder rulings (agents flag gates, never decide them). The onboarding surface's beta is test-values-only until anchoring lands.

## Handoff protocol (so parallel agents don't fork reality)

1. Everyone starts from the same zip + this file; the README's pinned vector and the ratified rulings are non-negotiable inputs.
2. One branch per WS, named `ws-N-agent` — no agent edits another's branch; conflicts route to Claude for synthesis.
3. A task is done when its done-line from the sprint map passes **and goose has independently reproduced it**. zcode verifying zcode is the epistemic-capture pattern with extra steps — never accept it.
4. Anything that wants to change a normative byte (labels, HRPs, prologue, word count) stops work and surfaces to the raid. That's a gate, not a task.
