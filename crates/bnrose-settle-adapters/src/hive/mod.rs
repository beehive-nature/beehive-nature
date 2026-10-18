//! The Hive rail: JSON-RPC against one endpoint, with every node answer
//! CLASSIFIED before it is believed, and the evidence ladder (inclusion
//! by the documented container, finality by LIB) built from classified
//! reads only.
//!
//! API realities carried as law here (live-earned 2026-10-13, see the
//! estate's Hive API realities): `condenser_api` methods take POSITIONAL
//! params; `get_transaction` of an unknown id answers an ASSERT-error
//! SHAPE (not a null result); the documented `get_block` membership
//! container is the TOP-LEVEL `transaction_ids` array; heights are
//! INTEGERS on this API, never hex. A node error is only a REFUSAL when
//! the text matches hived's own pre-execution checks — any other error
//! body (a gateway's timeout, an internal error in front of hived)
//! proves nothing: hived may already hold the bytes.

pub mod ser;

use crate::{AcceptanceVerdict, FinalityEvidence, FinalityMethod, InclusionEvidence};
use serde_json::{json, Value};
use std::time::Duration;

/// A node answer, classified. The classes are the evidence law: only
/// `Ok` and `Duplicate` say anything about the chain's state;
/// `HivedRefusal` is the node's OWN verdict that it would not take the
/// transaction; `GatewayNoVerdict` is an answer that proves nothing.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HiveAnswer {
    Ok(Value),
    Duplicate(String),
    HivedRefusal { class: &'static str, text: String },
    GatewayNoVerdict(String),
}

/// hived's own pre-execution check classes (the wallet's `hiveNo`,
/// classified one word each)
pub fn hived_refusal_class(text: &str) -> Option<&'static str> {
    let t = text.to_lowercase();
    let has = |pats: &[&str]| pats.iter().any(|p| t.contains(p));
    if has(&[
        "sufficient funds",
        "insufficient",
        "does not have sufficient",
    ]) {
        return Some("insufficient-funds");
    }
    if has(&[
        "missing required active authority",
        "missing authority",
        "irrelevant signature",
        "unknown key",
    ]) {
        return Some("authority");
    }
    if has(&["does not exist", "unknown account", "is_valid_account_name"]) {
        return Some("unknown-account");
    }
    if has(&["memo is too", "memo must"]) {
        return Some("memo");
    }
    if has(&[
        "trx.expiration",
        "transaction_expiration",
        "transaction expiration",
        "transaction expired",
        "now < trx.expiration",
        "now < full_transaction->get_runtime_expiration",
    ]) {
        return Some("expiration");
    }
    if has(&["tapos", "ref_block_num", "ref_block_prefix"]) {
        return Some("tapos");
    }
    if has(&["not_enough_rc", "rc_plugin_exception"]) || t.contains(" rc ") {
        return Some("resource-credits");
    }
    if has(&["negative amount", "amount.amount > 0"]) {
        return Some("amount");
    }
    None
}

/// the transaction-status plugin's ladder, when a node runs it
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TrxStatus {
    WithinMempool,
    WithinReversible,
    WithinIrreversible,
    ExpiredIrreversible,
    TooOld,
    Unknown,
}

impl TrxStatus {
    fn parse(s: &str) -> TrxStatus {
        match s {
            "within_mempool" => TrxStatus::WithinMempool,
            "within_reversible_block" => TrxStatus::WithinReversible,
            "within_irreversible_block" => TrxStatus::WithinIrreversible,
            "expired_irreversible" => TrxStatus::ExpiredIrreversible,
            "too_old" => TrxStatus::TooOld,
            _ => TrxStatus::Unknown,
        }
    }
    pub fn word(self) -> &'static str {
        match self {
            TrxStatus::WithinMempool => "within_mempool",
            TrxStatus::WithinReversible => "within_reversible_block",
            TrxStatus::WithinIrreversible => "within_irreversible_block",
            TrxStatus::ExpiredIrreversible => "expired_irreversible",
            TrxStatus::TooOld => "too_old",
            TrxStatus::Unknown => "unknown",
        }
    }
}

