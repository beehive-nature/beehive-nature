//! H02 backend provider tests: real loopback HTTP/SSE fault injection.
//!
//! Every test runs offline against a `127.0.0.1` server owned by the
//! test itself — no external traffic, no credentials, no payer, no
//! production anything. Each fault asserts the failure classification
//! ([`BackendError`]/[`FailoverReason`]) AND the elapsed-time bound it
//! met, and the error's `detail` carries `elapsed_ms=` for the record.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use harness_sovereign::backend::{
    build_backend, preflight, BackendConfig, BackendError, ChatMessage, FailoverReason,
    ModelBackend, NetworkBudgets, OpenAiCompatBackend, RetryBudgets, StopReason,
};
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
struct Ctx {
    hits: Arc<AtomicUsize>,
    auth: Arc<Mutex<Option<String>>>,
}

/// Bind loopback, serve every connection with `handler` on its own
/// thread, and return the `/v1` endpoint plus shared observations.
fn spawn_loopback(handler: impl Fn(TcpStream, Ctx) + Send + Sync + 'static) -> (String, Ctx) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("loopback bind");
    let port = listener.local_addr().expect("local addr").port();
    let ctx = Ctx {
        hits: Arc::new(AtomicUsize::new(0)),
        auth: Arc::new(Mutex::new(None)),
    };
    let accept_ctx = ctx.clone();
    let handler = Arc::new(handler);
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else { break };
            let ctx = accept_ctx.clone();
            let handler = handler.clone();
            std::thread::spawn(move || handler(stream, ctx));
        }
    });
    (format!("http://127.0.0.1:{port}/v1"), ctx)
}

/// Read request line + headers, drain the body, record auth + hit.
fn read_request(stream: &TcpStream) -> (String, Vec<String>) {
    let mut reader = BufReader::new(stream.try_clone().expect("clone stream"));
    let mut line = String::new();
    reader.read_line(&mut line).expect("request line");
    let request_line = line.trim_end().to_string();
    let mut headers = Vec::new();
    let mut content_length = 0usize;
    loop {
        line.clear();
        reader.read_line(&mut line).expect("header line");
        let trimmed = line.trim_end().to_string();
        if trimmed.is_empty() {
            break;
        }
        if let Some((name, value)) = trimmed.split_once(':') {
            if name.trim().eq_ignore_ascii_case("authorization") {
                headers.push(value.trim().to_string());
            }
            if name.trim().eq_ignore_ascii_case("content-length") {
                content_length = value.trim().parse().unwrap_or(0);
            }
        }
    }
    if content_length > 0 {
        let mut body = vec![0u8; content_length];
        reader.read_exact(&mut body).expect("request body");
    }
    (request_line, headers)
}

/// True when the request line targets `{base}/models` (base carries a
/// `/v1` prefix, so match the suffix, not the leading path).
fn is_models(request_line: &str) -> bool {
    request_line
        .split_whitespace()
        .nth(1)
        .is_some_and(|path| path.ends_with("/models"))
}

fn note_hit(stream: &TcpStream, ctx: &Ctx) {
    let (_, auth) = read_request(stream);
    ctx.hits.fetch_add(1, Ordering::SeqCst);
    *ctx.auth.lock().expect("auth lock") = auth.into_iter().next();
}

fn write_bytes(stream: &mut TcpStream, bytes: &[u8]) {
    let _ = stream.write_all(bytes);
    let _ = stream.flush();
}

fn sse_piece(text: &str) -> String {
    let payload = serde_json::json!({"choices": [{"delta": {"content": text}}]});
    format!("data: {payload}\n\n")
}

fn ok_headers() -> &'static str {
    "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n"
}

fn fast_net() -> NetworkBudgets {
    NetworkBudgets {
        connect_timeout_ms: 1_000,
        header_timeout_ms: 300,
        stream_idle_timeout_ms: 300,
        max_output_bytes: 65_536,
        max_inflight: 4,
    }
}

fn fast_retry() -> RetryBudgets {
    RetryBudgets {
        max_retries: 2,
        base_delay_ms: 10,
    }
}

fn user_hello() -> Vec<ChatMessage> {
    vec![ChatMessage::user("hello")]
}

