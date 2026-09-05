// note.cpp — the private PAYMENT note (SPEC-PRIVACY-1, M6: soundness —
// on-chain root + range checks; M5 was membership+conservation).
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
//
// WHAT IS REAL HERE (labeled exactly, per the lane law):
//  - The FLOW: deposit -> private payment -> withdraw, with commitment and
//    nullifier sets, double-spend refusal by nullifier uniqueness, bounded
//    fixed-size rows only (the chain holds law + tree + commitments +
//    nullifiers, never bulk history).
//  - THE ON-CHAIN INCREMENTAL MERKLE TREE (founder order 2026-09-05):
//    deposit APPENDS the leaf and computes the root itself — 20 Poseidon
//    hashes in-contract (poseidon2.hpp, bit-exact with circomlib by a
//    68/68 vector gate). There is NO root setter anywhere in this
//    contract: the law row's root only ever ADVANCES via deposit, making
//    root-rollback structurally impossible (z2.1's list, closed by
//    construction). The witness-side tree (tree.js) is a VIEW of the same
//    definition — every root it computes must equal the chain's.
//  - THE PAYMENT STATEMENT (payment.circom, one PLONK proof per spend):
//    MEMBERSHIP of the spent note in the contract-computed tree; NULLIFIER
//    = Poseidon(secret, leaf_index) (index derived in-circuit — one
//    spendable nullifier per leaf); OUTPUT note commitment public;
//    CONSERVATION amountIn = amountOut + fee with amounts PRIVATE and the
//    FEE PUBLIC (the meter's leg); RANGE CHECKS — every amount decomposed
//    to 64 bits in-circuit, so conservation cannot wrap mod p (an
//    overflow spend has no satisfying witness).
//  - CRYPTO-AGILITY LAW: ALG_COMMIT = 2 = poseidon-bn254-v1 (tree leaves),
//    ALG_PROOF = 2 = plonk-bn254-v1 (nine-phase verifier, plonk_verify.hpp;
//    vk: payment.circom, pot14 one-honest-seat ceremony, rehearsal-labeled
//    until a witnessed multi-party sealing is ruled for mainnet).
//  - Deposits record amounts openly (the on-ramp); payment-created notes
//    record amount 0 = PRIVATE (the real value lives only in the note).
//  - The VIEW-KEY TAG: unchanged (owner-held off-chain disclosure, Zano's
//    auditable-wallet pattern).
//  - BLS12-381 remains the FUTURE lane; algorithm ids make the swap a table
//    row, not a rewrite.
//  - THE X402 ANCHORING SUBSYSTEM (M9, from X402-SORT-2026-09-01.md —
//    pinout's two-tier shape, lifted as mechanism not code):
//    TIER 1 · every settlement (transfer, withdraw) folds a CHECKPOINT
//    inline — head' = keccak(head ‖ keccak(seq ‖ nullifier ‖ fee ‖
//    feeAsset)) — cheap (native intrinsic), unconditional, atomic with the
//    settlement. Nothing ever waits on an anchor: no action reads the
//    anchors table but anchor() itself, and there is no deferred path
//    anywhere in this contract (the refund-shaped leg — withdraw — executes
//    fully in its own action).
//    TIER 2 · anchor() commits ONE bounded row per anchor: (seq, head) —
//    the checkpoint CHAIN HEAD, never a list of receipts (pinout
//    ledger.mjs). Permissionless: any stranger may call it; the two
//    justified paths are the entire anti-spam story — batch path (pend ≥
//    anchor_batch: amortized, one row per N settlements) or priority path
//    (accrued revenue ≥ anchor_cost — pinout doSettle: "priority only when
//    revenue ≥ anchor cost"). An empty or premature anchor is REFUSED.
//    ADMIT-BEFORE-QUOTE · admit(expected_fee, expected_asset) — the
//    seller-solvency gate in FRONT of the quote (pinout guards.mjs:
//    sellerSolvency → z2.1): refuses new metered business the seller cannot
//    afford to anchor. Pure check, no state — the transaction trace is the
//    receipt. A seller that quoted while admit() would throw is provably
//    insolvent-at-quote from the public record alone (the bonded-dispute
//    lane is the named punishment path).
//    METER-REVENUE LEG: the checkpoint's `accrued` counts only transfer
//    fees in the law's anchor_asset — a withdraw's fee leg is VALUE-OUT,
//    not a meter cut (M5 law), so withdrawals checkpoint but never accrue.
//  - THE BONDED DISPUTE (M10, the third z2.1 raid row — Tally
//    anchor.ts:postDispute: "a dispute costs a bond — spam-resistant by
//    fee, not by moderator"): a challenger posts a bond (postbond — an
//    authed escrow row) and challenges an anchor's (seq, head) inside a
//    block window (law.dispute_window; the CLOCK is the block timestamp
//    via the law's declared cadence — this node's eos-vm rejects the
//    get_block_num host import, receipted in §m10). The CONTRACT adjudicates by
//    RECOMPUTATION, on-chain, alone: it folds the checkpoint chain from
//    the nullifiers table up to the anchor's seq (the same link formula
//    as checkpoint_step) and compares. A VALID challenge (recomputed ≠
//    committed) SLASHES the anchorer's accrued revenue to the challenger
//    (payouts row; bond returns — the challenger was right); an INVALID
//    one FORFEITS the bond to the anchorer (accrued += bond). One
//    dispute per anchor, ever (the disputes row settles it); window
//    closed = final; NO ADMIN anywhere — the only auth is the
//    challenger's own on postbond/challenge. Recomputation is O(n)
//    keccaks over the nullifiers ≤ seq (rehearsal scale; labeled bound).

