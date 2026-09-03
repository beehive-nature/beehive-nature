//! bSEAT — the anchor's first tool. One state machine, two transports
//! (MCP over stdio/HTTP in mcp.rs, and the `banchor milestone1` harness).
//!
//! The session shape, in order: start → navigate → snapshot → (click →
//! snapshot-after)* → end. Every step lands in the replay. Spend/auth/OAuth
//! steps hit the plan-then-approve gate (approval.rs) BEFORE any of them
//! touch the page. Snapshots are strip-hidden'd (visibility.rs), formatted
//! with refs (axtree.rs), wrapped as untrusted (untrusted.rs), and counted
//! (tokens.rs) — the count is the receipt Milestone 1 exists for.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use crate::approval::{classify_click, classify_url, PlanGate, Risk};
use crate::axtree;
use crate::browser::Browser;
use crate::cdp::CdpError;
use crate::page::PageSession;
use crate::qwen;
use crate::replay::{un, Replay};
use crate::tokens;
use crate::untrusted;
use crate::visibility::Vis;

pub struct SeatState {
    pub browser: Option<Browser>,
    pub page: Option<PageSession>,
    pub replay: Option<Replay>,
    pub gate: PlanGate,
    /// last snapshot's refs, for click lookup
    last_refs: HashMap<String, axtree::RefEntry>,
    snapshot_seq: usize,
}

