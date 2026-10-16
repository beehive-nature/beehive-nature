# 2026-10-16 · SOVEXEC-004 — the SSE push surface over a sealed BNROSE index: GET and events only, keyless, bounded, read-only by the engine

Seat: Claude Code (Fable 5.1), the SOVEXEC-001 session continued. Order: the founder, 2026-10-16, after the sublane card failed to start ("Run the b-index SSE push surface lane in this session now, with the same brief as its card"). Branch `claude-LoVis/sovexec-004-bindex-sse`, stacked on PR #449 (`878424b86`, the crate it extends); nothing of #450.

## 0 · What this is

SPEC-BINDEXER-0 §5 owes "SSE push surface (static-friendly) before any websocket envelope". SOVEXEC-003 built the keyless read path over a BNRoSe state directory as a sealed SQLite file with a library API and a CLI; this lane adds the serving mode so a browser or a peer can read the sealed file over plain HTTP GET and follow its changes as Server-Sent Events without polling, without a framework, without cookies, without a socket upgrade, without key material. `bindexer`'s own hand-rolled `std::net` server is the pattern (GET only, one 405 for everything else, no POST handler to abuse because there is no POST handler); this one adds what a long-lived stream needs: a thread per connection, a connection bound, a cursor over the durable tables, and a SQLite connection the engine itself will not let write.

## 1 · The surface (`crates/bindex-bnrose/src/serve.rs`; CLI `bindex-bnrose serve --db FILE --addr HOST:PORT [--max-connections N] [--replay-cap N] [--poll-ms N] [--cors]`)

| route | answer |
|---|---|
| `GET /` | the route list, `keyless: true`, `sendtx: NO: permanently` |
| `GET /status` | exactly `query::status` plus one top-level `serve` object: `maxConnections`, `activeConnections`, `acceptedRequests`, `refusedOverBound`, `replayCap`, `pollMs`, `keepaliveSecs`, `cors`, `eventsSent`, `startedAtUnix`, and the sentence naming the backlog |
| `GET /entity/{hex}`, `/authority/{hex}?after=&limit=`, `/steps/{hex}` | exactly the `query` module's JSON, coverage and freshness marks untouched (the test compares byte-for-byte against the library call) |
| `GET /events?since=i0-d0` (or the `Last-Event-ID` header) | `text/event-stream`: a `hello` (cursor, coveredThroughSeq, indexHead, readAtUnix, replayCap), then one `ingest` event per row of `ingests` and one `divergence` event per row of `divergences` past the cursor, merged by time; then live, polled every `pollMs`; a `: keepalive` comment every `keepaliveSecs` while idle |
| any non-GET | `405 Method Not Allowed`, `Allow: GET`, `{"refusal": "method:not-allowed"}` |
| unknown route | `404` with the route list; a malformed hex `400` with `refusal: request` |
| one connection over the bound | `503`, `Retry-After: 1`, `{"refusal": "serve:connections-exhausted"}`, counted and confessed in `/status` |

**The cursor** is `i<ingest id>-d<divergence id>`: everything up to and including those ids has been seen. The two tables of the sealed file ARE the backlog, durable; a replay sends at most `replayCap` rows per table per batch and says so with a `truncated` event carrying the cursor, then keeps delivering in later batches, so a client that fell far behind catches up in bounded steps and never silently loses rows. `?since=` exists because an `EventSource` cannot set headers; the header is honored for everything else.

**No write path, by the engine.** Every connection thread opens its own SQLite connection with `PRAGMA query_only = 1`; the engine refuses every write on it (`attempt to write a readonly database`), so the serving process cannot write the index even by a defect in this crate. The index is written by `ingest` on the custody side, in another process, through WAL, which the readers follow.

**Bounds.** `max_connections` (default 64) is counted before any work and released on every exit path (a drop guard); a departed client is noticed while idle through a 1 ms probe read, not only at the next write, so a held slot returns within one poll. `replay_cap` (default 1000) bounds every batch. Both are confessed in `/status`.

**CORS** only with the explicit flag (`Access-Control-Allow-Origin: *`); the default sends nothing.

**Keyless, extended.** `tests/keyless.rs` scans every source file including the new one and now also forbids the static-friendly law's vocabulary: `Set-Cookie`, `websocket`, `tungstenite`, `hyper::`, `actix`. The manifest gains no dependency.