#[tokio::test]
async fn success_streams_text_and_forwards_bearer() {
    const VAR: &str = "H02_TEST_BEARER_OK";
    std::env::set_var(VAR, "h02-test-value");
    let (endpoint, ctx) = spawn_loopback(|mut stream, ctx| {
        note_hit(&stream, &ctx);
        let mut out = ok_headers().to_string();
        out.push_str(&sse_piece("hello "));
        out.push_str(&sse_piece("world"));
        out.push_str("data: {\"usage\": {\"input_tokens\": 3, \"output_tokens\": 2}}\n\n");
        out.push_str("data: [DONE]\n\n");
        write_bytes(&mut stream, out.as_bytes());
    });
    let backend =
        OpenAiCompatBackend::from_config(&remote_config(&endpoint, VAR)).expect("config builds");
    let started = Instant::now();
    let (result, report) = backend
        .complete_with_report(&user_hello(), CancellationToken::new())
        .await;
    let turn = result.expect("loopback success");
    let elapsed = started.elapsed();
    assert_eq!(turn.text, "hello world");
    assert_eq!(turn.stop_reason, StopReason::EndTurn);
    assert_eq!(turn.usage["output_tokens"], 2);
    assert_eq!(report.usage, turn.usage, "usage preserved into report");
    assert_eq!(report.attempts, 1);
    assert_eq!(report.retries, 0);
    assert_eq!(ctx.hits.load(Ordering::SeqCst), 1);
    assert_eq!(
        ctx.auth.lock().expect("auth lock").as_deref(),
        Some("Bearer h02-test-value")
    );
    assert!(elapsed < Duration::from_secs(5), "elapsed={elapsed:?}");
    std::env::remove_var(VAR);
}

#[tokio::test]
async fn stalled_headers_fail_transport_inside_bound() {
    const VAR: &str = "H02_TEST_STALL_HDR";
    std::env::set_var(VAR, "x");
    // Accept the socket, read the request, then answer nothing for 2s.
    let (endpoint, ctx) = spawn_loopback(|stream, ctx| {
        note_hit(&stream, &ctx);
        std::thread::sleep(Duration::from_millis(2_000));
    });
    let backend =
        OpenAiCompatBackend::from_config(&remote_config(&endpoint, VAR)).expect("config builds");
    let started = Instant::now();
    let error = backend
        .complete(&user_hello(), CancellationToken::new())
        .await
        .expect_err("stalled headers must fail");
    let elapsed = started.elapsed();
    assert!(
        matches!(
            &error,
            BackendError::Unavailable {
                reason: FailoverReason::Transport,
                ..
            }
        ),
        "classification: {error:?}"
    );
    assert!(error.is_failover());
    let detail = match &error {
        BackendError::Unavailable { detail, .. } => detail.clone(),
        _ => String::new(),
    };
    assert!(detail.contains("elapsed_ms="), "elapsed recorded: {detail}");
    assert!(
        elapsed >= Duration::from_millis(150),
        "waited for the bound, elapsed={elapsed:?}"
    );
    // Transport stalls retry politely (1 attempt + 2 retries), each
    // attempt bounded by the 300ms header timeout.
    assert_eq!(ctx.hits.load(Ordering::SeqCst), 3);
    assert!(
        elapsed < Duration::from_millis(2_500),
        "inside bound, elapsed={elapsed:?}"
    );
    std::env::remove_var(VAR);
}

#[tokio::test]
async fn stalled_stream_keeps_partial_and_fails_transport() {
    const VAR: &str = "H02_TEST_STALL_STREAM";
    std::env::set_var(VAR, "x");
    let (endpoint, _) = spawn_loopback(|mut stream, ctx| {
        note_hit(&stream, &ctx);
        let mut out = ok_headers().to_string();
        out.push_str(&sse_piece("kept"));
        write_bytes(&mut stream, out.as_bytes());
        std::thread::sleep(Duration::from_millis(2_000));
    });
    let backend =
        OpenAiCompatBackend::from_config(&remote_config(&endpoint, VAR)).expect("config builds");
    let started = Instant::now();
    let error = backend
        .complete(&user_hello(), CancellationToken::new())
        .await
        .expect_err("stalled stream must fail");
    let elapsed = started.elapsed();
    match &error {
        BackendError::Unavailable {
            reason: FailoverReason::Transport,
            partial,
            ..
        } => assert_eq!(partial, "kept"),
        other => panic!("classification: {other:?}"),
    }
    assert!(
        elapsed < Duration::from_millis(1_500),
        "inside bound, elapsed={elapsed:?}"
    );
    std::env::remove_var(VAR);
}

