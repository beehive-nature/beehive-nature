// antd-bridge — keyless prepare/finalize HTTP service for the Autonomi network
// Wraps ant-core's external-signer flow. NO wallet key. NO terminal.
//
//   POST /v1/upload/prepare   { "path": "...", "force_fresh": false }  → real payment plan
//   POST /v1/upload/finalize  { "upload_id": "...", "tx_hashes": {...} } → data_map + address
//   POST /v1/upload/abandon   { "upload_id": "..." }                   → void an open plan
//   GET  /v1/jobs             → persisted job index (no secrets)
//   GET  /health              → status
//
// P1 RECOVERY LAW (crash-recovery proof @065c2b5f): self-encryption is
// deterministic (same file → same chunks → same data_map_address) but QUOTES
// ARE NOT — a fresh prepare generates an entirely different quote set (0/24
// overlap measured). "Same content ≠ same authorization." Therefore:
//
//   1. At prepare time the bridge persists the ENTIRE payment authorization:
//      the serde-native PaymentIntent AND the per-chunk payment/proof
//      metadata (quotes, peer_quotes, commitment sidecars, PUT targets).
//   2. On re-prepare of the same artifact (same sha256) while a job is open,
//      the bridge re-derives the chunks deterministically, then SWAPS the
//      fresh quotes out and the persisted plan in. The recovered response
//      carries the EXACT original plan — identical quote hashes — and the
//      fresh quotes are discarded before they can ever be signed.
//   3. Recovery is fail-closed: if the chunk set changed (e.g. a chunk became
//      already-stored), the data_map moved, or the re-attached quotes do not
//      reproduce the persisted plan exactly, recovery REFUSES and names
//      force_fresh — it never silently over- or under-pays.
//   4. finalize consumes exactly the prepared upload (recovered or fresh)
//      via ant-core's real Client::finalize_upload.
//
// State lives under ANTD_BRIDGE_STATE (default ./bridge-state) in
// jobs/<artifact-sha256>/<upload_id>.json. It contains only public payment
// targets (quote hashes, rewards addresses, amounts, PUT endpoints) — no key
// material exists anywhere in this service.

use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use tower_http::cors::CorsLayer;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use ant_core::data::Client as AntClient;
use ant_core::data::client::batch::{PaymentIntent, SingleNodeQuotePayment};
use ant_core::data::client::file::{ExternalPaymentInfo, PreparedUpload, Visibility};
use ant_protocol::evm::{Amount, EncodedPeerId, PaymentQuote, QuoteHash, RewardsAddress, TxHash};
use ant_protocol::payment::QuotePaymentInfo;
use ant_protocol::transport::{MultiAddr, PeerId};

// ── persisted job state ─────────────────────────────────────────────────────

/// serde shape of `SingleNodeQuotePayment` (ant-core derives only Debug).
#[derive(Serialize, Deserialize, Clone)]
struct QuoteState {
    quote_hash: String,      // 0x-hex
    rewards_address: String, // 0x-hex
    amount: String,          // decimal atto
    price: String,           // decimal atto (pre-3x)
}

/// serde shape of `(EncodedPeerId, PaymentQuote)` — both serde-native, kept
/// verbatim so proof material round-trips losslessly.
#[derive(Serialize, Deserialize, Clone)]
struct PeerQuoteState {
    peer: EncodedPeerId,
    quote: PaymentQuote,
}

/// serde shape of `Vec<(PeerId, Vec<MultiAddr>)>` via Display/FromStr strings.
#[derive(Serialize, Deserialize, Clone)]
struct QuotedPeerState {
    peer_id: String,
    addrs: Vec<String>,
}

/// The persisted, non-re-derivable half of a `PreparedChunk`. Chunk CONTENT is
/// never persisted — it re-derives deterministically from the artifact file.
#[derive(Serialize, Deserialize, Clone)]
struct ChunkState {
    address_hex: String,
    quotes: Vec<QuoteState>,
    peer_quotes: Vec<PeerQuoteState>,
    sidecars_hex: Vec<String>,
    quoted_peers: Vec<QuotedPeerState>,
}

