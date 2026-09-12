#!/usr/bin/env bash
# Cloud Agent install — idempotent bootstrap for the Beehive Nature Reserve
# kernel. Mirrors what CI (.github/workflows/tests.yml) actually runs so a
# fresh agent lands on the same green as a push. No dev servers here (those
# live in `terminals`); this must terminate.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Local secret-scan + §7 identity hooks (one-time per clone; CI re-runs them).
git config core.hooksPath .githooks

# --- Rust: the kernel workspace + the out-of-tree bSAFE host workspace -------
# --locked keeps Cargo.lock authoritative; a drift here fails loudly instead of
# silently rewriting the lockfile.
cargo build --workspace --locked
cargo build --locked --manifest-path rust/bsafe-host/Cargo.toml

# --- Node tooling behind the static + browser CI gates ----------------------
( cd e2e && npm ci )
( cd key-build/bdid-key && npm ci )
( cd ops/voice-scribe && npm ci --ignore-scripts )

# Chromium for the Playwright suites (onboarding e2e, university-smoke, fleet).
# Pinned by e2e/package-lock.json; `install` fetches that exact browser build.
( cd e2e && npx playwright install --with-deps chromium )

echo "install.sh: complete"
