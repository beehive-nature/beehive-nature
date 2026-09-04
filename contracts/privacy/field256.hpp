// field256.hpp — 4×64-limb modular arithmetic for BN254's 254-bit fields.
//
// WHY: CDT targets wasm32 and has no uint256; the PLONK port needs add/sub/
// mul/mod over both BN254 fields (scalar q, base qf) — the verifier's
// challenges, Lagrange evaluation, PI, R0 and E scalar all live here.
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
// The library is exact integer arithmetic (no probabilistic paths): carries
// are ripple-propagated so no bound analysis is needed for correctness, and
// every operation is tested against known vectors in test_field256.cpp
// (python-generated) BEFORE any verifier code rides it — lane law.
//
// Layout: u256 = 4 little-endian 64-bit limbs (l[0] = least significant).
// Serialized contract/intrinsic bytes are 32-byte BIG-endian words; use
// f256_from_be / f256_to_be at the boundary.
//
// Reduction: Montgomery (CIOS word-at-a-time with ripple carries) for the
// hot path; mod_oracle (binary shift-subtract) as the independent slow
// reference the tests cross-check against. Montgomery requires an odd
// modulus < 2^255 — both BN254 fields qualify (each ≈ 2^254.3):
//   q  = 21888242871839275222246405745257275088548364400416034343698204186575808495617 (scalar)  // PUBLIC-CONSTANT public chain constant / test vector (hex-run law)
//   qf = 21888242871839275222246405745257275088696311157297823662689037894645226208583 (base)  // PUBLIC-CONSTANT public chain constant / test vector (hex-run law)
// (values as printed in snarkjs templates/verifier_plonk.sol.ejs lines 28-30).

#pragma once
#include <stdint.h>
#include <string.h>

typedef uint64_t u256[4];

static inline void f256_zero( u256 r ) { r[0]=r[1]=r[2]=r[3]=0; }
static inline void f256_copy( u256 r, const u256 a ) { r[0]=a[0]; r[1]=a[1]; r[2]=a[2]; r[3]=a[3]; }
static inline void f256_set_u64( u256 r, uint64_t v ) { r[0]=v; r[1]=r[2]=r[3]=0; }
static inline int f256_is_zero( const u256 a ) { return (a[0]|a[1]|a[2]|a[3]) == 0; }
static inline int f256_eq( const u256 a, const u256 b ) {
   return a[0]==b[0] && a[1]==b[1] && a[2]==b[2] && a[3]==b[3];
}

// a<b: -1 · a>b: +1 · equal: 0
static inline int f256_cmp( const u256 a, const u256 b ) {
   for ( int i = 3; i >= 0; --i ) {
      if ( a[i] < b[i] ) return -1;
      if ( a[i] > b[i] ) return 1;
   }
   return 0;
}

// r = a + b (mod 2^256); returns the carry-out bit
static inline uint64_t f256_add_raw( u256 r, const u256 a, const u256 b ) {
   uint64_t c = 0;
   for ( int i = 0; i < 4; ++i ) {
      uint64_t s = a[i] + b[i];
      uint64_t c1 = s < a[i];
      uint64_t s2 = s + c;
      uint64_t c2 = s2 < s;
      r[i] = s2;
      c = c1 | c2;
   }
   return c;
}

// a -= b; requires a >= b (no borrow-out)
static inline void f256_sub_raw( u256 a, const u256 b ) {
   uint64_t borrow = 0;
   for ( int i = 0; i < 4; ++i ) {
      uint64_t s = a[i] - b[i];
      uint64_t b1 = a[i] < b[i];
      uint64_t s2 = s - borrow;
      uint64_t b2 = s < borrow;
      a[i] = s2;
      borrow = b1 | b2;
   }
}

// 64×64 → 128 via 32-bit halves (wasm has no 64×64→128; this is exact)
static inline void mul64( uint64_t a, uint64_t b, uint64_t* hi, uint64_t* lo ) {
   uint64_t al = a & 0xffffffffull, ah = a >> 32;
   uint64_t bl = b & 0xffffffffull, bh = b >> 32;
   uint64_t ll = al * bl;
   uint64_t lh = al * bh;
   uint64_t hl = ah * bl;
   uint64_t hh = ah * bh;
   uint64_t mid = lh + hl;
   uint64_t carry = mid < lh ? (1ull << 32) : 0;
   uint64_t l = ll + (mid << 32);
   uint64_t lc = l < ll ? 1 : 0;
   *lo = l;
   *hi = hh + (mid >> 32) + carry + lc;
}

