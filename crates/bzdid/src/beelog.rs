//! BEELOG — the append-only evidence structure (ORDER BZDID-002 Phase 2).
//!
//! A did:b: identity is only as trustworthy as the evidence a verifier
//! can hold against whoever SERVES the log. BEELOG is that evidence
//! structure, minimal and self-contained: an append-only Merkle log over
//! the identity's STORED op bytes (genesis at leaf 0, rotation ops at
//! leaves 1..=seq), with inclusion and consistency proofs any third
//! party verifies from the commitment alone.
//!
//! ## The canonical tree specification (byte-level; a change here is a
//! ## v2 ceremony, never an edit)
//!
//! The tree is RFC 6962's Merkle Hash Tree over the log's leaf BYTES:
//!
//! ```text
//! leaf_hash(i)  = SHA-256( 0x00 ‖ leaf_bytes[i] )
//! node(l, r)    = SHA-256( 0x01 ‖ l ‖ r )
//! MTH({})       = SHA-256( "" )          // the empty log's root
//! MTH({d0})     = SHA-256( 0x00 ‖ d0 )
//! MTH(D[n])     = SHA-256( 0x01 ‖ MTH(D[0:k]) ‖ MTH(D[k:n]) )
//!                 where k is the largest power of two strictly < n
//! ```
//!
//! `Head { epochless size: u64, root: [u8; 32] }` commits to the first
//! `size` leaves exactly; two heads commit to the same history iff equal.
//! Inclusion proofs are RFC 6962 §2.1.1 audit paths; consistency proofs
//! are RFC 6962 §2.1.2. The verifiers (`verify_inclusion`,
//! `verify_consistency`, `head_relation`) take ONLY what a stranger
//! holds — bytes, sizes, roots, proof nodes — never the log itself:
//! **the serving party is never trusted; the arithmetic is**.
//!
//! ## Why BOTH hash-chains and a tree
//!
//! The ops already carry a prev-hash chain (succession module), so
//! reordering leaves breaks the chain AND the Merkle root. The tree adds
//! what the chain cannot give: O(log n) inclusion evidence and
//! SIZE-BASED append-only evidence (a consistency proof is exactly the
//! demonstration that the new head's first `old_size` leaves hash to the
//! OLD root — withholding, reordering, and truncation all fail it).
//!
//! ## What this increment is NOT (named)
//!
//! No global `.b` name tree (the architecture's depth-40 indexed tree is
//! a later phase with its own contract), no sequencer, no gossip, no
//! chain bytes — the Vaulta epoch-root adapter (Phase 3) is a separate
//! thin layer over `Head`. Nothing here signs anything; a head is a
//! commitment VALUE, and anchoring it is the next layer's job.

use sha2::{Digest, Sha256};

/// The log's commitment: `size` leaves and the root that commits them.
/// Two equal heads commit to the same history, byte for byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Head {
    pub size: u64,
    pub root: [u8; 32],
}

impl Head {
    /// The empty log's head: size 0, root = SHA-256(""). Fixed by the
    /// canonical spec above.
    pub fn empty() -> Head {
        Head {
            size: 0,
            root: Sha256::digest([]).into(),
        }
    }
}

fn leaf_hash(bytes: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update([0x00]);
    h.update(bytes);
    h.finalize().into()
}

fn node_hash(l: &[u8; 32], r: &[u8; 32]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update([0x01]);
    h.update(l);
    h.update(r);
    h.finalize().into()
}

/// The largest power of two strictly less than `n` (n >= 2).
fn split_point(n: u64) -> u64 {
    debug_assert!(n >= 2);
    1u64 << (63 - (n - 1).leading_zeros())
}

/// A BEELOG — append-only, hash-committed, holding the stored bytes of
/// every leaf (the stored-bytes law: proofs hash the bytes handed at
/// append time, never a re-encoding).
#[derive(Debug, Clone, Default)]
pub struct BeeLog {
    leaves: Vec<Vec<u8>>,
}

