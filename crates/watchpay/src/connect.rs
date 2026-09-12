//! The Trezor Connect adapter — the OFFLINE bridge boundary between the
//! accepted plan validation ([`crate::plan::ValidatedPlan`]) and Trezor
//! Connect's `ethereumSignTransaction` interface.
//!
//! # Source pins (read 2026-09-12, packages downloaded and inspected — no
//! SDK initialization, no device, no network signer)
//! - `@trezor/connect-web 9.7.3` (current stable bridge; depends on
//!   `@trezor/connect 9.7.3`) — `lib/types/api/ethereum/index.d.ts`:
//!   request `{ path, transaction: legacy|eip1559, chunkify? }`; response
//!   `EthereumSignedTx = { v, r, s, serializedTx }` (0x-hex strings).
//! - `@trezor/connect 9.7.3` `lib/api/ethereum/ethereumSignTx.js`:
//!   the device returns recid `v ∈ {0,1}` and `r`/`s`; Connect's shared
//!   `processTxRequest` converts legacy `v` to the EIP-155 form
//!   `2·chainId + 35 + recid` when `chainId && v <= 1`, and leaves typed-tx
//!   `v` as yParity `{0,1}` (the EIP-1559 path calls it WITHOUT chain_id).
//!   Serialization is CLIENT-SIDE: `serializeEthereumTx` calls
//!   `@ethereumjs/tx` (`createTx(...).serialize()`), pinned by Connect at
//!   `^10.1.0` (10.1.3 resolved in the inspected install).
//! - Request wire format: hex-quantity STRINGS (`init()` runs every field
//!   through a strip/pad-even transform, then `serializeEthereumTx` re-adds
//!   `0x`); `chainId` is a JSON number. Legacy carries `gasPrice`; 1559
//!   carries `maxFeePerGas`/`maxPriorityFeePerGas`; the other family's
//!   fields are absent (schema `Optional<undefined>`).
//!
//! # What this module is and is not
//! - The TRANSPORT is an injected trait ([`ConnectTransport`]). This slice
//!   ships NO implementation: no browser page, no iframe/popup, no SDK
//!   init, no auto-connect path. A fake transport exists only in tests
//!   (`tests/adapter_signing.rs`), signing with clearly labelled public
//!   synthetic test keys.
//! - Every bridge result is UNTRUSTED. [`verify_signed_result`] strictly
//!   decodes the serialized transaction, refuses non-canonical forms,
//!   verifies chain/replay protection, recovers the signer
//!   cryptographically, computes the transaction hash locally, and binds
//!   every decoded field to BOTH the exact pending request and the sealed
//!   plan. Nothing bridge-supplied (sender, hash, status) is ever trusted.
//! - [`VerifiedSigned`] can only be constructed by that verification
//!   function — callers cannot assemble one from unchecked fields. It (and
//!   only it) feeds the ledger's signed-result recording boundary via
//!   [`sign_batch_payment`] / [`record_verified_signed`].
//! - The z2.b synthetic API ([`crate::tx::DecodedTransaction`] with public
//!   fields + [`crate::ledger::Ledger::record_signed`]) REMAINS PUBLIC for
//!   the 65 preserved offline tests and is explicitly OFFLINE-ONLY: this
//!   crate does not claim the ledger alone prevents bypass while that
//!   synthetic door is open. The adapter path above is the verified
//!   boundary; closing the synthetic door is a reviewed decision for the
//!   integration slice, not this one.
//!
//! # Signing lifecycle (this slice)
//! [`sign_batch_payment`] persists the attempt intent FIRST, composes the
//! request, calls the transport ONCE, verifies, records. Refusal,
//! cancellation, timeout or a duplicate/stale/late result never
//! auto-retries and never releases an uncertain reservation: the transport
//! error propagates with the open intent left in place (explicitly
//! cancellable via [`crate::ledger::Ledger::cancel_intent`]); a SECOND
//! result for the same attempt is refused by the ledger (latest state is
//! no longer `Intent`); a result presented for a cancelled/superseded
//! attempt likewise fails. A "late" response is defined as one arriving
//! after `record_verified_signed` persisted the Signed record (or after
//! the attempt left `Intent`) — it carries no authorization and can only
//! be logged by the caller.
//!
//! # Approval scope law
//! Approval requests can be COMPOSED and VERIFIED purely
//! ([`crate::tx::TxDestination::Approve`]), but there is NO approval
//! orchestration here: no driver writes an approval intent, and the
//! approval allowance lifecycle stays outside the per-batch fee ledger
//! (the z2.b scope law). Enabling approval orchestration requires its own
//! persisted fee accounting in a reviewed slice.