#[derive(Serialize, Deserialize, Clone)]
struct JobState {
    schema: String, // antd-bridge.job/1
    upload_id: String,
    status: String, // open | finalized | abandoned
    created_at_unix_secs: u64,
    artifact_path: String,
    artifact_sha256: String,
    artifact_bytes: u64,
    data_map_address: Option<String>,
    payment_type: String,
    payment_intent: PaymentIntent,
    chunks: Vec<ChunkState>,
    recovery_count: u32,
    last_recovery_unix_secs: Option<u64>,
    finalized_unix_secs: Option<u64>,
    abandoned_reason: Option<String>,
}

// ── conversions (all fail loudly — a silent default here would be a plan   ──
// ── that "recovers" but cannot finalize, the exact failure P1 guards against)

fn chunk_to_state(chunk: &ant_core::data::client::batch::PreparedChunk) -> ChunkState {
    ChunkState {
        address_hex: hex::encode(chunk.address),
        quotes: chunk
            .payment
            .quotes
            .iter()
            .map(|q| QuoteState {
                quote_hash: format!("0x{}", hex::encode(q.quote_hash)),
                rewards_address: format!("{:#x}", q.rewards_address),
                amount: q.amount.to_string(),
                price: q.price.to_string(),
            })
            .collect(),
        peer_quotes: chunk
            .peer_quotes
            .iter()
            .map(|(p, q)| PeerQuoteState { peer: p.clone(), quote: q.clone() })
            .collect(),
        sidecars_hex: chunk.commitment_sidecars.iter().map(hex::encode).collect(),
        quoted_peers: chunk
            .quoted_peers
            .iter()
            .map(|(p, addrs)| QuotedPeerState {
                peer_id: p.to_string(),
                addrs: addrs.iter().map(|a| a.to_string()).collect(),
            })
            .collect(),
    }
}

fn chunk_state_apply(state: &ChunkState, chunk: &mut ant_core::data::client::batch::PreparedChunk) -> Result<(), String> {
    let mut quotes = Vec::with_capacity(state.quotes.len());
    for q in &state.quotes {
        quotes.push(QuotePaymentInfo {
            quote_hash: QuoteHash::from_str(&q.quote_hash)
                .map_err(|e| format!("bad quote hash {}: {e}", q.quote_hash))?,
            rewards_address: RewardsAddress::from_str(&q.rewards_address)
                .map_err(|e| format!("bad rewards address {}: {e}", q.rewards_address))?,
            amount: Amount::from_str(&q.amount)
                .map_err(|e| format!("bad amount {}: {e}", q.amount))?,
            price: Amount::from_str(&q.price)
                .map_err(|e| format!("bad price {}: {e}", q.price))?,
        });
    }
    chunk.payment = SingleNodeQuotePayment { quotes };
    chunk.peer_quotes = state
        .peer_quotes
        .iter()
        .map(|pq| (pq.peer.clone(), pq.quote.clone()))
        .collect();
    let mut sidecars = Vec::with_capacity(state.sidecars_hex.len());
    for s in &state.sidecars_hex {
        sidecars.push(hex::decode(s).map_err(|e| format!("bad sidecar hex: {e}"))?);
    }
    chunk.commitment_sidecars = sidecars;
    let mut peers = Vec::with_capacity(state.quoted_peers.len());
    for qp in &state.quoted_peers {
        let pid = PeerId::from_str(&qp.peer_id)
            .map_err(|e| format!("bad peer id {}: {e}", qp.peer_id))?;
        let mut addrs = Vec::with_capacity(qp.addrs.len());
        for a in &qp.addrs {
            addrs.push(MultiAddr::from_str(a).map_err(|e| format!("bad multiaddr {a}: {e}"))?);
        }
        peers.push((pid, addrs));
    }
    chunk.quoted_peers = peers;
    Ok(())
}

