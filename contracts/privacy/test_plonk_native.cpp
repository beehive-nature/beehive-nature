// test_plonk_native.cpp — the scalar phases vs the BigInt oracle.
// Native (g++ -DPLONK_NATIVE_TEST): runs checkProofData + phases 2-8 scalar
// side over the REAL vk + REAL proof and compares every value against
// oracle_scalars.js output. The point phases (D/F/E assembly, pairing) are
// chain-only — their acceptance test is the on-chain run.
//   g++ -O2 -DPLONK_NATIVE_TEST -o test_plonk test_plonk_native.cpp
//   ./test_plonk proof.hex pubs.hex oraclescalars.txt
#define PLONK_NATIVE_TEST 1
#include "plonk_verify.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

// ── keccak-256 (original padding 0x01 — the EVM/EOSIO variant) ──
static uint64_t RC[24] = {
   0x0000000000000001ull,0x0000000000008082ull,0x800000000000808aull,0x8000000080008000ull,
   0x000000000000808bull,0x0000000080000001ull,0x8000000080008081ull,0x8000000000008009ull,
   0x000000000000008aull,0x0000000000000088ull,0x0000000080008009ull,0x000000008000000aull,
   0x000000008000808bull,0x800000000000008bull,0x8000000000008089ull,0x8000000000008003ull,
   0x8000000000008002ull,0x8000000000000080ull,0x000000000000800aull,0x800000008000000aull,
   0x8000000080008081ull,0x8000000000008080ull,0x0000000080000001ull,0x8000000080008008ull };
static int ROTC[25] = { 0,1,62,28,27,          // r[x][y] row-major (lane x+5y)
                        36,44,6,55,20,
                        3,10,43,25,39,
                        41,45,15,21,8,
                        18,2,61,56,14 };
static inline uint64_t rotl64( uint64_t v, int n ) { return n ? ((v << n) | (v >> (64 - n))) : v; }
static void keccak_f( uint64_t A[25] ) {
   for ( int round = 0; round < 24; ++round ) {
      uint64_t C[5], D[5], B[25];
      for ( int x = 0; x < 5; ++x ) C[x] = A[x] ^ A[x+5] ^ A[x+10] ^ A[x+15] ^ A[x+20];
      for ( int x = 0; x < 5; ++x ) D[x] = C[(x+4)%5] ^ rotl64( C[(x+1)%5], 1 );
      for ( int x = 0; x < 5; ++x ) for ( int y = 0; y < 5; ++y ) A[x+5*y] ^= D[x];
      for ( int x = 0; x < 5; ++x ) for ( int y = 0; y < 5; ++y )
         B[y + 5*((2*x + 3*y) % 5)] = rotl64( A[x + 5*y], ROTC[x + 5*y] );
      for ( int x = 0; x < 5; ++x ) for ( int y = 0; y < 5; ++y ) A[x+5*y] = B[x+5*y];
      for ( int y = 0; y < 5; ++y ) {           // χ with the row cached (no clobbering)
         uint64_t a0=A[0+5*y], a1=A[1+5*y], a2=A[2+5*y], a3=A[3+5*y], a4=A[4+5*y];
         A[0+5*y] = a0 ^ ((~a1) & a2);
         A[1+5*y] = a1 ^ ((~a2) & a3);
         A[2+5*y] = a2 ^ ((~a3) & a4);
         A[3+5*y] = a3 ^ ((~a4) & a0);
         A[4+5*y] = a4 ^ ((~a0) & a1);
      }
      A[0] ^= RC[round];
   }
}
static void keccak256_nat( const unsigned char* in, unsigned len, unsigned char out[32] ) {
   uint64_t st[25]; memset( st, 0, sizeof st );
   unsigned char block[136]; // rate 1088 bits
   unsigned off = 0;
   while ( len - off >= 136 ) {
      for ( int i = 0; i < 17; ++i ) {
         uint64_t w = 0;
         for ( int b = 7; b >= 0; --b ) w = (w << 8) | in[off + i*8 + b];
         st[i] ^= w;
      }
      keccak_f( st ); off += 136;
   }
   memset( block, 0, sizeof block );
   memcpy( block, in + off, len - off );
   block[len - off] = 0x01;                       // keccak (not SHA3)
   block[135] |= 0x80;
   for ( int i = 0; i < 17; ++i ) {
      uint64_t w = 0;
      for ( int b = 7; b >= 0; --b ) w = (w << 8) | block[i*8 + b];
      st[i] ^= w;
   }
   keccak_f( st );
   for ( int i = 0; i < 4; ++i )
      for ( int b = 0; b < 8; ++b ) out[i*8 + b] = (unsigned char)(st[i] >> (8*b));
}