pub struct HiveRail {
    pub name: String,
    pub endpoint: String,
    pub chain_id: [u8; 32],
    agent: ureq::Agent,
}

impl HiveRail {
    pub fn new(name: &str, endpoint: &str, chain_id_hex: &str) -> Result<HiveRail, String> {
        Ok(HiveRail {
            name: name.into(),
            endpoint: endpoint.into(),
            chain_id: ser::chain_id_from_hex(chain_id_hex)?,
            agent: ureq::AgentBuilder::new()
                .timeout(Duration::from_secs(10))
                .build(),
        })
    }

    /// one JSON-RPC call, answer classified
    pub fn call(&self, method: &str, params: Value) -> Result<HiveAnswer, String> {
        let body = json!({"jsonrpc":"2.0","id":1,"method":method,"params":params});
        let resp = self
            .agent
            .post(&self.endpoint)
            .set("Content-Type", "application/json")
            .send_string(&body.to_string())
            .map_err(|e| format!("transport: {e}"))?;
        let text = resp.into_string().map_err(|e| format!("read: {e}"))?;
        let v: Value = serde_json::from_str(&text).map_err(|e| format!("decode: {e}"))?;
        if let Some(r) = v.get("result") {
            return Ok(HiveAnswer::Ok(r.clone()));
        }
        if let Some(e) = v.get("error") {
            let msg = format!(
                "{} {}",
                e.get("message").and_then(|m| m.as_str()).unwrap_or(""),
                e.get("data").map(|d| d.to_string()).unwrap_or_default()
            );
            // the duplicate word must be the MESSAGE's verdict (hived says
            // 'duplicate transaction'); a 'duplicate' FIELD inside the
            // structured data is not a verdict (live-earned 2026-10-17:
            // an expiration assert whose data carried such a field)
            let message_only = e
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("")
                .to_lowercase();
            if message_only.contains("duplicate transaction")
                || message_only.contains("duplicate transaction")
            {
                return Ok(HiveAnswer::Duplicate(msg));
            }
            if let Some(class) = hived_refusal_class(&msg) {
                return Ok(HiveAnswer::HivedRefusal {
                    class,
                    text: msg.trim().to_string(),
                });
            }
            return Ok(HiveAnswer::GatewayNoVerdict(msg.trim().to_string()));
        }
        Err("response with neither result nor error".into())
    }

    /// dynamic global properties — head and LIB, integer-only
    pub fn globals(&self) -> Result<(i64, i64), String> {
        match self.call("condenser_api.get_dynamic_global_properties", json!([]))? {
            HiveAnswer::Ok(v) => {
                let head = v
                    .get("head_block_number")
                    .and_then(|x| x.as_i64())
                    .ok_or("dgp: head_block_number not an integer")?;
                let lib = v
                    .get("last_irreversible_block_num")
                    .and_then(|x| x.as_i64())
                    .ok_or("dgp: last_irreversible_block_num not an integer")?;
                Ok((head, lib))
            }
            _ => Err("dgp: classified non-result".into()),
        }
    }

    /// get_transaction by id (positional). The live-earned reality: an
    /// unknown id answers an ASSERT-error shape; a found transaction
    /// carries `block_num` and the full signed transaction.
    pub fn get_transaction(&self, tx_id: &str) -> Result<Option<Value>, String> {
        match self.call("condenser_api.get_transaction", json!([tx_id]))? {
            HiveAnswer::Ok(v) => {
                if v.is_null() {
                    return Ok(None);
                }
                Ok(Some(v))
            }
            // the documented not-found shape: an assert-class error, not a
            // verdict about execution — classified as not-found
            HiveAnswer::GatewayNoVerdict(t) if t.to_lowercase().contains("assert") => Ok(None),
            HiveAnswer::HivedRefusal { class: "tapos", .. } => Ok(None),
            _ => Err("get_transaction: unclassified answer".into()),
        }
    }

