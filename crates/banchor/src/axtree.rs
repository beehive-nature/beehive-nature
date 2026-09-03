//! ACCESSIBILITY-TREE SNAPSHOT — the durable page representation.
//!
//! bSEAT's eyes are the ACCESSIBILITY TREE, not pixels: roles, names,
//! values, geometry — everything a model needs to act, in a fraction of the
//! tokens a screenshot costs, and greppable by humans afterwards. Element
//! refs (`@e1`, `@e2`, …) are assigned HERE, deterministically in document
//! order, to interactive elements, headings, and images — the click targets
//! of the next `click` call.
//!
//! Two laws are enforced in the formatter itself:
//!   1. STRIP-HIDDEN — nodes classified hidden by visibility.rs never reach
//!      the output (this is "before summarizing", at the source).
//!   2. UNTRUSTED — every name/value is page-supplied. The formatter quotes
//!      and escapes them; the seat wraps the whole block in untrusted
//!      delimiters; nothing inside is ever executed, only shown.

use std::collections::HashMap;

use serde_json::{json, Value};

use crate::visibility::Vis;

/// Roles that get a ref (clickable / actionable / anchor targets).
const REF_ROLES: &[&str] = &[
    "link",
    "button",
    "textbox",
    "searchbox",
    "combobox",
    "checkbox",
    "radio",
    "switch",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "tab",
    "option",
    "heading",
    "image",
    "progressbar",
    "slider",
    "spinbutton",
];

/// Roles whose `value` is worth showing (input-ish).
const VALUE_ROLES: &[&str] = &["textbox", "searchbox", "combobox", "spinbutton", "slider"];

const MAX_NAME: usize = 240;
/// Default emitted-node cap. qwen.rs's CAP_LADDER starts here and descends
/// when the formatted tree overflows the model's context — the cap in use
/// is always reported, never silently applied.
pub const DEFAULT_MAX_NODES: usize = 1200;

#[derive(Debug, Clone)]
pub struct RefEntry {
    pub r#ref: String,
    pub backend: Option<u64>,
    pub role: String,
    pub name: String, // UNTRUSTED, page-supplied
}

#[derive(Debug, Default)]
pub struct Stats {
    pub total: usize,
    pub emitted: usize,
    pub stripped_hidden_tree: usize,
    pub stripped_hidden_node: usize,
    pub stripped_undetermined: usize,
    pub refs: usize,
    pub truncated: bool,
}

pub struct Snapshot {
    pub text: String,
    pub refs: Vec<RefEntry>,
    pub stats: Stats,
}

impl Snapshot {
    pub fn to_json(&self) -> Value {
        json!({
            "refs": self.refs.iter().map(|r| json!({
                "ref": r.r#ref,
                "role": r.role,
                "name": { "__untrusted": true, "v": r.name },
            })).collect::<Vec<_>>(),
            "stats": {
                "ax_nodes_total": self.stats.total,
                "emitted": self.stats.emitted,
                "stripped_hidden_tree": self.stats.stripped_hidden_tree,
                "stripped_hidden_node": self.stats.stripped_hidden_node,
                "stripped_undetermined": self.stats.stripped_undetermined,
                "refs": self.stats.refs,
                "truncated": self.stats.truncated,
            },
            "integrity": format!("sha3-256:{}", crate::b64::sha3_256_b64u(self.text.as_bytes())),
        })
    }
}

// — field extraction, tolerant of CDP shape drift ————————

fn u64_of(v: Option<&Value>) -> Option<u64> {
    match v {
        Some(Value::Number(n)) => n.as_u64(),
        Some(Value::String(s)) => s.parse().ok(),
        _ => None,
    }
}

