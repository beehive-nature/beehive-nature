//! R1 — model backends as sense adapters (CONSTITUTION Art. III).
//!
//! Faithful port of Python B1 (`model_backend.py`): OpenAI-compatible
//! `/chat/completions` over streaming SSE with quantum-bounded reads, the
//! four-way `BackendDown` taxonomy, and polite in-adapter retries.
//! A backend's outputs are Evidence with provenance `AIInference` — never
//! truth, never authority.

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;

use crate::tools::{parse_tool_blocks, ToolCall};

/// One chat history entry sent to a backend. `tool_call_id` rides only on
/// `tool`-role messages (both backends understand the shape); the harness
/// never puts per-message metadata inside the wire transcript otherwise.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    pub fn user(content: impl Into<String>) -> Self {
        ChatMessage {
            role: "user".into(),
            content: content.into(),
            tool_call_id: None,
        }
    }

    pub fn tool(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
        ChatMessage {
            role: "tool".into(),
            content: content.into(),
            tool_call_id: Some(tool_call_id.into()),
        }
    }
}

/// How a turn ended: natural end or coordinator freeze.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StopReason {
    EndTurn,
    Cancelled,
}

impl StopReason {
    pub fn as_str(self) -> &'static str {
        match self {
            StopReason::EndTurn => "end_turn",
            StopReason::Cancelled => "cancelled",
        }
    }
}

/// A backend's completed turn: text plus the model that produced it.
/// The caller wraps this in Evidence with provenance `AIInference`.
#[derive(Debug, Clone, PartialEq)]
pub struct Turn {
    pub text: String,
    pub tool_calls: Vec<ToolCall>,
    pub stop_reason: StopReason,
    pub usage: serde_json::Value,
}

/// Failover-eligible failure reasons (Python `FAILOVER_REASONS`):
/// transport, server_5xx, rate_limit. `auth` is fatal, never failover.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailoverReason {
    Transport,
    Server5xx,
    RateLimit,
}

impl FailoverReason {
    pub fn as_str(self) -> &'static str {
        match self {
            FailoverReason::Transport => "transport",
            FailoverReason::Server5xx => "server_5xx",
            FailoverReason::RateLimit => "rate_limit",
        }
    }

    /// Worth one polite in-adapter retry (Python `RETRY_REASONS`).
    /// Rate limiting is NOT retried: provider exhaustion is the
    /// sovereignty case — fail over, don't wait.
    pub fn retryable(self) -> bool {
        matches!(self, FailoverReason::Transport | FailoverReason::Server5xx)
    }
}

/// Backend failure taxonomy (Python `BackendDown`):
///
/// - `Unavailable`: failover-eligible with a classified reason, plus any
///   partial assistant text accumulated before the failure — the FREEZE
///   step never silently drops tokens.
/// - `Fatal`: switching backends cannot fix this (bad key, bad request).
///   Abort, don't fail over.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BackendError {
    Unavailable {
        reason: FailoverReason,
        detail: String,
        partial: String,
    },
    Fatal {
        reason: String,
    },
}

impl BackendError {
    /// Map an HTTP status to the taxonomy: 429 is failover-eligible by
    /// design; 401/403 is a config error (same key on every backend, so
    /// switching cannot fix it); anything else unexpected is the
    /// provider's problem — fail over.
    pub fn from_status(status: u16) -> Self {
        match status {
            401 | 403 => BackendError::Fatal {
                reason: format!("auth: HTTP {status}"),
            },
            429 => BackendError::Unavailable {
                reason: FailoverReason::RateLimit,
                detail: format!("HTTP {status}"),
                partial: String::new(),
            },
            _ => BackendError::Unavailable {
                reason: FailoverReason::Server5xx,
                detail: format!("HTTP {status}"),
                partial: String::new(),
            },
        }
    }

    /// Transport failures (refused, timeout, reset, stall) are always
    /// failover: they say nothing about the request's validity.
    /// `status` mirrors `requests`-style errors that already carry one.
    pub fn from_transport(detail: String) -> Self {
        BackendError::Unavailable {
            reason: FailoverReason::Transport,
            detail,
            partial: String::new(),
        }
    }

    pub fn is_failover(&self) -> bool {
        matches!(self, BackendError::Unavailable { .. })
    }

    pub fn failover_reason(&self) -> Option<FailoverReason> {
        match self {
            BackendError::Unavailable { reason, .. } => Some(*reason),
            BackendError::Fatal { .. } => None,
        }
    }

    pub fn with_partial(mut self, partial: String) -> Self {
        if let BackendError::Unavailable { partial: slot, .. } = &mut self {
            *slot = partial;
        }
        self
    }

    /// Stamp a terminal failure with the call's elapsed time and attempt
    /// count, so tests and receipts record the classification and the
    /// bounds it met.
    pub fn with_elapsed(self, elapsed: Duration, attempts: u32) -> Self {
        let millis = elapsed.as_millis();
        match self {
            BackendError::Unavailable {
                reason,
                detail,
                partial,
            } => BackendError::Unavailable {
                reason,
                detail: format!("{detail} elapsed_ms={millis} attempts={attempts}"),
                partial,
            },
            fatal => fatal,
        }
    }

