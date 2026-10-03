# PLUR language voices — 2026-10-02

Founder requested all language voices on PLUR and confirmed synthetic previews now, native review later. Scope remains the skaists.dev clay surface. Added Festivals → PLUR → SKAISTS → BNR navigation on PLUR.

The observed in-app browser offered only three English voices; all 22 non-English word-card languages lacked speech. The old global override could substitute English for unrelated languages; its no-engine path referenced undeclared stDirty. Replaced that routing with language-constrained voice selection and stable voiceURI preference, same-origin fixed audio fallback, explicit failure messages and cancellation-safe sequencing. No arbitrary-text fallback is claimed.

Generated 109 non-silent PCM WAV previews using Ubuntu eSpeak NG 1.52.0: 76 fixed cards and 33 language/locale samples. All remain native-review pending. Sanskrit is expressly a Hindi-engine approximation; Flemish uses Dutch, Japanese uses kana readings and Arabic vowel-marked inputs. Manifest records source text, synthesis input, voice, duration and review boundary. No third-party TTS request or private conversation text was sent. Browser voices may use their vendor's service as before.

Five focused tests cover all fixed words and audio files, no-engine operation, language override refusal, cancellation/absent text, and native-review labels. Initial test scaffolding lacked classList.contains; corrected the stub and reran. Inventory and CI-shape checks pass. No localhost server. Seven existing screenshot artifacts preserved. GitHub Pages and live playback are verified separately after publication.
