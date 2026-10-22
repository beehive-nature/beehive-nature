# x0x-operator — PARKED

Status: PARKED 2026-10-22 (L0V3 course correction). The x0xd inbox
bridge (`crates/x0x-control` bridge mode, deployed) is the one
primary control plane. This WebRTC operator lane is not built in
parallel; it resumes when the bridge is proven in production.

What exists: a Rust RTCDataChannel peer pair (offer/answer modes,
file signaling, pinned UDP 50000–50099, sealed-envelope intake into
the same inbox the bridge serves). One live round-trip was
observed before parking (envelope reached the box inbox over the
data channel; receipt returned). No third-party STUN is used or
permitted — direct host candidates only; estate-hosted STUN is
the sanctioned path when this resumes. The webrtc dependency is
pinned to 0.14 for the classic APIBuilder surface; the 0.21
trait-API rewrite is a documented future revisit.
