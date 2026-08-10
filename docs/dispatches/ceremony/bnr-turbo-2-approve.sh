#!/bin/sh
# =============================================================================
# BNR TURBO CEREMONY — COMMAND 2 of 2: create capped, expiring approvals
#                                       and print the receipt to paste back
# -----------------------------------------------------------------------------
# Runs after COMMAND 1 and after the $10 checkout completed. It:
#   1. checks the wallet exists (refuses if COMMAND 1 hasn't run),
#   2. prints the wallet balance (so you can see the $10 landed),
#   3. creates a CAPPED, EXPIRING credit-share approval to each of Seat 3's
#      disposable test addresses (the uploader signer + 2 claimant identities),
#   4. assembles a pipeline-ready receipt (approval_receipt.json) and prints it
#      between clear markers — copy that block back to the seats.
#
# The wallet SIGNS each approval locally; only the signed approval leaves the
# machine. The private key is never printed and never transmitted.
#
# Source-verified against turbo-sdk packages/turbo-sdk/src/cli/commands/
# shareCredits.ts + types.ts (CreditShareApproval: approvalDataItemId,
# approvedAddress, payingAddress, approvedWincAmount, expirationDate).
# `--value` is in CREDITS (internally shiftedBy(12) -> winc); `--expires-by-
# seconds` sets the expiry; the signing wallet is the PAYER.
# =============================================================================
set -eu

DIR="${BNR_TURBO_DIR:-$HOME/bnr-turbo}"
WALLET="$DIR/bnr-wallet.json"
TURBO="$DIR/node_modules/.bin/turbo"

# --- Seat 3 disposable test addresses (public; zero-value; the founder pays) --
UPLOADER="wmpqC4DnTEuYbZiyj7PAmKNub80REgQ1rwHj0R9__kA"
CLAIMANT1="K3p3rOMnCwSwbAtzMUboDDS5xl-wJ4FRwnsbtGrLglQ"
CLAIMANT2="oSRU71itit8RiVanB5ssWnSh9g7I-PenjX6QirM0hsw"

# --- approval parameters (TUNABLE) -------------------------------------------
CAP_CREDITS="0.001"   # per-approval spend ceiling, in Credits (1 Credit = 1e12
                      # winc). Small on purpose; the wallet's $10 is the hard cap.
                      # Raise only if a later test upload exceeds it.
EXPIRES_SECONDS="604800"   # 7 days. The approval auto-returns after this.

# ---- 0. preconditions -------------------------------------------------------
if [ ! -f "$WALLET" ]; then
  echo "REFUSING: no wallet at $WALLET — run COMMAND 1 first." >&2
  exit 1
fi
if [ ! -x "$TURBO" ]; then
  echo "REFUSING: Turbo CLI missing ($TURBO) — run COMMAND 1 first." >&2
  exit 1
fi
cd "$DIR"

# ---- 1. show balance (did the $10 land?) ------------------------------------
echo "Checking balance..."
BAL_OUT=$("$TURBO" balance --wallet-file "$WALLET" --token arweave 2>&1 || true)
printf '  %s\n' "$BAL_OUT"
echo "  (If this shows 0, the Stripe payment may not have settled yet — wait a"
echo "   few minutes and re-run. Creating approvals needs the credits present.)"
echo

# ---- 2. create one capped, expiring approval per address --------------------
approve() {  # $1 = label, $2 = recipient address
  echo "Creating approval -> $1 ($2), cap ${CAP_CREDITS} Credits, expires ${EXPIRES_SECONDS}s..." >&2
  OUT=$("$TURBO" share-credits \
        --wallet-file "$WALLET" \
        --token arweave \
        --address "$2" \
        --value "$CAP_CREDITS" \
        --expires-by-seconds "$EXPIRES_SECONDS" 2>&1 || true)
  # keep only the JSON object the CLI prints; the share-credits output is a single
  # (pretty-printed) JSON object, so flatten then extract it. 2>&1 above means a
  # failure's error text survives in $OUT for the WARNING below.
  printf '%s' "$OUT" | tr -d '\n' | grep -oE '\{.*\}' > "$DIR/_appr_$1.json" || true
  if [ ! -s "$DIR/_appr_$1.json" ]; then
    echo "  WARNING: no approval JSON captured for $1. Raw output:" >&2
    printf '  %s\n' "$OUT" >&2
  fi
}
approve uploader   "$UPLOADER"
approve claimant1  "$CLAIMANT1"
approve claimant2  "$CLAIMANT2"

# ---- 3. assemble the pipeline-ready receipt ---------------------------------
cat > "$DIR/_assemble.cjs" <<'NODE'
const fs = require('fs');
const dir = process.env.DIR;
const rd = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const up = rd(`${dir}/_appr_uploader.json`);
const c1 = rd(`${dir}/_appr_claimant1.json`);
const c2 = rd(`${dir}/_appr_claimant2.json`);

// EVERY expected approval must exist, each with a real approval id AND payer.
// A missing/failed approval is a HARD failure — never a receipt carrying a
// fabricated grant. (False-signal law: no signal may be prettier than the truth.
// A partial run that printed a "success" receipt would tell the pipeline a
// claimant is funded when no on-chain approval exists.)
const ok = (a) => a && a.approvalDataItemId && a.payingAddress;
const missing = [['uploader', up], ['claimant-1', c1], ['claimant-2', c2]]
  .filter(([, a]) => !ok(a)).map(([n]) => n);
if (missing.length) {
  console.error('REFUSING to write a receipt — these approvals were NOT created: ' + missing.join(', '));
  console.error('Re-run after the $10 has settled; the WARNING lines above carry the CLI error.');
  process.exit(1);
}
// delegate = the payer of THIS grant's OWN approval (not a borrowed global value).
const grant = (name, claimant, appr) => ({
  name, claimant,
  delegate: appr.payingAddress,
  approval_id: appr.approvalDataItemId,
  cap_winc: appr.approvedWincAmount,
  expires: appr.expirationDate || '',
});
const receipt = {
  uploader: process.env.UPLOADER,
  payer: up.payingAddress,
  grants: [
    grant('test-a.b', process.env.CLAIMANT1, c1),
    grant('test-b.b', process.env.CLAIMANT2, c2),
  ],
  uploader_approval: {
    approval_id: up.approvalDataItemId, cap_winc: up.approvedWincAmount, expires: up.expirationDate || '',
  },
  raw_approvals: [up, c1, c2],
};
fs.writeFileSync(`${dir}/approval_receipt.json`, JSON.stringify(receipt, null, 2));
process.stdout.write(JSON.stringify(receipt, null, 2));
NODE
RECEIPT=$(DIR="$DIR" UPLOADER="$UPLOADER" CLAIMANT1="$CLAIMANT1" CLAIMANT2="$CLAIMANT2" node "$DIR/_assemble.cjs")
rm -f "$DIR/_assemble.cjs" "$DIR/_appr_uploader.json" "$DIR/_appr_claimant1.json" "$DIR/_appr_claimant2.json"

echo
echo "================= BNR TURBO CEREMONY RECEIPT — paste this back ================="
printf '%s\n' "$RECEIPT"
echo "==============================================================================="
echo "  (also saved to $DIR/approval_receipt.json)"
echo "  The wallet keyfile is NOT in this receipt and must never be shared."
