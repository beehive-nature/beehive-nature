# x0x authenticated peer transport — live evidence, 2026-10-20

Issue #479's next bar: "independent hosts using real x0x authenticated
peer transport, with attributable delivery evidence through partition,
peer failure, and autonomous recovery." This file records what was
OBSERVED live this wake, without inflation, plus the named blockers.

## Setup (real, not mocked)

- Real x0x **v0.48.1** public release, Windows-x64 build, sha256
  verified (`707433d0…`). GPG signature NOT verified in this
  environment (the `.sig` asset is not OpenPGP-shaped here) — named,
  not skipped quietly; the zip's `build-provenance.json` shipped
  alongside.
- TWO real `x0xd` instances on this box (`--name labA` / `labB`,
  separate data dirs, separate API ports 12701/12702, separate
  Bearer tokens — never printed), distinct ML-DSA agent identities:
  - labA `5948117a…aefa1b` ("figure kosovo itself pact")
  - labB `cf96caac…df0836` ("sing helpful pill alan")
- Joined the real gossip plane (17–18 public peers each); a private
  `network_id` was attempted but the peer cache reconnected prod —
  noted; the lab transfer rode the REAL public mesh rendezvous.

## Observed: attributable, byte-exact delivery (PROVEN)

1. labB announced; labA discovered labB via `agents list` (agent id +
   public-side address).
2. labA `send-file` → transfer receipt `6fce47c8…`, attributed to
   labA's agent id.
3. labB accepted; the daemon recorded `bytes_transferred: 507`,
   `remote_agent_id: 5948117a…` — attributable delivery evidence.
4. Received bytes sha256-IDENTICAL to the sealed fixture artifact
   (`publication-state.json`, `d418319d…`) — byte-exact over the real
   authenticated transport. The /2 chain verification applies to these
   identical bytes by construction (the crate's own chain tests cover
   the fixture class; byte-identity is the transport's proof).

## Observed under fault (honest, including the rough edges)

- **Pending transfers are volatile.** With three unaccepted transfers
  pending, labB was stopped and restarted: the pending queue was GONE
  after restart. Recovery shape: the SENDER re-sends; nothing durable
  held the offers. (x0x's held-data durability applies to accepted
  data/stores, not pending offers.)
- **Post-restart re-delivery currently fails at the offer stage.**
  After both nodes restarted (clean data dirs preserved), announce +
  discovery succeeded, but `send-file` refused with `send offer failed:
  peer did not accept the file control frame (HTTP 500)` — reproduced
  twice, including with the receiver's watcher running. This is a real
  x0x v0.48.1 restart-path rough edge, NAMED here — not worked around,
  not hidden. It bounds today's "autonomous recovery" claim: delivery
  after a clean co-start is proven; delivery after peer restarts hits
  this seam.
- `x0x connect <words>` decodes location words to the PUBLIC-side
  address — loopback labs must rendezvous via announce/agents-list.

## Named blockers to the full bar

1. **Multi-host** — the estate box SSH timed out (three attempts
   2026-10-20); no second estate host is mine to administer. The lab
   above is two real nodes on ONE host, labeled.
2. **The restart-path offer rejection** above (x0x-lane question, not
   ours to patch inside x0x; recorded for upstream).
3. Autonomous recovery (no operator) remains unproven — the honest
   recovery observed requires sender-side re-send action.

Disposition: `rail-manifest.json` statuses UNCHANGED (x0x stays
declared/unqualified for corpus delivery). This file is evidence, not
promotion.