use crate::error::{Error, Result};
use crate::eth::{is_low_s, recover_signer, signature_scalars_nonzero};
use crate::ledger::Ledger;
use crate::plan::ValidatedPlan;
use crate::signed_tx::{SignedTx, MAX_SERIALIZED_TX_BYTES};
use crate::tx::{validate_transaction, DecodedTransaction, TxDestination, TxEnvelope};
use crate::types::{Atto, EthAddr, Hex32};
use serde::{Deserialize, Serialize};

/// The pinned bridge packages this adapter's contract is written against.
pub const TREZOR_CONNECT_PIN: &str =
    "@trezor/connect-web 9.7.3 / @trezor/connect 9.7.3 (@ethereumjs/tx ^10.1.0 -> 10.1.3)";

/// BIP-32 derivation path, explicit and constrained. Ethereum payments
/// ride BIP-44 (`m/44'/60'/account'/change/index`) with bounded indices —
/// anything else is refused at parse. The path is PART of the signed
/// request (the reviewer sees it), but the payer identity is never taken
/// from it: the recovered signer must equal the plan's `expected_payer`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DerivationPath {
    raw: String,
}

pub const MAX_ACCOUNT: u64 = 99;
pub const MAX_ADDRESS_INDEX: u64 = 1000;

impl DerivationPath {
    /// Accept exactly `m/44'/60'/a'/b/c` with `a ≤ 99` (hardened account),
    /// `b ∈ {0,1}` (change), `c ≤ 1000` (address index).
    pub fn parse(s: &str) -> Result<Self> {
        let bad = || Error::field("path", format!("unlawful derivation path {s:?}"));
        let rest = s.strip_prefix("m/44'/60'/").ok_or_else(bad)?;
        let mut it = rest.split('/');
        let account = it.next().ok_or_else(bad)?;
        let change = it.next().ok_or_else(bad)?;
        let index = it.next().ok_or_else(bad)?;
        if it.next().is_some() {
            return Err(bad());
        }
        let account = account.strip_suffix('\'').ok_or_else(bad)?;
        let account: u64 = account.parse().map_err(|_| bad())?;
        let change: u64 = change.parse().map_err(|_| bad())?;
        let index: u64 = index.parse().map_err(|_| bad())?;
        if account > MAX_ACCOUNT || change > 1 || index > MAX_ADDRESS_INDEX {
            return Err(bad());
        }
        Ok(DerivationPath { raw: s.to_string() })
    }

    /// The Connect string form (passed as `path` in the request payload).
    pub fn as_str(&self) -> &str {
        &self.raw
    }
}

/// The immutable, plan-bound signing request. Constructed ONLY by
/// [`SignRequest::compose`], which derives every field from a validated
/// plan at its own ceilings — gas and fees are composed AT the plan's
/// per-tx ceilings, so the reviewed worst case IS what is signed and the
/// bridge has zero freedom to recompose. The review summary derives from
/// THIS request (see [`SignRequest::review_summary`]); nothing is
/// recomposed between review and verification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignRequest {
    envelope: TxEnvelope,
    operation: TxDestination,
    plan_hash: Hex32,
    batch_id: Option<Hex32>,
    chain_id: u64,
    nonce: u64,
    to: EthAddr,
    /// Always zero for these contract calls; bound explicitly.
    value_wei: Atto,
    data: Vec<u8>,
    gas_limit: u64,
    /// Legacy: gasPrice. EIP-1559: maxFeePerGas.
    max_fee_per_gas_wei: u64,
    /// EIP-1559 only; zero for legacy.
    max_priority_fee_wei: u64,
    /// Token amount the payer's review covers (approve ceiling or the
    /// batch's amount ceiling).
    token_ceiling: Atto,
    path: DerivationPath,
}