impl BeeLog {
    pub fn new() -> BeeLog {
        BeeLog { leaves: Vec::new() }
    }

    /// Append one leaf's stored bytes; returns the leaf's index.
    /// Append-only: there is no removal and no mutation API, on purpose.
    pub fn append(&mut self, bytes: &[u8]) -> u64 {
        let idx = self.leaves.len() as u64;
        self.leaves.push(bytes.to_vec());
        idx
    }

    pub fn len(&self) -> u64 {
        self.leaves.len() as u64
    }

    pub fn is_empty(&self) -> bool {
        self.leaves.is_empty()
    }

    pub fn leaf(&self, index: u64) -> Option<&[u8]> {
        self.leaves.get(index as usize).map(|v| v.as_slice())
    }

    /// The root of the tree over ALL leaves, computed by the RFC 6962
    /// MTH recursion (the same function the proofs use — one definition,
    /// no second arithmetic to drift).
    pub fn head(&self) -> Head {
        Head {
            size: self.len(),
            root: mth(&self.leaves, 0, self.leaves.len() as u64),
        }
    }

    /// The head restricted to the first `size` leaves — a historical
    /// head, the thing a consistency proof reconciles with a later head.
    /// `size` beyond the log refuses (fail closed).
    pub fn head_at(&self, size: u64) -> Option<Head> {
        if size > self.len() {
            return None;
        }
        Some(Head {
            size,
            root: mth(&self.leaves, 0, size),
        })
    }

    /// RFC 6962 §2.1.1 audit path for `index`.
    pub fn inclusion_proof(&self, index: u64) -> Option<Vec<[u8; 32]>> {
        let n = self.len();
        if index >= n {
            return None;
        }
        let mut path = Vec::new();
        path_recursive(&self.leaves, 0, n, index, &mut path);
        Some(path)
    }

    /// RFC 6962 §2.1.2 consistency proof (SUBPROOF) from the first
    /// `old_size` leaves to the full log. `old_size` == 0 or > len
    /// refuses (fail closed — the RFC's m=0 case is undefined and this
    /// crate does not invent it).
    pub fn consistency_proof(&self, old_size: u64) -> Option<Vec<[u8; 32]>> {
        let n = self.len();
        if old_size == 0 || old_size > n {
            return None;
        }
        let mut proof = Vec::new();
        subproof(&self.leaves, 0, old_size, n, true, &mut proof);
        Some(proof)
    }
}

/// MTH over leaves[start..start+len] — the canonical recursion, verbatim.
fn mth(leaves: &[Vec<u8>], start: u64, len: u64) -> [u8; 32] {
    if len == 0 {
        return Sha256::digest([]).into();
    }
    if len == 1 {
        return leaf_hash(&leaves[start as usize]);
    }
    let k = split_point(len);
    let l = mth(leaves, start, k);
    let r = mth(leaves, start + k, len - k);
    node_hash(&l, &r)
}

/// RFC 6962 §2.1.1 PATH(m, D[start..start+n]) — siblings appended
/// deepest-first, matching the recursive definition exactly:
/// m < k → PATH(left) ++ [MTH(right)]; m >= k → PATH(right) ++ [MTH(left)].
fn path_recursive(leaves: &[Vec<u8>], start: u64, n: u64, m: u64, out: &mut Vec<[u8; 32]>) {
    if n == 1 {
        return;
    }
    let k = split_point(n);
    if m < k {
        path_recursive(leaves, start, k, m, out);
        out.push(mth(leaves, start + k, n - k));
    } else {
        path_recursive(leaves, start + k, n - k, m - k, out);
        out.push(mth(leaves, start, k));
    }
}

