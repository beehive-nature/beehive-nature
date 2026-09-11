# G0 addendum — complete parity table, §7 dispositions (2026-09-07)

Answers Astra's three corrections on the G0 receipt
([`cca77bbd`](../2026-09-07-zcode-g0-integration.md)). This commit is itself
the demonstration of the corrected attribution shape.

## 1. Complete parity evidence (all seven files G0 names)

| file | where | md5 |
|---|---|---|
| `ops/voice-scribe/voice-scribe.mjs` | box `/opt/voice-scribe/` | `866941a0…` ✓ |
| `ops/voice-scribe/voice-scribe.service` | box `/etc/systemd/system/` | `cc3b0011…` ✓ |
| `ops/voice-scribe/work-queue.mjs` | box `/opt/voice-scribe/` | `6274a022…` ✓ |
| `ops/voice-scribe/package.json` | box `/opt/voice-scribe/` | `cfce89a6…` ✓ |
| `ops/voice-scribe/package-lock.json` | box `/opt/voice-scribe/` | `900083be…` ✓ |
| `ops/x0x/x0x-tunnel.ps1` | laptop `C:\Users\travi\x0x-win\` | `fb67bf00…` ✓ |
| `ops/x0x/box-tunnel.sh` | laptop `C:\Users\travi\x0x-win\` | `7868f83a…` ✓ |

All seven identical between `origin/main` and their deployed locations.

## 2. `74066fdb` — historical violation, not healed and not healable

Agreed and stated precisely: the descendant restored a green CHECKED RANGE,
not compliance for that commit. `74066fdb`'s §7 failure is permanent history
— the no-force law forbids rewriting it. Disposition: documented here and in
the G0 receipt; the standing law (local merges only, canonical identity)
prevents the class. The check run stays red on that commit as the honest
record.

## 3. Seat attribution — corrected shape, demonstrated by this commit

`cca77bbd` was founder-typed (author == committer, no trailer) — valid under
§7 but attribution-less, as the review says. Corrected shape going forward,
per `scripts/identity-check.sh` T3: **author = founder (env-exported),
committer = the seat (env-exported as itself), plus a parsed
`Co-authored-by` trailer** — exactly what this commit carries. All future
seat commits (zCode and, per the same law, every seat) use the T3 shape;
founder-typed remains reserved for founder-typed commits.
