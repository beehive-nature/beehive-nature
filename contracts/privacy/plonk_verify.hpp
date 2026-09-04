// plonk_verify.hpp — the PLONK verifier, ported phase-by-phase (names
// verbatim) from snarkjs templates/verifier_plonk.sol.ejs (755 lines, the
// file the handoff names as source of truth; line cites below refer to it).
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
// The gate is the final pairing product over 2 pairs (phase 9); every scalar
// phase feeds it. No phase trusts unlabeled input: proof words are
// range-checked (< q) and curve-checked (y² = x³+3 over qf) first.
//
// Wire format: proof = 24×32-byte big-endian words, order A,B,C,Z,T1,T2,T3,
// Wxi,Wxiw (points, x‖y) then eval_a,eval_b,eval_c,eval_s1,eval_s2,eval_zw
// (template pA…pEval_zw, l.72-87); pubs = nPublic×32-byte BE words.
//
// Divergences from the EVM original, each deliberate and labeled:
//  · inversions use Fermat a^(q−2) via f_pow (field256.hpp) instead of the
//    EVM's extended-Euclid inverse() (l.126-149). On a NON-INVERTIBLE value
//    (only possible if a challenge hits a root-of-unity coincidence) the EVM
//    reverts early while f_pow yields 0 and the FINAL PAIRING still refuses —
//    the gate is unchanged, only the failure path differs.
//  · scalar field arithmetic is field256.hpp (tested against 3212 known
//    vectors, gen_field_vectors.py) — Solidity gets mulmod/addmod natively,
//    CDT has no uint256.
//  · mod_exp intrinsic NOT used: inversion is pure WASM f_pow (one call site
//    — the batch inversion — makes the aliasing law trivial to hold).
//
// Curve ops (calculateD/F/E points, checkPairing) are chain-only and guarded
// by PLONK_NATIVE_TEST so the scalar phases run under g++ against the JS
// oracle (oracle_scalars.js mirrors these same template lines in BigInt).
#pragma once
#include "field256.hpp"
#include "vk_constants.hpp"
#include <string.h>

static_assert( N_PUBLIC == 5, "vk binds this circuit (payment.circom): 5 public signals (root, nullifier, commitment_out, fee, feeAsset)" );

typedef void (*plonk_keccak_fn)( const unsigned char* in, unsigned len, unsigned char out[32] );

struct plonk_ctx {
   fctx fq;    // scalar field q  — challenges, evaluations, all PLONK scalars
   fctx fqf;   // base field qf   — curve membership, point negation
};

static void plonk_ctx_init( plonk_ctx* c ) {
   u256 q, qf;
   f256_from_be( q,  PL_Q  );
   f256_from_be( qf, PL_QF );
   fctx_init( &c->fq, q );
   fctx_init( &c->fqf, qf );
}

// ── word helpers ──
static inline const unsigned char* pl_word( const unsigned char* base, int i ) {
   return base + (size_t)i * 32;
}
// parse a BE word into the scalar field (reduces values ≥ q; vk words are
// already canonical so this is a no-op for them)
static inline void pl_sf( const plonk_ctx* c, const unsigned char* w, u256 r ) {
   f256_from_be( r, w );
   f_mod( &c->fq, r, r );
}
// keccak → scalar field
static void pl_kec_sf( const plonk_ctx* c, plonk_keccak_fn kec,
                       const unsigned char* in, unsigned len, u256 r ) {
   unsigned char h[32];
   kec( in, len, h );
   f256_from_be( r, h );
   f_mod( &c->fq, r, r );
}

// ════ Phase 2 · calculateChallenges (template l.256-361) ════
// 5 keccaks → β, γ, α, ξ, v1, u; derived: α², βξ, ξⁿ, Zh=ξⁿ−1, v2..v5.
struct pl_chals {
   u256 beta, gamma, alpha, alpha2, xi, betaxi, xin, zh, v1, v2, v3, v4, v5, u;
};

