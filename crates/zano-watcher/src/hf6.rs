//! HF6 transfer read path — the Zano watcher's post-hard-fork scanner.
//!
//! # The contract (refusals + HF6 minimum — the lane's whole law)
//!
//! **HF6 minimum, refuse to START below it:** this module refuses to begin
//! any scan unless the daemon reports version ≥ **2.2.1.501** and height ≥
//! **3,833,000** (HF6 activation; min build 501 per `currency_config.h:319`
//! as read in the 2026-09-01 source audit). A daemon that does not answer
//! both is refused the same way — no fallback, no "probably fine".
//!
//! **Refuse, don't flag** (the reversibility precedent — a bad record is
//! rejected by name, never warned about and passed through):
//! 1. [`Hf6Error::SelfDirectedPaymentId`] — a payment id on a self-directed
//!    transfer (the wallet-visible marker: no remote addresses). Zano's own
//!    wallet policy forbids these at HF6 (`wallet2.cpp`
//!    `check_and_throw_if_self_directed_tx_with_payment_id_requested`);
//!    this reader refuses them too, by name.
//! 2. [`Hf6Error::LegacyPidWithGatewayOutput`] — a legacy tx-wide
//!    `payment_id` on any tx carrying a gateway output
//!    (`txin_gateway`/`tx_out_gateway`). Per-output intrinsic payment ids
//!    replaced the tx-wide field at HF6; a tx-wide id alongside a gateway
//!    output is a malformed hybrid and is refused.
//! 3. [`Hf6Error::DaemonBelowHf6Minimum`] / [`Hf6Error::DaemonHeightBelowHf6`]
//!    — the start gates above.
//!
//! **Attribution law:** deposit attribution keys on
//! **(payment_id, asset_id)** from `subtransfers_by_pid` — grouped by
//! payment id, then asset, summing `amount` per `is_income` direction. A
//! tx-level payment id is NEVER an attribution key; the tx-wide field is
//! read only to power refusal 2.
//!
//! **Gateway types are READ PATH ONLY:** `txin_gateway` / `tx_out_gateway`
//! entries parse (optional `asset_id`, `gw_addr`) so scans do not break on
//! gateway traffic. No registration, no signing, no bridging, nothing that
//! moves value — those live outside this crate by design.
//!
//! **What was removed and never reintroduced:** wallet-RPC `push_payer` /
//! `hide_receiver` parameters and any `BRIDGING_TRANSFER` companion concept
//! have no code path here (the 2026-09-04 audit found none to delete; this
//! doc is the fence that none appears).
//!
//! Wire shapes follow `get_recent_txs_and_info3` (the `_info`/`_info2`
//! lineage was superseded at HF6). The RPC parameter surface of `info3` and
//! the gateway address format are **UNVERIFIED at source** — this module
//! depends only on the field names named above and refuses shapes it cannot
//! read exactly.

#![forbid(unsafe_code)]

use serde_json::Value;

/// HF6 activation height (mainnet, order context 2026-08-31;
/// `ZANO_HARDFORK_06_AFTER_HEIGHT` per the 2026-09-01 source audit).
pub const HF6_HEIGHT: u64 = 3_833_000;
/// Minimum daemon build for the HF6 read path (order: "v2.2.1.5xx";
/// source audit: min build 501).
pub const HF6_MIN_VERSION: (u32, u32, u32, u32) = (2, 2, 1, 501);

