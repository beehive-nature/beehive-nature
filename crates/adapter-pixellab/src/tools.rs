//! Tool surface and budget guard. Two tools, deliberately: one MCP command
//! per agent replaces buzz's own tools, so every tool here is a tool buzz
//! loses. This surface is exactly the art lane and nothing else.

use base64::Engine;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

use crate::pixellab::{self, GenerateRequest, Transport};
use crate::storage;

/// USD-denominated budget. Per-call cost is not declared in the OpenAPI, so
/// spend is *measured* as the before/after balance delta and accumulated
/// here. The cap refuses further generation once reached.
pub struct Budget {
    cap_usd: Option<f64>,
    spent: Mutex<f64>,
    counter: Mutex<u64>,
}

impl Budget {
    pub fn new(cap: Option<f64>) -> Self {
        Self {
            cap_usd: cap,
            spent: Mutex::new(0.0),
            counter: Mutex::new(0),
        }
    }

    fn gate(&self) -> Result<(), String> {
        if let Some(cap) = self.cap_usd {
            let s = *self.spent.lock().unwrap();
            if s >= cap {
                return Err(format!(
                    "session spend cap reached: spent {s:.4} USD of cap {cap:.4} USD"
                ));
            }
        }
        Ok(())
    }

    fn add(&self, usd: Option<f64>) {
        if let Some(u) = usd {
            *self.spent.lock().unwrap() += u;
        }
    }

    fn spent(&self) -> f64 {
        *self.spent.lock().unwrap()
    }