// ── app state ───────────────────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    client: Arc<AntClient>,
    // prepared uploads awaiting finalization, keyed by upload_id
    pending: Arc<RwLock<HashMap<String, PreparedUpload>>>,
    state_dir: PathBuf,
    io_lock: Arc<std::sync::Mutex<()>>,
}

impl AppState {
    fn jobs_root(&self) -> PathBuf {
        self.state_dir.join("jobs")
    }
    fn job_path(&self, sha256: &str, upload_id: &str) -> PathBuf {
        self.jobs_root().join(sha256).join(format!("{upload_id}.json"))
    }
    /// every persisted job, read from disk
    fn all_jobs(&self) -> Vec<JobState> {
        let _g = self.io_lock.lock().unwrap();
        let mut out = Vec::new();
        if let Ok(artifacts) = std::fs::read_dir(self.jobs_root()) {
            for a in artifacts.flatten() {
                if let Ok(jobs) = std::fs::read_dir(a.path()) {
                    for j in jobs.flatten() {
                        if let Ok(txt) = std::fs::read_to_string(j.path()) {
                            if let Ok(job) = serde_json::from_str::<JobState>(&txt) {
                                out.push(job);
                            }
                        }
                    }
                }
            }
        }
        out
    }
    fn find_open_job(&self, sha256: &str) -> Option<JobState> {
        self.all_jobs()
            .into_iter()
            .filter(|j| j.artifact_sha256 == sha256 && j.status == "open")
            .max_by_key(|j| j.created_at_unix_secs)
    }
    fn find_job_by_upload_id(&self, upload_id: &str) -> Option<JobState> {
        self.all_jobs().into_iter().find(|j| j.upload_id == upload_id)
    }
    fn write_job(&self, job: &JobState) -> Result<(), String> {
        let _g = self.io_lock.lock().unwrap();
        let path = self.job_path(&job.artifact_sha256, &job.upload_id);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
        }
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_vec_pretty(job).map_err(|e| e.to_string())?)
            .map_err(|e| format!("write {}: {e}", tmp.display()))?;
        std::fs::rename(&tmp, &path).map_err(|e| format!("rename into {}: {e}", path.display()))?;
        Ok(())
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn now_upload_id() -> String {
    format!("up-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis())
}

fn sha256_file(path: &Path) -> Result<(String, u64), String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let mut f = std::fs::File::open(path).map_err(|e| format!("open {}: {e}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut total: u64 = 0;
    loop {
        let n = f.read(&mut buf).map_err(|e| format!("read {}: {e}", path.display()))?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
        total += n as u64;
    }
    Ok((hex::encode(hasher.finalize()), total))
}

// ── API shapes ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct PrepareRequest {
    path: String,
    #[serde(default)]
    force_fresh: bool,
}

#[derive(Serialize)]
struct PaymentEntry {
    quote_hash: String,
    rewards_address: String,
    amount_atto: String,
}

#[derive(Serialize)]
struct MerkleBatchInfo {
    depth: usize,
    candidate_count: usize,
}

#[derive(Serialize)]
struct RecoveryInfo {
    original_upload_id: String,
    original_created_at_unix_secs: u64,
    recovery_count: u32,
    fresh_quotes_discarded: usize,
}

#[derive(Serialize)]
struct PrepareResponse {
    upload_id: String,
    total_chunks: usize,
    already_stored: usize,
    payment_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_amount_atto: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    payments: Option<Vec<PaymentEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    merkle_batches: Option<Vec<MerkleBatchInfo>>,
    data_map_address: Option<String>,
    artifact_sha256: String,
    artifact_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    recovered_from: Option<RecoveryInfo>,
    note: String,
}

#[derive(Deserialize)]
struct FinalizeRequest {
    upload_id: String,
    tx_hashes: HashMap<String, String>,
    #[serde(default)]
    winner_pool_hashes: Vec<String>,
}

#[derive(Serialize)]
struct FinalizeResponse {
    data_map_address: Option<String>,
    chunks_stored: usize,
    total_chunks: usize,
    storage_cost_atto: String,
    gas_cost_wei: u128,
    payment_mode_used: String,
    status: String,
}

#[derive(Serialize)]
struct HealthResponse {
    service: String,
    keyless: bool,
    connected: bool,
    state_dir: String,
    open_jobs: usize,
    note: String,
}

#[derive(Serialize)]
struct JobSummary {
    upload_id: String,
    status: String,
    artifact_sha256: String,
    artifact_bytes: u64,
    payment_type: String,
    total_amount_atto: String,
    data_map_address: Option<String>,
    created_at_unix_secs: u64,
    recovery_count: u32,
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let health = state.client.network_health().await;
    Json(HealthResponse {
        service: "antd-bridge".into(),
        keyless: true,
        connected: health.write_ready,
        state_dir: state.state_dir.display().to_string(),
        open_jobs: state
            .all_jobs()
            .into_iter()
            .filter(|j| j.status == "open")
            .count(),
        note: "keyless prepare; finalize receives signed tx hashes; the payment plan is persisted at prepare and survives bridge death".into(),
    })
}

async fn jobs(State(state): State<AppState>) -> Json<Vec<JobSummary>> {
    Json(
        state
            .all_jobs()
            .into_iter()
            .map(|j| JobSummary {
                upload_id: j.upload_id,
                status: j.status,
                artifact_sha256: j.artifact_sha256,
                artifact_bytes: j.artifact_bytes,
                payment_type: j.payment_type,
                total_amount_atto: j.payment_intent.total_amount.to_string(),
                data_map_address: j.data_map_address,
                created_at_unix_secs: j.created_at_unix_secs,
                recovery_count: j.recovery_count,
            })
            .collect(),
    )
}

async fn prepare(
    State(state): State<AppState>,
    Json(req): Json<PrepareRequest>,
) -> Result<(StatusCode, Json<PrepareResponse>), (StatusCode, String)> {
    let path = PathBuf::from(&req.path);
    if !path.exists() {
        return Err((StatusCode::NOT_FOUND, format!("file not found: {}", req.path)));
    }
    let (artifact_sha, artifact_bytes) =
        sha256_file(&path).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // an explicitly fresh quote voids any open job for this artifact first
    if req.force_fresh {
        if let Some(job) = state.find_open_job(&artifact_sha) {
            let mut voided = job;
            voided.status = "abandoned".into();
            voided.abandoned_reason = Some("superseded by force_fresh re-quote".into());
            state
                .write_job(&voided)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
        }
    }
    let existing = if req.force_fresh { None } else { state.find_open_job(&artifact_sha) };

    // PUBLIC visibility: the DataMap is published as a network chunk so
    // anyone with the address can retrieve the archive (per the founder's
    // ruling: this is a public family edition)
    let mut prepared = state
        .client
        .file_prepare_upload_with_visibility(&path, Visibility::Public)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("prepare failed: {}", e)))?;

    let mut recovered_from: Option<RecoveryInfo> = None;
    // one id for the persisted job, the pending map, and the response — always
    let upload_id = existing
        .as_ref()
        .map(|j| j.upload_id.clone())
        .unwrap_or_else(now_upload_id);

    match &mut prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { prepared_chunks, payment_intent } => {
            if let Some(job) = &existing {
                // ── P1 RECOVERY: swap the fresh quotes out, the persisted plan in ──
                let fresh_addr = prepared
                    .data_map_address
                    .map(|a| format!("0x{}", hex::encode(a)));
                if fresh_addr != job.data_map_address {
                    return Err((StatusCode::CONFLICT, format!(
                        "recovery refused: data_map_address moved ({} ≠ persisted {}) — the artifact bytes differ from the prepared job; use force_fresh",
                        fresh_addr.unwrap_or_default(),
                        job.data_map_address.clone().unwrap_or_default()
                    )));
                }
                let by_addr: HashMap<String, &ChunkState> = job
                    .chunks
                    .iter()
                    .map(|c| (c.address_hex.clone(), c))
                    .collect();
                if prepared_chunks.len() != job.chunks.len() {
                    return Err((StatusCode::CONFLICT, format!(
                        "recovery refused: chunk set changed ({} to pay now vs {} persisted — some chunks may already be stored); use force_fresh for a new plan",
                        prepared_chunks.len(),
                        job.chunks.len()
                    )));
                }
                for chunk in prepared_chunks.iter_mut() {
                    let key = hex::encode(chunk.address);
                    let cs = by_addr.get(&key).ok_or_else(|| {
                        (StatusCode::CONFLICT, format!(
                            "recovery refused: chunk {key} has no persisted payment state; use force_fresh"
                        ))
                    })?;
                    chunk_state_apply(cs, chunk).map_err(|e| (StatusCode::CONFLICT, e))?;
                }
                // the EXACT persisted plan becomes the plan again
                *payment_intent = job.payment_intent.clone();
                // consistency: the re-attached chunk quotes must reproduce the
                // persisted plan exactly — a mismatch here would mean signing
                // for chunks that no longer need payment (or vice versa)
                let mut swapped_nonzero = std::collections::BTreeSet::new();
                for chunk in prepared_chunks.iter() {
                    for q in &chunk.payment.quotes {
                        if !q.amount.is_zero() {
                            swapped_nonzero.insert(format!("0x{}", hex::encode(&q.quote_hash)));
                        }
                    }
                }
                let persisted_nonzero: std::collections::BTreeSet<String> = job
                    .payment_intent
                    .payments
                    .iter()
                    .map(|(qh, _, _)| format!("0x{}", hex::encode(qh)))
                    .collect();
                if swapped_nonzero != persisted_nonzero {
                    return Err((StatusCode::CONFLICT,
                        "recovery refused: re-attached quotes do not reproduce the persisted plan exactly; use force_fresh".into()));
                }
                let fresh_discarded = swapped_nonzero.len();
                let mut updated = job.clone();
                updated.recovery_count += 1;
                updated.last_recovery_unix_secs = Some(now_secs());
                state
                    .write_job(&updated)
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
                recovered_from = Some(RecoveryInfo {
                    original_upload_id: job.upload_id.clone(),
                    original_created_at_unix_secs: job.created_at_unix_secs,
                    recovery_count: updated.recovery_count,
                    fresh_quotes_discarded: fresh_discarded,
                });
            } else {
                // ── fresh prepare: persist the whole payment authorization ──
                let job = JobState {
                    schema: "antd-bridge.job/1".into(),
                    upload_id: upload_id.clone(),
                    status: "open".into(),
                    created_at_unix_secs: now_secs(),
                    artifact_path: req.path.clone(),
                    artifact_sha256: artifact_sha.clone(),
                    artifact_bytes,
                    data_map_address: prepared
                        .data_map_address
                        .map(|a| format!("0x{}", hex::encode(a))),
                    payment_type: "wave_batch".into(),
                    payment_intent: payment_intent.clone(),
                    chunks: prepared_chunks.iter().map(chunk_to_state).collect(),
                    recovery_count: 0,
                    last_recovery_unix_secs: None,
                    finalized_unix_secs: None,
                    abandoned_reason: None,
                };
                state
                    .write_job(&job)
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            }
        }
        ExternalPaymentInfo::Merkle { .. } => {
            // merkle payment: prepare works, but job persistence/recovery is not
            // implemented for this variant (pkg3 rides wave_batch) — honest note
        }
    }

    // capture the response from the (possibly recovered) plan BEFORE the move
    let (payment_type, total_amount, payments, merkle_batches) = match &prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { payment_intent, .. } => {
            let entries = payment_intent.payments.iter().map(|(qh, ra, amt)| PaymentEntry {
                quote_hash: format!("0x{}", hex::encode(qh)),
                rewards_address: format!("{:#x}", ra),
                amount_atto: amt.to_string(),
            }).collect();
            ("wave_batch".to_string(), Some(payment_intent.total_amount.to_string()), Some(entries), None)
        }
        ExternalPaymentInfo::Merkle { prepared_batches, .. } => {
            let batches = prepared_batches.iter().map(|b| MerkleBatchInfo {
                depth: b.depth as usize,
                candidate_count: b.pool_commitments.len(),
            }).collect();
            ("merkle".to_string(), None, None, Some(batches))
        }
    };
    let data_map_addr = prepared
        .data_map_address
        .map(|addr| format!("0x{}", hex::encode(addr)));
    let total_chunks = prepared.total_chunks;
    let already_stored = prepared.already_stored_addresses.len();

    // persist the PreparedUpload for finalize (memory)
    state.pending.write().await.insert(upload_id.clone(), prepared);

    let note = if recovered_from.is_some() {
        "RECOVERED plan — the exact persisted payment authorization (identical quote hashes); fresh quotes were discarded, never exposed".to_string()
    } else {
        "real payment plan from the Autonomi network — no key was used; the plan is persisted and survives bridge death".to_string()
    };

    Ok((StatusCode::OK, Json(PrepareResponse {
        upload_id,
        total_chunks,
        already_stored,
        payment_type,
        total_amount_atto: total_amount,
        payments,
        merkle_batches,
        data_map_address: data_map_addr,
        artifact_sha256: artifact_sha,
        artifact_bytes,
        recovered_from,
        note,
    })))
}

