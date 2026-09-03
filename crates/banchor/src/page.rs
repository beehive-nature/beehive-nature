//! PAGE SESSION — one CDP-attached tab: navigate, wait, read, click.
//!
//! The durable path is ACCESSIBILITY + GEOMETRY ONLY:
//!   - the page's structure comes from `Accessibility.getFullAXTree`,
//!   - a click is real input: `Input.dispatchMouseEvent` at the element's
//!     box-model center, the same events a human's trackpad produces,
//!   - the CDP screenshot method is used NOWHERE in this crate — the lane
//!     law "NO screenshot vision on the durable path" is self-enforced (see
//!     tests below: the method name is asserted absent from this file's own
//!     source, so a regression has to delete the test to sneak through).

use std::time::{Duration, Instant};

use serde_json::{json, Value};

use crate::cdp::{http_json, CdpConn, CdpError};

pub struct PageSession {
    pub port: u16,
    pub target_id: String,
    pub conn: CdpConn,
}

#[derive(Debug)]
pub struct ClickOutcome {
    pub ref_id: String,
    pub role: String,
    pub name: String, // UNTRUSTED — page-supplied
    pub coords: (f64, f64),
    pub url_before: String,
    pub url_after: String,
    pub navigated: bool,
}

impl PageSession {
    /// Open a new tab at `url` and attach to it over WebSocket.
    pub fn open(port: u16, url: &str) -> Result<PageSession, CdpError> {
        let info = http_json(port, "PUT", &format!("/json/new?url={}", encode_url(url)))?;
        let ws_url = info
            .get("webSocketDebuggerUrl")
            .and_then(|w| w.as_str())
            .ok_or_else(|| CdpError::Shape("no webSocketDebuggerUrl in /json/new".into()))?
            .to_string();
        let target_id = info
            .get("id")
            .and_then(|i| i.as_str())
            .unwrap_or("")
            .to_string();
        let mut conn = CdpConn::connect(&ws_url)?;
        for (m, p) in [
            ("Page.enable", json!({})),
            ("Runtime.enable", json!({})),
            ("DOM.enable", json!({})),
            ("CSS.enable", json!({})),
        ] {
            conn.call(m, p)?;
        }
        // bind the DOM agent to the document — required before any
        // pushNodesByBackendIdsToFrontend ("Document needs to be requested
        // first", learned live on Chrome 151)
        conn.call("DOM.getDocument", json!({ "depth": 0 }))?;
        Ok(PageSession {
            port,
            target_id,
            conn,
        })
    }

    /// Navigate and wait for `document.readyState === "complete"` (or timeout).
    pub fn navigate(&mut self, url: &str) -> Result<(), CdpError> {
        self.conn.call("Page.navigate", json!({ "url": url }))?;
        self.wait_ready(Duration::from_secs(20));
        // new document → re-bind the DOM agent
        self.conn.call("DOM.getDocument", json!({ "depth": 0 }))?;
        Ok(())
    }

