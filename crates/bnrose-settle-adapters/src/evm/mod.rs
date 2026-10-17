//! The EVM rail: JSON-RPC against one endpoint, read paths key-free by
//! construction (the `bindexer` oracle law: only the methods spelled in
//! this module exist on the read side; the ONE write verb lives behind
//! `send_raw` and carries the submission's identity law with it).
//!
//! Chain law (from `chain-exsat-evm`): the chain id is PINNED before
//! anything is sent — a node answering a different chain than the one
//! the envelope was built for is refused, loudly. Finality comes from
//! the node's own `finalized` block tag; heights are hex quantities on
//! this API, decoded strictly (a malformed quantity is an error, never
//! a zero).

pub mod rlp;
pub mod tx;

use crate::{AcceptanceVerdict, FinalityEvidence, FinalityMethod, InclusionEvidence};
use serde_json::{json, Value};
use sha3::Digest;
use std::time::Duration;

pub use tx::{Eip1559, SignedTx};

/// keccak-256 (Ethereum's hash — the ORIGINAL Keccak padding, which is
/// what `sha3::Keccak256` provides; NOT NIST SHA3-256)
pub fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut h = sha3::Keccak256::new();
    h.update(data);
    let out = h.finalize();
    let mut d = [0u8; 32];
    d.copy_from_slice(&out);
    d
}

/// what the node said about a raw submission
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SendOutcome {
    /// the node took it and answered the hash (which MUST equal our
    /// recomputed keccak — asserted by the caller, never assumed)
    Accepted { hash: String },
    /// the node already holds this exact transaction — idempotency
    /// OBSERVATION, never a success
    AlreadyKnown,
    /// a definitive refusal with its class word
    Refused { class: &'static str, text: String },
}

pub fn refusal_class(text: &str) -> &'static str {
    let t = text.to_lowercase();
    if t.contains("already known") || t.contains("already imported") {
        return "already-known";
    }
    if t.contains("nonce too low") {
        return "nonce-too-low";
    }
    if t.contains("insufficient funds") || t.contains("not enough funds") {
        return "insufficient-funds";
    }
    if t.contains("underpriced") || t.contains("replacement") {
        return "replacement";
    }
    if t.contains("intrinsic gas") || t.contains("gas too low") {
        return "gas";
    }
    if t.contains("chain id") || t.contains("wrong chain") {
        return "chain-id";
    }
    "refused-other"
}

/// how an RPC call failed — the distinction is LAW: a transport failure
/// means NO ANSWER (UNKNOWN territory), a node error is a VERDICT
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RpcErr {
    /// the request may or may not have crossed the wire — no answer came
    Transport(String),
    /// an answer came but could not be decoded — still no verdict
    Decode(String),
    /// the node answered an error object — a verdict
    Node(String),
}

impl RpcErr {
    pub fn text(&self) -> String {
        match self {
            RpcErr::Transport(t) | RpcErr::Decode(t) | RpcErr::Node(t) => t.clone(),
        }
    }
}

pub struct EvmRail {
    pub name: String,
    pub endpoint: String,
    agent: ureq::Agent,
}

impl EvmRail {
    pub fn new(name: &str, endpoint: &str) -> EvmRail {
        EvmRail {
            name: name.into(),
            endpoint: endpoint.into(),
            agent: ureq::AgentBuilder::new()
                .timeout(Duration::from_secs(10))
                .build(),
        }
    }

    fn rpc(&self, method: &str, params: Value) -> Result<Value, RpcErr> {
        let body = json!({"jsonrpc":"2.0","id":1,"method":method,"params":params});
        let resp = self
            .agent
            .post(&self.endpoint)
            .set("Content-Type", "application/json")
            // one complete round trip per call: no pooled keep-alive (a
            // desynced pooled connection once answered nothing while the
            // node kept the socket — measured against anvil, 2026-10-17)
            .set("Connection", "close")
            .send_string(&body.to_string())
            .map_err(|e| RpcErr::Transport(format!("{e}")))?;
        let text = resp
            .into_string()
            .map_err(|e| RpcErr::Transport(format!("read: {e}")))?;
        let v: Value =
            serde_json::from_str(&text).map_err(|e| RpcErr::Decode(format!("decode: {e}")))?;
        if let Some(e) = v.get("error") {
            return Err(RpcErr::Node(format!(
                "{} {}",
                e.get("message").and_then(|m| m.as_str()).unwrap_or(""),
                e.get("data").map(|d| d.to_string()).unwrap_or_default()
            )));
        }
        v.get("result")
            .cloned()
            .ok_or_else(|| RpcErr::Decode("missing result".into()))
    }