    /// Assistant text accumulated before the failure (empty for fatal).
    pub fn partial_text(&self) -> &str {
        match self {
            BackendError::Unavailable { partial, .. } => partial,
            BackendError::Fatal { .. } => "",
        }
    }
}

/// How a backend proves who pays: bearer keys arrive via env at
/// runtime and are never printed, committed, or pasted (estate law).
/// `None` is the loopback/local route only — it never stands in for a
/// remote provider whose credential is missing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthMode {
    BearerEnv,
    None,
}

impl AuthMode {
    pub fn as_str(self) -> &'static str {
        match self {
            AuthMode::BearerEnv => "bearer_env",
            AuthMode::None => "none",
        }
    }
}

/// Which replaceable provider a config addresses. Provider differences
/// are configuration, not code: both variants speak the same
/// OpenAI-compatible `/chat/completions` SSE shape.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderKind {
    OpenAiCompat,
    LocalPool,
}

impl ProviderKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ProviderKind::OpenAiCompat => "openai_compat",
            ProviderKind::LocalPool => "local_pool",
        }
    }
}

/// Bounded network budgets every backend honors. All time bounds are
/// milliseconds; zero means unbounded and is rejected by validation —
/// a backend without bounds can wedge the coordinator.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NetworkBudgets {
    /// TCP connect timeout per attempt.
    pub connect_timeout_ms: u64,
    /// Time to response headers per attempt (stalled connection/headers).
    pub header_timeout_ms: u64,
    /// Idle time between stream chunks (stalled stream quantum).
    pub stream_idle_timeout_ms: u64,
    /// Cap on accumulated assistant text bytes (output-size bound).
    pub max_output_bytes: usize,
    /// Cap on concurrent in-flight turns (queued-work bound).
    pub max_inflight: usize,
}

impl Default for NetworkBudgets {
    fn default() -> Self {
        NetworkBudgets {
            connect_timeout_ms: 3_000,
            header_timeout_ms: 5_000,
            stream_idle_timeout_ms: 2_000,
            max_output_bytes: 262_144,
            max_inflight: 4,
        }
    }
}

/// Bounded retry budgets. Only transport/server_5xx failures retry
/// (see [`FailoverReason::retryable`]); rate limiting fails over
/// immediately — provider exhaustion is the sovereignty case.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RetryBudgets {
    pub max_retries: u32,
    pub base_delay_ms: u64,
}

impl Default for RetryBudgets {
    fn default() -> Self {
        RetryBudgets {
            max_retries: 2,
            base_delay_ms: 500,
        }
    }
}

/// A rejected backend configuration: naming, endpoint, credential
/// wiring, auth mode, or a budget that would leave a call unbounded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvalidConfig {
    pub reason: String,
}

impl std::fmt::Display for InvalidConfig {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "invalid backend config: {}", self.reason)
    }
}

impl std::error::Error for InvalidConfig {}

/// One bootstrap requirement behind a [`BackendConfig`]: `kind` is
/// `endpoint` (must be reachable), `credential_env` (must be set for
/// bearer auth), or `payer` (attempts are attributed here when set).
/// References are identifiers and URLs only — never secret material.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BootstrapDependency {
    pub kind: &'static str,
    pub reference: String,
}

/// Explicit backend configuration: endpoint, model, credential-variable
/// reference, authentication mode, provider kind, and bounded
/// network/retry budgets. This is the record Wonder integrates into
/// `main`: build each configured backend with [`build_backend`], run
/// [`preflight`] over the pair before the demo, and never substitute a
/// local route for a remote backend whose credential is missing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackendConfig {
    pub name: String,
    pub endpoint: String,
    pub model: String,
    pub credential_var: Option<String>,
    pub auth: AuthMode,
    pub provider: ProviderKind,
    pub network: NetworkBudgets,
    pub retry: RetryBudgets,
    /// Payer identifier every attempt and retry is attributed to (a
    /// subscription or budget label — never a secret). `None` means no
    /// funded payer is configured: the backend still answers loopback
    /// and runs offline tests, but live provider calls stay gated until
    /// a payer is set and verified out of band. The identifier alone
    /// never authorizes spending — it only labels whose bounded,
    /// pre-verified budget an attempt draws from.
    pub payer: Option<String>,
}