#include <eosio/eosio.hpp>
#include <eosio/crypto_ext.hpp>
#include <eosio/system.hpp>
#include "plonk_verify.hpp"
#include "poseidon2.hpp"
#include "tree_zeros.hpp"
#include <vector>
#include <algorithm>
using namespace eosio;

class [[eosio::contract("note")]] note : public contract {
public:
   using contract::contract;

   // ── algorithm ids (crypto-agility law; one byte in each row) ──
   static constexpr uint8_t ALG_COMMIT_KECCAK256_V1 = 1;   // retired (M3 deposit hash)
   static constexpr uint8_t ALG_COMMIT_POSEIDON_V1  = 2;   // poseidon-bn254-v1 (tree leaves)
   static constexpr uint8_t ALG_PROOF_PLONK_V1      = 2;   // plonk-bn254-v1 payment proof
   static constexpr uint8_t ALG_CKPT_KECCAK256_V1   = 1;   // keccak256-v1 checkpoint chain (M9)

   // ── the LAW row (governed-mutable, exactly one) ──
   struct [[eosio::table("law"), eosio::contract("note")]] law_row {
      uint64_t id;                 // 0 forever
      uint8_t  alg_commit;         // commitment algorithm id
      uint8_t  alg_proof;          // spend-proof algorithm id
      uint64_t max_notes;          // BOUNDED: commitments table hard cap (≤ 2^20: tree depth)
      uint64_t max_nullifiers;     // BOUNDED: nullifier table hard cap
      uint64_t anchor_cost;        // M9: cost of one anchor, in anchor_asset fee units
      uint64_t anchor_batch;       // M9: checkpoints per amortized anchor (the batching bound)
      uint64_t anchor_asset;       // M9: the asset anchor solvency is denominated in
      uint64_t max_anchors;        // M9: BOUNDED: anchors table hard cap
      uint64_t dispute_bond;       // M10: the bond a challenge escrows (anchor_asset units)
      uint64_t dispute_window;     // M10: challenge window, in BLOCKS from the anchor's block
      uint64_t block_ms;           // M10: the chain's declared block cadence (ms) — the
                                   // window's BLOCK count converts to the timestamp clock
                                   // (this node's eos-vm rejects the get_block_num host
                                   // import; the timestamp is the clock it does give)
      checksum256 root;            // the merkle root the CONTRACT computes (no setter exists)
      uint64_t primary_key()const { return id; }
   };
   using law_index = eosio::multi_index<"law"_n, law_row>;

   // ── the CHECKPOINT chain head (singleton; tier 1 — folded inline by
   // every settlement; the anchor commits to THIS, not to receipts) ──
   struct [[eosio::table("checkpoint"), eosio::contract("note")]] ckpt_row {
      uint64_t    id;              // 0 forever
      uint64_t    seq;             // settlements checkpointed (the chain length)
      checksum256 head;            // the running hash — genesis = 32 zero bytes
      uint64_t    accrued;         // meter fees accrued in anchor_asset since the last anchor
      uint64_t    pend;            // checkpoints since the last anchor (the open batch)
      uint8_t     alg;             // checkpoint-chain algorithm id (crypto-agility law)
      uint64_t primary_key()const { return id; }
   };
   using ckpt_index = eosio::multi_index<"checkpoint"_n, ckpt_row>;

   // ── the ANCHORS (tier 2 — bounded, append-only; one row commits ONE
   // checkpoint chain head; there is no receipt list anywhere in this row) ──
   struct [[eosio::table("anchors"), eosio::contract("note")]] anchor_row {
      uint64_t    id;              // anchor ordinal (1, 2, …)
      uint64_t    seq;             // the checkpoint head it commits (checkpoint.seq at commit)
      checksum256 head;            // the checkpoint chain head at commit
      uint64_t    at;              // block time — ALSO the dispute window's clock (M10)
      uint8_t     alg;             // the checkpoint-chain algorithm id it was built with
      uint64_t primary_key()const { return id; }
   };
   using anchor_index = eosio::multi_index<"anchors"_n, anchor_row>;

   // ── the BOND ESCROW (M10 — a challenger's posted bond; rehearsal
   // counter, no token rails: the row IS the custody, labeled in the spec).
   // BOUNDED transitively: only challenge-authed parties post, disputes are
   // one-per-anchor, so live escrow rows ≤ anchors + challengers ≤ small. ──
   struct [[eosio::table("escrow"), eosio::contract("note")]] escrow_row {
      name     owner;
      uint64_t amount;             // in anchor_asset fee units
      uint64_t primary_key()const { return owner.value; }
   };
   using escrow_index = eosio::multi_index<"escrow"_n, escrow_row>;

   // ── the DISPUTES (M10 — append-only, one per anchor; the row SETTLES
   // the anchor forever; bounded by max_anchors transitively) ──
   struct [[eosio::table("disputes"), eosio::contract("note")]] dispute_row {
      uint64_t anchor_id;          // the anchor challenged
      name     challenger;
      bool     valid;              // true = recomputed ≠ committed (slash); false = bond forfeit
      uint64_t slashed;            // the accrued amount transferred when valid
      uint64_t at;                 // block time
      uint64_t primary_key()const { return anchor_id; }
   };
   using dispute_index = eosio::multi_index<"disputes"_n, dispute_row>;

