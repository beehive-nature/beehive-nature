//! PHASE E — the wave-payment signing slice (bPay → Trezor → verified
//! signature; STOPS at the signature: no broadcast, no pay, no upload).
//!
//! This is the reviewed wave slice [`crate::plan_model`]'s scope law
//! demanded ("wave/payForQuotes would be its own reviewed slice"). It
//! composes and verifies `payForQuotes((address,uint256,bytes32)[])` —
//! the payment shape the CURRENT Autonomi client (evmlib 0.9.1 /
//! ant-core 0.9.0, read at source this slice) produces for jobs under
//! the merkle threshold. The 56-payment founder job rides ONE such call
//! (MAX_TRANSFERS_PER_TRANSACTION = 256 at evmlib
//! `src/contract/payment_vault/mod.rs:11`), so the reviewed count is
//! **2 transactions: 1 ERC-20 approve + 1 payForQuotes** — each ONE
//! device signature. "56 payments" is not 56 transactions and this
//! module refuses to compose anything without stating the count.
//!
//! # What is reused, never duplicated
//! - transport request/response WIRE SHAPES ([`crate::connect`]:
//!   `ConnectRequestJson`, `ConnectSignedTxRaw`, `ConnectTransport`,
//!   `ConnectClock`, `DerivationPath`) — identical for wave;
//! - strict envelope decode ([`crate::signed_tx`]) and recovery
//!   cryptography ([`crate::eth`]) — the SAME verification wall the
//!   z2.c adapter runs, re-bound to the wave plan below;
//! - the bounded approve composer ([`crate::calldata::approve_calldata`],
//!   E7 law: never unlimited).
//!
//! # The binding gate (before ANY device dispatch)
//! [`bind_authorization`] re-derives every machine-checkable binding and
//! refuses with a named law otherwise. The NO-SILENT-REQUOTE wall is
//! recomputed HERE (never trusted from the bridge's stored digest): the
//! sorted newline-joined quote-hash set, sha256 — byte-identical to the
//! antd-bridge v3 derivation — must equal the authorization's commitment
//! digest. A presented payment set that re-derives to the pinned digest
//! IS the authorized set; anything else is a stale or forged quote set
//! and is refused.
//!
//! # Receipt law (exactly one, append-only)
//! [`WaveLedger`] persists at most ONE signing receipt per authorization:
//! `signing-intent` → `signed` per transaction slot (approve slot 1,
//! payForQuotes slot 2), duplicate dispatch refused, no automatic retry,
//! a restart never re-signs (the existing receipt refuses overwrite;
//! explicit cancel is the only release). The receipt records
//! `broadcast:false / paid:false / uploaded:false / finalized:false` and
//! NEVER carries secret material (the organ holds none — the device
//! signs; we verify).
//!
//! # Envelope law
//! This slice composes EIP-1559 ONLY (Arbitrum's native family). A
//! legacy response is refused at the wall naming `tx_type`.

use crate::abi::keccak256;
use crate::connect::{
    decode_hex_bytes_pub, decode_hex_quantity_scalar_pub, decode_hex_quantity_u64_pub,
    ConnectClock, ConnectRequestJson, ConnectSignedTxRaw, ConnectTransactionJson, ConnectTransport,
    DerivationPath,
};
use crate::error::{Error, Result};
use crate::eth::{is_low_s, recover_signer, signature_scalars_nonzero};
use crate::signed_tx::{SignedTx, MAX_SERIALIZED_TX_BYTES};
use crate::types::{Atto, EthAddr, Hex32};
use serde::{Deserialize, Serialize};

/// Arbitrum One chain id (EIP-155/1559 replay protection binds this).
pub const ARBITRUM_ONE_CHAIN_ID: u64 = 42161;

/// ANT (AutonomiNetworkToken) on Arbitrum One. Source: evmlib 0.9.1
/// `src/lib.rs` `ARBITRUM_ONE_PAYMENT_TOKEN_ADDRESS` — the INSTALLED
/// client's own constant, per SPEC-AUTONOMI-TREZOR-1 §2 ("addresses are
/// re-derived from the installed binary at setup, never trusted from a
/// document"). // PUBLIC-CONSTANT: deployed contract address, public chain data
pub const ARBITRUM_ONE_ANT_TOKEN: &str = "0xa78d8321b20c4ef90ecd72f2588aa985a4bdb684";

/// Unified PaymentVault on Arbitrum One (single-node + merkle). Same
/// source as above. // PUBLIC-CONSTANT: deployed contract address, public chain data
pub const ARBITRUM_ONE_PAYMENT_VAULT: &str = "0x9a3ecac693b699fc0b2b6a50b5549e50c2320a26";

/// evmlib 0.9.1 `MAX_TRANSFERS_PER_TRANSACTION` — one payForQuotes call
/// carries at most this many payments (the installed client's own split
/// law; the founder job's 56 rides one call).
pub const MAX_TRANSFERS_PER_TRANSACTION: usize = 256;

/// One quote payment exactly as the bridge persists it: (quote hash,
/// rewards address, amount atto). Field order matches the bridge tuple;
/// the ABI order differs (see [`pay_for_quotes_calldata`]).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaveQuotePayment {
    pub quote_hash: Hex32,
    pub rewards: EthAddr,
    pub amount_atto: Atto,
}

/// The machine-read authorization record (antd-bridge v3
/// `/v1/authorization`, schema `antd-bridge.authorization/1`). Every
/// field is an UNTRUSTED claim until [`bind_authorization`] re-derives
/// it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaveAuthorization {
    pub schema: String,
    pub authorization_id: String,
    pub upload_id: String,
    pub invoice_digest: String,
    pub commitment_digest: String,
    pub artifact_sha256: String,
    pub artifact_bytes: u64,
    pub audience: String,
    pub ant_ceiling_atto: String,
    pub gas_ceiling: String,
    pub state: String,
    #[serde(default)]
    pub events: Vec<WaveAuthorizationEvent>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaveAuthorizationEvent {
    pub at_unix_secs: u64,
    pub kind: String,
    #[serde(default)]
    pub detail: String,
}