/// Named refusals — no fallback paths, no warnings-as-errors mixing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Hf6Error {
    /// Refusal 1: a payment id rode a self-directed transfer.
    SelfDirectedPaymentId { tx_hash: String, payment_id: String },
    /// Refusal 2: a legacy tx-wide payment id appeared on a tx with a
    /// gateway output.
    LegacyPidWithGatewayOutput { tx_hash: String, payment_id: String },
    /// Refusal 3a: the daemon version is below the HF6 minimum.
    DaemonBelowHf6Minimum {
        version: String,
        required: &'static str,
    },
    /// Refusal 3b: the daemon height is below HF6 activation.
    DaemonHeightBelowHf6 { height: u64, required: u64 },
    /// The readiness probe could not read BOTH version and height —
    /// refusing to guess is the no-fallback rule applied to the gate itself.
    ReadinessUnreadable { what: &'static str },
    /// A response field this reader depends on was absent or malformed.
    BadResponse(&'static str),
}

impl std::fmt::Display for Hf6Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Hf6Error::SelfDirectedPaymentId {
                tx_hash,
                payment_id,
            } => write!(
                f,
                "refused: payment id {payment_id} on self-directed transfer {tx_hash}"
            ),
            Hf6Error::LegacyPidWithGatewayOutput {
                tx_hash,
                payment_id,
            } => write!(
                f,
                "refused: legacy tx-wide payment id {payment_id} on gateway tx {tx_hash}"
            ),
            Hf6Error::DaemonBelowHf6Minimum { version, required } => {
                write!(f, "refused: daemon {version} below HF6 minimum {required}")
            }
            Hf6Error::DaemonHeightBelowHf6 { height, required } => write!(
                f,
                "refused: daemon height {height} below HF6 activation {required}"
            ),
            Hf6Error::ReadinessUnreadable { what } => {
                write!(f, "refused: readiness probe unreadable: {what}")
            }
            Hf6Error::BadResponse(what) => write!(f, "unexpected rpc response: {what}"),
        }
    }
}

impl std::error::Error for Hf6Error {}

/// The parsed shape of one entry from `get_recent_txs_and_info3`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WalletTx {
    pub tx_hash: String,
    pub height: u64,
    pub timestamp: u64,
    /// Classified entry: ordinary (with per-pid subtransfers) or a
    /// read-only gateway type.
    pub entry: TransferEntry,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TransferEntry {
    /// An ordinary transfer whose value moves are keyed per payment id.
    Ordinary {
        subtransfers_by_pid: Vec<Subtransfer>,
    },
    /// Gateway inbound — parsed, never acted on.
    TxInGateway {
        asset_id: Option<String>,
        gw_addr: Option<String>,
    },
    /// Gateway outbound — parsed, never acted on.
    TxOutGateway {
        asset_id: Option<String>,
        gw_addr: Option<String>,
    },
}

/// One sub-transfer: the HF6 per-output attribution atom.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Subtransfer {
    pub payment_id: String,
    pub asset_id: String,
    pub amount: u64,
    pub is_income: bool,
}

/// Deposit attribution, keyed on **(payment_id, asset_id)** — never a
/// tx-level pid. Both directions are kept so a stranger can audit the net.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DepositAttribution {
    pub payment_id: String,
    pub asset_id: String,
    pub amount_in: u64,
    pub amount_out: u64,
}

impl DepositAttribution {
    /// The credited deposit: income minus outgoing under the same key.
    /// Saturating — a negative net is reported as zero credit, not invented.
    pub fn credited(&self) -> u64 {
        self.amount_in.saturating_sub(self.amount_out)
    }
}

/// Parse one `get_recent_txs_and_info3` result into typed txs, applying
/// refusals 1 and 2 as encountered (parse-time refusal — a bad entry stops
/// the scan with its name, it is never skipped).
pub fn parse_recent_txs(response: &Value) -> Result<Vec<WalletTx>, Hf6Error> {
    let result = response
        .get("result")
        .ok_or(Hf6Error::BadResponse("missing result"))?;
    if let Some(err) = response.get("error") {
        let _ = err;
        return Err(Hf6Error::BadResponse("error object in response"));
    }
    let entries = result
        .get("transfers")
        .and_then(Value::as_array)
        .ok_or(Hf6Error::BadResponse("missing transfers array"))?;

    let mut out = Vec::with_capacity(entries.len());
    for e in entries {
        out.push(parse_tx(e)?);
    }
    Ok(out)
}

