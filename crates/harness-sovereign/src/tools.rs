//! R3 — harness-owned tool protocol (port of Python B3).
//!
//! Law: the model emits tool calls as fenced ```tool blocks in plain
//! message content; the harness executes them and returns results as
//! OpenAI-shaped `tool` messages. The model backend never sees
//! provider-native tool schemas, so a backend switch cannot break on
//! schema drift. This is the single most load-bearing decision in the
//! spec.
//!
//! Demo toolset: list_files, read_file, compute_sha256, settle_subtask
//! (stub until R6 wires the settlement lane). All file access is jailed
//! to a sandbox directory.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use sha2::{Digest, Sha256};

use crate::backend::ChatMessage;
use crate::settle::SettlementLane;

/// One parsed tool call. Malformed blocks carry `parse_error` and no
/// identity — surfaced to the model as an error result, never a crash.
#[derive(Debug, Clone, PartialEq)]
pub struct ToolCall {
    pub id: Option<String>,
    pub name: Option<String>,
    pub args: serde_json::Value,
    pub parse_error: Option<String>,
}

/// Parse ```tool fenced blocks from assistant text.
///
/// Mirrors Python `TOOL_BLOCK_RE = re.compile(r"```tool\s*\n(.*?)```",
/// re.DOTALL)`: the marker must be followed by a newline (trailing spaces
/// allowed); content runs to the first closing fence; unclosed or
/// same-line markers yield no calls.
pub fn parse_tool_blocks(text: &str) -> Vec<ToolCall> {
    let mut calls = Vec::new();
    let mut rest = text;
    while let Some(start) = rest.find("```tool") {
        let after_marker = &rest["```tool".len() + start..];
        // Same-line content after the marker is not a block (Python's
        // `\s*\n` requires a newline); skip past this marker.
        let line_end = after_marker.find('\n');
        let Some(line_end) = line_end else {
            break;
        };
        if !after_marker[..line_end].trim().is_empty() {
            rest = &after_marker[line_end + 1..];
            continue;
        }
        let content_start = &after_marker[line_end + 1..];
        let Some(fence) = content_start.find("```") else {
            break; // unclosed fence: no call, like the Python
        };
        let raw = content_start[..fence].trim();
        rest = &content_start[fence + "```".len()..];
        calls.push(parse_one_block(raw, calls.len()));
    }
    calls
}

fn parse_one_block(raw: &str, index: usize) -> ToolCall {
    let obj: serde_json::Value = match serde_json::from_str(raw) {
        Ok(obj) => obj,
        Err(error) => {
            return ToolCall {
                id: None,
                name: None,
                args: serde_json::Value::Null,
                parse_error: Some(format!("invalid JSON in tool block: {error}")),
            };
        }
    };
    let name = obj.get("name").and_then(|name| name.as_str());
    let Some(name) = name else {
        return ToolCall {
            id: None,
            name: None,
            args: serde_json::Value::Null,
            parse_error: Some("tool block must be a JSON object with a 'name'".to_string()),
        };
    };
    let id = obj
        .get("id")
        .and_then(|id| id.as_str())
        .map(str::to_string)
        .filter(|id| !id.is_empty())
        .unwrap_or_else(|| format!("auto{index}"));
    let args = obj.get("args").cloned().unwrap_or(serde_json::Value::Null);
    ToolCall {
        id: Some(id),
        name: Some(name.to_string()),
        args,
        parse_error: None,
    }
}

/// The result message shape both backends understand.
pub fn tool_message(tool_call_id: &str, content: impl Into<String>) -> ChatMessage {
    ChatMessage::tool(tool_call_id, content)
}

/// Registry of demo tools, jailed to `sandbox_dir`.
pub struct Toolset {
    sandbox_dir: PathBuf,
    settle_lane: Option<Arc<Mutex<SettlementLane>>>,
}

impl Toolset {
    pub fn new(sandbox_dir: &Path) -> std::io::Result<Self> {
        std::fs::create_dir_all(sandbox_dir)?;
        let sandbox_dir = sandbox_dir.canonicalize()?;
        Ok(Toolset {
            sandbox_dir,
            settle_lane: None,
        })
    }

