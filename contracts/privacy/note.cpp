// note.cpp — the private note (SPEC-PRIVACY-1, PLONK fork, M4: the port).
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
//
// WHAT IS REAL HERE (labeled exactly, per the lane law):
//  - The FLOW: deposit -> private transfer -> withdraw, with commitment and
//    nullifier sets, double-spend refusal by nullifier uniqueness, bounded
//    fixed-size rows only (the chain holds law + commitments + nullifiers,
//    never bulk history).
//  - The VIEW-KEY TAG: every commitment carries a tag derived from the
//    owner's view key — wallets scan tags; the owner can prove their own
//    history to a chosen auditor with the view key OFF-chain (Zano's
//    auditable-wallet pattern). Disclosure never touches the chain.
//  - CRYPTO-AGILITY LAW: every stored hash/proof carries its algorithm id.
//    ALG_COMMIT = keccak256-v1 (rehearsal choice; the deposit commitment's
//    hash — the note-statement commitment inside the circuit is Poseidon;
//    swapping the deposit hash to Poseidon is a named future lane).
//    ALG_PROOF  = plonk-bn254-v1 (was plonk-bn254-v1-TOY until M4): the
//    spend gate now runs the full nine-phase PLONK verification
//    (plonk_verify.hpp, ported verbatim from snarkjs's
//    verifier_plonk.sol.ejs) over a REAL circuit proof — circom +
//    circomlib Poseidon, powersoftau pot12 one-honest-participant ceremony
//    (rehearsal-labeled), snarkjs 0.7.6 prover. Old rows keep id 1; new
//    proofs carry id 2 — the ids make toy and real distinguishable.
//  - The circuit statement (spend.circom): knowledge of (secret, amount,
//    tag) with commitment = Poseidon(secret, amount), nullifier =
//    Poseidon(secret, tag), public (commitment, nullifier). It BINDS the
//    nullifier to the note's secret. It does NOT prove membership of the
//    commitment in the chain's set (merkle-root public input) or value
//    conservation — labeled future lanes, per §m3-design.
//  - BLS12-381 remains the FUTURE lane (BLS_PRIMITIVES2 lives on mainnet);
//    nothing here depends on BN254 forever — algorithm ids make the swap a
//    table row, not a rewrite.

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
   static constexpr uint8_t ALG_COMMIT_KECCAK256_V1 = 1;   // keccak256 deposit commitment
   static constexpr uint8_t ALG_PROOF_PLONK_TOY_V1  = 1;   // retired (M3 toy instance)
   static constexpr uint8_t ALG_PROOF_PLONK_V1      = 2;   // plonk-bn254-v1: circuit-backed spend proof

   // ── the LAW row (governed-mutable, exactly one) ──
   struct [[eosio::table("law"), eosio::contract("note")]] law_row {
      uint64_t id;                 // 0 forever
      uint8_t  alg_commit;         // commitment algorithm id
      uint8_t  alg_proof;          // spend-proof algorithm id
      uint64_t max_notes;          // BOUNDED: commitments table hard cap
      uint64_t max_nullifiers;     // BOUNDED: nullifier table hard cap
      uint64_t primary_key()const { return id; }
   };
   using law_index = eosio::multi_index<"law"_n, law_row>;

   // ── commitment set (bounded, fixed-size rows) ──
   struct [[eosio::table("commitments"), eosio::contract("note")]] commitment_row {
      checksum256 c;               // the commitment (algorithm per law row)
      uint32_t    viewtag;         // first 4 bytes of H(viewpub ‖ c) — wallet scan
      uint8_t     alg;             // commitment algorithm id
      uint64_t    deposited;       // block time of deposit (audit floor, not history)
      uint64_t    amount;          // rehearsed openly (conservation proof = circuit lane)
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
      law_index law( get_self(), get_self().value );
      eosio::check( law.begin() == law.end(), "law already set" );
      law.emplace( get_self(), [&]( auto& r ) {
         r.id = 0; r.alg_commit = ALG_COMMIT_KECCAK256_V1; r.alg_proof = ALG_PROOF_PLONK_V1;
         r.max_notes = max_notes; r.max_nullifiers = max_nulls;
      });
   }

   // ── deposit: public value in, commitment out ──
   // commitment = keccak256(secret ‖ amount ‖ viewtag_src) computed by the
   // depositor (off-chain); the chain stores c + viewtag + algorithm id.
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

   // ── private transfer: proof + nullifier in, new commitment out ──
   // spend_gate() = the nine-phase PLONK verify (plonk_verify.hpp) over the
   // caller's circuit proof; publics = (note commitment ‖ nullifier). A
   // failed pairing refuses the transfer. The nullifier hit refuses the
   // double-spend. Rows stay bounded. The FLOW is unchanged from M3 — only
   // the gate's constants and equation were ported (the handoff's swap point).
   [[eosio::action]] void transfer( const checksum256& nullifier, const checksum256& to_commitment,
                                    uint32_t to_viewtag, uint64_t to_amount, uint64_t fee,
                                    const checksum256& note_commitment,
                                    const std::vector<uint8_t>& proof ) {
      spend_gate( nullifier, note_commitment, proof );
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      commitment_index cs( get_self(), get_self().value );
      // rehearsed openly (the conservation proof lives in the circuit lane):
      // find the source note by amount match is NOT private-by-design; the
      // rehearsal stores amounts openly and the real spend hides them. Labeled.
      // bind: the nullifier must not exist, the target must be new
      eosio::check( (uint64_t)std::distance(cs.begin(), cs.end()) < lr.max_notes, "commitment set FULL (bounded)" );
      eosio::check( cs.find( pk_of(to_commitment) ) == cs.end(), "target commitment exists" );
      cs.emplace( get_self(), [&]( auto& r ) {
         r.c = to_commitment; r.viewtag = to_viewtag; r.alg = lr.alg_commit;
         r.deposited = current_time_point().sec_since_epoch(); r.amount = to_amount;
      });
   }

   // ── withdraw: proof + nullifier in, value out to a plain account ──
   [[eosio::action]] void withdraw( const checksum256& nullifier, name recipient, uint64_t amount, uint64_t fee,
                                    const checksum256& note_commitment,
                                    const std::vector<uint8_t>& proof ) {
      spend_gate( nullifier, note_commitment, proof );
      // rehearsed settlement: no token rails wired on the rehearsal chain —
      // the row-level truth (nullifier + amount + recipient) is the receipt.
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

   // The spend gate (M4, the port): full nine-phase PLONK verification of
   // the caller's proof over publics (note_commitment ‖ nullifier), then the
   // nullifier insert — bounded + unique = double-spend refusal. vk: the
   // spend.circom ceremony (vk_constants.hpp provenance header).
   // noinline: with -O3 the huge verifier inlined differently per caller and
   // billed 7–9 ms inside transfer but 14–18 ms inside withdraw — same code,
   // same inputs. Outlined, both actions bill the same (measured, §m4-receipt).
   __attribute__( ( noinline ) )
   void spend_gate( const checksum256& nullifier, const checksum256& note_commitment,
                    const std::vector<uint8_t>& proof ) {
      eosio::check( proof.size() == 24 * 32, "proof: expected 24 words (768 bytes)" );
      unsigned char pubs[64];
      const auto c = note_commitment.extract_as_byte_array();
      const auto n = nullifier.extract_as_byte_array();
      memcpy( pubs,      c.data(), 32 );
      memcpy( pubs + 32, n.data(), 32 );
      int32_t r = plonk_verify( pl_kec_eosio, proof.data(), pubs );
      eosio::check( r == 0, "spend proof REJECTED — plonk pairing false" );
      // nullifier insert (bounded + unique = double-spend refusal)
      law_index law( get_self(), get_self().value );
      auto lr = law.get( 0, "law not initialized" );
      nullifier_index ns( get_self(), get_self().value );
      eosio::check( (uint64_t)std::distance(ns.begin(), ns.end()) < lr.max_nullifiers, "nullifier set FULL (bounded)" );
      eosio::check( ns.find( pk_of(nullifier) ) == ns.end(), "DOUBLE-SPEND — nullifier already spent" );
      ns.emplace( get_self(), [&]( auto& row ) {
         row.n = nullifier; row.alg = lr.alg_proof;
         row.spent_at = current_time_point().sec_since_epoch();
      });
   }
};
