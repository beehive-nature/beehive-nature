# UPSTREAM COMMENT — llama.cpp #27388 — **POSTED 2026-09-16T05:03:25Z** (founder word)
<https://github.com/ggml-org/llama.cpp/issues/27388#issuecomment-5692308653> (issuecomment-5692308653)

Body below is the exact posted text, kept verbatim for the record.

Prepared per founder ruling 2026-09-16 ("draft, but do not post"). External
action = founder word. Content check: no private infrastructure detail (no
IPs, domains, deployment names, customer/workload specifics, keys) — versions,
flags, model, and journal lines only.

---

Reproducing this on **CPU / aarch64**, with a hard receipt for the
"process ignores SIGTERM" case:

**Environment**

- llama.cpp tag `b10991` (`llama-server --version`: 0.4.1-dev @930e2fa),
  CPU-only aarch64 (4 hardware threads usable), Ubuntu 24.04, kernel
  6.17.0-1020-oracle
- Model: Qwen3.5-4B (unsloth `UD-Q4_K_XL` MTP GGUF, draft heads in-file)
- Server: `--spec-type draft-mtp --parallel 1 --cont-batching -fa on
  -ctk q8_0 -ctv q8_0 --ctx-size 16384 --threads 3`

**Symptom — identical signature to the OP**

Under use, a slot wedges: the first requests answer normally (~1.6 s), then
every completion queues forever. `/health` keeps returning
`{"status":"ok"}` while `/slots` never answers — matching your mutex reading.
The trigger correlates with **clients disconnecting mid-generation**
(aborted streaming requests).

**The SIGTERM receipt (systemd journal)**

```
systemd[1]: Stopping <service>…
systemd[1]: <service>: State 'stop-sigterm' timed out. Killing.
systemd[1]: Killing process … (llama-server) with signal SIGKILL.
systemd[1]: <service>: Main process exited, code=killed, status=9/KILL
```

SIGTERM was ignored for the full 90 s default `TimeoutStopSec`; SIGKILL
required. So the wedge also blocks orderly shutdown, not just new requests.

**MTP vs plain decoding, same binary + same model file**

- Plain decoding (no `--spec-type`): a 12-case stability battery passes,
  **including recovery from a deliberately aborted 400-token generation**.
- With `--spec-type draft-mtp`: the wedge above, within minutes of
  interrupted clients.

Small sample, and given this issue reproduces without MTP on GPU, I read MTP
as an amplifier rather than the root cause — plausibly the abort path racing
draft/decode bookkeeping widens the window enough for a single-slot CPU
setup to hit it quickly.

Your `/slots`-not-`/health` liveness observation is the practical mitigation
on our side: a watchdog probing `/slots` with a hard timeout detects the
state immediately (healthy `/slots` answers in <1 ms here), which also
suggests a simple in-server detectability hook if a full fix takes a while.

---

*(end of draft — not posted)*

## Posting receipt

Posted verbatim as [issuecomment-5692308653](https://github.com/ggml-org/llama.cpp/issues/27388#issuecomment-5692308653), 2026-09-16T05:03:25Z, per founder approval ("Approve posting the upstream #27388 comment"). Production untouched; watchdog stays banked, not wired.