    /// get_block by height (positional), integer heights only
    pub fn get_block(&self, height: i64) -> Result<Value, String> {
        match self.call("condenser_api.get_block", json!([height]))? {
            HiveAnswer::Ok(v) => {
                if v.is_null() {
                    return Err(format!("get_block: {height} absent"));
                }
                Ok(v)
            }
            _ => Err("get_block: classified non-result".into()),
        }
    }

    /// broadcast a signed transaction object (positional single param)
    pub fn broadcast(&self, signed: &Value) -> Result<HiveAnswer, String> {
        self.call("condenser_api.broadcast_transaction", json!([signed]))
    }

    /// transaction_status_api.find_transaction (named params), when the
    /// node runs the plugin
    pub fn find_transaction(&self, tx_id: &str, expiration: &str) -> Result<TrxStatus, String> {
        match self.call(
            "transaction_status_api.find_transaction",
            json!({"transaction_id": tx_id, "expiration": expiration}),
        )? {
            HiveAnswer::Ok(v) => Ok(TrxStatus::parse(
                v.get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("unknown"),
            )),
            _ => Ok(TrxStatus::Unknown),
        }
    }

    /// INCLUSION evidence: the transaction's own `block_num` (integer)
    /// plus membership in the DOCUMENTED container — the block's top-level
    /// `transaction_ids` array (with `transactions[].transaction_id` as
    /// the corroborating second read when present).
    pub fn inclusion(&self, tx_id: &str) -> Result<Option<InclusionEvidence>, String> {
        let Some(trx) = self.get_transaction(tx_id)? else {
            return Ok(None);
        };
        let block_num = trx
            .get("block_num")
            .and_then(|x| x.as_i64())
            .ok_or("get_transaction: block_num not an integer")?;
        let block = self.get_block(block_num)?;
        let documented = block
            .get("transaction_ids")
            .and_then(|x| x.as_array())
            .ok_or("get_block: documented top-level transaction_ids array absent")?;
        let member = documented.iter().any(|x| x.as_str() == Some(tx_id));
        let mut container = "block.transaction_ids (documented top-level)";
        if !member {
            if let Some(txs) = block.get("transactions").and_then(|x| x.as_array()) {
                if txs
                    .iter()
                    .any(|x| x.get("transaction_id").and_then(|y| y.as_str()) == Some(tx_id))
                {
                    container = "block.transactions[].transaction_id (corroborating read)";
                    return Ok(Some(InclusionEvidence {
                        tx_id: tx_id.into(),
                        container,
                        block_height: block_num,
                        member: true,
                    }));
                }
            }
            container = "block.transaction_ids (documented top-level; NOT A MEMBER)";
        }
        Ok(Some(InclusionEvidence {
            tx_id: tx_id.into(),
            container,
            block_height: block_num,
            member,
        }))
    }

    /// FINALITY evidence: the chain's own LIB ladder. `method` states
    /// which chain marker answered (production Hive vs a labeled mock).
    pub fn finality(
        &self,
        tx_id: &str,
        block_height: i64,
        method: FinalityMethod,
    ) -> Result<FinalityEvidence, String> {
        let (_head, lib) = self.globals()?;
        Ok(FinalityEvidence {
            tx_id: tx_id.into(),
            block_height,
            irreversible_height: lib,
            method,
            final_: lib >= block_height,
        })
    }

    /// The OBSERVE ladder for a destination: the chain's own record
    /// decides, never the local ledger. `None` = no record on this node.
    pub fn observe(&self, tx_id: &str) -> Result<Option<(i64, bool)>, String> {
        let Some(trx) = self.get_transaction(tx_id)? else {
            return Ok(None);
        };
        let block_num = trx
            .get("block_num")
            .and_then(|x| x.as_i64())
            .ok_or("get_transaction: block_num not an integer")?;
        let (_head, lib) = self.globals()?;
        Ok(Some((block_num, lib >= block_num)))
    }
}