#[tokio::test]
async fn status_429_is_rate_limit_and_not_retried() {
    const VAR: &str = "H02_TEST_429";
    std::env::set_var(VAR, "x");
    let (endpoint, ctx) = spawn_loopback(|mut stream, ctx| {
        note_hit(&stream, &ctx);
        write_bytes(
            &mut stream,
            b"HTTP/1.1 429 Too Many Requests\r\nContent-Length: 3\r\nConnection: close\r\n\r\n429",
        );
    });
    let backend =
        OpenAiCompatBackend::from_config(&remote_config(&endpoint, VAR)).expect("config builds");
    let started = Instant::now();
    let error = backend
        .complete(&user_hello(), CancellationToken::new())
        .await
        .expect_err("429 must fail");
    let elapsed = started.elapsed();
    assert!(
        matches!(
            &error,
            BackendError::Unavailable {
                reason: FailoverReason::RateLimit,
                ..
            }
        ),
        "classification: {error:?}"
    );
    assert!(!FailoverReason::RateLimit.retryable());
    assert_eq!(ctx.hits.load(Ordering::SeqCst), 1, "no polite retry on 429");
    assert!(elapsed < Duration::from_secs(5), "elapsed={elapsed:?}");
    std::env::remove_var(VAR);
}

#[tokio::test]
async fn status_503_retries_then_fails_server_5xx() {
    const VAR: &str = "H02_TEST_503";
    std::env::set_var(VAR, "x");
    let (endpoint, ctx) = spawn_loopback(|mut stream, ctx| {
        note_hit(&stream, &ctx);
        write_bytes(
            &mut stream,
            b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 3\r\nConnection: close\r\n\r\n503",
        );
    });
    let mut config = remote_config(&endpoint, VAR);
    config.payer = Some("h02-payer".to_string());
    let backend = OpenAiCompatBackend::from_config(&config).expect("config builds");
    let started = Instant::now();
    let (result, report) = backend
        .complete_with_report(&user_hello(), CancellationToken::new())
        .await;
    let error = result.expect_err("503 must fail");
    let elapsed = started.elapsed();
    assert!(
        matches!(
            &error,
            BackendError::Unavailable {
                reason: FailoverReason::Server5xx,
                ..
            }
        ),
        "classification: {error:?}"
    );
    assert!(FailoverReason::Server5xx.retryable());
    assert_eq!(
        ctx.hits.load(Ordering::SeqCst),
        3,
        "1 attempt + 2 polite retries"
    );
    assert_eq!(report.attempts, 3, "every attempt counted");
    assert_eq!(report.retries, 2, "every retry counted");
    assert_eq!(report.classification, Some(FailoverReason::Server5xx));
    assert_eq!(report.payer.as_deref(), Some("h02-payer"));
    assert!(!report.fatal);
    assert!(!report.cancelled);
    assert!(report.usage.is_null(), "uncertain usage stays unknown");
    assert!(elapsed < Duration::from_secs(5), "elapsed={elapsed:?}");
    std::env::remove_var(VAR);
}

fn remote_config(endpoint: &str, cred_var: &str) -> BackendConfig {
    BackendConfig {
        name: "h02-remote".to_string(),
        endpoint: endpoint.to_string(),
        model: "h02-model".to_string(),
        credential_var: Some(cred_var.to_string()),
        auth: harness_sovereign::backend::AuthMode::BearerEnv,
        provider: harness_sovereign::backend::ProviderKind::OpenAiCompat,
        network: fast_net(),
        retry: fast_retry(),
        payer: None,
    }
}

