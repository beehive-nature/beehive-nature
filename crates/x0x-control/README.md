# x0x-control — box-control agent (build now, deploy later)

The agent that retires SSH on estate boxes. It receives scoped command
orders as ML-KEM-768 sealed envelopes, verifies state before and after
each change, executes without a shell, and returns full verbatim
receipts. Built on the laptop; **deployment to buzz-hostinger waits on
the founder's route ruling (x0x bootstrap vs one last SSH)**. Nothing in
this crate deploys itself.

## Design

- **Transport**: an order is a JSON document sealed to the box agent's
  ML-KEM-768 encapsulation key (`crates/bsigner/src/pq.rs`, RustCrypto
  ml-kem 0.3 — borrowed, never reimplemented). Envelope encryption is
  the standard hybrid: KEM shared secret → HKDF-SHA-256 → AES-256-GCM,
  order id as associated data. On the box, envelopes ride the x0x
  daemon's messaging (`ops/x0x`, x0xd loopback API `127.0.0.1:12700`);
  on the laptop they move as files for build/test. No TLS assumptions.
- **Scoped orders**: every order names a scope. The on-box policy
  (JSON, default deny) maps scopes to exact `argv[0]` rules with
  argument caps/prefixes. Unknown scope, expired order, or replayed
  nonce refuses before anything runs. Execution is argv-direct —
  there is no shell anywhere in the path.
- **State verification**: orders carry pre/post probes (argv + expected
  exit + optional stdout substring). Pre-probes gate execution;
  post-probes gate the `Completed` verdict. Probe stdout is hashed
  (SHA3-256) into the receipt so before/after state compares
  byte-for-byte.
- **Receipts**: full verbatim stdout/stderr/exit for probes and the
  command, the KEM ciphertext fingerprint, verdict, and timestamp.
  Optional signing shells to the frozen `bsigner` CLI
  (`sign --key-id --file --rec-env --keydir --out`); the recovery
  secret is referenced by env-var name only and never enters this
  process.
- **Keys**: the agent's KEM seed is a 64-byte file held on the box
  (laptop: local file from `keygen`). No key material is ever printed.

## CLI

```
x0x-control keygen --seed-out FILE --pub-out FILE
x0x-control send --pub FILE --order FILE --out FILE
x0x-control serve-once --seed FILE --policy FILE --ledger FILE --in FILE --out FILE
            [--bsigner PATH --sign-key-id ID --sign-keydir DIR --rec-env VAR]
x0x-control selftest
```

Exit codes: 0 completed, 1 local error, 2 refused (scope/expiry/replay),
3 state-probe failure.

## Deployment sketch (not executed)

1. Founder rules the route. 2. The binary + policy + seed land on the
box by that route; a systemd unit mirrors `ops/x0x/x0x.service`
hardening (dedicated user, `ProtectSystem=strict`, memory caps).
3. x0xd stays loopback-only; `/etc/x0x/exec-acl.toml` stays absent —
this agent replaces remote exec, it does not enable x0xd's.
4. First live orders are read-only probes; the door-lane fix order is
the first mutating scope, granted explicitly.

## Honest bounds

- Sound by construction at the seams it owns (scope check before exec
  AND before probes, probes before/after, replay ledger); the
  KEM/AEAD primitives are the cited upstream implementations, not
  estate-audited.
- **Threat model (sender authentication):** sealing an order needs
  only the agent's PUBLIC encapsulation key — anyone can seal.
  Confidentiality and integrity-to-the-agent are provided;
  sender authentication is NOT. The scope policy is therefore the
  whole authorization boundary: every scope in a production policy
  must be safe against arbitrary senders, or the transport must
  authenticate senders (x0xd's ML-DSA peer identity, once the
  channel bridge lands). A bsigner sender-signature check (order
  carries an ML-DSA envelope over the canonical order JSON, verified
  against a policy-pinned sender key id before opening) is the
  designed follow-up; it is not implemented in this version.
- The nonce ledger is a local append-only file. `serve-once`
  appends + fsyncs the nonce BEFORE executing (write-ahead) and
  holds an exclusive ledger lock for the whole serve
  (single-flight per ledger); a second concurrent serve against
  the same ledger is refused, never raced. Cross-host replay is
  out of scope: one agent, one ledger.
- Policy authors: `arg_prefixes` match by string prefix — terminate
  a path prefix with `/` (write `/etc/nixos/`, not `/etc/nixos`)
  or a sibling like `/etc/nixos-evil` also matches.
