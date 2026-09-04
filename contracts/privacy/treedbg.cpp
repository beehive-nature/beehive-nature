#include <eosio/eosio.hpp>
#include <eosio/crypto_ext.hpp>
#include <vector>
#include "plonk_verify.hpp"
#include "poseidon2.hpp"
#include "tree_zeros.hpp"
using namespace eosio;
class [[eosio::contract("treedbg")]] treedbg : public contract {
public:
   using contract::contract;
   struct [[eosio::table("st"), eosio::contract("treedbg")]] st_row {
      uint64_t id; uint64_t next_index;
      std::vector<uint8_t> f0, f1, f2, root;
      uint64_t primary_key()const { return id; }
   };
   using st_index = eosio::multi_index<"st"_n, st_row>;
   [[eosio::action]] void ins( const checksum256& leaf ) {
      // EXACTLY the contract tree_insert body (copy), 20 levels, stateful row
      st_index st( get_self(), get_self().value );
      auto itr = st.find( 0 );
      static poseidon2_ctx pc_scratch;
      poseidon2_ctx* pc = &pc_scratch;
      poseidon2_ctx_init( pc, PL_Q );
      u256 cur, z, h;
      u256 filled[20];
      uint64_t idx;
      unsigned char be[32];
      if ( itr == st.end() ) {
         for ( int i = 0; i < 20; ++i ) { f256_from_be( filled[i], ZERO_[i] ); }
         idx = 0;
      } else {
         f256_from_be( filled[0], itr->f0.data() );
         f256_from_be( filled[1], itr->f1.data() );
         f256_from_be( filled[2], itr->f2.data() );
         idx = itr->next_index;
      }
      const auto lb = leaf.extract_as_byte_array();
      f256_from_be( cur, lb.data() );
      eosio::check( idx < (1ull << 20), "full" );
      for ( int i = 0; i < 20; ++i ) {
         if ( ((idx >> i) & 1ull) == 0 ) {
            f256_from_be( z, ZERO_[i] );
            f256_copy( filled[i], cur );
            poseidon2( pc, cur, z, cur );
         } else {
            poseidon2( pc, filled[i], cur, h );
            f256_copy( cur, h );
         }
      }
      auto put = []( std::vector<uint8_t>& v, const unsigned char* p, int n ) { v.assign( p, p + n ); };
      if ( itr == st.end() ) {
         st.emplace( get_self(), [&]( auto& r ) {
            r.id = 0; r.next_index = idx + 1;
            f256_to_be( be, filled[0] ); put( r.f0, be, 32 );
            f256_to_be( be, filled[1] ); put( r.f1, be, 32 );
            f256_to_be( be, filled[2] ); put( r.f2, be, 32 );
            f256_to_be( be, cur );       put( r.root, be, 32 );
         });
      } else {
         st.modify( itr, get_self(), [&]( auto& r ) {
            r.next_index = idx + 1;
            f256_to_be( be, filled[0] ); put( r.f0, be, 32 );
            f256_to_be( be, filled[1] ); put( r.f1, be, 32 );
            f256_to_be( be, filled[2] ); put( r.f2, be, 32 );
            f256_to_be( be, cur );       put( r.root, be, 32 );
         });
      }
   }
};