impl BackendConfig {
    /// Reject anything that would run unbounded or misattribute cost:
    /// empty names/endpoints/models, non-HTTP endpoints, bearer auth
    /// without a credential variable (or a credential variable on a
    /// no-auth route), and any zero network budget.
    pub fn validate(&self) -> Result<(), InvalidConfig> {
        let bad = |why: &str| InvalidConfig {
            reason: why.to_string(),
        };
        if self.name.trim().is_empty() {
            return Err(bad("name is empty"));
        }
        if self.endpoint.trim().is_empty() {
            return Err(bad("endpoint is empty"));
        }
        if !(self.endpoint.starts_with("http://") || self.endpoint.starts_with("https://")) {
            return Err(bad("endpoint must start with http:// or https://"));
        }
        if self.model.trim().is_empty() {
            return Err(bad("model is empty"));
        }
        match (self.auth, &self.credential_var) {
            (AuthMode::BearerEnv, None) => {
                return Err(bad("bearer auth requires a credential variable"));
            }
            (AuthMode::BearerEnv, Some(var)) if var.trim().is_empty() => {
                return Err(bad("credential variable is empty"));
            }
            (AuthMode::None, Some(_)) => {
                return Err(bad("no-auth route must not carry a credential variable"));
            }
            _ => {}
        }
        if self.network.connect_timeout_ms == 0 {
            return Err(bad("connect timeout is unbounded"));
        }
        if self.network.header_timeout_ms == 0 {
            return Err(bad("header timeout is unbounded"));
        }
        if self.network.stream_idle_timeout_ms == 0 {
            return Err(bad("stream idle timeout is unbounded"));
        }
        if self.network.max_output_bytes == 0 {
            return Err(bad("output budget is zero"));
        }
        if self.network.max_inflight == 0 {
            return Err(bad("in-flight bound is zero"));
        }
        if self
            .payer
            .as_deref()
            .is_some_and(|payer| payer.trim().is_empty())
        {
            return Err(bad("payer identifier is empty"));
        }
        Ok(())
    }

    fn remote(name: &str, model: &str, endpoint: &str, credential_var: &str) -> Self {
        BackendConfig {
            name: name.to_string(),
            endpoint: endpoint.to_string(),
            model: model.to_string(),
            credential_var: Some(credential_var.to_string()),
            auth: AuthMode::BearerEnv,
            provider: ProviderKind::OpenAiCompat,
            network: NetworkBudgets::default(),
            retry: RetryBudgets::default(),
            payer: None,
        }
    }

    /// Actual bootstrap dependencies of this config, in build order:
    /// first the endpoint that must be reachable, then the credential
    /// variable that must be set (bearer only), then the payer the
    /// attempts are attributed to (when one is configured). This is the
    /// record the qualification lane keeps: real providers and real
    /// bootstrap requirements, no implied funding.
    pub fn dependencies(&self) -> Vec<BootstrapDependency> {
        let mut deps = vec![BootstrapDependency {
            kind: "endpoint",
            reference: self.endpoint.clone(),
        }];
        if let Some(var) = &self.credential_var {
            deps.push(BootstrapDependency {
                kind: "credential_env",
                reference: var.clone(),
            });
        }
        if let Some(payer) = &self.payer {
            deps.push(BootstrapDependency {
                kind: "payer",
                reference: payer.clone(),
            });
        }
        deps
    }

    /// Tested example: Meta primary (`muse-spark-1.3`), as wired in `main`.
    pub fn spark_primary() -> Self {
        Self::remote(
            "spark-primary",
            "muse-spark-1.3",
            "https://api.meta.ai/v1",
            "MODEL_API_KEY",
        )
    }

    /// Tested example: Together secondary, as wired in `main`.
    pub fn openweights_secondary() -> Self {
        Self::remote(
            "openweights-secondary",
            "meta-models/Muse-Spark-Open-816B-A42B",
            "https://api.together.xyz/v1",
            "TOGETHER_API_KEY",
        )
    }

    /// Tested example: Meta tertiary (`muse-spark-1.1`), as wired in `main`.
    pub fn spark_11_tertiary() -> Self {
        Self::remote(
            "spark-11-tertiary",
            "muse-spark-1.1",
            "https://api.meta.ai/v1",
            "MODEL_API_KEY",
        )
    }

    /// Tested example: the replaceable local/pool route. No credential
    /// variable by construction — loopback only, never a fallback for a
    /// remote backend with missing credentials.
    pub fn local_pool(name: &str, endpoint: &str, model: &str) -> Self {
        BackendConfig {
            name: name.to_string(),
            endpoint: endpoint.to_string(),
            model: model.to_string(),
            credential_var: None,
            auth: AuthMode::None,
            provider: ProviderKind::LocalPool,
            network: NetworkBudgets::default(),
            retry: RetryBudgets::default(),
            payer: None,
        }
    }
}

/// Callable integration point for `main` (Wonder-owned): validate a
/// [`BackendConfig`] and hand back a boxed sense adapter. A config whose
/// credential variable is unset still builds — the missing credential
/// surfaces at call time as [`BackendError::Fatal`] (and `health`
/// returns false), never as a silent switch to another provider.
pub fn build_backend(config: BackendConfig) -> Result<Arc<dyn ModelBackend>, InvalidConfig> {
    Ok(Arc::new(OpenAiCompatBackend::from_config(&config)?))
}

/// One backend's preflight line: liveness plus the milliseconds the
/// probe took. `healthy == false` covers unreachable, unauthorized,
/// and missing-credential backends alike — a missing credential is
/// never reported healthy.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreflightEntry {
    pub name: String,
    pub healthy: bool,
    pub elapsed_ms: u64,
}