static int hexv( char c ) {
   if ( c >= '0' && c <= '9' ) return c - '0';
   if ( c >= 'a' && c <= 'f' ) return c - 'a' + 10;
   if ( c >= 'A' && c <= 'F' ) return c - 'A' + 10;
   return -1;
}
static std::vector<unsigned char> read_hex_file( const char* path ) {
   FILE* f = fopen( path, "r" );
   if ( !f ) { fprintf( stderr, "open %s\n", path ); exit( 2 ); }
   std::vector<unsigned char> out;
   int hi = -1;
   // the FIRST whitespace-delimited token only — fixture lines carry a
   // same-line hex-law marker after the hex (marker letters would otherwise
   // be consumed as nibbles)
   for ( int c = fgetc( f ); c != EOF; c = fgetc( f ) ) {
      if ( c == '\n' || c == '\r' || c == ' ' || c == '\t' ) {
         if ( !out.empty() || hi >= 0 ) break;
         continue;
      }
      int v = hexv( (char)c );
      if ( v < 0 ) { fprintf( stderr, "bad hex in %s\n", path ); exit( 2 ); }
      if ( hi < 0 ) hi = v; else { out.push_back( (unsigned char)((hi << 4) | v) ); hi = -1; }
   }
   fclose( f );
   return out;
}

static long g_ok = 0, g_bad = 0;
static void chk( const char* name, const u256 got, const char* want_hex ) {
   unsigned char be[33]; be[32] = 0;
   f256_to_be( be, got );
   char buf[65];
   for ( int i = 0; i < 32; ++i ) sprintf( buf + 2*i, "%02x", be[i] );
   if ( !strcmp( buf, want_hex ) ) { ++g_ok; }
   else { ++g_bad; fprintf( stderr, "MISMATCH %-7s got %s want %s\n", name, buf, want_hex ); }
}