static void calculateChallenges( const plonk_ctx* c, plonk_keccak_fn kec,
                                 const unsigned char* proof, const unsigned char* pubs,
                                 pl_chals* ch ) {
   // β: 16 vk point words + nPublic pub words + A,B,C proof words
   // (l.263-290; 704 + 32·nPublic bytes)
   unsigned char t[704 + 32 * N_PUBLIC];
   memcpy( t +   0, VK_QM, 64 ); memcpy( t +  64, VK_QL, 64 );
   memcpy( t + 128, VK_QR, 64 ); memcpy( t + 192, VK_QO, 64 );
   memcpy( t + 256, VK_QC, 64 ); memcpy( t + 320, VK_S1, 64 );
   memcpy( t + 384, VK_S2, 64 ); memcpy( t + 448, VK_S3, 64 );
   memcpy( t + 512, pubs, 32 * N_PUBLIC );
   memcpy( t + 512 + 32 * N_PUBLIC, proof, 192 );   // A ‖ B ‖ C
   pl_kec_sf( c, kec, t, sizeof t, ch->beta );

   // γ: keccak(β as one word) (l.294)
   unsigned char b32[32];
   f256_to_be( b32, ch->beta );
   pl_kec_sf( c, kec, b32, 32, ch->gamma );

   // α: β, γ, Z point (l.297-303); α² kept separately (l.304)
   unsigned char t2[128];
   f256_to_be( t2, ch->beta ); f256_to_be( t2 + 32, ch->gamma );
   memcpy( t2 + 64, pl_word( proof, 6 ), 64 );   // Z = point word 3
   pl_kec_sf( c, kec, t2, sizeof t2, ch->alpha );
   f_mul( &c->fq, ch->alpha, ch->alpha, ch->alpha2 );

   // ξ: α, T1, T2, T3 (l.307-315)
   unsigned char t3[224];
   f256_to_be( t3, ch->alpha );
   memcpy( t3 + 32, pl_word( proof, 8 ), 192 );  // T1‖T2‖T3 = point words 4-6
   pl_kec_sf( c, kec, t3, sizeof t3, ch->xi );

   // v1: ξ + the six evaluations (l.319-327)
   unsigned char t4[224];
   f256_to_be( t4, ch->xi );
   memcpy( t4 + 32, pl_word( proof, 18 ), 192 ); // eval_a..eval_zw = words 18-23
   pl_kec_sf( c, kec, t4, sizeof t4, ch->v1 );

   // βξ (l.331)
   f_mul( &c->fq, ch->beta, ch->xi, ch->betaxi );

   // ξⁿ by n squarings, n = 2^power (l.334-336); Zh = ξⁿ − 1 (l.340-341)
   u256 acc; f256_copy( acc, ch->xi );
   for ( int i = 0; i < PL_POWER; ++i ) f_mul( &c->fq, acc, acc, acc );
   f256_copy( ch->xin, acc );
   u256 one; f256_set_u64( one, 1 );
   f_sub( &c->fq, ch->xin, one, ch->zh );

   // v2..v5 (l.345-352)
   f_mul( &c->fq, ch->v1, ch->v1, ch->v2 );
   f_mul( &c->fq, ch->v2, ch->v1, ch->v3 );
   f_mul( &c->fq, ch->v3, ch->v1, ch->v4 );
   f_mul( &c->fq, ch->v4, ch->v1, ch->v5 );

   // u: Wxi ‖ Wxiw (l.355-360)
   unsigned char t5[128];
   memcpy( t5, pl_word( proof, 14 ), 128 );      // Wxi‖Wxiw = point words 7-8
   pl_kec_sf( c, kec, t5, sizeof t5, ch->u );
}

// ════ Phase 3 · calculateLagrange (template l.363-419) ════
// L_i(ξ) = ω^(i−1)·Zh / (n·(ξ − ω^(i−1))); the nLagrange raw values are
// batch-inverted together with Zh in ONE inversion (l.388, inverseArray).
#define PL_NL ( ( N_PUBLIC > 1 ) ? N_PUBLIC : 1 )
// z2.1 F1: the Lagrange batch rides field256's f_batch_invert, whose prefix
// buffer holds 8 — a future vk with nPublic ≥ 7 must fail HERE, at compile
// time, never as a runtime overflow.
static_assert( PL_NL + 1 <= 8, "f_batch_invert prefix[8] bound: regenerate field256 with a larger buffer before shipping a 7+-public vk" );
static void calculateLagrange( const plonk_ctx* c, const pl_chals* ch, u256 L[PL_NL] ) {
   u256 n; f256_set_u64( n, 1 );
   for ( int i = 0; i < PL_POWER; ++i ) { u256 t; f256_copy( t, n ); f256_add_raw( t, t, t ); f256_copy( n, t ); }
   u256 om; pl_sf( c, VK_W1, om );
   u256 w; f256_set_u64( w, 1 );                    // ω^(i−1), starts at 1
   u256 arr[PL_NL + 1];                             // [Zh, L1raw, …, L{nL}raw]
   f256_copy( arr[0], ch->zh );
   for ( int i = 1; i <= PL_NL; ++i ) {
      u256 diff;
      f_sub( &c->fq, ch->xi, w, diff );             // ξ − ω^(i−1)
      f_mul( &c->fq, n, diff, arr[i] );             // n·(ξ − ω^(i−1))
      f_mul( &c->fq, w, om, w );                    // w ← ω^i
   }
   f_batch_invert( &c->fq, arr, PL_NL + 1 );
   f256_set_u64( w, 1 );                            // ω^0 again for the scale pass
   for ( int i = 1; i <= PL_NL; ++i ) {             // L_i = ω^(i−1)·raw_i⁻¹·Zh
      u256 t;
      f_mul( &c->fq, arr[i], ch->zh, t );           // (l.393-414; L1 has no ω)
      f_mul( &c->fq, t, w, L[i - 1] );
      f_mul( &c->fq, w, om, w );
   }
}