   // ── the PAYOUTS (M10 — the challenger's claim when a slash lands;
   // settlement of the claim is the meter's off-chain lane, the row is the
   // receipt; bounded by distinct challengers ≤ anchors) ──
   struct [[eosio::table("payouts"), eosio::contract("note")]] payout_row {
      name     owner;
      uint64_t amount;             // bond + slashed, in anchor_asset fee units
      uint64_t primary_key()const { return owner.value; }
   };
   using payout_index = eosio::multi_index<"payouts"_n, payout_row>;

   // ── the incremental merkle tree (singleton; advanced by deposit only) ──
   // (CDT table reflection cannot carry array members — 20 named fields)
   struct [[eosio::table("tree"), eosio::contract("note")]] tree_row {
      uint64_t id;                 // 0 forever
      uint64_t next_index;         // the next leaf slot (≤ 2^20)
      checksum256 f0;
      checksum256 f1;
      checksum256 f2;
      checksum256 f3;
      checksum256 f4;
      checksum256 f5;
      checksum256 f6;
      checksum256 f7;
      checksum256 f8;
      checksum256 f9;
      checksum256 f10;
      checksum256 f11;
      checksum256 f12;
      checksum256 f13;
      checksum256 f14;
      checksum256 f15;
      checksum256 f16;
      checksum256 f17;
      checksum256 f18;
      checksum256 f19;
      uint64_t primary_key()const { return id; }
   };
   using tree_index = eosio::multi_index<"tree"_n, tree_row>;
   static const checksum256& tf( const tree_row& r, int i ) {
      switch ( i ) {
         case 0: return r.f0;
         case 1: return r.f1;
         case 2: return r.f2;
         case 3: return r.f3;
         case 4: return r.f4;
         case 5: return r.f5;
         case 6: return r.f6;
         case 7: return r.f7;
         case 8: return r.f8;
         case 9: return r.f9;
         case 10: return r.f10;
         case 11: return r.f11;
         case 12: return r.f12;
         case 13: return r.f13;
         case 14: return r.f14;
         case 15: return r.f15;
         case 16: return r.f16;
         case 17: return r.f17;
         case 18: return r.f18;
         case 19: return r.f19;
      }
      return r.f0;
   }

   // ── commitment set (bounded, fixed-size rows) ──
   struct [[eosio::table("commitments"), eosio::contract("note")]] commitment_row {
      checksum256 c;               // the commitment (algorithm per law row)
      uint32_t    viewtag;         // first 4 bytes of H(viewpub ‖ c) — wallet scan
      uint8_t     alg;             // commitment algorithm id
      uint64_t    deposited;       // block time of deposit (audit floor, not history)
      uint64_t    amount;          // deposit: the open on-ramp amount · payment note: 0 = PRIVATE (in-circuit)
      uint64_t    asset;          // deposit: the open on-ramp asset · payment note: 0 = PRIVATE (in-circuit)
      uint64_t    primary_key()const { return c.data()[0] >> 32 | (uint64_t)(c.data()[1] & 0xffffffff) << 0; }
   };
   using commitment_index = eosio::multi_index<"commitments"_n, commitment_row>;

   // ── nullifier set (bounded; uniqueness = double-spend refusal) ──
   // M9: each row carries its checkpoint seq + the fee legs, so the
   // checkpoint chain is RECOMPUTABLE from this table alone (sorted by
   // seq) — the audit needs no history plugin, the chain's own tables
   // suffice.
   struct [[eosio::table("nullifiers"), eosio::contract("note")]] nullifier_row {
      checksum256 n;
      uint8_t     alg;             // proof algorithm id that justified the spend
      uint64_t    spent_at;
      uint64_t    seq;             // M9: the checkpoint this settlement folded
      uint64_t    fee;             // M9: the settlement's public fee leg
      uint64_t    fee_asset;       // M9: the settlement's fee asset
      uint64_t primary_key()const { return n.data()[0] >> 32 | (uint64_t)(n.data()[1] & 0xffffffff) << 0; }
   };
   using nullifier_index = eosio::multi_index<"nullifiers"_n, nullifier_row>;