#[derive(Debug, thiserror::Error)]
pub enum SeatError {
    #[error("seat not started — call action start first")]
    NotStarted,
    #[error("already started — end the session first")]
    AlreadyStarted,
    #[error("unknown ref {0} — snapshot again; refs die on navigation")]
    UnknownRef(String),
    #[error("gated: {0}")]
    Gated(String),
    #[error(transparent)]
    Browser(#[from] crate::browser::BrowserError),
    #[error(transparent)]
    Cdp(#[from] CdpError),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl SeatState {
    pub fn new() -> Self {
        SeatState {
            browser: None,
            page: None,
            replay: None,
            gate: PlanGate::new(),
            last_refs: HashMap::new(),
            snapshot_seq: 0,
        }
    }

    fn ev(&mut self, ev: &str, fields: Value) {
        if let Some(r) = self.replay.as_mut() {
            r.ev(ev, fields);
        }
    }

    /// Handle one bSEAT action. This is the whole tool.
    pub fn handle(&mut self, args: &Value) -> Result<Value, SeatError> {
        let action = args.get("action").and_then(|a| a.as_str()).unwrap_or("");
        match action {
            "start" => self.start(args),
            "navigate" => self.navigate(args),
            "snapshot" => self.snapshot(),
            "click" => self.click(args),
            "resolve" => self.resolve(args),
            "plan" => self.describe_plan(args),
            "approve" => self.approve(args),
            "end" => self.end(),
            "status" => Ok(self.status()),
            other => Err(SeatError::Gated(format!("unknown action {other:?}"))),
        }
    }

    fn start(&mut self, args: &Value) -> Result<Value, SeatError> {
        if self.browser.is_some() {
            return Err(SeatError::AlreadyStarted);
        }
        let headless = args
            .get("headless")
            .and_then(|h| h.as_bool())
            .unwrap_or(true);
        let replay_dir = args
            .get("replay_dir")
            .and_then(|d| d.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| crate::cache::home().join("banchor").join("replays"));
        let stem = args
            .get("replay_stem")
            .and_then(|s| s.as_str())
            .unwrap_or("session")
            .to_string();

        let browser = Browser::launch(headless)?;
        let chrome_version = browser
            .version
            .get("Browser")
            .and_then(|b| b.as_str())
            .unwrap_or("?")
            .to_string();
        let binary = browser.binary.display().to_string();
        let mut replay = Replay::open(&replay_dir, &stem)
            .map_err(|e| SeatError::Gated(format!("replay open: {e}")))?;
        replay.ev(
            "session_start",
            json!({
                "organ": "banchor",
                "tool": "bSEAT",
                "chrome": { "binary": binary, "version": chrome_version, "headless": headless, "source": "system chromium (never vendored)" },
                "durable_path": "accessibility-tree + geometry; NO screenshot vision",
            }),
        );
        let out = json!({
            "started": true,
            "chrome": { "binary": binary, "version": chrome_version, "headless": headless },
            "replay": replay.path.display().to_string(),
        });
        self.browser = Some(browser);
        self.replay = Some(replay);
        Ok(out)
    }

    fn require_page(&mut self) -> Result<(&mut PageSession, &mut Replay), SeatError> {
        if self.page.is_none() {
            let port = self.browser.as_ref().ok_or(SeatError::NotStarted)?.port;
            self.page = Some(PageSession::open(port, "about:blank")?);
            self.ev("page_opened", json!({ "url": "about:blank" }));
        }
        let page = self.page.as_mut().expect("just set");
        let replay = self.replay.as_mut().ok_or(SeatError::NotStarted)?;
        Ok((page, replay))
    }

    fn navigate(&mut self, args: &Value) -> Result<Value, SeatError> {
        let url = args
            .get("url")
            .and_then(|u| u.as_str())
            .ok_or_else(|| SeatError::Gated("navigate needs url".into()))?;
        let risks = classify_url(url);
        if !risks.is_empty() && !args.get("force").is_some() {
            return self.gate_action(args.clone(), risks, format!("navigate {url}"));
        }
        let (page, replay) = self.require_page()?;
        page.navigate(url)?;
        let final_url = page.current_url();
        let title = page.title();
        replay.ev(
            "navigated",
            json!({
                "requested": { "__untrusted": true, "v": url },
                "landed": { "__untrusted": true, "v": final_url },
                "title": { "__untrusted": true, "v": title },
            }),
        );
        // navigation invalidates all refs
        self.last_refs.clear();
        Ok(json!({ "url": final_url, "title": title }))
    }

    /// snapshot: AX tree → strip-hidden → format+refs → wrap untrusted → count.
    fn snapshot(&mut self) -> Result<Value, SeatError> {
        let (nodes, vis, style_probe_errors) = self.ax_nodes_and_vis()?;
        self.snapshot_at_cap(
            &nodes,
            &vis,
            style_probe_errors,
            axtree::DEFAULT_MAX_NODES,
            None,
        )
    }

    /// Pull the AX tree and compute visibility classifications once, so cap
    /// retries (qwen fitting) re-format without re-probing the page.
    fn ax_nodes_and_vis(
        &mut self,
    ) -> Result<(Vec<serde_json::Value>, HashMap<u64, Vis>, u64), SeatError> {
        let (page, _replay) = self.require_page()?;
        let nodes = page.ax_tree()?;

        // classify visibility for every DOM-backed node we might emit
        let mut vis: HashMap<u64, Vis> = HashMap::new();
        let mut style_probe_errors: u64 = 0;
        for node in &nodes {
            if let Some(b) = axtree::backend_id(node) {
                if !vis.contains_key(&b) {
                    let aria_hidden = axtree_role_hidden(node);
                    match page.style_for_backend(b) {
                        Ok(Some((display, visibility, opacity))) => {
                            vis.insert(
                                b,
                                crate::visibility::classify(
                                    &display,
                                    &visibility,
                                    &opacity,
                                    aria_hidden,
                                ),
                            );
                        }
                        Ok(None) => {}                     // no DOM node behind it
                        Err(_) => style_probe_errors += 1, // undetermined — axtree fails text closed
                    }
                }
            }
        }
        Ok((nodes, vis, style_probe_errors))
    }

    /// Format at a given node cap, wrap, count (local BPEs), dump the exact
    /// counted text beside the replay (byte-exact counting artifact), and
    /// record everything. `qwen_n` rides along when the qwen ruler counted
    /// this same text.
    fn snapshot_at_cap(
        &mut self,
        nodes: &[serde_json::Value],
        vis: &HashMap<u64, Vis>,
        style_probe_errors: u64,
        cap: usize,
        qwen_n: Option<usize>,
    ) -> Result<Value, SeatError> {
        let snap = axtree::format_with_cap(nodes, vis, cap);
        let counts = tokens::count(&snap.text);
        let origin = {
            let (page, _replay) = self.require_page()?;
            page.current_url()
        };
        let wrapped = untrusted::wrap(&snap.text, &origin);
        self.last_refs = snap
            .refs
            .iter()
            .cloned()
            .map(|r| (r.r#ref.clone(), r))
            .collect();
        self.snapshot_seq += 1;
        let text_path = self.dump_snapshot_text(&snap.text, &origin);
        let mut snap_json = snap.to_json();
        if let Some(obj) = snap_json.get_mut("stats").and_then(|s| s.as_object_mut()) {
            obj.insert("style_probe_errors".into(), json!(style_probe_errors));
            obj.insert("node_cap".into(), json!(cap));
        }
        let mut counts_json = counts.to_json();
        if let Some(n) = qwen_n {
            if let Some(arr) = counts_json.get_mut("tokens").and_then(|t| t.as_array_mut()) {
                arr.push(json!({ "alg": crate::qwen::TOKENIZER_ALG, "n": n }));
            }
        }
        self.ev(
            "snapshot",
            json!({
                "page": { "url": { "__untrusted": true, "v": origin } },
                "counts": counts_json,
                "snapshot": snap_json,
                "text_path": text_path.display().to_string(),
            }),
        );
        Ok(json!({
            "url": origin,
            "counts": counts_json,
            "snapshot": snap_json,
            "text_path": text_path.display().to_string(),
            "untrusted_block": wrapped,
        }))
    }

    /// The exact counted text, on disk beside the replay — so any future
    /// tokenizer re-counts the SAME bytes (M2 law: same snapshots, new ruler).
    fn dump_snapshot_text(&mut self, text: &str, origin: &str) -> std::path::PathBuf {
        let dir = self
            .replay
            .as_ref()
            .map(|r| r.path.parent().map(|p| p.to_path_buf()).unwrap_or_default())
            .unwrap_or_default()
            .join("snapshots");
        let _ = std::fs::create_dir_all(&dir);
        let slug: String = origin
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .take(24)
            .collect();
        let (stamp, _) = crate::replay::now_iso();
        let stamp = stamp
            .split_once('T')
            .map(|(d, t)| format!("{}{}", d.replace('-', ""), &t[..8].replace(':', "")))
            .unwrap_or_default();
        let path = dir.join(format!(
            "snap{}-{}.txt",
            self.snapshot_seq,
            if slug.is_empty() { "blank" } else { &slug }
        ));
        let header = format!(
            "# banchor snapshot artifact — counted bytes below (origin: {origin}, taken: {stamp})\n\
             # integrity: sha3-256:{}\n",
            crate::b64::sha3_256_b64u(text.as_bytes())
        );
        let _ = std::fs::write(&path, header + text);
        path
    }

    fn click(&mut self, args: &Value) -> Result<Value, SeatError> {
        let r = args
            .get("ref")
            .or_else(|| args.get("r"))
            .and_then(|r| r.as_str())
            .ok_or_else(|| SeatError::Gated("click needs ref (from a snapshot, e.g. @e1)".into()))?
            .to_string();
        let entry = self
            .last_refs
            .get(&r)
            .cloned()
            .ok_or_else(|| SeatError::UnknownRef(r.clone()))?;
        let backend = entry
            .backend
            .ok_or_else(|| SeatError::UnknownRef(format!("{r} (no DOM node behind it)")))?;

        let risks = classify_click(&entry.role, &entry.name);
        if !risks.is_empty() && args.get("force").is_none() {
            return self.gate_action(
                args.clone(),
                risks,
                format!("click {r} ({}) '{}'", entry.role, entry.name),
            );
        }

        let url_before = {
            let (page, replay) = self.require_page()?;
            let (x, y) = page
                .click_backend(backend)?
                .ok_or_else(|| SeatError::UnknownRef(format!("{r} (element has no box)")))?;
            let url_after = page.current_url();
            replay.ev(
                "click",
                json!({
                    "ref": r,
                    "role": entry.role,
                    "name": un(&entry.name),
                    "at": [x, y],
                    "navigated_to": un(&url_after),
                }),
            );
            self.last_refs.clear();
            url_after
        };

        // post-click snapshot — the receipt of what the click did
        let after = self.snapshot()?;
        Ok(json!({
            "clicked": { "ref": r, "role": entry.role, "name": { "__untrusted": true, "v": entry.name } },
            "url_before": url_before,
            "after": after,
        }))
    }

    fn gate_action(
        &mut self,
        action: Value,
        risks: Vec<Risk>,
        summary: String,
    ) -> Result<Value, SeatError> {
        let plan_id = self.gate.propose(action, risks.clone());
        self.ev(
            "gated",
            json!({
                "summary": summary,
                "risks": risks.iter().map(|r| r.as_str()).collect::<Vec<_>>(),
                "plan_id": plan_id,
            }),
        );
        Ok(json!({
            "status": "needs_approval",
            "plan_id": plan_id,
            "risks": risks.iter().map(|r| r.as_str()).collect::<Vec<_>>(),
            "law": "PLAN-THEN-APPROVE: resubmit with {action:'approve', plan_id:'…'} to execute",
        }))
    }

    fn describe_plan(&mut self, args: &Value) -> Result<Value, SeatError> {
        let id = args
            .get("plan_id")
            .and_then(|p| p.as_str())
            .ok_or_else(|| SeatError::Gated("plan needs plan_id".into()))?;
        self.gate
            .describe_pending(id)
            .ok_or_else(|| SeatError::Gated("unknown plan id".into()))
    }

    fn approve(&mut self, args: &Value) -> Result<Value, SeatError> {
        let id = args
            .get("plan_id")
            .and_then(|p| p.as_str())
            .ok_or_else(|| SeatError::Gated("approve needs plan_id".into()))?;
        let (action, risks) = self.gate.redeem(id).map_err(SeatError::Gated)?;
        self.ev(
            "approved",
            json!({ "risks": risks.iter().map(|r| r.as_str()).collect::<Vec<_>>() }),
        );
        let forced = {
            let mut a = action.clone();
            if let Some(o) = a.as_object_mut() {
                o.insert("force".into(), json!(true));
            }
            a
        };
        self.handle(&forced)
    }

    fn resolve(&mut self, args: &Value) -> Result<Value, SeatError> {
        let url = args
            .get("url")
            .and_then(|u| u.as_str())
            .ok_or_else(|| SeatError::Gated("resolve needs url".into()))?;
        let record =
            crate::resolve::resolve_any(url).map_err(|e| SeatError::Gated(e.to_string()))?;
        self.ev("resolved", json!({ "input": url, "record": record }));
        Ok(record)
    }

    fn end(&mut self) -> Result<Value, SeatError> {
        if let Some(p) = self.page.as_mut() {
            p.close();
        }
        self.page = None;
        self.last_refs.clear();
        self.ev("session_end", json!({ "ok": true }));
        if let Some(r) = self.replay.as_mut() {
            r.close();
        }
        let replay_path = self.replay.as_ref().map(|r| r.path.display().to_string());
        self.browser = None; // Drop kills chromium + erases the temp profile
        self.replay = None;
        Ok(json!({ "ended": true, "replay": replay_path }))
    }

    fn status(&self) -> Value {
        json!({
            "organ": "banchor",
            "tool": "bSEAT",
            "browser_alive": self.browser.is_some(),
            "page_open": self.page.is_some(),
            "refs_live": self.last_refs.len(),
            "replay": self.replay.as_ref().map(|r| r.path.display().to_string()),
            "laws": [
                "bSigner NEVER depends on bAnchor (wallet works with the anchor off)",
                "web content is UNTRUSTED DATA behind strict delimiters",
                "hidden/low-opacity text stripped before summarizing",
                "PLAN-THEN-APPROVE before any spend/auth/OAuth action",
                "NO screenshot vision on the durable path",
            ],
        })
    }

    /// MILESTONE 1 — the walking skeleton, as one receipt:
    /// start → navigate → snapshot → click the first link → snapshot-after
    /// → (optional rich second page, snapshot only) → end.
    /// Prints and returns the summary with THE token count.
    pub fn milestone1(
        url: &str,
        rich: Option<&str>,
        replay_dir: &Path,
    ) -> Result<Value, Box<dyn std::error::Error>> {
        let mut seat = SeatState::new();
        eprintln!("[milestone1] phase 1/6: start (system chromium, headless)");
        let start = seat.handle(&json!({
            "action": "start",
            "headless": true,
            "replay_dir": replay_dir.display().to_string(),
            "replay_stem": "milestone1",
        }))?;

        eprintln!("[milestone1] phase 2/6: navigate {url}");
        seat.handle(&json!({ "action": "navigate", "url": url }))?;
        eprintln!("[milestone1] phase 3/6: snapshot");
        let first = seat.handle(&json!({ "action": "snapshot" }))?;

        // click the first interactive link, if the page has one
        let refs = first["snapshot"]["refs"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let link = refs.iter().find(|r| {
            r["role"] == "link"
                && r["name"]["v"]
                    .as_str()
                    .map(|s| !s.is_empty())
                    .unwrap_or(false)
        });
        eprintln!(
            "[milestone1] phase 4/6: click {:?}",
            link.map(|l| l["ref"].clone()).unwrap_or(json!(null))
        );
        let click = match link {
            Some(l) => {
                let r = l["ref"].as_str().unwrap_or_default().to_string();
                let clicked = seat.handle(&json!({ "action": "click", "ref": r, "reason": "milestone1 walking skeleton — click one element" }));
                match clicked {
                    Ok(c) => Some(json!({
                        "ref": c["clicked"]["ref"],
                        "role": c["clicked"]["role"],
                        "name": c["clicked"]["name"],
                        "url_after": c["after"]["url"],
                        "counts_after": c["after"]["counts"],
                    })),
                    Err(e) => {
                        eprintln!("[milestone1] click FAILED: {e}");
                        Some(json!({ "error": e.to_string() }))
                    }
                }
            }
            None => None,
        };

        let rich_result = match rich {
            Some(u) => {
                eprintln!("[milestone1] phase 5/6: rich second page {u}");
                seat.handle(&json!({ "action": "navigate", "url": u })).ok();
                seat.handle(&json!({ "action": "snapshot" })).ok()
            }
            None => None,
        };

        eprintln!("[milestone1] phase 6/6: end + kill chromium");
        let end = seat.handle(&json!({ "action": "end" }))?;

        let receipt = json!({
            "milestone": 1,
            "what": "walking skeleton: system Chromium over CDP, one real page snapshotted, one element clicked, replay saved",
            "chrome": start["chrome"],
            "page": {
                "url": first["url"],
                "counts": first["counts"],
                "stats": first["snapshot"]["stats"],
            },
            "click": click,
            "rich_page": rich_result.map(|r| json!({
                "url": r["url"],
                "counts": r["counts"],
                "stats": r["snapshot"]["stats"],
            })),
            "replay": end["replay"],
        });
        Ok(receipt)
    }
}

impl Default for SeatState {
    fn default() -> Self {
        Self::new()
    }
}

/// aria-hidden signal from the AX node's own properties.
fn axtree_role_hidden(node: &Value) -> bool {
    if node
        .get("ignored")
        .and_then(|i| i.as_bool())
        .unwrap_or(false)
    {
        // Chromium's ignored covers aria-hidden AND uninteresting nodes;
        // too coarse to strip on, let CSS rules decide.
    }
    node.get("properties")
        .and_then(|p| p.as_array())
        .map(|props| {
            props.iter().any(|e| {
                e.get("name").and_then(|n| n.as_str()) == Some("hidden")
                    && e.get("value").map(|v| *v == json!(true)).unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

/// M2 — THE AGENT LOOP: snapshot → local qwen2.5-3b on the compute node →
/// one chosen action → replay. The FIRST end-to-end run where a LOCAL model
/// drives the click.
///
/// Laws in force: plan-then-approve (the click goes through the same
/// classifier — a risky target would gate, not run); nothing spends; the
/// model's output is UNTRUSTED data (parsed, never executed); the snapshot
/// cap is reported, never silent. The harness knows ground truth
/// structurally (the page's first link ref) and judges the model's pick.
pub fn agentloop(
    url: &str,
    goal: &str,
    max_turns: u32,
    replay_dir: &Path,
) -> Result<Value, Box<dyn std::error::Error>> {
    let model = qwen::Qwen::from_env()?;
    let budget = qwen::Budget::for_ctx(model.n_ctx);

    let mut seat = SeatState::new();
    eprintln!(
        "[agentloop] model {} (n_ctx {}) via meter key {:?}",
        model.alias, model.n_ctx, model.key_id
    );
    seat.handle(&json!({
        "action": "start",
        "headless": true,
        "replay_dir": replay_dir.display().to_string(),
        "replay_stem": "agentloop",
    }))?;
    seat.ev(
        "agent_start",
        json!({
            "goal": goal,
            "model": {
                "alias": model.alias,
                "artifact": model.model_path,
                "n_ctx": model.n_ctx,
                "meter_key_id": model.key_id,
                "endpoint": qwen::DEFAULT_ENDPOINT,
                "tokenizer_alg": qwen::TOKENIZER_ALG,
            },
            "budget": {
                "n_ctx": budget.n_ctx,
                "template_overhead": budget.template_overhead,
                "reserved_completion": budget.reserved_completion,
                "snapshot_allowance": budget.snapshot_allowance(),
            },
        }),
    );

    seat.handle(&json!({ "action": "navigate", "url": url }))?;

    // snapshot, qwen-fitted: cap ladder descends until the wrapped tree fits
    let allowance = budget.snapshot_allowance() as usize;
    let (nodes, vis, style_errors) = seat.ax_nodes_and_vis()?;
    let mut fitted: Option<(String, usize, usize)> = None; // (wrapped, qwen_n, cap)
    let mut ladder_walked: Vec<Value> = Vec::new();
    let mut final_snap: Option<Value> = None;
    for &cap in qwen::CAP_LADDER {
        let probe = axtree::format_with_cap(&nodes, &vis, cap);
        let origin = {
            let (page, _r) = seat.require_page()?;
            page.current_url()
        };
        let wrapped = untrusted::wrap(&probe.text, &origin);
        let n = model.tokenize(&wrapped)?;
        ladder_walked.push(json!({ "cap": cap, "qwen_tokens": n, "fits": n <= allowance }));
        if n <= allowance {
            let result = seat.snapshot_at_cap(&nodes, &vis, style_errors, cap, Some(n))?;
            let wrapped = result["untrusted_block"].as_str().unwrap_or("").to_string();
            fitted = Some((wrapped, n, cap));
            final_snap = Some(result);
            break;
        }
    }
    let (wrapped, qwen_n, cap_used) = fitted.ok_or_else(|| {
        format!("no cap in the ladder fits: allowance {allowance} qwen tokens, walked {ladder_walked:?}")
    })?;
    let snap_result = final_snap.expect("fitted implies snap result");
    seat.ev(
        "cap_ladder",
        json!({ "walked": ladder_walked, "chosen_cap": cap_used }),
    );
    eprintln!("[agentloop] snapshot fitted: {qwen_n} qwen tokens at cap {cap_used} (allowance {allowance})");

    // ground truth, structural: the page's first interactive link
    let refs = snap_result["snapshot"]["refs"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let expected = refs
        .iter()
        .find(|r| {
            r["role"] == "link"
                && r["name"]["v"]
                    .as_str()
                    .map(|s| !s.is_empty())
                    .unwrap_or(false)
        })
        .cloned();
    let expected_ref = expected
        .as_ref()
        .and_then(|e| e["ref"].as_str())
        .unwrap_or("(no link on page)")
        .to_string();

    // conversation
    let mut conversation = vec![
        json!({ "role": "system", "content": qwen::SYSTEM_PROMPT }),
        json!({ "role": "user", "content": qwen::user_prompt(goal, &wrapped) }),
    ];

    let mut turns_taken: u32 = 0;
    let mut picked: Option<Value> = None;
    let mut executed = false;
    let mut outcome_note = String::new();
    let mut prompt_tokens_total: u64 = 0;
    let mut completion_tokens_total: u64 = 0;

    for turn in 1..=max_turns {
        turns_taken = turn;
        let (content, usage) = model.chat(&conversation, 256)?;
        let p = usage
            .get("prompt_tokens")
            .and_then(|t| t.as_u64())
            .unwrap_or(0);
        let c = usage
            .get("completion_tokens")
            .and_then(|t| t.as_u64())
            .unwrap_or(0);
        prompt_tokens_total += p;
        completion_tokens_total += c;
        seat.ev(
            "model_turn",
            json!({
                "turn": turn,
                "prompt_tokens": p,
                "completion_tokens": c,
                "response": un(&content),
            }),
        );
        eprintln!(
            "[agentloop] turn {turn}: model said: {}",
            content.chars().take(120).collect::<String>()
        );

        match qwen::extract_action(&content) {
            qwen::AgentAction::Click { r#ref } => {
                if seat.last_refs.contains_key(&r#ref) {
                    let right = r#ref == expected_ref;
                    picked = Some(json!({ "ref": r#ref, "right_ref": right }));
                    seat.ev(
                        "model_choice",
                        json!({ "turn": turn, "ref": r#ref, "expected": expected_ref, "right_ref": right }),
                    );
                    let clicked = seat.handle(&json!({
                        "action": "click", "ref": r#ref,
                        "reason": "agentloop — action chosen by the local model",
                    }));
                    match clicked {
                        Ok(c) => {
                            executed = true;
                            outcome_note = format!(
                                "clicked {} → {}",
                                r#ref,
                                c["after"]["url"].as_str().unwrap_or("?")
                            );
                            seat.ev(
                                "model_action_executed",
                                json!({ "ref": r#ref, "result": "clicked" }),
                            );
                            break;
                        }
                        Err(e) => {
                            outcome_note = format!("click {} refused: {e}", r#ref);
                            seat.ev(
                                "model_action_refused",
                                json!({ "ref": r#ref, "reason": e.to_string() }),
                            );
                            conversation.push(json!({ "role": "assistant", "content": content }));
                            conversation.push(json!({
                                "role": "user",
                                "content": format!("The action was refused ({e}). Respond with ONE JSON object: a different valid ref, or {{\"done\": true, \"reason\": \"…\"}}."),
                            }));
                        }
                    }
                } else {
                    outcome_note = format!("model picked nonexistent ref {}", r#ref);
                    seat.ev(
                        "model_choice",
                        json!({ "turn": turn, "ref": r#ref, "valid": false }),
                    );
                    conversation.push(json!({ "role": "assistant", "content": content }));
                    conversation.push(json!({
                        "role": "user",
                        "content": format!("There is no ref {} in the snapshot. Respond with ONE JSON object using a ref that appears in the snapshot, or {{\"done\": true, \"reason\": \"…\"}}.", r#ref),
                    }));
                }
            }
            qwen::AgentAction::Done { reason } => {
                outcome_note = format!("model declared done: {reason}");
                seat.ev(
                    "model_choice",
                    json!({ "turn": turn, "done": true, "reason": reason }),
                );
                break;
            }
            qwen::AgentAction::Unparseable { raw } => {
                outcome_note = "model output unparseable".into();
                seat.ev("model_choice", json!({ "turn": turn, "parse": "failed" }));
                conversation.push(json!({ "role": "assistant", "content": raw }));
                conversation.push(json!({
                    "role": "user",
                    "content": "Respond with ONE JSON object only: {\"click\": \"@eN\"} or {\"done\": true, \"reason\": \"…\"}.",
                }));
            }
        }
    }

    let right_ref = picked
        .as_ref()
        .and_then(|p| p["right_ref"].as_bool())
        .unwrap_or(false);
    seat.ev(
        "agent_end",
        json!({
            "right_ref": right_ref,
            "executed": executed,
            "turns_taken": turns_taken,
            "outcome": outcome_note,
        }),
    );
    let end = seat.handle(&json!({ "action": "end" }))?;

    let receipt = json!({
        "milestone": "M2-agent-loop",
        "what": "first loop where a LOCAL model (qwen2.5-3b on the compute node) chose and drove the click",
        "model": { "alias": model.alias, "n_ctx": model.n_ctx, "meter_key_id": model.key_id },
        "goal": goal,
        "url": url,
        "snapshot": {
            "qwen_tokens": qwen_n,
            "node_cap_used": cap_used,
            "allowance": allowance,
            "counts": snap_result["counts"],
        },
        "expected_ref": expected_ref,
        "picked": picked,
        "right_ref": right_ref,
        "executed": executed,
        "turns_taken": turns_taken,
        "tokens": { "prompt_total": prompt_tokens_total, "completion_total": completion_tokens_total },
        "outcome": outcome_note,
        "replay": end["replay"],
    });
    Ok(receipt)
}
