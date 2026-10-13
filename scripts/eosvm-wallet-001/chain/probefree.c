// probefree.c — EOSVM-WALLET-001 chain behavior probe, FREE-STANDING build
// (CDT 4.1.1's LTO linker spins on this box — receipted; and crypto-feature
// activation is blocked — receipted — so this probe uses ONLY base
// intrinsics, which are always available). Actions (raw varint ABI):
//   spin(n:u64)      pure-wasm CPU loop; stores n via db (the workload for
//                    interp/JIT/OC billed-CPU comparison)
//   put(id:u64,v:u64)    ordinary db row write
//   writethrow(id:u64)   db write THEN assert-fail (rollback probe)
//   growtrap(pages:u32)  memory.grow until the cap traps (memory probe)
//   noop()                baseline
#include <stdint.h>

extern void eosio_assert( uint32_t test, const char* msg );
extern uint32_t action_data_size( void );
extern uint32_t read_action_data( uint32_t msg, uint32_t len );
extern void require_auth( uint64_t account );
extern uint32_t current_time( void );
extern int32_t db_store_i64( uint64_t scope, uint64_t table, uint64_t payer,
                             uint64_t key, const char* value, uint32_t len );
extern void db_update_i64( int32_t itr, uint64_t payer, const char* value, uint32_t len );
extern int32_t db_find_i64( uint64_t code, uint64_t scope, uint64_t table, uint64_t key );
extern int32_t db_get_i64( int32_t itr, char* value, uint32_t len );

static uint64_t name5( const char* s ) {
   uint64_t v = 0;
   for ( int i = 0; i < 5; ++i ) v |= (uint64_t)( s[i] - 97 + 1 ) << ( 59 - 5 * i );
   return v;
}
static uint64_t name4( const char* s ) {
   uint64_t v = 0;
   for ( int i = 0; i < 4; ++i ) v |= (uint64_t)( s[i] - 97 + 1 ) << ( 59 - 5 * i );
   return v;
}
static uint64_t recv_;   // set by apply

static void put_row( uint64_t id, uint64_t val ) {
   int32_t it = db_find_i64( recv_, recv_, name4( "rows" ), id );
   if ( it < 0 ) db_store_i64( recv_, name4( "rows" ), recv_, id, (const char*)&val, 8 );
   else          db_update_i64( it, recv_, (const char*)&val, 8 );
}

void apply( uint64_t receiver, uint64_t code, uint64_t action ) {
   recv_ = receiver; (void)code;
   char buf[16] = {0};
   uint32_t n = action_data_size();
   if ( n > 16 ) n = 16;
   read_action_data( (uint32_t)(uintptr_t)buf, n );

   if ( action == name5( "probe" ) ) return;   // noop alias

   if ( action == name4( "spin" ) ) {          // u64 arg
      require_auth( recv_ );
      // ABI uint64 = 8-byte LITTLE-ENDIAN (not varint — the first run
      // decoded 0 and every spin no-op'd at ~230µs; receipted)
      uint64_t v = *(uint64_t*)buf;
      uint64_t s = 0;
      for ( uint64_t k = 0; k < v; ++k ) s += k ^ ( k >> 3 );
      put_row( 0, s );                          // defeat optimization; receipt
      return;
   }
   if ( action == name4( "putx" ) ) {          // u64,u64
      require_auth( recv_ );
      put_row( *(uint64_t*)buf, *(uint64_t*)( buf + 8 ) );
      return;
   }
   if ( action == name4( "wrth" ) ) {          // write then throw (rollback)
      put_row( *(uint64_t*)buf, 42 );
      eosio_assert( 0, "probe: intended throw after write" );
      return;
   }
   if ( action == name4( "grow" ) ) {          // memory.grow to cap (traps)
      uint32_t pages = *(uint32_t*)buf;
      volatile char sink = 0;
      char* p = (char*)__builtin_wasm_memory_grow( 0, pages );
      if ( (uintptr_t)p == (uintptr_t)-1 ) eosio_assert( 0, "probe: grow refused" );
      for ( uint32_t i = 0; i < pages * 65536; i += 4096 ) sink ^= p[i];
      put_row( 1, pages );
      return;
   }
}
