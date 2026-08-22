# BRIEF — MX-5 · WHERE the wallet gate merges for exchange spend (decision-ready, one word)

**Gate:** MX-5 — the ruled-open WHERE question (WALLET-GATE LAW `366ea1f`: ops/functions
behind a wallet session, SIWE-shaped, no PII, ≠bzDiD). **This brief does not resolve the
gate.** It makes the founder's one word a 30-second decision by laying the four real
candidates with their trade-offs and one recommendation.

## The candidates

**A — inside `wallet-relay` (the existing relay).** The relay already exists, is
axum/keyless-tested, holds the heartbeat + read lanes, and carries the estate's
operational identity. Spend endpoints ride the same process.
*For:* zero new services; one audit surface; the relay's never-holds-keys law already
disciplines the shape. *Against:* couples read traffic with spend authorization — the
blast radius of a relay bug becomes economic, not just informational.

**B — inside `bmesh-serve` (the stack-proof lane).** The htmx/Alpine + sqlite lane is
already built, running, and shaped exactly like an exchange backend (POST + session +
journal). 
*For:* the exchange IS its first customer; the Journal trait already abstracts state;
sqlite-first matches prototype scale. *Against:* newest code; the prototype would carry
real authorization before its conformance history is long.

**C — a standalone wallet-gate service (the literal 366ea1f shape).** One small service:
issue session, verify signature, mint scoped capability, proxy authorized spend calls.
*For:* the cleanest blast-radius isolation; the gate law's original shape; any lane
(relay, serve, future) calls it. *Against:* one more moving part on community iron.

**D — contract-side (on-chain session/allowance).** The b-token contract itself holds
allowances; the "gate" is a signed allowance on Jungle/mainnet.
*For:* maximally verifiable. *Against:* MX-7 blocks it until the b-build passes Jungle;
wrong lane for the A-prototype phase; every UX interaction becomes a transaction.

## Recommendation

**C now, A as its first caller.** The standalone gate is the ruled shape, is small
enough to build to the bmesh-ram gold standard (pinned source-analog: the 366ea1f
ruling text; conformance = session-issue/verify/expiry vectors; negative controls =
replay + wrong-origin + expired-session), and keeps the relay's read purity intact.
B stays the exchange's FRONT; D stays behind MX-7 where the two-track ruling put it.

**One founder word — "C", "A", "B", or "D" — resolves MX-5 and arms the build lane.**