/// RFC 6962 §2.1.2 SUBPROOF(m, D[start..start+n], b) — the consistency
/// proof recursion, verbatim including the `b` flag: when the recursion
/// bottoms out at m == n on a NON-original request, the prefix's own
/// subtree hash rides the proof (without it the verifier could not
/// recompute the old root — the flag is load-bearing, not decoration).
/// Sibling hashes append AFTER the recursive subproof, both branches.
fn subproof(
    leaves: &[Vec<u8>],
    start: u64,
    m: u64,
    n: u64,
    is_original: bool,
    out: &mut Vec<[u8; 32]>,
) {
    if m == n {
        if !is_original {
            out.push(mth(leaves, start, n));
        }
        return;
    }
    let k = split_point(n);
    if m <= k {
        subproof(leaves, start, m, k, is_original, out);
        out.push(mth(leaves, start + k, n - k));
    } else {
        subproof(leaves, start + k, m - k, n - k, false, out);
        out.push(mth(leaves, start, k));
    }
}

// ---------------------------------------------------------------------
// THE INDEPENDENT VERIFIERS — strangers' arithmetic, no log access
// ---------------------------------------------------------------------

/// Verify an inclusion proof: does `leaf_bytes` sit at `index` under
/// `head`? Pure function of the handed values — the serving party's log
/// is irrelevant; the proof either folds to the root or it does not.
pub fn verify_inclusion(
    leaf_bytes: &[u8],
    index: u64,
    head: &Head,
    proof: &[[u8; 32]],
) -> Result<(), String> {
    if head.size == 0 {
        return Err("an empty log includes nothing".into());
    }
    if index >= head.size {
        return Err(format!(
            "index {index} is outside a log of {size} leaves",
            size = head.size
        ));
    }
    // RFC 9162 §2.1.3.2, verbatim: fn walks the node's position, sn the
    // right edge; the `fn == sn` condition folds the unbalanced right
    // side of an incomplete tree (the case naive level counting misses).
    let mut r = leaf_hash(leaf_bytes);
    let mut fn_ = index;
    let mut sn = head.size - 1;
    for p in proof {
        if sn == 0 {
            return Err("proof node beyond the root — extra nodes, refuse".into());
        }
        if fn_ & 1 == 1 || fn_ == sn {
            r = node_hash(p, &r);
            if fn_ & 1 == 0 {
                while fn_ & 1 == 0 && fn_ != 0 {
                    fn_ >>= 1;
                    sn >>= 1;
                }
            }
        } else {
            r = node_hash(&r, p);
        }
        fn_ >>= 1;
        sn >>= 1;
    }
    if sn != 0 {
        return Err("the walk did not reach the root — proof shorter than the tree, refuse".into());
    }
    if r != head.root {
        return Err(
            "the path does not fold to the head root — these bytes are not this log".into(),
        );
    }
    Ok(())
}

