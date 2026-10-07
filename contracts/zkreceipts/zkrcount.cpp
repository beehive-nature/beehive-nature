// zkrcount.cpp — the COUNT-ONLY aggregate receipt gate
// (SPEC-ZK-RECEIPT-AGGREGATES-1 §shape v1; RAID-VAULTA-ZK-1).
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
//
// Two actions, one law each:
//  - anchor(seq, root, kind, count): commit ONE bounded claim row — the
//    M9 anchor law: the HEAD only (root + the counted kind + the claimed
//    count), never a receipt, never a leaf. Permissionless: anyone may
//    commit a claim; only a real proof can mark it verified.
//  - verify(seq, proof): the nine-phase PLONK verifier (the M4 port —
//    plonk_verify_count.hpp, a 3-line copy of ../privacy/plonk_verify.hpp
//    bound to count.circom's vk via vk_count_constants.hpp) over publics
//    [root ‖ kind-word ‖ count-word] assembled FROM THE ANCHOR ROW. A
//    mutated claim therefore cannot ride a real proof: the publics the
//    pairing checks are the anchored ones. One verify per anchor, ever.
//
// The root rides the table as RAW BYTES (std::vector<uint8_t>), not
// checksum256: the fixed_bytes ABI/storage T-laws (M1 gotcha, M6 display
// law) then never touch the proof transcript — what is anchored is byte-
// identical to what the proof commits.
//
// alg id space shared with note.cpp's law row: 2 = ALG_PROOF_PLONK_V1
// (plonk-bn254-v1, snarkjs 0.7.6 wire format).
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <vector>
#include <cstring>
#include "../privacy/field256.hpp"
#include "plonk_verify_count.hpp"

struct [[eosio::table("anchors"), eosio::contract("zkrcount")]] anchor_row {
   uint64_t              seq;           // anchor id — unique, one claim each
   std::vector<uint8_t>  root;          // 32-byte Merkle root of the private set
   uint64_t              kind;          // K: 0 = dead-baseline, 1 = live-baseline
   uint64_t              count;         // N: the claimed kept-member count
   uint64_t              alg;           // 2 = ALG_PROOF_PLONK_V1
   uint32_t              anchored_at;
   uint32_t              verified_at;   // 0 = not yet verified
   uint64_t primary_key() const { return seq; }
};
using anchor_index = eosio::multi_index<"anchors"_n, anchor_row>;

class [[eosio::contract("zkrcount")]] zkrcount : public eosio::contract {
public:
   zkrcount( eosio::name receiver, eosio::name code, eosio::datastream<const char*> ds )
      : eosio::contract( receiver, code, ds ) {}
   static constexpr uint8_t ALG_PROOF_PLONK_V1 = 2;   // same id-space as note.cpp

   // commit a claim (the M9 bounded-anchor law: the head, never the set)
   [[eosio::action]] void anchor( uint64_t seq, const std::vector<uint8_t>& root,
                                  uint64_t kind, uint64_t count ) {
      eosio::check( root.size() == 32, "root: expected 32 bytes" );
      eosio::check( kind <= 1, "kind must be 0 or 1" );
      anchor_index ai( get_self(), get_self().value );
      eosio::check( ai.find( seq ) == ai.end(), "anchor seq already exists" );
      ai.emplace( get_self(), [&]( auto& r ) {
         r.seq = seq; r.root = root; r.kind = kind; r.count = count;
         r.alg = ALG_PROOF_PLONK_V1;
         r.anchored_at = eosio::current_time_point().sec_since_epoch();
         r.verified_at = 0;
      });
   }

   // one PLONK verification per anchor — publics come FROM the row
   [[eosio::action]] void verify( uint64_t seq, const std::vector<uint8_t>& proof ) {
      eosio::check( proof.size() == 24 * 32, "proof: expected 24 words (768 bytes)" );
      anchor_index ai( get_self(), get_self().value );
      auto itr = ai.find( seq ); eosio::check( itr != ai.end(), "anchor not found" );
      eosio::check( itr->verified_at == 0, "anchor already verified (one proof per anchor)" );
      unsigned char pubs[3 * 32];
      memcpy( pubs, itr->root.data(), 32 );            // [0] root — from the anchor row
      u64_to_be32_word( pubs + 32, itr->kind );        // [1] kind
      u64_to_be32_word( pubs + 64, itr->count );       // [2] count
      int32_t r = plonk_verify( pl_kec_eosio, proof.data(), pubs );
      eosio::check( r == 0, "count proof REJECTED — plonk pairing false" );
      ai.modify( itr, get_self(), [&]( auto& row ) {
         row.verified_at = eosio::current_time_point().sec_since_epoch();
      });
   }

private:
   // a uint64 as a 32-byte BE word, shifts ≤ 56 only — THE M7 UB LAW
   // (wasm's i64.shr_u takes the shift mod 64; a ≥64 shift once compiled
   // a repeated-byte word that silently desynced the whole transcript)
   static void u64_to_be32_word( unsigned char* dst, uint64_t v ) {
      memset( dst, 0, 24 );
      for ( int i = 0; i < 8; ++i ) dst[24 + i] = (unsigned char)( ( v >> (8 * (7 - i)) ) & 0xff );
   }

   // keccak bridge: plonk_verify takes a plain function pointer
   static void pl_kec_eosio( const unsigned char* in, unsigned len, unsigned char out[32] ) {
      auto h = eosio::keccak( (const char*)in, len );
      const auto a = h.extract_as_byte_array();
      memcpy( out, a.data(), 32 );
   }
};