    pub fn chain_id(&self) -> Result<u64, String> {
        let v = self.rpc("eth_chainId", json!(null)).map_err(|e| e.text())?;
        let s = v.as_str().ok_or("chainId not a string")?;
        u64::from_str_radix(s.trim_start_matches("0x"), 16).map_err(|_| "chainId not hex".into())
    }

    /// the chain law: refuse to act against a node answering a different
    /// chain than the envelope was built for
    pub fn pin_chain_id(&self, expected: u64) -> Result<(), String> {
        let got = self.chain_id()?;
        if got != expected {
            return Err(format!(
                "chain-id pin: node answers {got:#x}, expected {expected:#x} — refusing"
            ));
        }
        Ok(())
    }

    /// the ONE write verb. `raw_hex` with or without the 0x prefix; the
    /// caller's recomputed hash rides along and a node answering a
    /// DIFFERENT hash is a shape violation, refused loudly. TRANSPORT
    /// failures return `Err(RpcErr::Transport)` — no answer is UNKNOWN,
    /// never a refusal; only a node error object is a verdict.
    pub fn send_raw(
        &self,
        raw_hex: &str,
        recomputed_hash_hex: &str,
    ) -> Result<SendOutcome, RpcErr> {
        let cleaned = format!("0x{}", raw_hex.trim_start_matches("0x"));
        match self.rpc("eth_sendRawTransaction", json!([cleaned])) {
            Ok(v) => {
                let answered = v.as_str().ok_or_else(|| {
                    RpcErr::Decode("sendRawTransaction result not a string".into())
                })?;
                if !answered
                    .trim_start_matches("0x")
                    .eq_ignore_ascii_case(recomputed_hash_hex.trim_start_matches("0x"))
                {
                    return Err(RpcErr::Decode(format!(
                        "shape violation: node answered hash {answered}, we recomputed {recomputed_hash_hex} from the submitted bytes"
                    )));
                }
                Ok(SendOutcome::Accepted {
                    hash: answered.to_lowercase(),
                })
            }
            Err(RpcErr::Node(text)) => {
                let class = refusal_class(&text);
                if class == "already-known" {
                    return Ok(SendOutcome::AlreadyKnown);
                }
                Ok(SendOutcome::Refused {
                    class,
                    text: text.trim().to_string(),
                })
            }
            Err(e) => Err(e),
        }
    }

    pub fn receipt(&self, hash_hex: &str) -> Result<Option<Value>, RpcErr> {
        let v = self.rpc(
            "eth_getTransactionReceipt",
            json!([format!("0x{}", hash_hex.trim_start_matches("0x"))]),
        )?;
        if v.is_null() {
            return Ok(None);
        }
        Ok(Some(v))
    }

    pub fn tx_by_hash(&self, hash_hex: &str) -> Result<Option<Value>, RpcErr> {
        let v = self.rpc(
            "eth_getTransactionByHash",
            json!([format!("0x{}", hash_hex.trim_start_matches("0x"))]),
        )?;
        if v.is_null() {
            return Ok(None);
        }
        Ok(Some(v))
    }

