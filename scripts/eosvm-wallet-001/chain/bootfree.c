// bootfree.c — EOSVM-WALLET-001 chain bootstrap: a minimal privileged
// contract on eosio exposing action "pfake" (32-byte raw digest action data)
// -> env.preactivate_feature(digest). Spring v1.2.2 genesis state carries no
// feature fields, fresh dev chains activate NOTHING, and the stock bios is
// itself refused until BLS_PRIMITIVES2 resolves — so activation goes through
// the preactivate_feature intrinsic, which controller.cpp:6260 adds to the
// DEFAULT intrinsic whitelist (privileged eosio only). Freestanding build
// (clang-21 wasm32) because CDT's own LTO linker spins on this box.
#include <stdint.h>

extern uint32_t action_data_size( void );
extern uint32_t read_action_data( uint32_t msg, uint32_t len );
extern __attribute__((import_module("env"), import_name("require_auth")))
void require_auth( uint64_t account );
extern __attribute__((import_module("env"), import_name("preactivate_feature")))
void preactivate_feature( const char* digest );

// N("pfake") = p f a k e
static uint64_t name_pfake() {
   uint64_t v = 0;
   const char* s = "pfake";
   for ( int i = 0; i < 5; ++i ) v |= (uint64_t)( s[i] - 'a' + 1 ) << ( 59 - 5 * i );
   return v;
}
static uint64_t name_of5( const char* s ) {
   uint64_t v = 0;
   for ( int i = 0; i < 5; ++i ) v |= (uint64_t)( s[i] - 'a' + 1 ) << ( 59 - 5 * i );
   return v;
}

void apply( uint64_t receiver, uint64_t code, uint64_t action ) {
   (void)receiver; (void)code;
   if ( action != name_pfake() ) return;
   require_auth( name_of5( "eosio" ) );
   char buf[40];
   uint32_t n = action_data_size();
   if ( n < 2 || n > 34 ) return;
   read_action_data( (uint32_t)(uintptr_t)buf, n );
   // ABI "bytes" = varint length prefix + data (len 32 -> single prefix byte)
   uint32_t off = 0, len = (uint8_t)buf[0];
   if ( len > 127 ) return;              // 32 never needs a second varint byte
   off = 1;
   if ( len != 32 || off + len > n ) return;
   preactivate_feature( buf + off );
}