   // ── init / law ──
   [[eosio::action]] void init( uint64_t max_notes, uint64_t max_nulls,
                                uint64_t anchor_cost, uint64_t anchor_batch,
                                uint64_t anchor_asset, uint64_t max_anchors,
                                uint64_t dispute_bond, uint64_t dispute_window, uint64_t block_ms ) {
      require_auth( get_self() );
      eosio::check( max_notes <= (1ull << 20), "max_notes exceeds the tree depth bound (2^20)" );
      eosio::check( anchor_cost > 0, "anchor_cost must be > 0 — an empty anchor must be impossible" );
      eosio::check( anchor_batch > 0, "anchor_batch must be > 0" );
      eosio::check( max_anchors > 0, "max_anchors must be > 0" );
      eosio::check( dispute_bond > 0, "dispute_bond must be > 0 — a free dispute is spammable" );
      eosio::check( dispute_window > 0, "dispute_window must be > 0" );
      eosio::check( block_ms > 0, "block_ms must be > 0 (the window needs a clock)" );
      law_index law( get_self(), get_self().value );
      eosio::check( law.begin() == law.end(), "law already set" );
      law.emplace( get_self(), [&]( auto& r ) {
         r.id = 0; r.alg_commit = ALG_COMMIT_POSEIDON_V1; r.alg_proof = ALG_PROOF_PLONK_V1;
         r.max_notes = max_notes; r.max_nullifiers = max_nulls;
         r.anchor_cost = anchor_cost; r.anchor_batch = anchor_batch;
         r.anchor_asset = anchor_asset; r.max_anchors = max_anchors;
         r.dispute_bond = dispute_bond; r.dispute_window = dispute_window; r.block_ms = block_ms;
         unsigned char e[32]; memcpy( e, ZERO_[20], 32 ); t256( e );
         memcpy( (void*)r.root.data(), e, 32 );            // T(empty root)
      });
      ckpt_index ck( get_self(), get_self().value );
      eosio::check( ck.begin() == ck.end(), "checkpoint already set" );
      ck.emplace( get_self(), [&]( auto& r ) {
         r.id = 0; r.seq = 0;
         unsigned char z[32]; memset( z, 0, 32 ); t256( z );   // genesis head = 32 zero bytes (stored pre-transformed)
         memcpy( (void*)r.head.data(), z, 32 );
         r.accrued = 0; r.pend = 0; r.alg = ALG_CKPT_KECCAK256_V1;
      });
      tree_index tr( get_self(), get_self().value );
      eosio::check( tr.begin() == tr.end(), "tree already set" );
      tr.emplace( get_self(), [&]( auto& r ) {
         r.id = 0; r.next_index = 0;
         unsigned char e[32];
         checksum256* fs[20] = { &r.f0, &r.f1, &r.f2, &r.f3, &r.f4, &r.f5, &r.f6, &r.f7,
                                 &r.f8, &r.f9, &r.f10, &r.f11, &r.f12, &r.f13, &r.f14, &r.f15,
                                 &r.f16, &r.f17, &r.f18, &r.f19 };
         for ( int i = 0; i < 20; ++i ) { memcpy( e, ZERO_[i], 32 ); t256( e ); memcpy( (void*)fs[i]->data(), e, 32 ); }
      });
   }

   // ── deposit: public value in, Poseidon commitment leaf out ──
   // commitment = Poseidon(secret, amount) computed by the depositor
   // (off-chain); the chain stores c + viewtag + algorithm id, the amount
   // recorded OPENLY (the on-ramp), AND appends c to the incremental merkle
   // tree ITSELF — the root in the law row is contract-computed (there is
   // no setter; root-rollback is structurally impossible).
   [[eosio::action]] void deposit( const checksum256& c, uint32_t viewtag, uint64_t amount, uint64_t asset ) {
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      commitment_index cs( get_self(), get_self().value );
      eosio::check( (uint64_t)std::distance(cs.begin(), cs.end()) < lr.max_notes, "commitment set FULL (bounded)" );
      eosio::check( cs.find( pk_of(c) ) == cs.end(), "commitment exists" );
      cs.emplace( get_self(), [&]( auto& r ) {
         r.c = c; r.viewtag = viewtag; r.alg = lr.alg_commit;
         r.deposited = current_time_point().sec_since_epoch(); r.amount = amount;
         r.asset = asset;
      });
      tree_insert( c );
   }

   // ── private payment: proof + nullifier in, new note out ──
   // payment_gate() verifies the nine-phase PLONK proof over publics
   // (root ‖ nullifier ‖ out_commitment ‖ fee): MEMBERSHIP of the spent
   // note in the law row's tree, CONSERVATION amountIn = amountOut + fee
   // with amounts hidden, the FEE public (the meter's leg). The new note's
   // amount is PRIVATE — the row stores 0, labeled. The nullifier hit
   // refuses the double-spend.
   [[eosio::action]] void transfer( const checksum256& nullifier, const checksum256& to_commitment,
                                    uint32_t to_viewtag, uint64_t fee, uint64_t fee_asset,
                                    const std::vector<uint8_t>& proof ) {
      payment_gate( nullifier, to_commitment, fee, fee_asset, proof, /*withdraw_leg=*/false );
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      commitment_index cs( get_self(), get_self().value );
      eosio::check( (uint64_t)std::distance(cs.begin(), cs.end()) < lr.max_notes, "commitment set FULL (bounded)" );
      eosio::check( cs.find( pk_of(to_commitment) ) == cs.end(), "target commitment exists" );
      cs.emplace( get_self(), [&]( auto& r ) {
         r.c = to_commitment; r.viewtag = to_viewtag; r.alg = lr.alg_commit;
         r.deposited = current_time_point().sec_since_epoch();
         r.amount = 0;   // PRIVATE since M5: conservation is proven in-circuit
         r.asset = 0;    // PRIVATE since M7: the asset binds inside the commitment
      });
      tree_insert( to_commitment );   // the new note becomes a SPENDABLE leaf
   }

   // ── withdraw: proof + nullifier in, public value out ──
   // the SAME payment proof with the value riding the public fee leg
   // (amountOut = 0 in the circuit); the out-commitment is not stored.
   // Rehearsed settlement: no token rails on the rehearsal chain — the
   // row-level truth (nullifier + fee = value out + recipient) is the receipt.
   // M9: the withdraw checkpoints (it is a settlement) but its fee leg is
   // VALUE-OUT, not a meter cut — it never accrues anchor revenue.
   [[eosio::action]] void withdraw( const checksum256& nullifier, name recipient, uint64_t fee, uint64_t fee_asset,
                                    const checksum256& note_commitment,
                                    const std::vector<uint8_t>& proof ) {
      payment_gate( nullifier, note_commitment, fee, fee_asset, proof, /*withdraw_leg=*/true );
      require_auth( get_self() );
   }

