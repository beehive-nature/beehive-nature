# Dispatch 2026-10-16: SPEC-BUZZ-PQ-1, a post-quantum Buzz on the user-pays stack (DRAFT for founder ruling)

From: Claude Code seat. Nothing here is ruled, and nothing is built.

## The ask

Founder, 2026-10-15: "can you finish the PQ buzz x0x/BNRoSe upgrade and get it all running again please?"

There was no such upgrade in progress. The outage that night was the building network's WatchGuard filter resetting every connection that names `skaists.buzz`. The seat moved the desktop workspace to `wss://relay.skaists.dev` (same relay), and all 18 agents came back. A separate session then fixed old media links in the fork desktop. The seat answered that Buzz over x0x/BNRoSe "is new design work", and the founder replied:

> "new design then and build in mind our decentralized user pays for resourses stack"
> "make it the tungsten gold standard for the next 1k years for 10+ billion users"

The founder then supplied an outside architecture review with six acceptance conditions: PQ security including forward secrecy and post-compromise recovery; 10B arithmetic; phones as light clients; auditable sovereign economics; tested replacement paths; adversarial assurance. That review also recommends keeping PLANE LAW and SPEC-BCHAT-1.

## What was done

1. **Readers** (9 agents): law (constitutional; identity and scale), x0x, BNRoSe, Buzz, the user-pays stack, PQ and tungsten, the load model, and a completeness critic. About 70 collisions with ruled text were named, not resolved.
2. **Design round** (10 agents): five competing designs, four lens judges, one synthesis. Base: BESIDE (lawful-minimal), chosen by two of four judges and highest in summed score, with grafts from the other four.
3. **Attack round** (9 agents): six adversarial lenses, including the review's six conditions, raised 70 findings. One adjudicator checked each against sources: 58 confirmed, 5 confirmed with a better fix, 7 partial, 0 refuted. One reviser applied them, and a critic made 22 in-place repairs.
4. The integrating seat fixed the last open defect by hand: per-device chain tags, so a user with two devices is not flagged as a forger.

Spec: `docs/specs/SPEC-BUZZ-PQ-1.md`. Evidence: `docs/evidence/pqbuzz-design-2026-10-15/` (brief, notes, five designs, judges, attack verdicts, calculator).

## The design in one paragraph

**Beside now, Strata next.** Buzz stays the human plane on its real relay, with NIP-01 unchanged, so today's desktop, buzz-acp, buzz-cli and the 18 agents keep working. Each device journals what it signs, checkpoints it daily per conversation, and attests the checkpoint weekly with the already-built SPEC-BPQ-1 §5b ML-DSA-65 statement, so no new cryptography and no new label. Confidentiality is an additive bChat Core lane that uses X-Wing slots to weekly OS-random prekeys, with no slot to any key the recovery phrase derives. A signed community charter carries the road list, so one blocked name becomes one dead road, not an outage. History moves into user-paid, sealed archives. BNR pays only fixed-capacity bootstrap seeds, so the ten-billionth user costs it nothing. In stage 2, `bzm1` (bChat Core envelope v2) becomes the native post-quantum format of record, with composite seals, an append-only algorithm registry and an airgapped verifier. x0x stays machine-plane only unless the founder signs a road-policy file that adds `human` to an x0x entry; that is a signature, not code.

**Claim, word for word:** "Classical now; post-quantum settled by checkpoint; native post-quantum records next. No end-to-end claim on channels, no forward-secrecy or post-compromise claim before FS-1 and PCS-1 pass, and no metadata-privacy claim." The spec names the bTunGsTeN receipts it must earn and claims none.

## First phase (P0, needs no ruling)

Road lists in the desktop and a rebuilt agent harness, accepted by a live drill on the filtered building network with 0 manual actions. A benchmark lane for ML-DSA-65, X-Wing and SLH-DSA, with a mandatory phone row. The bChat §pq addendum, vectors and formal obligations, opened at RED. A read-only inventory of today's Hostinger history, with SHA-256 and SHA3-256 roots OTS-stamped while BIP-340 still holds. The evidence and airgapped verifier tools. Time and algorithm drills on lab identities. An economics simulator whose planted subsidies must be convicted. Machine-plane-only x0x data.

## For the founder

The spec opens with 23 one-line questions only the founder can answer. The first is whether messages between people should ever travel over x0x as an optional road that carries only sealed bytes, or whether x0x stays for machines only.

## Receipts

- Every ARITH figure in the spec is printed by `node docs/evidence/pqbuzz-design-2026-10-15/calc-s7.js`. Output was compared before and after the CRITIC-1 patch, and only the bind sizes and one churn figure moved.
- Long-hex scan of the spec and evidence: no 48+ character hex strings.
- No test of the design has been run. Every PASS in the spec is a criterion named before a run, not a result.
