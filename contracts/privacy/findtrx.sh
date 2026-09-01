#!/bin/bash
# findtrx.sh <trx_prefix> [window] — locate a trx in recent blocks, print billed cpu
U=http://127.0.0.1:8888
TID=$1; WIN=${2:-60}
HEAD=$(curl -sS -m 5 -X POST $U/v1/chain/get_info -d '{}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).head_block_num' 2>/dev/null)
B=$HEAD; N=0; FOUND=0
while [ $N -lt $WIN ] && [ $FOUND -eq 0 ]; do
  OUT=$(curl -sS -m 5 -X POST $U/v1/chain/get_block -d "{\"block_num_or_id\":$B}" | TID=$TID node -e '
    let d = "";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const b = JSON.parse(d);
        for (const t of (b.transactions || [])) {
          const id = typeof t.trx === "string" ? t.trx : (t.trx && t.trx.id) || "";
          const rec = t.receipt || (typeof t.trx === "object" && t.trx.receipt);
          if (id.startsWith(process.env.TID)) {
            console.log("FOUND blk " + b.block_num + " · billed " + (rec ? rec.cpu_usage_us : "?") + " us · " + (rec ? rec.status : "?"));
          }
        }
      } catch (e) {}
    });')
  [ -n "$OUT" ] && { echo "$OUT"; FOUND=1; }
  B=$((B-1)); N=$((N+1))
done
[ $FOUND -eq 0 ] && echo "NOT FOUND in $WIN blocks"