    fn next_id(&self) -> u64 {
        let mut c = self.counter.lock().unwrap();
        *c += 1;
        *c
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
struct GenerateArgs {
    prompt: String,
    style_image_path: Option<String>,
    init_image_path: Option<String>,
    color_image_path: Option<String>,
    layer_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    no_background: Option<bool>,
    seed: Option<i64>,
    style_strength: Option<i32>,
    outline: Option<String>,
    detail: Option<String>,
    shading: Option<String>,
    negative_description: Option<String>,
}

pub fn tools_json() -> Value {
    json!([generate_image_def(), get_balance_def()])
}

fn generate_image_def() -> Value {
    let input_schema = json!({
        "type": "object",
        "properties": {
            "prompt": { "type": "string", "description": "Text description of the image" },
            "style_image_path": { "type": "string", "description": "Path to a style anchor PNG; its presence routes the call to bitforge (style transfer)" },
            "init_image_path": { "type": "string", "description": "Path to an init image for image-to-image" },
            "color_image_path": { "type": "string", "description": "Path to a palette reference; forces the output palette" },
            "layer_name": { "type": "string", "description": "Opaque label used in the output filename; the adapter attaches no meaning to it" },
            "width": { "type": "integer", "minimum": 16, "maximum": 200, "default": 96 },
            "height": { "type": "integer", "minimum": 16, "maximum": 200, "default": 96 },
            "no_background": { "type": "boolean", "default": true, "description": "Request transparency (alpha) from the generator" },
            "seed": { "type": "integer" },
            "style_strength": { "type": "integer", "minimum": 0, "maximum": 100 },
            "outline": { "type": "string", "enum": pixellab::OUTLINE_VALUES },
            "detail": { "type": "string", "enum": pixellab::DETAIL_VALUES },
            "shading": { "type": "string", "enum": pixellab::SHADING_VALUES },
            "negative_description": { "type": "string" }
        },
        "required": ["prompt"]
    });
    json!({
        "name": "generate_image",
        "description": "Generate one pixel-art image: prompt + optional style anchor -> PNG with alpha, written to storage, text handle returned. Balance-checked before and after; refuses past the session spend cap.",
        "inputSchema": input_schema
    })
}

fn get_balance_def() -> Value {
    let input_schema = json!({ "type": "object", "properties": {} });
    json!({
        "name": "get_balance",
        "description": "Fetch the current USD credit balance and this session's measured spend. Costs nothing.",
        "inputSchema": input_schema
    })
}

pub async fn execute<T: Transport>(
    transport: &Arc<T>,
    config: &Arc<crate::ServerConfig>,
    budget: &Arc<Budget>,
    name: &str,
    arguments: &Value,
) -> Result<Value, String> {
    match name {
        "generate_image" => generate(transport, config, budget, arguments).await,
        "get_balance" => balance(transport, budget).await,
        _ => Err(format!("unknown tool: {name}")),
    }
}

async fn balance<T: Transport>(transport: &Arc<T>, budget: &Arc<Budget>) -> Result<Value, String> {
    let usd = pixellab::get_balance(transport.as_ref())
        .await
        .map_err(|e| format!("balance fetch failed: {e}"))?;
    Ok(json!({
        "usd": usd,
        "session": { "spent_usd": budget.spent(), "cap_usd": budget.cap_usd }
    }))
}

async fn generate<T: Transport>(
    transport: &Arc<T>,
    config: &Arc<crate::ServerConfig>,
    budget: &Arc<Budget>,
    arguments: &Value,
) -> Result<Value, String> {
    let args: GenerateArgs =
        serde_json::from_value(arguments.clone()).map_err(|e| format!("bad arguments: {e}"))?;

    let width = args.width.unwrap_or(96);
    let height = args.height.unwrap_or(96);
    pixellab::validate_size(width, height)?;
    if let Some(v) = &args.outline {
        pixellab::validate_enum("outline", v, pixellab::OUTLINE_VALUES)?;
    }
    if let Some(v) = &args.detail {
        pixellab::validate_enum("detail", v, pixellab::DETAIL_VALUES)?;
    }
    if let Some(v) = &args.shading {
        pixellab::validate_enum("shading", v, pixellab::SHADING_VALUES)?;
    }

    let layer = storage::sanitize_layer(args.layer_name.as_deref());
    let style_b64 = read_image_arg(args.style_image_path.as_deref())?;
    let init_b64 = read_image_arg(args.init_image_path.as_deref())?;
    let color_b64 = read_image_arg(args.color_image_path.as_deref())?;

    // Balance before — a failed fetch is never a value: refuse rather than
    // spend blind.
    let before = pixellab::get_balance(transport.as_ref())
        .await
        .map_err(|e| format!("pre-spend balance check failed, refusing to generate: {e}"))?;
    budget.gate()?;

    let seed_json = if let Some(s) = args.seed {
        json!(s)
    } else {
        Value::Null
    };
    let req = GenerateRequest {
        description: args.prompt,
        negative_description: args.negative_description,
        width,
        height,
        no_background: args.no_background.unwrap_or(true),
        seed: args.seed,
        outline: args.outline,
        detail: args.detail,
        shading: args.shading,
        style_image_b64: style_b64.clone(),
        style_strength: args.style_strength,
        init_image_b64: init_b64,
        color_image_b64: color_b64,
    };

    let gen = if style_b64.is_some() {
        pixellab::generate_bitforge(transport.as_ref(), &req).await
    } else {
        pixellab::generate_pixflux(transport.as_ref(), &req).await
    }
    .map_err(|e| format!("generation failed: {e}"))?;

    // Balance after — tolerate the fetch failing, but never fabricate a
    // number for it.
    let (after, after_err) = match pixellab::get_balance(transport.as_ref()).await {
        Ok(v) => (Some(v), None),
        Err(e) => (None, Some(e.to_string())),
    };
    let spent_this_call = match (before, after) {
        (b, Some(a)) => Some((b - a).max(0.0)),
        _ => None,
    };
    budget.add(spent_this_call);

    let png_bytes = base64::engine::general_purpose::STANDARD
        .decode(&gen.image_b64)
        .map_err(|e| format!("response image is not valid base64: {e}"))?;
    storage::assert_png(&png_bytes)?;

    let id = budget.next_id();
    let path = storage::write_png(&config.out_dir, &layer, id, &png_bytes)
        .map_err(|e| format!("writing PNG: {e}"))?;

    let mut balance_json = json!({
        "before": before,
        "after": after,
        "spent_this_call": spent_this_call,
    });
    if let Some(err) = after_err {
        balance_json["after_fetch_failed"] = json!(err);
    }

    Ok(json!({
        "layer": layer,
        "path": path.to_string_lossy(),
        "png_bytes": png_bytes.len(),
        "width": width,
        "height": height,
        "seed": seed_json,
        "endpoint": gen.endpoint,
        "usage": gen.usage,
        "balance": balance_json,
        "session": { "spent_usd": budget.spent(), "cap_usd": budget.cap_usd },
    }))
}

fn read_image_arg(p: Option<&str>) -> Result<Option<String>, String> {
    match p {
        None => Ok(None),
        Some(path) => {
            let bytes = std::fs::read(path).map_err(|e| format!("read {path}: {e}"))?;
            storage::assert_png(&bytes).map_err(|e| format!("{path}: {e}"))?;
            Ok(Some(
                base64::engine::general_purpose::STANDARD.encode(bytes),
            ))
        }
    }
}
