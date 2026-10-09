//! The hiding configuration (SPEC-BTUNGSTEN-PQ-1 §PQ10, "the zero-knowledge
//! composition, named in full") and the non-hiding control the LEAK harness
//! must be able to see through.
//!
//! Config K: KoalaBear, degree-4 challenge field, Keccak-256 Merkle
//! commitments (Vaulta has keccak and sha3 host functions, so this is the
//! on-chain candidate), a Keccak transcript seeded with the instance label.
//! At the pin only `HidingFriPcs` declares `ZK = true`; upstream does not
//! enforce that its MMCSs hide, so both are `MerkleTreeHidingMmcs` here and
//! this module is the only place a config is built. Blinding randomness comes
//! from the operating system; a fixed seed exists only in `seeded_for_tests`.
//!
//! Merkle leaves are rows of a committed matrix, whose width the verifier
//! knows, so the leaf sponge absorbs fixed-length input; `PaddingFreeSponge`
//! is upstream's construction for exactly that case.

use p3_challenger::{HashChallenger, SerializingChallenger32};
use p3_commit::ExtensionMmcs;
use p3_dft::Radix2DitParallel;
use p3_field::extension::BinomialExtensionField;
use p3_fri::{FriParameters, HidingFriPcs, TwoAdicFriPcs};
use p3_keccak::{Keccak256Hash, KeccakF, VECTOR_LEN};
use p3_merkle_tree::{MerkleTreeHidingMmcs, MerkleTreeMmcs};
use p3_symmetric::{CompressionFunctionFromHasher, PaddingFreeSponge, SerializingHasher};
use p3_uni_stark::StarkConfig;
use rand::SeedableRng;
use rand::rngs::StdRng;

use crate::statement::F;

pub type Challenge = BinomialExtensionField<F, 4>;
type U64Hash = PaddingFreeSponge<KeccakF, 25, 17, 4>;
type FieldHash = SerializingHasher<U64Hash>;
type Compress = CompressionFunctionFromHasher<U64Hash, 2, 4>;
pub type Dft = Radix2DitParallel<F>;
pub type Challenger = SerializingChallenger32<F, HashChallenger<u8, Keccak256Hash, 32>>;

pub type HidingMmcs =
    MerkleTreeHidingMmcs<[F; VECTOR_LEN], [u64; VECTOR_LEN], FieldHash, Compress, StdRng, 2, 4, 4>;
pub type HidingChallengeMmcs = ExtensionMmcs<F, Challenge, HidingMmcs>;
pub type HidingPcs = HidingFriPcs<F, Dft, HidingMmcs, HidingChallengeMmcs, StdRng>;
pub type HidingConfig = StarkConfig<HidingPcs, Challenge, Challenger>;

pub type PlainMmcs = MerkleTreeMmcs<[F; VECTOR_LEN], [u64; VECTOR_LEN], FieldHash, Compress, 2, 4>;
pub type PlainChallengeMmcs = ExtensionMmcs<F, Challenge, PlainMmcs>;
pub type PlainPcs = TwoAdicFriPcs<F, Dft, PlainMmcs, PlainChallengeMmcs>;
pub type PlainConfig = StarkConfig<PlainPcs, Challenge, Challenger>;

// The hiding config hides, checked by the compiler, not by a comment.
const _: () = assert!(<HidingPcs as p3_commit::UnivariateStarkPcs<Challenge, Challenger>>::ZK);
const _: () = assert!(!<PlainPcs as p3_commit::UnivariateStarkPcs<Challenge, Challenger>>::ZK);

/// Random codewords the hiding PCS mixes in; at least the challenge degree.
pub const RANDOM_CODEWORDS: usize = 4;

#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub log_blowup: usize,
    pub num_queries: usize,
    pub query_pow_bits: usize,
}

/// The instance label every transcript starts from: the statement, its
/// version and its dimensions, as length-delimited bytes.
pub fn label(n: usize, members: usize) -> Vec<u8> {
    let mut v = Vec::new();
    for part in [
        b"bTunGsTeN-PQ10/receipt-count/v1".as_slice(),
        &(n as u64).to_le_bytes(),
        &(members as u64).to_le_bytes(),
    ] {
        v.extend_from_slice(&(part.len() as u32).to_le_bytes());
        v.extend_from_slice(part);
    }
    v
}

fn hashes() -> (FieldHash, Compress) {
    let u64_hash = U64Hash::new(KeccakF {});
    (FieldHash::new(u64_hash), Compress::new(u64_hash))
}

fn fri<M>(mmcs: M, p: Params) -> FriParameters<M> {
    let mut f = FriParameters::new_benchmark_zk(mmcs);
    f.log_blowup = p.log_blowup;
    f.num_queries = p.num_queries;
    f.query_proof_of_work_bits = p.query_pow_bits;
    f
}

/// The FRI parameters `p` implies, over the plain MMCS: for the security
/// calculator, which reads only the regime and the grinding sites.
pub fn fri_for_security(p: Params) -> FriParameters<PlainChallengeMmcs> {
    let (fh, c) = hashes();
    fri(PlainChallengeMmcs::new(PlainMmcs::new(fh, c, 0)), p)
}

/// OS entropy for every blinding draw.
pub fn os_rng() -> StdRng {
    rand::make_rng()
}

fn hiding_with(
    p: Params,
    n: usize,
    members: usize,
    mut seed: impl FnMut() -> StdRng,
) -> HidingConfig {
    let (fh, c) = hashes();
    let mmcs = HidingMmcs::new(fh, c, 0, seed());
    let fri = fri(HidingChallengeMmcs::new(mmcs.clone()), p);
    let pcs = HidingPcs::new(Dft::default(), mmcs, fri, RANDOM_CODEWORDS, seed());
    HidingConfig::new(
        pcs,
        Challenger::from_hasher(label(n, members), Keccak256Hash {}),
    )
}

/// The config every real proof uses.
pub fn hiding(p: Params, n: usize, members: usize) -> HidingConfig {
    hiding_with(p, n, members, os_rng)
}

/// A reproducible hiding config, for tests that must replay a proof.
pub fn seeded_for_tests(p: Params, n: usize, members: usize, seed: u64) -> HidingConfig {
    let mut s = seed;
    hiding_with(p, n, members, move || {
        s += 1;
        StdRng::seed_from_u64(s)
    })
}

/// The non-hiding control (TwoAdicFriPcs, plain Merkle): never used for a
/// real proof; the LEAK harness must detect it.
pub fn plain(p: Params, n: usize, members: usize) -> PlainConfig {
    let (fh, c) = hashes();
    let mmcs = PlainMmcs::new(fh, c, 0);
    let fri = fri(PlainChallengeMmcs::new(mmcs.clone()), p);
    PlainConfig::new(
        PlainPcs::new(Dft::default(), mmcs, fri),
        Challenger::from_hasher(label(n, members), Keccak256Hash {}),
    )
}

/// The smallest power-of-two height the trace may have: room for the
/// 2n - 1 tree ops and the hiding budget N >= 2 (queries + D * openings)
/// (`fri/src/hiding_pcs.rs:65` at eab7f0e), with D = 4 and the three opening
/// points uni-stark uses, counted conservatively.
pub fn height(n: usize, p: Params) -> usize {
    let budget = 2 * (p.num_queries + 4 * 3);
    (2 * n).max(budget + 1).next_power_of_two()
}
