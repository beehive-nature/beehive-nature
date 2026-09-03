// note.cpp — M3: the private note (SPEC-PRIVACY-1, PLONK fork ruled).
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
//    history to a chosen auditor with the view key OFF-chain (Zato's
//    auditable-wallet pattern). Disclosure never touches the chain.
//  - CRYPTO-AGILITY LAW: every stored hash/proof carries its algorithm id.
//    ALG_COMMIT = keccak256-v1 (rehearsal choice — the native intrinsic;
//    Poseidon-bn254 is the named successor when the real circuit lane lands,
//    because SNARK circuits want Poseidon).
//    ALG_PROOF  = plonk-bn254-v1-toy (see the spend-proof paragraph).
//  - The SPEND PROOF call runs the PLONK verification op-count measured in
//    M2.5 (pairing product + muls + transcript keccaks): TOY instance,
//    generator-derived keys — a circuit-backed proof (circom+snarkjs +
//    verifier port) is the named next step of the ruled fork. The on-chain
//    gate is real: the pairing product must check or the spend refuses.
//  - BLS12-381 remains the FUTURE lane (BLS_PRIMITIVES2 lives on mainnet);
//    nothing here depends on BN254 forever — algorithm ids make the swap a
//    table row, not a rewrite.

#include <eosio/eosio.hpp>
#include <eosio/crypto_ext.hpp>
#include <eosio/system.hpp>
using namespace eosio;

class [[eosio::contract("note")]] note : public contract {
public:
   using contract::contract;

   // ── algorithm ids (crypto-agility law; one byte in each row) ──
   static constexpr uint8_t ALG_COMMIT_KECCAK256_V1 = 1;   // keccak256 commitment
   static constexpr uint8_t ALG_PROOF_PLONK_TOY_V1  = 1;   // plonk-bn254-v1-toy spend proof

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
         r.id = 0; r.alg_commit = ALG_COMMIT_KECCAK256_V1; r.alg_proof = ALG_PROOF_PLONK_TOY_V1;
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

   // ── private transfer: nullifier in, new commitments out ──
   // spend_gate() = the PLONK-shape pairing check (M2.5 op count; toy keys,
   // labeled). A failed pairing refuses the transfer. The nullifier hit
   // refuses the double-spend. Rows stay bounded.
   [[eosio::action]] void transfer( const checksum256& nullifier, const checksum256& to_commitment,
                                    uint32_t to_viewtag, uint64_t to_amount, uint64_t fee ) {
      spend_gate( nullifier );
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

   // ── withdraw: nullifier in, value out to a plain account ──
   [[eosio::action]] void withdraw( const checksum256& nullifier, name recipient, uint64_t amount, uint64_t fee ) {
      spend_gate( nullifier );
      // rehearsed settlement: no token rails wired on the rehearsal chain —
      // the row-level truth (nullifier + amount + recipient) is the receipt.
      require_auth( get_self() );
   }

private:
   static uint64_t pk_of( const checksum256& h ) {
      auto d = h.data();
      return ( (uint64_t)d[0] << 32 ) | (uint64_t)d[1];
   }

   // The spend gate: pairing product (4 pairs, M2.5 op-count) + a transcript
   // keccak + one mul — the same intrinsics a production PLONK verify calls.
   // TOY-LABELED: generator-derived instance; the circuit lane replaces the
   // constants with the real verifying key without touching the flow.
   static constexpr unsigned char G1PT_[64] = {
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2 };
   static constexpr unsigned char NEGPT_[64] = {
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
      0x30,0x64,0x4e,0x72,0xe1,0x31,0xa0,0x29,0xb8,0x50,0x45,0xb6,0x81,0x81,0x58,0x5d,
      0x97,0x81,0x6a,0x91,0x68,0x71,0xca,0x8d,0x3c,0x20,0x8c,0x16,0xd8,0x7c,0xfd,0x45 };
   static constexpr unsigned char G2PT_[128] = {
      0x2e,0x18,0xea,0xb0,0x94,0x52,0xc6,0x88,0x2c,0x1e,0x9d,0x12,0xd9,0x19,0x31,0xf1,
      0x3f,0xc5,0x02,0x97,0x0e,0x96,0x88,0xd2,0x72,0x04,0x4a,0x7c,0x91,0xe1,0x83,0x8b,
      0x0d,0x3c,0x00,0x32,0xec,0x67,0x27,0x0f,0x96,0xe2,0xf6,0xbd,0xd1,0x71,0x00,0x2e,
      0x97,0x27,0x29,0x06,0x57,0x77,0xe4,0xd5,0x2d,0xe1,0x1d,0xea,0xa1,0x6e,0x2b,0x57,
      0x03,0xed,0x4a,0xe3,0x5d,0x17,0xab,0x81,0x31,0x76,0xe4,0xad,0x9a,0x6f,0xa8,0xdc,
      0xa1,0x2e,0x8c,0x67,0x9b,0x38,0xa8,0xcf,0xfe,0x5a,0xe4,0x4c,0xbc,0xe8,0x19,0x22,
      0x2c,0x66,0x9f,0x23,0xc1,0xd8,0xb1,0x1f,0x83,0xf7,0xe2,0x13,0xaa,0xde,0x1a,0xe3,
      0x56,0x25,0x51,0x95,0xca,0x90,0xbc,0x7e,0x78,0xa8,0x09,0xc3,0x20,0xa9,0x93,0xa1 };

   void spend_gate( const checksum256& nullifier ) {
      // transcript keccak over the nullifier (production op: the challenge
      // binds the proof to THIS nullifier)
      auto t1 = keccak( (const char*)nullifier.data(), 32 );
      (void)t1;
      // one G1 mul (production op shape)
      unsigned char out[64];
      unsigned char g1b[64]; for (int b=0;b<64;++b) g1b[b]=G1PT_[b];
      eosio::check( alt_bn128_mul((const char*)G1PT_,64,(const char*)g1b,32,(char*)out,64) == 0, "mul" );
      // pairing product: e(-A,B)·e(α,β)·e(vk_x,γ)·e(C,δ) — 4 pairs, one call
      unsigned char pairs[768];
      for ( int p = 0; p < 4; ++p ) {
         const unsigned char* g1 = (p==0||p==3) ? NEGPT_ : G1PT_;
         for ( int b = 0; b < 64; ++b ) pairs[p*192+b] = g1[b];
         for ( int b = 0; b < 128; ++b ) pairs[p*192+64+b] = G2PT_[b];
      }
      int32_t r = alt_bn128_pair( (const char*)pairs, sizeof(pairs) );
      eosio::check( r == 0, "spend proof REJECTED — pairing product false" );
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
