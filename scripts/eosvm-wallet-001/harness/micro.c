// micro.c — EOSVM-WALLET-001 engine micro-workloads (freestanding wasm32).
// Host imports (module "env", all offsets raw i32 — the harness rebases):
//   keccak256(in: i32, len: i32, out: i32)
//   db_get(k: i32, kl: i32, v: i32, vl: i32) -> i32   (-1 miss, else stored len)
//   db_put(k: i32, kl: i32, v: i32, vl: i32) -> i32
// Exports: loop, kecloop, memtouch, dbloop, grow, trapdiv, last
#include <stdint.h>

extern void keccak256( char* in, uint32_t len, char* out );
extern int32_t db_get( char* k, uint32_t kl, char* v, uint32_t vl );
extern int32_t db_put( char* k, uint32_t kl, char* v, uint32_t vl );

static int32_t g_last = -1;

int32_t loop( int32_t n ) {           // pure-wasm CPU loop
   int32_t s = 0;
   for ( int32_t i = 0; i < n; ++i ) s += i ^ ( i >> 3 );
   return g_last = s;
}

int32_t kecloop( int32_t n, char* buf, int32_t len, char* out ) { // n host keccak calls
   for ( int32_t i = 0; i < n; ++i ) keccak256( buf, (uint32_t)len, out );
   return g_last = out[0];
}

int32_t memtouch( char* p, int32_t bytes ) { // strided write+read
   int32_t s = 0;
   for ( int32_t i = 0; i < bytes; i += 64 ) { p[i] ^= 1; s += p[i]; }
   return g_last = s;
}

int32_t dbloop( int32_t n, char* k, char* v ) { // n x (put + get)
   int32_t s = 0;
   for ( int32_t i = 0; i < n; ++i ) { db_put( k, 4, v, 8 ); s += db_get( k, 4, v, 8 ); }
   return g_last = s;
}

int32_t grow( int32_t pages ) {       // memory.grow — the memory-pressure probe
   int32_t r = __builtin_wasm_memory_grow( 0, (unsigned)pages );
   *(volatile int32_t*)4096 = r;      // the harness reads the result slot
   return g_last = r;
}

int32_t trapdiv( void ) {             // guaranteed runtime trap (sdiv by zero)
   volatile int32_t z = 0;
   return g_last = 1 / z;
}

int32_t last( void ) { return g_last; }
