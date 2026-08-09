# bDiD architecture — the 10-billion-user decision

<!-- 8 agents: 4 independent candidate architectures, 3 judges on separate
     dimensions, 1 synthesis. Decided 2026-08-04. Mainnet facts queried live. -->

# `.b` Identity Architecture — Decision

*Decided 2026-08-04. Mainnet facts in §7 were queried live from `https://eos.greymass.com` on this date and supersede the brief where they conflict.*

---

## 1. The decision

**Build `bDiD/BEELOG`: a self-certifying root identity (from `self-certifying`) whose human-readable `.b` name is a leaf in a single indexed Merkle log with one root row on Vaulta (from `commit-da`).**

This is a hybrid, and it is a coherent whole rather than a compromise, because each candidate's fatal flaw is the other's core mechanism:

- **`self-certifying` contributes the identity layer.** `bDiD = hash(genesis_op)` — a rotation-key-committing, hash-of-genesis DID. Uniqueness is collision resistance, not agreement. No issuer, no ordering, no registry, no DA, no chain bytes, no cost. This is the only structure in the field that answers "decentralized, automatic, autonomous" for all 10 billion, because the vast majority of those 10 billion will never claim a scarce name and therefore never need consensus about anything.
  - **Correction I am making to that candidate: 128 bits is not enough.** A 128-bit identifier has ~2⁶⁴ ≈ 1.8×10¹⁹ birthday-collision work. The candidate computed the *accidental* collision probability (1.5×10⁻¹⁹, correct) and never addressed the *adversarial* one. At Bitcoin-class hashrate (~6×10²⁰ H/s) 2⁶⁴ is a fraction of a second, so an attacker can craft two genesis ops sharing one bDiD — bind one to a name, present the other. `rollup`'s 160-bit truncation (2⁸⁰) is better but still not a margin I will sign. **bDiD is the full 256-bit digest**, base32, 52 chars. The raw DID is machine-facing; humans use the `.b` name or a DNS handle.

- **`commit-da` contributes the naming layer.** A depth-40 **indexed** Merkle tree (leaves carry `next_key`, so *non-membership* is provable), key = `sha256("b:v1:" ‖ skeleton(name))`, root committed in one Vaulta row per epoch. This fixes `self-certifying`'s two real defects, both correctly identified by the panel:
  1. **`.b` ownership becomes a Merkle proof, not a replay.** `self-certifying` made name ownership a client-side consensus rule requiring replay of the whole commit stream — which no wallet will do, so in practice every wallet would have believed a resolver. Against an on-chain root, a lying gateway produces arithmetic that fails.
  2. **The recurring O(users) cost disappears.** `self-certifying` required every head to be re-anchored "within N epochs of the chain head," never specified N, and the scale-cost judge correctly showed the answer ranged from $207K/yr to physically impossible. Here the *leaf* is the anchored head pointer, and it is rewritten **only when the user changes something**. Cost is O(updates), not O(users × windows). A user who sets an address once and never touches it again writes exactly once, forever.

- **`rollup` contributes exactly one idea, stripped of its proof system: forced inclusion as a contract *validity rule*, not a fraud proof.** The epoch action declares the forced-commit watermark it consumed and the contract rejects any root that fails to advance past entries older than K epochs. No SNARK, no ceremony, no prover.

- **`hierarchical` contributes no structure** (it is disqualified — see §2) but two disciplines I am adopting verbatim: **quote the paid-tier RAM deposit from live `rammarket` reserves at claim time**, never from a price list, because the Bancor curve is hyperbolic; and **confusable-skeleton normalization** in the tree key, without which "globally unique" is a marketing claim rather than a property. I am also taking its *serving* insight while rejecting its *authority* model: the log is sharded into depth-12 prefix pages for mirroring and k-anonymous lookup, but there is exactly one global tree and no shard has an owner who can censor it.

The three layers are independent by construction: identity survives the log dying; the log survives Vaulta halting (roots are historical, names stop *updating*, not resolving from a cached-and-verified proof); Vaulta stores 143 KB regardless of whether there are 1 million users or 10 billion.

---

## 2. Why the others lost

**`hierarchical` (Borda 8, ranked first by scale-cost).** Disqualified on Constraint 2 by its own opening sentence — "BNR is in the trust set until an on-chain renunciation ships, and I could not remove it." That is not a tradeoff under the founder's rules, it is a failure, and it is structural rather than temporary: hash-sharding `zone_id = BLAKE3(name)[0..12]` assigns every name exactly one operator that cannot be routed around. Who allocates a zone at genesis, who refills a slot after eviction, and who picks the k-of-n witnesses are all unspecified, and all three default to BNR. Its own resolution rule (refuse to send if `anchored_at` is older than 2 epochs) means one operator going dark takes 2.44M identities offline within two hours with no failover. Its escape hatch is a single **global** 4096-slot ring shared by all zones and all 10 billion users: fully drained hourly that is 98,304 forced claims/day = 0.36% of the population per year, and being a *ring*, it silently overwrites under exactly the censorship conditions it exists to survive. The cost work was the best in the field; the trust model was the worst. Do not re-propose zone delegation.

**`rollup` (Borda 6).** It builds a ZK rollup before user #1 has a name. Tier 1 — human-readable names, the actual product — cannot serve anyone until a Groth16 circuit for depth-40 SMT insertion, a credible multi-party phase-2 ceremony, an audited `alt_bn128` pairing verifier in eosio C++, a 100k-insert prover, and a from-scratch BabyJubjub EdDSA implementation all exist. That is "version after version of half built software" stated as an architecture. The trusted setup introduces the only **undetectable** forgery path in the field: the toxic-waste holder rewrites the root and reassigns all 10 billion names in one action, and no observer can distinguish it from an honest batch — everywhere else theft leaves a publicly diffable artifact. Its forced queue is a safety property only: the contract can reject a censoring batch but cannot compel anyone to produce one, and producing one needs a prover cluster, so a BNR prover outage halts all claims, transfers and renewals — which, combined with its own annual expiry, eventually expires the namespace. Finally, handed the hyperbolic curve as fact, it extrapolated linearly anyway: "$1.86M buys ~24M accounts" is wrong by 2× (the true figure is 12.8M) and the full reserve is not purchasable at any price. **The good idea — forced inclusion as a contract validity rule — is retained. The proof system is not.**

