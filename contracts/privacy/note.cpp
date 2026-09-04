// note.cpp — the private PAYMENT note (SPEC-PRIVACY-1, M5: membership +
// conservation; M4 was the port).
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
//
// WHAT IS REAL HERE (labeled exactly, per the lane law):
//  - The FLOW: deposit -> private payment -> withdraw, with commitment and
//    nullifier sets, double-spend refusal by nullifier uniqueness, bounded
//    fixed-size rows only (the chain holds law + commitments + nullifiers,
//    never bulk history).
//  - THE PAYMENT STATEMENT (payment.circom, one PLONK proof per spend):
//    MEMBERSHIP — the spent note's Poseidon commitment is a leaf of the
//    depth-20 Poseidon merkle tree whose ROOT lives in the law row (the
//    tree is maintained off-chain, owner `setroot` — REHEARSAL-labeled;
//    on-chain derivation is a named future lane); NULLIFIER =
//    Poseidon(secret, tag) bound to the same secret; OUTPUT note commitment
//    public; CONSERVATION amountIn = amountOut + fee with amounts PRIVATE
//    and the FEE PUBLIC — the meter bills the public leg (Lane M). A
//    withdraw is the same proof with the value riding the public fee leg.
//  - CRYPTO-AGILITY LAW: every stored hash/proof carries its algorithm id.
//    ALG_COMMIT = 2 = poseidon-bn254-v1 since M5 (the tree is DEFINED over
//    circuit Poseidon commitments; keccak256-v1 = 1 was the M3 deposit hash,
//    old rows distinguishable). ALG_PROOF = 2 = plonk-bn254-v1 (nine-phase
//    verifier, plonk_verify.hpp; vk: payment.circom, pot14 one-honest-seat
//    ceremony, rehearsal-labeled until a witnessed multi-party sealing is
//    ruled for mainnet — founder order 2026-09-04).
//  - LABELED BOUNDS: amounts are unbounded field elements in-circuit this
//    pass (no range-check circuit — value semantics rest on the openly
//    recorded deposit amounts; the range-check lane is named hardening).
//    Deposits record amounts openly (the on-ramp); payment-created notes
//    record amount 0 = PRIVATE (the real value lives only in the note).
//  - The VIEW-KEY TAG: unchanged (owner-held off-chain disclosure, Zano's
//    auditable-wallet pattern).
//  - BLS12-381 remains the FUTURE lane; algorithm ids make the swap a table
//    row, not a rewrite.

#include <eosio/eosio.hpp>
#include <eosio/crypto_ext.hpp>
#include <eosio/system.hpp>
#include "plonk_verify.hpp"
#include <vector>
using namespace eosio;

class [[eosio::contract("note")]] note : public contract {
public:
   using contract::contract;

   // ── algorithm ids (crypto-agility law; one byte in each row) ──
   static constexpr uint8_t ALG_COMMIT_KECCAK256_V1 = 1;   // retired (M3 deposit hash)
   static constexpr uint8_t ALG_COMMIT_POSEIDON_V1  = 2;   // poseidon-bn254-v1 (tree leaves)
   static constexpr uint8_t ALG_PROOF_PLONK_V1      = 2;   // plonk-bn254-v1 payment proof

   // the depth-20 all-zero Poseidon tree's root (zeros[0]=0,
   // zeros[l]=Poseidon(zeros[l-1], zeros[l-1]); tree.js agrees) — the law
   // row's root BEFORE any deposit
   static constexpr unsigned char EMPTY_ROOT_[32] = {
      33,52,231,106,197,210,26,171,24,108,43,225,221,143,132,238,
      136,10,30,70,234,247,18,249,211,113,182,223,34,25,31,62 };

   // ── the LAW row (governed-mutable, exactly one) ──
   struct [[eosio::table("law"), eosio::contract("note")]] law_row {
      uint64_t id;                 // 0 forever
      uint8_t  alg_commit;         // commitment algorithm id
      uint8_t  alg_proof;          // spend-proof algorithm id
      uint64_t max_notes;          // BOUNDED: commitments table hard cap (≤ 2^20: tree depth)
      uint64_t max_nullifiers;     // BOUNDED: nullifier table hard cap
      checksum256 root;            // the Poseidon merkle root the payment proofs check against
      uint64_t primary_key()const { return id; }
   };
   using law_index = eosio::multi_index<"law"_n, law_row>;

