# 2026-10-09 — bTunGsTeN L5: configuration intent is never runtime evidence — canonized, with the four-receipt boot gate and the trust-domain triplet

Lane: btungsten / vaulta-zk bridge. Seat: zCode. Order: founder
2026-10-09 (the four-receipt boot-gate message: "Banked. The posture is
now coherent and testable rather than inferred from configuration
comments.").

## Reconciliation first

The order matches proven ground; every operational claim in it is
already executed and receipted:

- **The gate ran GREEN.** The Jungle4 follower's four one-shot receipts
  (EXPOSURE → IDENTITY → PEER → AGREEMENT) are GREEN, harness committed
  in-tree (`contracts/zkreceipts/follower-boot.sh` +
  `follower-receipts.sh` + `receipt-follower-boot.json`), receipt kept
  verbatim at `docs/receipts/zkr-jungle4-follower-boot-2026-10-08.txt`,
  handoff law in `docs/dispatches/2026-10-07-zkr-finalizer-v4.md`.
- **zkreceipts interaction was permitted only after GREEN — and ran.**
  The live v4 finalizer confirmation executed green on `zkrtst111111`
  (exit 0, 9 passed / 0 failed / 0 never-ran) with the trust-domain
  triplet labels the order names: `verification_source` = the SAME
  receipted follower instance, `submission_source` = greymass, execution
  block anchors compared before any push
  (`docs/dispatches/2026-10-08-zkr-live-v4-confirmation.md`).
- **The zero-handshake discipline held.** Spring v1.2.2's
  `allowed-connection = none` rejecting ALL handshakes (including
  responses to our own outbound dials) was diagnosed from evidence — TCP
  egress to all nine peer ports proven open, clock skew measured — and
  amended LOUDLY, never silently
  (`scripts/tmp/zkrv4-boot-follower.sh` findings block; the committed
  config carries the corrected reading).

**The delta**: the law itself lived in dispatch prose. The order raises
it to the standard ("One further law follows naturally") — so it is now
canon.

## What landed

**SPEC-BTUNGSTEN-1 §laws L5 — Configuration intent is never runtime
evidence** (founder ruling 2026-10-07, canonized 2026-10-09), carrying
the order's own clauses:

- nine configured peers ≠ nine connected peers; loopback config ≠ closed
  socket; configured chain ID ≠ independent agreement; successful RPC ≠
  execution provenance;
- the four evidence classes in order, each with its proof object
  (listening sockets / the node's own `get_info` /
  `/v1/net/connections` / local LIB `(block_num, block_id)` vs an
  independent source);
- the trust-domain triplet attached to every downstream artifact —
  strictly stronger than "transaction succeeded";
- one-shot binding per runtime instance (restart/config change inherits
  nothing);
- the zero-handshake discipline: a zero-handshake first boot is itself
  evidence; diagnose compatibility/reachability/protocol/firewall
  semantics BEFORE loosening posture, never silently;
- the first receipted instance named: the Jungle4 follower and the
  gated live v4 run.

**SPEC-ZK-RECEIPT-AGGREGATES-1 §tungsten** gains the cross-reference:
the lane's runtime-admission law is L5 standard-side; the lane spec
remains its first receipted instance.

## Boundaries

- Text-only canonization: no code, no surfaces, no live runs. The
  receipts named are the existing ones; nothing new is claimed.
- The follower instance's one-shot receipts govern as before: an
  instance restart requires re-running `follower-receipts.sh` before
  further verification-source claims.

## NEXT OWNER

- CI green on this PR → this seat merges.
- PR #378 (the Skaists SETTLE bridge) remains open, blocked on the
  bDroP seat's inherited footer-audit red — unchanged from its dispatch.

HUMAN INTERACTION: NONE.
