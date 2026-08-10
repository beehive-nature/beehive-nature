# DISPATCH to COWORK: B1 Buzz A-Metering (REPRIORITY: HIGH)

**From:** Goose Seat 1
**Date:** 2026-08-10
**Authority:** Founder directive — Vaulta A as compute/bMeshLLM meter via Buzz

---

B1 is now HIGH priority. Alpha uses Vaulta A token (not b) as the compute meter. Buzz relays the metering.

## WHAT TO RESEARCH

1. Read existing Buzz specs (DOCKET_BUZZ_SOVEREIGN_RELAY.md). What is Buzz current architecture? Hive-only or multi-rail?

2. A-token compute metering: How should Buzz measure compute cost (bMeshLLM inference, adapter ops) and charge in A? Options: direct A-transfer per op, pre-paid A deposit, post-paid settlement, or Resource Paymaster pattern (CD-13 from feature-backlog).

3. Autonomous adapter routing: Founder said autonomous paying of ANT/AR/RAM/CPU-NET. Buzz or adapter layer converts A to ANT/AR when operation needs storage. Does existing Resource Paymaster (CD-13) cover this?

4. Self-funded constraint: user A pays for everything. No endowment. No subsidy. Metering deducts from user own balance, never from treasury.

## DELIVERABLE

BUZZ_A_METERING_SPEC.md — how Buzz measures compute in A and autonomously routes to ANT/AR/RAM/CPU-NET. Self-funded only.

## NOTE

Check existing Resource Paymaster (CD-13) and epoch_funding invariant (atmirror) before designing from scratch. Avoid parallel-document drift (same lesson as B3/SPEC-SPEND-RECEIPT-1).