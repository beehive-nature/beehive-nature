# G0 voice evidence — full hashes, health/queue, tunnel-down receipt (2026-09-07)

Completes the evidence the G0 receipt
([`cca77bbd`](2026-09-07-zcode-g0-integration.md)) and its
[addendum](2026-09-07-zcode-g0-addendum.md) left at 8-hex md5-prefix level.
The addendum proved all seven files md5-identical; this dispatch records the
FULL digests, the voice door's health and queue state, and the tunnel-down
receipt. Comparison base: freshly fetched `origin/main` at
`54a53c23` (fetch run this session, immediately before hashing).

## 1. Seven-file parity, full digests

All five deployed voice files live on the box (`oracle` = the hive box);
both laptop helpers live at `C:\Users\travi\x0x-win\`. `✓` = deployed bytes
hash-identical to the `origin/main` blob (sha256 AND md5 both compared).

| file | deployed home | sha256 (deployed == origin/main) | md5 | |
|---|---|---|---|---|
| `ops/voice-scribe/voice-scribe.mjs` | box `/opt/voice-scribe/` | `a5ca90fdf4d956502659d305e293c1a54667081e632b0d82147ee4bbbb9e3272` PUBLIC-CONSTANT: deployed voice door digest | `866941a0461067c893023dad7edd7805` | ✓ |
| `ops/voice-scribe/voice-scribe.service` | box `/etc/systemd/system/` | `776f6f8de5d2401606b5cd432ce6e16444122936cccf7772ac621e5ad0f3c240` PUBLIC-CONSTANT: deployed systemd unit digest | `cc3b00112471d3a525222a36ff7a3b4c` | ✓ |
| `ops/voice-scribe/work-queue.mjs` | box `/opt/voice-scribe/` | `992fbe216fd998832d93b1f82c3367eb46090a872e98d2db3ebc6c331a298efc` PUBLIC-CONSTANT: deployed queue module digest | `6274a02213f8b5fcb0c8346caac3fe89` | ✓ |
| `ops/voice-scribe/package.json` | box `/opt/voice-scribe/` | `003d7110bbe6b37a4978f6e2d77f4a0548e8ed06b328ecf67c0db8c3e37efbed` PUBLIC-CONSTANT: deployed manifest digest | `cfce89a64c413d56bdd973c78e7159d6` | ✓ |
| `ops/voice-scribe/package-lock.json` | box `/opt/voice-scribe/` | `cce02214645e8e0635e1cae2049003bd97c7c7d8a20731f4851b963d7ce9021a` PUBLIC-CONSTANT: deployed lockfile digest | `900083be65f6b9b95c356de8745de69d` | ✓ |
| `ops/x0x/x0x-tunnel.ps1` | laptop `C:\Users\travi\x0x-win\` | `afbab9b2b02b36c76aa31cd99af5c31fa5703d2fc66a2555e9516750697990e1` PUBLIC-CONSTANT: installed laptop helper digest | `fb67bf003b14b0839a329544605d05ef` | ✓ |
| `ops/x0x/box-tunnel.sh` | laptop `C:\Users\travi\x0x-win\` | `c78bb37618f6b356c17324a45f30a07d2ba9cd57187393c6622cc52d0b6c8790` PUBLIC-CONSTANT: installed laptop helper digest | `7868f83a9d20d9db6b2eb0e4635e02c5` | ✓ |

Every md5 prefix extends the addendum's table unchanged — continuity with
the prior evidence, now at full width. No file drifted between the G0
session, the addendum, and this pass.

## 2. Voice health and queue (2026-09-07T03:29Z)

Public door (the road a phone rides), `GET https://skaists.buzz/voice/healthz`:

```json
{"ok":true,"model":"ggml-large-v3-turbo-q5_0.bin","langs":["lv","th","ru","uk"],"canonical":"https://skaists.buzz/voice","queue":0}
```

Box-side bind `172.18.0.1:8093/healthz` (read on the box over SSH): byte-same
JSON — `ok:true`, queue `0`. systemd: `voice-scribe` **active** and
**enabled**. Queue depth zero across both observations = no active
transcription workload during evidence; the door is idle-healthy, not
backlogged.

## 3. Tunnel receipt — exercised, then left DOWN

- `x0x-tunnel.ps1 up` → `SSH tunnel UP for 600s`; status read
  `UP; lease remaining 598s; mode api`; `127.0.0.1:18080/health` answered the
  BOX daemon's own JSON: `0.41.3, healthy, peers 27, send_ready 27` — the
  forward carries the box's loopback, no laptop P2P process started.
- `x0x-tunnel.ps1 down` → helper reported down; status read
  `SSH tunnel DOWN.`; post-down probe of `127.0.0.1:18080` refused
  (`curl: (7) Could not connect`). The one SSH session used for the box-side
  reads above was closed on completion.

Tunnel state at rest: **DOWN**, per the acceptance line. x0x box daemon
observed `0.41.3` healthy, 27 peers (~4.8 h uptime at read time).

## 4. The §7 exception — documented history, not rewritten

`74066fdb` (the GitHub-API web-merge of PR #2) carries the founder's
GitHub-noreply identity as author; §7 correctly reads that commit red. Under
the no-force law this is **permanent history**: it is not rebased away, not
amended, not healed — the descendant `cca77bbd` restored a green CHECKED
RANGE, and that is the whole of the repair. The class is prevented going
forward by the standing local-merge law (estate merges are made locally with
the canonical identity and pushed, never via the API merge button). This
section changes no commit; it records why the exception stays visible.

## 5. Attribution

This commit carries the corrected T3 shape per `scripts/identity-check.sh`:
author = the founder (canonical), committer = the zCode seat, parsed
`Co-authored-by` trailer below. Founder-typed (author == committer) remains
reserved for founder-typed commits.
