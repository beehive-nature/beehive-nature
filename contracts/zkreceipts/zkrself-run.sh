U=https://jungle4.greymass.com; A=zkrtst111111; W=~/plonkport
cleos wallet unlock --name bnrzk --password "$(cat /tmp/nd/bnrzk.pw)" >/dev/null 2>&1 || true
say(){ local act=$1; shift; cleos -u $U push action $A $act "$1" -p $A 2>&1 | grep -m1 -oE "executed transaction: [a-f0-9]+ +[0-9]+ bytes +[0-9]+ us|assertion failure with message: [^\"]*" | head -1; }
ROOT=$(node -pe "JSON.parse(require(\"fs\").readFileSync(process.env.HOME+\"/plonkport/expected.json\")).root.replace(/^0x/,\"\")")
ROOTFLIP=$(node -pe "const r=process.argv[1].split(\"\"); const c=r[63]; r[63]= c===\"f\"?\"0\":(parseInt(c,16)+1).toString(16); r.join(\"\")" "$ROOT")
P_DEAD=$(node -pe "require(process.env.HOME+\"/plonkport/calldata_dead.json\").proof_hex")
P_LIVE=$(node -pe "require(process.env.HOME+\"/plonkport/calldata_live.json\").proof_hex")
P_FORG=$(node -pe "require(process.env.HOME+\"/plonkport/calldata_forged.json\").proof_hex")
echo "[3] anchor1 dead: $(say anchor "[1,\"$ROOT\",0,20]")"
echo "[4] VERIFY dead REAL: $(say verify "[1,\"$P_DEAD\"]")"
echo "[5] anchor2 live: $(say anchor "[2,\"$ROOT\",1,20]")"
echo "[6] VERIFY live REAL: $(say verify "[2,\"$P_LIVE\"]")"
echo "[7] refusals:"
echo "  anchor3: $(say anchor "[3,\"$ROOT\",0,20]")"
echo "  forged proof @3: $(say verify "[3,\"$P_FORG\"]")"
echo "  anchor4 count21: $(say anchor "[4,\"$ROOT\",0,21]")"
echo "  real vs count21 @4: $(say verify "[4,\"$P_DEAD\"]")"
echo "  anchor5 rootflip: $(say anchor "[5,\"$ROOTFLIP\",0,20]")"
echo "  real vs rootflip @5: $(say verify "[5,\"$P_DEAD\"]")"
echo "  anchor6 kind1: $(say anchor "[6,\"$ROOT\",1,20]")"
echo "  real dead vs kind1 @6: $(say verify "[6,\"$P_DEAD\"]")"
echo "  re-verify @1: $(say verify "[1,\"$P_DEAD\"]")"
echo "  bad kind anchor: $(say anchor "[7,\"$ROOT\",2,20]")"
echo "[8] table:"
cleos -u $U get table $A $A anchors 2>/dev/null | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const rows=JSON.parse(s).rows;for(const r of rows){const hex=typeof r.root===\"string\"?r.root.replace(/^0x/,\"\"):Buffer.from(r.root).toString(\"hex\");console.log(\"  seq\",r.seq,\"kind\",r.kind,\"count\",r.count,\"root\",hex.slice(0,16)+\"…\",\"verified_at\",r.verified_at)}})"