fn parse_tx(e: &Value) -> Result<WalletTx, Hf6Error> {
    let tx_hash = e
        .get("tx_hash")
        .and_then(Value::as_str)
        .ok_or(Hf6Error::BadResponse("tx without tx_hash"))?
        .to_string();
    let height = e
        .get("height")
        .and_then(Value::as_u64)
        .ok_or(Hf6Error::BadResponse("tx without height"))?;
    let timestamp = e
        .get("timestamp")
        .and_then(Value::as_u64)
        .ok_or(Hf6Error::BadResponse("tx without timestamp"))?;

    // gateway types: classified by the order's names; optional asset_id and
    // gw_addr ride through so gateway traffic parses without acting on it
    let kind = e.get("transfer_type").and_then(Value::as_str).unwrap_or("");
    let gw_asset = e
        .get("asset_id")
        .and_then(Value::as_str)
        .map(str::to_string);
    let gw_addr = e.get("gw_addr").and_then(Value::as_str).map(str::to_string);
    let entry = match kind {
        "txin_gateway" => TransferEntry::TxInGateway {
            asset_id: gw_asset,
            gw_addr,
        },
        "tx_out_gateway" => TransferEntry::TxOutGateway {
            asset_id: gw_asset,
            gw_addr,
        },
        _ => TransferEntry::Ordinary {
            subtransfers_by_pid: parse_subtransfers(e, &tx_hash)?,
        },
    };

    // Refusal 2: legacy tx-wide pid on a tx with a gateway output. The
    // tx-wide field is read HERE and nowhere else — never for attribution.
    let tx_wide_pid = e.get("payment_id").and_then(Value::as_str).unwrap_or("");
    let is_gateway = matches!(
        entry,
        TransferEntry::TxInGateway { .. } | TransferEntry::TxOutGateway { .. }
    );
    if is_gateway && !tx_wide_pid.is_empty() {
        return Err(Hf6Error::LegacyPidWithGatewayOutput {
            tx_hash,
            payment_id: tx_wide_pid.to_string(),
        });
    }

    Ok(WalletTx {
        tx_hash,
        height,
        timestamp,
        entry,
    })
}

fn parse_subtransfers(e: &Value, tx_hash: &str) -> Result<Vec<Subtransfer>, Hf6Error> {
    let arr = e
        .get("subtransfers_by_pid")
        .and_then(Value::as_array)
        .ok_or(Hf6Error::BadResponse("tx without subtransfers_by_pid"))?;

    // Refusal 1: a payment id on a self-directed transfer. The
    // wallet-visible self-directed marker is the absence of remote
    // addresses; where the marker is absent from the wire we take the
    // conservative side and refuse (refuse, don't flag — no guessing that a
    // pid-less-shaped entry is fine when one carries a pid).
    let remote = e
        .get("remote_addresses")
        .and_then(Value::as_array)
        .map(|a| !a.is_empty())
        .unwrap_or(false);

    let mut subs = Vec::with_capacity(arr.len());
    for s in arr {
        let payment_id = s
            .get("payment_id")
            .and_then(Value::as_str)
            .ok_or(Hf6Error::BadResponse("subtransfer without payment_id"))?;
        if !remote && !payment_id.is_empty() {
            return Err(Hf6Error::SelfDirectedPaymentId {
                tx_hash: tx_hash.to_string(),
                payment_id: payment_id.to_string(),
            });
        }
        subs.push(Subtransfer {
            payment_id: payment_id.to_string(),
            asset_id: s
                .get("asset_id")
                .and_then(Value::as_str)
                .ok_or(Hf6Error::BadResponse("subtransfer without asset_id"))?
                .to_string(),
            amount: s
                .get("amount")
                .and_then(Value::as_u64)
                .ok_or(Hf6Error::BadResponse("subtransfer without amount"))?,
            is_income: s
                .get("is_income")
                .and_then(Value::as_bool)
                .ok_or(Hf6Error::BadResponse("subtransfer without is_income"))?,
        });
    }
    Ok(subs)
}

