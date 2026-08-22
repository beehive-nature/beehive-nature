//! buzz-gain — the bBuzz forge's first Effect template (SPEC-BUZZFORGE-1 §4).
//!
//! ⚙ **AI-authored DSP** (zCode/GLM 5.3, 2026-08-21, BF-1 build lap) — per the
//! creation doctrine this artifact carries the gear badge and gets a human/⚙
//! review before any share.
//!
//! Signal path, in order:
//! **drive → tape-style saturation → trim → §5 safety wrapper** (soft-knee into
//! a hard ceiling, non-finite samples silenced). The wrapper is the last stage
//! and cannot be bypassed by parameters. CLAP-only per PF-1 — no VST3 export
//! ships from this crate (nih_plug still compiles vst3-sys unconditionally; the
//! combined work stays source-open AGPL-3.0, GPLv3-compatible one way).
//!
//! Launch-pad, not rail: the artist opens this source, changes anything, and
//! re-forges. The template's job is to be a working plugin from one sentence.

mod safety;

use nih_plug::prelude::*;
use std::sync::Arc;

pub struct BuzzGain {
    params: Arc<BuzzGainParams>,
    guard: safety::CrashGuard,
}

#[derive(Params)]
struct BuzzGainParams {
    /// Input drive into the saturation stage, in dB.
    #[id = "drive"]
    pub drive: FloatParam,
    /// Blend from clean (0) to fully saturated (1).
    #[id = "saturation"]
    pub saturation: FloatParam,
    /// Output trim after saturation, in dB.
    #[id = "trim"]
    pub trim: FloatParam,
    /// The hard ceiling the §5 wrapper enforces, in dBFS. Range caps at 0 dBFS
    /// by construction — the limiter is always on and always last.
    #[id = "ceiling"]
    pub ceiling: FloatParam,
}

impl Default for BuzzGain {
    fn default() -> Self {
        Self {
            params: Arc::new(BuzzGainParams::default()),
            guard: safety::CrashGuard::new(),
        }
    }
}

impl Default for BuzzGainParams {
    fn default() -> Self {
        Self {
            drive: FloatParam::new(
                "Drive",
                util::db_to_gain(0.0),
                FloatRange::Skewed {
                    min: util::db_to_gain(-12.0),
                    max: util::db_to_gain(24.0),
                    factor: FloatRange::gain_skew_factor(-12.0, 24.0),
                },
            )
            .with_smoother(SmoothingStyle::Logarithmic(20.0))
            .with_unit(" dB")
            .with_value_to_string(formatters::v2s_f32_gain_to_db(2))
            .with_string_to_value(formatters::s2v_f32_gain_to_db()),
            saturation: FloatParam::new("Saturation", 0.25, FloatRange::Linear { min: 0.0, max: 1.0 })
                .with_smoother(SmoothingStyle::Linear(20.0))
                .with_value_to_string(formatters::v2s_f32_percentage(0)),
            trim: FloatParam::new(
                "Trim",
                util::db_to_gain(0.0),
                FloatRange::Skewed {
                    min: util::db_to_gain(-24.0),
                    max: util::db_to_gain(12.0),
                    factor: FloatRange::gain_skew_factor(-24.0, 12.0),
                },
            )
            .with_smoother(SmoothingStyle::Logarithmic(20.0))
            .with_unit(" dB")
            .with_value_to_string(formatters::v2s_f32_gain_to_db(2))
            .with_string_to_value(formatters::s2v_f32_gain_to_db()),
            ceiling: FloatParam::new(
                "Ceiling",
                util::db_to_gain(-0.5),
                FloatRange::Skewed {
                    min: util::db_to_gain(-12.0),
                    max: util::db_to_gain(0.0),
                    factor: FloatRange::gain_skew_factor(-12.0, 0.0),
                },
            )
            .with_smoother(SmoothingStyle::Logarithmic(20.0))
            .with_unit(" dBFS")
            .with_value_to_string(formatters::v2s_f32_gain_to_db(2))
            .with_string_to_value(formatters::s2v_f32_gain_to_db()),
        }
    }
}

impl Plugin for BuzzGain {
    const NAME: &'static str = "BuzzGain \u{2699}";
    const VENDOR: &'static str = "beehive-nature";
    const URL: &'static str = "https://github.com/beehive-nature/beehive-nature";
    const EMAIL: &'static str = "beehive-nature@users.noreply.github.com";

    const VERSION: &'static str = env!("CARGO_PKG_VERSION");

    const AUDIO_IO_LAYOUTS: &'static [AudioIOLayout] = &[
        AudioIOLayout {
            main_input_channels: NonZeroU32::new(2),
            main_output_channels: NonZeroU32::new(2),
            aux_input_ports: &[],
            aux_output_ports: &[],
            names: PortNames::const_default(),
        },
        AudioIOLayout {
            main_input_channels: NonZeroU32::new(1),
            main_output_channels: NonZeroU32::new(1),
            ..AudioIOLayout::const_default()
        },
    ];

    const MIDI_INPUT: MidiConfig = MidiConfig::None;
    const SAMPLE_ACCURATE_AUTOMATION: bool = true;

    type SysExMessage = ();
    type BackgroundTask = ();

    fn params(&self) -> Arc<dyn Params> {
        self.params.clone()
    }

    fn reset(&mut self) {
        // Host re-initialization clears any latched §5 fault.
        self.guard.reset();
    }

    fn process(
        &mut self,
        buffer: &mut Buffer,
        _aux: &mut AuxiliaryBuffers,
        _context: &mut impl ProcessContext<Self>,
    ) -> ProcessStatus {
        // §5: the DSP body runs inside the crash guard; the output limiter is
        // applied inside the body so no sample escapes unguarded.
        self.guard.run(buffer, |buffer| {
            for channel_samples in buffer.iter_samples() {
                let drive = self.params.drive.smoothed.next();
                let saturation = self.params.saturation.smoothed.next();
                let trim = self.params.trim.smoothed.next();
                let ceiling = self.params.ceiling.smoothed.next();

                for sample in channel_samples {
                    let driven = *sample * drive;
                    // Tape-style soft saturation: blend clean against tanh of the
                    // driven signal. tanh bounds magnitude below 1 while keeping
                    // the curve monotonic and odd-symmetric.
                    let saturated =
                        (1.0 - saturation) * driven + saturation * driven.tanh();
                    *sample = safety::limit(saturated * trim, ceiling);
                }
            }
        });

        ProcessStatus::Normal
    }
}

impl ClapPlugin for BuzzGain {
    const CLAP_ID: &'static str = "org.beehive-nature.buzz-gain";
    const CLAP_DESCRIPTION: Option<&'static str> = Some(
        "bBuzz forge template \u{2699} AI-authored DSP — gain + tape saturation with a \
         hard-wired safety wrapper; review before sharing",
    );
    const CLAP_MANUAL_URL: Option<&'static str> = Some(Self::URL);
    const CLAP_SUPPORT_URL: Option<&'static str> = None;
    const CLAP_FEATURES: &'static [ClapFeature] = &[
        ClapFeature::AudioEffect,
        ClapFeature::Stereo,
        ClapFeature::Mono,
        ClapFeature::Utility,
    ];
}

nih_export_clap!(BuzzGain);