**`commit-da` (Borda 7) as a whole design.** Two defects. First, Constraint 8: `sealed := eph_pk ‖ nonce ‖ AEAD(11 chain addresses)` is one ciphertext over every address under one key, written permanently to Arweave. Disclosure granularity is per-counterparty, never per-address, so giving anyone your Vaulta address hands them the Zano↔EVM JOIN for your entire root — the exact leak RELAY_22 forbids — and one key compromise retroactively publishes every address of every user on the most durable medium in existence. Second, its entire "no sequencer, including BNR, is required for liveness" claim rests on `escape_commit`, which it insists writes no row and lives only in the block log — but an Antelope contract cannot read block history, so there is no artifact a challenger can point at and no way for the contract to authenticate the claim. The censorship floor was a claim, not a mechanism. Its 100,000 A bond also makes the 64-slot sequencer set a capital club of size one at launch. **Its tree, its ordering rule, and its ANS-104-per-epoch batching are the best work in the field and are adopted.**

**`self-certifying` alone (Borda 9, ranked first by two judges).** Not rejected — promoted, and repaired. Standing alone it had no on-chain arbiter for `.b` ownership (winner determined by replaying epoch roots plus every leaf from DA — which at 10B means a multi-TB replay no wallet performs, so a resolver silently becomes the trusted party), an unspecified freshness parameter N that swung the recurring cost across four orders of magnitude, a 128-bit identifier with inadequate collision margin, and complete silence on the 13 live names. All four are fixed above and in §4, §5, §7.

---

## 3. How it works

### 3.1 Passkey signup — free tier, zero chain bytes

1. WebAuthn credential created at Google / Microsoft / Bitwarden / Proton / BNR. Root seed derived via the **PRF (`hmac-secret`) extension**, so the seed never leaves the authenticator. One-button OAuth (GitHub / Google / MS / Bluesky) is available and is used **only** to bootstrap a DNS-style handle and a persona binding — never as the identity.
2. Client derives three rotation keys, ordered by priority: `r0` = PRF-derived; `r1` = the written-code recovery floor (already modelled — `onboarding::RecoveryPath::is_written_code`); `r2` = optional second device.
3. Client builds and hashes the genesis op:
   ```
   genesis_op = dag-cbor { type:"b:genesis", rotationKeys:[r0,r1,r2],
                           signingKey: s, services:[hint…], alsoKnownAs:[],
                           validUntil: <epoch> }
   bDiD = "did:b:" || base32( sha256(dag-cbor(genesis_op)) )     // 256-bit, 52 chars
   ```
4. Per-chain keys derive by SLIP-0010/BIP-32 hardened paths. The user can now **receive on every key-based chain** (EVM, Bitcoin, Zano, exSat, XRP, Stellar…) with no account creation anywhere.
5. Elapsed time: milliseconds. Bytes written to any blockchain: **zero**. Cost to BNR: **zero**. Identity now exists and is verifiable by anyone who is handed the genesis op.

**Stated flatly, because it is arithmetic and not negotiable:** a native Vaulta account is ~2,996 B of chain RAM and is therefore inherently O(n). Free-tier users get **no native Vaulta account**. They are fully functional on key-based chains. Any design promising 10 billion people a Vaulta account is dead before it starts.

### 3.2 Claiming a `.b` name — commit, then reveal

- `n = skeleton(NFKC(lowercase(input)))` — UTS-46 plus Unicode confusable skeleton. `k = sha256("b:v1:" ‖ n)`.
- **Commit (epoch E):** broadcast `C = sha256(n ‖ nonce ‖ bDiD)` to any bonded sequencer, *or* call `forcecommit(C)` directly on the contract. Sequencers see 32 bytes of entropy — front-running is impossible, not merely discouraged.
- **Reveal (epoch E+1 … E+144):** broadcast `(n, nonce, bDiD, display_form, sig)`. Commitments expire after 144 epochs (24 h at 10-min epochs).
- **Award:** §4.
- **Insert:** the winning leaf enters the indexed tree at epoch close. Losers' commitments expire and leave no state anywhere.

Leaf, canonical packed binary (reuse `atmirror/src/cbor.rs` + `varint.rs`):

```
leaf := display_len u8 | display utf8 (≤32)   ~12 B
      | bdid       [u8;32]                     32
      | head_cid   [u8;32]   (anchored log head)32
      | seq        u32                           4
      | registered u32 | expires u32             8
      | flags      u8                            1
      | next_key   [u8;32]  (non-membership)    32
      | sig        [u8;64]  (bDiD signing key)  64
                                            ≈ 185 B  → 192 B padded
```

### 3.3 Writing an address record — RELAY_22 by data structure

Addresses are **not** in the leaf and **not** on chain. They live in the user's own DID log as a fixed, padded **64-slot** vector, so slot count leaks nothing:

```
slot_i = { chain_key: "eip155:42161",  commitment: sha256(chain_key ‖ address ‖ salt_i) }
```

Three states per slot: **unset** (indistinguishable from padding) · **committed, unrevealed** (provable to one counterparty out of band, public to no one) · **revealed** (preimage published — irreversible). **Publication is never the default.** Each reveal requires a separate `InformedConsent` (type already exists in `onboarding`) naming the specific correlation being created; there is no "disclose all" flag and a multi-slot reveal in one consent is refused by both client and format. Where the chain supports reusable payment codes or stealth meta-addresses (BIP-47, ERC-5564), the slot holds a **meta-address** instead — publishing it creates no cross-chain JOIN because no two senders derive the same destination.

Writing an address changes the log head → the user's leaf `head_cid`/`seq` update in the next epoch. **That is the only recurring write, and it happens per change, not per user per window.**

### 3.4 What a wallet does at send time — `alice.b → address`