fn nested_str(node: &Value, field: &str) -> Option<String> {
    node.get(field)?
        .get("value")
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

pub fn backend_id(node: &Value) -> Option<u64> {
    u64_of(node.get("backendDOMNodeId"))
}

pub fn role_of(node: &Value) -> String {
    nested_str(node, "role").unwrap_or_else(|| "unknown".into())
}

pub fn name_of(node: &Value) -> String {
    nested_str(node, "name").unwrap_or_default()
}

fn value_of(node: &Value) -> Option<String> {
    nested_str(node, "value").filter(|s| !s.is_empty())
}

fn ignored(node: &Value) -> bool {
    node.get("ignored")
        .and_then(|i| i.as_bool())
        .unwrap_or(false)
}

fn level_of(node: &Value) -> Option<u64> {
    node.get("properties")
        .and_then(|p| p.as_array())
        .and_then(|props| {
            props
                .iter()
                .find(|e| e.get("name").and_then(|n| n.as_str()) == Some("level"))
                .and_then(|e| u64_of(e.get("value")))
        })
}

fn is_textual(role: &str) -> bool {
    matches!(role, "statictext" | "text" | "inline textbox")
}

fn escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => {}
            '\t' => out.push_str("\\t"),
            _ => out.push(c),
        }
    }
    if out.chars().count() > MAX_NAME {
        let truncated: String = out.chars().take(MAX_NAME).collect();
        out = truncated + "…";
    }
    out
}

/// Format the flat AX node list into the snapshot text.
/// `vis` maps backendNodeId → classification; entries missing from the map
/// are UNDETERMINED (text fails closed = stripped, structure stays).
pub fn format(nodes: &[Value], vis: &HashMap<u64, Vis>) -> Snapshot {
    format_with_cap(nodes, vis, DEFAULT_MAX_NODES)
}

/// Same, with an explicit emitted-node cap (qwen context fitting — the
/// caller reports which cap was used).
pub fn format_with_cap(nodes: &[Value], vis: &HashMap<u64, Vis>, max_nodes: usize) -> Snapshot {
    // index: ax nodeId → position
    let mut by_axid: HashMap<u64, usize> = HashMap::new();
    for (i, n) in nodes.iter().enumerate() {
        if let Some(id) = u64_of(n.get("nodeId")) {
            by_axid.insert(id, i);
        }
    }

    // children: from childIds when present, else derived from parentId
    let mut children: HashMap<usize, Vec<usize>> = HashMap::new();
    let mut roots: Vec<usize> = Vec::new();
    for (i, n) in nodes.iter().enumerate() {
        let mut placed = false;
        if let Some(kids) = n.get("childIds").and_then(|c| c.as_array()) {
            // children recorded on THIS node; fill reverse index below
            for k in kids {
                if let Some(&j) = u64_of(Some(k)).and_then(|id| by_axid.get(&id)) {
                    children.entry(i).or_default().push(j);
                }
            }
        }
        if let Some(pid) = u64_of(n.get("parentId")).filter(|p| *p != 0) {
            if let Some(&pj) = by_axid.get(&pid) {
                if !children.get(&pj).map(|c| c.contains(&i)).unwrap_or(false) {
                    children.entry(pj).or_default().push(i);
                }
                placed = true;
            }
        }
        if !placed && u64_of(n.get("parentId")).is_none() {
            roots.push(i);
        }
    }
    // de-dup roots: exclude nodes that are someone's child
    let mut is_child = vec![false; nodes.len()];
    for (_, kids) in &children {
        for &k in kids {
            is_child[k] = true;
        }
    }
    let roots: Vec<usize> = if !roots.is_empty() {
        roots
    } else {
        (0..nodes.len()).filter(|&i| !is_child[i]).collect()
    };

    let mut snap = Snapshot {
        text: String::new(),
        refs: Vec::new(),
        stats: Stats {
            total: nodes.len(),
            ..Default::default()
        },
    };
    let mut next_ref = 0usize;
    walk(nodes, &children, &roots, vis, &mut snap, &mut next_ref, 0, max_nodes);
    snap
}

