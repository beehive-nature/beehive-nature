# ADR 0001 — Emit Vega-Lite specs as a serde struct, not via a bindings dependency

**Status:** Accepted — ruled in RELAY_21 §4 (2026-07-19). First record in
`docs/adr/`; this file also establishes the ADR convention (context → decision
→ consequences, one decision per file, numbered, append-only).

## Context

Charting for the DAO dashboard needed a renderer. The dashboard is a **web
surface** (RELAY_21 §1: skaists.social is a pure web / PWA build, and the same
web UI renders inside the Tauri desktop shell), which settles a fork left open
by an earlier evaluation of the Rust Vega-Lite bindings:

- **Vega-Lite renders in the browser natively** — no JS-runtime-embedding
  problem, BSD-3 licensed, v6.4.3 active.
- **The Rust bindings are the wrong tool here.** They track upstream at v3/v4
  against a v6 spec, and all they ultimately do is *emit a spec*. Taking them as
  a dependency buys a stale, partial API for something that is, at bottom, JSON
  serialisation.

## Decision

**Emit the Vega-Lite spec JSON directly from Rust as a `serde` struct — do not
take a Vega-Lite bindings crate as a dependency.** A chart spec is a serde
struct we own and serialise; the browser (or the Tauri webview) renders it with
the upstream Vega-Lite runtime.

## Consequences

- **The spec-as-hashable-artifact property comes free.** A chart is then a
  deterministic, serialisable value with a digest — the same artifact-integrity
  property the rest of the tree relies on, at no extra cost.
- **One implementation across web, PWA, and desktop.** The same web UI renders
  inside Tauri, so the node/farming desktop app gets the same charts with no
  second renderer.
- **No stale-binding drift.** We are not pinned to a bindings crate lagging the
  upstream spec version; we serialise against the spec we target.
- **Boundary that still binds (RELAY_21 §5):** the D-14 obligations — two
  gauges, honest staleness, no ambient b↔fiat rate — must be enforced in the
  **shared layer (`denomination`)**, not re-implemented per renderer, or the web
  and libcosmic surfaces will drift. A chart spec emitted from Rust does not get
  to bypass that layer. *Negative control: a renderer that can display a gauge
  without going through `denomination::Hud` → fail.*
