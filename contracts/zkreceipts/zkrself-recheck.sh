U=https://jungle4.greymass.com; A=zkrtst111111
cleos wallet unlock --name bnrzk --password "$(cat /tmp/nd/bnrzk.pw)" >/dev/null 2>&1 || true
P_DEAD=$(node -pe "require(process.env.HOME+\"/plonkport/calldata_dead.json\").proof_hex")
say(){ local act=$1; shift; cleos -u $U push action $A $act "$1" -p $A 2>&1 | grep -m1 -oE "executed transaction: [a-f0-9]+ +[0-9]+ bytes +[0-9]+ us|assertion failure with message: [^\"]*" | head -1; }
echo "verify@5 (mutated root, settled): $(say verify "[5,\"$P_DEAD\"]")"
echo "verify@6 (mutated kind, settled):  $(say verify "[6,\"$P_DEAD\"]")"
