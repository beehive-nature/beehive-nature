use crate::{
    absolute_path, contained_path, read_bounded, valid_rel, Result, MAX_ENTRIES, MAX_TOTAL_BYTES,
};
use regex::Regex;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

enum Token {
    Word(String),
    Quoted(String, bool),
    Symbol(u8),
    Template,
    Regexp,
    ControlClose,
}

fn regexp_position(tokens: &[Token]) -> Result<bool> {
    Ok(match tokens.last() {
        None | Some(Token::ControlClose) => true,
        Some(Token::Symbol(b'}')) => {
            return Err("SDK module graph has an unsupported ambiguous slash after a brace".into())
        }
        Some(Token::Symbol(byte @ (b'+' | b'-'))) if matches!(tokens.get(tokens.len().saturating_sub(2)), Some(Token::Symbol(previous)) if previous == byte) =>
        {
            return Err(
                "SDK module graph has an unsupported ambiguous slash after increment/decrement"
                    .into(),
            );
        }
        Some(Token::Symbol(
            b'(' | b'{' | b'[' | b'=' | b',' | b':' | b';' | b'?' | b'!' | b'~' | b'&' | b'|'
            | b'+' | b'-' | b'*' | b'/' | b'%' | b'^' | b'<' | b'>',
        )) => true,
        Some(Token::Word(word))
            if matches!(
                word.as_str(),
                "return"
                    | "throw"
                    | "case"
                    | "delete"
                    | "typeof"
                    | "void"
                    | "new"
                    | "yield"
                    | "await"
                    | "in"
                    | "instanceof"
                    | "else"
                    | "do"
            ) =>
        {
            !matches!(
                tokens.get(tokens.len().saturating_sub(2)),
                Some(Token::Symbol(b'.'))
            )
        }
        _ => false,
    })
}

// This small lexer supports the pinned SDK's static import/export declarations,
// side-effect imports, and literal dynamic imports. It skips comments and string
// contents. It is not a general JavaScript execution/dependency proof: worker and
// WASM URL construction are covered by the explicit entry list and pin inventory.
fn imports(source: &str) -> Result<Vec<String>> {
    let bytes = source.as_bytes();
    let mut tokens = Vec::new();
    let mut parentheses = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        if tokens.len() >= 262_144 {
            return Err("SDK module token count exceeds limit".into());
        }
        let byte = bytes[index];
        if byte.is_ascii_whitespace() {
            index += 1;
        } else if bytes[index..].starts_with(b"//") {
            index += 2;
            while index < bytes.len()
                && !matches!(bytes[index], b'\n' | b'\r')
                && !bytes[index..].starts_with(&[0xe2, 0x80, 0xa8])
                && !bytes[index..].starts_with(&[0xe2, 0x80, 0xa9])
            {
                index += 1;
            }
        } else if bytes[index..].starts_with(b"/*") {
            index += 2;
            while index + 1 < bytes.len() && !bytes[index..].starts_with(b"*/") {
                index += 1;
            }
            if index + 1 >= bytes.len() {
                return Err("unterminated JavaScript comment".into());
            }
            index += 2;
        } else if byte == b'/' && regexp_position(&tokens)? {
            index += 1;
            let mut class = false;
            let mut closed = false;
            while index < bytes.len() {
                match bytes[index] {
                    b'\\' => {
                        index += 2;
                        continue;
                    }
                    b'[' => class = true,
                    b']' => class = false,
                    b'/' if !class => {
                        index += 1;
                        closed = true;
                        break;
                    }
                    b'\n' | b'\r' => return Err("unterminated JavaScript regexp".into()),
                    _ => {}
                }
                index += 1;
            }
            if !closed {
                return Err("unterminated JavaScript regexp".into());
            }
            while index < bytes.len() && bytes[index].is_ascii_alphabetic() {
                index += 1;
            }
            tokens.push(Token::Regexp);
        } else if matches!(byte, b'\'' | b'"' | b'`') {
            let quote = byte;
            index += 1;
            let start = index;
            let mut escaped = false;
            while index < bytes.len() && bytes[index] != quote {
                if bytes[index] == b'\\' {
                    escaped = true;
                    index += 1;
                }
                index += 1;
            }
            if index >= bytes.len() {
                return Err("unterminated JavaScript string".into());
            }
            if quote == b'`' {
                static IMPORT_WORD: OnceLock<Regex> = OnceLock::new();
                let body = &source[start..index];
                if body.contains("${")
                    && IMPORT_WORD
                        .get_or_init(|| Regex::new(r"\bimport\b").expect("constant import regex"))
                        .is_match(body)
                {
                    return Err(
                        "SDK module graph has an unsupported import in template interpolation"
                            .into(),
                    );
                }
                tokens.push(Token::Template);
            } else {
                tokens.push(Token::Quoted(source[start..index].to_string(), escaped));
            }
            index += 1;
        } else if byte.is_ascii_alphabetic() || byte == b'_' || byte == b'$' {
            let start = index;
            index += 1;
            while index < bytes.len()
                && (bytes[index].is_ascii_alphanumeric() || matches!(bytes[index], b'_' | b'$'))
            {
                index += 1;
            }
            tokens.push(Token::Word(source[start..index].to_string()));
        } else if byte == b'(' {
            let control = matches!(tokens.last(), Some(Token::Word(word)) if matches!(word.as_str(), "if" | "while" | "for" | "with" | "switch" | "catch"));
            parentheses.push(control);
            tokens.push(Token::Symbol(byte));
            index += 1;
        } else if byte == b')' {
            let control = parentheses
                .pop()
                .ok_or_else(|| "unbalanced JavaScript parentheses".to_string())?;
            tokens.push(if control {
                Token::ControlClose
            } else {
                Token::Symbol(byte)
            });
            index += 1;
        } else {
            tokens.push(Token::Symbol(byte));
            index += 1;
        }
    }
    let mut found = Vec::new();
    for (index, token) in tokens.iter().enumerate() {
        let Token::Word(word) = token else {
            continue;
        };
        let candidate = if word == "from" {
            tokens.get(index + 1)
        } else if word == "import" {
            if matches!(tokens.get(index + 1), Some(Token::Symbol(b'('))) {
                if !matches!(tokens.get(index + 2), Some(Token::Quoted(_, _)))
                    || !matches!(tokens.get(index + 3), Some(Token::Symbol(b')')))
                {
                    return Err(
                        "SDK module graph has an unsupported nonliteral dynamic import".into(),
                    );
                }
                tokens.get(index + 2)
            } else {
                tokens.get(index + 1)
            }
        } else {
            None
        };
        if let Some(Token::Quoted(specifier, escaped)) = candidate {
            if *escaped {
                return Err("SDK module graph has an unsupported escaped import".into());
            }
            found.push(specifier.clone());
            if found.len() > MAX_ENTRIES {
                return Err("SDK module import count exceeds limit".into());
            }
        }
    }
    Ok(found)
}