   // ── TIER 2 · the anchor (M9) — one bounded row committing the checkpoint
   // chain head (seq + head), NEVER a list of receipts (pinout ledger.mjs:
   // the anchor binds to the checkpoint head). PERMISSIONLESS — any stranger
   // may call it (the buyer can anchor what they paid for); the two
   // justified paths are the entire anti-spam story:
   //    batch path : pend >= anchor_batch   (amortized — one row per N
   //                                        settlements; the sweep always lands)
   //    priority   : accrued >= anchor_cost (pinout doSettle: "priority only
   //                                        when revenue ≥ anchor cost")
   // An anchor with nothing new to commit, or one the accrued revenue
   // cannot justify, is REFUSED. The anchor cost is deducted from accrued
   // revenue when covered; on the batch path a deficit is forgiven (no
   // token rails on the rehearsal chain — the row-level truth is the
   // receipt, labeled in SPEC-PRIVACY-1 §m9).
   [[eosio::action]] void anchor() {
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      ckpt_index ck( get_self(), get_self().value );
      auto citr = ck.find( 0 );
      eosio::check( citr != ck.end(), "checkpoint not initialized" );
      eosio::check( citr->pend >= 1, "anchor REFUSED — no checkpoints since the last anchor" );
      eosio::check( citr->pend >= lr.anchor_batch || citr->accrued >= lr.anchor_cost,
                    "anchor REFUSED — batch not full and revenue below anchor cost (deferred)" );
      anchor_index as( get_self(), get_self().value );
      eosio::check( (uint64_t)std::distance(as.begin(), as.end()) < lr.max_anchors, "anchors FULL (bounded)" );
      uint64_t nid = as.available_primary_key();
      if ( nid == 0 ) nid = 1;    // empty table → start the ordinals at 1
      as.emplace( get_self(), [&]( auto& r ) {
         r.id = nid; r.seq = citr->seq; r.head = citr->head;
         r.at = current_time_point().sec_since_epoch();   // the dispute window's clock (M10)
         r.alg = citr->alg;
      });
      ck.modify( citr, get_self(), [&]( auto& r ) {
         r.accrued = ( r.accrued >= lr.anchor_cost ) ? r.accrued - lr.anchor_cost : 0;
         r.pend = 0;
      });
   }

   // ── ADMIT-BEFORE-QUOTE (M9) — the seller-solvency gate IN FRONT of the
   // quote (pinout guards.mjs:sellerSolvency → z2.1): refuse new metered
   // business the seller cannot afford to anchor. The seller's standing
   // obligation after the quoted session = ONE anchor covering the backlog
   // plus this session; it discharges either by revenue (projected accrued ≥
   // anchor_cost) or by count (the session completes the batch — the batch
   // path then fires regardless of revenue). PURE: no state written; the
   // transaction trace IS the receipt. The quote path (Lane M) runs this
   // on-chain before quoting; a seller that quoted while admit() would
   // throw is PROVABLY insolvent-at-quote from the public record alone
   // (bonded dispute = the named punishment lane).
   [[eosio::action]] void admit( uint64_t expected_fee, uint64_t expected_asset ) {
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      ckpt_index ck( get_self(), get_self().value );
      auto cr = ck.get( 0, "checkpoint not initialized" );
      uint64_t projected = cr.accrued + ( expected_asset == lr.anchor_asset ? expected_fee : 0 );
      eosio::check( projected >= lr.anchor_cost || cr.pend + 1 >= lr.anchor_batch,
                    "ADMIT REFUSED — seller cannot afford its own anchor (revenue < cost and the session does not complete a batch)" );
   }

   // ── BONDED DISPUTE (M10) — postbond: the challenger escrows bond
   // material (authed by the challenger only — no admin anywhere). The
   // escrow row is the custody: on the rehearsal chain there are no token
   // rails, so the row IS the bond (labeled; the meter's off-chain lane
   // settles real value against it).
   [[eosio::action]] void postbond( name owner, uint64_t amount ) {
      require_auth( owner );
      eosio::check( amount > 0, "bond amount must be > 0" );
      escrow_index es( get_self(), get_self().value );
      auto eitr = es.find( owner.value );
      if ( eitr == es.end() ) {
         es.emplace( owner, [&]( auto& r ) { r.owner = owner; r.amount = amount; } );
      } else {
         es.modify( eitr, owner, [&]( auto& r ) { r.amount += amount; } );
      }
   }

