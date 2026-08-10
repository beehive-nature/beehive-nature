#!/bin/sh
# =============================================================================
# BNR TURBO CEREMONY — COMMAND 1 of 2: generate wallet + get the $10 top-up link
# -----------------------------------------------------------------------------
# Runs entirely on YOUR machine. It:
#   1. checks node/npm are present (refuses loudly if not),
#   2. installs the Turbo CLI + arweave-js locally in ~/bnr-turbo,
#   3. GENERATES a native Arweave wallet (JWK) on YOUR disk, mode 600,
#      prints ONLY its public address — never the key, never sent anywhere,
#   4. prints a Stripe checkout link to top the address up with $10 by card
#      (no wallet login — the web path that failed is not used).
#
# WHAT YOU DO: run the one line, copy the checkout URL it prints into your
# browser, pay $10. Then run COMMAND 2.
#
# THE WALLET FILE IS THE MONEY. Never share bnr-wallet.json, never paste its
# contents to anyone (including any AI seat). Back it up offline. Losing it
# loses the $10; leaking it lets anyone spend it.
#
# Source-verified against turbo-sdk @ github ardriveapp/turbo-sdk
#   packages/turbo-sdk/src/cli/{cli.ts,options.ts,commands/topUp.ts}
# top-up with --address uses TurboFactory.unauthenticated + createCheckoutSession
# (no login) and prints {url,...} to stdout.
# =============================================================================
set -eu

DIR="${BNR_TURBO_DIR:-$HOME/bnr-turbo}"
WALLET="$DIR/bnr-wallet.json"
VALUE="10"          # USD to top up. The ruling: $10 cap. (If the card minimum
                    # is higher, this is the one number to change.)

# ---- 0. preconditions: refuse loudly rather than half-run --------------------
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "REFUSING: node (>=18) and npm are required and were not found." >&2
  echo "  Install Node.js LTS from https://nodejs.org then re-run this line." >&2
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "REFUSING: node $NODE_MAJOR found; Turbo CLI needs node >= 18." >&2
  exit 1
fi

# ---- 1. never clobber an existing (possibly funded) wallet -------------------
mkdir -p "$DIR"; chmod 700 "$DIR"
if [ -f "$WALLET" ]; then
  echo "REFUSING: a wallet already exists at $WALLET" >&2
  echo "  This script will not overwrite it (it may already hold your \$10)." >&2
  echo "  If you truly want a fresh one, move the old file aside yourself first." >&2
  exit 1
fi

# ---- 2. install the Turbo CLI + arweave-js locally --------------------------
echo "Installing Turbo CLI + arweave-js in $DIR (one-time, ~a minute)..."
cd "$DIR"
[ -f package.json ] || npm init -y >/dev/null 2>&1
npm install --no-fund --no-audit @ardrive/turbo-sdk arweave >/dev/null 2>&1
TURBO="$DIR/node_modules/.bin/turbo"
if [ ! -x "$TURBO" ]; then
  echo "REFUSING: Turbo CLI did not install (missing $TURBO)." >&2
  echo "  Re-run; if it persists, check your network / npm registry access." >&2
  exit 1
fi

# ---- 3. generate the native Arweave JWK LOCALLY -----------------------------
# arweave-js wallets.generate() -> RSA-4096 JWK. Written to disk (mode 600),
# address printed. The private key is NEVER printed and NEVER transmitted.
cat > "$DIR/_genwallet.cjs" <<'NODE'
const fs = require('fs');
const Arweave = require('arweave');
const ar = Arweave.init({});
(async () => {
  const jwk = await ar.wallets.generate();
  const out = process.env.WALLET_PATH;
  fs.writeFileSync(out, JSON.stringify(jwk), { mode: 0o600 });
  fs.chmodSync(out, 0o600);
  const addr = await ar.wallets.jwkToAddress(jwk);
  process.stdout.write(addr);   // ONLY the public address leaves this process
})().catch((e) => { console.error('keygen failed:', e.message); process.exit(1); });
NODE
ADDR=$(WALLET_PATH="$WALLET" node "$DIR/_genwallet.cjs")
rm -f "$DIR/_genwallet.cjs"
if [ -z "$ADDR" ] || [ ! -f "$WALLET" ]; then
  echo "REFUSING: wallet generation did not produce an address/file." >&2
  exit 1
fi
chmod 600 "$WALLET"

echo
echo "================================================================"
echo "  WALLET CREATED (native Arweave JWK, your custody)"
echo "  file    : $WALLET   (mode 600 — THIS FILE IS THE MONEY)"
echo "  address : $ADDR"
echo "  BACK IT UP: copy $WALLET somewhere offline and safe."
echo "  NEVER share it or paste its contents to anyone or any AI."
echo "================================================================"
echo

# ---- 4. create the $10 fiat top-up checkout link ----------------------------
# `turbo top-up --address ...` needs NO wallet login; it prints {url,...}.
# On Linux/WSL the CLI's browser auto-open can error AFTER printing the URL,
# so we capture stdout and extract the URL ourselves (exit code tolerated).
echo "Creating the \$${VALUE} card top-up checkout link..."
# 2>&1: keep stderr so a genuine failure (card minimum, network, auth) is shown
# on the refusal path below. The known Linux/WSL open() ReferenceError carries no
# https URL, so the grep still isolates the checkout link (printed before it).
TOPUP_OUT=$("$TURBO" top-up --address "$ADDR" --token arweave --currency usd --value "$VALUE" 2>&1 || true)
URL=$(printf '%s' "$TOPUP_OUT" | grep -oE 'https://[^"]*' | head -n1)

if [ -z "$URL" ]; then
  echo "Could not extract a checkout URL. Raw Turbo output was:" >&2
  printf '%s\n' "$TOPUP_OUT" >&2
  echo "(If this shows a card-minimum error, tell the seats — the minimum may be above \$${VALUE}.)" >&2
  exit 1
fi

echo
echo "================================================================"
echo "  PAY \$${VALUE} BY CARD — open this link in your browser:"
echo
echo "  $URL"
echo
echo "  No wallet login. Stripe checkout. When it completes, the \$${VALUE}"
echo "  of Turbo Credits lands on the address above."
echo "  THEN run COMMAND 2 to create the approvals."
echo "================================================================"
