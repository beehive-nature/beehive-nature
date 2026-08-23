//! Fit scoring — matches models to nodes. The core D7 algorithm.

use crate::catalog::ModelEntry;
use crate::profiler::NodeProfile;

/// Result of scoring a model against a node.
#[derive(Debug, Clone)]
pub struct FitScore {
    pub can_fit: bool,
    pub score: f32,
    pub reason: String,
}

/// Score one model against one node. VRAM is primary constraint.
/// CPU-only models (min_vram_bytes == 0) skip the VRAM check.
pub fn fit_score(node: &NodeProfile, model: &ModelEntry) -> FitScore {
    let q = model.quantization.as_str();

    if model.min_vram_bytes == 0 {
        let can = node.ram_bytes >= model.recommended_vram_bytes;
        return FitScore {
            can_fit: true,
            score: if can { 1.0 } else { 0.5 },
            reason: format!(
                "{} {} — CPU-only, RAM {}",
                model.name,
                q,
                if can {
                    "sufficient"
                } else {
                    "below recommended"
                }
            ),
        };
    }

    let Some(vram) = node.gpu_vram_bytes else {
        return FitScore {
            can_fit: false,
            score: 0.0,
            reason: format!("{} {} — requires GPU, node has none", model.name, q),
        };
    };

    if vram < model.min_vram_bytes {
        return FitScore {
            can_fit: false,
            score: 0.0,
            reason: format!(
                "{} {} — VRAM {:.1}GB < min {:.1}GB",
                model.name,
                q,
                gb(vram),
                gb(model.min_vram_bytes)
            ),
        };
    }

    if vram >= model.recommended_vram_bytes {
        return FitScore {
            can_fit: true,
            score: 1.0,
            reason: format!(
                "{} {} — VRAM {:.1}GB >= recommended {:.1}GB",
                model.name,
                q,
                gb(vram),
                gb(model.recommended_vram_bytes)
            ),
        };
    }

    let range = (model.recommended_vram_bytes - model.min_vram_bytes) as f32;
    let above = (vram - model.min_vram_bytes) as f32;
    let score = above / range;
    FitScore {
        can_fit: true,
        score,
        reason: format!(
            "{} {} — VRAM {:.1}GB fits ({:.2})",
            model.name,
            q,
            gb(vram),
            score
        ),
    }
}

/// All fitting models for a node, best first.
pub fn best_fit(node: &NodeProfile, models: &[ModelEntry]) -> Vec<FitScore> {
    let mut s: Vec<_> = models
        .iter()
        .map(|m| fit_score(node, m))
        .filter(|f| f.can_fit)
        .collect();
    s.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    s
}

fn gb(b: u64) -> f32 {
    b as f32 / (1024.0 * 1024.0 * 1024.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::*;
    const GB: u64 = 1024 * 1024 * 1024;

    #[test]
    fn no_gpu_blocks_vram_model() {
        let n = NodeProfile::manual(None, None as Option<&str>, 8, 32 * GB, "x86_64");
        let m = &default_catalog()[0]; // Qwen3-30B
        assert!(!fit_score(&n, m).can_fit);
    }

    #[test]
    fn ideal_24gb_fits_all_gpu_models() {
        let n = NodeProfile::manual(Some(24 * GB), Some("RTX 4090"), 16, 64 * GB, "x86_64");
        let cat = default_catalog();
        let scores = best_fit(&n, &cat);
        // The name says ALL: assert the count, not just one member. Without
        // this line, dropping every partial fit from best_fit stayed green.
        assert_eq!(scores.len(), cat.len());
        assert!(scores
            .iter()
            .any(|s| s.score == 1.0 && s.reason.contains("Qwen3-30B")));
    }

    #[test]
    fn proportional_20gb() {
        let n = NodeProfile::manual(Some(20 * GB), Some("RTX 4000 Ada"), 12, 32 * GB, "x86_64");
        let cat = default_catalog();
        let qwen = cat.iter().find(|m| m.name.contains("Qwen3-30B")).unwrap();
        let s = fit_score(&n, qwen);
        assert!(s.can_fit);
        assert!((s.score - 0.5).abs() < 0.01); // (20-18)/(22-18)=0.5

        // 20 GB is the MIDPOINT of [18,22] and therefore a fixed point of
        // score -> 1 - score: on its own it cannot tell the formula from its
        // inverse. 19 GB is asymmetric and can.
        let n19 = NodeProfile::manual(Some(19 * GB), Some("RTX 4000 Ada"), 12, 32 * GB, "x86_64");
        let s19 = fit_score(&n19, qwen);
        assert!((s19.score - 0.25).abs() < 0.01); // (19-18)/(22-18)=0.25

        // best_fit must KEEP a partial fit, not only perfect ones. Nothing
        // else exercised that: at 24 GB every model scores exactly 1.0, so a
        // filter that drops partial fits is invisible there.
        let listed = best_fit(&n, &cat);
        assert!(listed
            .iter()
            .any(|f| f.reason.contains("Qwen3-30B") && f.score < 1.0));
    }

    #[test]
    fn cpu_only_fits_anywhere() {
        let n = NodeProfile::manual(None, None as Option<&str>, 4, 8 * GB, "aarch64");
        let scores = best_fit(&n, &default_catalog());
        // Asserting only that SOME reason mentions Kokoro left the RAM check
        // and the score entirely untested: inverting the comparison and
        // pinning the score both stayed green. Assert the values.
        let kokoro = scores
            .iter()
            .find(|s| s.reason.contains("Kokoro"))
            .expect("a CPU-only model must fit a GPU-less node");
        assert!(kokoro.can_fit);
        assert_eq!(kokoro.score, 1.0); // 8 GB RAM >= Kokoro 1 GB recommended
        assert!(kokoro.reason.contains("sufficient"));
    }

    #[test]
    fn sorted_descending() {
        let n = NodeProfile::manual(Some(24 * GB), Some("RTX 4090"), 16, 64 * GB, "x86_64");
        let s = best_fit(&n, &default_catalog());
        for i in 1..s.len() {
            assert!(s[i - 1].score >= s[i].score);
        }
    }
}