/// The machine-read job summary (antd-bridge `/v1/jobs` row).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaveJobSummary {
    pub upload_id: String,
    pub status: String,
    pub artifact_sha256: String,
    pub artifact_bytes: u64,
    pub payment_type: String,
    pub total_amount_atto: String,
    pub created_at_unix_secs: u64,
}

/// Network/contract binding for the ceremony. Constants only in this
/// slice: Arbitrum One, ANT token, payment vault (the actual current
/// contracts per the installed client).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WaveNetwork {
    pub chain_id: u64,
    pub token: EthAddr,
    pub vault: EthAddr,
}

impl WaveNetwork {
    pub fn arbitrum_one() -> Result<Self> {
        Ok(WaveNetwork {
            chain_id: ARBITRUM_ONE_CHAIN_ID,
            token: EthAddr::from_lower_hex(ARBITRUM_ONE_ANT_TOKEN)
                .map_err(|e| Error::field("token", e))?,
            vault: EthAddr::from_lower_hex(ARBITRUM_ONE_PAYMENT_VAULT)
                .map_err(|e| Error::field("vault", e))?,
        })
    }
}

impl Default for WaveNetwork {
    fn default() -> Self {
        Self::arbitrum_one().expect("compile-time constant addresses parse")
    }
}

/// The SEALED wave plan — constructible only by [`bind_authorization`].
/// Carries every reviewed figure; the composer and verifier re-derive
/// from it, never from the untrusted inputs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WaveBinding {
    authorization_id: String,
    upload_id: String,
    invoice_digest: String,
    commitment_digest: String,
    artifact_sha256: String,
    artifact_bytes: u64,
    audience: String,
    ant_ceiling: Atto,
    gas_ceiling: String,
    payments: Vec<WaveQuotePayment>,
    network: WaveNetwork,
    plan_hash: Hex32,
    /// 1 approve + ceil(payments / MAX_TRANSFERS_PER_TRANSACTION) calls.
    transaction_count: u64,
    payer: EthAddr,
}

/// Commitment digest over the quote set — the bridge's EXACT derivation
/// (sorted 0x-lowercase quote hashes, newline-joined), in the sha256
/// family the antd-bridge v3 uses. Public so the service/UI can present
/// the same figure the wall computes.
pub fn commitment_digest(payments: &[WaveQuotePayment]) -> String {
    use sha2::Digest as _;
    let mut hs: Vec<String> = payments
        .iter()
        .map(|p| p.quote_hash.to_lower_hex())
        .collect();
    hs.sort();
    let mut h = sha2::Sha256::new();
    h.update(hs.join("\n").as_bytes());
    format!("sha256:{}", hex::encode(h.finalize()))
}

/// Compose `payForQuotes((address,uint256,bytes32)[])` calldata.
///
/// ABI (evmlib 0.9.1 `abi/IPaymentVault.json`, DataPayment components in
/// ORDER rewardsAddress, amount, quoteHash — the tuple order DIFFERS
/// from the bridge's persistence order and this function is where the
/// swap is lawfully performed): selector ‖ offset(32) ‖ array length(32)
/// ‖ N × (address‖amount‖quoteHash) static heads. All components are
/// static, so there are no tails and the length law is exact:
/// `4 + 64 + 96·N` bytes.
pub fn pay_for_quotes_calldata(payments: &[WaveQuotePayment]) -> Result<Vec<u8>> {
    if payments.is_empty() {
        return Err(Error::field(
            "payments",
            "refusing to compose payForQuotes over an EMPTY payment set — an open job owes at \
             least one payment",
        ));
    }
    if payments.len() > MAX_TRANSFERS_PER_TRANSACTION {
        return Err(Error::field(
            "payments",
            format!(
                "{} payments exceed MAX_TRANSFERS_PER_TRANSACTION {} — compose per-part, never \
                 one oversized call",
                payments.len(),
                MAX_TRANSFERS_PER_TRANSACTION
            ),
        ));
    }
    let selector = pay_for_quotes_selector();
    let mut out = Vec::with_capacity(4 + 64 + 96 * payments.len());
    out.extend_from_slice(&selector);
    // dynamic-array argument offset: this function's single argument slot
    // points at the array body which begins immediately after it.
    out.extend_from_slice(&[0u8; 28]);
    out.extend_from_slice(&32u32.to_be_bytes());
    out.extend_from_slice(&[0u8; 24]);
    out.extend_from_slice(&(payments.len() as u64).to_be_bytes());
    for p in payments {
        out.extend_from_slice(&[0u8; 12]); // left-pad address to 32
        out.extend_from_slice(p.rewards.as_bytes());
        out.extend_from_slice(&p.amount_atto.0.to_big_endian());
        out.extend_from_slice(p.quote_hash.as_bytes());
    }
    Ok(out)
}

/// keccak256("payForQuotes((address,uint256,bytes32)[])")[0..4]. Pinned
/// as a golden in tests; computed at runtime from the crate's keccak
/// (sha3/Keccak256 — the estate-wide keccak source).
pub fn pay_for_quotes_selector() -> [u8; 4] {
    let h = keccak256(b"payForQuotes((address,uint256,bytes32)[])");
    [h[0], h[1], h[2], h[3]]
}