    /// Attach the settlement lane (R6): `settle_subtask` runs the full
    /// walk instead of answering with the stub. The lane lives behind a
    /// mutex because `execute` is synchronous while runs mutate state.
    pub fn with_settle_lane(mut self, lane: SettlementLane) -> Self {
        self.settle_lane = Some(Arc::new(Mutex::new(lane)));
        self
    }

    pub fn tool_names(&self) -> Vec<&'static str> {
        vec![
            "compute_sha256",
            "list_files",
            "read_file",
            "settle_subtask",
        ]
    }

    /// The tool-protocol contract, stated to the model in plain text.
    /// Verbatim from the Python (the model reads this).
    pub fn system_prompt(&self) -> String {
        [
            "You have tools. To call one, emit a fenced block exactly like this:",
            "```tool",
            "{\"id\": \"t1\", \"name\": \"compute_sha256\", \"args\": {\"target\": \"a.txt\"}}",
            "```",
            "The harness executes the call and returns a `tool` message with the",
            "result. One block per call; use a fresh id per call. Available tools:",
            "- compute_sha256",
            "- list_files",
            "- read_file",
            "- settle_subtask",
            "- compute_sha256 args: {\"target\": \"<filename | 'text:<literal>'>\"}",
            "- read_file args: {\"path\": \"<filename>\"} (sandbox-relative)",
            "- list_files args: {}",
            "- settle_subtask args: {\"subtask_id\": \"<id>\"}",
        ]
        .join("\n")
    }

    /// Execute one parsed call; ALWAYS returns a tool message, never
    /// raises. Tool bugs become error results, never a dead agent loop.
    pub fn execute(&self, call: &ToolCall) -> ChatMessage {
        let cid = call.id.clone().unwrap_or_else(|| "unknown".to_string());
        if let Some(error) = &call.parse_error {
            return tool_message(&cid, format!("[tool error] {error}"));
        }
        let Some(name) = call.name.as_deref() else {
            return tool_message(&cid, "[tool error] unnamed tool call");
        };
        let result = match name {
            "list_files" => self.tool_list_files().map_err(|e| e.to_string()),
            "read_file" => self.tool_read_file(call).map_err(|e| e.to_string()),
            "compute_sha256" => self.tool_compute_sha256(call).map_err(|e| e.to_string()),
            "settle_subtask" => Ok(self.tool_settle_subtask(call)),
            _ => Err(format!(
                "[tool error] unknown tool {name:?}; available: {}",
                self.tool_names().join(", ")
            )),
        };
        match result {
            Ok(text) => tool_message(&cid, text),
            Err(text) if text.starts_with("[tool error]") => tool_message(&cid, text),
            Err(error) => tool_message(&cid, format!("[tool error] {error}")),
        }
    }

    fn resolve(&self, rel: &str) -> Result<PathBuf, String> {
        let joined = self.sandbox_dir.join(rel);
        let resolved = joined
            .canonicalize()
            .map_err(|_| "path escapes the tool sandbox".to_string())?;
        if resolved != self.sandbox_dir && !resolved.starts_with(&self.sandbox_dir) {
            return Err("path escapes the tool sandbox".to_string());
        }
        Ok(resolved)
    }

    fn tool_list_files(&self) -> Result<String, String> {
        let mut entries = Vec::new();
        self.collect_files(&self.sandbox_dir, &mut entries)?;
        entries.sort();
        let mut out = String::from("[\n");
        for (index, entry) in entries.iter().enumerate() {
            let quoted = serde_json::to_string(entry).map_err(|e| e.to_string())?;
            out.push(' ');
            out.push_str(&quoted);
            if index + 1 < entries.len() {
                out.push(',');
            }
            out.push('\n');
        }
        out.push(']');
        Ok(out)
    }

    fn collect_files(&self, dir: &Path, entries: &mut Vec<String>) -> Result<(), String> {
        let read = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
        for entry in read {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                self.collect_files(&path, entries)?;
            } else if let Ok(relative) = path.strip_prefix(&self.sandbox_dir) {
                entries.push(
                    relative
                        .to_string_lossy()
                        .replace(std::path::MAIN_SEPARATOR, "/"),
                );
            }
        }
        Ok(())
    }

    fn tool_read_file(&self, call: &ToolCall) -> Result<String, String> {
        let path = call
            .args
            .get("path")
            .and_then(|path| path.as_str())
            .unwrap_or("");
        let resolved = self.resolve(path)?;
        let data = std::fs::read(&resolved).map_err(|e| e.to_string())?;
        match String::from_utf8(data) {
            Ok(text) => Ok(text),
            Err(error) => {
                let bytes = error.as_bytes();
                let mut hasher = Sha256::new();
                hasher.update(bytes);
                Ok(format!(
                    "[binary file, {} bytes, sha256 {:x}]",
                    bytes.len(),
                    hasher.finalize()
                ))
            }
        }
    }

    fn tool_compute_sha256(&self, call: &ToolCall) -> Result<String, String> {
        let target = call
            .args
            .get("target")
            .and_then(|target| target.as_str())
            .unwrap_or("");
        if let Some(literal) = target.strip_prefix("text:") {
            let mut hasher = Sha256::new();
            hasher.update(literal.as_bytes());
            return Ok(format!("sha256(text) = {:x}", hasher.finalize()));
        }
        let resolved = self.resolve(target)?;
        let data = std::fs::read(&resolved).map_err(|e| e.to_string())?;
        let mut hasher = Sha256::new();
        hasher.update(&data);
        Ok(format!("sha256({target}) = {:x}", hasher.finalize()))
    }

    fn tool_settle_subtask(&self, call: &ToolCall) -> String {
        let subtask = call
            .args
            .get("subtask_id")
            .and_then(|id| id.as_str())
            .unwrap_or("");
        let Some(lane) = &self.settle_lane else {
            return format!(
                "[settlement] B6 lane not wired — no payment executed for \
                 subtask {subtask:?}. Real bSigner-anchored lane is \
                 harness/settle_lane.py (spec §4)."
            );
        };
        let mut lane = match lane.lock() {
            Ok(lane) => lane,
            Err(_) => return "[tool error] settlement lane lock poisoned".to_string(),
        };
        match lane.run_subtask(subtask) {
            Ok(outcome) => indent1(&serde_json::to_value(&outcome).expect("outcome serializes")),
            Err(error) => format!("[tool error] {error}"),
        }
    }
}