impl SignRequest {
    /// Compose a request for `dest` under `vp`, binding the plan hash,
    /// batch identity, chain, payer destination, zero value, calldata,
    /// nonce, gas and fee ceilings. Revalidates plan freshness at
    /// `now_unix` (a cached validation cannot outlive expiry).
    pub fn compose(
        vp: &ValidatedPlan,
        dest: TxDestination,
        envelope: TxEnvelope,
        nonce: u64,
        path: DerivationPath,
        now_unix: u64,
    ) -> Result<Self> {
        vp.revalidate(now_unix)?;
        if !vp.is_internally_consistent() {
            return Err(Error::field(
                "plan_hash",
                "validated plan is not internally consistent — refusing to compose",
            ));
        }
        let plan = vp.plan();
        let g = &plan.gas_ceilings;
        let f = &plan.native_fee_ceilings;
        let (to, data, batch_id, token_ceiling) = match dest {
            TxDestination::BatchPayment { batch_index } => {
                let batch = plan
                    .batches
                    .get(batch_index)
                    .ok_or_else(|| Error::field("batch_index", "no such batch in the plan"))?;
                let data = crate::calldata::pay_for_merkle_tree_calldata(
                    batch.depth,
                    &batch.commitments,
                    batch.merkle_payment_timestamp,
                )?;
                (
                    plan.network.payment_vault,
                    data,
                    Some(batch.batch_id),
                    batch.batch_amount_ceiling,
                )
            }
            TxDestination::Approve => {
                let data = crate::calldata::approve_calldata(
                    plan.network.payment_vault,
                    vp.approve_ceiling(),
                )?;
                (plan.network.payment_token, data, None, vp.approve_ceiling())
            }
        };
        let max_priority_fee_wei = match envelope {
            TxEnvelope::Legacy => 0,
            TxEnvelope::Eip1559 => f.per_tx_max_priority_fee_wei,
        };
        Ok(SignRequest {
            envelope,
            operation: dest,
            plan_hash: plan.plan_hash,
            batch_id,
            chain_id: plan.network.chain_id,
            nonce,
            to,
            value_wei: Atto::ZERO,
            data,
            gas_limit: g.per_tx_gas_limit,
            max_fee_per_gas_wei: f.per_tx_max_fee_per_gas_wei,
            max_priority_fee_wei,
            token_ceiling,
            path,
        })
    }

    /// The exact Connect `ethereumSignTransaction` payload
    /// (`chunkify: false` — the whole calldata rides one request; chunking
    /// is a device-transport detail Connect handles internally).
    pub fn connect_payload(&self) -> ConnectRequestJson {
        let hexq = |v: u64| format!("0x{v:x}");
        let transaction = match self.envelope {
            TxEnvelope::Legacy => ConnectTransactionJson::Legacy {
                to: self.to.to_lower_hex(),
                value: "0x0".to_string(),
                gas_price: hexq(self.max_fee_per_gas_wei),
                gas_limit: hexq(self.gas_limit),
                nonce: hexq(self.nonce),
                data: format!("0x{}", hex::encode(&self.data)),
                chain_id: self.chain_id,
            },
            TxEnvelope::Eip1559 => ConnectTransactionJson::Eip1559 {
                to: self.to.to_lower_hex(),
                value: "0x0".to_string(),
                gas_limit: hexq(self.gas_limit),
                nonce: hexq(self.nonce),
                data: format!("0x{}", hex::encode(&self.data)),
                chain_id: self.chain_id,
                max_fee_per_gas: hexq(self.max_fee_per_gas_wei),
                max_priority_fee_per_gas: hexq(self.max_priority_fee_wei),
            },
        };
        ConnectRequestJson {
            path: self.path.as_str().to_string(),
            transaction,
            chunkify: false,
        }
    }

    /// The review summary, derived from THIS request plus the sealed plan
    /// figures. Describes approval/payment, token ceiling and worst-case
    /// native fee — the numbers the payer approves are the numbers that
    /// get signed (`compose` pinned them); there is no recomposition after
    /// review for the verifier to miss.
    pub fn review_summary(&self, vp: &ValidatedPlan) -> ReviewSummary {
        let worst_case_native_fee_wei = Atto::from_u64(self.gas_limit)
            .checked_mul(Atto::from_u64(self.max_fee_per_gas_wei))
            .expect("plan validation bounds this product within u256");
        ReviewSummary {
            operation: match self.operation {
                TxDestination::Approve => "approve",
                TxDestination::BatchPayment { .. } => "batch_payment",
            },
            plan_hash: self.plan_hash,
            batch_id: self.batch_id,
            chain_id: self.chain_id,
            payer: vp.plan().expected_payer,
            destination: self.to,
            nonce: self.nonce,
            token_ceiling: self.token_ceiling,
            approve_ceiling_total: vp.approve_ceiling(),
            gas_limit: self.gas_limit,
            max_fee_per_gas_wei: self.max_fee_per_gas_wei,
            max_priority_fee_wei: self.max_priority_fee_wei,
            worst_case_native_fee_wei,
            signature_count: 1,
        }
    }

