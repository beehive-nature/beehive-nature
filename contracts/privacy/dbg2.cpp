#include "poseidon2.hpp"
#include <cstdio>
#include <cstdlib>
int main() {
   poseidon2_ctx pc; unsigned char q[32];
   const char* QHEX = "30644E72E131A029B85045B68181585D97816A916871CA8D3C208C16D87CFD45"; // PUBLIC-CONSTANT BN254 scalar field q
   for (int i = 0; i < 32; ++i) { char b2[3] = {QHEX[2*i],QHEX[2*i+1],0}; q[i] = (unsigned char)strtoul(b2,0,16); }
   poseidon2_ctx_init(&pc, q);
   u256 a, b, out; unsigned char ba[32]={0}, bb[32]={0};
   ba[31]=1; bb[31]=2;
   f256_from_be(a, ba); f256_from_be(b, bb);
   poseidon2(&pc, a, b, out);
   unsigned char ob[32]; f256_to_be(ob, out);
   for (int i=0;i<32;++i) printf("%02x", ob[i]); printf("\n");
}