/// Indent-1 pretty printer for tool results.
fn indent1(value: &serde_json::Value) -> String {
    fn write(value: &serde_json::Value, level: usize, out: &mut String) {
        let pad = " ".repeat(level);
        let pad_inner = " ".repeat(level + 1);
        match value {
            serde_json::Value::Null => out.push_str("null"),
            serde_json::Value::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
            serde_json::Value::Number(number) => out.push_str(&number.to_string()),
            serde_json::Value::String(text) => {
                out.push_str(&serde_json::to_string(text).expect("string serializes"))
            }
            serde_json::Value::Array(items) => {
                if items.is_empty() {
                    out.push_str("[]");
                    return;
                }
                out.push_str("[\n");
                for (index, item) in items.iter().enumerate() {
                    out.push_str(&pad_inner);
                    write(item, level + 1, out);
                    if index + 1 < items.len() {
                        out.push(',');
                    }
                    out.push('\n');
                }
                out.push_str(&pad);
                out.push(']');
            }
            serde_json::Value::Object(object) => {
                if object.is_empty() {
                    out.push_str("{}");
                    return;
                }
                out.push_str("{\n");
                for (index, (key, item)) in object.iter().enumerate() {
                    out.push_str(&pad_inner);
                    out.push_str(&serde_json::to_string(key).expect("key serializes"));
                    out.push_str(": ");
                    write(item, level + 1, out);
                    if index + 1 < object.len() {
                        out.push(',');
                    }
                    out.push('\n');
                }
                out.push_str(&pad);
                out.push('}');
            }
        }
    }
    let mut out = String::new();
    write(value, 0, &mut out);
    out
}