// ════ Phase 4 · calculatePI (template l.424-445) ════
// PI accumulates SUBTRACTIONS in the template: pl = pl − pub_i·L_(i+1).
static void calculatePI( const plonk_ctx* c, const u256 L[PL_NL],
                         const unsigned char* pubs, u256 pi ) {
   u256 acc, p, t;
   f256_set_u64( acc, 0 );
   for ( int i = 0; i < N_PUBLIC; ++i ) {
      pl_sf( c, pl_word( pubs, i ), p );
      f_mul( &c->fq, L[i], p, t );
      f_sub( &c->fq, acc, t, acc );
   }
   f256_copy( pi, acc );
}

// ════ Phase 5 · calculateR0 (template l.447-477) ════
struct pl_scalars {                    // parsed proof evaluations (phase-1-checked)
   u256 a, b, c, s1, s2, zw;
   u256 L[PL_NL], pi, r0;
   u256 d2, d3;                        // D-phase scalar multipliers (below)
   u256 e;                             // E-phase scalar (phase 8)
};

static void calculateR0( const plonk_ctx* c, const pl_chals* ch, pl_scalars* s ) {
   u256 e2, e3a, e3b, e3c, e3, t;
   f_mul( &c->fq, s->L[0], ch->alpha2, e2 );                       // L1·α²
   // e3a = a + β·s1 + γ   (l.452-456)
   f_mul( &c->fq, ch->beta, s->s1, t ); f_add( &c->fq, s->a, t, e3a );
   f_add( &c->fq, e3a, ch->gamma, e3a );
   // e3b = b + β·s2 + γ
   f_mul( &c->fq, ch->beta, s->s2, t ); f_add( &c->fq, s->b, t, e3b );
   f_add( &c->fq, e3b, ch->gamma, e3b );
   // e3c = c + γ
   f_add( &c->fq, s->c, ch->gamma, e3c );
   // e3 = α·zw·e3a·e3b·e3c
   f_mul( &c->fq, e3a, e3b, e3 ); f_mul( &c->fq, e3, e3c, e3 );
   f_mul( &c->fq, e3, s->zw, e3 ); f_mul( &c->fq, e3, ch->alpha, e3 );
   // r0 = PI − e2 − e3 (l.473-474)
   f_sub( &c->fq, s->pi, e2, s->r0 );
   f_sub( &c->fq, s->r0, e3, s->r0 );
}

