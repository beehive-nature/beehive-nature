# G0 integration receipt — Astra audit PRs merged, parity proven (2026-09-07)

Claim: [issue #3](https://github.com/beehive-nature/beehive-nature/issues/3).
zCode seat, existing review session, per the
[task docket](../2026-09-06-zcode-task-docket.md).

## Independent re-verification (before merging — my four conditions)

1. **Leash (reconciled, verified stronger than my original):**
   `ops/x0x/box-tunnel.sh` line 48 structurally refuses any lease outside
   **1..600 seconds** ("10-minute maximum") — a lease/watcher architecture,
   not a sleep timer; the PowerShell wrapper delegates to it and documents
   exactly one canonical path. The 120-minute override is gone.
2. **Dependency provenance (claim verified):** main's PRE-PR lockfile and
   the PR lockfile BOTH resolve `nostr-tools 2.25.2` — the old `^2.10.4`
   declared a range; the PR pins what was already installed. No upgrade
   occurred on the production voice door.
3. **Checks at the pinned head `ac17e3da`:** 8/8 SUCCESS (verified at that
   exact head, not the prior one).
4. **PR #1 (LOVErnment-DAO):** formatting-only by diff stats
   (14 files, +233/−207), CI green — no semantic content.

## Merged

- beehive-nature **PR #2** → merge commit `74066fdb`.
- skaists/LOVErnment-DAO **PR #1** → merged.

## Deployment/main parity (the G0 acceptance, proven byte-for-byte)

| file | main md5 | box md5 |
|---|---|---|
| `ops/voice-scribe/voice-scribe.mjs` → `/opt/voice-scribe/voice-scribe.mjs` | `866941a0…` | `866941a0…` ✓ |
| `ops/voice-scribe/voice-scribe.service` → `/etc/systemd/system/voice-scribe.service` | `cc3b0011…` | `cc3b0011…` ✓ |
| `ops/voice-scribe/work-queue.mjs` → `/opt/voice-scribe/work-queue.mjs` | `6274a022…` | `6274a022…` ✓ |

Box healthy at read time: `voice-scribe` active (whisper door serving,
langs lv/th/ru/uk), `x0x` active with 27 peers.

## The §7 lesson (this commit is the heal)

The `gh api` web-merge authored `74066fdb` as the founder's GitHub-noreply
identity, violating §7 on the pushed range (seats are committers/trailers,
never authors; the founder is always author). PR-event runs check
base..head (green — Astra's commits are correctly founder-authored); only
the push-to-main run sees the synthetic merge as the range. **New standing
law: estate merges are made LOCALLY with the canonical identity and pushed —
never via the GitHub API merge button.** This receipt commit is the
descendant that restores a green range.