```
 1. n = skeleton(NFKC(lower("alice"))) ;  k = sha256("b:v1:" ‖ n)
 2. Read the `state` singleton from >=2 INDEPENDENT Vaulta endpoints (or a light
    client). Never from the host serving the proof. Get {epoch, root, tree_size, at}.
    Reject if `at` is older than 2 epochs.               <-- chain staleness, not per-user
 3. GET /proof/{k} from ANY gateway -> { leaf 192 B, path[40] 1,280 B }
 4. Fold leaf up 40 siblings. Must equal `root`. Mismatch or missing -> REFUSE.
    (Non-membership answer -> the name is unclaimed -> REFUSE.)
 5. leaf.expires > now ; check flags.
 6. Fetch the DID log from leaf.service_hints (ar:// tag query, autonomi://, https://)
    OR accept it directly from the recipient out of band. Either is fine: it is
    self-certifying.
 7. Verify sha256(genesis_op) == leaf.bdid ; walk prev/sig to head.
    Require head.seq >= leaf.seq. A leaf pointing past the log you were handed is
    withholding -> REFUSE.
 8. Slot for the target CAIP-2 chain:
      revealed      -> verify (address, salt) against the commitment ; use it
      meta-address  -> derive a fresh stealth destination
      unset/unrevealed -> encrypted handshake to the DID service endpoint;
                          recipient releases one address for one payment.
                          Never guess. Never fall back.
 9. Display a 2-word checksum from sha256(bdid ‖ caip2 ‖ address) for out-of-band
    confirmation.
10. ANY failure above -> refuse to send. No cache fallback, ever.
```

Total network cost of a resolution: ~1.7 KB. **Privacy mode:** fetch the whole depth-12 prefix page containing `k` instead of a single proof — the gateway learns 12 bits, giving k-anonymity ≈ 2.4M at 10B names, for one bulk GET.

**Rule 10 is load-bearing.** A resolver that answers plausibly when it should error is how funds get misrouted. Fail closed.

### 3.5 Epoch mechanics

10-minute epochs, 144/day. Leader = `seq[ sha256(block_id at epoch boundary) mod n ]` — a public beacon nobody controls in advance. The leader applies the ordering rule, updates the indexed tree incrementally, packs **one ANS-104 DataItem per epoch** (this is why `atmirror::arweave` matters: a DataItem header is ~1,044 B, so one item per user would be 500%+ overhead and 10¹⁰ items is absurd; one item per epoch amortizes it to ~0.001%), — but it **FUNDS only this epoch-fixed overhead** (the header + the on-chain
commit), **never the per-name bytes in the delta** (registrant-pays invariant, below;
and see the VERIFICATION RESULT for why "one DataItem per epoch" and per-name
claimant-funding are in tension) — and submits **one** Vaulta action:

```
commit(epoch, new_root, prev_root, tree_size, delta_id, forced_watermark)
```

which **overwrites** the oldest slot in a 144-row ring. Net RAM delta: **0 bytes**.

> ## ⛔ INVARIANT — REGISTRANT-PAYS FOR RECORD STORAGE (RULED, hardline)
> *Recorded here, beside `commit()`, because this is exactly where an implementer would be
> tempted to breach it. (LAW 8s.)*
>
> **THE LINE IS EPOCH-FIXED vs PER-RECORD — not on-chain vs off-chain.**
> *(Corrected 2026-08-09. The earlier wording drew the line at the chain boundary; that was
> wrong in both directions — it forbade legitimate leader funding and, worse, implied the
> off-chain path was outside the invariant. The off-chain path is exactly where the breach
> was found.)*
>
> **The leader funds EPOCH-FIXED overhead only, and it is fixed per epoch regardless of how
> many names the epoch carries:**
>
> | cost | who pays | why |
> |---|---|---|
> | on-chain `commit()` — 356 B cold, **0 B on wrap** | **leader** (permissionless — anyone may bear it) | **the leader's ONLY cost** |
> | ANS-104 DataItem **header** — ~1,044 B | **CLAIMANT** | under per-name items the header is **per-name** — it grows with users |
> | DataItem **per-name body bytes** | **CLAIMANT** | scales with users |
>
> **RULED (a): PER-NAME CLAIMANT-FUNDED DataItems.** Each claimant mints and funds **its
> own** DataItem — header and body together, ~$0.000034 per name, Turbo-bundled server-side.
> No float, no new accounting layer.
>
> *Header corrected 2026-08-09: it was listed as leader-funded/epoch-fixed. Once per-name
> items were ruled, **the header moved sides** — and my own test decides it: **does this cost
> grow with the number of names?** Under (a) the header does. I wrote the test and then did
> not apply it to the row above it.*
>
> *Also corrected: I repeated "the gap is integration, not invention" for `x-paid-by`. That
> was **false at the mechanism level** — `x-paid-by` is `Option<String>`, **one delegate per
> DataItem**, so header and body are a single payment unit and cannot be split across payers.
> That constraint is precisely why per-name items are the answer rather than a shared epoch
> item.*
>
> **Why the "10^10 items is absurd" objection dissolves:** :131 assumed **one actor** minting
> every item. Under (a) each claimant mints and funds its own — there is no single actor
> bearing 10^10 items, so the count was never the leader's burden to carry.
>
> **Rejected — (b) leader-fronts-and-reimburses:** it is **invention** (a new accounting
> layer), and a non-reimbursing claimant leaves the leader funding records — **the same
> hardline breach, relocated.**
>
> **Any design where epoch inclusion subsidises record storage is a HARDLINE BREACH BY
> CONSTRUCTION, regardless of how cheap it looks.** The hardline is that BNR funding must
> never gate how many users can exist; a committer who pays for records is precisely that
> gate, wearing a different name. This is not a cost trade-off to be optimised — a path that
> lets record storage ride on the committer's payment is a **defect**, and the fact that it
> would be inexpensive at small N is irrelevant, because the failure is structural and
> appears only at the scale where it cannot be undone.
>
> **Corollary, and the reason the fee question closed:** the registrant's own resource
> payment (Autonomi chunk cost for the signed record; Vaulta RAM/A at Layer-2) **is** the
> security parameter for occupancy attacks. Registrant-pays and attack-pricing are the same
> mechanism — so preserving this invariant preserves both properties at once.
>
> **THE TEST THAT MAKES THIS CHECKABLE:** *does this cost grow with the number of names?*
> If yes, it is claimant-funded — no exceptions, no "it's only a few bytes." If it is fixed
> per epoch, the leader may bear it. **A per-name cost hidden inside an epoch-level operation
> is still a per-name cost**, and packaging is not funding.
>
> **The default is the defect.** The breach found on 2026-08-09 was not a broken mechanism —
> it was a *sentence* (:131) that read leader-pays by default for the DataItem body, with no
> mechanism contradicting it. **A design whose safe behaviour depends on nobody implementing
> the obvious reading is already broken**, which is why the amendment is to the wording, not
> only to the code.
>
> *Verification of the current design against this invariant is Code's; this entry records
> the rule, not a claim that the code satisfies it. The on-chain path was verified clean;
> the off-chain DataItem path is where the breach was found.*