#[tokio::test]
async fn missing_credential_is_fatal_never_a_healthy_fallback() {
    const VAR: &str = "H02_TEST_MISSING_CRED_XYZ";
    std::env::remove_var(VAR);
    // Point a bearer config at a live loopback server: the missing
    // credential must fail before any traffic, not borrow the
    // no-auth route.
    let (endpoint, ctx) = spawn_loopback(|mut stream, ctx| {
        note_hit(&stream, &ctx);
        let mut out = ok_headers().to_string();
        out.push_str(&sse_piece("must never arrive"));
        out.push_str("data: [DONE]\n\n");
        write_bytes(&mut stream, out.as_bytes());
    });
    let config = remote_config(&endpoint, VAR);
    let backend = OpenAiCompatBackend::from_config(&config).expect("config builds");
    assert_eq!(
        backend.provider_kind(),
        harness_sovereign::backend::ProviderKind::OpenAiCompat,
        "no silent substitution of the local route"
    );
    let started = Instant::now();
    let error = backend
        .complete(&user_hello(), CancellationToken::new())
        .await
        .expect_err("missing credential must fail");
    let elapsed = started.elapsed();
    assert!(
        matches!(&error, BackendError::Fatal { .. }),
        "classification: {error:?}"
    );
    assert!(!error.is_failover());
    assert_eq!(error.failover_reason(), None);
    assert_eq!(ctx.hits.load(Ordering::SeqCst), 0, "no request was sent");
    assert!(
        !backend.health().await,
        "missing credential is never healthy"
    );
    assert!(elapsed < Duration::from_secs(2), "elapsed={elapsed:?}");
}

#[tokio::test]
async fn local_pool_needs_no_credential_and_sends_no_auth_header() {
    let (endpoint, ctx) = spawn_loopback(|mut stream, ctx| {
        let (request_line, _) = read_request(&stream);
        ctx.hits.fetch_add(1, Ordering::SeqCst);
        if is_models(&request_line) {
            write_bytes(
                &mut stream,
                b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
            );
            return;
        }
        let mut out = ok_headers().to_string();
        out.push_str(&sse_piece("local-ok"));
        out.push_str("data: [DONE]\n\n");
        write_bytes(&mut stream, out.as_bytes());
    });
    let mut config = BackendConfig::local_pool("h02-pool", &endpoint, "pool-model");
    config.network = fast_net();
    config.retry = fast_retry();
    let backend = OpenAiCompatBackend::from_config(&config).expect("local builds");
    assert!(backend.health().await, "reachable pool is healthy");
    let turn = backend
        .complete(&user_hello(), CancellationToken::new())
        .await
        .expect("pool answers without credentials");
    assert_eq!(turn.text, "local-ok");
    assert_eq!(ctx.hits.load(Ordering::SeqCst), 2);
    assert_eq!(
        ctx.auth.lock().expect("auth lock").clone(),
        None,
        "no-auth route sends no authorization header"
    );
}

#[tokio::test]
async fn cancellation_ends_turn_with_partial() {
    const VAR: &str = "H02_TEST_CANCEL";
    std::env::set_var(VAR, "x");
    let (endpoint, _) = spawn_loopback(|mut stream, ctx| {
        note_hit(&stream, &ctx);
        write_bytes(&mut stream, ok_headers().as_bytes());
        for index in 0..20 {
            write_bytes(&mut stream, sse_piece(&format!("tok{index} ")).as_bytes());
            std::thread::sleep(Duration::from_millis(100));
        }
    });
    let mut config = remote_config(&endpoint, VAR);
    config.network.stream_idle_timeout_ms = 2_000;
    config.network.header_timeout_ms = 2_000;
    let backend = Arc::new(OpenAiCompatBackend::from_config(&config).expect("config builds"));
    let cancel = CancellationToken::new();
    let worker = {
        let backend = backend.clone();
        let cancel = cancel.clone();
        tokio::spawn(async move { backend.complete(&user_hello(), cancel).await })
    };
    tokio::time::sleep(Duration::from_millis(350)).await;
    cancel.cancel();
    let started = Instant::now();
    let turn = worker
        .await
        .expect("join")
        .expect("cancellation ends the turn");
    let elapsed = started.elapsed();
    assert_eq!(turn.stop_reason, StopReason::Cancelled);
    assert!(
        turn.text.contains("tok0 "),
        "partial preserved: {:?}",
        turn.text
    );
    assert!(elapsed < Duration::from_secs(3), "elapsed={elapsed:?}");
    std::env::remove_var(VAR);
}