impl Toolset {
    /// Sandbox inventory for tests: sorted relative paths.
    #[cfg(test)]
    fn debug_entries(&self) -> Vec<String> {
        let mut entries = Vec::new();
        self.collect_files(&self.sandbox_dir, &mut entries).unwrap();
        entries.sort();
        entries
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sandbox(tag: &str) -> (PathBuf, Toolset) {
        let dir =
            std::env::temp_dir().join(format!("harness-tools-test-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let toolset = Toolset::new(&dir).expect("sandbox");
        (dir, toolset)
    }

    #[test]
    fn valid_block_parses_with_id_and_args() {
        let text = "thinking\n```tool\n{\"id\": \"t1\", \"name\": \"compute_sha256\", \"args\": {\"target\": \"a.txt\"}}\n```\ndone";
        let calls = parse_tool_blocks(text);
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].id.as_deref(), Some("t1"));
        assert_eq!(calls[0].name.as_deref(), Some("compute_sha256"));
        assert_eq!(calls[0].parse_error, None);
    }

    #[test]
    fn malformed_json_becomes_error_not_crash() {
        let calls = parse_tool_blocks("```tool\n{not json\n```");
        assert_eq!(calls.len(), 1);
        assert!(calls[0]
            .parse_error
            .as_deref()
            .unwrap_or("")
            .starts_with("invalid JSON in tool block:"));
        assert_eq!(calls[0].id, None);
    }

    #[test]
    fn missing_name_becomes_error() {
        let calls = parse_tool_blocks("```tool\n{\"id\": \"t9\"}\n```");
        assert_eq!(calls.len(), 1);
        assert_eq!(
            calls[0].parse_error.as_deref(),
            Some("tool block must be a JSON object with a 'name'")
        );
    }

    #[test]
    fn missing_id_gets_auto_index() {
        let calls = parse_tool_blocks("```tool\n{\"name\": \"list_files\"}\n```");
        assert_eq!(calls[0].id.as_deref(), Some("auto0"));
    }

    #[test]
    fn same_line_and_unclosed_markers_yield_nothing() {
        assert!(parse_tool_blocks("```tool {\"name\": \"x\"}").is_empty());
        assert!(parse_tool_blocks("```tool\n{\"name\": \"x\"}").is_empty());
    }

    #[test]
    fn jail_refuses_escape() {
        let (_dir, toolset) = sandbox("jail");
        let call = ToolCall {
            id: Some("t1".into()),
            name: Some("read_file".into()),
            args: serde_json::json!({"path": "../escape.txt"}),
            parse_error: None,
        };
        let result = toolset.execute(&call);
        assert_eq!(result.role, "tool");
        assert!(result.content.contains("escapes the tool sandbox"));
    }

    #[test]
    fn list_read_and_hash_roundtrip() {
        let (dir, toolset) = sandbox("roundtrip");
        std::fs::write(dir.join("a.txt"), b"alpha-network-data\n").unwrap();
        let list = toolset.execute(&ToolCall {
            id: Some("t1".into()),
            name: Some("list_files".into()),
            args: serde_json::Value::Null,
            parse_error: None,
        });
        assert!(list.content.contains("\"a.txt\""), "list: {}", list.content);
        let read = toolset.execute(&ToolCall {
            id: Some("t2".into()),
            name: Some("read_file".into()),
            args: serde_json::json!({"path": "a.txt"}),
            parse_error: None,
        });
        assert_eq!(read.content, "alpha-network-data\n");
        let hash = toolset.execute(&ToolCall {
            id: Some("t3".into()),
            name: Some("compute_sha256".into()),
            args: serde_json::json!({"target": "text:alpha-network-data\n"}),
            parse_error: None,
        });
        assert!(
            hash.content.starts_with("sha256(text) = "),
            "hash: {}",
            hash.content
        );
        assert_eq!(hash.content.len(), "sha256(text) = ".len() + 64);
        std::fs::remove_dir_all(&dir).ok();
    }
}