/// Which transaction slot a wave request composes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WaveDestination {
    /// Slot 1: ERC-20 approve(vault, exact total) on the ANT token.
    Approve,
    /// Slot 2+: payForQuotes over the payment part (part 0 = the whole
    /// set for jobs within the transfer cap).
    PayForQuotes { part: u32 },
}

impl WaveDestination {
    pub fn slot(&self) -> u64 {
        match self {
            WaveDestination::Approve => 1,
            WaveDestination::PayForQuotes { part } => 2 + *part as u64,
        }
    }
    pub fn describe(&self) -> &'static str {
        match self {
            WaveDestination::Approve => "approve",
            WaveDestination::PayForQuotes { .. } => "pay_for_quotes",
        }
    }
}

/// Gas/fee ceilings + nonce for composition — the reviewed worst case IS
/// what is signed (the z2.c composition law; the bridge has zero freedom
/// to recompose).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaveFeeCeilings {
    pub nonce: u64,
    pub gas_limit: u64,
    pub max_fee_per_gas_wei: u64,
    pub max_priority_fee_wei: u64,
}

/// The immutable wave signing request — mirrors the z2.c
/// `SignRequest::compose` discipline: constructed ONLY by
/// [`WaveSignRequest::compose`], every field pinned at composition,
/// review single-sourced.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WaveSignRequest {
    dest: WaveDestination,
    plan_hash: Hex32,
    authorization_id: String,
    chain_id: u64,
    nonce: u64,
    to: EthAddr,
    data: Vec<u8>,
    gas_limit: u64,
    max_fee_per_gas_wei: u64,
    max_priority_fee_wei: u64,
    token_ceiling: Atto,
    path: DerivationPath,
    payer: EthAddr,
}

impl WaveSignRequest {
    /// Compose the request for `dest` under the sealed binding
    /// (EIP-1559 only in this slice). Refuses slot/count
    /// inconsistencies: you cannot compose a part beyond the plan's
    /// transaction count, and multi-part plans refuse outright (this
    /// slice composes the single-part plan only).
    pub fn compose(
        binding: &WaveBinding,
        dest: WaveDestination,
        fees: WaveFeeCeilings,
        path: DerivationPath,
    ) -> Result<Self> {
        let (to, data, token_ceiling) = match dest {
            WaveDestination::Approve => (
                binding.network.token,
                crate::calldata::approve_calldata(binding.network.vault, binding.ant_ceiling)?,
                binding.ant_ceiling,
            ),
            WaveDestination::PayForQuotes { part } => {
                if part != 0 {
                    return Err(Error::field(
                        "part",
                        "this slice composes the single-part plan only (56 ≤ 256 transfers); \
                         multi-part wave composition is its own reviewed slice",
                    ));
                }
                (
                    binding.network.vault,
                    pay_for_quotes_calldata(&binding.payments)?,
                    binding.ant_ceiling,
                )
            }
        };
        if dest.slot() > binding.transaction_count {
            return Err(Error::field(
                "slot",
                format!(
                    "slot {} is outside the reviewed transaction count {}",
                    dest.slot(),
                    binding.transaction_count
                ),
            ));
        }
        if fees.max_priority_fee_wei > fees.max_fee_per_gas_wei {
            return Err(Error::field(
                "max_priority_fee_wei",
                "priority fee above max fee per gas — unlawful ceiling",
            ));
        }
        if fees.gas_limit == 0 || fees.max_fee_per_gas_wei == 0 {
            return Err(Error::field(
                "gas",
                "zero gas limit or fee ceiling refuses composition (not a lawful review figure)",
            ));
        }
        Ok(WaveSignRequest {
            dest,
            plan_hash: binding.plan_hash,
            authorization_id: binding.authorization_id.clone(),
            chain_id: binding.network.chain_id,
            nonce: fees.nonce,
            to,
            data,
            gas_limit: fees.gas_limit,
            max_fee_per_gas_wei: fees.max_fee_per_gas_wei,
            max_priority_fee_wei: fees.max_priority_fee_wei,
            token_ceiling,
            path,
            payer: binding.payer,
        })
    }

    /// The Connect `ethereumSignTransaction` payload — the SAME wire
    /// shape the z2.c adapter pinned (hex quantities, numeric chainId,
    /// per-family fee fields, chunkify false). EIP-1559 form.
    pub fn connect_payload(&self) -> ConnectRequestJson {
        let hexq = |v: u64| format!("0x{v:x}");
        ConnectRequestJson {
            path: self.path.as_str().to_string(),
            transaction: ConnectTransactionJson::Eip1559 {
                to: self.to.to_lower_hex(),
                value: "0x0".to_string(),
                gas_limit: hexq(self.gas_limit),
                nonce: hexq(self.nonce),
                data: format!("0x{}", hex::encode(&self.data)),
                chain_id: self.chain_id,
                max_fee_per_gas: hexq(self.max_fee_per_gas_wei),
                max_priority_fee_per_gas: hexq(self.max_priority_fee_wei),
            },
            chunkify: false,
        }
    }

    /// Human review summary — single-sourced from THIS request; the
    /// numbers the payer approves are the numbers that get signed.
    pub fn review_summary(&self) -> WaveReviewSummary {
        WaveReviewSummary {
            operation: self.dest.describe(),
            slot: self.dest.slot(),
            plan_hash: self.plan_hash,
            authorization_id: self.authorization_id.clone(),
            chain_id: self.chain_id,
            payer: self.payer,
            destination: self.to,
            nonce: self.nonce,
            path: self.path.as_str().to_string(),
            value_wei: Atto::ZERO,
            calldata_keccak: Hex32(keccak256(&self.data)),
            calldata_len: self.data.len() as u64,
            token_ceiling: self.token_ceiling,
            gas_limit: self.gas_limit,
            max_fee_per_gas_wei: self.max_fee_per_gas_wei,
            max_priority_fee_wei: self.max_priority_fee_wei,
            signature_count: 1,
        }
    }