// ════ Phase 6 · calculateD — scalar side (template l.579-625, l.628-650) ════
// D = [Qc] + ab·[Qm] + a·[Ql] + b·[Qr] + c·[Qo] + d2·[Z] − d3·[S3]
//     − Zh·( [T1] + ξⁿ·[T2] + ξ²ⁿ·[T3] )
static void calculateD_scalars( const plonk_ctx* c, const pl_chals* ch, pl_scalars* s ) {
   u256 k1, k2, v1, v2, v3, t;
   pl_sf( c, VK_K1, k1 ); pl_sf( c, VK_K2, k2 );
   // d2a = α·(a+βξ+γ)(b+βξk1+γ)(c+βξk2+γ)   (l.592-612)
   f_add( &c->fq, s->a, ch->betaxi, v1 ); f_add( &c->fq, v1, ch->gamma, v1 );
   f_mul( &c->fq, ch->betaxi, k1, t );     f_add( &c->fq, s->b, t, v2 );
   f_add( &c->fq, v2, ch->gamma, v2 );
   f_mul( &c->fq, ch->betaxi, k2, t );     f_add( &c->fq, s->c, t, v3 );
   f_add( &c->fq, v3, ch->gamma, v3 );
   f_mul( &c->fq, v1, v2, t ); f_mul( &c->fq, t, v3, t );
   f_mul( &c->fq, t, ch->alpha, t );
   // d2b = L1·α² (l.614-618); d2 = u + d2a + d2b (l.625)
   f_mul( &c->fq, s->L[0], ch->alpha2, s->d2 );
   f_add( &c->fq, s->d2, t, s->d2 );
   f_add( &c->fq, s->d2, ch->u, s->d2 );
   // d3 = (a+β·s1+γ)(b+β·s2+γ)·(α·β·zw)   (l.628-642, multiplier at l.650)
   f_mul( &c->fq, ch->beta, s->s1, t ); f_add( &c->fq, s->a, t, v1 );
   f_add( &c->fq, v1, ch->gamma, v1 );
   f_mul( &c->fq, ch->beta, s->s2, t ); f_add( &c->fq, s->b, t, v2 );
   f_add( &c->fq, v2, ch->gamma, v2 );
   f_mul( &c->fq, ch->alpha, ch->beta, t ); f_mul( &c->fq, t, s->zw, v3 );
   f_mul( &c->fq, v1, v2, t ); f_mul( &c->fq, t, v3, s->d3 );
}

// ════ Phase 8 · calculateE — scalar side (template l.679-687) ════
// s = q − r0 + a·v1 + b·v2 + c·v3 + s1·v4 + s2·v5 + zw·u
static void calculateE_scalar( const plonk_ctx* c, const pl_chals* ch, pl_scalars* s ) {
   u256 t;
   f_neg( &c->fq, s->r0, s->e );
   f_mul( &c->fq, s->a,  ch->v1, t ); f_add( &c->fq, s->e, t, s->e );
   f_mul( &c->fq, s->b,  ch->v2, t ); f_add( &c->fq, s->e, t, s->e );
   f_mul( &c->fq, s->c,  ch->v3, t ); f_add( &c->fq, s->e, t, s->e );
   f_mul( &c->fq, s->s1, ch->v4, t ); f_add( &c->fq, s->e, t, s->e );
   f_mul( &c->fq, s->s2, ch->v5, t ); f_add( &c->fq, s->e, t, s->e );
   f_mul( &c->fq, s->zw, ch->u,  t ); f_add( &c->fq, s->e, t, s->e );
}

// ════ Phase 1 · checkProofData (template l.215-254) ════
// 9 curve-membership checks (y² = x³+3 over qf, l.200-213) then range checks
// of the 18 point words and 6 evaluations against the SCALAR field q.
static int plonk_checkProofData( const plonk_ctx* c, const unsigned char* proof ) {
   for ( int pt = 0; pt < 9; ++pt ) {
      const unsigned char* p = pl_word( proof, pt * 2 );
      u256 x, y, x2, x3, lhs, rhs, three;
      f256_from_be( x, p ); f256_from_be( y, p + 32 );
      // y² = x³ + 3 (mod qf)
      f_mul( &c->fqf, x, x, x2 ); f_mul( &c->fqf, x2, x, x3 );
      f256_set_u64( three, 3 );
      f_add( &c->fqf, x3, three, lhs );
      f_mul( &c->fqf, y, y, rhs );
      if ( !f256_eq( lhs, rhs ) ) return 0;
   }
   for ( int w = 0; w < 24; ++w ) {          // range checks vs q (l.228-253)
      u256 v, q;
      f256_from_be( v, pl_word( proof, w ) );
      f256_from_be( q, PL_Q );
      if ( f256_cmp( v, q ) >= 0 ) return 0;
   }
   return 1;
}

#ifndef PLONK_NATIVE_TEST
// ════ curve-op helpers — aliasing IMPOSSIBLE by construction ════
// The node rejects aliased operand pointers (preconditions.hpp:140, learned
// live twice in M2.5). Every intrinsic call below sees only its own local
// buffers; caller-aliased inputs are copied first.

#include <eosio/eosio.hpp>
#include <eosio/crypto_ext.hpp>