> ## VERIFICATION RESULT — Code (Seat 3), 2026-08-09
> *Assigned by LAW 8s. Records what the design does against the invariant above — including a
> mechanism-level collision with the `x-paid-by` resolution. Escalated, not resolved (8c: this is
> Code's finding; the design call is the founder's / Seat 1's).*
>
> **On-chain: CLEAN, proven.** `commit_row` is eight fixed-size scalars; `delta_id` is a 32 B
> pointer, never records. Measured 356 B cold / 0 B wrap on Jungle4 (`banchor22222`), independent of
> name count. The committer's on-chain payment cannot scale with records. This half holds by
> construction.
>
> **⚠ The `x-paid-by` resolution is INVENTION under "one DataItem per epoch", not integration.**
> Verified in `crates/atmirror/src/arweave.rs`: `x-paid-by` is ONE delegate per DataItem
> (`paid_by: Option<String>` :54; one `x-paid-by` header per POST :218-220), and `data_item()` builds
> ONE item with ONE owner (:264). **A DataItem is a single payment unit** — its header and its
> per-name body are charged together, to one payer. So the table above **cannot be executed as
> written** while `:131` says one DataItem per epoch: you cannot fund the header from the leader and
> the per-name body from claimants inside the same item. `x-paid-by` attributes the WHOLE item to one
> payer — leader (breach) or one claimant (absurd).
>
> **The only shape where `x-paid-by` achieves per-name claimant funding is per-name DataItems** —
> each name its own item, `x-paid-by = that claimant`. But then the ~1,044 B header is PER-NAME and
> CLAIMANT-paid, which dissolves the "header — epoch-fixed — leader" row above and falsifies `:131`'s
> one-item amortisation. By the block's own test (:178 *does the cost grow with names?*): under
> per-name items the header grows with names → claimant-funded; the leader's only epoch-fixed cost is
> the on-chain commit.
>
> **Cost of that shape, to inform the choice not make it:** header ~1,044 B/name at $32.56/GiB ≈
> **$0.000034/name, claimant-paid** — negligible, bounded. Turbo bundles per-name items server-side,
> so ~38,052 items/epoch is ordinary throughput, not the "10¹⁰ items is absurd" `:131` rejected —
> that objection was one actor minting all items; here each claimant mints and funds its own.
>
> **ESCALATED — a design call above this seat:** (a) relax `:131` to per-name claimant-funded
> DataItems, accept the bounded claimant-paid header — clean, and "integration" then holds; or
> (b) keep one-DataItem-per-epoch and build a reimbursement/pre-pay accounting layer — that is
> invention, and carries a float-risk breach vector (a non-reimbursing claimant leaves the leader
> funding records). The invariant is safe under either once chosen; it is NOT safe while `:131` says
> "one DataItem per epoch" AND the table says "per-name body claimant-funded via `x-paid-by`",
> because those two cannot both hold.
>
> **Negative control (8r):** the discriminating live test — a real Turbo upload showing leader-charged
> vs claimant-charged — needs funded Arweave keys this seat does not hold and will not create (no-key
> rule; real money). The structural proof stands without it: one owner + one `Option<paid_by>` per
> item is dispositive, and a confirming harness would only re-assert the type signature (a vacuous
> test, 8n). The result that proves the point is that the claimant-funded variant is UNBUILDABLE
> inside one epoch DataItem — the breach is structural, not a bug.

> **ABI CAVEATS — what `commit()` does and does not guarantee.**
> *Measured on Jungle4 2026-08-09 (Cowork, epoch 146, tx `f32e7478…`). Recorded here so no
> reader infers a guarantee the contract does not make.*
>
> 1. **`tree_size` is ASSERTED, not verified against `new_root`.** The contract enforces
>    **monotonicity only** — *"tree_size may never shrink; the tree is append-only"*,
>    confirmed by a deliberate shrink attempt, which was refused. It does **not** and cannot
>    check that `new_root` actually commits to `tree_size` leaves. A committer may state any
>    non-shrinking value. This is consistent with the split — **the chain proves ORDER, the
>    resolver proves CONTENT** — but `tree_size` *reads* like a verified quantity and is not
>    one. Do not build a check on it.
> 2. **`tree_size` continuity does not imply a real ancestor relationship.** Two consecutive
>    rows can satisfy monotonicity while their roots commit to unrelated trees (as happens
>    whenever synthetic or test rows precede real ones). Continuity of the counter is
>    arithmetic, not structural.
> 3. **The `commits` table is a 144-epoch WINDOW, not an archive.** Wrap silently overwrites
>    the oldest slot — observed: epoch 146 replaced epoch 2 while epoch 3 remained. Anyone
>    auditing history must treat the table as a sliding window and source older epochs
>    elsewhere. Relatedly, a skipped epoch during initial ring **fill** leaves its slot cold
>    until the first wrap, so **row count does not indicate ring health** — do not build that
>    check either.

Sequencer hardware: ~2×10¹⁰ tree nodes × 32 B ≈ **640 GB NVMe**, 8 cores, ~$1,500. At the aggressive rate of 10B names claimed over 5 years, that is 38,052 inserts/epoch × 40 = 1.5M sha256/epoch — about two seconds on one core. Deliberately hobbyist-grade so the set is contestable by people, not by capital.

---

## 4. The uniqueness / ordering answer

### 4.1 First, the fact that reframes the question

**Global uniqueness is already broken on mainnet, today, at n=13.** Queried 2026-08-04:

| Account | `domains` rows | ABI | Registered | Config |
|---|---|---|---|---|
| `remington.gm` | 13 | v1, **no** `chainkeys` table | 2026-07-28 09:00–09:04 | admin `remington.gm`, fee `0.0000 A` |
| `kingbeelovis` | 13 — **identical names** | v2, `chainkeys` (11 CAIP-2 rows) | 2026-08-01 01:37 | admin `kingbeelovis`, fee `0.0000 EOS` |

`remington.b` has two owners on Vaulta mainnet right now. Nothing was hacked; two copies of the contract are deployed and each asserts the same names. This proves the point the constraint is really about: **there is no such thing as a globally unique name without first naming the authority relative to which it is unique.** Every design in this field, including this one, answers "who claimed it first" only *relative to one contract account*. So:

> **Canonical authority = exactly one Vaulta account, hard-coded in every client and published in the spec. Any name asserted by any other contract is not a `.b` name.** Wallets that accept "whatever contract the resolver points at" reintroduce the failure above at 10-billion scale.

### 4.2 The award rule

For a contested name with eligible reveals `R₁…Rₘ`:

1. **Earliest committing epoch wins.** `argmin(commit_epoch)`. Cross-epoch first-claim is absolute.
2. **Ties within one epoch:** `argmin sha256(Cᵢ ‖ B_E)`, where `B_E` is the Vaulta block ID at epoch E's boundary. `B_E` is unknowable when `Cᵢ` was constructed, so priority cannot be ground out by brute force.
3. Commitments expire 144 epochs after their epoch.
4. The tree key is the **confusable skeleton**, so `paypaĺ` and `paypal` are the same claim and the second one gets a non-membership failure, not a lookalike name.

The sequencer decides **nothing** about who wins. It decides only *inclusion*, and inclusion is enforced three independent ways:

- **Forced commit.** `forcecommit(C)` folds into a 32-byte on-chain accumulator, `acc = sha256(acc ‖ C ‖ seq)`, in a singleton field. Antelope bills RAM on the delta and the delta of a fixed-width field is **zero** — so this hatch has *no* row, *no* ring, and *no* throughput ceiling. It costs the user ~500 B NET and ~1 ms CPU (≈$0.001). This is `self-certifying`'s mechanism and it is strictly better than `hierarchical`'s and `rollup`'s 4096-slot rings, which fill and wrap precisely when needed.
- **Contract validity rule.** Each `commit` declares `forced_watermark`; the contract **rejects** any root that fails to advance the watermark past all forced commits older than K epochs. A censoring sequencer cannot produce a valid action at all.
- **Fraud proof.** The contract checkpoints `forced_acc` into every STH row, so a challenger proves omission by supplying the accumulator preimage segment plus a **non-membership proof** of `C` against `root(E)` — which is precisely what the indexed tree exists for. Effect: revert to `root(E−1)`, slash, rotate. Verification cost is L sha256 intrinsics for a segment of L forced commits; beyond roughly 50k per epoch a challenge continues across transactions using a bounded cursor row. State it plainly: this is the one part of the contract whose CPU cost must be benchmarked before deploy.

**Bond sizing — I depart from `commit-da` here.** It set the bond at 100,000 A on the theory that it must exceed the value of the most valuable stealable name; that makes the sequencer set a capital club of size one. But fraud is **revertible** — a successful challenge rolls the root back to `E−1` and no theft occurred. The bond therefore needs to cover griefing cost and provide deterrence, not to insure a name's market value. Set it at ~1,000 A with full slashing and a three-strike eviction.

### 4.3 The trust assumption, stated without decoration

- **Vaulta block producers order the epochs.** A BP cartel colluding with a claimant could censor a competing commit for the epochs needed to lose a race. This is the same trust already carried by every transaction on the chain and by the 13 names that exist today. It is not zero. It is not BNR.
- **Nobody is trusted for the identity itself.** A bDiD cannot be censored (no issuer), forged (you verify the DID *is* the hash of the op you were handed), or frozen (no registry holds it). This is why the 10-billion population has no ordering problem: the hard part of naming was avoided for them, not solved.
- **DNS/ICANN is trusted for domain-bound handles.** `alice.example.com ↔ bDiD` via bidirectional `_bdid` TXT / `.well-known` plus `alsoKnownAs` (already implemented — `atmirror/src/did.rs` does live `did:plc`/`did:web` resolution over HTTPS). This is free, unlimited, needs zero on-chain bytes, and lets real users have real human-readable names before any `.b` mechanism exists. **The cost, which no candidate said out loud: a registrar or a court can take your handle.** Your bDiD and your funds are unaffected; your name is not.

### 4.4 Residual centralization — named, with the removal path

**Two items, and no candidate in the field addressed either.**

1. **The contract account's `owner`/`active` permissions.** An unburned `active` key makes every rule above rewritable by `setcode`. That is a larger trusted party than anything the candidates argued about. Path: deploy to a fresh account; run Phases 3–4 with a 3-of-5 msig held by named parties; **burn `owner` and `active` to `eosio.null` at the end of Phase 4**, with the transaction id published. Until that transaction exists, this design is *not* compliant with Constraint 2 and I will not claim otherwise.
2. **BNR is the only sequencer at launch.** This is a bootstrap condition, not a design property — the escape hatch and the published tree verifier exist from Phase 3 day one, so any user can already *prove* BNR wrong even before slashing is live. Path: Phase 4 ships permissionless bonded entry with a hobbyist-grade bond. **The test that Constraint 2 is met is concrete and dated: an independent third party produces a valid epoch root on mainnet while BNR's node is switched off.** If that test has not passed 90 days after Phase 4, the design has failed on the founder's own terms and should be said so out loud rather than shipped as "decentralized."

### 4.5 Squatting — what is not solved

There is **no sybil-resistant free-name mechanism that does not require either a trusted issuer or a real cost.** An OAuth nullifier needs a salt holder (that is BNR → violates Constraint 2) or a public salt (that publicly links a `.b` name to a Google account → violates RELAY_22). I recommend not shipping it. What ships instead: scarce human-readable strings are **paid only** (which also satisfies "no subsidy"), names ≤5 chars are permanently premium, annual expiry with renewal as an ordinary log entry, and the free tier's unlimited names are self-certifying bDiDs and DNS-bound handles — neither of which is scarce, so neither can be squatted.

---

## 5. On-chain footprint

Antelope `multi_index` row overhead taken as ~112 B (row header, payer, chainbase index nodes). This estimate could be off by up to 2× and the conclusion does not move — see the note below the table.

| Object | Payload | +overhead | Count | Bytes |
|---|---|---|---|---|
| `state` singleton (epoch 8, root 32, prev_root 32, tree_size 8, delta_id 32, forced_acc 32, forced_count 8, forced_watermark 8, at 4, leader 8) | 172 | 284 | 1 | **284** |
| STH ring, 24 h @ 10 min (epoch 8, root 32, delta_id 32, forced_acc 32, tree_size 8, at 4, submitter 8, status 1) | 125 | 237 | 144 | **34,128** |
| `sequencers` (owner 8, bond 16, url ≤64, strikes 4, since 4) | 97 | 209 | 64 cap | **13,376** |
| `disputes` | 144 | 256 | 16 cap | **4,096** |
| `challenge` cursors (bounded multi-tx fraud proofs) | 88 | 200 | 16 cap | **3,200** |
| `chainkeys` (CAIP-2, reused from `bdomain.hpp`) | 88 | 200 | 64 cap | **12,800** |
| `config` | 160 | 272 | 1 | **272** |
| Code + ABI (est. vs. measured live `bdomain.wasm` 42,869 B + `bdomain.abi` 11,222 B) | — | — | 1 | **~80,000** |
| | | | **TOTAL** | **148,156 B = 144.7 KiB** |

**Footprint by user count:**

| Users | On-chain bytes | Δ | Per-user amortized |
|---|---|---|---|
| 1,000,000 | 148,156 | — | 0.148 B |
| 100,000,000 | 148,156 | **0** | 0.00148 B |
| 10,000,000,000 | 148,156 | **0** | **0.0000148 B** |

The only quantity that grows is `tree_size`, a `u64` **already inside the singleton**; 10¹⁰ needs 34 bits of it. Historical roots need no storage — they are provable by RFC 6962 consistency proof against the current STH.

**Margin against the measured unallocated 70.90 GiB (76,128,825,344 B):**
148,156 / 76,128,825,344 = **0.000195%**. Headroom factor: **513,835×**. We could be wrong about the footprint by a factor of a thousand and still fit.

**Dollar cost.** Reconstructing the relay from the two given points (1 GiB = $26,185, 10 GiB = $300,552) gives the standard 50/50 Bancor form `P(Δ) = QΔ/(R−Δ)` with `R = 70.892 GiB`, `Q = $1,830,127`. This reproduces $4,379,929 at 50 GiB (stated: $4.38M) and the 100 GiB impossibility exactly, so I trust it.

- Δ = 148,156 B = 1.37977×10⁻⁴ GiB → **P = $3.56, once, forever, for 10 billion identities.**
- Sanity: the status-quo 2.9 KB/user design at 10¹⁰ is 2.9×10¹³ B = **26.4 TiB = 69.2× the entire chain** (the brief's "75×" mixed KiB and KB; only `self-certifying` caught this). Ratio between designs: **~1.96×10⁸ : 1**.

**Recurring chain load:** 144 `commit` actions/day at ~300 B = 43 KB/day of NET, plus one `alt_bn128`-free, sha256-only verification per action. Forced commits add ~500 B NET each and **zero RAM**. This is noise against a chain that already carries ~181 GB/day of NET capacity.

---

## 6. What it costs, and who pays

Arweave figures use Turbo at **$32.56/GiB** (the July–Aug 2026 retail figure two independent candidates measured; treat as ±30% and note the conclusion is insensitive).

| Item | Bytes | Cost | Payer |
|---|---|---|---|
| **Free tier — bDiD creation** | 0 on chain | **$0.00** | nobody |
| Free tier — log storage | ~600 B | **$0.00 required** | see below |
| **Paid name — leaf** | 192 B | $0.0000058 | claimant |
| **Paid name — public record** (genesis op + DID doc + 64-slot padded disclosure tree) | ~2,650 B | $0.0000804 | claimant |
| **Paid name — total permanent DA** | ~2,842 B | **$0.0000862** | claimant |
| **Paid tier — Vaulta account RAM** (~2,996 B, quoted live at claim time) | 2,996 B | **~$0.072 today, and rising** | depositor |

**Free-tier DA is $0 because it is not required.** This is a direct consequence of self-certification and it is the single most important cost property of this design: a recipient can hand the payer their log *at payment time* and the payer verifies it locally (`sha256(genesis_op) == bDiD`). No authoritative store must exist for a free identity to work. Compare the alternative: 10¹⁰ × 600 B = 5,588 GiB ≈ **$181,945** of unfunded ingest that `self-certifying` never named a payer for. Here that spend is optional and per-user.

**DA scaling for publicly-resolvable names** (the only names that *require* DA, because the payer starts with nothing but a string):

| Public names | Bytes | Arweave, permanent |
|---|---|---|
| 100,000,000 | 2.84×10¹¹ = 265 GiB | **$8,624** |
| 1,000,000,000 | 2,646 GiB | **$86,175** |
| 10,000,000,000 (every human) | 26,463 GiB | **$861,753** |

Even the absurd case — every human on earth publishes — is under $900K one-time against a name fee base that would be in the billions per year. **Renewals are the recurring term** and must be budgeted, unlike in `commit-da` which priced ingest only: annual proof-of-life re-signing at 192 B/name is 1,788 GiB/yr at 10B names = **$58,222/yr**, which the annual fee covers ~10⁵× over.

**Fee policy.** DA cost per name is $0.0000862, so the fee is set by **anti-squatting economics, not by cost**: ~$1–5/year for ≥6 characters, premium tiers for ≤5. This satisfies "I don't want to supplement anyone's account creation" without subsidy anywhere in the system.

**The paid tier's hard ceiling, in dollars, because two candidates stated it only in bytes or stated it wrongly.** On the real curve:

| Spend | RAM bought | Vaulta accounts @ 2,996 B |
|---|---|---|
| $138,872 | 5.00 GiB | 1,791,959 |
| $719,187 | 20.00 GiB | 7,167,838 |
| **$1,000,000** | 25.05 GiB | **~8,977,000** |
| $58.9 B | 70.89 GiB | 25,409,978 |
| any price | 70.892 GiB | **impossible — relay asymptote** |

The native-Vaulta tier is a premium product with a physical population cap in the **low millions**. It must never be marketed as a growth path. (`rollup` claimed $1.86M buys 24M accounts; the true figure is 12.8M, and it was handed the hyperbolicity as fact.)

---

## 7. The 13 live names and the deployed contract

### 7.1 What is actually deployed (measured 2026-08-04 via `eos.greymass.com`)

**Both** accounts are live on Vaulta mainnet and **both hold the same 13 names**: `king queen remington travis lovis inga oliver lacee amanda isabella travisremington loviswater loviswaternakamoto`.

| | `remington.gm` | `kingbeelovis` |
|---|---|---|
| `domains` rows | 13 (registered 2026-07-28) | 13 (registered 2026-08-01) |
| `chainkeys` table | **absent from ABI** (v1 contract) | 11 CAIP-2 rows (`eip155:1`, `eip155:42161`, `eip155:7200`, `slip44:*`…) |
| `chainaddrs` | — | 11 rows under one domain scope |
| `config` | admin `remington.gm`, fee `0.0000 A` | admin `kingbeelovis`, fee `0.0000 EOS` |
| `ram_usage` / `ram_quota` | 370,553 / 615,687 B | 442,099 / **3,035,677** B |
| Expiry | **2027-07-28** | **2027-08-01** |

The brief said `kingbeelovis`; the local `docs/SCHEMA_resolver_C2_draft.md` said `remington.gm`; `scripts/claim_mainnet.sh` targets `remington.gm` on mainnet while `scripts/deploy_kingbeelovis.sh` targets `kingbeelovis` on **Jungle4**. `commit-da` flagged the discrepancy (credit) but inferred backwards. The truth is that there are **three** deployments: two on mainnet and one on testnet. The docs are stale in both directions and should be corrected.

### 7.2 Decision: evolve, don't replace

- **`kingbeelovis` is declared canonical for legacy.** It runs the newer ABI (CAIP-2 `chainkeys`, matching `bdomain.hpp`'s `std::string chain_key` design) and has 2,593,578 B of spare RAM quota. It is **frozen**: no new registrations, code unchanged, admin unchanged, contract left running exactly as it is.
- **`remington.gm` is declared non-canonical and frozen.** No rows are touched, nothing is deleted. Because the same human owns both, nobody loses a name — the duplicate is a documentation hazard, not a dispute. It is written into the spec so that no future client resolves against it.
- **BEELOG deploys to a fresh account** with its own permissions, so the burn schedule in §4.4 does not entangle the legacy admin key.
- **The 13 names are seeded into BEELOG epoch 0** as pre-committed reserved leaves at genesis. Zero incremental RAM (they are leaves, not rows). Each leaf is `flags = RESERVED` with an empty `bdid` until the holder creates one.
- **Immediate operational action, independent of architecture: the names expire 2027-07-28 and 2027-08-01.** Renewal is a live obligation on the legacy contract regardless of which design won. Put it on a calendar now.

### 7.3 What the holders experience

**Nothing breaks, and nothing is lost.**

| | Before | After |
|---|---|---|
| Legacy resolution (`get_table_rows` on `kingbeelovis`) | works | **still works, unchanged, indefinitely** |
| The 13 names in BEELOG | n/a | pre-reserved; nobody else can ever claim them |
| To activate a name in BEELOG | n/a | create a bDiD (one passkey tap), sign a binding op, reveal in the next epoch |
| If the holder never creates a bDiD | n/a | the leaf stays `RESERVED` forever; new wallets return "not yet activated" and refuse to send; the legacy contract keeps resolving |
| Cost to migrate | — | **$0** (BNR seeds the reserved leaves at genesis) |

The only thing a holder gives up by *not* migrating is reachability from new wallets, and that is reversible at any time by claiming the reserved leaf.

---

## 8. Build order

Every phase ends with something a real human uses on mainnet. No phase ends in a stub.

**Phase 0 — Reconcile the record (days). Extends: `b-domain/docs`, `b-domain/scripts`.**
Publish which mainnet account is canonical; correct `SCHEMA_resolver_C2_draft.md` §1/§5; renew the 13 names well before 2027-07-28. *Ends when:* the deployed-state document matches the three measured deployments and a renewal is scheduled.

**Phase 1 — bDiD free tier (weeks). Extends: `onboarding`, `atmirror` (`cbor`, `cid`, `car`, `commit`, `did`, `state`).**
Passkey PRF → rotation keys → 256-bit genesis op → SLIP-0010 per-chain derivation. Handles via DNS/`did:web` bidirectional binding, which `atmirror/src/did.rs` already resolves live. Zero chain code, zero new contract, zero consensus. *Ends when:* a real human creates a bDiD from a Proton passkey, publishes `_bdid.alice.example.com`, and **receives a real payment on a key-based chain**. The hardest new work here is rotation-conflict resolution (two ops at the same `seq` signed by different-priority rotation keys) — `commit.rs` verifies one signature over one commit; it does not arbitrate competing histories. Budget for that honestly.

**Phase 2 — Antelope signing (weeks). Extends: `bsigner`, `chain-eos`.**
`bsigner` is deliberately incapable of signing (`lib.rs:6`; `channel::RefusingSigner`; test `signing_is_refused_through_the_public_api`) and `chain-eos` is decode-only (`skip_signature()`, `abi::decode_action` with no encoder). But `cleos` plus an unlocked wallet **is** the live write path today — it is how all 13 names were claimed, and the README records Trezor-signed EOS actions proven on Safe 7. So this phase *replaces a manual path*, it does not enable one, which de-risks it substantially. *Ends when:* a mainnet transaction is signed from Rust and lands.

**Phase 3 — `bnames` contract, single sequencer (months). Extends: `b-domain/contract`, `atmirror::arweave`, `atmirror::receipt`.**
Singleton + STH ring + `forcecommit` accumulator + commit–reveal + indexed-tree insert. BNR runs the only sequencer, but the **tree spec and an independent verifier are published on day one**, so anyone can detect fraud before slashing exists. One ANS-104 DataItem per epoch via `ArweaveRail` (which already builds real DataItems, computes `deep_hash`, and derives `id` locally before upload); dual-write to Autonomi via the existing `ant` subprocess driver. *Ends when:* a real user claims a real `.b` name by commit–reveal and a wallet resolves it by verifying a 40-node Merkle path against the on-chain root, with a working `forcecommit` fallback. Say plainly during this phase: BNR is the sole sequencer and Constraint 2 is not yet met.

**Phase 4 — Decentralize (months). Extends: `b-domain/contract`, `dispute-engine`.**
Permissionless bonded entry, beacon-driven leader rotation, the three fraud proofs, the `forced_watermark` validity rule, the bounded multi-tx challenge cursor (benchmark `sha256` intrinsic CPU **before** deploy). Then **burn `owner` and `active` to `eosio.null`** and publish the transaction id. *Ends when:* an independent third party produces a valid epoch root on mainnet **while BNR's node is switched off**. That event, and only that event, is when Constraint 2 is satisfied.

**Phase 5 — Paid tier (weeks). Extends: `chain-eos`, `bsigner`, `treasury-t0`, `escrow-core`.**
Deposit → `newaccount` + `buyram` + `delegatebw`, with the RAM cost **quoted from live `rammarket` reserves at claim time**, PowerUp as CPU/NET backstop, `linkauth`-scoped permissions per the C2 doc §3. *Ends when:* a paying user gets a real Vaulta account funded entirely by their deposit, and it appears as `antelope:vaulta` in their own disclosure slot like any other chain.

**Phase 6 — RELAY_22 completion (ongoing). Extends: `onboarding::persona`, `capability`, `chain-zano`, `chain-exsat-evm`.**
Per-slot `InformedConsent`, encrypted handshake mode, stealth meta-addresses (BIP-47 / ERC-5564) where chains support them. **Sequence this deliberately:** the disclosure path is easy to build and the privacy-correct default is not, and that gradient is exactly how a system ships publication-by-default in v1. Handshake mode ships *before* bulk reveal is even expressible in the UI.

---

## 9. The honest risks

**1. The free tier has no native Vaulta account, forever.** This is arithmetic, not a tradeoff: 10¹⁰ × 2,996 B = 27.2 TiB = 71× the whole chain, and the relay cannot sell 70.892 GiB at any price. If the product genuinely requires a native account per user, **this architecture is wrong and so is every other one in the field.** *Earliest signal:* any core product requirement that cannot be expressed without `eosio` account-level auth for a free user — watch for it in Phase 1 design review, not after Phase 5.

**2. Wallets read the root from the same host that serves the proof.** Every security property in §3.4 collapses if step 2 and step 3 share a trust domain — the resolver can then serve a stale-but-consistent root and an old address. *Earliest signal:* the first SDK PR whose `resolve()` takes a single `gateway_url`. Fix it in review; make ≥2 independent chain endpoints a hard API requirement, not a documentation suggestion.

**3. The sequencer set never becomes plural, and BNR is the permanent trusted party.** *Earliest signal:* Phase 4 + 90 days with zero non-BNR bonded sequencers. That is not a delay to manage; it is the design having failed on the founder's own terms, and it should be reported as such rather than smoothed over.

**4. The escape hatch's fraud proof exceeds the CPU budget.** Verifying an accumulator segment costs L `sha256` intrinsics; if an adversary spams `forcecommit` to inflate L, challenges must span multiple transactions and might become impractical under sustained attack. *Earliest signal:* the Phase 4 benchmark. If a 50k-entry segment cannot be verified in a bounded number of transactions, the hatch must be redesigned (probably to a small bounded ring plus per-epoch rate limiting) before deploy — and that would be a genuine weakening, so measure it early rather than at the end.

**5. Squatting eats the namespace anyway.** Paid-only scarce names plus expiry is a pricing answer, not a solution; nobody has one. *Earliest signal:* in the first week of Phase 3, >30% of reveals traceable to fewer than 100 funding sources. Response is fee curve and length tiers — **not** an OAuth nullifier, which requires either a trusted salt holder (Constraint 2) or a public link from a `.b` name to a Google account (RELAY_22).

**6. Arweave/Turbo pricing or the bundler regresses.** $32.56/GiB is a measured retail figure from one vendor at one moment, and ANS-104 bundlers have no slashing for a bundler that takes your fee and drops your DataItem. *Earliest signal:* Turbo quote >2× the Phase 3 baseline, or bundler rejection/omission rate >0.1% in the epoch cross-check that `atmirror::arweave` already performs (it computes the id locally and compares). Mitigations already coded: dual-write to Autonomi, and the fact that a full name log at 10B names is only ~2.6 TB — one commodity drive, so mirroring is not exotic infrastructure.

**7. DA loss makes an epoch's names cryptographically committed but unresolvable.** The root says they exist; nobody can produce the path. Two-phase posting (Arweave confirmation depth ≥20 blocks *before* the root advances) is the primary defence and is cheap. But note the sharp asymmetry that argues for this design: **every free-tier bDiD is completely unaffected by DA loss**, because it needs no store at all. Only public `.b` names are at risk. *Earliest signal:* any epoch where the sequencer's local id cross-check against the bundler disagrees.

**8. Where I am least confident.** The Antelope row-overhead constant (~112 B) is an estimate and the code+ABI size (~80,000 B) is an extrapolation from the measured 42,869 B `bdomain.wasm` — a 2× error puts the footprint at ~$7 instead of $3.56, which changes nothing. The Turbo price is one vendor at one date. The sequencer's 640 GB tree-state figure assumes a naive node-per-entry layout and is an upper bound. **None of these uncertainties can move the decision**, because the decision rests on a ratio of ~2×10⁸, not on a margin of a few percent. The things that *can* move the decision are risks 1, 3, and 4, and all three have signals that arrive before the expensive work does.
