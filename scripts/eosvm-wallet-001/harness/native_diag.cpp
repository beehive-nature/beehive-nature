// native_diag.cpp — EOSVM-WALLET-001 diagnostic: the component's verifier
// headers compiled NATIVELY (x64), with the same node-oracle host functions,
// dumping every intermediate the final pairing rides. Compared against the
// wasm path's behavior to localize the first divergence.
// WHERE it runs: WSL, from harness/. Not part of the measured suite.
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <fstream>
#include <sstream>
#include <vector>
#include <chrono>

// intrinsic DEFINITIONS (declarations live in nativeshim/eosio/*.hpp);
// implementations call the node oracle exactly like the wasm harness host
namespace eosio { int32_t oracle_call( const char* mode, const std::string& inhex, std::string& outhex ); }
static std::string hexn_( const char* p, int n ) {
   std::string s; char b[3];
   for ( int i = 0; i < n; ++i ) { sprintf( b, "%02x", (uint8_t)p[i] ); s += b; }
   return s;
}
static bool fill( const std::string& out, char* r, int n ) {
   for ( int i = 0; i < n; ++i ) {
      char bb[3] = { out[2*i], out[2*i+1], 0 };
      r[i] = (char)strtoul( bb, nullptr, 16 );
   }
   return true;
}
namespace eosio {
int32_t alt_bn128_add( const char* a, uint32_t, const char* b, uint32_t, char* r, uint32_t ) {
   std::string out;
   return oracle_call( "g1add", hexn_( a, 64 ) + hexn_( b, 64 ), out ) && fill( out, r, 64 ) ? 0 : -1;
}
int32_t alt_bn128_mul( const char* g, uint32_t, const char* s, uint32_t, char* r, uint32_t ) {
   std::string out;
   return oracle_call( "g1mul", hexn_( g, 64 ) + hexn_( s, 32 ), out ) && fill( out, r, 64 ) ? 0 : -1;
}
int32_t alt_bn128_pair( const char* pairs, uint32_t len ) {
   std::string out;
   return oracle_call( "pair", hexn_( pairs, (int)len ), out )
      ? (int32_t)strtol( out.c_str(), nullptr, 10 ) : -1;
}
}

// keccak via node (js-sha3), same as the harness host

int32_t eosio::oracle_call( const char* mode, const std::string& inhex, std::string& outhex ) {
   FILE* f = fopen( "/tmp/nd_curve.hex", "w" );
   if ( !f ) return 0;
   fwrite( inhex.data(), 1, inhex.size(), f ); fclose( f );
   std::string cmd = std::string( "node '" )
                   + ( getenv( "EVB_PAIR_ORACLE" ) ? getenv( "EVB_PAIR_ORACLE" ) : "oracle.js" )
                   + "' " + mode + " < /tmp/nd_curve.hex";
   FILE* r = popen( cmd.c_str(), "r" );
   if ( !r ) return 0;
   char line[256] = {0};
   bool ok = fgets( line, sizeof line, r ) != nullptr;
   pclose( r );
   if ( !ok ) return 0;
   outhex = line;
   while ( !outhex.empty() && ( outhex.back() == '\n' || outhex.back() == '\r' ) ) outhex.pop_back();
   return !outhex.empty() && outhex[0] != '-';
}
static void kec_node( const unsigned char* in, unsigned len, unsigned char out[32] ) {
   FILE* f = fopen( "/tmp/nd_kec.hex", "w" );
   char b[3];
   for ( unsigned i = 0; i < len; ++i ) { sprintf( b, "%02x", in[i] ); fputs( b, f ); }
   fclose( f );
   FILE* r = popen( "node keccak_oracle.js < /tmp/nd_kec.hex", "r" );
   char line[80] = {0};
   if ( r ) { if ( !fgets( line, sizeof line, r ) ) line[0] = 0; pclose( r ); }
   for ( int i = 0; i < 32; ++i ) {
      char bb[3] = { line[2*i], line[2*i+1], 0 };
      out[i] = (unsigned char)strtoul( bb, nullptr, 16 );
   }
}