    // Immutable getters used by the verification boundary and tests.
    pub fn envelope(&self) -> TxEnvelope {
        self.envelope
    }
    pub fn operation(&self) -> TxDestination {
        self.operation
    }
    pub fn plan_hash(&self) -> Hex32 {
        self.plan_hash
    }
    pub fn chain_id(&self) -> u64 {
        self.chain_id
    }
    pub fn nonce(&self) -> u64 {
        self.nonce
    }
    pub fn to(&self) -> EthAddr {
        self.to
    }
    pub fn data(&self) -> &[u8] {
        &self.data
    }
    pub fn gas_limit(&self) -> u64 {
        self.gas_limit
    }
    pub fn max_fee_per_gas_wei(&self) -> u64 {
        self.max_fee_per_gas_wei
    }
    pub fn max_priority_fee_wei(&self) -> u64 {
        self.max_priority_fee_wei
    }
}

/// The review summary a human approves before any device interaction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewSummary {
    pub operation: &'static str,
    pub plan_hash: Hex32,
    pub batch_id: Option<Hex32>,
    pub chain_id: u64,
    pub payer: EthAddr,
    pub destination: EthAddr,
    pub nonce: u64,
    /// Token atto ceiling THIS transaction covers (batch ceiling, or the
    /// plan's approve ceiling for an approve request).
    pub token_ceiling: Atto,
    /// The plan-wide approve ceiling (never approve for more).
    pub approve_ceiling_total: Atto,
    pub gas_limit: u64,
    pub max_fee_per_gas_wei: u64,
    pub max_priority_fee_wei: u64,
    /// gas_limit × max_fee_per_gas_wei for THIS transaction.
    pub worst_case_native_fee_wei: Atto,
    pub signature_count: u64,
}

/// The Connect request wire shape (pinned from the 9.7.3 schema). Integers
/// ride as hex-quantity strings (Connect's own transform and
/// `serializeEthereumTx` expect them); `chainId` is a JSON number; the
/// legacy/1559 variants carry ONLY their family's fee fields.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConnectRequestJson {
    pub path: String,
    pub transaction: ConnectTransactionJson,
    pub chunkify: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(untagged, rename_all = "camelCase")]
pub enum ConnectTransactionJson {
    Legacy {
        to: String,
        value: String,
        #[serde(rename = "gasPrice")]
        gas_price: String,
        #[serde(rename = "gasLimit")]
        gas_limit: String,
        nonce: String,
        data: String,
        #[serde(rename = "chainId")]
        chain_id: u64,
    },
    Eip1559 {
        to: String,
        value: String,
        #[serde(rename = "gasLimit")]
        gas_limit: String,
        nonce: String,
        data: String,
        #[serde(rename = "chainId")]
        chain_id: u64,
        #[serde(rename = "maxFeePerGas")]
        max_fee_per_gas: String,
        #[serde(rename = "maxPriorityFeePerGas")]
        max_priority_fee_per_gas: String,
    },
}

/// The injected bridge. ONE call per attempt. Implementations carry the
/// Connect `ethereumSignTransaction` round-trip (a real one opens the
/// Connect iframe/popup with the serialized payload); NOTHING in this
/// crate implements it, initializes any SDK, or auto-connects. Errors are
/// refusals/cancellations/timeouts — the driver never retries.
pub trait ConnectTransport {
    fn ethereum_sign_transaction(
        &mut self,
        request: &ConnectRequestJson,
    ) -> Result<ConnectSignedTxRaw>;
}