/// Group ordinary subtransfers into deposit attributions keyed on
/// **(payment_id, asset_id)** — income and outgoing summed per key. Gateway
/// entries contribute nothing (read path only).
pub fn attribute_deposits(txs: &[WalletTx]) -> Vec<DepositAttribution> {
    let mut map: Vec<DepositAttribution> = Vec::new();
    for tx in txs {
        let TransferEntry::Ordinary {
            subtransfers_by_pid,
        } = &tx.entry
        else {
            continue;
        };
        for s in subtransfers_by_pid {
            let slot = map
                .iter_mut()
                .find(|d| d.payment_id == s.payment_id && d.asset_id == s.asset_id);
            match slot {
                Some(d) => {
                    if s.is_income {
                        d.amount_in += s.amount;
                    } else {
                        d.amount_out += s.amount;
                    }
                }
                None => map.push(DepositAttribution {
                    payment_id: s.payment_id.clone(),
                    asset_id: s.asset_id.clone(),
                    amount_in: u64::from(s.is_income) * s.amount,
                    amount_out: u64::from(!s.is_income) * s.amount,
                }),
            }
        }
    }
    map.sort_by(|a, b| (&a.payment_id, &a.asset_id).cmp(&(&b.payment_id, &b.asset_id)));
    map
}

/// Pure start gate: refuse a daemon below the HF6 minimum version or
/// activation height. Unreadable versions are refused, never defaulted.
pub fn hf6_readiness(version: &str, height: u64) -> Result<(), Hf6Error> {
    let parsed = parse_version(version);
    match parsed {
        Some(v) if v >= HF6_MIN_VERSION => {}
        Some(_) => {
            return Err(Hf6Error::DaemonBelowHf6Minimum {
                version: version.to_string(),
                required: "2.2.1.501",
            })
        }
        None => {
            return Err(Hf6Error::DaemonBelowHf6Minimum {
                version: version.to_string(),
                required: "2.2.1.501",
            })
        }
    }
    if height < HF6_HEIGHT {
        return Err(Hf6Error::DaemonHeightBelowHf6 {
            height,
            required: HF6_HEIGHT,
        });
    }
    Ok(())
}

/// Read the readiness facts from a `get_info`-shaped response: exactly
/// `result.version` and `result.height` — anything else is a named refusal.
pub fn readiness_facts(response: &Value) -> Result<(String, u64), Hf6Error> {
    let result = response
        .get("result")
        .ok_or(Hf6Error::ReadinessUnreadable {
            what: "missing result",
        })?;
    let version = result
        .get("version")
        .and_then(Value::as_str)
        .ok_or(Hf6Error::ReadinessUnreadable {
            what: "missing version",
        })?
        .to_string();
    let height =
        result
            .get("height")
            .and_then(Value::as_u64)
            .ok_or(Hf6Error::ReadinessUnreadable {
                what: "missing height",
            })?;
    Ok((version, height))
}

