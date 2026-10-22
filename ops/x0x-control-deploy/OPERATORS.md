# Operators — dApp-user carried control plane (design, 2026-10-22)

Decision (founder, this date): Buzz dApp users are the operators;
the first traffic they carry is x0x-control orders/receipts; the
goal is fixing the laptop->box order path. This design galvanizes
x0x (mesh identity/gossip), WebRTC (anonymized direct data
channels, the bview.html/bdata.html POC plane), ANT/Autonomi
nodes (seed egress + durable seed storage), and the estate's
zero-egress law: user bandwidth scales with users; the estate
carries ~nothing.

## Why this exists (measured, 2026-10-22)

From the NAT-side laptop, every server-mediated x0x path into
buzz-hostinger failed while the reverse worked:

- gossip publish to `x0x-control/orders`: accepted (`ok`), never
  delivered to the box subscription (multiple retries, interest
  exchange attempted);
- `x0x direct send`: connect resolves, send times out (504);
- `x0x forward` byte-stream to box loopback API: registers,
  connect ACL installed on the box and enabled (after restart),
  stream never carries (`active_streams: 0`);
- box->laptop gossip (receipts): works, repeatedly.

The bridge itself is proven (box-local intake + receipt
publication). The missing leg is a user-carried direct channel
that does not depend on the box's mesh view of a NAT-side peer.

## Operator model

- An operator is any running Buzz client (bview/bdata lineage)
  holding: an x0x agent identity, one or more RTCDataChannels,
  and a store-and-forward outbox. Operating is opt-in per client.
- Operators carry ONLY sealed envelopes and signed receipts —
  ciphertext end to end (ML-KEM-768 seal; scope policy decides on
  the box). An operator learns sizes and timing, nothing else.
- Seeding: a new operator bootstraps peer addresses from (a) x0x
  gossip announce, (b) Autonomi/ANT seed records (durable,
  content-addressed peer cards), (c) WebRTC signaling exchanged
  over whichever leg already works (today: box->client gossip).
  Seed egress rides operator peers, never estate bandwidth.
- Receipts return on any working leg; the bridge already
  publishes them to gossip, and an operator channel adds a second,
  independent return path.

## Build order

1. Operator channel in the Buzz client: RTCDataChannel pair
   (client<->box bridge endpoint), envelope-sized messages,
   reconnect + outbox. The box endpoint terminates at the same
   inbox/outbox dirs the bridge serves today — no crate change
   beyond a WebRTC intake that writes the identical files.
2. Signaling over x0x gossip (works box->client today; client->
   box via operator relay until native propagation is fixed
   upstream).
3. Seed cards on Autonomi so a fresh operator finds peers with
   zero estate egress.
4. Retirement gate: when one sealed order round-trips
   laptop->operator-channel->box and its receipt returns, the
   DEPLOY-README section 7 checklist item 1 is met on this
   channel and port 22 can close.

## Bounds

- Operators are untrusted carriers: replay is stopped by the
  nonce ledger, forgery by the seal, privilege by scope policy.
- No operator is paid from estate egress; any future operator
  incentive settles in bPay against metered carried bytes
  (METERED-GATE.md), funded by the traffic's owners.
