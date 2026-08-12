//! Hardware profiling for mesh nodes.
//!
//! STUB: actual GPU/CPU/RAM detection will use `nvml-wrapper` (NVIDIA)
//! and `sysinfo` (cross-platform). This module exposes types and a manual
//! constructor. Auto-detection is TODO (D7 phase 2).

use serde::{Deserialize, Serialize};

/// A node's hardware profile — what the scorer matches against.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeProfile {
    /// GPU VRAM in bytes. None = no CUDA GPU detected.
    pub gpu_vram_bytes: Option<u64>,
    /// GPU model name (e.g. "RTX 4090").
    pub gpu_name: Option<String>,
    /// Number of logical CPU cores.
    pub cpu_cores: u32,
    /// Total system RAM in bytes.
    pub ram_bytes: u64,
    /// CPU architecture string.
    pub arch: String,
}

impl NodeProfile {
    /// Construct a profile manually.
    pub fn manual(
        gpu_vram_bytes: Option<u64>,
        gpu_name: Option<impl Into<String>>,
        cpu_cores: u32,
        ram_bytes: u64,
        arch: &str,
    ) -> Self {
        Self {
            gpu_vram_bytes,
            gpu_name: gpu_name.map(|n| n.into()),
            cpu_cores,
            ram_bytes,
            arch: arch.to_string(),
        }
    }

    /// Auto-detect hardware profile from the running system.
    /// Uses sysinfo (MIT, L-VERIFIED) for CPU count and total RAM.
    /// GPU detection: NOT IMPLEMENTED — nvml-wrapper license UNVERIFIED
    /// (dropped per L-VERIFY law; re-add when license is readable).
    pub fn auto_detect() -> Self {
        let sys = sysinfo::System::new_all();
        Self {
            gpu_vram_bytes: None,
            gpu_name: None,
            cpu_cores: sys.cpus().len() as u32,
            ram_bytes: sys.total_memory(),
            arch: std::env::consts::ARCH.to_string(),
        }
    }
}
