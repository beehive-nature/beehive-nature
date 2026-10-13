// blsfree.c — EOSVM-WALLET-001: BLS12-381 host-function runtime probe, built
// FREE-STANDING (clang-21 wasm32; CDT's own linker spins on this box —
// receipted). The transaction's executed/failed status IS the receipt:
//   action "probe" (N(probe) = 0x... constant below): bls_g1_add(G1gen,
//   G1gen) then compare the 96-byte result to ffjavascript's 2*G1 baked in
//   at build time (gen_bls.c emits bls_const.h). Mismatch -> unreachable
//   trap -> failed transaction. Node alive = the boundary held.
// Host format (Spring v1.2.2 webassembly/crypto.cpp:263): 96-byte
// UNCOMPRESSED AFFINE LITTLE-ENDIAN points, check_valid enforced.
#include <stdint.h>
#include <stddef.h>
#include "bls_const.h"   // BLS_G1GEN_LE96 (96 bytes), BLS_2G1_LE96 (96 bytes)

extern __attribute__((import_module("env"), import_name("bls_g1_add")))
int32_t bls_g1_add( const char* op1, uint32_t op1_len, const char* op2,
                    uint32_t op2_len, char* result, uint32_t result_len );

static int eq96( const char* a, const char* b ) {
   for ( int i = 0; i < 96; ++i ) if ( a[i] != b[i] ) return 0;
   return 1;
}

// the Antelope apply entry: (receiver, code, action) as i64 names.
// action N("probe") computed by the name law: chars a-z 1-5 packed base-32.
static uint64_t name_probe() {   // p r o b e -> 5 chars
   // name = sum over 12 slots; 5-char names occupy the LAST 5 of 12 slots?
   // No: chars fill from the FIRST slot: N = c0<<(59-5*0)... standard:
   // value = c0 at bits 59..55, ..., c4 at bits 39..35, rest zero.
   uint64_t v = 0;
   const char* s = "probe";
   for ( int i = 0; i < 5; ++i ) v |= (uint64_t)( s[i] - 'a' + 1 ) << ( 59 - 5 * i );
   return v;
}

void apply( uint64_t receiver, uint64_t code, uint64_t action ) {
   (void)receiver; (void)code;
   if ( action != name_probe() ) return;
   char out[96];
   int32_t rc = bls_g1_add( (const char*)BLS_G1GEN_LE96, 96,
                            (const char*)BLS_G1GEN_LE96, 96, out, 96 );
   // rc must be 0 AND the result must equal ffjavascript's 2*G1
   if ( rc != 0 || !eq96( out, (const char*)BLS_2G1_LE96 ) )
      __builtin_trap();
}
