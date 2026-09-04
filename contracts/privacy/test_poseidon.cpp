// test_poseidon.cpp — the circomlib-compatibility gate for poseidon2.hpp.
// The ON-CHAIN incremental tree hashes with the C++ implementation; the
// circuit and tree.js hash with circomlib's. If they ever disagree, every
// root and every membership proof silently diverges — so this gate runs on
// circomlibjs-generated vectors (66 pairs incl. the zero-chain edges)
// BEFORE any chain use. Native build:
//   g++ -O2 -o test_poseidon test_poseidon.cpp && ./test_poseidon < vectors
#include "poseidon2.hpp"
#include "tree_zeros.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

static int hexv( char c ) {
   if ( c >= '0' && c <= '9' ) return c - '0';
   if ( c >= 'a' && c <= 'f' ) return c - 'a' + 10;
   return -1;
}
static void parse_hex( const char* s, u256 r ) {
   memset( r, 0, 4 * sizeof(uint64_t) );
   int len = (int)strlen( s );
   for ( int i = 0; i < len; ++i ) {
      int v = hexv( s[len - 1 - i] );
      if ( v < 0 ) { fprintf( stderr, "bad hex\n" ); exit( 2 ); }
      r[i / 16] |= (uint64_t)v << ( (i % 16) * 4 );
   }
}

int main() {
   // the BN254 scalar field (same value every file in this lane cites)
   unsigned char q[32] = {
      0x30,0x64,0x4e,0x72,0xe1,0x31,0xa0,0x29,0xb8,0x50,0x45,0xb6,0x81,0x81,0x58,0x5d,
      0x28,0x33,0xe8,0x48,0x79,0xb9,0x70,0x91,0x43,0xe1,0xf5,0x93,0xf0,0x00,0x00,0x01 };
   poseidon2_ctx pc;
   poseidon2_ctx_init( &pc, q );

   long ok = 0, bad = 0;
   char line[400];
   while ( fgets( line, sizeof line, stdin ) ) {
      char op[8], a1[130], a2[130], a3[130];
      if ( sscanf( line, "%7s %129s %129s %129s", op, a1, a2, a3 ) != 4 ) continue;
      u256 a, b, want, got;
      parse_hex( a1, a ); parse_hex( a2, b ); parse_hex( a3, want );
      poseidon2( &pc, a, b, got );
      if ( !f256_eq( got, want ) ) {
         unsigned char be[32]; f256_to_be( be, got );
         fprintf( stderr, "P2 MISMATCH in=%s,%s got=", a1, a2 );
         for ( int i = 0; i < 32; ++i ) fprintf( stderr, "%02x", be[i] );
         fprintf( stderr, "\n" );
         ++bad;
      } else ++ok;
   }
   // structural cross-check: poseidon2(0,0) must equal ZERO_[1], and the
   // law row's initial root must equal ZERO_[20]
   u256 z0, z1, r;
   f256_zero( z0 );
   poseidon2( &pc, z0, z0, z1 );
   f256_from_be( r, ZERO_[1] );
   if ( !f256_eq( z1, r ) ) { fprintf( stderr, "ZERO_[1] mismatch\n" ); ++bad; } else ++ok;
   f256_from_be( r, ZERO_[20] );
   if ( !f256_eq( z1, r ) && false ) {} // (z1 is H(0,0)=ZERO_[1]; root checked below)
   u256 zz, z19;
   f256_from_be( z19, ZERO_[19] );
   poseidon2( &pc, z19, z19, zz );
   f256_from_be( r, ZERO_[20] );
   if ( !f256_eq( zz, r ) ) { fprintf( stderr, "ZERO_[20] mismatch\n" ); ++bad; } else ++ok;

   printf( "poseidon2: %ld passed, %ld failed\n", ok, bad );
   return bad ? 1 : 0;
}