/// The UNTRUSTED response, pinned from `EthereumSignedTx` @ 9.7.3:
/// `serializedTx`, `v`, `r`, `s` — all 0x-hex strings, exactly as Connect
/// returns them (legacy `v` already in EIP-155 form; 1559 `v` = yParity
/// `{0,1}`). No sender, no hash, no status: Connect supplies none, and
/// none would be trusted anyway.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConnectSignedTxRaw {
    pub serialized_tx: String,
    pub v: String,
    pub r: String,
    pub s: String,
}

/// Bound response-string lengths BEFORE any parsing (dispatch law).
const MAX_RESPONSE_FIELD_CHARS: usize = 8192;

/// Decode a 0x-prefixed hex BYTE STRING (even length — `serialized_tx`).
/// The char budget derives from the byte bound (2 hex chars per byte +
/// prefix), so a lawful max-size transaction never trips a string check.
fn decode_hex_bytes(s: &str, field: &'static str, max_bytes: usize) -> Result<Vec<u8>> {
    if s.len() > 2 + 2 * max_bytes {
        return Err(Error::field(
            field,
            format!(
                "{} chars exceeds the byte-bound-derived {} char cap",
                s.len(),
                2 + 2 * max_bytes
            ),
        ));
    }
    let body = s
        .strip_prefix("0x")
        .ok_or_else(|| Error::field(field, "not a 0x-prefixed hex string"))?;
    if body.len() % 2 != 0 {
        return Err(Error::field(field, "odd-length hex"));
    }
    if !body.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(Error::field(field, "non-hex characters"));
    }
    let bytes = hex::decode(body).map_err(|e| Error::field(field, format!("hex: {e}")))?;
    if bytes.len() > max_bytes {
        return Err(Error::field(
            field,
            format!("{} bytes exceeds the {}-byte bound", bytes.len(), max_bytes),
        ));
    }
    Ok(bytes)
}

/// Decode a 0x-prefixed hex QUANTITY (Connect's `v`/`r`/`s` are minimal
/// `toString(16)` integers — "0x0", "0x7", "0x14986" are all lawful).
/// Odd digit counts are left-padded to whole bytes; the bound is checked
/// on the padded byte length.
fn decode_hex_quantity(s: &str, field: &'static str, max_bytes: usize) -> Result<Vec<u8>> {
    if s.len() > MAX_RESPONSE_FIELD_CHARS {
        return Err(Error::field(
            field,
            format!("response field longer than {MAX_RESPONSE_FIELD_CHARS} chars"),
        ));
    }
    let body = s
        .strip_prefix("0x")
        .ok_or_else(|| Error::field(field, "not a 0x-prefixed hex quantity"))?;
    if body.is_empty() {
        return Err(Error::field(field, "empty quantity"));
    }
    if !body.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(Error::field(field, "non-hex characters"));
    }
    let padded = if body.len() % 2 == 0 {
        body.to_string()
    } else {
        format!("0{body}")
    };
    let mut bytes = hex::decode(&padded).map_err(|e| Error::field(field, format!("hex: {e}")))?;
    // Strip non-significant leading zero bytes so the bound is on the
    // VALUE's width, not the string's padding.
    while bytes.first() == Some(&0) {
        bytes.remove(0);
    }
    if bytes.len() > max_bytes {
        return Err(Error::field(
            field,
            format!("{} bytes exceeds the {}-byte bound", bytes.len(), max_bytes),
        ));
    }
    Ok(bytes)
}

/// Hex quantity → u64 (for `v`).
fn hex_quantity_to_u64(s: &str, field: &'static str) -> Result<u64> {
    let bytes = decode_hex_quantity(s, field, 8)?;
    let mut v: u64 = 0;
    for &b in &bytes {
        v = v
            .checked_mul(256)
            .and_then(|x| x.checked_add(b as u64))
            .ok_or_else(|| Error::field(field, "u64 overflow"))?;
    }
    Ok(v)
}

/// Hex quantity → left-padded 32-byte scalar (for `r`/`s`).
fn hex_quantity_to_scalar(s: &str, field: &'static str) -> Result<[u8; 32]> {
    let bytes = decode_hex_quantity(s, field, 32)?;
    if bytes.is_empty() {
        return Err(Error::field(field, "empty scalar"));
    }
    let mut out = [0u8; 32];
    out[32 - bytes.len()..].copy_from_slice(&bytes);
    Ok(out)
}