#[tokio::test]
async fn queued_work_beyond_inflight_bound_fails_fast() {
    const VAR: &str = "H02_TEST_QUEUE";
    std::env::set_var(VAR, "x");
    // First request occupies the single slot for 1.5s; the second must
    // fail immediately instead of queueing behind it.
    let (endpoint, _) = spawn_loopback(|mut stream, ctx| {
        note_hit(&stream, &ctx);
        std::thread::sleep(Duration::from_millis(1_500));
        let mut out = ok_headers().to_string();
        out.push_str(&sse_piece("slow"));
        out.push_str("data: [DONE]\n\n");
        write_bytes(&mut stream, out.as_bytes());
    });
    let mut config = remote_config(&endpoint, VAR);
    config.network.max_inflight = 1;
    config.network.header_timeout_ms = 5_000;
    config.network.stream_idle_timeout_ms = 5_000;
    let backend = Arc::new(OpenAiCompatBackend::from_config(&config).expect("config builds"));
    let first = {
        let backend = backend.clone();
        tokio::spawn(async move {
            backend
                .complete(&user_hello(), CancellationToken::new())
                .await
        })
    };
    tokio::time::sleep(Duration::from_millis(150)).await;
    let started = Instant::now();
    let error = backend
        .complete(&user_hello(), CancellationToken::new())
        .await
        .expect_err("second turn must not queue");
    let elapsed = started.elapsed();
    match &error {
        BackendError::Unavailable {
            reason: FailoverReason::Transport,
            detail,
            ..
        } => assert!(detail.contains("queue full"), "detail: {detail}"),
        other => panic!("classification: {other:?}"),
    }
    assert!(
        elapsed < Duration::from_millis(1_000),
        "fails fast, elapsed={elapsed:?}"
    );
    let turn = first.await.expect("join").expect("first turn succeeds");
    assert_eq!(turn.text, "slow");
    std::env::remove_var(VAR);
}

#[tokio::test]
async fn output_beyond_budget_fails_closed_with_capped_partial() {
    const VAR: &str = "H02_TEST_FLOOD";
    std::env::set_var(VAR, "x");
    let (endpoint, _) = spawn_loopback(|mut stream, ctx| {
        note_hit(&stream, &ctx);
        write_bytes(&mut stream, ok_headers().as_bytes());
        for _ in 0..50 {
            write_bytes(&mut stream, sse_piece("0123456789abcdef0123").as_bytes());
        }
    });
    let mut config = remote_config(&endpoint, VAR);
    config.network.max_output_bytes = 32;
    let backend = OpenAiCompatBackend::from_config(&config).expect("config builds");
    let started = Instant::now();
    let error = backend
        .complete(&user_hello(), CancellationToken::new())
        .await
        .expect_err("flood must fail closed");
    let elapsed = started.elapsed();
    match &error {
        BackendError::Unavailable {
            reason: FailoverReason::Transport,
            detail,
            partial,
        } => {
            assert!(detail.contains("output budget"), "detail: {detail}");
            assert!(partial.len() <= 32, "partial capped: {}", partial.len());
        }
        other => panic!("classification: {other:?}"),
    }
    assert!(elapsed < Duration::from_secs(5), "elapsed={elapsed:?}");
    std::env::remove_var(VAR);
}

