// tpos_adv.cpp — adversarial random-pair poseidon2 differential vs circomlibjs (z2 seat)
#include "poseidon2.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>
int main(int argc, char** argv) {
   FILE* f = fopen(argv[1], "r");
   poseidon2_ctx pc; unsigned char q[32];
   const char* QHEX = "30644E72E131A029B85045B68181585D97816A916871CA8D3C208C16D87CFD45"; // PUBLIC-CONSTANT BN254 scalar field q
   for (int i = 0; i < 32; ++i) { q[i] = (unsigned char)strtol((char[3]){QHEX[2*i],QHEX[2*i+1],0}, 0, 16); }
   poseidon2_ctx_init(&pc, q);
   char la[80], lb[80], lh[80]; int pass = 0, fail = 0;
   while (fscanf(f, "%79s %79s %79s", la, lb, lh) == 3) {
      unsigned char ba[32], bb[32], bh[32];
      for (int i = 0; i < 32; ++i) {
         ba[i] = (unsigned char)strtol((char[3]){la[2*i],la[2*i+1],0},0,16);
         bb[i] = (unsigned char)strtol((char[3]){lb[2*i],lb[2*i+1],0},0,16);
         bh[i] = (unsigned char)strtol((char[3]){lh[2*i],lh[2*i+1],0},0,16);
      }
      u256 a, b, out;
      f256_from_be(a, ba); f256_from_be(b, bb);
      poseidon2(&pc, a, b, out);
      unsigned char ob[32]; f256_to_be(ob, out);
      if (!memcmp(ob, bh, 32)) ++pass; else { ++fail; printf("FAIL a=%s\n", la); }
   }
   printf("adversarial poseidon2: %d passed, %d failed\n", pass, fail);
   return fail ? 1 : 0;
}