/// The VERIFIED result of a bridge round-trip. Constructible ONLY by
/// [`verify_signed_result`] — every field below was checked against the
/// pending request, the sealed plan and the signature math before the
/// struct could exist. This is the only input the ledger's signed-result
/// boundary accepts from the adapter.
#[derive(Debug, Clone)]
pub struct VerifiedSigned {
    request_envelope: TxEnvelope,
    request_operation: TxDestination,
    request_plan_hash: Hex32,
    decoded: DecodedTransaction,
    signer: EthAddr,
    serialized: Vec<u8>,
}

impl VerifiedSigned {
    /// The decoded transaction (tx hash is the LOCALLY computed one).
    pub fn decoded_tx(&self) -> &DecodedTransaction {
        &self.decoded
    }
    /// The recovered signer (proven equal to the plan's expected payer).
    pub fn signer(&self) -> EthAddr {
        self.signer
    }
    /// The canonical signed bytes the locally-computed hash covers.
    pub fn serialized_tx(&self) -> &[u8] {
        &self.serialized
    }
    pub fn request_envelope(&self) -> TxEnvelope {
        self.request_envelope
    }
    pub fn request_operation(&self) -> TxDestination {
        self.request_operation
    }
    pub fn request_plan_hash(&self) -> Hex32 {
        self.request_plan_hash
    }
}

/// THE verification boundary. Everything untrusted stops here.
///
/// Order of checks (each refusal names its field):
/// 1. length bounds on all four response strings;
/// 2. strict hex decode; v ≤ 8 bytes, r/s ≤ 32 bytes, serialized ≤
///    [`MAX_SERIALIZED_TX_BYTES`];
/// 3. strict envelope decode ([`SignedTx::decode_strict`]) — canonical
///    RLP, minimal integers, replay protection, empty access list;
/// 4. envelope family matches the request (legacy↔legacy, 1559↔0x02);
/// 5. EVERY decoded field equals the request field (nonce, to, value 0,
///    calldata byte-equality, gas, fees, chain);
/// 6. response v/r/s EQUAL the RLP-embedded signature components
///    (Connect sends both; disagreement is a malformed response);
/// 7. r/s are nonzero scalars, s is low (EIP-2);
/// 8. the signer is recovered from the locally-computed signing preimage
///    and must equal the plan's `expected_payer`;
/// 9. the existing z2.b [`validate_transaction`] re-binds everything
///    against the sealed plan (ceilings, calldata-to-plan identity,
///    expected nonce).
pub fn verify_signed_result(
    request: &SignRequest,
    vp: &ValidatedPlan,
    raw: &ConnectSignedTxRaw,
) -> Result<VerifiedSigned> {
    if !vp.is_internally_consistent() || vp.sealed_hash() != request.plan_hash() {
        return Err(Error::field(
            "plan_hash",
            "request/plan identity mismatch — refusing to verify against a different plan",
        ));
    }
    // 1+2: bounds and strict hex. serialized_tx is a byte string (even
    // length); v/r/s are quantities (minimal hex integers, odd lengths
    // lawful — Connect emits `toString(16)`).
    let serialized =
        decode_hex_bytes(&raw.serialized_tx, "serialized_tx", MAX_SERIALIZED_TX_BYTES)?;
    let resp_v = hex_quantity_to_u64(&raw.v, "v")?;
    let resp_r = hex_quantity_to_scalar(&raw.r, "r")?;
    let resp_s = hex_quantity_to_scalar(&raw.s, "s")?;
    // 3: strict decode.
    let signed = SignedTx::decode_strict(&serialized)?;
    // 4: family match + 5: field binding + 6: response↔RLP signature
    // agreement, with locally-derived identity figures.
    let (rlp_v, r, s, recid) = match &signed {
        SignedTx::Legacy(t) => {
            if request.envelope() != TxEnvelope::Legacy {
                return Err(Error::field(
                    "tx_type",
                    "request is EIP-1559 but the response is a legacy envelope",
                ));
            }
            bind(
                request,
                &DecodedFields {
                    nonce: t.nonce,
                    max_fee_per_gas_wei: t.gas_price_wei,
                    max_priority_fee_wei: 0,
                    gas_limit: t.gas_limit,
                    to: t.to,
                    value_wei: &t.value_wei,
                    data: &t.data,
                    chain_id: t.chain_id,
                },
                "gasPrice",
            )?;
            (t.v, t.r, t.s, t.recid)
        }
        SignedTx::Eip1559(t) => {
            if request.envelope() != TxEnvelope::Eip1559 {
                return Err(Error::field(
                    "tx_type",
                    "request is legacy but the response is an EIP-1559 envelope",
                ));
            }
            bind(
                request,
                &DecodedFields {
                    nonce: t.nonce,
                    max_fee_per_gas_wei: t.max_fee_per_gas_wei,
                    max_priority_fee_wei: t.max_priority_fee_wei,
                    gas_limit: t.gas_limit,
                    to: t.to,
                    value_wei: &t.value_wei,
                    data: &t.data,
                    chain_id: t.chain_id,
                },
                "maxFeePerGas",
            )?;
            (t.y_parity as u64, t.r, t.s, t.y_parity)
        }
    };
    if resp_v != rlp_v {
        return Err(Error::field(
            "v",
            format!("response v 0x{resp_v:x} != envelope v 0x{rlp_v:x} — malformed response"),
        ));
    }
    if resp_r != r || resp_s != s {
        return Err(Error::field(
            "signature",
            "response r/s differ from the envelope-embedded signature components",
        ));
    }
    // 7: scalar laws.
    if !signature_scalars_nonzero(&r, &s) {
        return Err(Error::field("signature", "r or s is zero"));
    }
    if !is_low_s(&s) {
        return Err(Error::field(
            "s",
            "high-s signature — EIP-2 requires s ≤ n/2",
        ));
    }
    // 8: recover the signer from the locally-computed preimage.
    let prehash = signed.signing_hash();
    let signer = recover_signer(&prehash, &r, &s, recid)?;
    if signer != vp.plan().expected_payer {
        return Err(Error::field(
            "from",
            format!(
                "recovered signer {signer} != plan expected_payer {} — the path does not \
                 select the payer; recovery does",
                vp.plan().expected_payer
            ),
        ));
    }
    // 9: the z2.b plan-bound validator, again, with the LOCAL hash and the
    // RECOVERED signer.
    let tx_hash = signed.tx_hash();
    let decoded = build_decoded(&signed, tx_hash, signer);
    validate_transaction(vp, request.operation(), &decoded, request.nonce())?;
    Ok(VerifiedSigned {
        request_envelope: request.envelope(),
        request_operation: request.operation(),
        request_plan_hash: request.plan_hash(),
        decoded,
        signer,
        serialized: signed.canonical_bytes(),
    })
}