#[tokio::test]
async fn health_reports_success_failure_and_refusal() {
    let (endpoint, _) = spawn_loopback(|mut stream, ctx| {
        let (request_line, _) = read_request(&stream);
        ctx.hits.fetch_add(1, Ordering::SeqCst);
        if is_models(&request_line) {
            write_bytes(
                &mut stream,
                b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
            );
        }
    });
    let mut good = BackendConfig::local_pool("h02-healthy", &endpoint, "pool-model");
    good.network = fast_net();
    let healthy = OpenAiCompatBackend::from_config(&good).expect("local builds");
    assert!(healthy.health().await);

    let (bad_endpoint, _) = spawn_loopback(|mut stream, ctx| {
        let (request_line, _) = read_request(&stream);
        ctx.hits.fetch_add(1, Ordering::SeqCst);
        if is_models(&request_line) {
            write_bytes(
                &mut stream,
                b"HTTP/1.1 500 Internal Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            );
        }
    });
    let mut sick = BackendConfig::local_pool("h02-sick", &bad_endpoint, "pool-model");
    sick.network = fast_net();
    let sick_backend = OpenAiCompatBackend::from_config(&sick).expect("local builds");
    assert!(!sick_backend.health().await);

    // Nothing listens here: connection refused is unhealthy, not an error.
    let refused = BackendConfig::local_pool("h02-refused", "http://127.0.0.1:1/v1", "pool-model");
    let refused_backend = OpenAiCompatBackend::from_config(&refused).expect("builds");
    assert!(!refused_backend.health().await);
}

#[tokio::test]
async fn preflight_over_two_backends_mixes_healthy_and_missing_cred() {
    const VAR: &str = "H02_TEST_PREFLIGHT_MISSING_XYZ";
    std::env::remove_var(VAR);
    let (endpoint, _) = spawn_loopback(|mut stream, ctx| {
        let (request_line, _) = read_request(&stream);
        ctx.hits.fetch_add(1, Ordering::SeqCst);
        if is_models(&request_line) {
            write_bytes(
                &mut stream,
                b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
            );
        }
    });
    let mut pool = BackendConfig::local_pool("h02-preflight-pool", &endpoint, "pool-model");
    pool.network = fast_net();
    let pool_backend = build_backend(pool).expect("pool builds");

    // Remote bearer config with no credential in env: builds fine,
    // reports unhealthy — the preflight never counts it as ready.
    let remote = remote_config("http://127.0.0.1:9/v1", VAR);
    let remote_backend = build_backend(remote).expect("remote builds");

    let started = Instant::now();
    let report = preflight(&[pool_backend, remote_backend], 1_000).await;
    let elapsed = started.elapsed();
    assert_eq!(report.entries.len(), 2);
    assert_eq!(report.entries[0].name, "h02-preflight-pool");
    assert!(report.entries[0].healthy);
    assert_eq!(report.entries[1].name, "h02-remote");
    assert!(!report.entries[1].healthy);
    assert!(report.any_healthy());
    assert!(!report.all_healthy());
    assert!(
        elapsed < Duration::from_secs(5),
        "preflight bounded, elapsed={elapsed:?}"
    );
}

#[tokio::test]
async fn monitor_reports_transitions_until_cancelled() {
    use harness_sovereign::backend::monitor_health;
    // First two probes see 500, then the backend recovers to 200.
    let (endpoint, ctx) = spawn_loopback(|mut stream, ctx| {
        let (request_line, _) = read_request(&stream);
        let hit = ctx.hits.fetch_add(1, Ordering::SeqCst);
        if is_models(&request_line) {
            if hit < 2 {
                write_bytes(
                    &mut stream,
                    b"HTTP/1.1 500 Internal Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                );
            } else {
                write_bytes(
                    &mut stream,
                    b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
                );
            }
        }
    });
    let mut config = BackendConfig::local_pool("h02-flap", &endpoint, "pool-model");
    config.network = fast_net();
    let backend = build_backend(config).expect("pool builds");
    let (tx, mut rx) = tokio::sync::mpsc::channel(16);
    let cancel = CancellationToken::new();
    let worker = tokio::spawn(monitor_health(
        vec![backend],
        Duration::from_millis(50),
        cancel.clone(),
        tx,
    ));
    let started = Instant::now();
    let mut events = Vec::new();
    while let Some(event) = rx.recv().await {
        events.push(event);
        if events.iter().any(|event| event.healthy && event.changed) {
            cancel.cancel();
        }
        if started.elapsed() > Duration::from_secs(5) {
            cancel.cancel();
            break;
        }
    }
    worker.await.expect("monitor returns after cancel");
    assert!(!events.is_empty());
    assert_eq!(events[0].name, "h02-flap");
    assert!(!events[0].healthy, "first sample down");
    assert!(!events[0].changed, "no transition yet");
    let recovery = events
        .iter()
        .find(|event| event.healthy && event.changed)
        .expect("recovery transition reported");
    assert!(recovery.elapsed_ms < 1_000, "probe bounded");
    let _ = ctx.hits.load(Ordering::SeqCst);
}
