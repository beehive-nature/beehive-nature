# x0x #622 measurement prep: pin resolved, binaries pinned, execution packet staged — awaiting host approval

zCode seat, 2026-09-10, under the founder's measurement orders
(`buzz-repair/2026-09-10/zcode-x0x-622-measurement-orders.md`). Upstream ask
(David, [#622](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5615274866)):
run the existing `scripts/capture-egress.py` on a real public-mesh Leaf and
attach the output; separately, a per-peer published/delivered message-ID
control when possible. No live capture was run from this seat and none is
claimed. Backend Astra owns the public follow-up.

## Completed (receipts)

- **Full #622 discussion read.** No newer comment after our reply
  ([#5627339402](https://github.com/saorsa-labs/x0x/issues/622#issuecomment-5627339402));
  David has NOT yet answered the pin question, so current main stands.
- **Upstream re-check (2026-09-10):** newest published release still
  v0.41.3; main still `6cc4085c72205df7e4feda006b7052bbca5ddaf6`; the
  collector has exactly one commit (`bd0d23ff`) — no later fixes to apply.
  Main is versioned `0.41.4`, past the released 0.41.3.
- **Instrumented binaries pinned** = upstream's own CI run **34534309338**
  (build.yml at exactly `6cc4085c`, success): `x0x-linux-x64-gnu` +
  `x0x-linux-arm64-gnu`, executed under WSL (`x0x 0.41.4` / `x0xd 0.41.4`),
  sha256 recorded in the packet §0. Upstream gitignores `Cargo.lock`, so the
  lockfile pin is the CI job's own resolution — stated, not papered over.
  CI artifacts carry no GPG signature (release tarballs do) — flagged, with
  the re-pin trigger.
- **Instrumentation verified in source at the pin**: `gossip_diagnostics`
  emits `participation`/`subscribed_topics`/`outbound_by_topic_named`/
  `egress_budget`/`pubsub_stages`/`discovery_cache_entries` with route
  tests; default Leaf (`reason: "default_leaf"`) absent `--relay`/
  `gossip.relay`; `skip_legacy_dm_bus` exists, default off. This is why the
  oracle 0.41.3 structurally cannot pass §5 and these binaries can.
- **Collector + §5 rules read at the pin.** Confirmed in code: `--out-dir`
  overwrites (`exist_ok=True` + `write_text`) and validates the ≥300 s floor
  only AFTER the window — the packet mandates a new exclusive evidence dir
  per attempt and pre-validated duration.

## The blocker (precise)

No already-approved isolated measurement host exists. Oracle is the
production instance (founder-order 0.41.3; identity/service/ports/ACLs
untouchable; ineligible diagnostics). The laptop is public-mesh-forbidden
(standing law, ops/x0x/LAPTOP-NETWORK.md). A temporary VPS is a cloud-policy
founder gesture outside this build seat. Per the orders, that is a concrete
blocker — not license to claim the measurement or move to new features.

## Prepared

**`ops/x0x/MEASUREMENT-622.md`** — the full execution packet for Astra
review: provenance + digests + re-fetch path; provisioning spec with
declared finite bounds (3h wall-clock with a poweroff lease, MemoryMax 768M,
CPUQuota 200%, ≤1 GiB disk, ≤2 retries); fresh-throwaway-identity deploy
(separate user/ports/state from any prod naming); §5.1 default-Leaf config;
eligibility gate commands; stability gate; mid-window 60 s health sampling
+ service-log continuity (§5.4 items the collector does not enforce);
1200 s collector invocation with idle law; reject/restart protocol that
preserves failed evidence; sanitization rules + the Linux/VPS provenance
disclaimer (no Windows-host reproduction, no before/after, no reduction
claim); scoped cleanup. Pinned binaries staged locally at
`buzz-repair/2026-09-10/x0x-622-pinned-binaries/` (never committed; repo
re-fetch instructions in the packet).

## Unperformed

- The live public-mesh capture itself (blocked on host approval above).
- The per-peer delivery control: needs a second approved instrumented peer;
  also flagged to Astra that **no inbound `message_kinds` counter exists at
  this pin** (source-checked) — David's as-specified receiver-side counter
  is an upstream diagnostic gap; the ID/timestamp comparison remains
  doable at the application layer with approved synthetic traffic. If no
  second peer is approved, this part is reported unperformed — counter
  deltas never substitute.
- Any public posting on #622 (Astra owns; this seat posts nothing).

## Handoff

Astra reviews `ops/x0x/MEASUREMENT-622.md`; founder provisions the temporary
host (or names an approved existing one); the packet runs as written; the
sanitized summary returns to #622 under Astra's name. The Connect Store
candidate `f02f0f6e`/`7302cabf` remains accepted-and-merged locally; its
next feature lane stays behind this upstream measurement request.