    // Immutable getters for the verification boundary and tests.
    pub fn dest(&self) -> WaveDestination {
        self.dest
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

/// The review summary a human approves BEFORE device interaction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WaveReviewSummary {
    pub operation: &'static str,
    pub slot: u64,
    pub plan_hash: Hex32,
    pub authorization_id: String,
    pub chain_id: u64,
    pub payer: EthAddr,
    pub destination: EthAddr,
    pub nonce: u64,
    pub path: String,
    pub value_wei: Atto,
    pub calldata_keccak: Hex32,
    pub calldata_len: u64,
    pub token_ceiling: Atto,
    pub gas_limit: u64,
    pub max_fee_per_gas_wei: u64,
    pub max_priority_fee_wei: u64,
    pub signature_count: u64,
}

impl WaveBinding {
    /// The expected payer — device-derived at preflight, proven by
    /// recovery at verify. The path never selects the payer; recovery
    /// does.
    pub fn payer(&self) -> EthAddr {
        self.payer
    }
    pub fn authorization_id(&self) -> &str {
        &self.authorization_id
    }
    pub fn upload_id(&self) -> &str {
        &self.upload_id
    }
    pub fn invoice_digest(&self) -> &str {
        &self.invoice_digest
    }
    pub fn commitment_digest(&self) -> &str {
        &self.commitment_digest
    }
    pub fn artifact_sha256(&self) -> &str {
        &self.artifact_sha256
    }
    pub fn artifact_bytes(&self) -> u64 {
        self.artifact_bytes
    }
    pub fn audience(&self) -> &str {
        &self.audience
    }
    pub fn ant_ceiling(&self) -> Atto {
        self.ant_ceiling
    }
    pub fn gas_ceiling(&self) -> &str {
        &self.gas_ceiling
    }
    pub fn payments(&self) -> &[WaveQuotePayment] {
        &self.payments
    }
    pub fn network(&self) -> &WaveNetwork {
        &self.network
    }
    pub fn plan_hash(&self) -> Hex32 {
        self.plan_hash
    }
    pub fn transaction_count(&self) -> u64 {
        self.transaction_count
    }
}

/// THE binding gate. Every machine-checkable pre-dispatch law, each a
/// NAMED refusal; the happy path is the only path that seals a plan.
///
/// Laws (numbered for the refusal strings):
/// 1. the authorization exists and carries schema authorization/1;
/// 2. state is `authorized-for-signing` (cancelled/consumed refuse);
/// 3. the job exists, is OPEN, and is the authorization's own job;
/// 4. no NEWER open job exists for the same artifact (stale lineage);
/// 5. artifact sha256 + bytes match authorization == job;
/// 6. the authorization carries a founder-selected audience;
/// 7. payment type is wave_batch (this slice signs nothing else);
/// 8. the payment set is non-empty and within the transfer cap;
/// 9. NO-SILENT-REQUOTE WALL: the presented payment set re-derives the
///    authorization's commitment digest (sha256 family, bridge-exact);
/// 10. ANT obligation: authorization ceiling == job total == the SUM of
///     the presented payments (three-way exact, never above);
/// 11. gas is a SEPARATE ceiling (present; never folded — it rides its
///     own field into the review and the receipt);
/// 12. invoice digest is present (the lineage document the founder
///     reviewed);
/// 13. chain is Arbitrum One and the token/vault are the pinned current
///     contracts of the installed client;
/// 14. the payer address is bound (device-derived at preflight;
///     recovery proves it at verify);
/// 15. transaction count is computed HERE and rides the sealed plan (the
///     review must state it before any device interaction).
pub fn bind_authorization(
    authorization: Option<&WaveAuthorization>,
    jobs: &[WaveJobSummary],
    payments: &[WaveQuotePayment],
    payer: EthAddr,
    network: &WaveNetwork,
) -> Result<WaveBinding> {
    let auth = authorization.ok_or_else(|| {
        Error::field(
            "authorization",
            "LAW 1 (missing-authorization): no authorization record exists — the founder's \
             Phase-C press has not landed on this machine; signing is refused until one does",
        )
    })?;
    if auth.schema != "antd-bridge.authorization/1" {
        return Err(Error::field(
            "authorization",
            format!(
                "LAW 1 (schema): unknown authorization schema {:?}",
                auth.schema
            ),
        ));
    }
    if auth.state != "authorized-for-signing" {
        return Err(Error::field(
            "authorization",
            format!(
                "LAW 2 (state): authorization {} is {:?} — only an authorization in \
                 authorized-for-signing can begin signing; cancelled/consumed refuse",
                auth.authorization_id, auth.state
            ),
        ));
    }
    let job = jobs
        .iter()
        .find(|j| j.upload_id == auth.upload_id)
        .ok_or_else(|| {
            Error::field(
                "job",
                format!(
                    "LAW 3 (job): the authorization's job {} does not exist on the bridge",
                    auth.upload_id
                ),
            )
        })?;
    if job.status != "open" {
        return Err(Error::field(
            "job",
            format!(
                "LAW 3 (job-open): job {} is {:?} — only an OPEN job's quotes can be signed \
                 (an abandoned job was re-quoted; a finalized job is settled)",
                job.upload_id, job.status
            ),
        ));
    }
    if let Some(newer) = jobs.iter().find(|j| {
        j.artifact_sha256 == job.artifact_sha256
            && j.status == "open"
            && j.upload_id != job.upload_id
            && j.created_at_unix_secs > job.created_at_unix_secs
    }) {
        return Err(Error::field(
            "job",
            format!(
                "LAW 4 (stale-lineage): job {} (created {}) has a NEWER open sibling {} for \
                 the same artifact — the authorization's quote lineage is stale; refresh the \
                 price and re-authorize",
                job.upload_id, job.created_at_unix_secs, newer.upload_id
            ),
        ));
    }
    if auth.artifact_sha256 != job.artifact_sha256 || auth.artifact_bytes != job.artifact_bytes {
        return Err(Error::field(
            "artifact",
            "LAW 5 (artifact): authorization artifact identity != job artifact identity",
        ));
    }
    if auth.audience.is_empty() {
        return Err(Error::field(
            "audience",
            "LAW 6 (audience): the authorization carries no founder-selected audience",
        ));
    }
    if job.payment_type != "wave_batch" {
        return Err(Error::field(
            "payment_type",
            format!(
                "LAW 7 (payment-type): job payment type is {:?}; this slice signs wave_batch \
                 only (merkle rides the z2.b/z2.c adapter)",
                job.payment_type
            ),
        ));
    }
    if payments.is_empty() || payments.len() > MAX_TRANSFERS_PER_TRANSACTION {
        return Err(Error::field(
            "payments",
            format!(
                "LAW 8 (payment-set): {} presented payments — need 1..={}",
                payments.len(),
                MAX_TRANSFERS_PER_TRANSACTION
            ),
        ));
    }
    // LAW 9 — the wall, recomputed, never trusted.
    let derived = commitment_digest(payments);
    if derived != auth.commitment_digest {
        return Err(Error::field(
            "commitment_digest",
            format!(
                "LAW 9 (no-silent-requote): the presented payment set re-derives {} but the \
                 authorization pins {} — the quotes changed after this authorization was \
                 prepared; it is void, refresh and re-authorize",
                derived, auth.commitment_digest
            ),
        ));
    }
    // LAW 10 — three-way exact ANT obligation.
    let ant_ceiling = Atto::parse_canonical(&auth.ant_ceiling_atto)
        .map_err(|e| Error::field("ant_ceiling_atto", format!("LAW 10 (ANT ceiling): {e}")))?;
    let job_total = Atto::parse_canonical(&job.total_amount_atto)
        .map_err(|e| Error::field("total_amount_atto", format!("LAW 10 (job total): {e}")))?;
    let mut sum = Atto::from_u64(0);
    for p in payments {
        sum = sum
            .checked_add(p.amount_atto)
            .ok_or_else(|| Error::field("payments", "LAW 10 (sum): payment sum overflow"))?;
    }
    if ant_ceiling != job_total || ant_ceiling != sum {
        return Err(Error::field(
            "ant_ceiling_atto",
            format!(
                "LAW 10 (ANT-exact): authorization ceiling {ant_ceiling} != job total \
                 {job_total} != payment sum {sum} — the ceiling is exact, never above"
            ),
        ));
    }
    if auth.gas_ceiling.trim().is_empty() {
        return Err(Error::field(
            "gas_ceiling",
            "LAW 11 (gas-separate): the authorization carries no separate gas ceiling",
        ));
    }
    if !auth.invoice_digest.starts_with("sha256:") || auth.invoice_digest.len() != 7 + 64 {
        return Err(Error::field(
            "invoice_digest",
            "LAW 12 (invoice): the authorization carries no sha256 invoice digest — the \
             lineage document the founder reviewed is missing",
        ));
    }
    let pinned = WaveNetwork::arbitrum_one()?;
    if network.chain_id != ARBITRUM_ONE_CHAIN_ID {
        return Err(Error::field(
            "chain_id",
            format!(
                "LAW 13 (chain): network chain id {} != Arbitrum One {ARBITRUM_ONE_CHAIN_ID}",
                network.chain_id
            ),
        ));
    }
    if network.token != pinned.token || network.vault != pinned.vault {
        return Err(Error::field(
            "contracts",
            "LAW 13 (contracts): token/vault are not the installed client's Arbitrum One \
             constants — refusing to sign against unknown contracts",
        ));
    }
    if payer.is_zero() {
        return Err(Error::field(
            "payer",
            "LAW 14 (payer): no payer address is bound — derive it from the founder's Trezor \
             at preflight before composing",
        ));
    }
    // LAW 15 — transaction count, computed here, carried forever.
    let parts = (payments.len() as u64).div_ceil(MAX_TRANSFERS_PER_TRANSACTION as u64);
    let transaction_count = 1 + parts;
    // Seal: plan hash over the canonical binding preimage.
    let mut preimage = Vec::new();
    preimage.extend_from_slice(auth.authorization_id.as_bytes());
    preimage.extend_from_slice(b"|");
    preimage.extend_from_slice(auth.upload_id.as_bytes());
    preimage.extend_from_slice(b"|");
    preimage.extend_from_slice(auth.commitment_digest.as_bytes());
    preimage.extend_from_slice(b"|");
    preimage.extend_from_slice(auth.artifact_sha256.as_bytes());
    preimage.extend_from_slice(b"|");
    preimage.extend_from_slice(&auth.artifact_bytes.to_be_bytes());
    preimage.extend_from_slice(b"|");
    preimage.extend_from_slice(&ant_ceiling.0.to_big_endian());
    preimage.extend_from_slice(b"|");
    preimage.extend_from_slice(&network.chain_id.to_be_bytes());
    preimage.extend_from_slice(network.token.as_bytes());
    preimage.extend_from_slice(network.vault.as_bytes());
    preimage.extend_from_slice(b"|");
    preimage.extend_from_slice(payer.as_bytes());
    preimage.extend_from_slice(b"|");
    for p in payments {
        preimage.extend_from_slice(p.quote_hash.as_bytes());
        preimage.extend_from_slice(p.rewards.as_bytes());
        preimage.extend_from_slice(&p.amount_atto.0.to_big_endian());
    }
    let plan_hash = Hex32(keccak256(&preimage));
    Ok(WaveBinding {
        authorization_id: auth.authorization_id.clone(),
        upload_id: auth.upload_id.clone(),
        invoice_digest: auth.invoice_digest.clone(),
        commitment_digest: auth.commitment_digest.clone(),
        artifact_sha256: auth.artifact_sha256.clone(),
        artifact_bytes: auth.artifact_bytes,
        audience: auth.audience.clone(),
        ant_ceiling,
        gas_ceiling: auth.gas_ceiling.clone(),
        payments: payments.to_vec(),
        network: network.clone(),
        plan_hash,
        transaction_count,
        payer,
    })
}

/// The VERIFIED wave result — constructible only by
/// [`verify_wave_signed`] (the same construction law as
/// [`crate::connect::VerifiedSigned`]).
#[derive(Debug, Clone)]
pub struct WaveVerifiedSigned {
    request_dest: WaveDestination,
    request_plan_hash: Hex32,
    tx_hash: Hex32,
    signer: EthAddr,
    serialized: Vec<u8>,
    nonce: u64,
}

impl WaveVerifiedSigned {
    pub fn request_dest(&self) -> WaveDestination {
        self.request_dest
    }
    pub fn request_plan_hash(&self) -> Hex32 {
        self.request_plan_hash
    }
    pub fn tx_hash(&self) -> Hex32 {
        self.tx_hash
    }
    pub fn signer(&self) -> EthAddr {
        self.signer
    }
    pub fn serialized_tx(&self) -> &[u8] {
        &self.serialized
    }
    pub fn nonce(&self) -> u64 {
        self.nonce
    }
}

/// THE wave verification boundary — the z2.c wall, wave-bound.
/// Everything bridge-supplied is untrusted; every decoded field equals
/// the immutable request field (named refusals); response components
/// equal the envelope-embedded signature; scalars nonzero, low-s; the
/// signer is RECOVERED from the locally-computed preimage and must equal
/// the sealed plan's payer; the transaction hash is computed locally.
pub fn verify_wave_signed(
    request: &WaveSignRequest,
    binding: &WaveBinding,
    raw: &ConnectSignedTxRaw,
) -> Result<WaveVerifiedSigned> {
    if binding.plan_hash() != request.plan_hash() {
        return Err(Error::field(
            "plan_hash",
            "request/binding plan identity mismatch — refusing to verify against a different \
             plan",
        ));
    }
    let serialized =
        decode_hex_bytes_pub(&raw.serialized_tx, "serialized_tx", MAX_SERIALIZED_TX_BYTES)?;
    let signed = SignedTx::decode_strict(&serialized)?;
    let t = match &signed {
        SignedTx::Eip1559(t) => t,
        SignedTx::Legacy(_) => {
            return Err(Error::field(
                "tx_type",
                "wave slice composes EIP-1559 only; legacy envelope refused",
            ))
        }
    };
    if t.chain_id != request.chain_id() {
        return Err(Error::field(
            "chain_id",
            format!(
                "tx chain {} != request chain {} — replay protection binds the wrong chain",
                t.chain_id,
                request.chain_id()
            ),
        ));
    }
    if t.nonce != request.nonce() {
        return Err(Error::field(
            "nonce",
            format!("tx nonce {} != request nonce {}", t.nonce, request.nonce()),
        ));
    }
    if t.to != request.to() {
        return Err(Error::field(
            "to",
            format!(
                "tx destination {} != request destination {}",
                t.to,
                request.to()
            ),
        ));
    }
    if t.value_wei != Atto::ZERO {
        return Err(Error::field(
            "value",
            format!(
                "native value {} wei — zero-value contract calls only",
                t.value_wei
            ),
        ));
    }
    if t.data != request.data() {
        return Err(Error::field(
            "input",
            "calldata not byte-identical to the request calldata — the signed transaction is \
             not the reviewed transaction",
        ));
    }
    if t.gas_limit != request.gas_limit() {
        return Err(Error::field(
            "gas_limit",
            format!(
                "tx gas limit {} != request gas limit {}",
                t.gas_limit,
                request.gas_limit()
            ),
        ));
    }
    if t.max_fee_per_gas_wei != request.max_fee_per_gas_wei() {
        return Err(Error::field(
            "maxFeePerGas",
            format!(
                "tx fee {} != request fee {}",
                t.max_fee_per_gas_wei,
                request.max_fee_per_gas_wei()
            ),
        ));
    }
    if t.max_priority_fee_wei != request.max_priority_fee_wei() {
        return Err(Error::field(
            "maxPriorityFeePerGas",
            format!(
                "tx priority fee {} != request priority fee {}",
                t.max_priority_fee_wei,
                request.max_priority_fee_wei()
            ),
        ));
    }
    let resp_v = decode_hex_quantity_u64_pub(&raw.v, "v")?;
    let resp_r = decode_hex_quantity_scalar_pub(&raw.r, "r")?;
    let resp_s = decode_hex_quantity_scalar_pub(&raw.s, "s")?;
    let rlp_v = t.y_parity as u64;
    if resp_v != rlp_v {
        return Err(Error::field(
            "v",
            format!("response v 0x{resp_v:x} != envelope yParity 0x{rlp_v:x} — malformed response"),
        ));
    }
    if resp_r != t.r || resp_s != t.s {
        return Err(Error::field(
            "signature",
            "response r/s differ from the envelope-embedded signature components",
        ));
    }
    if !signature_scalars_nonzero(&t.r, &t.s) {
        return Err(Error::field("signature", "r or s is zero"));
    }
    if !is_low_s(&t.s) {
        return Err(Error::field(
            "s",
            "high-s signature — EIP-2 requires s ≤ n/2",
        ));
    }
    let prehash = signed.signing_hash();
    let signer = recover_signer(&prehash, &t.r, &t.s, t.y_parity)?;
    if signer != binding.payer() {
        return Err(Error::field(
            "from",
            format!(
                "recovered signer {signer} != plan payer {} — the path does not select the \
                 payer; recovery does",
                binding.payer()
            ),
        ));
    }
    let tx_hash = signed.tx_hash();
    Ok(WaveVerifiedSigned {
        request_dest: request.dest(),
        request_plan_hash: request.plan_hash(),
        tx_hash,
        signer,
        serialized: signed.canonical_bytes(),
        nonce: t.nonce,
    })
}

/// One wave signing receipt per authorization — append-only, exactly one.
pub const WAVE_RECEIPT_SCHEMA: &str = "bpay.sign-receipt/1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaveSignedSlotRecord {
    pub slot: u64,
    pub operation: String,
    pub tx_hash: Hex32,
    pub signer: EthAddr,
    pub nonce: u64,
    pub serialized_tx_hex: String,
    pub signed_at_unix_secs: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaveSignReceipt {
    pub schema: String,
    pub authorization_id: String,
    pub upload_id: String,
    pub invoice_digest: String,
    pub commitment_digest: String,
    pub artifact_sha256: String,
    pub artifact_bytes: u64,
    pub audience: String,
    pub chain_id: u64,
    pub plan_hash: Hex32,
    pub ant_ceiling_atto: String,
    pub gas_ceiling: String,
    pub transaction_count: u64,
    pub payer: EthAddr,
    pub derivation_path: String,
    pub trezor_model: Option<String>,
    pub transport: Option<String>,
    pub state: String, // signing-intent | signed | cancelled
    pub slots: Vec<WaveSignedSlotRecord>,
    #[serde(default)]
    pub events: Vec<WaveAuthorizationEvent>,
    pub broadcast: bool,
    pub paid: bool,
    pub uploaded: bool,
    pub finalized: bool,
}

impl WaveSignReceipt {
    /// A receipt starts at signing-intent with NOTHING signed.
    pub fn opening_intent(binding: &WaveBinding, path: &DerivationPath, now_unix: u64) -> Self {
        WaveSignReceipt {
            schema: WAVE_RECEIPT_SCHEMA.to_string(),
            authorization_id: binding.authorization_id().to_string(),
            upload_id: binding.upload_id().to_string(),
            invoice_digest: binding.invoice_digest().to_string(),
            commitment_digest: binding.commitment_digest().to_string(),
            artifact_sha256: binding.artifact_sha256().to_string(),
            artifact_bytes: binding.artifact_bytes(),
            audience: binding.audience().to_string(),
            chain_id: binding.network().chain_id,
            plan_hash: binding.plan_hash(),
            ant_ceiling_atto: binding.ant_ceiling().to_decimal(),
            gas_ceiling: binding.gas_ceiling().to_string(),
            transaction_count: binding.transaction_count(),
            payer: binding.payer(),
            derivation_path: path.as_str().to_string(),
            trezor_model: None,
            transport: None,
            state: "signing-intent".to_string(),
            slots: Vec::new(),
            events: vec![WaveAuthorizationEvent {
                at_unix_secs: now_unix,
                kind: "signing-intent".to_string(),
                detail: "founder began Trezor signing from My Data; nothing dispatched yet; \
                         nothing broadcast, paid, or uploaded"
                    .to_string(),
            }],
            broadcast: false,
            paid: false,
            uploaded: false,
            finalized: false,
        }
    }