// add a 64-bit value at limb position k of an n-limb array, ripple-propagate
static inline void add_at( uint64_t* t, int n, int k, uint64_t v ) {
   uint64_t old = t[k]; t[k] += v; uint64_t c = t[k] < old;
   ++k;
   while ( c ) { old = t[k]; t[k] += c; c = t[k] < old; ++k; }
   (void)n;
}

// schoolbook 256×256 → 512, ripple-carry exact
static void mul512( const u256 a, const u256 b, uint64_t r[8] ) {
   uint64_t t[8]; memset( t, 0, sizeof t );
   for ( int i = 0; i < 4; ++i ) {
      for ( int j = 0; j < 4; ++j ) {
         uint64_t hi, lo; mul64( a[j], b[i], &hi, &lo );
         add_at( t, 8, i + j, lo );
         add_at( t, 8, i + j + 1, hi );
      }
   }
   memcpy( r, t, sizeof t );
}

// ── oracle: x (512-bit) mod m by binary shift-subtract (slow, exact) ──
// requires m < 2^255 (both BN254 fields qualify)
static void mod_oracle( const uint64_t x[8], const u256 m, u256 r ) {
   u256 rem; f256_zero( rem );
   for ( int bit = 511; bit >= 0; --bit ) {
      // rem < m < 2^255  ⇒  rem<<1 | bit cannot overflow 256 bits
      uint64_t c = rem[3] >> 63;
      rem[3] = (rem[3] << 1) | (rem[2] >> 63);
      rem[2] = (rem[2] << 1) | (rem[1] >> 63);
      rem[1] = (rem[1] << 1) | (rem[0] >> 63);
      rem[0] = (rem[0] << 1) | ((x[bit >> 6] >> (bit & 63)) & 1ull);
      (void)c; // c is always 0 under the precondition
      if ( f256_cmp( rem, m ) >= 0 ) f256_sub_raw( rem, m );
   }
   f256_copy( r, rem );
}

// ── Montgomery context ──
struct fctx {
   u256 m;      // odd modulus, m < 2^255
   uint64_t n0; // −m⁻¹ mod 2^64
   u256 r2;     // 2^512 mod m
};

// −m⁻¹ mod 2^64 by Newton iteration (exact for odd m)
static inline uint64_t inv64_odd( uint64_t m ) {
   uint64_t inv = 1;
   for ( int i = 0; i < 6; ++i ) inv *= 2 - m * inv;
   return -inv;
}

// Montgomery reduction of a 512-bit T (< m·2^256) → r < m
static void mont_reduce( const fctx* c, const uint64_t T[8], u256 r ) {
   uint64_t t[9]; memcpy( t, T, 8 * sizeof(uint64_t) ); t[8] = 0;
   for ( int i = 0; i < 4; ++i ) {
      uint64_t mi = t[i] * c->n0;
      for ( int j = 0; j < 4; ++j ) {
         uint64_t hi, lo; mul64( mi, c->m[j], &hi, &lo );
         add_at( t, 9, i + j, lo );
         add_at( t, 9, i + j + 1, hi );
      }
   }
   // result = t[4..8]; at most one subtraction of m brings it below m
   // (T < m·2^256 ⇒ quotient-carry t[8] ∈ {0,1} and t[4..7] < m when t[8]=1)
   if ( t[8] != 0 || f256_cmp( t + 4, c->m ) >= 0 ) f256_sub_raw( t + 4, c->m );
   f256_copy( r, t + 4 );
}

static void fctx_init( fctx* c, const u256 m ) {
   f256_copy( c->m, m );
   c->n0 = inv64_odd( m[0] );
   uint64_t two512[8] = {0,0,0,0,0,0,0,0};
   two512[7] = 1ull << 63; // 2^511 → then ×2 below
   // 2^512 mod m: run the oracle on 2^511 then double mod m (oracle input is
   // a plain 512-bit value; 2^511 doubled once more would need 513 bits)
   u256 half; mod_oracle( two512, m, half );
   f256_add_raw( c->r2, half, half );           // may carry or exceed m
   if ( f256_cmp( c->r2, m ) >= 0 ) f256_sub_raw( c->r2, m );
}

// ── field ops (operands must already be < m; results are < m) ──

static inline void f_add( const fctx* c, const u256 a, const u256 b, u256 r ) {
   uint64_t carry = f256_add_raw( r, a, b );
   if ( carry || f256_cmp( r, c->m ) >= 0 ) f256_sub_raw( r, c->m );
}

static inline void f_sub( const fctx* c, const u256 a, const u256 b, u256 r ) {
   if ( f256_cmp( a, b ) >= 0 ) { f256_copy( r, a ); f256_sub_raw( r, b ); }
   else { u256 t; f256_copy( t, c->m ); f256_sub_raw( t, b ); f256_add_raw( r, a, t ); }
   // a < m, b > a ⇒ a + (m−b) < m: no post-reduction needed
}

