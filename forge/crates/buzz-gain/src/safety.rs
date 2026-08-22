//! §5 SAFETY WRAPPER — SPEC-BUZZFORGE-1, load-bearing. Do not remove, do not bypass.
//!
//! Two non-negotiables for AI-authored real-time DSP:
//!   1. [`limit`]       — the last stage of the signal path: a soft knee bending into a
//!                        hard ceiling; non-finite samples become digital silence.
//!   2. [`CrashGuard`]  — catches a panicking DSP body, silences the buffer, and declares
//!                        the fault instead of taking the host down. The fault latches
//!                        (output stays muted) until the host re-initializes the plugin.

use nih_plug::nih_log;
use nih_plug::prelude::Buffer;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, Ordering};

/// The soft knee begins at this fraction of the ceiling.
const KNEE_FRACTION: f32 = 0.5;

/// The hard limiter every template's output passes through as its final stage.
/// `ceiling` must be positive (a linear amplitude, e.g. `util::db_to_gain(-0.5)`).
pub fn limit(sample: f32, ceiling: f32) -> f32 {
    // NaN and ±inf must never reach a DAC — a single NaN poisons a run of samples
    // and some hosts render it as a full-scale square. Digital silence instead.
    if !sample.is_finite() {
        return 0.0;
    }
    let knee = ceiling * KNEE_FRACTION;
    let magnitude = sample.abs();
    if magnitude <= knee {
        return sample;
    }
    // Continuous and monotonic from the knee to the hard wall: the input can drive
    // the curve arbitrarily far but the output asymptotically approaches the ceiling.
    let over = (magnitude - knee) / (ceiling - knee);
    let shaped = knee + (ceiling - knee) * over.tanh();
    let clamped = if shaped < ceiling { shaped } else { ceiling };
    clamped * sample.signum()
}

/// Catches a panicking DSP body and keeps the host alive. One per plugin instance.
pub struct CrashGuard {
    faulted: AtomicBool,
}

impl CrashGuard {
    pub fn new() -> Self {
        Self {
            faulted: AtomicBool::new(false),
        }
    }

    /// Run `dsp` over `buffer`. On panic: latch the fault and silence the buffer.
    /// After a fault, every later call outputs silence without invoking `dsp`.
    pub fn run(&self, buffer: &mut Buffer, dsp: impl FnOnce(&mut Buffer)) {
        if self.faulted.load(Ordering::Relaxed) {
            silence(buffer);
            return;
        }
        if self.attempt(|| dsp(buffer)).is_none() {
            silence(buffer);
        }
    }

    /// Catch-and-latch core: runs `dsp`, latching the fault on panic.
    /// Returns `None` if the body panicked or the fault was already latched.
    pub fn attempt<T>(&self, dsp: impl FnOnce() -> T) -> Option<T> {
        if self.faulted.load(Ordering::Relaxed) {
            return None;
        }
        match catch_unwind(AssertUnwindSafe(dsp)) {
            Ok(value) => Some(value),
            Err(_) => {
                self.faulted.store(true, Ordering::Relaxed);
                nih_log!(
                    "buzz-gain \u{2699}: DSP body panicked — fault latched, output muted \
                     until the host re-initializes the plugin"
                );
                None
            }
        }
    }

    /// Clear the fault latch. Called from `Plugin::reset()` (host re-initialization).
    pub fn reset(&self) {
        self.faulted.store(false, Ordering::Relaxed);
    }
}

impl Default for CrashGuard {
    fn default() -> Self {
        Self::new()
    }
}

fn silence(buffer: &mut Buffer) {
    for channel_samples in buffer.iter_samples() {
        for sample in channel_samples {
            *sample = 0.0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CEILING: f32 = 0.944_061; // -0.5 dBFS

    #[test]
    fn output_never_exceeds_the_ceiling() {
        let extremes = [
            -f32::MAX,
            -1e12,
            -100.0,
            -1.5,
            -CEILING,
            CEILING,
            1.5,
            100.0,
            1e12,
            f32::MAX,
        ];
        for x in extremes {
            let y = limit(x, CEILING);
            assert!(y.abs() <= CEILING, "ceiling breached at input {x}: {y}");
        }
    }

    #[test]
    fn non_finite_input_becomes_silence() {
        assert_eq!(limit(f32::NAN, CEILING), 0.0);
        assert_eq!(limit(f32::INFINITY, CEILING), 0.0);
        assert_eq!(limit(f32::NEG_INFINITY, CEILING), 0.0);
    }

    #[test]
    fn curve_is_continuous_at_the_knee() {
        let knee = CEILING * KNEE_FRACTION;
        assert!((limit(knee, CEILING) - knee).abs() < 1e-6);
        assert!(limit(knee + 1e-4, CEILING) > knee);
    }

    #[test]
    fn curve_is_monotonic_and_sign_preserving() {
        let mut prev = limit(0.0, CEILING);
        let mut x = 1e-3;
        while x < 100.0 {
            let y = limit(x, CEILING);
            assert!(y >= prev - 1e-9, "non-monotonic at {x}");
            assert!(y > 0.0, "sign lost at {x}");
            let y_neg = limit(-x, CEILING);
            assert!((y + y_neg).abs() < 1e-6, "asymmetry at {x}");
            prev = y;
            x *= 1.25;
        }
    }

    #[test]
    fn crash_guard_latches_on_panic_and_resets() {
        let guard = CrashGuard::new();
        assert_eq!(guard.attempt(|| 7), Some(7));
        // A panicking DSP body is caught; the host survives.
        let caught = std::panic::catch_unwind(|| {
            let _ = guard.attempt::<()>(|| panic!("DSP body fault"));
        });
        assert!(caught.is_ok(), "guard re-panicked instead of catching");
        // The fault latches: later bodies are not even invoked.
        let probed = guard.attempt(|| 42);
        assert_eq!(probed, None, "fault did not latch");
        // Host re-initialization clears it.
        guard.reset();
        assert_eq!(guard.attempt(|| 42), Some(42));
    }
}