    /// block height at a tag ("latest", "finalized", …). A missing
    /// `finalized` answer is an ERROR (fail closed), never a zero.
    pub fn block_height(&self, tag: &str) -> Result<u64, RpcErr> {
        let v = self.rpc("eth_getBlockByNumber", json!([tag, false]))?;
        if v.is_null() {
            return Err(RpcErr::Node(format!(
                "block tag {tag}: absent (fail closed)"
            )));
        }
        let n = v
            .get("number")
            .and_then(|x| x.as_str())
            .ok_or(RpcErr::Decode("block without number".into()))?;
        u64::from_str_radix(n.trim_start_matches("0x"), 16)
            .map_err(|_| RpcErr::Decode(format!("block number not hex: {n}")))
    }

    /// INCLUSION evidence: membership in the block's transaction
    /// container (the `transactions` array of hashes)
    pub fn inclusion(
        &self,
        hash_hex: &str,
        block_height: u64,
    ) -> Result<InclusionEvidence, RpcErr> {
        let v = self.rpc(
            "eth_getBlockByNumber",
            json!([format!("0x{block_height:x}"), false]),
        )?;
        if v.is_null() {
            return Err(RpcErr::Node(format!("block {block_height} absent")));
        }
        let txs = v
            .get("transactions")
            .and_then(|x| x.as_array())
            .ok_or(RpcErr::Decode("block without transactions array".into()))?;
        let member = txs.iter().any(|x| {
            x.as_str()
                .map(|s| {
                    s.trim_start_matches("0x")
                        .eq_ignore_ascii_case(hash_hex.trim_start_matches("0x"))
                })
                .unwrap_or(false)
        });
        Ok(InclusionEvidence {
            tx_id: hash_hex.to_lowercase(),
            container: "block.transactions (hash array)",
            block_height: block_height as i64,
            member,
        })
    }

    /// FINALITY evidence: the node's `finalized` tag against the receipt
    /// block. `method` carries WHICH chain answered — a devnet's
    /// `finalized` is labeled devnet finality, never production's.
    pub fn finality(
        &self,
        hash_hex: &str,
        block_height: u64,
        method: FinalityMethod,
    ) -> Result<FinalityEvidence, RpcErr> {
        let finalized = self.block_height("finalized")?;
        Ok(FinalityEvidence {
            tx_id: hash_hex.to_lowercase(),
            block_height: block_height as i64,
            irreversible_height: finalized as i64,
            method,
            final_: finalized >= block_height,
        })
    }

    /// DEVNET-ONLY admin: ask the node to produce a block (anvil's
    /// evm_mine). Acceptance and inclusion are SEPARATE classes — the
    /// mempool ack is acceptance, inclusion needs a block, and on the
    /// devnet the harness asks the REAL node software to build one.
    /// Production rails never call this; it is not a read, not a send,
    /// and exists nowhere outside devnet batteries.
    pub fn devnet_mine(&self) -> Result<(), RpcErr> {
        self.rpc("evm_mine", serde_json::json!([])).map(|_| ())
    }
}

/// map a send outcome to the harness acceptance words
pub fn acceptance_of(outcome: &SendOutcome) -> AcceptanceVerdict {
    match outcome {
        SendOutcome::Accepted { .. } => AcceptanceVerdict::Accepted,
        SendOutcome::AlreadyKnown => AcceptanceVerdict::Duplicate,
        SendOutcome::Refused { class, .. } => AcceptanceVerdict::Refused(class),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keccak_matches_the_known_empty_and_hello_vectors() {
        // the canonical keccak-256 test vectors ( PUBLIC-CONSTANT )
        assert_eq!(
            crate::hex(&keccak256(b"")),
            "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470" // PUBLIC-CONSTANT: keccak-256 of the empty string
        );
        assert_eq!(
            crate::hex(&keccak256(b"hello")),
            "1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8" // PUBLIC-CONSTANT: keccak-256 of "hello"
        );
    }

    #[test]
    fn refusal_classes() {
        assert_eq!(refusal_class("already known"), "already-known");
        assert_eq!(refusal_class("nonce too low"), "nonce-too-low");
        assert_eq!(
            refusal_class("insufficient funds for gas * price + value"),
            "insufficient-funds"
        );
        assert_eq!(
            refusal_class("replacement transaction underpriced"),
            "replacement"
        );
        assert_eq!(refusal_class("weird node text"), "refused-other");
    }
}