int main( int argc, char** argv ) {
   if ( argc >= 2 && !strcmp( argv[1], "--keccak" ) ) {   // self-test vs js-sha3 vectors
      unsigned char h[32];
      keccak256_nat( (const unsigned char*)"", 0, h );
      printf( "empty %s\n", !memcmp( h, "\xc5\xd2\x46\x01\x86\xf7\x23\x3c\x92\x7e\x7d\xb2\xdc\xc7\x03\xc0\xe5\x00\xb6\x53\xca\x82\x27\x3b\x7b\xfa\xd8\x04\x5d\x85\xa4\x70", 32 ) ? "OK" : "FAIL" );
      keccak256_nat( (const unsigned char*)"abc", 3, h );
      printf( "abc   %s\n", !memcmp( h, "\x4e\x03\x65\x7a\xea\x45\xa9\x4f\xc7\xd4\x7b\xa8\x26\xc8\xd6\x67\xc0\xd1\xe6\xe3\x3a\x64\xa0\x36\xec\x44\xf5\x8f\xa1\x2d\x6c\x45", 32 ) ? "OK" : "FAIL" );
      return 0;
   }
   if ( argc < 4 ) { fprintf( stderr, "usage: %s proof.hex pubs.hex oraclescalars.txt\n", argv[0] ); return 2; }
   std::vector<unsigned char> proof = read_hex_file( argv[1] );
   std::vector<unsigned char> pubs  = read_hex_file( argv[2] );
   if ( proof.size() != 768 || pubs.size() != 32 * N_PUBLIC ) { fprintf( stderr, "bad input sizes %zu %zu\n", proof.size(), pubs.size() ); return 2; }

   // oracle file: KEY hex lines
   FILE* f = fopen( argv[3], "r" );
   if ( !f ) { fprintf( stderr, "open %s\n", argv[3] ); return 2; }
   char key[64], hex[128];
   static char o_beta[128], o_gamma[128], o_alpha[128], o_alpha2[128], o_xi[128], o_betaxi[128],
               o_xin[128], o_zh[128], o_v1[128], o_v2[128], o_v3[128], o_v4[128], o_v5[128],
               o_u[128], o_L1[128], o_L2[128], o_L3[128], o_L4[128], o_pi[128], o_r0[128], o_d2[128], o_d3[128], o_e[128];
   char oline[256];
   while ( fgets( oline, sizeof oline, f ) ) {
      if ( sscanf( oline, "%63s %127s", key, hex ) != 2 ) continue;   // per LINE — fixture markers must not shift the key/hex pairing
      if (!strcmp(key,"BETA")) strcpy(o_beta,hex);   if (!strcmp(key,"GAMMA")) strcpy(o_gamma,hex);
      if (!strcmp(key,"ALPHA")) strcpy(o_alpha,hex); if (!strcmp(key,"ALPHA2")) strcpy(o_alpha2,hex);
      if (!strcmp(key,"XI")) strcpy(o_xi,hex);       if (!strcmp(key,"BETAXI")) strcpy(o_betaxi,hex);
      if (!strcmp(key,"XIN")) strcpy(o_xin,hex);     if (!strcmp(key,"ZH")) strcpy(o_zh,hex);
      if (!strcmp(key,"V1")) strcpy(o_v1,hex);       if (!strcmp(key,"V2")) strcpy(o_v2,hex);
      if (!strcmp(key,"V3")) strcpy(o_v3,hex);       if (!strcmp(key,"V4")) strcpy(o_v4,hex);
      if (!strcmp(key,"V5")) strcpy(o_v5,hex);       if (!strcmp(key,"U")) strcpy(o_u,hex);
      if (!strcmp(key,"L1")) strcpy(o_L1,hex);       if (!strcmp(key,"L2")) strcpy(o_L2,hex);
      if (!strcmp(key,"L3")) strcpy(o_L3,hex);       if (!strcmp(key,"L4")) strcpy(o_L4,hex);
      if (!strcmp(key,"PI")) strcpy(o_pi,hex);       if (!strcmp(key,"R0")) strcpy(o_r0,hex);
      if (!strcmp(key,"D2")) strcpy(o_d2,hex);       if (!strcmp(key,"D3")) strcpy(o_d3,hex);
      if (!strcmp(key,"E")) strcpy(o_e,hex);
   }
   fclose( f );

   plonk_ctx ctx; plonk_ctx_init( &ctx );
   if ( !plonk_checkProofData( &ctx, proof.data() ) ) { fprintf( stderr, "checkProofData rejected the REAL proof\n" ); return 1; }
   ++g_ok;

   pl_chals ch; calculateChallenges( &ctx, keccak256_nat, proof.data(), pubs.data(), &ch );
   {   // sanity probe: zh must equal xin−1 by construction
      u256 d, one; f256_set_u64( one, 1 );
      f_sub( &ctx.fq, ch.xin, one, d );
      unsigned char b1[32], b2[32]; f256_to_be( b1, ch.zh ); f256_to_be( b2, d );
      char s1[65], s2[65];
      for ( int i = 0; i < 32; ++i ) { sprintf( s1 + 2*i, "%02x", b1[i] ); sprintf( s2 + 2*i, "%02x", b2[i] ); }
      if ( strcmp( s1, s2 ) ) fprintf( stderr, "ZH-PROBE zh=%s xin-1=%s\n", s1, s2 );
      else ++g_ok;
   }
   chk( "beta", ch.beta, o_beta );       chk( "gamma", ch.gamma, o_gamma );
   chk( "alpha", ch.alpha, o_alpha );    chk( "alpha2", ch.alpha2, o_alpha2 );
   chk( "xi", ch.xi, o_xi );             chk( "betaxi", ch.betaxi, o_betaxi );
   chk( "xin", ch.xin, o_xin );          chk( "zh", ch.zh, o_zh );
   chk( "v1", ch.v1, o_v1 );             chk( "v2", ch.v2, o_v2 );
   chk( "v3", ch.v3, o_v3 );             chk( "v4", ch.v4, o_v4 );
   chk( "v5", ch.v5, o_v5 );             chk( "u", ch.u, o_u );

   pl_scalars sc;
   pl_sf( &ctx, pl_word( proof.data(), 18 ), sc.a );
   pl_sf( &ctx, pl_word( proof.data(), 19 ), sc.b );
   pl_sf( &ctx, pl_word( proof.data(), 20 ), sc.c );
   pl_sf( &ctx, pl_word( proof.data(), 21 ), sc.s1 );
   pl_sf( &ctx, pl_word( proof.data(), 22 ), sc.s2 );
   pl_sf( &ctx, pl_word( proof.data(), 23 ), sc.zw );
   calculateLagrange( &ctx, &ch, sc.L );
   chk( "L1", sc.L[0], o_L1 );           chk( "L2", sc.L[1], o_L2 );
   chk( "L3", sc.L[2], o_L3 );           chk( "L4", sc.L[3], o_L4 );
   calculatePI( &ctx, sc.L, pubs.data(), sc.pi );
   chk( "PI", sc.pi, o_pi );
   calculateR0( &ctx, &ch, &sc );
   chk( "r0", sc.r0, o_r0 );
   calculateD_scalars( &ctx, &ch, &sc );
   chk( "d2", sc.d2, o_d2 );             chk( "d3", sc.d3, o_d3 );
   calculateE_scalar( &ctx, &ch, &sc );
   chk( "e", sc.e, o_e );

   printf( "plonk scalar phases: %ld passed, %ld failed\n", g_ok, g_bad );
   return g_bad ? 1 : 0;
}
