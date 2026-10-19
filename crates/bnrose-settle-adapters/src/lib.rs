//! BNROSE-ADAPTERS-REAL — settlement adapters for the partition harness
//! (founder order 2026-10-17; the successor qualification named in
//! `docs/dispatches/2026-10-15-bnrose-rust-002-milestone-ruled.md`:
//! "real network partitions between sovereign hosts, followed by
//! independently verified destination-side execution and finality on each
//! supported settlement adapter").
//!
//! The governing rule, made executable: **local exclusion protects a
//! process; destination idempotency protects an effect; consensus and
//! finality are established independently.** And the law that binds
//! hardest on real adapters: a worker that dies after a request left the
//! process is `UNKNOWN` — never never-executed.
//!
//! What this crate owns:
//!
//! - [`hive`] — the Hive rail: graphene serialization (differentially
//!   pinned to @hiveio/dhive 1.3.6 reference bytes), the digest
//!   `sha256(chain_id ∥ bytes)`, the transaction id `sha256(bytes)[0..20]`
//!   — both RECOMPUTED from canonical bytes, never trusted from a label —
//!   and the evidence ladder: inclusion by the documented `get_block`
//!   container, finality by `last_irreversible_block_num`.
//! - [`evm`] — the EVM rail: minimal RLP, EIP-1559 envelopes, the hash
//!   `keccak256(raw envelope)` recomputed from the journaled signed bytes,
//!   chain-id PINNING before anything is sent, inclusion by the block's
//!   transaction container, finality by the node's `finalized` block tag.
//! - [`railhost`] — the host-side persistence laws at the adapter seam:
//!   exact signed bytes + the chain transaction id journaled durably
//!   BEFORE submission; rebroadcast sourced from the authenticated
//!   journal; a missing record REFUSES, never invents.
//! - [`lineproto`] — the landed netpart line protocol (the harness wire),
//!   so `bnrose-dest-arb` / `bnrose-dest-hive` slot into the existing
//!   harness unchanged. `advance` is REFUSED: block production belongs to
//!   the chain, never the harness.
//! - [`faultproxy`] — live-wire fault injection on the rail's own HTTP
//!   connection: `drop` (the request never arrives), `drop-ack` (the
//!   request is delivered, the acknowledgement is lost), `delay`.
//!
//! Evidence classes stay SEPARATE and named — acceptance, destination
//! idempotency, inclusion, finality. None implies another; a `duplicate`
//! response is a reconciliation observation, never a success. The test
//! destination's finality model is never promoted: real rails answer
//! finality only from the chain's own markers, each labeled with its
//! exact semantics (a devnet `finalized` tag is labeled devnet finality,
//! never Arbitrum One production finality).

pub mod evm;
pub mod faultproxy;
pub mod hive;
pub mod lineproto;
pub mod railhost;

/// One rail's name for its own finality marker — always labeled, never
/// implied. This word rides every finality receipt this crate produces.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FinalityMethod {
    /// Hive mainnet-style: `last_irreversible_block_num` from
    /// `condenser_api.get_dynamic_global_properties`
    HiveLib,
    /// EVM node `finalized` block tag against a PRODUCTION chain
    EvmFinalizedTag,
    /// EVM node `finalized` block tag against a DEVNET (single-node
    /// topology — real EVM node software, NOT production finality)
    EvmDevnetFinalizedTag,
    /// a wire-shape mock's answers — adapter-logic evidence, never chain
    /// evidence
    MockLabeled,
}

impl FinalityMethod {
    pub fn word(self) -> &'static str {
        match self {
            FinalityMethod::HiveLib => "hive-lib",
            FinalityMethod::EvmFinalizedTag => "evm-finalized-tag",
            FinalityMethod::EvmDevnetFinalizedTag => {
                "evm-devnet-finalized-tag (labeled: single-node devnet, not production finality)"
            }
            FinalityMethod::MockLabeled => {
                "mock (labeled: wire-shape, adapter logic only, never chain evidence)"
            }
        }
    }
}

/// Acceptance evidence: a NODE verdict, separate from every other class.
#[derive(Clone, Debug)]
pub struct AcceptanceEvidence {
    pub tx_id: String,
    /// the id was recomputed from the submitted canonical bytes, not
    /// taken from any label
    pub id_recomputed_from_bytes: bool,
    pub verdict: AcceptanceVerdict,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AcceptanceVerdict {
    /// the node took the transaction (result shape)
    Accepted,
    /// the node already holds this exact transaction — an idempotency
    /// OBSERVATION, never a success
    Duplicate,
    /// the node refused it, with the refusal's own class word
    Refused(&'static str),
    /// no conclusive outcome within the window (UNKNOWN territory)
    NoAnswer,
}

/// Inclusion evidence: membership in the chain's DOCUMENTED container.
#[derive(Clone, Debug)]
pub struct InclusionEvidence {
    pub tx_id: String,
    pub container: &'static str,
    pub block_height: i64,
    pub member: bool,
}

/// Finality evidence: the chain's OWN irreversibility marker.
#[derive(Clone, Debug)]
pub struct FinalityEvidence {
    pub tx_id: String,
    pub block_height: i64,
    pub irreversible_height: i64,
    pub method: FinalityMethod,
    pub final_: bool,
}

/// hex encode (lowercase, no separator)
pub fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// hex decode — odd length or non-hex returns None (callers refuse)
pub fn unhex(s: &str) -> Option<Vec<u8>> {
    let s = s.trim_start_matches("0x");
    if s.len() % 2 != 0 {
        return None;
    }
    let mut out = Vec::with_capacity(s.len() / 2);
    let b = s.as_bytes();
    for i in (0..b.len()).step_by(2) {
        let hi = (b[i] as char).to_digit(16)?;
        let lo = (b[i + 1] as char).to_digit(16)?;
        out.push((hi * 16 + lo) as u8);
    }
    Some(out)
}