static inline void f_neg( const fctx* c, const u256 a, u256 r ) {
   if ( f256_is_zero( a ) ) f256_zero( r );
   else { f256_copy( r, c->m ); f256_sub_raw( r, a ); }
}

// Montgomery product of internal forms (a,b < m)
static inline void mont_mul( const fctx* c, const u256 a, const u256 b, u256 r ) {
   uint64_t T[8]; mul512( a, b, T );
   mont_reduce( c, T, r );
}

static void f_mul( const fctx* c, const u256 a, const u256 b, u256 r ) {
   u256 ta, tb, t;
   mont_mul( c, a, c->r2, ta );   // ta = a·R mod m
   mont_mul( c, b, c->r2, tb );   // tb = b·R mod m
   mont_mul( c, ta, tb, t );      // t  = a·b·R mod m
   u256 one; f256_set_u64( one, 1 );
   mont_mul( c, t, one, r );      // r  = a·b mod m
}

// reduce an arbitrary <2^256 value into the field (keccak outputs need this)
static inline void f_mod( const fctx* c, const u256 a, u256 r ) {
   f256_copy( r, a );
   while ( f256_cmp( r, c->m ) >= 0 ) f256_sub_raw( r, c->m );
}

// r = a^e mod m by square-and-multiply (exact; used for a^(m−2) = a⁻¹,
// Fermat — m prime). Constant-shape loops only in the exponent's bit count;
// timing is not a concern on-chain (billed cpu, not latency-hiding).
static void f_pow( const fctx* c, const u256 a, const u256 e, u256 r ) {
   u256 base, acc;
   f256_copy( base, a );
   f256_set_u64( acc, 1 );
   for ( int i = 0; i < 256; ++i ) {
      if ( (e[i >> 6] >> (i & 63)) & 1ull ) f_mul( c, acc, base, acc );
      if ( i < 255 ) f_mul( c, base, base, base );
   }
   f256_copy( r, acc );
}

// batch inversion (Montgomery trick): inverts n values with ONE f_pow —
// port of the template's inverseArray (verifier_plonk.sol.ejs l.155-191),
// which exists to spend one inversion instead of n.
static void f_batch_invert( const fctx* c, u256* v, int n ) {
   // prefix[i] = v0·v1···v(i−1); prefix[0] = 1
   u256 prefix[8];
   f256_set_u64( prefix[0], 1 );
   for ( int i = 0; i < n; ++i ) f_mul( c, prefix[i], v[i], prefix[i + 1] );
   u256 acc;                        // acc = (product of all)⁻¹
   u256 two; f256_set_u64( two, 2 );
   u256 qm2; f256_copy( qm2, c->m ); f256_sub_raw( qm2, two );   // m−2 (Fermat)
   f_pow( c, prefix[n], qm2, acc );
   for ( int i = n - 1; i >= 1; --i ) {
      u256 t, inv_i;
      f_mul( c, acc, prefix[i], inv_i );   // v_i⁻¹ = acc · prefix[i]
      f_mul( c, acc, v[i], t );            // acc for the next step down
      f256_copy( v[i], inv_i );
      f256_copy( acc, t );
   }
   // v[0] = acc (the last unwound value)
   f256_copy( v[0], acc );
}

// ── BE-word serialization boundary (32-byte big-endian ↔ limbs) ──
static inline void f256_from_be( u256 r, const unsigned char* be32 ) {
   for ( int i = 0; i < 4; ++i )
      r[i] = ((uint64_t)be32[31 - i*8]      ) | ((uint64_t)be32[30 - i*8] <<  8) |
             ((uint64_t)be32[29 - i*8] << 16) | ((uint64_t)be32[28 - i*8] << 24) |
             ((uint64_t)be32[27 - i*8] << 32) | ((uint64_t)be32[26 - i*8] << 40) |
             ((uint64_t)be32[25 - i*8] << 48) | ((uint64_t)be32[24 - i*8] << 56);
}
static inline void f256_to_be( unsigned char* be32, const u256 a ) {
   // limb i lives at bytes (24−8i)…(31−8i), limb MSB at byte 24−8i — the
   // mirror of f256_from_be (round-trip identity is load-bearing: pl_g1_mul
   // serializes scalars through this)
   for ( int i = 0; i < 4; ++i )
      for ( int b = 0; b < 8; ++b )
         be32[24 - i*8 + b] = (unsigned char)(a[i] >> (56 - 8*b));
}
