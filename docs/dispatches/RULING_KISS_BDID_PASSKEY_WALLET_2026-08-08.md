# RULING — KISS: bDiD SHIPS WITH PASSKEY + WALLET · SPEND-VIEW UX (2026-08-08)
**Authority:** Seat 0 (King Bee). Transcribed by research seat to the mailbox.
**To:** all seats

## 1. THE bDiD COMES WITH BASIC FUNCTION ATTACHED
A unique bDiD ships with **a PASSKEY and a WALLET**, the wallet funded to cover the **basic adapter tokens** that identity needs. Identity, authentication, and the means to pay for its own rails arrive as ONE object. A new bDiD is never a keyless, penniless supplicant.

**Why this is load-bearing:** it converts the bootstrap deadlock — "one non-ANT asset injection per agent at genesis, never again," which the gas convergence relocated from ETH to USDC — from a hidden caveat into a **product feature.** The genesis funding IS the bDiD issuance. Answered at the identity layer, not the payment layer. The spec still states the genesis cost honestly; it is now a line item in issuance, not an unexplained precondition.

**Succession bearing:** a PASSKEY holding the authority layer while the identifier and document stay publicly accessible is exactly the W3C DID Core three-way separation — identifier public, document public, **verification method private.** The "freely accessible ≠ unauthenticated" category error dissolves in the shipped design, not merely in theory. The open question is unchanged and narrower: **how does the passkey succeed its holder.**

## 2. SPEND-VIEW UX — AGGREGATE FIRST, ITEMIZED BENEATH
When a function/operation occurs, the user sees a **simple view of TOTAL b spent** (once it runs autonomously and below the hood), **connected to details of how much b itemized PER ADAPTER.**

Autonomy hides the mechanism but **never the accounting.** One number by default; full per-rail breakdown one click down. Lands on the bDashBoard surface.

## 3. WHAT THIS UNBLOCKS RIGHT NOW (ready to draft, blocks nothing)
**L-SCHEMA binds — standardize EARLY, before adoption spreads.** The itemized view needs a shared, strongly-typed **SPEND RECEIPT schema**:
- (a) total, in resource-denominated b/A
- (b) per-adapter line items naming the **rail** and the **resource class** consumed (mesh-seconds, VRAM-byte-seconds, RAM bytes, chunk counts, chain fees)
- (c) the **bDiD** that spent it
- (d) provenance / receipt linkage

**Denominate line items as RESOURCE QUANTITIES, never fiat-pegged** (per the b-spend ruling) — appreciation would otherwise break the itemization.

**Scope fence:** this rules the bDiD's attached function and the spend-view shape. The passkey succession mechanism, the wallet's funding source, and the tiering remain research + options. **Execute the prompt as written.**
