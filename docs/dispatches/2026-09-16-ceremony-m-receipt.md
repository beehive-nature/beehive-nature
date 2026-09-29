# CEREMONY M RECEIPT — AV-1 promoted to D; AV-2/AV-3 half-proven, ceremony STOPPED · 2026-09-16

**Order (founder, verbatim):** *"Gesture M is GO… deploy current meter
engines → 300s TTL remains the ratified configurable default → freshly
mint the rate set → verify the real caller wiring → one restart → AV-1/2/3
drills… Do not claim D unless the drill travels through the real deployed
caller and real live signal. If any one of the three fails, stop Ceremony M
there. Preserve the evidence; don't 'finish the ceremony' by fixing forward
invisibly."* **Outcome: AV-1 = D. AV-2 and AV-3 = live-proof failures
(evidence below). CEREMONY STOPPED at the failure; Gesture D NOT run
(pre-authorization required M to close cleanly).**

## What was done (all receipted)

1. **Pre-flight census (read-only):** box road = `ubuntu@129.153.202.144`
   via `~/.ssh/bnr_key.lf`; the suspected older `serve` CONFIRMED LIVE
   (PID 3912, `/opt/buzz-meter`, all hashes ≠ repo, `x402_meter.py` absent
   entirely). Concurrent agents: bClaude (member, not in /opt), the off-prod
   watchdog soak, a dormant Aug-28 tmux, and a ~3-min auto-pull timer on
   the checkout (explains "self-sync"). Morning artifacts found and
   PRESERVED untouched: `gate-bounded.js`, `meter-pd.py`,
   `keys.json.pre-bounded` (another seat's unbanked live work — flagged
   for that lane).
2. **Precondition merge (open, attributed):** AV-1/2/3's engine code lived
   only on unmerged `origin/zcode/av2-stale-quote-ttl` (the parallel P0/P1
   campaign incl. the Rust TTL `QUOTE_TTL_SECS=300` + python batteries).
   Merged to main as `cf8dfcee` (founder-typed merge, tests.yml keeps BOTH
   audit steps); full local batteries green before landing (voucher-escrow
   17, door 11+11+2+10+2).
3. **Deploy:** engines copied to `/opt/buzz-meter` (hash-equal to
   `b6f89873`); rate set deployed via sudo (root:root 644). Pre-ceremony
   backup at `~/m-ceremony-backup-20260916/`.
4. **Fresh mint ×2** (final `minted_at 2026-09-16T22:56:02Z`, rateset-v2
   rows byte-exact) — banked in-repo (first mint `b6f89873`; the re-mint
   commit lands with this receipt).
5. **Wiring verification found the admin rail DEPLOYED-DARK:**
   `VOUCHER_ADMIN_TOKEN` unset. Wired: root-owned
   `/opt/buzz-meter/admin.env` (600) + unit drop-in `admin-token.conf` +
   daemon-reload. (Env-count probe read 0 on a pid race; the authed
   request succeeding is the live proof.)
6. **Restarts: three, causes receipted** (deploy restart of both units;
   token-wiring restart; systemd's crash-restart inside the AV-1 drill) —
   a deviation from the "one restart" shape, named honestly.
7. **AV-11 CI note:** the merged workflow now runs BOTH R5 censuses
   (`r5-surface-audit.mjs` + `audit-human-gas.mjs`), 49/49 shape-guarded.

## The drills

**AV-1 — PASSED, promoted to D.** Real serve, real admin rail, real
ledger: settle with `X-AV1-Crash-Before-Respond: 1` → curl rc 52 (killed
after durable append, before response) → systemd auto-restart → replay of
the SAME idempotency key returned the ORIGINAL chained event
(`hash db5d9434…`, `prev 1fd34ea9…` = the pre-drill tail) → ledger delta
exactly 1, exactly one event for the key. Exactly-once across kill+restart
through the real deployed caller.

**AV-2 — FAILED the live bar (STOP #1).** Engine halves green on
deployed-equal bytes (on-box battery: stale refuses typed with zero
mutation; boundary inclusive; absent passes). But the LIVE stale-rate
probe did not refuse: a real request through the compute gate
(`buzz-meter-gate` :8091, bound key `bclau-paid-1`) at rate age ~12 min >
TTL 300s **succeeded (HTTP 200, completion returned)** — the gate→llama
path does not traverse `rate_set_in_force` at open; TTL enforcement lives
on the x402-session callers (watch-room/vending family), which this drill
did not and cannot honestly claim. **AV-2 stays B**: deployed +
engine-proven, no live caller demonstrably traversing the enforcement.

**AV-3 — FAILED the billing half (STOP #2).** Outage half proven live:
gate stopped (`inactive`) → request refused (rc 7) → **ledger delta 0
through the outage** → gate resumed (`active`). But the post-recovery
request produced **no charge event in the observation window** (ledger
13→13; `buzz-meter` watch journal quiet since restart), so "resume bills
only post-recovery delivery, no backfill" is UNPROVEN — root cause not
chased (stop law). **AV-3 stays B** with the outage half receipted. Note:
two 5-token drill requests rode `bclau-paid-1` (microscopic unbilled
usage; may settle asynchronously — evidence stands either way).

## Preserved evidence

`~/m-ceremony-backup-20260916/`; journal windows (voucher-bridge + meter);
ledger states before/after each phase; gate-access log; all hashes in this
receipt; the failed-probe responses verbatim above.

## Named follow-ups (findings, NOT executed — founder's call)

1. **TTL is not on the compute-gate path** — wiring `rate_set_in_force`
   into the gate's session open (or routing gate sessions through the x402
   meter) is an architecture decision, manufactured by no one but the
   founder.
2. **Post-recovery billing observability** — where a gate request's charge
   should appear and when (watch async cadence) needs the meter lane's
   answer before AV-3 can re-drill.
3. The morning seat's unbanked live artifacts (`gate-bounded.js`,
   `meter-pd.py`) need banking by their lane.

**Gesture D: NOT RUN** (pre-condition "M closes cleanly" unmet). The
ledger updates to AV-1=D, AV-2=B, AV-3=B ride this commit.