/// Parse a chain-held signed transaction (the shape `get_transaction`
/// returns) back into the canonical model, so the id can be RECOMPUTED
/// from its bytes — endpoint labels are never identity.
pub fn parse_chain_trx(v: &Value) -> Result<ser::UnsignedTrx, String> {
    let ref_block_num = v
        .get("ref_block_num")
        .and_then(|x| x.as_u64())
        .ok_or("ref_block_num missing")? as u16;
    let ref_block_prefix = v
        .get("ref_block_prefix")
        .and_then(|x| x.as_u64())
        .ok_or("ref_block_prefix missing")? as u32;
    let expiration = match v.get("expiration") {
        Some(Value::Number(n)) => n.as_u64().ok_or("expiration not unsigned")? as u32,
        Some(Value::String(s)) => {
            let normalized = if s.ends_with('Z') {
                s.clone()
            } else {
                format!("{s}Z")
            };
            let dt = chrono_independent_unix(&normalized)?;
            dt
        }
        _ => return Err("expiration missing".into()),
    };
    let ops = v
        .get("operations")
        .and_then(|x| x.as_array())
        .ok_or("operations missing")?;
    let mut operations = Vec::with_capacity(ops.len());
    for op in ops {
        let pair = op.as_array().ok_or("operation not a [id, body] pair")?;
        if pair.len() != 2 {
            return Err("operation pair malformed".into());
        }
        let id = match &pair[0] {
            // the condenser wire form carries the operation NAME; the
            // numeric id lives in the serialized bytes
            Value::String(s) => match s.as_str() {
                "comment" => 1u64,
                "transfer" => 2u64,
                other => {
                    return Err(format!(
                        "unsupported operation {other} (comment, transfer are the pinned rails)"
                    ))
                }
            },
            Value::Number(n) => n.as_u64().ok_or("operation id not unsigned")?,
            _ => return Err("operation id neither name nor number".into()),
        };
        let body = &pair[1];
        let gs = |k: &str| -> Result<String, String> {
            body.get(k)
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .ok_or(format!("op field {k} missing"))
        };
        operations.push(match id {
            1 => ser::HiveOperation::Comment(ser::CommentOp {
                parent_author: gs("parent_author")?,
                parent_permlink: gs("parent_permlink")?,
                author: gs("author")?,
                permlink: gs("permlink")?,
                title: gs("title")?,
                body: gs("body")?,
                json_metadata: gs("json_metadata")?,
            }),
            2 => {
                let amount_word = gs("amount")?;
                let (num, sym) = amount_word
                    .split_once(' ')
                    .ok_or("transfer amount not '<number> <SYMBOL>'")?;
                operations_amount_check(num)?;
                ser::HiveOperation::Transfer(ser::TransferOp {
                    from: gs("from")?,
                    to: gs("to")?,
                    amount: num.to_string(),
                    sym: match sym {
                        "HIVE" => ser::HiveSymbol::Hive,
                        "HBD" => ser::HiveSymbol::Hbd,
                        other => return Err(format!("unsupported symbol {other}")),
                    },
                    memo: gs("memo")?,
                })
            }
            other => {
                return Err(format!(
                    "unsupported operation id {other} (comment=1, transfer=2 are the pinned rails)"
                ))
            }
        });
    }
    Ok(ser::UnsignedTrx {
        ref_block_num,
        ref_block_prefix,
        expiration,
        operations,
    })
}

fn operations_amount_check(num: &str) -> Result<(), String> {
    ser::canonical_amount(num).map_err(|e| e).map(|_| ())
}