/// The preflight verdict over a backend pair (or triple).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreflightReport {
    pub entries: Vec<PreflightEntry>,
    pub elapsed_ms: u64,
}

impl PreflightReport {
    pub fn any_healthy(&self) -> bool {
        self.entries.iter().any(|entry| entry.healthy)
    }

    pub fn all_healthy(&self) -> bool {
        !self.entries.is_empty() && self.entries.iter().all(|entry| entry.healthy)
    }
}

/// Minimal two-backend preflight procedure (Wonder calls this from
/// `main` before the demo):
///
/// 1. Build one backend per [`BackendConfig`] with [`build_backend`].
/// 2. `await preflight(&backends, per_backend_timeout_ms)` — each
///    `health()` probe is bounded by `per_backend_timeout_ms`, so the
///    whole procedure finishes within roughly that bound times the
///    number of backends.
/// 3. Require `report.any_healthy()` before starting; log every entry
///    (name, healthy, elapsed_ms). A remote backend with a missing
///    credential reports `healthy: false` — top it up or fix the env
///    wiring, do not count the local route as its replacement.
///
/// No traffic leaves loopback here unless a config points at a remote
/// endpoint; live provider smoke calls additionally require authorized
/// credentials and a verified payer/budget, which this function does
/// not assert — it only reports reachability.
pub async fn preflight(
    backends: &[Arc<dyn ModelBackend>],
    per_backend_timeout_ms: u64,
) -> PreflightReport {
    let started = std::time::Instant::now();
    let bound = Duration::from_millis(per_backend_timeout_ms.max(1));
    let mut entries = Vec::with_capacity(backends.len());
    for backend in backends {
        let probe_started = std::time::Instant::now();
        let healthy = tokio::time::timeout(bound, backend.health())
            .await
            .unwrap_or(false);
        entries.push(PreflightEntry {
            name: backend.name().to_string(),
            healthy,
            elapsed_ms: probe_started.elapsed().as_millis() as u64,
        });
    }
    PreflightReport {
        entries,
        elapsed_ms: started.elapsed().as_millis() as u64,
    }
}

/// A model backend: a sense adapter behind an OpenAI-compatible
/// `/chat/completions` endpoint. Provider differences (Meta vs Together)
/// are configuration, not code — provider-native function calling stays
/// out by the harness-owned tool protocol. Keys arrive via env at
/// runtime and are never printed, committed, or pasted (estate law).
#[async_trait]
pub trait ModelBackend: Send + Sync {
    fn name(&self) -> &str;
    fn model_id(&self) -> &str;

    /// One chat turn (streaming, like the Python default). Raises a
    /// classified error after polite retries; honors `cancel` between
    /// socket quanta and keeps partial text on freeze.
    async fn complete(
        &self,
        messages: &[ChatMessage],
        cancel: CancellationToken,
    ) -> Result<Turn, BackendError>;

    /// Cheap liveness probe (GET `{base}/models`): the switch
    /// coordinator's prober input.
    async fn health(&self) -> bool;
}

/// One struct, three configs (spec §4 table): Meta primary
/// (`muse-spark-1.3`), Together secondary
/// (`meta-models/Muse-Spark-Open-816B-A42B`), Meta tertiary
/// (`muse-spark-1.1`).
pub struct OpenAiCompatBackend {
    name: String,
    model_id: String,
    base_url: String,
    api_key_env: Option<String>,
    auth: AuthMode,
    provider: ProviderKind,
    network: NetworkBudgets,
    retry: RetryBudgets,
    payer: Option<String>,
    client: reqwest::Client,
    inflight: Arc<Semaphore>,
}

impl OpenAiCompatBackend {
    /// Legacy constructor (kept for `main` and existing callers):
    /// bearer auth against `api_key_env` with default bounded budgets.
    pub fn new(
        name: impl Into<String>,
        model_id: impl Into<String>,
        base_url: impl Into<String>,
        api_key_env: impl Into<String>,
    ) -> Self {
        let var = api_key_env.into();
        let backend = OpenAiCompatBackend {
            name: name.into(),
            model_id: model_id.into(),
            base_url: base_url.into(),
            api_key_env: Some(var),
            auth: AuthMode::BearerEnv,
            provider: ProviderKind::OpenAiCompat,
            network: NetworkBudgets::default(),
            retry: RetryBudgets::default(),
            payer: None,
            client: reqwest::Client::builder()
                .connect_timeout(Duration::from_millis(
                    NetworkBudgets::default().connect_timeout_ms,
                ))
                .build()
                .expect("default reqwest client builds"),
            inflight: Arc::new(Semaphore::new(NetworkBudgets::default().max_inflight)),
        };
        debug_assert!(backend.config().validate().is_ok());
        backend
    }