async fn finalize(
    State(state): State<AppState>,
    Json(req): Json<FinalizeRequest>,
) -> Result<(StatusCode, Json<FinalizeResponse>), (StatusCode, String)> {
    let prepared = state.pending.write().await
        .remove(&req.upload_id)
        .ok_or((StatusCode::NOT_FOUND, format!(
            "unknown or expired upload_id: {} — after a bridge restart, re-prepare the same artifact to RECOVER the persisted plan, then finalize",
            req.upload_id
        )))?;

    let expected_kind = match &prepared.payment_info {
        ExternalPaymentInfo::WaveBatch { .. } => "wave_batch",
        ExternalPaymentInfo::Merkle { .. } => "merkle",
    };
    if expected_kind == "merkle" {
        return Err((StatusCode::NOT_IMPLEMENTED,
            "merkle finalize not wired in this bridge build (pkg3 rides wave_batch)".into()));
    }

    // build quote_hash → tx_hash from the UI's signed evidence
    let mut tx_map: HashMap<QuoteHash, TxHash> = HashMap::new();
    for (qh, th) in &req.tx_hashes {
        let q = QuoteHash::from_str(qh.trim())
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("bad quote hash {qh}: {e}")))?;
        let t = TxHash::from_str(th.trim())
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("bad tx hash {th}: {e}")))?;
        tx_map.insert(q, t);
    }

    // pre-check: every non-zero quote of the prepared chunks needs a receipt
    if let ExternalPaymentInfo::WaveBatch { prepared_chunks, .. } = &prepared.payment_info {
        let mut missing = Vec::new();
        for chunk in prepared_chunks {
            for q in &chunk.payment.quotes {
                if !q.amount.is_zero() && !tx_map.contains_key(&q.quote_hash) {
                    missing.push(format!("0x{}", hex::encode(&q.quote_hash)));
                }
            }
        }
        if !missing.is_empty() {
            return Err((StatusCode::BAD_REQUEST, format!(
                "missing tx hashes for {} quote(s): {}",
                missing.len(),
                missing.join(", ")
            )));
        }
    }

    // the REAL finalize — stores the chunks with the externally-signed evidence
    let result = state
        .client
        .finalize_upload(prepared, &tx_map)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("finalize failed: {}", e)))?;

    // bank the outcome against the persisted job
    if let Some(mut job) = state.find_job_by_upload_id(&req.upload_id) {
        job.status = "finalized".into();
        job.finalized_unix_secs = Some(now_secs());
        let _ = state.write_job(&job); // best-effort: the network result is already true
    }

    Ok((StatusCode::OK, Json(FinalizeResponse {
        data_map_address: result
            .data_map_address
            .map(|a| format!("0x{}", hex::encode(a))),
        chunks_stored: result.chunks_stored,
        total_chunks: result.total_chunks,
        storage_cost_atto: result.storage_cost_atto,
        gas_cost_wei: result.gas_cost_wei,
        payment_mode_used: format!("{:?}", result.payment_mode_used),
        status: "finalized".into(),
    })))
}

