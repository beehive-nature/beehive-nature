# PLUR synthetic previews

Generated locally with Ubuntu eSpeak NG 1.52.0. Original engine: https://github.com/espeak-ng/espeak-ng (GPL-3.0-or-later); engine binaries are not distributed here. The WAV output and manifest are generated from the estate's public PLUR word cards and language labels.

These are synthetic previews, not native-speaker recordings or reviewed pronunciation. All 76 fixed word cards have a clip; all 33 offered language/locale options have a sample. This does not provide arbitrary-text speech in all languages.

Sanskrit is explicitly a Hindi-engine approximation because this engine has no Sanskrit voice. Flemish uses Dutch synthesis. Japanese kanji are supplied as kana readings; Arabic inputs are vowel-marked. These input transformations are in manifest.json and scripts/prepare-plur-voices.mjs for native review.

Rebuild from the repository root:

    node scripts/prepare-plur-voices.mjs
    python3 scripts/render-plur-voices.py /absolute/path/to/repository
    node --test e2e/plur-voices.test.mjs

The renderer requires espeak-ng 1.52.0. It writes PCM WAV files and refuses empty or silent output. Browser playback remains user-initiated. Asset generation and successful playback are separate from linguistic correctness.
