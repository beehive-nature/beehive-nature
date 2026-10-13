// probe.cpp — EOSVM-WALLET-001 chain-side behavior probe (CDT 4.1.1).
// Actions used by the robustness battery:
//   put(id,val)     — ordinary db write (multi_index)
//   writethrow(id)  — db write THEN eosio::check(false): the rollback probe
//   spin(n)         — bounded pure loop; result stored (timeout workload)
//   grow(mib)       — wasm memory.grow loop: the memory-pressure probe
#include <eosio/eosio.hpp>
#include <vector>

using namespace eosio;

class [[eosio::contract("probe")]] probe : public contract {
public:
   using contract::contract;

   struct [[eosio::table("t"), eosio::contract("probe")]] row {
      uint64_t id;
      uint64_t val;
      uint64_t primary_key() const { return id; }
   };
   using t_index = multi_index<"t"_n, row>;

   [[eosio::action]] void put( uint64_t id, uint64_t val ) {
      require_auth( get_self() );
      t_index t( get_self(), get_self().value );
      auto it = t.find( id );
      if ( it == t.end() ) t.emplace( get_self(), [&]( row& r ){ r.id=id; r.val=val; } );
      else t.modify( it, get_self(), [&]( row& r ){ r.val=val; } );
   }

   [[eosio::action]] void writethrow( uint64_t id ) {
      t_index t( get_self(), get_self().value );
      t.emplace( get_self(), [&]( row& r ){ r.id=id; r.val=42; } ); // must VANISH on throw
      eosio::check( false, "probe: intended throw after write" );
   }

   [[eosio::action]] void spin( uint32_t n ) {
      uint64_t s = 0;
      for ( uint32_t i = 0; i < n; ++i ) s += (uint64_t)i * i;
      t_index t( get_self(), get_self().value );
      auto it = t.find( 0 );
      if ( it == t.end() ) t.emplace( get_self(), [&]( row& r ){ r.id=0; r.val=s; } );
      else t.modify( it, get_self(), [&]( row& r ){ r.val=s; } );
   }

   [[eosio::action]] void grow( uint32_t mib ) {
      // bounded growth: stop just under the chain's 33 MiB wasm-memory cap
      uint32_t pages = 0;
      std::vector<char> buf;
      for ( uint32_t m = 0; m < mib; ++m ) {
         if ( buf.size() > ( 33u << 20 ) - ( 1u << 20 ) ) break;
         buf.assign( buf.size() + ( 1u << 20 ), 1 );
         ++pages;
      }
      t_index t( get_self(), get_self().value );
      auto it = t.find( 1 );
      if ( it == t.end() ) t.emplace( get_self(), [&]( row& r ){ r.id=1; r.val=pages; } );
      else t.modify( it, get_self(), [&]( row& r ){ r.val=pages; } );
   }

   // UNBOUNDED: memory.grow past the cap traps — the transaction fails as a
   // controlled refusal and the row write rolls back (the memory-pressure
   // boundary receipt). Separate action so grow() stays the bounded path.
   [[eosio::action]] void growtrap( uint32_t mib ) {
      std::vector<char> buf;
      for ( uint32_t m = 0; m < mib; ++m )
         buf.assign( buf.size() + ( 1u << 20 ), 1 );   // traps at the cap
      t_index t( get_self(), get_self().value );
      auto it = t.find( 2 );
      if ( it == t.end() ) t.emplace( get_self(), [&]( row& r ){ r.id=2; r.val=mib; } );
      else t.modify( it, get_self(), [&]( row& r ){ r.val=mib; } );
   }
};