    /// Record a verified slot — refuses duplicates, out-of-range slots,
    /// cross-plan results, and cancelled receipts; the receipt completes
    /// (`signed`) when every reviewed slot is signed.
    pub fn record_verified_slot(
        &mut self,
        binding: &WaveBinding,
        verified: &WaveVerifiedSigned,
        now_unix: u64,
    ) -> Result<()> {
        if self.authorization_id != binding.authorization_id()
            || self.plan_hash != binding.plan_hash()
        {
            return Err(Error::field(
                "plan_hash",
                "verified result was produced under a different plan — cross-plan recording \
                 refused (equivalent calldata is not authorization)",
            ));
        }
        if self.state == "cancelled" {
            return Err(Error::field(
                "state",
                "the receipt was cancelled — no signature may attach to it",
            ));
        }
        let slot = verified.request_dest().slot();
        if self.slots.iter().any(|s| s.slot == slot) {
            return Err(Error::field(
                "slot",
                format!(
                    "slot {slot} already carries a verified signature — duplicate/successful-\
                     signature replay refused; a restart never re-signs"
                ),
            ));
        }
        if slot == 0 || slot > self.transaction_count {
            return Err(Error::field(
                "slot",
                format!(
                    "slot {slot} is outside the reviewed transaction count {}",
                    self.transaction_count
                ),
            ));
        }
        self.slots.push(WaveSignedSlotRecord {
            slot,
            operation: verified.request_dest().describe().to_string(),
            tx_hash: verified.tx_hash(),
            signer: verified.signer(),
            nonce: verified.nonce(),
            serialized_tx_hex: format!("0x{}", hex::encode(verified.serialized_tx())),
            signed_at_unix_secs: now_unix,
        });
        if self.slots.len() as u64 == self.transaction_count {
            self.state = "signed".to_string();
        }
        self.events.push(WaveAuthorizationEvent {
            at_unix_secs: now_unix,
            kind: "slot-signed".to_string(),
            detail: format!(
                "slot {slot} ({}) verified locally — signer recovered, hash computed \
                 on-device-result through the wall; NOT broadcast, NOT paid",
                verified.request_dest().describe()
            ),
        });
        Ok(())
    }

