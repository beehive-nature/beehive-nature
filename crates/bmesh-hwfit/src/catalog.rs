//! Model catalog — known models with resource requirements.
//!
//! VRAM values are approximate from llama.cpp memory calculator and
//! community measurements. min = weights only; recommended = weights +
//! typical KV cache. Mark UNVERIFIED where measured values conflict.

use serde::{Deserialize, Serialize};

const GB: u64 = 1024 * 1024 * 1024;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Quantization {
    Q4KM,
    Q5KM,
    Q6K,
    Q8_0,
    Fp16,
    Fp8,
    Awq,
}

impl Quantization {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Q4KM => "Q4_K_M",
            Self::Q5KM => "Q5_K_M",
            Self::Q6K => "Q6_K",
            Self::Q8_0 => "Q8_0",
            Self::Fp16 => "FP16",
            Self::Fp8 => "FP8",
            Self::Awq => "AWQ",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    pub name: String,
    pub quantization: Quantization,
    pub parameter_count_b: f32,
    pub min_vram_bytes: u64,
    pub recommended_vram_bytes: u64,
    pub context_window: u32,
}

/// Default model catalog for the mesh. TODO: load from TOML for extensibility.
pub fn default_catalog() -> Vec<ModelEntry> {
    vec![
        ModelEntry {
            name: "Qwen3-30B-A3B".into(),
            quantization: Quantization::Q4KM,
            parameter_count_b: 30.0,
            min_vram_bytes: 18 * GB,
            recommended_vram_bytes: 22 * GB,
            context_window: 32768,
        },
        ModelEntry {
            name: "Ornith-1.0-35B".into(),
            quantization: Quantization::Q4KM,
            parameter_count_b: 35.0,
            min_vram_bytes: 21 * GB,
            recommended_vram_bytes: 24 * GB,
            context_window: 262144,
        },
        ModelEntry {
            name: "gpt-oss-20b".into(),
            quantization: Quantization::Q4KM,
            parameter_count_b: 20.0,
            min_vram_bytes: 12 * GB,
            recommended_vram_bytes: 16 * GB,
            context_window: 128000,
        },
        ModelEntry {
            name: "Qwen3-8B".into(),
            quantization: Quantization::Q4KM,
            parameter_count_b: 8.0,
            min_vram_bytes: 6 * GB,
            recommended_vram_bytes: 8 * GB,
            context_window: 32768,
        },
        ModelEntry {
            name: "Kokoro-82M".into(),
            quantization: Quantization::Fp16,
            parameter_count_b: 0.082,
            min_vram_bytes: 0,
            recommended_vram_bytes: GB,
            context_window: 512,
        },
    ]
}
