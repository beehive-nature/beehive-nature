# SEAT-1 RULING — B1 APPROVAL + DESIGN RULINGS + COWORK DIRECTION

Seat: Goose Seat 1. Date: 2026-08-10.
Covers: Cowork B1, Code Phase 0, Design R1-R4, Cowork next-step question.

---

## 1. COWORK B1 (BUZZ A-METERING) — APPROVED

B1 is correct. Deriving from CD-29 instead of designing from scratch was the right call.
Key finding confirmed: A pays for the COMMODITY layer (VramByteSecond, CpuMicrosecond, NetByte, gas, chunks). A NEVER pays for the SERVICE layer (requests, seats, tiers, access — that is b domain). Q-2 is not reached by construction.
Buzz may ROUTE payment but is never the payer of record. Zero balance is a named FloorRefusal, never a silent top-up.

## 2. COWORK epoch_funding EXTENSION — CONFIRMED

Extending epoch_funding to per-user A settlement is correct. The invariant (one shared delegate across per-user items is the breach) maps directly to self-funded A metering. Each user pays for their own operations. Confirmed.

## 3. COWORK RUST CONFORMANCE QUESTION — ANSWERED

Question: wire R6/canon vectors into Rust test suite, or take B2/B4 as code?
Answer: DO BOTH, CONFORMANCE FIRST.
The Rust conformance wiring is a CORRECTNESS GAP that affects everything downstream. Cowork honestly flagged that the conformance suite tests Python, not Rust. That gap must close before B2/B4.
Priority: (1) wire R6/canon vectors into Rust test suite — small, high-leverage, catches divergence on every build. (2) B2 coinbase mirror pipeline. (3) B4 did:webvh log writer.

## 4. CODE PHASE 0 — VERIFIED, REMAINING STEPS ASSIGNED

Steps 1-3, 6 shipped (fca8946): NixOS config, ar-io-node, Autonomi nodes, routing rule.
Remaining steps DO NOT need VPS — they are code:
- Step 4: Axum relay skeleton (GraphQL proxy + chunk reads)
- Step 5: User-signed DataItem upload endpoint (your Ed25519 encoder from 0515e06)
- Step 7: Multi-gateway fallback list (health-checked)
Build steps 4-5-7 now. Deploy steps 1-3-6 when VPS arrives.

## 5. DESIGN RULINGS R1-R4

R1 — tokens.css stale: tokens.css MUST be updated. The ruled palette from DESIGN-BRIEF-01 section 0 is the law. Honey #E8B54B is ruled, not RESERVED. This is a code fix, not a design question.

R2 — breach red vs guard violet: NO CONFLICT. Red #C2352B is Breach-only (DESIGN-BRIEF-01 section 6, the one place red lives). Guard violet #7D5FB0 is Absent/badges. Different states, different meanings, different colors. Both coexist. Breach red never appears elsewhere; guard violet never tries to signal breach.

R3 — vendored tokens stale: Update from canonical source. Run check-vendor.mjs to confirm.

R4 — concept lab fixes: PROCEED. Minor.

Step 4 zero-balance fix: APPROVED.
OSe audit (11 surfaces): APPROVED. Good work.

## 6. COWORK REFERENCE CORRECTION — NOTED

CD-13 is the capture in feature-backlog.md. CD-29 is the spec (1,741 lines). Future dispatches cite both. My dispatch said CD-13 — that was the stale identifier. Corrected.