#[derive(Deserialize)]
struct AbandonRequest { upload_id: String }

#[derive(Serialize)]
struct AbandonResponse { upload_id: String, status: String }

async fn abandon(
    State(state): State<AppState>,
    Json(req): Json<AbandonRequest>,
) -> Result<(StatusCode, Json<AbandonResponse>), (StatusCode, String)> {
    let mut job = state
        .find_job_by_upload_id(&req.upload_id)
        .ok_or((StatusCode::NOT_FOUND, format!("unknown upload_id: {}", req.upload_id)))?;
    if job.status != "open" {
        return Ok((StatusCode::OK, Json(AbandonResponse {
            upload_id: job.upload_id.clone(),
            status: job.status.clone(),
        })));
    }
    job.status = "abandoned".into();
    job.abandoned_reason = Some("voided by request (next prepare quotes fresh)".into());
    state
        .write_job(&job)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    state.pending.write().await.remove(&req.upload_id);
    Ok((StatusCode::OK, Json(AbandonResponse {
        upload_id: job.upload_id,
        status: "abandoned".into(),
    })))
}

fn load_bootstrap_peers() -> Vec<std::net::SocketAddr> {
    let config_path = std::env::var("APPDATA")
        .map(|appdata| PathBuf::from(appdata).join("ant").join("bootstrap_peers.toml"))
        .unwrap_or_else(|_| PathBuf::from(".config/ant/bootstrap_peers.toml"));

    let content = std::fs::read_to_string(&config_path)
        .unwrap_or_else(|_| {
            eprintln!("no bootstrap config at {:?}, using empty", config_path);
            String::new()
        });

    content.lines()
        .filter_map(|l| {
            let l = l.trim();
            if l.starts_with('"') && l.ends_with("\",") || l.ends_with('"') {
                let addr = l.trim_matches(|c| c == '"' || c == ',');
                addr.parse().ok()
            } else { None }
        })
        .collect()
}