    /// Build from an explicit [`BackendConfig`]: validates endpoint,
    /// model, credential wiring, auth mode, and every bound. A valid
    /// config with an unset credential variable still builds — the
    /// missing credential fails at call time as fatal, never as a
    /// fallback to another provider.
    pub fn from_config(config: &BackendConfig) -> Result<Self, InvalidConfig> {
        config.validate()?;
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_millis(config.network.connect_timeout_ms))
            .build()
            .map_err(|error| InvalidConfig {
                reason: format!("http client: {error}"),
            })?;
        Ok(OpenAiCompatBackend {
            name: config.name.clone(),
            model_id: config.model.clone(),
            base_url: config.endpoint.clone(),
            api_key_env: config.credential_var.clone(),
            auth: config.auth,
            provider: config.provider,
            network: config.network,
            retry: config.retry,
            payer: config.payer.clone(),
            client,
            inflight: Arc::new(Semaphore::new(config.network.max_inflight)),
        })
    }

    /// Round-trip the running backend back to its explicit config.
    pub fn config(&self) -> BackendConfig {
        BackendConfig {
            name: self.name.clone(),
            endpoint: self.base_url.clone(),
            model: self.model_id.clone(),
            credential_var: self.api_key_env.clone(),
            auth: self.auth,
            provider: self.provider,
            network: self.network,
            retry: self.retry,
            payer: self.payer.clone(),
        }
    }

    pub fn provider_kind(&self) -> ProviderKind {
        self.provider
    }

    pub fn auth_mode(&self) -> AuthMode {
        self.auth
    }

    fn api_key(&self) -> Result<String, BackendError> {
        match &self.api_key_env {
            Some(var) => std::env::var(var).map_err(|_| BackendError::Fatal {
                reason: format!("auth: env {var} is unset"),
            }),
            None => Ok(String::new()),
        }
    }

    /// The bearer credential for this call, if the auth mode needs one.
    /// `AuthMode::None` (local/pool) sends no authorization header;
    /// `AuthMode::BearerEnv` with an unset variable is fatal — the
    /// backend reports itself down, it never borrows another route.
    fn bearer_key(&self) -> Result<Option<String>, BackendError> {
        match self.auth {
            AuthMode::None => Ok(None),
            AuthMode::BearerEnv => self.api_key().map(Some),
        }
    }
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    stream: bool,
}

#[derive(Deserialize, Default)]
struct ChatResponse {
    #[serde(default)]
    choices: Vec<ChatChoice>,
    #[serde(default)]
    usage: serde_json::Value,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Deserialize)]
struct ChatResponseMessage {
    #[serde(default)]
    content: Option<String>,
}

#[async_trait]
impl ModelBackend for OpenAiCompatBackend {
    fn name(&self) -> &str {
        &self.name
    }

    fn model_id(&self) -> &str {
        &self.model_id
    }

    async fn complete(
        &self,
        messages: &[ChatMessage],
        cancel: CancellationToken,
    ) -> Result<Turn, BackendError> {
        self.complete_with_report(messages, cancel).await.0
    }

    async fn health(&self) -> bool {
        let key = match self.bearer_key() {
            Ok(key) => key,
            Err(_) => return false,
        };
        let url = format!("{}/models", self.base_url.trim_end_matches('/'));
        let mut request = self.client.get(&url);
        if let Some(token) = key {
            request = request.bearer_auth(token);
        }
        let bound = Duration::from_millis(self.network.header_timeout_ms);
        match tokio::time::timeout(bound, request.send()).await {
            Ok(Ok(response)) => response.status().is_success(),
            _ => false,
        }
    }
}

/// Payer-attributed accounting for one `complete()` call: every attempt
/// and polite retry is counted against the configured payer, with the
/// terminal classification. Each retry is a potentially billable attempt
/// under the ORIGINAL bounded authorization — retries spend from the
/// same pre-verified budget, they never open a new one, and they never
/// authorize repeating an uncertain external effect or payment. The
/// harness keeps that rule by never executing orphaned tool calls
/// (switch-owned); this report only proves what the backend attempted.
/// `usage` carries the provider-reported usage on success and stays
/// explicitly unknown (`Null`) otherwise: uncertain usage after
/// transmission is preserved as-is, never reconstructed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttemptReport {
    pub backend: String,
    pub payer: Option<String>,
    pub attempts: u32,
    pub retries: u32,
    pub classification: Option<FailoverReason>,
    pub fatal: bool,
    pub cancelled: bool,
    pub elapsed_ms: u64,
    pub usage: serde_json::Value,
}

/// One backend health sample for the monitor loop.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HealthEvent {
    pub name: String,
    pub healthy: bool,
    /// True only on a transition since the previous sample.
    pub changed: bool,
    pub elapsed_ms: u64,
}