## 2 · The acceptance rows (`tests/serve.rs`; a real state directory from the supervisor, a sealed index, the server on a loopback port, raw HTTP over `TcpStream`, no client crate)

| row | claim | how it can lose |
|---|---|---|
| `get_answers_are_exactly_the_query_json_and_status_confesses_the_server` | `/status` minus `serve` equals `query::status`; `/entity`, `/authority`, `/steps` equal the library answers byte for byte; `/` and the 404 and 400 shapes | any answer altered |
| `non_get_is_405_by_construction_and_a_planted_write_is_refused_by_name` | POST, PUT, DELETE, PATCH on five routes (including a planted `POST /ingest`) are 405 with `Allow: GET` and `method:not-allowed`; the engine refuses an INSERT on the connection the server uses | a write lands |
| `events_replay_then_follow_a_live_ingest_and_a_divergence` | the replay from the origin; an ingest performed WHILE subscribed arrives as an `ingest` event with the new `coveredThroughSeq`; a replica rewritten under the subscription yields the `divergence` event and the `refused:diverge` ingest event with the cursor covering both tables; resuming with `Last-Event-ID` yields only what is past it | a lost or duplicated event |
| `connections_are_bounded_and_the_refusal_is_confessed_in_status` | with the bound at 1 a held stream makes the next request 503; closing it returns the slot and `refusedOverBound` counts | an unbounded or unreleased slot |
| `a_replay_is_capped_per_batch_and_says_so_then_continues` | with the cap at 1 and three ingests: event, `truncated`, event, `truncated`, event | a silent cut |
| `cors_header_appears_only_with_the_flag` | no header by default; the header and `serve.cors = true` with the flag | CORS by default |

## 3 · Receipts

`cargo test -p bindex-bnrose --locked --no-fail-fast` in WSL (rustc 1.98.1), 2026-10-16, after `cargo fmt`:

```
     Running tests/acceptance.rs
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.32s
     Running tests/keyless.rs
test the_manifest_pulls_no_mac_or_signing_crate_directly ... ok
test no_root_key_mac_or_signing_vocabulary_in_this_crate ... ok
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s
     Running tests/serve.rs
test non_get_is_405_by_construction_and_a_planted_write_is_refused_by_name ... ok
test cors_header_appears_only_with_the_flag ... ok
test a_replay_is_capped_per_batch_and_says_so_then_continues ... ok
test get_answers_are_exactly_the_query_json_and_status_confesses_the_server ... ok
test connections_are_bounded_and_the_refusal_is_confessed_in_status ... ok
test events_replay_then_follow_a_live_ingest_and_a_divergence ... ok
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.44s
```

`cargo fmt --all --check` clean; clippy clean for this crate; `Cargo.lock` unchanged (no new dependency).

Three convictions of this seat during the build, kept as facts: the keyless scan convicted the serve module's own doc comment for naming the forbidden word (reworded, the scan kept); the first status-equality row left a null `serve` key behind and failed on it (the test now removes the key); and a held stream was not released when its client went away until the next write, fifteen seconds later by the default keepalive (the server now probes the socket while idle and the row holds at one second).

## 4 · Boundaries not crossed, and what is not claimed

- No websocket, no authentication, no TLS (a reverse proxy's job), no multi-supervisor federation, no change to `bindexer`'s own routes or to `bnrose-exec-*`.
- The stream follows ONE sealed file; a client that needs another index opens another stream.
- Polling the file every `pollMs` is the liveness mechanism; sub-poll latency is not claimed.
- `/status`'s `serve` object is the one addition to a query answer, and it is additive: the query's own JSON is byte-identical underneath, which the first row proves.
- Served HTTP/1.1 with `Connection: close` for JSON and a close-delimited body for the stream; HTTP/2, compression and range requests are not provided.

## 5 · Next owner

HUMAN INTERACTION: NONE for landing. The stack lands #448 → #449 → this on CI's verdict (#450 beside it on #448). Next beats: a `bindexer` route-table entry so the chain read path and this execution read path share one `status` vocabulary; a static page under `surfaces/` that subscribes with `EventSource` (the registration ritual applies there); federation of two supervisors' receipts under the two-oracle law.
