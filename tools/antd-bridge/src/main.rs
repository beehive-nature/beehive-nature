// antd-bridge — keyless prepare/finalize HTTP service for the Autonomi network
// Wraps ant-core's external-signer flow. NO wallet key. NO terminal.
//
//   POST /v1/upload/prepare   { "path": "..." }  → real payment plan
//   POST /v1/upload/finalize  { "upload_id": "...", "tx_hashes": {...} }  → data_map + address
//   GET  /health              → status
//
// The PreparedUpload stays in THIS process's memory (per the ant-core docs:
// "only the public fields of payment_info are sent to the frontend"). The UI
// receives the payment structure; the bridge holds the chunks for finalization.

use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use ant_core::data::Client as AntClient;
use ant_core::data::client::file::{PreparedUpload, Visibility};

#[derive(Clone)]
struct AppState {
    client: Arc<AntClient>,
    // prepared uploads awaiting finalization, keyed by generated upload_id
    pending: Arc<RwLock<HashMap<String, PreparedUpload>>>,
}

#[derive(Deserialize)]
struct PrepareRequest { path: String }

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
    note: String,
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
    status: String,
}

#[derive(Serialize)]
struct HealthResponse {
    service: String,
    keyless: bool,
    connected: bool,
    note: String,
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let health = state.client.network_health().await;
    Json(HealthResponse {
        service: "antd-bridge".into(),
        keyless: true,
        connected: health.write_ready,
        note: "keyless prepare; finalize receives signed tx hashes; chunks held in bridge memory".into(),
    })
}

async fn prepare(
    State(state): State<AppState>,
    Json(req): Json<PrepareRequest>,
) -> Result<(StatusCode, Json<PrepareResponse>), (StatusCode, String)> {
    let path = PathBuf::from(&req.path);
    if !path.exists() {
        return Err((StatusCode::NOT_FOUND, format!("file not found: {}", req.path)));
    }

    // PUBLIC visibility: the DataMap is published as a network chunk so
    // anyone with the address can retrieve the archive (per the founder's
    // ruling: this is a public family edition)
    let prepared = state.client
        .file_prepare_upload_with_visibility(&path, Visibility::Public)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("prepare failed: {}", e)))?;

    let upload_id = format!("up-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());

    // extract the serializable payment info per the enum variant
    let (payment_type, total_amount, payments, merkle_batches) = match &prepared.payment_info {
        ant_core::data::client::file::ExternalPaymentInfo::WaveBatch { payment_intent, .. } => {
            let entries = payment_intent.payments.iter().map(|(qh, ra, amt)| PaymentEntry {
                quote_hash: format!("0x{}", hex::encode(qh)),
                rewards_address: format!("0x{}", hex::encode(ra)),
                amount_atto: amt.to_string(),
            }).collect();
            ("wave_batch".to_string(), Some(payment_intent.total_amount.to_string()), Some(entries), None)
        }
        ant_core::data::client::file::ExternalPaymentInfo::Merkle { prepared_batches, .. } => {
            let batches = prepared_batches.iter().map(|b| MerkleBatchInfo {
                depth: b.depth as usize,
                candidate_count: b.pool_commitments.len(),
            }).collect();
            ("merkle".to_string(), None, None, Some(batches))
        }
    };

    let data_map_addr = prepared.data_map_address
        .map(|addr| format!("0x{}", hex::encode(addr)));

    let resp = PrepareResponse {
        upload_id: upload_id.clone(),
        total_chunks: prepared.total_chunks,
        already_stored: prepared.already_stored_addresses.len(),
        payment_type,
        total_amount_atto: total_amount,
        payments,
        merkle_batches,
        data_map_address: data_map_addr,
        note: "real payment plan from the Autonomi network — no key was used".into(),
    };

    // persist the PreparedUpload for finalize
    state.pending.write().await.insert(upload_id, prepared);

    Ok((StatusCode::OK, Json(resp)))
}

async fn finalize(
    State(state): State<AppState>,
    Json(req): Json<FinalizeRequest>,
) -> Result<(StatusCode, Json<FinalizeResponse>), (StatusCode, String)> {
    let prepared = state.pending.write().await
        .remove(&req.upload_id)
        .ok_or((StatusCode::NOT_FOUND, format!("unknown or expired upload_id: {}", req.upload_id)))?;

    let chunks_stored = prepared.total_chunks;

    // TODO: wire the actual finalize call — the signature depends on the payment_type
    // (wave_batch: Client::finalize_upload(upload_id, tx_hashes)
    //  merkle: Client::finalize_upload_merkle_multi(upload_id, winner_pool_hashes))
    //
    // The tx_hashes from the UI map quote_hash → tx_hash for the vault contract.
    // The winner_pool_hashes map merkle batch → winner hash for the merkle contract.

    let data_map_addr = prepared.data_map_address
        .map(|addr| format!("0x{}", hex::encode(addr)));

    Ok((StatusCode::OK, Json(FinalizeResponse {
        data_map_address: data_map_addr,
        chunks_stored,
        status: "finalize wiring in progress — real call pending ant-core API alignment".into(),
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

    let state = AppState {
        client: Arc::new(client),
        pending: Arc::new(RwLock::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/upload/prepare", post(prepare))
        .route("/v1/upload/finalize", post(finalize))
        .with_state(state);

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