    fn wait_ready(&mut self, timeout: Duration) {
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if let Ok(Some(state)) = self.eval_string("document.readyState") {
                if state == "complete" {
                    return;
                }
            }
            std::thread::sleep(Duration::from_millis(120));
        }
        // fall-through: best effort; snapshot will reflect whatever loaded
    }

    /// Evaluate a JS expression, return its string value (our own JS, whose
    /// OUTPUT is treated as untrusted downstream — never the reverse).
    pub fn eval_string(&mut self, expression: &str) -> Result<Option<String>, CdpError> {
        let res = self.conn.call(
            "Runtime.evaluate",
            json!({ "expression": expression, "returnByValue": true }),
        )?;
        Ok(res
            .pointer("/result/value")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()))
    }

    pub fn current_url(&mut self) -> String {
        self.eval_string("location.href")
            .unwrap_or_default()
            .unwrap_or_default()
    }

    pub fn title(&mut self) -> String {
        self.eval_string("document.title")
            .unwrap_or_default()
            .unwrap_or_default()
    }

    /// The full accessibility tree (flat node list) — the snapshot's source.
    pub fn ax_tree(&mut self) -> Result<Vec<Value>, CdpError> {
        let res = self
            .conn
            .call("Accessibility.getFullAXTree", json!({ "depth": 64 }))?;
        let nodes = res
            .get("nodes")
            .and_then(|n| n.as_array())
            .cloned()
            .ok_or_else(|| CdpError::Shape("no nodes in AX tree".into()))?;
        Ok(nodes)
    }

    /// Computed style strings for the DOM element behind `backend_node_id`.
    /// Returns (display, visibility, opacity) or None if unresolvable.
    pub fn style_for_backend(
        &mut self,
        backend_node_id: u64,
    ) -> Result<Option<(String, String, String)>, CdpError> {
        let pushed = self.conn.call(
            "DOM.pushNodesByBackendIdsToFrontend",
            json!({ "backendNodeIds": [backend_node_id] }),
        )?;
        let node_id = match first_node_id(&pushed) {
            Some(n) if n > 0 => n,
            _ => return Ok(None),
        };
        let styles = self
            .conn
            .call("CSS.getComputedStyleForNode", json!({ "nodeId": node_id }))?;
        let arr = styles
            .get("computedStyle")
            .and_then(|c| c.as_array())
            .ok_or_else(|| CdpError::Shape("no computedStyle array".into()))?;
        let get = |name: &str| -> String {
            arr.iter()
                .find(|e| e.get("name").and_then(|n| n.as_str()) == Some(name))
                .and_then(|e| e.get("value"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        };
        Ok(Some((get("display"), get("visibility"), get("opacity"))))
    }

    /// Resolve a backend node id to its box-model center (viewport CSS px).
    pub fn box_center(&mut self, backend_node_id: u64) -> Result<Option<(f64, f64)>, CdpError> {
        let pushed = self.conn.call(
            "DOM.pushNodesByBackendIdsToFrontend",
            json!({ "backendNodeIds": [backend_node_id] }),
        )?;
        let node_id = match first_node_id(&pushed) {
            Some(n) if n > 0 => n,
            _ => return Ok(None),
        };
        let model = self
            .conn
            .call("DOM.getBoxModel", json!({ "nodeId": node_id }))?;
        let quad = model
            .pointer("/model/content")
            .and_then(|c| c.as_array())
            .ok_or_else(|| CdpError::Shape("no content quad".into()))?;
        let nums: Vec<f64> = quad.iter().filter_map(|v| v.as_f64()).collect();
        if nums.len() != 8 {
            return Err(CdpError::Shape(format!("quad not 8 floats: {nums:?}")));
        }
        let cx = (nums[0] + nums[2] + nums[4] + nums[6]) / 4.0;
        let cy = (nums[1] + nums[3] + nums[5] + nums[7]) / 4.0;
        Ok(Some((cx, cy)))
    }

    /// Dispatch a real mouse click (pressed + released) at viewport coords.
    pub fn dispatch_click(&mut self, x: f64, y: f64) -> Result<(), CdpError> {
        for typ in ["mousePressed", "mouseReleased"] {
            self.conn.call(
                "Input.dispatchMouseEvent",
                json!({ "type": typ, "x": x, "y": y, "button": "left", "clickCount": 1 }),
            )?;
        }
        Ok(())
    }

    /// Click behind `backend_node_id`; wait out any resulting navigation.
    pub fn click_backend(&mut self, backend_node_id: u64) -> Result<Option<(f64, f64)>, CdpError> {
        let center = self.box_center(backend_node_id)?;
        if let Some((x, y)) = center {
            self.dispatch_click(x, y)?;
            // give same-tab navigations a moment, then settle readiness
            std::thread::sleep(Duration::from_millis(400));
            self.wait_ready(Duration::from_secs(10));
        }
        Ok(center)
    }

    pub fn close(&mut self) {
        if !self.target_id.is_empty() {
            let _ = http_json(self.port, "PUT", &format!("/json/close/{}", self.target_id));
        }
    }
}

/// Plural-form reply helper: {"nodeIds":[n,…]} → first n.
fn first_node_id(resp: &serde_json::Value) -> Option<i64> {
    resp.get("nodeIds")
        .and_then(|ids| ids.as_array())
        .and_then(|a| a.first())
        .and_then(|v| v.as_i64())
        .or_else(|| resp.get("nodeId").and_then(|n| n.as_i64()))
}

/// Minimal URL encode for the /json/new query param (spaces, quotes, &).
fn encode_url(url: &str) -> String {
    let mut out = String::with_capacity(url.len());
    for b in url.bytes() {
        match b {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'~'
            | b'/'
            | b':'
            | b'?'
            | b'='
            | b'%' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// THE NO-SCREENSHOT LAW, self-enforcing: the durable path speaks structure,
/// never pixels. If someone adds vision, they must delete this test to do it.
/// (The needle is assembled at runtime so this source file never spells it.)
#[cfg(test)]
mod tests {
    const SRC: &str = include_str!("page.rs");

    #[test]
    fn no_screenshot_on_the_durable_path() {
        let needle = ["capture", "Screenshot"].concat();
        assert!(
            !SRC.contains(&needle),
            "the lane law is NO screenshot vision on the durable path — page.rs must not speak pixels"
        );
    }

    #[test]
    fn url_encoding_leaves_paths_alone() {
        assert_eq!(
            super::encode_url("https://example.com/a b?q=1"),
            "https://example.com/a%20b?q=1"
        );
    }
}
