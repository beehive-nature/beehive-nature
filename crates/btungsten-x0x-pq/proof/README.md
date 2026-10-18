# Prepared public-key wrapper equivalence

This lane concerns the acceptance decision made by
`PreparedMlDsa65PublicKey::{from_bytes,verify}` at `a4296c847`, against
**fips204 0.4.6** and both **saorsa-pqc 0.5.1** APIs. The candidate source is
included directly by Rust's `#[path]`; the stock methods come from the locked
registry packages. There is no copied implementation of their verifier.

The controller, source and lock gates, MIR symbol discovery, native cases,
coverage checks, and sabotage controls are Rust. SAW/Cryptol provide the
symbolic contracts and solver interface. No new Python controller is used.

The [executed dispatch](../../../docs/dispatches/2026-10-14-btungsten-pq-prepare-proof.md)
records the 36 conditional obligations, seven formal controls, and separate
4245-check native run, with [retained receipts](../../../docs/receipts/pq-prepare-2026-10-14).

```sh
cargo run --locked --release \
  --manifest-path crates/btungsten-x0x-pq/proof/Cargo.toml -- \
  run target/pq-prepare saw
```

Use the existing PQ SAW toolchain: SAW **1.6**, mir-json at **8cbf9af1**,
**nightly-2026-03-21**, and its translated standard libraries. Put SAW's bundled
solvers and mir-json tools on `PATH`, and set `SAW_RUST_LIBRARY_PATH` to the
translated `rlibs` directory. The controller builds a fresh linked MIR with the
pinned nightly and checks that the build did not alter the lock. It requires
the locked dependencies to have been fetched before its offline checks.

## The claim and its boundary

Define acceptance of a stock raw-byte call as **all imports succeed and
verification returns `Ok(true)`**. An import error, verification error, and
`Ok(false)` all reject. This does not identify their error types or messages:
modern Saorsa returns `Err(ContextTooLong)` above 255 context bytes, while the
candidate returns `false`. The modern API is instantiated as ML-DSA-65; other
variants and deliberately mismatched variant objects are outside this domain.
The legacy comparison has **empty context only**, as its actual API requires.

Let `E(p)` be the result of the pinned `ml_dsa::expand_public` on encoded public
key `p`. Let `V(e,m,s,c)` be the pinned `ml_dsa::verify_internal` at the exact
ML-DSA-65 parameters, with empty OID/prehash and `nist=false`. No cryptographic
correctness property is assigned to either function. For a successfully
expanded, 1952-byte key, the shared acceptance expression is:

```text
false                                 if |s| != 3309 or |c| > 255
V(E(p), complete m, complete s, complete c) otherwise
```

The source-level relational argument is:

1. Candidate `from_bytes` checks the exact key length, calls FIPS
   `PublicKey::try_from_bytes`, and owns the returned key. That FIPS method
   forwards to `ml_dsa::expand_public`.
2. Modern Saorsa's `MlDsaPublicKey::from_bytes` validates the same bytes using
   the same FIPS method and retains a byte copy. Its `MlDsa::verify_with_context`
   reconstructs the same expanded key, checks the context, copies exactly 3309
   signature bytes, and calls the same FIPS `Verifier::verify`.
3. Legacy `MlDsa65::verify` also reconstructs that key, copies exactly 3309
   signature bytes, and calls the same FIPS method with `b""`. Its public-key
   and signature imports enforce their fixed lengths.
4. Candidate `verify` borrows exactly 3309 signature bytes and calls that FIPS
   method with the original message and context. The FIPS method itself rejects
   contexts longer than 255 and forwards every remaining input to `V`.
5. FIPS `types::PublicKey` consists of owned arrays (`rho`, `tr`,
   `t1_d2_hat_mont`); the candidate field is private. Verification takes `&self`
   and has no mutable or interior-mutable public-key field. Retaining this
   value preserves `E(p)` for each subsequent call. Induction extends the
   one-call equality to a finite sequence of calls on that retained key.

This argument assumes deterministic, terminating expansion and verification,
unchanged key bytes/identity binding, valid Rust references, and successful
allocation where the stock wrapper allocates. It needs **no assumption that a
signature is valid or canonically encoded**: `V` may accept or reject any
3309-byte string. If expansion fails, all three raw-byte acceptance adapters
reject; the compiled contracts below cover the **successful expansion** case.

The general argument above is a **source-level conditional argument**. The
mechanized result below is **universal over byte contents at enumerated slice
lengths**. It is not an unbounded proof of all Rust slice lengths, FIPS key
decoder totality, ML-DSA arithmetic, cryptographic security, or compiler
correctness. A larger claim needs additional proof work.

