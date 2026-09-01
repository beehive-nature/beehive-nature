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
        SeatState { browser: None, page: None, replay: None, gate: PlanGate::new(), last_refs: HashMap::new() }
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
        let headless = args.get("headless").and_then(|h| h.as_bool()).unwrap_or(true);
        let replay_dir = args
            .get("replay_dir")
            .and_then(|d| d.as_str())
            .map(PathBuf::from)
            .unwrap_or_else(|| crate::cache::home().join("banchor").join("replays"));
        let stem = args.get("replay_stem").and_then(|s| s.as_str()).unwrap_or("session").to_string();

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
        let url = args.get("url").and_then(|u| u.as_str()).ok_or_else(|| SeatError::Gated("navigate needs url".into()))?;
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
                            vis.insert(b, crate::visibility::classify(&display, &visibility, &opacity, aria_hidden));
                        }
                        Ok(None) => {} // no DOM node behind it
                        Err(_) => style_probe_errors += 1, // undetermined — axtree fails text closed
                    }
                }
            }
        }

        let snap = axtree::format(&nodes, &vis);
        let counts = tokens::count(&snap.text);
        let origin = page.current_url();
        let wrapped = untrusted::wrap(&snap.text, &origin);
        self.last_refs = snap.refs.iter().cloned().map(|r| (r.r#ref.clone(), r)).collect();
        let mut snap_json = snap.to_json();
        if let Some(obj) = snap_json.get_mut("stats").and_then(|s| s.as_object_mut()) {
            obj.insert("style_probe_errors".into(), json!(style_probe_errors));
        }
        self.ev(
            "snapshot",
            json!({
                "page": { "url": { "__untrusted": true, "v": origin } },
                "counts": counts.to_json(),
                "snapshot": snap_json,
            }),
        );
        Ok(json!({
            "url": origin,
            "counts": counts.to_json(),
            "snapshot": snap.to_json(),
            "untrusted_block": wrapped,
        }))
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
            return self.gate_action(args.clone(), risks, format!("click {r} ({}) '{}'", entry.role, entry.name));
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

    fn gate_action(&mut self, action: Value, risks: Vec<Risk>, summary: String) -> Result<Value, SeatError> {
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
        let id = args.get("plan_id").and_then(|p| p.as_str()).ok_or_else(|| SeatError::Gated("plan needs plan_id".into()))?;
        self.gate
            .describe_pending(id)
            .ok_or_else(|| SeatError::Gated("unknown plan id".into()))
    }

    fn approve(&mut self, args: &Value) -> Result<Value, SeatError> {
        let id = args.get("plan_id").and_then(|p| p.as_str()).ok_or_else(|| SeatError::Gated("approve needs plan_id".into()))?;
        let (action, risks) = self.gate.redeem(id).map_err(SeatError::Gated)?;
        self.ev("approved", json!({ "risks": risks.iter().map(|r| r.as_str()).collect::<Vec<_>>() }));
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
        let url = args.get("url").and_then(|u| u.as_str()).ok_or_else(|| SeatError::Gated("resolve needs url".into()))?;
        let record = crate::resolve::resolve_any(url).map_err(|e| SeatError::Gated(e.to_string()))?;
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
        let refs = first["snapshot"]["refs"].as_array().cloned().unwrap_or_default();
        let link = refs.iter().find(|r| r["role"] == "link" && r["name"]["v"].as_str().map(|s| !s.is_empty()).unwrap_or(false));
        eprintln!("[milestone1] phase 4/6: click {:?}", link.map(|l| l["ref"].clone()).unwrap_or(json!(null)));
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
    if node.get("ignored").and_then(|i| i.as_bool()).unwrap_or(false) {
        // Chromium's ignored covers aria-hidden AND uninteresting nodes;
        // too coarse to strip on, let CSS rules decide.
    }
    node.get("properties")
        .and_then(|p| p.as_array())
        .map(|props| {
            props
                .iter()
                .any(|e| e.get("name").and_then(|n| n.as_str()) == Some("hidden") && e.get("value").map(|v| *v == json!(true)).unwrap_or(false))
        })
        .unwrap_or(false)
}