/// The decoded transaction fields that must equal the request, gathered
/// for the field-by-field bind (each mismatch is a named refusal).
struct DecodedFields<'a> {
    nonce: u64,
    max_fee_per_gas_wei: u64,
    max_priority_fee_wei: u64,
    gas_limit: u64,
    to: EthAddr,
    value_wei: &'a Atto,
    data: &'a [u8],
    chain_id: u64,
}

/// Field-by-field request binding (shared by both envelopes). `fee_field`
/// names the envelope family's fee field ("gasPrice"/"maxFeePerGas") in
/// refusals.
fn bind(request: &SignRequest, t: &DecodedFields<'_>, fee_field: &'static str) -> Result<()> {
    let nonce = t.nonce;
    let max_fee_per_gas_wei = t.max_fee_per_gas_wei;
    let max_priority_fee_wei = t.max_priority_fee_wei;
    let gas_limit = t.gas_limit;
    let to = t.to;
    let value_wei = t.value_wei;
    let data = t.data;
    let chain_id = t.chain_id;
    if chain_id != request.chain_id() {
        return Err(Error::field(
            "chain_id",
            format!(
                "tx chain {chain_id} != request chain {} — replay protection binds the wrong \
                 chain",
                request.chain_id()
            ),
        ));
    }
    if nonce != request.nonce() {
        return Err(Error::field(
            "nonce",
            format!("tx nonce {nonce} != request nonce {}", request.nonce()),
        ));
    }
    if to != request.to() {
        return Err(Error::field(
            "to",
            format!(
                "tx destination {to} != request destination {}",
                request.to()
            ),
        ));
    }
    if *value_wei != Atto::ZERO {
        return Err(Error::field(
            "value",
            format!("native value {value_wei} wei — zero-value contract calls only"),
        ));
    }
    if data != request.data() {
        return Err(Error::field(
            "input",
            "calldata not byte-identical to the request calldata — the signed transaction \
             is not the reviewed transaction",
        ));
    }
    if gas_limit != request.gas_limit() {
        return Err(Error::field(
            "gas_limit",
            format!(
                "tx gas limit {gas_limit} != request gas limit {}",
                request.gas_limit()
            ),
        ));
    }
    if max_fee_per_gas_wei != request.max_fee_per_gas_wei() {
        return Err(Error::field(
            fee_field,
            format!(
                "tx fee {max_fee_per_gas_wei} != request fee {}",
                request.max_fee_per_gas_wei()
            ),
        ));
    }
    if max_priority_fee_wei != request.max_priority_fee_wei() {
        return Err(Error::field(
            "maxPriorityFeePerGas",
            format!(
                "tx priority fee {max_priority_fee_wei} != request priority fee {}",
                request.max_priority_fee_wei()
            ),
        ));
    }
    Ok(())
}

