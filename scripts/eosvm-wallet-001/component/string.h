// string.h — EOSVM-WALLET-001 freestanding shim: declarations only, so the
// verbatim estate headers (which include <string.h>) compile for wasm32
// with -nostdlib. The implementations live in zkr_component.cpp.
#pragma once
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif
void* memcpy( void* d, const void* s, size_t n );
void* memset( void* d, int c, size_t n );
int   memcmp( const void* a, const void* b, size_t n );
size_t strlen( const char* s );
#ifdef __cplusplus
}
#endif
