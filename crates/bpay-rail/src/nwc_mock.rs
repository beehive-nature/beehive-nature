//! MOCK NIP-47 transport — the mock-first law (R13 order). In-memory,
//! zero network, NIP-47 JSON-shaped responses per the pinned spec
//! (nips/47.md + nwc 05.md): preimage + OPTIONAL fees_paid, the
//! five-state vocabulary, typed error codes, transport-ambiguity
//! injection for the Unknown probes.

use crate::nwc::{NwcError, NwcTransport};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MockPay {
    Pending,
    Settled { fees_msat: u64 },
    Failed,
}

/// In-memory NIP-47 service. `balance_msat` is informational.
pub struct MockNwcTransport {
    now_unix: u64,
    balance_msat: u64,
    /// bolt11-string -> payment record
    invoices: std::collections::HashMap<String, (Vec<u8>, MockPay)>, // (hash32, state)
    seq: u64,
    pub next_pay_ambiguous: bool,
    pub next_pay_fails: bool,
    pub next_rate_limited: bool,
    /// LU-8.1 probe: next successful pay result OMITS fees_paid.
    pub next_pay_no_fees: bool,
}

impl MockNwcTransport {
    pub fn new(now_unix: u64, balance_msat: u64) -> Self {
        MockNwcTransport {
            now_unix,
            balance_msat,
            invoices: std::collections::HashMap::new(),
            seq: 0,
            next_pay_ambiguous: false,
            next_pay_fails: false,
            next_rate_limited: false,
            next_pay_no_fees: false,
        }
    }

    /// make_invoice helper (test-side): mints a bolt11-mock string and
    /// returns (bolt11, payment_hash).
    pub fn mint_invoice(&mut self, expiry_secs: u64) -> (String, [u8; 32], u64) {
        self.seq += 1;
        let mut hash = [0u8; 32];
        let seq_bytes = self.seq.to_be_bytes();
        hash[..8].copy_from_slice(&seq_bytes);
        let bolt11 = format!("lnbc-mock-{}", hex::encode(hash));
        let expires = self.now_unix + expiry_secs;
        self.invoices
            .insert(bolt11.clone(), (hash.to_vec(), MockPay::Pending));
        (bolt11, hash, expires)
    }
}

impl NwcTransport for MockNwcTransport {
    fn request(
        &mut self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, NwcError> {
        match method {
            "get_info" => Ok(serde_json::json!({
                "alias": "mock-nwc",
                "network": "regtest",
                "methods": ["get_info", "get_balance", "make_invoice", "lookup_invoice", "pay_invoice", "list_transactions"],
            })),
            "get_balance" => Ok(serde_json::json!({ "balance": self.balance_msat })),
            "pay_invoice" => {
                if self.next_rate_limited {
                    self.next_rate_limited = false;
                    return Err(NwcError::RateLimited);
                }
                let invoice = params
                    .get("invoice")
                    .and_then(|i| i.as_str())
                    .ok_or_else(|| NwcError::Other("invoice param missing".into()))?;
                let rec = self.invoices.get_mut(invoice).ok_or(NwcError::NotFound)?;
                if self.next_pay_ambiguous {
                    self.next_pay_ambiguous = false;
                    return Err(NwcError::TransportAmbiguous(
                        "relay POST timed out mid-request".into(),
                    ));
                }
                if self.next_pay_fails {
                    self.next_pay_fails = false;
                    rec.1 = MockPay::Failed;
                    return Err(NwcError::PaymentFailed("no route (mock)".into()));
                }
                let fees = 25u64; // OPTIONAL field included here
                let mut preimage = rec.0.clone();
                preimage[31] ^= 0x5a;
                rec.1 = MockPay::Settled { fees_msat: fees };
                // LU-8.1 probe: a pay result with NO fees_paid testimony.
                if self.next_pay_no_fees {
                    self.next_pay_no_fees = false;
                    return Ok(serde_json::json!({
                        "preimage": hex::encode(preimage),
                    }));
                }
                Ok(serde_json::json!({
                    "preimage": hex::encode(preimage),
                    "fees_paid": fees,
                }))
            }
            "lookup_invoice" => {
                let hash_hex = params
                    .get("payment_hash")
                    .and_then(|h| h.as_str())
                    .ok_or_else(|| NwcError::Other("payment_hash param missing".into()))?;
                let rec = self
                    .invoices
                    .values_mut()
                    .find(|(h, _)| hex::encode(h) == hash_hex)
                    .ok_or(NwcError::NotFound)?;
                let state = match rec.1 {
                    MockPay::Pending => "pending",
                    MockPay::Settled { .. } => "settled",
                    MockPay::Failed => "failed",
                };
                Ok(serde_json::json!({ "state": state, "payment_hash": hash_hex }))
            }
            other => Err(NwcError::NotImplemented(format!(
                "mock does not implement {other}"
            ))),
        }
    }
}