   // ── BONDED DISPUTE (M10) — challenge: bond at stake against an
   // anchor's (seq, head), adjudicated ON-CHAIN BY RECOMPUTATION ALONE
   // (no admin, no moderator — spam-resistant by fee). The contract folds
   // the checkpoint chain from the nullifiers table up to the anchor's
   // seq (the SAME link formula as checkpoint_step) and compares:
   //    recomputed ≠ committed  → VALID: the anchorer's accrued revenue
   //                              is SLASHED to the challenger (payouts
   //                              row += bond + accrued; accrued = 0);
   //    recomputed == committed → INVALID: the bond is FORFEITED to the
   //                              anchorer (accrued += bond).
   // ONE dispute per anchor, ever (the disputes row settles it); the
   // window is law.dispute_window blocks from the anchor's block.
   [[eosio::action]] void challenge( uint64_t anchor_id, name challenger ) {
      require_auth( challenger );
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      anchor_index as( get_self(), get_self().value );
      auto aitr = as.find( anchor_id );
      eosio::check( aitr != as.end(), "no such anchor" );
      dispute_index ds( get_self(), get_self().value );
      eosio::check( ds.find( anchor_id ) == ds.end(),
                    "anchor already disputed — settled forever (one dispute per anchor)" );
      // the window: law.dispute_window BLOCKS from the anchor's block,
      // measured on the timestamp clock this chain actually provides (the
      // block count converts by the law's declared cadence — this node's
      // eos-vm rejects the get_block_num host import; receipted in §m10)
      uint64_t now_sec = current_time_point().sec_since_epoch();
      uint64_t window_sec = ( lr.dispute_window * lr.block_ms + 999 ) / 1000;
      eosio::check( now_sec <= aitr->at + window_sec,
                    "challenge REFUSED — dispute window closed (the anchor is final)" );
      escrow_index es( get_self(), get_self().value );
      auto eitr = es.find( challenger.value );
      eosio::check( eitr != es.end() && eitr->amount >= lr.dispute_bond,
                    "challenge REFUSED — no bond posted (postbond first)" );
      es.modify( eitr, challenger, [&]( auto& r ) { r.amount -= lr.dispute_bond; } );
      // ── adjudication: recompute the chain head at the anchor's seq ──
      unsigned char recomputed[32];
      fold_chain_at( aitr->seq, recomputed );
      const auto committed = aitr->head.extract_as_byte_array();
      bool valid = memcmp( recomputed, committed.data(), 32 ) != 0;
      ckpt_index ck( get_self(), get_self().value );
      auto citr = ck.find( 0 );
      eosio::check( citr != ck.end(), "checkpoint not initialized" );
      uint64_t slashed = 0;
      if ( valid ) {
         slashed = citr->accrued;
         payout_index ps( get_self(), get_self().value );
         auto pitr = ps.find( challenger.value );
         if ( pitr == ps.end() ) {
            ps.emplace( challenger, [&]( auto& r ) { r.owner = challenger; r.amount = lr.dispute_bond + slashed; } );
         } else {
            ps.modify( pitr, challenger, [&]( auto& r ) { r.amount += lr.dispute_bond + slashed; } );
         }
         ck.modify( citr, challenger, [&]( auto& r ) { r.accrued = 0; } );
      } else {
         // the bond is forfeited to the anchorer (joins accrued revenue)
         ck.modify( citr, challenger, [&]( auto& r ) { r.accrued += lr.dispute_bond; } );
      }
      ds.emplace( challenger, [&]( auto& r ) {
         r.anchor_id = anchor_id; r.challenger = challenger; r.valid = valid;
         r.slashed = slashed; r.at = current_time_point().sec_since_epoch();
      });
   }

#ifdef M10_PROBE
   // ── ATTACK FIXTURE (probe builds ONLY — compiled with -DM10_PROBE; the
   // production build has NO such action, and the shipped wasm never
   // contains it). Simulates a LYING ANCHORER: appends an anchor row with
   // an arbitrary claimed head — the exact state the bonded dispute exists
   // to punish. Same pattern as treedbg.cpp: probe sources live in-tree,
   // the acceptance labels which build exercised what.
   [[eosio::action]] void badanchor( uint64_t seq, const checksum256& false_head ) {
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      anchor_index as( get_self(), get_self().value );
      eosio::check( (uint64_t)std::distance(as.begin(), as.end()) < lr.max_anchors, "anchors FULL (bounded)" );
      uint64_t nid = as.available_primary_key();
      if ( nid == 0 ) nid = 1;
      as.emplace( get_self(), [&]( auto& r ) {
         r.id = nid; r.seq = seq; r.head = false_head;
         r.at = current_time_point().sec_since_epoch();
         r.alg = ALG_CKPT_KECCAK256_V1;
      });
   }
#endif

private:
   // ── the on-chain incremental merkle insert (Tornado's algorithm over the
   // C++ Poseidon; 20 hashes per deposit) ──
   // filled[i] = the last complete LEFT subtree at level i; the root only
   // ever ADVANCES here — no setter exists anywhere in the contract.
   __attribute__( ( noinline ) )
   void tree_insert( const checksum256& leaf ) {
      tree_index tr( get_self(), get_self().value );
      auto titr = tr.find( 0 );
      eosio::check( titr != tr.end(), "tree not initialized" );
      eosio::check( titr->next_index < (1ull << 20), "tree FULL (depth-20 bounded-rows law)" );
      // 12KB of Montgomery constants is too big for the WASM stack — a
      // fixed-address static scratch, fully re-initialized on every call
      // (deterministic: no state survives the action)
      static poseidon2_ctx pc_scratch;
      poseidon2_ctx* pc = &pc_scratch;
      poseidon2_ctx_init( pc, PL_Q );
      u256 cur, z, h;
      u256 filled[20];
      for ( int i = 0; i < 20; ++i ) {
         const auto fb = tf( *titr, i ).extract_as_byte_array();
         f256_from_be( filled[i], fb.data() );
      }
      const auto lb = leaf.extract_as_byte_array();
      f256_from_be( cur, lb.data() );
      uint64_t idx = titr->next_index;
      for ( int i = 0; i < 20; ++i ) {
         if ( ((idx >> i) & 1ull) == 0 ) {
            // going LEFT: sibling is the level's zero hash; filled[i] ← cur
            f256_from_be( z, ZERO_[i] );
            f256_copy( filled[i], cur );
            poseidon2( pc, cur, z, cur );
         } else {
            // going RIGHT: sibling is filled[i] — and filled[i] does NOT
            // change (Tornado's law, found live at insert #4: updating it
            // here poisons the next right-turn with an incomplete subtree —
            // root(4+) silently diverged from the canonical fold while
            // roots 1..3 matched; tree.js was RIGHT all along)
            poseidon2( pc, filled[i], cur, h );
            f256_copy( cur, h );
         }
      }
      unsigned char be[32];
      tr.modify( titr, get_self(), [&]( auto& row ) {
         row.next_index += 1;
         checksum256* fs[20] = { &row.f0, &row.f1, &row.f2, &row.f3, &row.f4, &row.f5, &row.f6, &row.f7,
                                 &row.f8, &row.f9, &row.f10, &row.f11, &row.f12, &row.f13, &row.f14, &row.f15,
                                 &row.f16, &row.f17, &row.f18, &row.f19 };
         for ( int i = 0; i < 20; ++i ) {
            f256_to_be( be, filled[i] ); t256( be );
            memcpy( (void*)fs[i]->data(), be, 32 );
         }
      });
      law_index law( get_self(), get_self().value );
      auto litr = law.find( 0 );
      eosio::check( litr != law.end(), "law not initialized" );
      f256_to_be( be, cur ); t256( be );
      law.modify( litr, get_self(), [&]( auto& r ) { memcpy( (void*)r.root.data(), be, 32 ); } );
   }