    /// Cancel — lawful any time before the receipt is complete (nothing
    /// was ever broadcast; the whole organ cannot broadcast).
    pub fn cancel(&mut self, now_unix: u64, why: &str) -> Result<()> {
        if self.state == "signed" {
            return Err(Error::field(
                "state",
                "the receipt is SIGNED (complete) — it is a durable record, not a reservation; \
                 cancellation is meaningless and refused",
            ));
        }
        self.state = "cancelled".to_string();
        self.events.push(WaveAuthorizationEvent {
            at_unix_secs: now_unix,
            kind: "cancelled".to_string(),
            detail: format!("{why}; no paid or uploaded state exists anywhere in this organ"),
        });
        Ok(())
    }

    pub fn state(&self) -> &str {
        &self.state
    }
}

/// The file-backed receipt store: one JSON file per authorization under
/// `state_dir/sign-receipts/<authorization_id>.json`. The FIRST intent
/// write creates the file and any later overwrite of a first intent is
/// refused; transitions rewrite atomically (tmp + rename).
pub struct WaveLedger {
    dir: std::path::PathBuf,
}

impl WaveLedger {
    pub fn open(state_dir: &std::path::Path) -> Result<Self> {
        let dir = state_dir.join("sign-receipts");
        std::fs::create_dir_all(&dir).map_err(|e| Error::Io(e.to_string()))?;
        Ok(WaveLedger { dir })
    }