   // ── commitment set (bounded, fixed-size rows) ──
   struct [[eosio::table("commitments"), eosio::contract("note")]] commitment_row {
      checksum256 c;               // the commitment (algorithm per law row)
      uint32_t    viewtag;         // first 4 bytes of H(viewpub ‖ c) — wallet scan
      uint8_t     alg;             // commitment algorithm id
      uint64_t    deposited;       // block time of deposit (audit floor, not history)
      uint64_t    amount;          // deposit: the open on-ramp amount · payment note: 0 = PRIVATE (in-circuit)
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
         memcpy( (void*)r.root.data(), EMPTY_ROOT_, 32 );
      });
   }

   // ── setroot: the owner rolls the merkle root forward after deposits ──
   // REHEARSAL-LABELED: the tree is maintained off-chain (tree.js); the root
   // here is what payment proofs check membership against. On-chain
   // derivation (incremental tree in-contract) is a named future lane.
   [[eosio::action]] void setroot( const checksum256& new_root ) {
      require_auth( get_self() );
      law_index law( get_self(), get_self().value );
      auto itr = law.find( 0 );
      eosio::check( itr != law.end(), "law not initialized" );
      law.modify( itr, get_self(), [&]( auto& r ) { r.root = new_root; } );
   }

   // ── deposit: public value in, Poseidon commitment leaf out ──
   // commitment = Poseidon(secret, amount) computed by the depositor
   // (off-chain); the chain stores c + viewtag + algorithm id, the amount
   // recorded OPENLY (the on-ramp; the off-chain tree appends c and the
   // owner rolls the root via setroot).
   [[eosio::action]] void deposit( const checksum256& c, uint32_t viewtag, uint64_t amount ) {
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      commitment_index cs( get_self(), get_self().value );
      eosio::check( (uint64_t)std::distance(cs.begin(), cs.end()) < lr.max_notes, "commitment set FULL (bounded)" );
      eosio::check( cs.find( pk_of(c) ) == cs.end(), "commitment exists" );
      cs.emplace( get_self(), [&]( auto& r ) {
         r.c = c; r.viewtag = viewtag; r.alg = lr.alg_commit;
         r.deposited = current_time_point().sec_since_epoch(); r.amount = amount;
      });
   }

   // ── private payment: proof + nullifier in, new note out ──
   // payment_gate() verifies the nine-phase PLONK proof over publics
   // (root ‖ nullifier ‖ out_commitment ‖ fee): MEMBERSHIP of the spent
   // note in the law row's tree, CONSERVATION amountIn = amountOut + fee
   // with amounts hidden, the FEE public (the meter's leg). The new note's
   // amount is PRIVATE — the row stores 0, labeled. The nullifier hit
   // refuses the double-spend.
   [[eosio::action]] void transfer( const checksum256& nullifier, const checksum256& to_commitment,
                                    uint32_t to_viewtag, uint64_t fee,
                                    const std::vector<uint8_t>& proof ) {
      payment_gate( nullifier, to_commitment, fee, proof );
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      commitment_index cs( get_self(), get_self().value );
      eosio::check( (uint64_t)std::distance(cs.begin(), cs.end()) < lr.max_notes, "commitment set FULL (bounded)" );
      eosio::check( cs.find( pk_of(to_commitment) ) == cs.end(), "target commitment exists" );
      cs.emplace( get_self(), [&]( auto& r ) {
         r.c = to_commitment; r.viewtag = to_viewtag; r.alg = lr.alg_commit;
         r.deposited = current_time_point().sec_since_epoch();
         r.amount = 0;   // PRIVATE since M5: conservation is proven in-circuit
      });
   }

   // ── withdraw: proof + nullifier in, public value out ──
   // the SAME payment proof with the value riding the public fee leg
   // (amountOut = 0 in the circuit); the out-commitment is not stored.
   // Rehearsed settlement: no token rails on the rehearsal chain — the
   // row-level truth (nullifier + fee = value out + recipient) is the receipt.
   [[eosio::action]] void withdraw( const checksum256& nullifier, name recipient, uint64_t fee,
                                    const checksum256& note_commitment,
                                    const std::vector<uint8_t>& proof ) {
      payment_gate( nullifier, note_commitment, fee, proof );
      require_auth( get_self() );
   }

private:
   static uint64_t pk_of( const checksum256& h ) {
      auto d = h.data();
      return ( (uint64_t)d[0] << 32 ) | (uint64_t)d[1];
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
                      uint64_t fee, const std::vector<uint8_t>& proof ) {
      eosio::check( proof.size() == 24 * 32, "proof: expected 24 words (768 bytes)" );
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      unsigned char pubs[4 * 32];
      const auto rt = lr.root.extract_as_byte_array();
      const auto n  = nullifier.extract_as_byte_array();
      const auto c  = out_commitment.extract_as_byte_array();
      memcpy( pubs,       rt.data(), 32 );              // [0] root — from the law row
      memcpy( pubs + 32,  n.data(),  32 );              // [1] nullifier
      memcpy( pubs + 64,  c.data(),  32 );              // [2] out commitment
      for ( int b = 0; b < 32; ++b )                    // [3] fee as BE word
         pubs[96 + b] = (unsigned char)( (fee >> (8 * (31 - b))) & 0xff );
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
