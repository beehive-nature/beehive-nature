# Receipt: My Data wave cap is 59 chunks, measured at the boundary

2026-10-05. Quote only. Nothing was paid, signed, finalized or stored; no wallet and no key file was touched.

**What it settles.** My Data and the local intake allowed 63 data chunks (263,983,104 B). A public upload pays for more records than its data chunks: self_encryption 0.36.0 `shrink_data_map` adds 3 chunks once a DataMap holds more than 3 infos (`lib.rs:390-410`, called and yielded at `stream_encrypt.rs:393-399`), and ant-core pushes the serialized public DataMap as 1 more record before counting (`ant-core/src/data/client/file.rs:2044-2061` at `f095630`). `file_prepare_upload_with_visibility` runs `PaymentMode::Auto` (`file.rs:1971`), which is merkle at `chunk_count >= 64` (`merkle.rs:41`, `:657-663`; called at `file.rs:2071`). This bridge refuses merkle finalize (`tools/antd-bridge/src/main.rs:600-607`). So the largest file that stays on the wave path is 59 data chunks: 59 + 3 + 1 = 63 records.

**Oracle.** The keyless candidate bridge binary `antd-bridge-next/target/release/antd-bridge.exe` in the founder's home, built 2026-09-21 from the running bridge's source (`family-lineage/antd-bridge`, which calls the same `file_prepare_upload_with_visibility(&path, Visibility::Public)` at `:513` and refuses merkle finalize at `:695`) with the same `Cargo.lock` (ant-core `f095630`), run against Autonomi mainnet on a spare port (8837) with an empty scratch state, not the founder's state and not port 8807. Two files of random bytes: the new cap, 247,222,272 B (59 chunks), as the control, and one byte more, 247,222,273 B (60 chunks). Prepare by path with no `audience` field, so the bridge recorded `unspecified-default`, never a founder choice. The wave plan was abandoned. The merkle plan's abandon answered `unknown upload_id` (why was not traced), so that plan ended when the bridge was stopped by its port. The one spill directory the run left (64 files, 237 MB, the merkle plan's) was removed.

**Result.** 247,222,272 B prepared as `wave_batch` with 63 records. 247,222,273 B prepared as `merkle` with 64 records. The cap moves to `59 * 4190208` in `surfaces/bdata.js`, `tools/antd-bridge/intake-server.mjs` (and so its `/health` `intake.max_bytes`), `tools/antd-bridge/INTAKE.md` and `e2e/bdata-phase-e.mjs`. No user-facing string changed: the too-large prose is the same sentence, and its byte figure is computed from the cap.

## Command and output

```
bash quote-boundary.sh > quote-boundary.out 2>&1; echo EXIT=$?
```

```
== binary: a07656ec6ddfaf342a620346713760e9b7b2a18b2fd2b67f31e7384c285779b1  <!-- PUBLIC-CONSTANT: sha256 of the scratch bridge binary -->
== spill before:
0
-rw-r--r-- 1 travi 197610 247222272 Oct  5 10:59 q59.bin
-rw-r--r-- 1 travi 197610 247222273 Oct  5 10:59 q60.bin
== bridge log:
connecting to Autonomi with 7 bootstrap peers (keyless)...
connected — keyless client ready
payment-plan persistence at C:/Users/travi/AppData/Local/Temp/claude/C--Users-travi-beehive-nature--claude-worktrees-nostalgic-easley-e3fcb9/e0d0a46a-ef5d-4829-b189-d64033691e80/scratchpad/scratch-state (survives bridge death)
antd-bridge listening on http://127.0.0.1:8837 (keyless)
== prepare q59.bin (path, no audience field, quote only)
elapsed 97 s
HTTP 200
{
 "upload_id": "up-1791219679367",
 "artifact_bytes": 247222272,
 "total_chunks": 63,
 "already_stored": 0,
 "payment_type": "wave_batch",
 "payments": 63,
 "merkle_batches": null,
 "total_amount_atto": "5153973038085937500",
 "policy": {
  "audience": "public",
  "binding": "unspecified-default (Visibility::Public)"
 },
 "note": "real payment plan from the Autonomi network — no key was used; the plan is persisted and survives bridge death"
}
== abandon up-1791219679367
{"upload_id":"up-1791219679367","status":"abandoned"}
== prepare q60.bin (path, no audience field, quote only)
elapsed 116 s
HTTP 200
{
 "upload_id": "up-1791219798385",
 "artifact_bytes": 247222273,
 "total_chunks": 64,
 "already_stored": 0,
 "payment_type": "merkle",
 "payments": null,
 "merkle_batches": 1,
 "total_amount_atto": null,
 "policy": {
  "audience": "public",
  "binding": "unspecified-default (Visibility::Public)"
 },
 "note": "real payment plan from the Autonomi network — no key was used; the plan is persisted and survives bridge death"
}
== abandon up-1791219798385
unknown upload_id: up-1791219798385
== stopping only the listener on 8837
stopped
== spill after (new entries):
spill_1791219683_4275963626118472445
DONE
```

The outer `echo` printed `EXIT=0`.

The script, `quote-boundary.sh`:

```bash
#!/bin/bash
# Quote-only boundary probe: does a 60-chunk public file cross into merkle on the bridge's pinned ant-core (f095630)?
# Keyless bridge, scratch state, spare port 8837. No wallet, no key file, no finalize, nothing paid or stored.
set -euo pipefail
SP=/c/Users/travi/AppData/Local/Temp/claude/C--Users-travi-beehive-nature--claude-worktrees-nostalgic-easley-e3fcb9/e0d0a46a-ef5d-4829-b189-d64033691e80/scratchpad
SPW='C:/Users/travi/AppData/Local/Temp/claude/C--Users-travi-beehive-nature--claude-worktrees-nostalgic-easley-e3fcb9/e0d0a46a-ef5d-4829-b189-d64033691e80/scratchpad'
EXE=/c/Users/travi/antd-bridge-next/target/release/antd-bridge.exe
PORT=8837
cd "$SP"
if curl -s --max-time 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then echo "REFUSE: something already answers on $PORT"; exit 1; fi
echo "== binary: $(sha256sum "$EXE" | cut -d' ' -f1)"
echo "== spill before:"; ls /c/Users/travi/AppData/Roaming/ant/spill | sort > spill-before.txt; wc -l < spill-before.txt
head -c 247222272 /dev/urandom > q59.bin   # 59 x 4190208: the proposed cap
head -c 247222273 /dev/urandom > q60.bin   # one byte more: 60 data chunks
ls -l q59.bin q60.bin
mkdir -p scratch-state
ANTD_BRIDGE_STATE="$SPW/scratch-state" "$EXE" $PORT > bridge.log 2>&1 &
for i in $(seq 1 60); do sleep 3; H=$(curl -s --max-time 3 "http://127.0.0.1:$PORT/health" || true); [ -n "$H" ] && break; done
echo "== bridge log:"; cat bridge.log
[ -n "${H:-}" ] || { echo "REFUSE: bridge never answered"; exit 1; }
for n in 59 60; do
  echo "== prepare q$n.bin (path, no audience field, quote only)"
  T0=$(date +%s)
  curl -s --max-time 900 -X POST -H 'Content-Type: application/json' \
    -d "{\"path\":\"$SPW/q$n.bin\"}" -w '\nHTTP %{http_code}\n' "http://127.0.0.1:$PORT/v1/upload/prepare" > prep$n.json || true
  echo "elapsed $(( $(date +%s) - T0 )) s"
  tail -n 1 prep$n.json
  head -n -1 prep$n.json > prep$n.body.json
  node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const o={upload_id:j.upload_id,artifact_bytes:j.artifact_bytes,total_chunks:j.total_chunks,already_stored:j.already_stored,payment_type:j.payment_type,payments:j.payments?j.payments.length:null,merkle_batches:j.merkle_batches?j.merkle_batches.length:null,total_amount_atto:j.total_amount_atto??null,policy:j.policy??null,note:j.note};console.log(JSON.stringify(o,null,1));' prep$n.body.json || cat prep$n.body.json
  ID=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).upload_id||"")}catch{console.log("")}' prep$n.body.json)
  if [ -n "$ID" ]; then echo "== abandon $ID"; curl -s --max-time 30 -X POST -H 'Content-Type: application/json' -d "{\"upload_id\":\"$ID\"}" "http://127.0.0.1:$PORT/v1/upload/abandon"; echo; fi
done
echo "== stopping only the listener on $PORT"
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }" >/dev/null 2>&1 || true
sleep 2
curl -s --max-time 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && echo "WARN: still answering" || echo "stopped"
echo "== spill after (new entries):"; ls /c/Users/travi/AppData/Roaming/ant/spill | sort > spill-after.txt; comm -13 spill-before.txt spill-after.txt
echo DONE
```

## The edge after the change

```
node health-ceiling.mjs tools/antd-bridge/intake-server.mjs
```

```
MAX_BYTES 247222272 = 59 x 4190208: true
/health intake {"ready":true,"max_bytes":247222272,"local_only":true}
```

```
node --test tools/antd-bridge/intake-server.test.mjs 2>&1 | tail -n 9
```

```
✔ real intake persists independently hashed bytes, refuses bad requests, and survives restart (1453.0616ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1962.2535
```
