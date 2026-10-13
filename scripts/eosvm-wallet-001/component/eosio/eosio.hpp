// eosio/eosio.hpp — EOSVM-WALLET-001 freestanding shim. The real CDT header
// is replaced by exactly what the verbatim verifier headers use from it:
// eosio::check. Everything else is absent — the component is not a contract.
#pragma once
namespace eosio {
   inline void check( bool cond, const char* msg ) {
      if ( !cond ) __builtin_trap();   // a trap is a refusal at the embedder's
   }                                   // boundary — never an accept
}