/// Current-backend health monitoring (Wonder wires this into `main`
/// beside the switch prober): poll every backend's `health()` each
/// `interval`, forwarding one [`HealthEvent`] per backend per round
/// until `cancel` fires or the receiver drops. A zero `interval` takes
/// exactly one round and returns. Each probe is already bounded by the
/// backend's own header timeout, so a round can never wedge.
pub async fn monitor_health(
    backends: Vec<Arc<dyn ModelBackend>>,
    interval: Duration,
    cancel: CancellationToken,
    tx: tokio::sync::mpsc::Sender<HealthEvent>,
) {
    use std::collections::HashMap;
    let mut last: HashMap<String, bool> = HashMap::new();
    loop {
        for backend in &backends {
            if cancel.is_cancelled() {
                return;
            }
            let started = std::time::Instant::now();
            let healthy = backend.health().await;
            let name = backend.name().to_string();
            let changed = last.get(&name).is_some_and(|&was| was != healthy);
            last.insert(name.clone(), healthy);
            let event = HealthEvent {
                name,
                healthy,
                changed,
                elapsed_ms: started.elapsed().as_millis() as u64,
            };
            if tx.send(event).await.is_err() {
                return;
            }
        }
        if interval.is_zero() {
            return;
        }
        if tokio::time::timeout(interval, cancel.cancelled())
            .await
            .is_ok()
        {
            return;
        }
    }
}

impl OpenAiCompatBackend {
    /// One chat turn plus its payer-attributed [`AttemptReport`]. Retry
    /// semantics match the trait method exactly; the report counts every
    /// attempt and retry against `config.payer` for the qualification
    /// record.
    pub async fn complete_with_report(
        &self,
        messages: &[ChatMessage],
        cancel: CancellationToken,
    ) -> (Result<Turn, BackendError>, AttemptReport) {
        let started = std::time::Instant::now();
        let mut report = AttemptReport {
            backend: self.name.clone(),
            payer: self.payer.clone(),
            attempts: 0,
            retries: 0,
            classification: None,
            fatal: false,
            cancelled: false,
            elapsed_ms: 0,
            usage: serde_json::Value::Null,
        };
        let finish = |result: Result<Turn, BackendError>, mut report: AttemptReport| {
            report.elapsed_ms = started.elapsed().as_millis() as u64;
            (result, report)
        };
        if cancel.is_cancelled() {
            report.cancelled = true;
            return finish(
                Ok(Turn {
                    text: String::new(),
                    tool_calls: Vec::new(),
                    stop_reason: StopReason::Cancelled,
                    usage: serde_json::Value::Null,
                }),
                report,
            );
        }
        // Queued-work bound: never stack more than max_inflight turns on
        // one backend. The permit is held across polite retries, so a
        // retry storm cannot smuggle extra queue past the bound.
        let _permit = match self.inflight.clone().try_acquire_owned() {
            Ok(permit) => permit,
            Err(_) => {
                report.classification = Some(FailoverReason::Transport);
                let error = BackendError::from_transport(format!(
                    "queue full (max_inflight={})",
                    self.network.max_inflight
                ))
                .with_elapsed(started.elapsed(), report.attempts);
                return finish(Err(error), report);
            }
        };
        loop {
            report.attempts += 1;
            report.retries = report.attempts.saturating_sub(1);
            match self.complete_once(messages, &cancel).await {
                Ok(turn) => {
                    report.cancelled = turn.stop_reason == StopReason::Cancelled;
                    report.usage = turn.usage.clone();
                    return finish(Ok(turn), report);
                }
                Err(error) => {
                    let retry = error
                        .failover_reason()
                        .is_some_and(|reason| reason.retryable())
                        && report.retries < self.retry.max_retries;
                    if !retry {
                        report.classification = error.failover_reason();
                        report.fatal = matches!(error, BackendError::Fatal { .. });
                        let attempts = report.attempts;
                        let error = error.with_elapsed(started.elapsed(), attempts);
                        return finish(Err(error), report);
                    }
                    let backoff = Duration::from_millis(
                        self.retry
                            .base_delay_ms
                            .saturating_mul(report.attempts as u64),
                    );
                    // A cancelled backoff ends the turn, keeping whatever
                    // partial text the failed attempt preserved.
                    if tokio::time::timeout(backoff, cancel.cancelled())
                        .await
                        .is_ok()
                    {
                        let text = error.partial_text().to_string();
                        report.cancelled = true;
                        report.classification = error.failover_reason();
                        return finish(
                            Ok(Turn {
                                tool_calls: parse_tool_blocks(&text),
                                text,
                                stop_reason: StopReason::Cancelled,
                                usage: serde_json::Value::Null,
                            }),
                            report,
                        );
                    }
                }
            }
        }
    }