#[allow(clippy::too_many_arguments)]
fn walk(
    nodes: &[Value],
    children: &HashMap<usize, Vec<usize>>,
    order: &[usize],
    vis: &HashMap<u64, Vis>,
    snap: &mut Snapshot,
    next_ref: &mut usize,
    depth: usize,
    max_nodes: usize,
) {
    for &i in order {
        if snap.stats.emitted >= max_nodes {
            snap.stats.truncated = true;
            snap.text.push_str(&format!("… [snapshot truncated at node cap {max_nodes}]\n"));
            return;
        }
        let node = &nodes[i];
        let role = role_of(node);
        let name = name_of(node);
        let bid = backend_id(node);
        let kids = children.get(&i).cloned().unwrap_or_default();

        // The ROOT itself may be an ignored container (RootWebArea) — descend.
        let classification = bid.and_then(|b| vis.get(&b).copied());

        if depth > 0 {
            match classification {
                Some(Vis::HiddenTree(_)) => {
                    snap.stats.stripped_hidden_tree += 1 + kids.len();
                    continue; // subtree dies with it
                }
                Some(Vis::HiddenNode(_)) => {
                    snap.stats.stripped_hidden_node += 1;
                    walk(nodes, children, &kids, vis, snap, next_ref, depth + 1, max_nodes);
                    continue; // node's own text dies, children live
                }
                None if is_textual(&role) && !ignored(node) => {
                    // style UNDETERMINED + text = fail CLOSED (strip-hidden law)
                    snap.stats.stripped_undetermined += 1;
                    continue;
                }
                _ => {}
            }
        }

        let emit_this = !ignored(node) || role == "RootWebArea" || role == "WebArea";
        if !emit_this {
            walk(nodes, children, &kids, vis, snap, next_ref, depth + 1, max_nodes);
            continue;
        }

        let mut line = String::new();
        let wants_ref = REF_ROLES.contains(&role.as_str());
        let show_value = VALUE_ROLES.contains(&role.as_str());

        if name.is_empty() && role == "generic" {
            line.push_str("generic:");
        } else {
            line.push_str(&role);
            if let Some(lvl) = level_of(node) {
                line.push_str(&format!(" [level={lvl}]"));
            }
            if !name.is_empty() {
                line.push_str(&format!(" \"{}\"", escape(&name)));
            }
            if show_value {
                if let Some(v) = value_of(node) {
                    line.push_str(&format!(" = \"{}\"", escape(&v)));
                }
            }
        }

        if wants_ref {
            *next_ref += 1;
            let r = format!("@e{next_ref}");
            line.push_str(&format!(" [ref={r}]"));
            snap.refs.push(RefEntry {
                r#ref: r.clone(),
                backend: bid,
                role: role.clone(),
                name: name.clone(),
            });
            snap.stats.refs += 1;
        }

        snap.stats.emitted += 1;
        if depth == 0 {
            snap.text.push_str(&format!("- {line}\n"));
        } else {
            snap.text
                .push_str(&format!("{}- {line}\n", "  ".repeat(depth - 1)));
        }

        walk(nodes, children, &kids, vis, snap, next_ref, depth + 1, max_nodes);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(
        id: u64,
        parent: Option<u64>,
        bid: Option<u64>,
        role: &str,
        name: &str,
        ignored: bool,
    ) -> Value {
        let mut v = json!({ "nodeId": id, "role": { "value": role }, "name": { "value": name }, "ignored": ignored });
        if let Some(p) = parent {
            v["parentId"] = json!(p);
        }
        if let Some(b) = bid {
            v["backendDOMNodeId"] = json!(b);
        }
        v
    }

    #[test]
    fn formats_a_small_tree_with_refs() {
        let nodes = vec![
            node(1, None, Some(10), "WebArea", "Example Domain", false),
            node(2, Some(1), Some(11), "heading", "Example Domain", false),
            node(3, Some(1), Some(12), "paragraph", "", false),
            node(
                4,
                Some(3),
                Some(13),
                "statictext",
                "This domain is for use in examples.",
                false,
            ),
            node(5, Some(1), Some(14), "link", "More information...", false),
        ];
        let mut vis = HashMap::new();
        for b in [10u64, 11, 12, 13, 14] {
            vis.insert(b, Vis::Visible);
        }
        let s = format(&nodes, &vis);
        assert!(s.text.contains("heading \"Example Domain\""));
        assert!(
            s.text.contains("[ref=@e1]"),
            "heading gets first ref: {}",
            s.text
        );
        assert!(s.text.contains("link \"More information...\" [ref=@e2]"));
        assert!(s
            .text
            .contains("statictext \"This domain is for use in examples.\""));
        assert_eq!(s.stats.refs, 2);
        assert_eq!(s.stats.emitted, 5);
    }

    #[test]
    fn hidden_tree_text_never_reaches_output() {
        let nodes = vec![
            node(1, None, Some(10), "WebArea", "Page", false),
            node(2, Some(1), Some(11), "statictext", "visible text", false),
            node(3, Some(1), Some(12), "generic", "", false),
            node(
                4,
                Some(3),
                Some(13),
                "statictext",
                "INJECTED hidden text",
                false,
            ),
        ];
        let vis = HashMap::from([
            (10u64, Vis::Visible),
            (11u64, Vis::Visible),
            (12u64, Vis::HiddenTree("display:none")),
            (13u64, Vis::HiddenTree("display:none")),
        ]);
        let s = format(&nodes, &vis);
        assert!(s.text.contains("visible text"));
        assert!(
            !s.text.contains("INJECTED"),
            "hidden text must not reach the snapshot"
        );
        assert!(s.stats.stripped_hidden_tree >= 1);
    }

    #[test]
    fn low_opacity_node_text_stripped_but_children_kept() {
        let nodes = vec![
            node(1, None, Some(10), "WebArea", "Page", false),
            node(
                2,
                Some(1),
                Some(11),
                "generic",
                "dim container label",
                false,
            ),
            node(3, Some(2), Some(12), "link", "real link", false),
        ];
        let vis = HashMap::from([
            (10u64, Vis::Visible),
            (11u64, Vis::HiddenNode("opacity<0.10")),
            (12u64, Vis::Visible),
        ]);
        let s = format(&nodes, &vis);
        assert!(!s.text.contains("dim container label"));
        assert!(s.text.contains("real link"));
    }

    #[test]
    fn undetermined_text_fails_closed() {
        let nodes = vec![
            node(1, None, None, "WebArea", "Page", false),
            node(
                2,
                Some(1),
                None,
                "statictext",
                "phantom text with no DOM node",
                false,
            ),
        ];
        let s = format(&nodes, &HashMap::new());
        assert!(
            !s.text.contains("phantom"),
            "text with undetermined visibility must not pass"
        );
        assert_eq!(s.stats.stripped_undetermined, 1);
    }

    #[test]
    fn names_are_escaped_and_capped() {
        let long: String = std::iter::repeat('x').take(400).collect();
        let nodes = vec![
            node(1, None, Some(10), "WebArea", "P", false),
            node(
                2,
                Some(1),
                Some(11),
                "button",
                &format!("say \"hi\"\n{}", long),
                false,
            ),
        ];
        let vis = HashMap::from([(10u64, Vis::Visible), (11u64, Vis::Visible)]);
        let s = format(&nodes, &vis);
        assert!(s.text.contains("say \\\"hi\\\"\\n"));
        assert!(s.text.contains('…'));
        assert!(!s.text.contains(&long));
    }

    #[test]
    fn integrity_digest_rides_the_json() {
        let nodes = vec![
            node(1, None, Some(10), "WebArea", "P", false),
            node(2, Some(1), Some(11), "link", "docs", false),
        ];
        let vis = HashMap::from([(10u64, Vis::Visible), (11u64, Vis::Visible)]);
        let j = format(&nodes, &vis).to_json();
        assert!(j["integrity"].as_str().unwrap().starts_with("sha3-256:"));
        assert!(j["refs"][0]["name"]["__untrusted"].as_bool().unwrap());
        assert_eq!(j["refs"][0]["role"], "link");
    }
}