/// ISO-8601 to unix seconds without a chrono dependency (the wire sends
/// "YYYY-MM-DDTHH:MM:SS", UTC on this API). Public: the wire-shape mock
/// in the battery reuses it for its expiry clock.
pub fn chrono_independent_unix(s: &str) -> Result<u32, String> {
    let b = s.as_bytes();
    if b.len() != 20
        || b[4] != b'-'
        || b[7] != b'-'
        || b[10] != b'T'
        || b[13] != b':'
        || b[16] != b':'
        || b[19] != b'Z'
    {
        return Err(format!("expiration not ISO-8601 UTC: {s}"));
    }
    let digits = |from: usize, to: usize| -> Result<u32, String> {
        let mut n = 0u32;
        for &c in &b[from..to] {
            if !c.is_ascii_digit() {
                return Err("expiration: non-digit".into());
            }
            n = n * 10 + (c - b'0') as u32;
        }
        Ok(n)
    };
    let (y, mo, d, h, mi, se) = (
        digits(0, 4)?,
        digits(5, 7)?,
        digits(8, 10)?,
        digits(11, 13)?,
        digits(14, 16)?,
        digits(17, 19)?,
    );
    if !(1..=12).contains(&mo) || !(1..=31).contains(&d) || h > 23 || mi > 59 || se > 59 {
        return Err("expiration: out-of-range field".into());
    }
    // days since epoch (civil-from-days, Howard Hinnant's algorithm)
    let yy = if mo <= 2 { y - 1 } else { y } as i64;
    let era = if yy >= 0 { yy } else { yy - 399 } / 400;
    let yoe = yy - era * 400;
    let mp = (mo as i64 + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + doe - 719468;
    let secs = days * 86400 + h as i64 * 3600 + mi as i64 * 60 + se as i64;
    u32::try_from(secs).map_err(|_| "expiration: outside u32".to_string())
}

/// map a classified broadcast answer to the acceptance verdict words the
/// harness carries (a duplicate is an OBSERVATION, never a success)
pub fn acceptance_of(answer: &HiveAnswer) -> AcceptanceVerdict {
    match answer {
        HiveAnswer::Ok(_) => AcceptanceVerdict::Accepted,
        HiveAnswer::Duplicate(_) => AcceptanceVerdict::Duplicate,
        HiveAnswer::HivedRefusal { class, .. } => AcceptanceVerdict::Refused(class),
        HiveAnswer::GatewayNoVerdict(_) => AcceptanceVerdict::NoAnswer,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso_parse_matches_known_values() {
        // 2026-10-05T12:00:00Z = day 20731 × 86400 + 12h — the pinned REF expiration
        assert_eq!(
            chrono_independent_unix("2026-10-05T12:00:00Z").unwrap(),
            1791201600
        );
        assert_eq!(chrono_independent_unix("1970-01-01T00:00:00Z").unwrap(), 0);
        assert_eq!(
            chrono_independent_unix("2000-02-29T00:00:00Z").unwrap(),
            951782400
        );
    }

    #[test]
    fn refusal_classes_match_hived_text() {
        assert_eq!(
            hived_refusal_class("Assert Exception:now < trx.expiration: "),
            Some("expiration")
        );
        assert_eq!(
            hived_refusal_class("Account does not have sufficient funds for balance adjustment"),
            Some("insufficient-funds")
        );
        assert_eq!(
            hived_refusal_class("missing required active authority"),
            Some("authority")
        );
        assert_eq!(hived_refusal_class("Internal Error"), None);
    }

    #[test]
    fn parse_chain_trx_roundtrips_the_reference() {
        let v = json!({
            "ref_block_num": 12345,
            "ref_block_prefix": 3123456789u32,
            "expiration": "2026-10-05T12:00:00Z",
            "operations": [
                ["transfer", {"from":"loviswater","to":"someoneelse","amount":"1.234 HIVE","memo":"hi ✓"}],
                ["transfer", {"from":"loviswater","to":"someoneelse","amount":"0.500 HBD","memo":""}]
            ]
        });
        // the parsed transaction must serialize to the SAME canonical
        // bytes as the native model — this IS the pinned REF transaction,
        // so the bytes must equal the dhive vector byte for byte
        let trx = parse_chain_trx(&v).unwrap();
        let ser = ser::serialize_trx(&trx).unwrap();
        assert_eq!(trx.expiration, 1791201600);
        assert_eq!(
            crate::hex(&ser),
            "3930152b2cba4091c36a02020a6c6f76697377617465720b736f6d656f6e65656c7365d20400000000000003535445454d000006686920e29c93020a6c6f76697377617465720b736f6d656f6e65656c7365f40100000000000003534244000000000000" // PUBLIC-CONSTANT: the dhive reference bytes (roundtrip pin)
        );
    }
}