    fn receipt_path(&self, authorization_id: &str) -> std::path::PathBuf {
        // Authorization ids are bridge-minted (`auth-<millis>`); refuse
        // anything that could escape the directory.
        let safe: String = authorization_id
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '-' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        self.dir.join(format!("{safe}.json"))
    }

    pub fn load(&self, authorization_id: &str) -> Result<Option<WaveSignReceipt>> {
        let p = self.receipt_path(authorization_id);
        if !p.exists() {
            return Ok(None);
        }
        let s = std::fs::read_to_string(&p).map_err(|e| Error::Io(e.to_string()))?;
        serde_json::from_str(&s)
            .map(Some)
            .map_err(|e| Error::Malformed(format!("receipt JSON: {e}")))
    }

    /// Persist the FIRST intent — refuses if a receipt already exists (a
    /// restart never silently signs again; the existing receipt must be
    /// read and either continued lawfully or cancelled explicitly).
    pub fn write_first_intent(&self, receipt: &WaveSignReceipt) -> Result<()> {
        let p = self.receipt_path(&receipt.authorization_id);
        if p.exists() {
            return Err(Error::field(
                "receipt",
                "a receipt for this authorization already exists — refusing to overwrite; a \
                 restart never silently signs again (read it, continue or cancel explicitly)",
            ));
        }
        let tmp = p.with_extension("json.tmp");
        std::fs::write(
            &tmp,
            serde_json::to_string_pretty(receipt).map_err(|e| Error::Malformed(e.to_string()))?,
        )
        .map_err(|e| Error::Io(e.to_string()))?;
        std::fs::rename(&tmp, &p).map_err(|e| Error::Io(e.to_string()))?;
        Ok(())
    }