    async fn complete_once(
        &self,
        messages: &[ChatMessage],
        cancel: &CancellationToken,
    ) -> Result<Turn, BackendError> {
        let key = self.bearer_key()?;
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let body = ChatRequest {
            model: &self.model_id,
            messages,
            stream: true,
        };
        // Connection/header bound: a backend that accepts the socket but
        // never answers headers fails here, inside the configured budget.
        let header_bound = Duration::from_millis(self.network.header_timeout_ms);
        let mut request = self
            .client
            .post(&url)
            .header("Accept", "text/event-stream")
            .json(&body);
        if let Some(token) = key {
            request = request.bearer_auth(token);
        }
        let response = match tokio::time::timeout(header_bound, request.send()).await {
            Err(_) => {
                return Err(BackendError::from_transport(format!(
                    "headers stall beyond {}ms",
                    self.network.header_timeout_ms
                )));
            }
            Ok(Err(e)) => return Err(BackendError::from_transport(e.to_string())),
            Ok(Ok(response)) => response,
        };
        let status = response.status().as_u16();
        if !response.status().is_success() {
            return Err(BackendError::from_status(status));
        }

        // Streaming: bounded quanta — each chunk gets stream_idle_timeout
        // and cancel is checked between reads, so a dead backend can
        // never wedge the loop. Partial text is kept for FREEZE. The
        // output-size bound caps both decoded text and the raw line
        // buffer, so a flooding backend fails closed instead of growing
        // memory without limit.
        let mut chunks: Vec<String> = Vec::new();
        let mut produced: usize = 0;
        let mut usage = serde_json::Value::Null;
        let mut buffer = String::new();
        let cap = self.network.max_output_bytes;
        let quantum = Duration::from_millis(self.network.stream_idle_timeout_ms);
        let mut stream = response.bytes_stream();
        loop {
            if cancel.is_cancelled() {
                let text = chunks.concat();
                return Ok(Turn {
                    tool_calls: parse_tool_blocks(&text),
                    text,
                    stop_reason: StopReason::Cancelled,
                    usage,
                });
            }
            let next =
                tokio::time::timeout(quantum, futures_util::StreamExt::next(&mut stream)).await;
            let bytes = match next {
                Err(_) => {
                    return Err(BackendError::from_transport(
                        "stream stall beyond quantum".to_string(),
                    )
                    .with_partial(chunks.concat()));
                }
                Ok(None) => break,
                Ok(Some(Err(e))) => {
                    return Err(
                        BackendError::from_transport(e.to_string()).with_partial(chunks.concat())
                    );
                }
                Ok(Some(Ok(bytes))) => bytes,
            };
            buffer.push_str(&String::from_utf8_lossy(&bytes));
            if buffer.len() > cap.saturating_add(8_192) {
                return Err(BackendError::from_transport(format!(
                    "output budget exceeded (max_output_bytes={cap})"
                ))
                .with_partial(chunks.concat()));
            }
            while let Some(end) = buffer.find('\n') {
                let raw: String = buffer.drain(..=end).collect();
                let line = raw.trim_end_matches(['\r', '\n']);
                if line.is_empty() || !line.starts_with("data:") {
                    continue;
                }
                let data = line["data:".len()..].trim();
                if data == "[DONE]" {
                    break;
                }
                let Ok(obj) = serde_json::from_str::<serde_json::Value>(data) else {
                    continue; // keep-alive comments / partial garbage
                };
                if obj.get("usage").is_some() {
                    usage = obj["usage"].clone();
                }
                if let Some(piece) = obj
                    .get("choices")
                    .and_then(|choices| choices.get(0))
                    .and_then(|choice| choice.get("delta"))
                    .and_then(|delta| delta.get("content"))
                    .and_then(|content| content.as_str())
                {
                    if produced.saturating_add(piece.len()) > cap {
                        return Err(BackendError::from_transport(format!(
                            "output budget exceeded (max_output_bytes={cap})"
                        ))
                        .with_partial(chunks.concat()));
                    }
                    produced += piece.len();
                    chunks.push(piece.to_string());
                }
            }
            if buffer.contains("[DONE]") {
                break;
            }
        }
        let text = chunks.concat();
        Ok(Turn {
            tool_calls: parse_tool_blocks(&text),
            text,
            stop_reason: StopReason::EndTurn,
            usage,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_limit_is_failover_not_retried() {
        let error = BackendError::from_status(429);
        assert!(error.is_failover());
        assert_eq!(error.failover_reason(), Some(FailoverReason::RateLimit));
        assert!(!FailoverReason::RateLimit.retryable());
    }

    #[test]
    fn server_errors_are_failover_and_retried() {
        for status in [500, 502, 503, 504, 418, 400] {
            let error = BackendError::from_status(status);
            assert!(error.is_failover(), "HTTP {status} must fail over");
            assert_eq!(
                error.failover_reason(),
                Some(FailoverReason::Server5xx),
                "HTTP {status} buckets as server_5xx"
            );
        }
        assert!(FailoverReason::Server5xx.retryable());
        assert!(FailoverReason::Transport.retryable());
    }

    #[test]
    fn auth_is_fatal_never_failover() {
        for status in [401, 403] {
            let error = BackendError::from_status(status);
            assert!(!error.is_failover(), "HTTP {status} must abort");
            assert_eq!(error.failover_reason(), None);
        }
    }

    #[test]
    fn missing_key_env_is_fatal_not_failover() {
        let backend = OpenAiCompatBackend::new(
            "probe-only",
            "muse-spark-1.3",
            "https://api.meta.ai/v1",
            "HARNESS_SOVEREIGN_TEST_MISSING_KEY_XYZ",
        );
        assert!(matches!(backend.api_key(), Err(BackendError::Fatal { .. })));
    }

    #[test]
    fn stop_reason_spells_match_python() {
        assert_eq!(StopReason::EndTurn.as_str(), "end_turn");
        assert_eq!(StopReason::Cancelled.as_str(), "cancelled");
    }

    #[test]
    fn failover_reason_spells_match_python() {
        assert_eq!(FailoverReason::Transport.as_str(), "transport");
        assert_eq!(FailoverReason::Server5xx.as_str(), "server_5xx");
        assert_eq!(FailoverReason::RateLimit.as_str(), "rate_limit");
    }

    #[test]
    fn example_configs_match_main_wiring() {
        let primary = BackendConfig::spark_primary();
        assert_eq!(primary.name, "spark-primary");
        assert_eq!(primary.model, "muse-spark-1.3");
        assert_eq!(primary.endpoint, "https://api.meta.ai/v1");
        assert_eq!(primary.credential_var.as_deref(), Some("MODEL_API_KEY"));
        assert_eq!(primary.auth, AuthMode::BearerEnv);
        assert_eq!(primary.provider, ProviderKind::OpenAiCompat);
        assert!(primary.validate().is_ok());

        let secondary = BackendConfig::openweights_secondary();
        assert_eq!(secondary.model, "meta-models/Muse-Spark-Open-816B-A42B");
        assert_eq!(secondary.endpoint, "https://api.together.xyz/v1");
        assert_eq!(
            secondary.credential_var.as_deref(),
            Some("TOGETHER_API_KEY")
        );
        assert!(secondary.validate().is_ok());

        let tertiary = BackendConfig::spark_11_tertiary();
        assert_eq!(tertiary.model, "muse-spark-1.1");
        assert_eq!(tertiary.credential_var.as_deref(), Some("MODEL_API_KEY"));
        assert!(tertiary.validate().is_ok());

        let local =
            BackendConfig::local_pool("pool-local", "http://127.0.0.1:11434/v1", "pool-model");
        assert_eq!(local.credential_var, None);
        assert_eq!(local.auth, AuthMode::None);
        assert_eq!(local.provider, ProviderKind::LocalPool);
        assert_eq!(local.payer, None);
        assert!(local.validate().is_ok());
    }

    #[test]
    fn dependencies_record_endpoint_credential_and_payer() {
        let primary = BackendConfig::spark_primary();
        let deps = primary.dependencies();
        assert_eq!(deps.len(), 2);
        assert_eq!(deps[0].kind, "endpoint");
        assert_eq!(deps[0].reference, "https://api.meta.ai/v1");
        assert_eq!(deps[1].kind, "credential_env");
        assert_eq!(deps[1].reference, "MODEL_API_KEY");

        let local =
            BackendConfig::local_pool("pool-local", "http://127.0.0.1:11434/v1", "pool-model");
        let deps = local.dependencies();
        assert_eq!(deps.len(), 1);
        assert_eq!(deps[0].kind, "endpoint");

        let mut funded = BackendConfig::spark_primary();
        funded.payer = Some("user-subscription".to_string());
        assert!(funded.validate().is_ok());
        let deps = funded.dependencies();
        assert_eq!(deps.len(), 3);
        assert_eq!(deps[2].kind, "payer");
        assert_eq!(deps[2].reference, "user-subscription");

        let mut bad = BackendConfig::spark_primary();
        bad.payer = Some("  ".to_string());
        assert!(bad.validate().is_err());
    }

    #[test]
    fn config_round_trips_through_backend() {
        let config = BackendConfig::spark_primary();
        let backend = OpenAiCompatBackend::from_config(&config).expect("example builds");
        assert_eq!(backend.config(), config);
        assert_eq!(backend.provider_kind(), ProviderKind::OpenAiCompat);
        assert_eq!(backend.auth_mode(), AuthMode::BearerEnv);
    }

    #[test]
    fn validation_rejects_unbounded_or_miswired_configs() {
        let good = BackendConfig::spark_primary();
        let mut bad = good.clone();
        bad.endpoint = "meta-api/v1".to_string();
        assert!(bad.validate().is_err());

        let mut bad = good.clone();
        bad.auth = AuthMode::BearerEnv;
        bad.credential_var = None;
        assert!(bad.validate().is_err());

        let mut bad = good.clone();
        bad.auth = AuthMode::None;
        bad.credential_var = Some("MODEL_API_KEY".to_string());
        assert!(bad.validate().is_err());

        let mut bad = good.clone();
        bad.network.header_timeout_ms = 0;
        assert!(bad.validate().is_err());

        let mut bad = good.clone();
        bad.network.max_output_bytes = 0;
        assert!(bad.validate().is_err());

        let mut bad = good;
        bad.network.max_inflight = 0;
        assert!(bad.validate().is_err());

        assert!(OpenAiCompatBackend::from_config(&bad).is_err());
    }

    #[test]
    fn auth_mode_spells_are_stable() {
        assert_eq!(AuthMode::BearerEnv.as_str(), "bearer_env");
        assert_eq!(AuthMode::None.as_str(), "none");
        assert_eq!(ProviderKind::OpenAiCompat.as_str(), "openai_compat");
        assert_eq!(ProviderKind::LocalPool.as_str(), "local_pool");
    }
}
