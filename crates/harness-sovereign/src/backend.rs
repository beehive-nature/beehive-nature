//! R1 — model backends as sense adapters (CONSTITUTION Art. III).
//!
//! Faithful port of Python B1 (`model_backend.py`): OpenAI-compatible
//! `/chat/completions` over streaming SSE with quantum-bounded reads, the
//! four-way `BackendDown` taxonomy, and polite in-adapter retries.
//! A backend's outputs are Evidence with provenance `AIInference` — never
//! truth, never authority.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
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
    api_key_env: String,
    timeout_quantum_secs: f32,
    max_retries: u32,
    client: reqwest::Client,
}

impl OpenAiCompatBackend {
    pub fn new(
        name: impl Into<String>,
        model_id: impl Into<String>,
        base_url: impl Into<String>,
        api_key_env: impl Into<String>,
    ) -> Self {
        OpenAiCompatBackend {
            name: name.into(),
            model_id: model_id.into(),
            base_url: base_url.into(),
            api_key_env: api_key_env.into(),
            timeout_quantum_secs: 2.0,
            max_retries: 2,
            client: reqwest::Client::new(),
        }
    }

    fn api_key(&self) -> Result<String, BackendError> {
        std::env::var(&self.api_key_env).map_err(|_| BackendError::Fatal {
            reason: format!("auth: env {} is unset", self.api_key_env),
        })
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
        if cancel.is_cancelled() {
            return Ok(Turn {
                text: String::new(),
                tool_calls: Vec::new(),
                stop_reason: StopReason::Cancelled,
                usage: serde_json::Value::Null,
            });
        }
        let mut attempt = 0u32;
        loop {
            match self.complete_once(messages, &cancel).await {
                Ok(turn) => return Ok(turn),
                Err(error) => {
                    let retry = error
                        .failover_reason()
                        .is_some_and(|reason| reason.retryable())
                        && attempt < self.max_retries;
                    if !retry {
                        return Err(error);
                    }
                    attempt += 1;
                    tokio::time::sleep(std::time::Duration::from_secs_f32(0.5 * attempt as f32))
                        .await;
                }
            }
        }
    }

    async fn health(&self) -> bool {
        let key = match self.api_key() {
            Ok(key) => key,
            Err(_) => return false,
        };
        let url = format!("{}/models", self.base_url.trim_end_matches('/'));
        match self.client.get(&url).bearer_auth(key).send().await {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }
}

impl OpenAiCompatBackend {
    async fn complete_once(
        &self,
        messages: &[ChatMessage],
        cancel: &CancellationToken,
    ) -> Result<Turn, BackendError> {
        let key = self.api_key()?;
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let body = ChatRequest {
            model: &self.model_id,
            messages,
            stream: true,
        };
        let response = self
            .client
            .post(&url)
            .bearer_auth(key)
            .header("Accept", "text/event-stream")
            .json(&body)
            .send()
            .await
            .map_err(|e| BackendError::from_transport(e.to_string()))?;
        let status = response.status().as_u16();
        if !response.status().is_success() {
            return Err(BackendError::from_status(status));
        }

        // Streaming: bounded quanta — each chunk gets timeout_quantum
        // seconds and cancel is checked between reads, so a dead backend
        // can never wedge the loop. Partial text is kept for FREEZE.
        let mut chunks: Vec<String> = Vec::new();
        let mut usage = serde_json::Value::Null;
        let mut buffer = String::new();
        let quantum = std::time::Duration::from_secs_f32(self.timeout_quantum_secs);
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
}
