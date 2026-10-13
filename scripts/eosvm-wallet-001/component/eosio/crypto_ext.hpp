// eosio/crypto_ext.hpp — EOSVM-WALLET-001 freestanding shim. The real CDT
// header's intrinsic wrappers are replaced by DIRECT wasm imports of the
// same three host functions (identical names, module "env", signatures
// verbatim from CDT 4.1.1's internal declarations). Native curve math stays
// on the host — exactly the split the chain runtime itself uses.
#pragma once
#include <stdint.h>
namespace eosio {
__attribute__((import_module("env"), import_name("alt_bn128_add")))
int32_t alt_bn128_add( const char* op1, uint32_t op1_len, const char* op2,
                       uint32_t op2_len, char* result, uint32_t result_len );

__attribute__((import_module("env"), import_name("alt_bn128_mul")))
int32_t alt_bn128_mul( const char* g1, uint32_t g1_len, const char* scalar,
                       uint32_t scalar_len, char* result, uint32_t result_len );

__attribute__((import_module("env"), import_name("alt_bn128_pair")))
int32_t alt_bn128_pair( const char* pairs, uint32_t pairs_len );
}