   // T(b): reverse the 32 bytes, then swap the 16-byte halves (an
   // involution). CDT checksum256 extract_as_byte_array() returns T(memory
   // bytes) — action params pass through decode+extract unchanged (T∘T),
   // but values WRITTEN by memcpy must be stored pre-transformed so a later
   // extract returns the true bytes (the M1 gotcha, mapped exactly in M6).
   static void t256( unsigned char b[32] ) {
      unsigned char t[32];
      for ( int i = 0; i < 32; ++i ) t[i] = b[31 - i];
      for ( int i = 0; i < 16; ++i ) { unsigned char x = t[i]; t[i] = t[16 + i]; t[16 + i] = x; }
      memcpy( b, t, 32 );
   }

   static uint64_t pk_of( const checksum256& h ) {
      auto d = h.data();
      return ( (uint64_t)d[0] << 32 ) | (uint64_t)d[1];
   }

   // a uint64 as a 32-byte BE word, shifts ≤ 56 only (the M7 UB law above)
   static void u64_to_be32_word( unsigned char* dst, uint64_t v ) {
      memset( dst, 0, 24 );
      for ( int i = 0; i < 8; ++i ) dst[24 + i] = (unsigned char)( ( v >> (8 * (7 - i)) ) & 0xff );
   }

   // keccak bridge: plonk_verify takes a plain function pointer
   static void pl_kec_eosio( const unsigned char* in, unsigned len, unsigned char out[32] ) {
      auto h = keccak( (const char*)in, len );
      const auto a = h.extract_as_byte_array();
      memcpy( out, a.data(), 32 );
   }

   // The payment gate (M5): full nine-phase PLONK verification of the
   // caller's proof over publics (law.root ‖ nullifier ‖ out_commitment ‖
   // fee-as-word), then the nullifier insert — bounded + unique = double-
   // spend refusal. vk: the payment.circom pot14 ceremony
   // (vk_constants.hpp provenance header).
   // noinline: keeps the verifier one shared body across both actions
   // (measured in M4: per-caller inlining billed inconsistently).
   // M9: every settlement then folds its CHECKPOINT inline (tier 1) — the
   // settlement and its checkpoint land in ONE action; nothing waits.
   __attribute__( ( noinline ) )
   void payment_gate( const checksum256& nullifier, const checksum256& out_commitment,
                      uint64_t fee, uint64_t fee_asset, const std::vector<uint8_t>& proof,
                      bool withdraw_leg ) {
      eosio::check( proof.size() == 24 * 32, "proof: expected 24 words (768 bytes)" );
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      unsigned char pubs[5 * 32];
      const auto rt = lr.root.extract_as_byte_array();
      const auto n  = nullifier.extract_as_byte_array();
      const auto c  = out_commitment.extract_as_byte_array();
      memcpy( pubs,       rt.data(), 32 );              // [0] root — from the law row
      memcpy( pubs + 32,  n.data(),  32 );              // [1] nullifier
      memcpy( pubs + 64,  c.data(),  32 );              // [2] out commitment
      // [3] fee, [4] feeAsset as BE words. THE M7 LAW: shifting a uint64 by
      // ≥64 is UB — wasm's i64.shr_u takes the shift MOD 64, which once
      // compiled a repeated-byte fee word that silently desynced the whole
      // transcript (found by dumping the contract's assembled publics and
      // word-diffing against the proof; M6's build had lucked into correct
      // codegen). Write the 8 value bytes with shifts ≤ 56 and zero-fill.
      u64_to_be32_word( pubs + 96, fee );
      u64_to_be32_word( pubs + 128, fee_asset );
      int32_t r = plonk_verify( pl_kec_eosio, proof.data(), pubs );
      eosio::check( r == 0, "payment proof REJECTED — plonk pairing false" );
      // nullifier insert (bounded + unique = double-spend refusal)
      ckpt_index ck( get_self(), get_self().value );
      auto cr = ck.get( 0, "checkpoint not initialized" );
      nullifier_index ns( get_self(), get_self().value );
      eosio::check( (uint64_t)std::distance(ns.begin(), ns.end()) < lr.max_nullifiers, "nullifier set FULL (bounded)" );
      eosio::check( ns.find( pk_of(nullifier) ) == ns.end(), "DOUBLE-SPEND — nullifier already spent" );
      ns.emplace( get_self(), [&]( auto& row ) {
         row.n = nullifier; row.alg = lr.alg_proof;
         row.spent_at = current_time_point().sec_since_epoch();
         row.seq = cr.seq + 1;       // the checkpoint this settlement folds (M9)
         row.fee = fee; row.fee_asset = fee_asset;
      });
      checkpoint_step( nullifier, fee, fee_asset, withdraw_leg );
   }