static void pl_g1_mul( unsigned char r[64], const unsigned char p[64], const u256 s, const char* who ) {
   unsigned char sbuf[32], out[64];
   f256_to_be( sbuf, s );
   eosio::check( eosio::alt_bn128_mul( (const char*)p, 64, (const char*)sbuf, 32, (char*)out, 64 ) == 0, who );
   memcpy( r, out, 64 );
}
static void pl_g1_add( unsigned char r[64], const unsigned char a[64], const unsigned char b[64], const char* who ) {
   unsigned char bcopy[64], out[64];
   const unsigned char* bb = b;
   if ( bb == a ) { memcpy( bcopy, b, 64 ); bb = bcopy; }
   eosio::check( eosio::alt_bn128_add( (const char*)a, 64, (const char*)bb, 64, (char*)out, 64 ) == 0, who );
   memcpy( r, out, 64 );
}
// r += s·P
static void pl_g1_mulacc( unsigned char r[64], const unsigned char p[64], const u256 s, const char* who ) {
   unsigned char prod[64];
   pl_g1_mul( prod, p, s, who );
   pl_g1_add( r, r, prod, who );
}
// r = s·P
static void pl_g1_mulset( unsigned char r[64], const unsigned char p[64], const u256 s, const char* who ) {
   pl_g1_mul( r, p, s, who );
}
// negate: y ← qf − y (template l.661-662, l.706, l.722)
static void pl_g1_neg( unsigned char p[64] ) {
   u256 y, qf, r;
   f256_from_be( y, p + 32 );
   f256_from_be( qf, PL_QF );
   f256_copy( r, qf );
   f256_sub_raw( r, y );         // r = qf − y (y < q < qf ⇒ no borrow)
   f256_to_be( p + 32, r );
}

// ════ Phases 6-8 · point assembly ════
// calculateD (template l.579-666)
static void calculateD( const plonk_ctx* c, const pl_chals* ch, const pl_scalars* s,
                        const unsigned char* proof, unsigned char D[64] ) {
   memcpy( D, VK_QC, 64 );
   u256 ab; f_mul( &c->fq, s->a, s->b, ab );
   pl_g1_mulacc( D, VK_QM, ab, "plonk: D/Qm" );                 // l.586
   pl_g1_mulacc( D, VK_QL, s->a, "plonk: D/Ql" );               // l.587
   pl_g1_mulacc( D, VK_QR, s->b, "plonk: D/Qr" );               // l.588
   pl_g1_mulacc( D, VK_QO, s->c, "plonk: D/Qo" );               // l.589
   pl_g1_mulacc( D, pl_word( proof, 6 ), s->d2, "plonk: d2/Z" ); // d2·[Z]   (l.621-625)
   unsigned char d3p[64];                        // −d3·[S3] (l.646-650, l.661)
   pl_g1_mulset( d3p, VK_S3, s->d3, "plonk: d3/S3" );
   pl_g1_neg( d3p );
   pl_g1_add( D, D, d3p, "plonk: D+d3" );
   unsigned char d4[64];                         // Zh·(T1 + ξⁿT2 + ξ²ⁿT3) negated (l.653-662)
   memcpy( d4, pl_word( proof, 8 ), 64 );
   pl_g1_mulacc( d4, pl_word( proof, 10 ), ch->xin, "plonk: d4/T2" );
   u256 xin2; f_mul( &c->fq, ch->xin, ch->xin, xin2 );
   pl_g1_mulacc( d4, pl_word( proof, 12 ), xin2, "plonk: d4/T3" );
   pl_g1_mulset( d4, d4, ch->zh, "plonk: d4/zh" );
   pl_g1_neg( d4 );
   pl_g1_add( D, D, d4, "plonk: D+d4" );
}

// calculateF (template l.668-677): F = D + v1·A + v2·B + v3·C + v4·[S1] + v5·[S2]
static void calculateF( const plonk_ctx* c, const pl_chals* ch, const pl_scalars* s,
                        const unsigned char* proof, const unsigned char D[64],
                        unsigned char F[64] ) {
   memcpy( F, D, 64 );
   pl_g1_mulacc( F, pl_word( proof, 0 ), ch->v1, "plonk: F/A" );
   pl_g1_mulacc( F, pl_word( proof, 2 ), ch->v2, "plonk: F/B" );
   pl_g1_mulacc( F, pl_word( proof, 4 ), ch->v3, "plonk: F/C" );
   pl_g1_mulacc( F, VK_S1, ch->v4, "plonk: F/S1" );
   pl_g1_mulacc( F, VK_S2, ch->v5, "plonk: F/S2" );
}