## Compiled proof obligations

`common.saw` executes the linked MIR of the actual candidate, actual Saorsa
imports/verifiers, FIPS `try_from_bytes`, and FIPS `Verifier::verify`.
`Boundary.cry` gives names/types to opaque functions. The proof tactic keeps
**all four names uninterpreted**: `expandRho`, `expandTr`, `expandT`, `decision`.
Their placeholder bodies are not ML-DSA specifications and must not be unfolded.
Both accept-all and reject-all controls guard this distinction.

The only assumed cryptographic contracts are successful deterministic
`expand_public` and pure deterministic `verify_internal`. The latter contract
binds **every expanded-key field and every message, signature and context byte**;
its Boolean result is unconstrained. Exact scalar parameters, empty OID/prehash,
and `nist=false` must match the real call. Signature parsing and all arithmetic
inside that function are outside this proof.

The x86_64 `zeroize 1.9.0` comment-only inline-assembly optimization barriers
are modeled as having no runtime effect. Their source is pinned too. FIPS key
destructors and their writes still execute. The harness observes modern Saorsa's
decision before destruction of its caller-owned imported public objects, then
forgets those objects: their `Vec` erasure uses an unsupported MIR intrinsic.
This is confined to the test adapter, which holds only public data. Destruction,
zeroization effectiveness and allocator/resource-failure behavior are not claims.

The closed inventory in `src/obligations.rs` requires **36** obligations:

| Paths | Message / signature / context byte lengths | Obligations |
|---|---|---:|
| Prepared and modern | `(0,3309,0)`, `(1,3309,1)`, `(257,3309,255)`, `(4096,3309,254)` | 8 |
| Prepared and modern: context refusal | `(257,3309,256)`, `(1,3309,257)` | 4 |
| Prepared and modern: signature refusal | message 257, context 255; signature 0, 1, 3308, 3310, 4096 | 10 |
| Prepared and modern: key-length refusal | key 0, 1, 1951, 1953; other inputs empty | 8 |
| Legacy, context empty | `(0,3309)`, `(257,3309)`, `(257,0)`, `(257,3308)`, `(257,3310)` | 5 |
| One preparation, two independent operations | message/context `(1,1)` then `(257,255)`, independent signatures | 1 |

All bytes of each input are symbolic, including the entire key and signature.
Prepared and stock paths prove the same acceptance expression independently.
The reused-key proof checks both results on unrelated inputs, so a cached
verification result cannot satisfy the contract.

## Controls and evidence

Seven false compiled obligations must produce a **return-value counterexample**:
accept-all, reject-all, truncated message, discarded context, truncated
signature, replaced key, and cached verification result. A missing leaf contract,
translation error, missing solver, timeout, or unrelated nonzero exit does not
count. Mutated message/context shapes have their own legitimate leaf contracts,
so those controls must fail equality, not override applicability.
These formal counterexamples are countermodels of the opaque-core contracts,
not claimed FIPS-valid signatures; the native controls supply concrete witnesses.

The separate native lane executes **4245** checks in **21** exact-count rows:
valid/modified inputs, every short signature length, every legal context length,
255/256 boundaries, malformed hint counts/order/padding, out-of-range responses,
replaced keys, owned-key retention, and purpose-built ignored-input witnesses.
Both actual Saorsa APIs run where their domains overlap. These are native
DIFFERENTIAL/TEETH results, not official KAT or universal proof results.
Five defective native verifiers must fail named rows; an empty run must report
all 21 missing rows. Controller tests also convict stale-looking success with a
nonzero exit, absent/duplicate/unexpected proof markers, unrelated control
errors, and source drift.

`bindings.json` was built from checksum-validated registry archives whose
extracted contents were compared byte-for-byte. At each run, Rust checks the
candidate, parent lock/inventory, pinned package sources/file sets, and lock
package subset. It checks its own compiled-in source inputs against disk, too.
MIR symbol selection follows the candidate's actual key type and rejects
ambiguous matches. The receipt records input/source/MIR/binary/tool/log hashes,
native exits, exact obligations, and all controls. Stale receipts are removed
before execution; fresh MIR output is required; sources are rechecked afterward.

Arithmetic qualification, constant-time behavior, entropy, production caching
budgets, revocation/authorization, transport integration and full-system
security remain **UNESTABLISHED**. Existing RustCrypto proofs do not transfer.
