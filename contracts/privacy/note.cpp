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

#include <eosio/eosio.hpp>
#include <eosio/crypto_ext.hpp>
#include <eosio/system.hpp>
#include "plonk_verify.hpp"
#include "poseidon2.hpp"
#include "tree_zeros.hpp"
#include <vector>
using namespace eosio;

class [[eosio::contract("note")]] note : public contract {
public:
   using contract::contract;

   // ── algorithm ids (crypto-agility law; one byte in each row) ──
   static constexpr uint8_t ALG_COMMIT_KECCAK256_V1 = 1;   // retired (M3 deposit hash)
   static constexpr uint8_t ALG_COMMIT_POSEIDON_V1  = 2;   // poseidon-bn254-v1 (tree leaves)
   static constexpr uint8_t ALG_PROOF_PLONK_V1      = 2;   // plonk-bn254-v1 payment proof

   // ── the LAW row (governed-mutable, exactly one) ──
   struct [[eosio::table("law"), eosio::contract("note")]] law_row {
      uint64_t id;                 // 0 forever
      uint8_t  alg_commit;         // commitment algorithm id
      uint8_t  alg_proof;          // spend-proof algorithm id
      uint64_t max_notes;          // BOUNDED: commitments table hard cap (≤ 2^20: tree depth)
      uint64_t max_nullifiers;     // BOUNDED: nullifier table hard cap
      checksum256 root;            // the merkle root the CONTRACT computes (no setter exists)
      uint64_t primary_key()const { return id; }
   };
   using law_index = eosio::multi_index<"law"_n, law_row>;

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
   struct [[eosio::table("nullifiers"), eosio::contract("note")]] nullifier_row {
      checksum256 n;
      uint8_t     alg;             // proof algorithm id that justified the spend
      uint64_t    spent_at;
      uint64_t    primary_key()const { return n.data()[0] >> 32 | (uint64_t)(n.data()[1] & 0xffffffff) << 0; }
   };
   using nullifier_index = eosio::multi_index<"nullifiers"_n, nullifier_row>;

   // ── init / law ──
   [[eosio::action]] void init( uint64_t max_notes, uint64_t max_nulls ) {
      require_auth( get_self() );
      eosio::check( max_notes <= (1ull << 20), "max_notes exceeds the tree depth bound (2^20)" );
      law_index law( get_self(), get_self().value );
      eosio::check( law.begin() == law.end(), "law already set" );
      law.emplace( get_self(), [&]( auto& r ) {
         r.id = 0; r.alg_commit = ALG_COMMIT_POSEIDON_V1; r.alg_proof = ALG_PROOF_PLONK_V1;
         r.max_notes = max_notes; r.max_nullifiers = max_nulls;
         unsigned char e[32]; memcpy( e, ZERO_[20], 32 ); t256( e );
         memcpy( (void*)r.root.data(), e, 32 );            // T(empty root)
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
      payment_gate( nullifier, to_commitment, fee, fee_asset, proof );
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
   [[eosio::action]] void withdraw( const checksum256& nullifier, name recipient, uint64_t fee, uint64_t fee_asset,
                                    const checksum256& note_commitment,
                                    const std::vector<uint8_t>& proof ) {
      payment_gate( nullifier, note_commitment, fee, fee_asset, proof );
      require_auth( get_self() );
   }

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
   __attribute__( ( noinline ) )
   void payment_gate( const checksum256& nullifier, const checksum256& out_commitment,
                      uint64_t fee, uint64_t fee_asset, const std::vector<uint8_t>& proof ) {
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
      nullifier_index ns( get_self(), get_self().value );
      eosio::check( (uint64_t)std::distance(ns.begin(), ns.end()) < lr.max_nullifiers, "nullifier set FULL (bounded)" );
      eosio::check( ns.find( pk_of(nullifier) ) == ns.end(), "DOUBLE-SPEND — nullifier already spent" );
      ns.emplace( get_self(), [&]( auto& row ) {
         row.n = nullifier; row.alg = lr.alg_proof;
         row.spent_at = current_time_point().sec_since_epoch();
      });
   }
};