/// Verify a consistency proof (RFC 6962 §2.1.2 / §2.4.2): does the first
/// `old.size` leaves of the log committed by `new` hash exactly to
/// `old.root`? This is the append-only demonstration: withholding,
/// truncation, reordering, and rewriting between two heads all fail it.
pub fn verify_consistency(old: &Head, new: &Head, proof: &[[u8; 32]]) -> Result<(), String> {
    if old.size == 0 {
        return Err("consistency with an empty old head is undefined — refuse".into());
    }
    if new.size < old.size {
        return Err(format!(
            "new head ({}) is shorter than old ({}) — a rollback, not a consistency",
            new.size, old.size
        ));
    }
    if old.size == new.size {
        if !proof.is_empty() {
            return Err("equal sizes need the empty proof — extra nodes, refuse".into());
        }
        return if old.root == new.root {
            Ok(())
        } else {
            Err("same size, different roots — two histories, a fork".into())
        };
    }
    // RFC 9162 §2.1.4.2, verbatim: two running hashes — fr rebuilds the
    // OLD root from proof nodes (the check the old history is real),
    // sr folds toward the new root (the check the new history extends
    // it). A power-of-two old size prepends the old root itself (the
    // proof does not carry it — the prefix is a whole left subtree).
    let mut path: Vec<[u8; 32]> = proof.to_vec();
    if old.size.is_power_of_two() {
        path.insert(0, old.root);
    }
    if path.is_empty() {
        return Err("empty consistency proof — refuse".into());
    }
    let mut fn_ = old.size - 1;
    let mut sn = new.size - 1;
    while fn_ & 1 == 1 {
        fn_ >>= 1;
        sn >>= 1;
    }
    let mut fr = path[0];
    let mut sr = path[0];
    for c in &path[1..] {
        if sn == 0 {
            return Err("proof node beyond the root — refuse".into());
        }
        if fn_ & 1 == 1 || fn_ == sn {
            fr = node_hash(c, &fr);
            sr = node_hash(c, &sr);
            if fn_ & 1 == 0 {
                while fn_ & 1 == 0 && fn_ != 0 {
                    fn_ >>= 1;
                    sn >>= 1;
                }
            }
        } else {
            sr = node_hash(&sr, c);
        }
        fn_ >>= 1;
        sn >>= 1;
    }
    if fr != old.root {
        return Err(
            "the proof does not rebuild the old root — the old history is not this one".into(),
        );
    }
    if sr != new.root {
        return Err(
            "the proof does not fold into the new root — these heads are not one history".into(),
        );
    }
    if sn != 0 {
        return Err("the walk did not reach the root — incomplete proof, refuse".into());
    }
    Ok(())
}

/// What two heads are to each other, given whatever proof the server
/// offered (None when the server offered nothing). This is the fork
/// detector: `Fork` is the verdict when neither equality nor a valid
/// consistency proof reconciles the two heads.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeadRelation {
    /// The same history.
    Equal,
    /// The new head provably extends the old (proof verified).
    Extends,
    /// Same size, different roots — two divergent histories.
    Fork,
    /// The new head is SHORTER than the old: a rollback/truncation.
    Shorter,
    /// Longer, but the offered proof does not reconcile it: the new
    /// head's early history is not the old head's history — withholding
    /// or rewriting.
    Unproven,
}

pub fn head_relation(old: &Head, new: &Head, proof: Option<&[[u8; 32]]>) -> HeadRelation {
    if old.size == new.size && old.root == new.root {
        return HeadRelation::Equal;
    }
    if new.size < old.size {
        return HeadRelation::Shorter;
    }
    if old.size == new.size {
        return HeadRelation::Fork;
    }
    match proof {
        None => HeadRelation::Unproven,
        Some(p) => match verify_consistency(old, new, p) {
            Ok(()) => HeadRelation::Extends,
            Err(_) => HeadRelation::Unproven,
        },
    }
}

// ---------------------------------------------------------------------
// The identity log — BEELOG bound to one did:b: history
// ---------------------------------------------------------------------

/// A verified identity's evidence log: the genesis bytes at leaf 0 and
/// every APPLIED rotation op (chain order) at leaves 1..=seq — exactly
/// `resolve_did`'s applied chain, so leaf index == op seq, and the head
/// size is seq + 1. Built only from a RESOLVED chain: BEELOG never
/// vouches for ops the succession verifier has not verified (no trust
/// in the serving party, at any layer).
#[derive(Debug, Clone)]
pub struct IdentityLog {
    did: crate::BzDid,
    log: BeeLog,
}

impl IdentityLog {
    /// Build from a resolved chain. The genesis is leaf 0; applied ops
    /// follow in chain order.
    pub fn from_resolved(resolved: &crate::ResolvedDid, genesis_bytes: &[u8]) -> IdentityLog {
        let mut log = BeeLog::new();
        log.append(genesis_bytes);
        for op in &resolved.applied {
            log.append(op);
        }
        IdentityLog {
            did: resolved.did.clone(),
            log,
        }
    }

    /// The identity this log belongs to.
    pub fn did(&self) -> &crate::BzDid {
        &self.did
    }