fn resolve_import(current: &str, specifier: &str) -> Result<String> {
    if specifier
        .chars()
        .any(|c| matches!(c, '\\' | ':' | '?' | '#' | '\0'))
        || !(specifier.starts_with("./") || specifier.starts_with("../"))
    {
        return Err(format!("unsupported relative SDK import {specifier}"));
    }
    let mut parts: Vec<&str> = current.split('/').collect();
    parts.pop();
    for part in specifier.split('/') {
        match part {
            "." => {}
            ".." => {
                if parts.pop().is_none() {
                    return Err(format!("{current} escapes to {specifier}"));
                }
            }
            "" => return Err(format!("noncanonical SDK import {specifier}")),
            name => parts.push(name),
        }
    }
    let rel = parts.join("/");
    valid_rel(&rel)?;
    Ok(rel)
}

pub(crate) fn check(request: &Value, reader: bool) -> Result<Value> {
    let dir = absolute_path(request, "dir")?;
    let root = fs::canonicalize(&dir).map_err(|error| format!("{}: {error}", dir.display()))?;
    if !root.is_dir() {
        return Err(format!("{} is not a directory", root.display()));
    }
    let defaults: &[&str] = if reader {
        &[
            "index.js",
            "client.js",
            "file-reader.js",
            "manifest.js",
            "pointers.js",
        ]
    } else {
        &[
            "index.js",
            "client.js",
            "file-reader.js",
            "save.js",
            "upload-worker.js",
        ]
    };
    let entries = match request.get("entries").filter(|value| !value.is_null()) {
        Some(value) => value
            .as_array()
            .ok_or_else(|| "entries must be an array".to_string())?
            .iter()
            .map(|entry| {
                entry
                    .as_str()
                    .map(str::to_string)
                    .ok_or_else(|| "entries must be strings".to_string())
            })
            .collect::<Result<Vec<_>>>()?,
        None => defaults.iter().map(|entry| entry.to_string()).collect(),
    };
    if entries.is_empty() || entries.len() > MAX_ENTRIES {
        return Err("entry count outside allowed range".into());
    }
    let mut pending = Vec::new();
    for entry in entries.into_iter().rev() {
        valid_rel(&entry)?;
        if reader
            && root.file_name().and_then(|name| name.to_str()) == Some("0.1.2")
            && matches!(entry.as_str(), "manifest.js" | "pointers.js")
        {
            match fs::symlink_metadata(root.join(&entry)) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                Err(error) => return Err(format!("{entry}: {error}")),
                Ok(_) => {}
            }
        }
        pending.push(entry);
    }
    let mut seen = BTreeSet::new();
    let mut order = Vec::new();
    let mut total_bytes = 0u64;
    let mut edge_count = 0usize;
    while let Some(rel) = pending.pop() {
        if !seen.insert(rel.clone()) {
            continue;
        }
        if seen.len() > MAX_ENTRIES {
            return Err("SDK module graph exceeds visit limit".into());
        }
        let bytes = read_bounded(&contained_path(&root, &rel)?)?;
        total_bytes += bytes.len() as u64;
        if total_bytes > MAX_TOTAL_BYTES {
            return Err("SDK module graph exceeds byte limit".into());
        }
        let source = std::str::from_utf8(&bytes).map_err(|error| format!("{rel}: {error}"))?;
        order.push(rel.clone());
        let imports = imports(source)?;
        edge_count += imports.len();
        if edge_count > MAX_ENTRIES * 4 {
            return Err("SDK module graph exceeds edge limit".into());
        }
        for specifier in imports.into_iter().rev() {
            if !(specifier.starts_with("./") || specifier.starts_with("../")) {
                if reader {
                    return Err(format!(
                        "reader closure pulls external modules: {rel} imports {specifier}"
                    ));
                }
                continue;
            }
            let target = resolve_import(&rel, &specifier)?;
            let path = contained_path(&root, &target)?;
            if !path.is_file() {
                return Err(format!(
                    "SDK import is not a regular file: {rel} -> {specifier}"
                ));
            }
            if matches!(
                Path::new(&target)
                    .extension()
                    .and_then(|extension| extension.to_str()),
                Some("js" | "mjs")
            ) {
                pending.push(target);
            }
        }
    }
    if reader {
        Ok(json!(order))
    } else {
        Ok(Value::Bool(true))
    }
}