#include "../component/plonk_verify_count.hpp"

static std::string hx( const unsigned char* p, int n ) {
   std::string s; char b[3];
   for ( int i = 0; i < n; ++i ) { sprintf( b, "%02x", p[i] ); s += b; }
   return s;
}

int main( int argc, char** argv ) {
   if ( argc < 3 ) { fprintf( stderr, "usage: native_diag proof.hex pubs.hex\n" ); return 2; }
   std::ifstream pf( argv[1] ), qf( argv[2] );
   std::string ph, qh, line;
   while ( pf >> line ) ph += line;
   while ( qf >> line ) qh += line;
   if ( ph.size() != 1536 || qh.size() != 192 ) { fprintf( stderr, "bad fixture sizes %zu/%zu\n", ph.size(), qh.size() ); return 2; }
   std::vector<unsigned char> proof( 768 ), pubs( 96 );
   for ( int i = 0; i < 768; ++i ) proof[i] = (unsigned char)strtoul( ph.substr( 2*i, 2 ).c_str(), nullptr, 16 );
   for ( int i = 0; i < 96; ++i ) pubs[i] = (unsigned char)strtoul( qh.substr( 2*i, 2 ).c_str(), nullptr, 16 );

   plonk_ctx ctx; plonk_ctx_init( &ctx );
   printf( "phase1: %d\n", plonk_checkProofData( &ctx, proof.data() ) );
   pl_chals ch;
   calculateChallenges( &ctx, kec_node, proof.data(), pubs.data(), &ch );
   printf( "beta=%s\ngamma=%s\nalpha=%s\nxi=%s\nu=%s\n",
           hx( (unsigned char*)ch.beta, 32 ).c_str() ? "" : "",
           "", "", "", "" ); // placeholders; print real BE below
   unsigned char b32[32];
   f256_to_be( b32, ch.beta );   printf( "beta=%s\n", hx( b32, 32 ).c_str() );
   f256_to_be( b32, ch.gamma );  printf( "gamma=%s\n", hx( b32, 32 ).c_str() );
   f256_to_be( b32, ch.xi );     printf( "xi=%s\n", hx( b32, 32 ).c_str() );
   f256_to_be( b32, ch.u );      printf( "u=%s\n", hx( b32, 32 ).c_str() );

   pl_scalars sc;
   pl_sf( &ctx, pl_word( proof.data(), 18 ), sc.a );
   pl_sf( &ctx, pl_word( proof.data(), 19 ), sc.b );
   pl_sf( &ctx, pl_word( proof.data(), 20 ), sc.c );
   pl_sf( &ctx, pl_word( proof.data(), 21 ), sc.s1 );
   pl_sf( &ctx, pl_word( proof.data(), 22 ), sc.s2 );
   pl_sf( &ctx, pl_word( proof.data(), 23 ), sc.zw );
   calculateLagrange( &ctx, &ch, sc.L );
   calculatePI( &ctx, sc.L, pubs.data(), sc.pi );
   calculateR0( &ctx, &ch, &sc );
   calculateD_scalars( &ctx, &ch, &sc );
   calculateE_scalar( &ctx, &ch, &sc );
   f256_to_be( b32, sc.r0 ); printf( "r0=%s\n", hx( b32, 32 ).c_str() );
   f256_to_be( b32, sc.e );  printf( "e=%s\n", hx( b32, 32 ).c_str() );

   unsigned char D[64], F[64], E[64];
   calculateD( &ctx, &ch, &sc, proof.data(), D );
   calculateF( &ctx, &ch, &sc, proof.data(), D, F );
   calculateE( &sc, E );
   printf( "D=%s\nF=%s\nE=%s\n", hx( D, 64 ).c_str(), hx( F, 64 ).c_str(), hx( E, 64 ).c_str() );
   int r = checkPairing( &ctx, &ch, proof.data(), F, E );
   printf( "checkPairing=%d\n", r );
   return 0;
}