    /// Rewrite after a lawful transition (slot recorded / cancelled).
    pub fn rewrite(&self, receipt: &WaveSignReceipt) -> Result<()> {
        let p = self.receipt_path(&receipt.authorization_id);
        if !p.exists() {
            return Err(Error::field(
                "receipt",
                "no receipt to rewrite — write the first intent before recording transitions",
            ));
        }
        let tmp = p.with_extension("json.tmp");
        std::fs::write(
            &tmp,
            serde_json::to_string_pretty(receipt).map_err(|e| Error::Malformed(e.to_string()))?,
        )
        .map_err(|e| Error::Io(e.to_string()))?;
        std::fs::rename(&tmp, &p).map_err(|e| Error::Io(e.to_string()))?;
        Ok(())
    }
}

/// The one-shot wave signing driver — mirrors [`crate::connect::
/// sign_batch_payment`]: intent FIRST (durable, by the caller), compose,
/// ONE transport call, verify, record, rewrite. No automatic retry;
/// transport errors propagate after-dispatch with the intent retained;
/// duplicate results refuse at the slot binding; the ledger rewrite is
/// refused unless the slot transition was lawful.
// The argument count is the boundary's own shape (ledger, binding, receipt,
// destination, fees, path, clock, transport) — collapsing it would hide a
// binding the review names field by field (mirrors the z2.c driver's allow).
#[allow(clippy::too_many_arguments)]
pub fn sign_wave_slot(
    ledger: &WaveLedger,
    binding: &WaveBinding,
    receipt: &mut WaveSignReceipt,
    dest: WaveDestination,
    fees: WaveFeeCeilings,
    path: &DerivationPath,
    clock: &mut dyn ConnectClock,
    transport: &mut dyn ConnectTransport,
) -> std::result::Result<WaveVerifiedSigned, crate::connect::SignAttemptError> {
    let request = WaveSignRequest::compose(binding, dest, fees, path.clone())
        .map_err(crate::connect::SignAttemptError::BeforeDispatch)?;
    let raw = transport
        .ethereum_sign_transaction(&request.connect_payload())
        .map_err(crate::connect::SignAttemptError::AfterDispatch)?;
    let verified = verify_wave_signed(&request, binding, &raw)
        .map_err(crate::connect::SignAttemptError::AfterDispatch)?;
    let t1 = clock.now_unix();
    receipt
        .record_verified_slot(binding, &verified, t1)
        .map_err(crate::connect::SignAttemptError::AfterDispatch)?;
    ledger
        .rewrite(receipt)
        .map_err(crate::connect::SignAttemptError::AfterDispatch)?;
    Ok(verified)
}
