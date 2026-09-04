// test_field256.cpp — the field library's known-vector gate. Lane law: this
// must pass BEFORE any verifier code rides field256.hpp. Vectors come from
// gen_field_vectors.py (python big ints — an implementation independent of
// the C++ under test). Native build (g++), not cdt-cpp:
//   g++ -O2 -o test_field256 test_field256.cpp && ./test_field256 < vectors.txt
#include "field256.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>

// parse hex (any length ≤ 128 chars) into little-endian limb array
static int hexval( char c ) {
   if ( c >= '0' && c <= '9' ) return c - '0';
   if ( c >= 'a' && c <= 'f' ) return c - 'a' + 10;
   if ( c >= 'A' && c <= 'F' ) return c - 'A' + 10;
   return -1;
}
static void parse_hex( const char* s, uint64_t* limbs, int nlimbs ) {
   memset( limbs, 0, nlimbs * sizeof(uint64_t) );
   int len = (int)strlen( s );
   for ( int i = 0; i < len; ++i ) {
      int v = hexval( s[len - 1 - i] );
      if ( v < 0 ) { fprintf( stderr, "bad hex %s\n", s ); exit( 2 ); }
      limbs[i / 16] |= (uint64_t)v << ( (i % 16) * 4 );
   }
}

static long g_pass = 0, g_fail = 0;
static void report( const char* group, const char* detail ) {
   ++g_fail;
   fprintf( stderr, "FAIL %-5s %s\n", group, detail ? detail : "" );
}

int main() {
   {   // BE round-trip gate: from_be(to_be(x)) must be the identity — this
      // exact bug (limb-reversed to_be) once broke every BE serialization
      const char* edges[] = {
         "0000000000000000000000000000000000000000000000000000000000000000", // PUBLIC-CONSTANT zero test vector
         "0000000000000000000000000000000000000000000000000000000000000001", // PUBLIC-CONSTANT one test vector
         "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", // PUBLIC-CONSTANT max test vector
         "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20", // PUBLIC-CONSTANT pattern test vector
         "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001", // PUBLIC-CONSTANT BN254 scalar field (template l.28)
      };
      for ( const char* e : edges ) {
         u256 v, w; unsigned char be[32];
         parse_hex( e, v, 4 );
         f256_to_be( be, v );
         f256_from_be( w, be );
         if ( !f256_eq( v, w ) ) { fprintf( stderr, "FAIL BE-ROUNDTRIP %s\n", e ); return 1; }
         ++g_pass;
      }
   }
   FILE* f = stdin;
   char line[1024];
   long lineno = 0;
   while ( fgets( line, sizeof line, f ) ) {
      ++lineno;
      char op[16]; char a1[200], a2[200], a3[200], a4[200];
      if ( sscanf( line, "%15s %199s %199s %199s %199s", op, a1, a2, a3, a4 ) < 3 ) continue;

      if ( !strcmp( op, "M64" ) ) {
         uint64_t a, b, hi, lo, ehi, elo;
         parse_hex( a1, &a, 1 ); parse_hex( a2, &b, 1 );
         parse_hex( a3, &ehi, 1 ); parse_hex( a4, &elo, 1 );
         mul64( a, b, &hi, &lo );
         if ( hi != ehi || lo != elo ) { report( "M64", a1 ); return 1; }
         ++g_pass;
      } else if ( !strcmp( op, "M512" ) ) {
         uint64_t a[4], b[4], p[8], ep[8];
         parse_hex( a1, a, 4 ); parse_hex( a2, b, 4 ); parse_hex( a3, ep, 8 );
         mul512( a, b, p );
         if ( memcmp( p, ep, sizeof p ) ) { report( "M512", a1 ); return 1; }
         ++g_pass;
      } else if ( !strcmp( op, "MOD" ) ) {
         uint64_t x[8], m[4], r[4], er[4];
         parse_hex( a1, x, 8 ); parse_hex( a2, m, 4 ); parse_hex( a3, er, 4 );
         mod_oracle( x, m, r );
         if ( memcmp( r, er, sizeof r ) ) { report( "MOD", a1 ); return 1; }
         ++g_pass;
      } else if ( !strcmp( op, "R2" ) ) {
         u256 m, er; fctx c;
         parse_hex( a1, m, 4 ); parse_hex( a2, er, 4 );
         fctx_init( &c, m );
         if ( !f256_eq( c.r2, er ) ) { report( "R2", a1 ); return 1; }
         ++g_pass;
      } else if ( !strcmp( op, "FNEG" ) ) {
         u256 m, a, er, r; fctx c;
         parse_hex( a1, m, 4 ); parse_hex( a2, a, 4 ); parse_hex( a3, er, 4 );
         fctx_init( &c, m );
         f_neg( &c, a, r );
         if ( !f256_eq( r, er ) ) { report( "FNEG", a2 ); return 1; }
         ++g_pass;
      } else if ( !strcmp( op, "FPOW" ) ) {
         u256 m, a, e, er, r; fctx c;
         parse_hex( a1, m, 4 ); parse_hex( a2, a, 4 ); parse_hex( a3, e, 4 ); parse_hex( a4, er, 4 );
         fctx_init( &c, m );
         f_pow( &c, a, e, r );
         if ( !f256_eq( r, er ) ) { report( "FPOW", a2 ); return 1; }
         ++g_pass;
      } else if ( !strcmp( op, "BINV" ) ) {
         u256 m, v[3]; fctx c;
         char e1[200], e2[200], e3[200];
         if ( sscanf( line, "%*s %*s %*s %*s %*s %199s %199s %199s", e1, e2, e3 ) != 3 ) { fprintf( stderr, "bad BINV line %ld\n", lineno ); return 2; }
         parse_hex( a1, m, 4 ); parse_hex( a2, v[0], 4 ); parse_hex( a3, v[1], 4 ); parse_hex( a4, v[2], 4 );
         fctx_init( &c, m );
         f_batch_invert( &c, v, 3 );
         int bad = 0;
         u256 exp;
         parse_hex( e1, exp, 4 ); bad |= !f256_eq( v[0], exp );
         parse_hex( e2, exp, 4 ); bad |= !f256_eq( v[1], exp );
         parse_hex( e3, exp, 4 ); bad |= !f256_eq( v[2], exp );
         if ( bad ) { report( "BINV", a2 ); return 1; }
         ++g_pass;
      } else if ( !strcmp( op, "FMUL" ) || !strcmp( op, "FADD" ) || !strcmp( op, "FSUB" ) ) {
         u256 m, a, b, er, r; fctx c;
         parse_hex( a1, m, 4 ); parse_hex( a2, a, 4 ); parse_hex( a3, b, 4 ); parse_hex( a4, er, 4 );
         fctx_init( &c, m );
         if      ( !strcmp( op, "FMUL" ) ) f_mul( &c, a, b, r );
         else if ( !strcmp( op, "FADD" ) ) f_add( &c, a, b, r );
         else                              f_sub( &c, a, b, r );
         if ( !f256_eq( r, er ) ) { report( op, a2 ); return 1; }
         ++g_pass;
      }
   }
   printf( "field256: %ld passed, %ld failed\n", g_pass, g_fail );
   return g_fail ? 1 : 0;
}