// calculateE (template l.689): E = s·[1]₁
static void calculateE( const pl_scalars* s, unsigned char E[64] ) {
   pl_g1_mulset( E, PL_G1GEN, s->e, "plonk: E/g1" );
}

// ════ Phase 9 · checkPairing (template l.692-734) ════
// A1 = −(u·W_xiw + W_xi)  paired with [X]₂
// B1 = ξ·W_xi + u·ξ·ω·W_xiw + F − E  paired with [1]₂
// ONE alt_bn128_pair over 2 pairs (384-byte buffer) — must return 0.
static int checkPairing( const plonk_ctx* c, const pl_chals* ch,
                         const unsigned char* proof, const unsigned char F[64],
                         const unsigned char E[64] ) {
   unsigned char A1[64], B1[64], t1[64], t2[64], pairs[384];
   pl_g1_mulset( A1, pl_word( proof, 16 ), ch->u, "plonk: A1/Wxiw" );       // u·W_xiw
   pl_g1_add( A1, A1, pl_word( proof, 14 ), "plonk: A1+Wxi" );             // + W_xi
   pl_g1_neg( A1 );                                       // negated

   u256 om; pl_sf( c, VK_W1, om );
   u256 xi_om_u;                                          // u·ξ·ω (l.717-718)
   f_mul( &c->fq, ch->u, ch->xi, xi_om_u );
   f_mul( &c->fq, xi_om_u, om, xi_om_u );
   pl_g1_mulset( B1, pl_word( proof, 14 ), ch->xi, "plonk: B1/Wxi" );      // ξ·W_xi
   pl_g1_mulset( t1, pl_word( proof, 16 ), xi_om_u, "plonk: t1/Wxiw" );     // uξω·W_xiw
   pl_g1_add( B1, B1, t1, "plonk: B1+t1" );
   memcpy( t2, E, 64 ); pl_g1_neg( t2 );                  // −E
   pl_g1_add( B1, B1, F, "plonk: B1+F" );                                // + F
   pl_g1_add( B1, B1, t2, "plonk: B1-E" );

   memcpy( pairs +   0, A1, 64 );
   memcpy( pairs +  64, VK_X2, 128 );
   memcpy( pairs + 192, B1, 64 );
   memcpy( pairs + 256, PL_G2GEN, 128 );
   return eosio::alt_bn128_pair( (const char*)pairs, sizeof pairs );
}

// ════ the verifier (template l.739-747 call order) ════
// Returns 0 = proof ACCEPTED. Any phase-1 failure returns 1; intrinsic or
// pairing failures throw (eosio::check) or return the pairing result.
static int plonk_verify( plonk_keccak_fn kec, const unsigned char* proof768,
                         const unsigned char* pubs /* 32·N_PUBLIC bytes */ ) {
   plonk_ctx ctx; plonk_ctx_init( &ctx );
   if ( !plonk_checkProofData( &ctx, proof768 ) ) return 1;

   pl_chals ch; calculateChallenges( &ctx, kec, proof768, pubs, &ch );
   pl_scalars sc;
   pl_sf( &ctx, pl_word( proof768, 18 ), sc.a );
   pl_sf( &ctx, pl_word( proof768, 19 ), sc.b );
   pl_sf( &ctx, pl_word( proof768, 20 ), sc.c );
   pl_sf( &ctx, pl_word( proof768, 21 ), sc.s1 );
   pl_sf( &ctx, pl_word( proof768, 22 ), sc.s2 );
   pl_sf( &ctx, pl_word( proof768, 23 ), sc.zw );
   calculateLagrange( &ctx, &ch, sc.L );
   calculatePI( &ctx, sc.L, pubs, sc.pi );
   calculateR0( &ctx, &ch, &sc );
   calculateD_scalars( &ctx, &ch, &sc );
   calculateE_scalar( &ctx, &ch, &sc );

   unsigned char D[64], F[64], E[64];
   calculateD( &ctx, &ch, &sc, proof768, D );
   calculateF( &ctx, &ch, &sc, proof768, D, F );
   calculateE( &sc, E );
   return checkPairing( &ctx, &ch, proof768, F, E );
}
#endif // PLONK_NATIVE_TEST
