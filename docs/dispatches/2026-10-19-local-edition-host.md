# local working edition: the native local-reader host (2026-10-19)

zCode seat. The first of the three named follow-ons from the #467 landing:
**connect the reader to the local evidence store.** Delivered as a narrowly
scoped local reader host — the delivery dispatch's sanctioned lighter shape
("native IPC **or a narrowly scoped local reader**"). The Rust-scale items
(bounded store iteration, streaming archive writer) remain with their crates
and are untouched here.

## What landed

`tools/genealogy/serve-local.mjs` — a loopback host for a prepared
`skaists.preservation-local/1` package:

- **Startup verification, fail-closed.** Every file the package manifest
  declares is re-hashed from actual bytes (size + sha256 + manifestSha256
  chain) before the first request; any mismatch refuses to serve the whole
  edition. The real 363,300,913-byte / 23,276-file edition verifies in
  ~18–36 s warm (measured across three runs).
- **The manifest is the whitelist.** Only declared paths serve; traversal,
  undeclared files, malformed percent-escapes and non-GET/HEAD all refused;
  no directory listing. GET/HEAD stream with fixed 1 MiB buffers.
- **Loopback only.** Non-loopback Host headers are refused (no DNS
  rebinding onto the shelf). `GET /health` reports schema, file count and
  total bytes.
- The prepared package is already the app: `prepare-local` stamps its
  `blood.html` with the reader base, so the package's own page + evidence
  are same-origin by construction. No page changes were needed.

`node tools/genealogy/serve-local.mjs <package-dir> [port]` (default 8790,
chosen clear of the estate's 8765/8807/8812/8817/8842/8891+ registry).

## Verification

- **Unit: 8/8** (`tools/genealogy/serve-local.test.mjs` — startup
  verification, tamper refusal (same-length byte flip caught by digest),
  foreign-schema and bad-manifest refusal, exact bytes/type/length, 404
  classes incl. `%c0%af`, HEAD, 405, raw-socket evil-Host refusal, health).
  CI picks the suite up automatically via the existing
  `tools/genealogy/*.test.mjs` glob.
- **Hermetic browser E2E: 9/9 on real Chromium**
  (`e2e/local-evidence-host.mjs`, wired into tests.yml beside bdata-phase-e;
  YAML re-parsed post-edit per the tests.yml law). Serves a synthetic
  package (real reader module) and proves in-browser: shard reads from the
  served bytes, transcription renders, the conflict stays recorded, the
  citation stays inert, the image opens only after digest verification,
  every request stays inside the package, escapes 404.
- **Real-edition acceptance on this box — PASS**
  (`evidence/2026-10-19-local-edition-host-acceptance.json`): the actual
  private 363 MB edition served whole; the app's own gestures (orbit →
  story → parent link → hop node) walked to Zilphia Ann Williams' person
  view; her "Evidence on this device" section listed 6 retained sources;
  the 192,963-byte 1885 Nebraska census page verified against its digest
  and opened from a blob URL, loaded with natural pixels, zero page
  errors, zero requests leaving loopback.

## Not claimed

- The other two named follow-ons (bounded `EmbeddedStore` iteration,
  streaming `bnr-archive` writer) are unchanged — separate crates, own
  lanes.
- No Autonomi replication, no wallet, no spend, no FamilySearch requests;
  the automation stop and ANT publication holds stand.
- The 56 s cold first-hash of the full edition is measured, not hidden; a
  lazy-verify variant can come later if the start time matters.

NEXT OWNER: authorized merger (this PR); the store/archive scale items keep
their existing owners.