/// Parse "2.2.1.501"-shaped versions (tolerating a leading `v`); requires
/// four numeric parts.
fn parse_version(s: &str) -> Option<(u32, u32, u32, u32)> {
    let s = s.trim().trim_start_matches('v');
    let mut parts = s.split(|c: char| !c.is_ascii_digit());
    let mut nums = [0u32; 4];
    for slot in &mut nums {
        *slot = parts.next()?.parse().ok()?;
    }
    // a fifth numeric segment (or trailing junk) must not silently pass as
    // a lower version than it is — but extra suffixes like " (build)" are
    // tolerated by ignoring the remainder only when the first four parsed.
    Some(nums.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const FUSD: &str = "625829188fa787fb71153aa09d251c162be072eaf5402888032d014d7ad4bf9e"; // TESTNET-ONLY public asset id fixture
    const ZANO: &str = "d6329b5b1f7c0805b5c345f4957554002a2f557845f64d7645dae0e051a6498a"; // TESTNET-ONLY public asset id fixture

    fn ordinary_tx() -> Value {
        json!({
            "tx_hash": "tx-multi-pid",
            "height": 3833500,
            "timestamp": 1790000000,
            "remote_addresses": ["Zan...buyer"],
            "payment_id": "",
            "subtransfers_by_pid": [
                {"payment_id": "pid-1", "asset_id": FUSD, "amount": 1_000, "is_income": true},
                {"payment_id": "pid-1", "asset_id": ZANO, "amount": 2_000, "is_income": true},
                {"payment_id": "pid-2", "asset_id": FUSD, "amount": 500, "is_income": true},
                {"payment_id": "pid-1", "asset_id": FUSD, "amount": 100, "is_income": false}
            ]
        })
    }

    fn response_with(entries: Vec<Value>) -> Value {
        json!({"result": {"transfers": entries}})
    }

    // Step 7, attribution: one multi-PID multi-asset tx — every success
    // renders named values.
    #[test]
    fn multi_pid_multi_asset_attribution_keys_on_pid_and_asset() {
        let txs = parse_recent_txs(&response_with(vec![ordinary_tx()])).unwrap();
        assert_eq!(txs.len(), 1, "one tx parsed");
        let attrs = attribute_deposits(&txs);
        // three keys: (pid-1, FUSD), (pid-1, ZANO), (pid-2, FUSD)
        assert_eq!(attrs.len(), 3, "three attribution keys");
        let pid1_fusd = attrs
            .iter()
            .find(|d| d.payment_id == "pid-1" && d.asset_id == FUSD)
            .expect("pid-1/FUSD key exists");
        assert_eq!(pid1_fusd.amount_in, 1_000, "pid-1 FUSD income");
        assert_eq!(pid1_fusd.amount_out, 100, "pid-1 FUSD outgoing");
        assert_eq!(pid1_fusd.credited(), 900, "pid-1 FUSD credited net");
        let pid1_zano = attrs
            .iter()
            .find(|d| d.payment_id == "pid-1" && d.asset_id == ZANO)
            .expect("pid-1/ZANO key exists");
        assert_eq!(pid1_zano.amount_in, 2_000, "pid-1 ZANO income");
        assert_eq!(pid1_zano.credited(), 2_000, "pid-1 ZANO credited");
        let pid2 = attrs
            .iter()
            .find(|d| d.payment_id == "pid-2")
            .expect("pid-2 key exists");
        assert_eq!(pid2.asset_id, FUSD, "pid-2 asset");
        assert_eq!(pid2.credited(), 500, "pid-2 credited");
    }

    // Step 7, refusal 1: payment id on a self-directed transfer.
    #[test]
    fn refuses_payment_id_on_self_directed_transfer() {
        let mut tx = ordinary_tx();
        tx["remote_addresses"] = json!([]); // self-directed marker
        let err = parse_recent_txs(&response_with(vec![tx])).unwrap_err();
        assert_eq!(
            err,
            Hf6Error::SelfDirectedPaymentId {
                tx_hash: "tx-multi-pid".into(),
                payment_id: "pid-1".into()
            },
            "refusal 1 fires by name"
        );
        // and the conservative arm: marker absent entirely + pid present
        let mut no_marker = ordinary_tx();
        no_marker
            .as_object_mut()
            .unwrap()
            .remove("remote_addresses");
        assert!(matches!(
            parse_recent_txs(&response_with(vec![no_marker])),
            Err(Hf6Error::SelfDirectedPaymentId { .. })
        ));
    }

    // Step 7, refusal 2: legacy tx-wide pid on a tx with a gateway output.
    #[test]
    fn refuses_legacy_tx_wide_pid_on_gateway_tx() {
        let gw = json!({
            "tx_hash": "tx-gw-legacy",
            "height": 3833600,
            "timestamp": 1790000100,
            "transfer_type": "txin_gateway",
            "gw_addr": "gw-UNVERIFIED-FORMAT",
            "asset_id": ZANO,
            "payment_id": "legacy-tx-wide-pid",
            "subtransfers_by_pid": []
        });
        let err = parse_recent_txs(&response_with(vec![gw])).unwrap_err();
        assert_eq!(
            err,
            Hf6Error::LegacyPidWithGatewayOutput {
                tx_hash: "tx-gw-legacy".into(),
                payment_id: "legacy-tx-wide-pid".into()
            },
            "refusal 2 fires by name"
        );
    }

    // Step 7, refusal 3: daemon below the HF6 minimum, by version and height.
    #[test]
    fn refuses_to_start_below_hf6_minimum() {
        assert_eq!(
            hf6_readiness("2.2.1.499", 3_900_000),
            Err(Hf6Error::DaemonBelowHf6Minimum {
                version: "2.2.1.499".into(),
                required: "2.2.1.501"
            }),
            "refusal 3a: build below 501"
        );
        assert_eq!(
            hf6_readiness("2.2.0.900", 3_900_000),
            Err(Hf6Error::DaemonBelowHf6Minimum {
                version: "2.2.0.900".into(),
                required: "2.2.1.501"
            }),
            "refusal 3a: patch below minimum"
        );
        assert_eq!(
            hf6_readiness("2.2.1.501", 3_832_999),
            Err(Hf6Error::DaemonHeightBelowHf6 {
                height: 3_832_999,
                required: 3_833_000
            }),
            "refusal 3b: height below activation"
        );
        assert!(
            matches!(
                hf6_readiness("garbage", 3_900_000),
                Err(Hf6Error::DaemonBelowHf6Minimum { .. })
            ),
            "unreadable version refused, never defaulted"
        );
        // the gate passes exactly at the boundary — named values both sides
        assert_eq!(
            hf6_readiness("2.2.1.501", 3_833_000),
            Ok(()),
            "boundary passes"
        );
        assert_eq!(
            hf6_readiness("v2.2.1.512", 3_834_000),
            Ok(()),
            "v-prefix tolerated"
        );
        // readiness facts demand both fields
        assert_eq!(
            readiness_facts(&json!({"result": {"version": "2.2.1.501"}})),
            Err(Hf6Error::ReadinessUnreadable {
                what: "missing height"
            }),
            "probe refuses a half-answer"
        );
        let (v, h) =
            readiness_facts(&json!({"result": {"version": "2.2.1.501", "height": 3833001}}))
                .expect("facts read");
        assert_eq!((v.as_str(), h), ("2.2.1.501", 3_833_001), "named facts");
    }

    // Step 7, gateway parse: both gateway types parse read-only, contribute
    // nothing to attribution, and carry their optional fields.
    #[test]
    fn gateway_txs_parse_read_only() {
        let gw_in = json!({
            "tx_hash": "tx-gw-in",
            "height": 3833700, "timestamp": 1790000200,
            "transfer_type": "txin_gateway",
            "gw_addr": "gw-UNVERIFIED-FORMAT",
            "asset_id": ZANO,
            "subtransfers_by_pid": []
        });
        let gw_out = json!({
            "tx_hash": "tx-gw-out",
            "height": 3833701, "timestamp": 1790000300,
            "transfer_type": "tx_out_gateway",
            "subtransfers_by_pid": []
        });
        let txs = parse_recent_txs(&response_with(vec![gw_in, gw_out, ordinary_tx()])).unwrap();
        assert_eq!(txs.len(), 3, "all three entries parsed");
        match &txs[0].entry {
            TransferEntry::TxInGateway { asset_id, gw_addr } => {
                assert_eq!(asset_id.as_deref(), Some(ZANO), "gw-in asset_id carried");
                assert_eq!(
                    gw_addr.as_deref(),
                    Some("gw-UNVERIFIED-FORMAT"),
                    "gw_addr carried"
                );
            }
            other => panic!("expected TxInGateway, got {other:?}"),
        }
        match &txs[1].entry {
            TransferEntry::TxOutGateway { asset_id, gw_addr } => {
                assert_eq!(asset_id, &None, "gw-out optional asset_id absent");
                assert_eq!(gw_addr, &None, "gw-out optional gw_addr absent");
            }
            other => panic!("expected TxOutGateway, got {other:?}"),
        }
        let attrs = attribute_deposits(&txs);
        assert_eq!(
            attrs.len(),
            3,
            "gateway entries contribute no attribution keys"
        );
        assert!(
            attrs.iter().all(|d| !d.payment_id.is_empty()),
            "no empty-pid key invented from gateway traffic"
        );
    }
}