#[tokio::main]
async fn main() {
    let peers = load_bootstrap_peers();
    println!("connecting to Autonomi with {} bootstrap peers (keyless)...", peers.len());

    let config = ant_core::data::ClientConfig::default();
    let client = AntClient::connect(&peers, config)
        .await
        .expect("failed to connect to the Autonomi network");

    println!("connected — keyless client ready");

    let state_dir = PathBuf::from(
        std::env::var("ANTD_BRIDGE_STATE").unwrap_or_else(|_| "bridge-state".into()),
    );
    std::fs::create_dir_all(state_dir.join("jobs"))
        .expect("failed to create the bridge state dir");
    println!("payment-plan persistence at {} (survives bridge death)", state_dir.display());

    let state = AppState {
        client: Arc::new(client),
        pending: Arc::new(RwLock::new(HashMap::new())),
        state_dir,
        io_lock: Arc::new(std::sync::Mutex::new(())),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/jobs", get(jobs))
        .route("/v1/upload/prepare", post(prepare))
        .route("/v1/upload/finalize", post(finalize))
        .route("/v1/upload/abandon", post(abandon))
        .with_state(state)
        .layer(CorsLayer::permissive());

    let port: u16 = std::env::args()
        .nth(1)
        .and_then(|p| p.parse().ok())
        .unwrap_or(8795);

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .expect("failed to bind");
    println!("antd-bridge listening on http://127.0.0.1:{} (keyless)", port);
    axum::serve(listener, app).await.unwrap();
}
