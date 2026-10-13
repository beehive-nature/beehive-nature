// blsprobe.cpp — EOSVM-WALLET-001: BLS12-381 host-function runtime probe.
// CDT 4.1.1 does NOT wrap the bls_* intrinsics (crypto_ext.hpp has
// alt_bn128/blake2f/sha3/k1 only) — these are HAND-DECLARED wasm imports of
// Spring v1.2.2's host functions (libraries/chain/webassembly/crypto.cpp:
// bls_g1_add takes 96-byte UNCOMPRESSED AFFINE LITTLE-ENDIAN points,
// check_valid=true, returns 0 success / 1 failure).
// The generator constant is GENERATED from ffjavascript bls12-381 at build
// time (gen_bls.js -> bls_gen.h); the off-chain check compares the on-chain
// result against ffjavascript's 2*G1. Nothing here asserts BLS correctness
// beyond that cross-check.
#include <eosio/eosio.hpp>
#include <vector>
#include "bls_gen.h"

using namespace eosio;

extern "C" {
__attribute__((import_module("env"), import_name("bls_g1_add")))
int32_t bls_g1_add( const char* op1, uint32_t op1_len, const char* op2,
                    uint32_t op2_len, char* result, uint32_t result_len );
}

class [[eosio::contract("blsprobe")]] blsprobe : public contract {
public:
   using contract::contract;

   struct [[eosio::table("r"), eosio::contract("blsprobe")]] row {
      uint64_t id;
      int64_t  rc;
      std::vector<uint8_t> out;
      uint64_t primary_key() const { return id; }
   };
   using r_index = multi_index<"r"_n, row>;

   // G1_gen + G1_gen through the host function; store rc + the 96 result bytes
   [[eosio::action]] void probe() {
      static const char a[96] = BLS_G1GEN_LE96;
      char out[96];
      int32_t rc = bls_g1_add( a, 96, a, 96, out, 96 );
      r_index r( get_self(), get_self().value );
      auto it = r.find( 0 );
      std::vector<uint8_t> v( out, out + 96 );
      if ( it == r.end() ) r.emplace( get_self(), [&]( row& x ){ x.id=0; x.rc=rc; x.out=v; } );
      else r.modify( it, get_self(), [&]( row& x ){ x.rc=rc; x.out=v; } );
   }

   // 47-byte malformed input: must NOT succeed (rc != 0), no trap
   [[eosio::action]] void raw() {
      static const char junk[47] = {};
      char out[96];
      int32_t rc = bls_g1_add( junk, 47, junk, 47, out, 96 );
      r_index r( get_self(), get_self().value );
      auto it = r.find( 1 );
      if ( it == r.end() ) r.emplace( get_self(), [&]( row& x ){ x.id=1; x.rc=rc; x.out={}; } );
      else r.modify( it, get_self(), [&]( row& x ){ x.rc=rc; } );
   }
};