   // ── THE ON-CHAIN RECOMPUTATION (M10) — fold the checkpoint chain from
   // the nullifiers table up to `upto_seq`, using the SAME link formula
   // as checkpoint_step (link = keccak(seq ‖ nullifier ‖ fee ‖ feeAsset);
   // head' = keccak(head ‖ link); genesis = 32 zero bytes). Returns the
   // TRUE fold bytes (no storage, so no T-compensation). O(n) keccacs
   // over the nullifiers ≤ seq — rehearsal scale, the bound is labeled in
   // the spec. The density guard refuses a gappy table (seqs are 1..N by
   // construction — one checkpoint per settlement).
   __attribute__( ( noinline ) )
   void fold_chain_at( uint64_t upto_seq, unsigned char out[32] ) {
      struct link_row { uint64_t seq; checksum256 n; uint64_t fee; uint64_t fee_asset; };
      std::vector<link_row> rows;
      nullifier_index ns( get_self(), get_self().value );
      for ( auto itr = ns.begin(); itr != ns.end(); ++itr )
         if ( itr->seq <= upto_seq ) rows.push_back( { itr->seq, itr->n, itr->fee, itr->fee_asset } );
      eosio::check( rows.size() == upto_seq,
                    "nullifier table not dense — cannot recompute (seqs must be 1..seq)" );
      std::sort( rows.begin(), rows.end(),
                 []( const link_row& a, const link_row& b ) { return a.seq < b.seq; } );
      unsigned char head[32]; memset( head, 0, 32 );   // genesis (true bytes)
      unsigned char a[128], b[64];
      for ( const auto& r : rows ) {
         u64_to_be32_word( a,      r.seq );
         memcpy(     a + 32, r.n.extract_as_byte_array().data(), 32 );
         u64_to_be32_word( a + 64, r.fee );
         u64_to_be32_word( a + 96, r.fee_asset );
         auto lh = keccak( (const char*)a, 128 );
         memcpy( b,      head, 32 );
         memcpy( b + 32, lh.extract_as_byte_array().data(), 32 );
         auto hh = keccak( (const char*)b, 64 );
         memcpy( head, hh.extract_as_byte_array().data(), 32 );
      }
      memcpy( out, head, 32 );
   }

   // ── TIER 1 · the checkpoint fold (M9) — cheap (two native keccaks),
   // unconditional, INLINE with the settlement. link = keccak(seq ‖
   // nullifier ‖ fee ‖ feeAsset); head' = keccak(head ‖ link). The anchor
   // commits to (seq, head) — the CHAIN HEAD, never a receipt list. METER
   // REVENUE: only transfer fees in the law's anchor_asset accrue; a
   // withdraw's fee leg is VALUE-OUT, not a meter cut.
   __attribute__( ( noinline ) )
   void checkpoint_step( const checksum256& nullifier, uint64_t fee, uint64_t fee_asset, bool withdraw_leg ) {
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      ckpt_index ck( get_self(), get_self().value );
      auto citr = ck.find( 0 );
      eosio::check( citr != ck.end(), "checkpoint not initialized" );
      uint64_t seq = citr->seq + 1;
      unsigned char a[128], b[64];
      u64_to_be32_word( a,      seq );
      memcpy(     a + 32, nullifier.extract_as_byte_array().data(), 32 );
      u64_to_be32_word( a + 64, fee );
      u64_to_be32_word( a + 96, fee_asset );
      auto lh = keccak( (const char*)a, 128 );
      memcpy( b,      citr->head.extract_as_byte_array().data(), 32 );
      memcpy( b + 32, lh.extract_as_byte_array().data(), 32 );
      auto hh = keccak( (const char*)b, 64 );
      unsigned char be[32];
      memcpy( be, hh.extract_as_byte_array().data(), 32 ); t256( be );   // T law: stored pre-transformed
      ck.modify( citr, get_self(), [&]( auto& r ) {
         r.seq = seq;
         memcpy( (void*)r.head.data(), be, 32 );
         if ( !withdraw_leg && fee_asset == lr.anchor_asset ) r.accrued += fee;
         r.pend += 1;
      });
   }
};