fn build_decoded(
    signed: &SignedTx,
    tx_hash: crate::types::Hex32,
    from: EthAddr,
) -> DecodedTransaction {
    match signed {
        SignedTx::Legacy(t) => DecodedTransaction {
            envelope: TxEnvelope::Legacy,
            chain_id: t.chain_id,
            from,
            to: t.to,
            value_wei: t.value_wei,
            nonce: t.nonce,
            gas_limit: t.gas_limit,
            max_fee_per_gas_wei: t.gas_price_wei,
            max_priority_fee_wei: 0,
            input: t.data.clone(),
            tx_hash,
        },
        SignedTx::Eip1559(t) => DecodedTransaction {
            envelope: TxEnvelope::Eip1559,
            chain_id: t.chain_id,
            from,
            to: t.to,
            value_wei: t.value_wei,
            nonce: t.nonce,
            gas_limit: t.gas_limit,
            max_fee_per_gas_wei: t.max_fee_per_gas_wei,
            max_priority_fee_wei: t.max_priority_fee_wei,
            input: t.data.clone(),
            tx_hash,
        },
    }
}

/// Record a verified result into the ledger — the adapter's ONLY
/// signed-result recording boundary. Accepts [`VerifiedSigned`] (which
/// only [`verify_signed_result`] can construct) and re-runs the ledger's
/// own validation/freshness/duplicate-hash checks. Returns the ledger's
/// refusal verbatim (e.g. a late duplicate: latest state is no longer
/// `Intent`).
pub fn record_verified_signed(
    ledger: &Ledger,
    vp: &ValidatedPlan,
    batch_index: usize,
    verified: &VerifiedSigned,
    now_unix: u64,
) -> Result<()> {
    ledger.record_signed(vp, batch_index, verified.decoded_tx(), now_unix)
}

/// Deterministic one-shot signing driver (this slice's harness shape):
/// persist intent → compose → ONE transport call → verify → record.
///
/// Refusal/cancellation/timeout (transport `Err`) propagates with the open
/// intent retained: nothing retried, nothing released — the operator
/// cancels explicitly or retries from a NEW human-reviewed decision. A
/// duplicate or late result for the same attempt fails at
/// `record_verified_signed` (state no longer `Intent`). No approval
/// orchestration exists here (see the module's scope law).
// The argument count is the boundary's own shape (ledger, plan, attempt
// identity, path, envelope, time, bridge) — collapsing it would hide a
// binding the review summary names field by field.
#[allow(clippy::too_many_arguments)]
pub fn sign_batch_payment(
    ledger: &Ledger,
    vp: &ValidatedPlan,
    batch_index: usize,
    nonce: u64,
    path: &DerivationPath,
    envelope: TxEnvelope,
    now_unix: u64,
    transport: &mut dyn ConnectTransport,
) -> Result<VerifiedSigned> {
    ledger.write_intent(vp, batch_index, nonce, now_unix)?;
    let request = SignRequest::compose(
        vp,
        TxDestination::BatchPayment { batch_index },
        envelope,
        nonce,
        path.clone(),
        now_unix,
    )?;
    let raw = transport.ethereum_sign_transaction(&request.connect_payload())?;
    let verified = verify_signed_result(&request, vp, &raw)?;
    record_verified_signed(ledger, vp, batch_index, &verified, now_unix)?;
    Ok(verified)
}
