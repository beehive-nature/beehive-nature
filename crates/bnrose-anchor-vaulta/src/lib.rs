//! # bnrose-anchor-vaulta — the Vaulta carrier for bnrose-evolve anchors
//!
//! bnrose-evolve states its journal head as an [`AnchorStatement`] and checks
//! a journal against the latest one at [`bnrose_evolve::Controller::open_anchored`].
//! This crate is the part that touches a chain, kept out of the controller so
//! the controller still opens no socket:
//!
//! - [`latest`] reads a subject's row from the `evanchor` contract
//!   (`contracts/evanchor/evanchor.cpp`) with `get_table_rows`, on every
//!   endpoint it is given, after checking each endpoint's chain id. Endpoints
//!   that disagree, a wrong chain, a transport failure or a row that does not
//!   decode all come back as [`AnchorLookup::Unreachable`], so the open fails
//!   closed. Only an answer of "no row" from every endpoint is
//!   [`AnchorLookup::NeverAnchored`].
//! - [`anchor_action`] builds the UNSIGNED `evanchor::anchor` action for a
//!   statement. Signing and pushing it are the estate's signer lanes (the
//!   wallet's one-press sign, cleos with its own wallet): this crate holds no
//!   key, asks for none, and signs nothing.
//!
//! Persistence law for whoever pushes (WB004 handoff §2): the action data is
//! a pure function of the statement, so a rebroadcast of the same signed
//! bytes is the only legitimate retry; an unresolved push is UNKNOWN, never
//! re-signed as a new transaction. The contract refuses a count that does not
//! grow, so a replacement for the same statement cannot land twice.

use bnrose_evolve::{AnchorLookup, AnchorStatement};
use serde_json::{json, Value};

/// Jungle4's chain id (`/v1/chain/get_info`, read 2026-10-15).
pub const JUNGLE4_CHAIN_ID: &str =
    "73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d"; // PUBLIC-CONSTANT

/// The table the contract keeps one row per subject in.
pub const TABLE: &str = "anchors";

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(s.get(i..i + 2)?, 16).ok())
        .collect()
}

/// The unsigned `anchor` action for `statement`, to be signed by `publisher`
/// in a signer lane. Its `data` is the contract ABI's JSON form.
pub fn anchor_action(contract: &str, publisher: &str, statement: &AnchorStatement) -> Value {
    json!({
        "account": contract,
        "name": "anchor",
        "authorization": [{"actor": publisher, "permission": "active"}],
        "data": {
            "publisher": publisher,
            "subject": statement.subject,
            "count": statement.count,
            "statement": hex(&statement.encode()),
        },
    })
}

/// The `get_table_rows` request body for one subject's row.
pub fn table_request(contract: &str, subject: &str) -> Value {
    json!({
        "code": contract,
        "scope": contract,
        "table": TABLE,
        "json": true,
        "lower_bound": subject,
        "upper_bound": subject,
        "limit": 1,
    })
}

/// Read one endpoint's `get_info` answer: the chain id must be `chain_id`.
pub fn check_chain(info: &Value, chain_id: &str) -> Result<(), String> {
    match info.get("chain_id").and_then(Value::as_str) {
        Some(id) if id == chain_id => Ok(()),
        Some(id) => Err(format!(
            "endpoint serves chain {}…, not {}…",
            id.get(..16).unwrap_or(id),
            chain_id.get(..16).unwrap_or(chain_id)
        )),
        None => Err("get_info carried no chain_id".into()),
    }
}

/// Read one endpoint's `get_table_rows` answer for `subject`. `Ok(None)` is
/// an answer with no row; every malformed answer is an `Err`.
pub fn parse_rows(rows: &Value, subject: &str) -> Result<Option<AnchorStatement>, String> {
    let list = rows
        .get("rows")
        .and_then(Value::as_array)
        .ok_or("get_table_rows carried no rows array")?;
    let row = match list.as_slice() {
        [] => return Ok(None),
        [row] => row,
        _ => return Err("more than one row for one subject".into()),
    };
    let field = |k: &str| row.get(k).ok_or(format!("row has no {k}"));
    let row_subject = field("subject")?.as_str().ok_or("subject is not a name")?;
    if row_subject != subject {
        // lower_bound returns the next row when the subject has none
        return Ok(None);
    }
    let count = match field("count")? {
        Value::Number(n) => n.as_u64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
    .ok_or("count is not a u64")?;
    let bytes = field("statement")?
        .as_str()
        .and_then(unhex)
        .ok_or("statement is not hex")?;
    let s = AnchorStatement::decode(&bytes).map_err(|e| format!("statement: {e}"))?;
    if s.subject != subject || s.count != count {
        return Err("the row's subject or count is not its statement's".into());
    }
    Ok(Some(s))
}

/// Fold every endpoint's answer into one lookup: all must answer, and all
/// must say the same thing.
pub fn agree(answers: Vec<Result<Option<AnchorStatement>, String>>) -> AnchorLookup {
    let mut first: Option<Option<AnchorStatement>> = None;
    if answers.is_empty() {
        return AnchorLookup::Unreachable("no endpoint given".into());
    }
    for (i, a) in answers.into_iter().enumerate() {
        let a = match a {
            Ok(a) => a,
            Err(e) => return AnchorLookup::Unreachable(format!("endpoint {i}: {e}")),
        };
        match &first {
            None => first = Some(a),
            Some(f) if *f == a => {}
            Some(_) => {
                return AnchorLookup::Unreachable(format!("endpoint {i} disagrees with endpoint 0"))
            }
        }
    }
    match first.flatten() {
        Some(s) => AnchorLookup::Anchored(s),
        None => AnchorLookup::NeverAnchored,
    }
}

fn read_one(
    agent: &ureq::Agent,
    endpoint: &str,
    chain_id: &str,
    contract: &str,
    subject: &str,
) -> Result<Option<AnchorStatement>, String> {
    let base = endpoint.trim_end_matches('/');
    let info: Value = agent
        .get(&format!("{base}/v1/chain/get_info"))
        .call()
        .map_err(|e| format!("get_info: {e}"))?
        .into_json()
        .map_err(|e| format!("get_info: {e}"))?;
    check_chain(&info, chain_id)?;
    let rows: Value = agent
        .post(&format!("{base}/v1/chain/get_table_rows"))
        .send_json(table_request(contract, subject))
        .map_err(|e| format!("get_table_rows: {e}"))?
        .into_json()
        .map_err(|e| format!("get_table_rows: {e}"))?;
    parse_rows(&rows, subject)
}

/// The latest anchor of `subject` on `contract`, read from every endpoint.
pub fn latest(endpoints: &[&str], chain_id: &str, contract: &str, subject: &str) -> AnchorLookup {
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(15))
        .build();
    agree(
        endpoints
            .iter()
            .map(|e| read_one(&agent, e, chain_id, contract, subject))
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_roundtrips_and_refuses_odd_or_foreign() {
        let b = [0u8, 1, 0xab, 0xff];
        assert_eq!(unhex(&hex(&b)).unwrap(), b);
        assert!(unhex("abc").is_none());
        assert!(unhex("zz").is_none());
        assert!(unhex("é0").is_none());
    }
}