    /// The BEELOG head: size == head seq + 1, root over the stored bytes.
    /// This is the value a wallet remembers between views (the floor in
    /// log terms) and the value an epoch-root anchor commits.
    pub fn head(&self) -> Head {
        self.log.head()
    }

    /// Inclusion evidence for the op at `seq` (0 = genesis) under the
    /// current head: `(leaf bytes, proof)` — hand both to any stranger.
    pub fn op_evidence(&self, seq: u64) -> Option<(&[u8], Vec<[u8; 32]>)> {
        let proof = self.log.inclusion_proof(seq)?;
        Some((self.log.leaf(seq)?, proof))
    }

    /// The full log leaves, for serving.
    pub fn leaves(&self) -> &[Vec<u8>] {
        &self.log.leaves
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build(n: u64) -> BeeLog {
        let mut log = BeeLog::new();
        for i in 0..n {
            log.append(format!("leaf-{i}").as_bytes());
        }
        log
    }

    #[test]
    fn empty_head_is_sha256_of_nothing() {
        assert_eq!(
            Head::empty(),
            Head {
                size: 0,
                root: Sha256::digest([]).into()
            }
        );
        assert_eq!(BeeLog::new().head(), Head::empty());
    }

    #[test]
    fn every_inclusion_proof_verifies_and_tamper_refuses() {
        let log = build(13);
        let head = log.head();
        for i in 0..13 {
            let proof = log.inclusion_proof(i).unwrap();
            let bytes = log.leaf(i).unwrap();
            assert!(verify_inclusion(bytes, i, &head, &proof).is_ok());
            // a flipped proof node refuses
            let mut bad = proof.clone();
            bad[0][5] ^= 0x01;
            assert!(verify_inclusion(bytes, i, &head, &bad).is_err());
            // a truncated proof refuses
            assert!(verify_inclusion(bytes, i, &head, &proof[..proof.len() - 1]).is_err());
            // an extended proof refuses
            let mut long = proof.clone();
            long.push([9u8; 32]);
            assert!(verify_inclusion(bytes, i, &head, &long).is_err());
        }
        // the wrong leaf at an index refuses (omission/substitution)
        let p0 = log.inclusion_proof(0).unwrap();
        assert!(verify_inclusion(log.leaf(1).unwrap(), 0, &head, &p0).is_err());
        // a foreign leaf with someone else's proof refuses
        assert!(verify_inclusion(b"not-here", 4, &head, &log.inclusion_proof(4).unwrap()).is_err());
    }

    #[test]
    fn every_consistency_pair_verifies_and_mutations_refuse() {
        let log = build(20);
        let new = log.head();
        for old_size in 1..=20 {
            let old = log.head_at(old_size).unwrap();
            let proof = log.consistency_proof(old_size).unwrap();
            assert!(
                verify_consistency(&old, &new, &proof).is_ok(),
                "consistency {old_size}->20 must verify"
            );
            // a flipped node refuses
            let mut bad = proof.clone();
            if !bad.is_empty() {
                bad[0][3] ^= 0x01;
                assert!(verify_consistency(&old, &new, &bad).is_err());
            }
            // a proof for a different size refuses
            if old_size < 19 {
                let wrong = log.consistency_proof(old_size + 1).unwrap();
                if wrong.len() != proof.len() {
                    assert!(verify_consistency(&old, &new, &wrong).is_err());
                }
            }
        }
        // equal sizes: empty proof, roots equal
        let h = log.head_at(20).unwrap();
        assert!(verify_consistency(&h, &new, &[]).is_ok());
        // same size different root = fork
        let mut other = BeeLog::new();
        for i in 0..20u64 {
            other.append(format!("other-leaf-{i}").as_bytes());
        }
        let forked = other.head();
        assert!(forked.root != new.root);
        assert!(verify_consistency(&forked, &new, &[]).is_err());
        // and no proof from the honest log can pass the forked old head
        for old_size in 1..=20u64 {
            let p = log.consistency_proof(old_size).unwrap();
            let fh = other.head_at(old_size).unwrap();
            assert!(
                verify_consistency(&fh, &new, &p).is_err(),
                "a foreign history must never be provably consistent at size {old_size}"
            );
        }
        // rollback refuses
        let big = log.head_at(15).unwrap();
        let small = log.head_at(3).unwrap();
        let proof = log.consistency_proof(3).unwrap();
        assert!(verify_consistency(&big, &small, &proof).is_err());
    }

    #[test]
    fn reordering_leaves_breaks_consistency() {
        // a log that appended a,b,c… vs one that appended b,a,c… — the
        // head at size 2 of one must not be provably consistent into the
        // other beyond size 2
        let mut honest = BeeLog::new();
        honest.append(b"a");
        honest.append(b"b");
        let mut reordered = BeeLog::new();
        reordered.append(b"b");
        reordered.append(b"a");
        let h1 = honest.head();
        let h2 = reordered.head();
        assert_ne!(h1.root, h2.root);
        assert_eq!(head_relation(&h1, &h2, None), HeadRelation::Fork);
    }

    #[test]
    fn withholding_between_heads_is_unproven_until_the_proof_exists() {
        let mut log = build(10);
        let old = log.head(); // size 10
        for i in 10..25 {
            log.append(format!("leaf-{i}").as_bytes());
        }
        let new = log.head();
        // a server that serves the new head with NO proof: unproven
        assert_eq!(head_relation(&old, &new, None), HeadRelation::Unproven);
        // with the honest proof: extends
        let proof = log.consistency_proof(10).unwrap();
        assert_eq!(
            head_relation(&old, &new, Some(&proof)),
            HeadRelation::Extends
        );
        // with a garbage proof: unproven (never a silent accept)
        let mut bad = proof.clone();
        let last = bad.len() - 1;
        bad[last][0] ^= 0xFF;
        assert_eq!(
            head_relation(&old, &new, Some(&bad)),
            HeadRelation::Unproven
        );
    }

    #[test]
    fn recovery_from_an_old_verified_head_never_rereads_the_log() {
        // the recovery gesture of the order: a wallet holding head(k)
        // receives head(n>k) + a consistency proof and catches up by
        // arithmetic alone — no leaf re-read, no trust in the server
        let mut log = build(7);
        let old = log.head();
        for i in 7..40 {
            log.append(format!("leaf-{i}").as_bytes());
        }
        let new = log.head();
        let proof = log.consistency_proof(7).unwrap();
        assert!(verify_consistency(&old, &new, &proof).is_ok());
        // and the caught-up wallet can then verify any op's inclusion
        // against the NEW head it just adopted
        let i = 33u64;
        let p = log.inclusion_proof(i).unwrap();
        assert!(verify_inclusion(log.leaf(i).unwrap(), i, &new, &p).is_ok());
    }

    #[test]
    fn identity_log_leaf_indices_are_op_seqs() {
        use crate::tests::demo_keys;
        let (resolved, genesis_bytes) = demo_keys();
        let idlog = IdentityLog::from_resolved(&resolved, &genesis_bytes);
        assert_eq!(idlog.head().size, resolved.head.seq + 1);
        for (seq, op_bytes) in resolved.applied.iter().enumerate() {
            let (leaf, proof) = idlog.op_evidence(seq as u64 + 1).unwrap();
            assert_eq!(leaf, op_bytes.as_slice());
            assert!(verify_inclusion(leaf, seq as u64 + 1, &idlog.head(), &proof).is_ok());
        }
        // leaf 0 is the genesis
        let (g, p) = idlog.op_evidence(0).unwrap();
        assert_eq!(g, genesis_bytes.as_slice());
        assert!(verify_inclusion(g, 0, &idlog.head(), &p).is_ok());
    }
}
