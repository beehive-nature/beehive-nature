// zkr_component.cpp — EOSVM-WALLET-001 §component
//
// The zkrcount PLONK gate (contracts/zkreceipts/zkrcount.cpp's verification
// path) as an INDEPENDENTLY RUNNABLE EOS VM component. The verifier headers
// beside this file are VERBATIM copies of the estate's:
//   field256.hpp          == contracts/privacy/field256.hpp
//   vk_count_constants.hpp== contracts/zkreceipts/vk_count_constants.hpp
//   plonk_verify_count.hpp== contracts/zkreceipts/plonk_verify_count.hpp
//     (one cited divergent line: its "../privacy/field256.hpp" include is
//      re-pathed to "field256.hpp" — same convention that file itself used
//      when it copied ../privacy/plonk_verify.hpp)
//
// HOST INTERFACE (explicit — the whole boundary, nothing else):
//   imports, module "env" — the exact split the chain runtime uses
//   (wasm scalar phases; native curve + hash):
//     keccak256(in: i32, len: i32, out: i32)          32 bytes written to out
//     alt_bn128_add(op1: i32, l1: i32, op2: i32, l2: i32, res: i32, rl: i32) -> i32
//     alt_bn128_mul(g1: i32, gl: i32, s: i32, sl: i32, res: i32, rl: i32) -> i32
//     alt_bn128_pair(pairs: i32, pairs_len: i32) -> i32
//   exports:
//     memory
//     zkr_verify(proof_ptr: i32, pubs_ptr: i32) -> i32   0 = proof ACCEPTED
//     zkr_layout(what: i32) -> i32   0=proof_off 1=pubs_off 2=proof_len 3=pubs_len
//   The embedder writes proof (768 B) and pubs (96 B) into linear memory at
//   the offsets zkr_layout reports, then calls zkr_verify.
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
// The shim below only ever REFUSES: eosio::check failure and intrinsic
// errors trap/reject; no failure path can produce an accept.
#include <stdint.h>
#include <stddef.h>

// fixed buffer layout in linear memory (page 1, away from the stack area)
#define ZKR_PROOF_OFF ((uint32_t)1 << 16)      // 65536
#define ZKR_PUBS_OFF  (ZKR_PROOF_OFF + 768)
#define ZKR_PROOF_LEN 768                      // 24 words — zkrcount law
#define ZKR_PUBS_LEN  96                       // 3 publics (root, kind, count)
#define ZKR_LAST_OFF  (ZKR_PUBS_OFF + 96)      // result slot the embedder reads

extern "C" {

__attribute__((import_module("env"), import_name("keccak256")))
void keccak256( const char* in, uint32_t len, char* out );

uint32_t zkr_layout( uint32_t what );
int32_t  zkr_verify( uint32_t proof_ptr, uint32_t pubs_ptr );
int32_t  zkr_last();
}

// the eosio namespace shim the verbatim headers expect lives in
// component/eosio/{eosio.hpp,crypto_ext.hpp}: eosio::check traps on failure
// (a trap is a refusal at the embedder's boundary — never an accept), and
// the three curve intrinsics become wasm imports of the same host functions
// the chain runtime registers.

// bridge: plonk's plain-function-pointer keccak -> the host import
static void pl_kec_import( const unsigned char* in, unsigned len, unsigned char out[32] ) {
   keccak256( (const char*)in, len, (char*)out );
}

// freestanding memops (clang lowers the headers' memcpy/memset loops to these)
extern "C" void* memcpy( void* d, const void* s, size_t n ) {
   unsigned char* dd = (unsigned char*)d; const unsigned char* ss = (const unsigned char*)s;
   while ( n-- ) *dd++ = *ss++;
   return d;
}
extern "C" void* memset( void* d, int c, size_t n ) {
   unsigned char* dd = (unsigned char*)d;
   while ( n-- ) *dd++ = (unsigned char)c;
   return d;
}
extern "C" int memcmp( const void* a, const void* b, size_t n ) {
   const unsigned char* x = (const unsigned char*)a; const unsigned char* y = (const unsigned char*)b;
   for ( ; n--; ++x, ++y ) if ( *x != *y ) return *x < *y ? -1 : 1;
   return 0;
}
extern "C" size_t strlen( const char* s ) {
   size_t n = 0; while ( s[n] ) ++n; return n;
}

#include "plonk_verify_count.hpp"   // verbatim estate verifier, full build

extern "C" uint32_t zkr_layout( uint32_t what ) {
   switch ( what ) {
      case 0: return ZKR_PROOF_OFF;
      case 1: return ZKR_PUBS_OFF;
      case 2: return ZKR_PROOF_LEN;
      default: return ZKR_PUBS_LEN;
   }
}

static int32_t zkr_last_result = -1;

extern "C" int32_t zkr_verify( uint32_t proof_ptr, uint32_t pubs_ptr ) {
   zkr_last_result = plonk_verify( pl_kec_import, (const unsigned char*)proof_ptr,
                                   (const unsigned char*)pubs_ptr );
   *(volatile int32_t*)ZKR_LAST_OFF = zkr_last_result;   // the embedder's slot
   return zkr_last_result;
}

extern "C" int32_t zkr_last() { return zkr_last_result; }

// phase bisect exports (engine diagnostics): 0 = phase passed
extern "C" int32_t zkr_phase1( uint32_t proof_ptr ) {   // curve+range checks
   plonk_ctx c; plonk_ctx_init( &c );
   return plonk_checkProofData( &c, (const unsigned char*)proof_ptr ) ? 0 : 1;
}
extern "C" int32_t zkr_phase2( uint32_t proof_ptr, uint32_t pubs_ptr ) { // challenges
   plonk_ctx c; plonk_ctx_init( &c );
   pl_chals ch;
   calculateChallenges( &c, pl_kec_import, (const unsigned char*)proof_ptr,
                        (const unsigned char*)pubs_ptr, &ch );
   return 0;
}
extern "C" int32_t zkr_scalars( uint32_t proof_ptr, uint32_t pubs_ptr ) { // ALL scalar phases
   plonk_ctx c; plonk_ctx_init( &c );
   if ( !plonk_checkProofData( &c, (const unsigned char*)proof_ptr ) ) return 1;
   pl_chals ch;
   calculateChallenges( &c, pl_kec_import, (const unsigned char*)proof_ptr,
                        (const unsigned char*)pubs_ptr, &ch );
   pl_scalars sc;
   pl_sf( &c, pl_word( (const unsigned char*)proof_ptr, 18 ), sc.a );
   pl_sf( &c, pl_word( (const unsigned char*)proof_ptr, 19 ), sc.b );
   pl_sf( &c, pl_word( (const unsigned char*)proof_ptr, 20 ), sc.c );
   pl_sf( &c, pl_word( (const unsigned char*)proof_ptr, 21 ), sc.s1 );
   pl_sf( &c, pl_word( (const unsigned char*)proof_ptr, 22 ), sc.s2 );
   pl_sf( &c, pl_word( (const unsigned char*)proof_ptr, 23 ), sc.zw );
   calculateLagrange( &c, &ch, sc.L );
   calculatePI( &c, sc.L, (const unsigned char*)pubs_ptr, sc.pi );
   calculateR0( &c, &ch, &sc );
   calculateD_scalars( &c, &ch, &sc );
   calculateE_scalar( &c, &ch, &sc );
   return 0;
}
