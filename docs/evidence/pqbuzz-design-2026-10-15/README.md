# PQ Buzz design round, 2026-10-15/16: evidence

Everything `docs/specs/SPEC-BUZZ-PQ-1.md` cites under `docs/evidence/pqbuzz-design-2026-10-15/`.
Produced by the Claude Code seat in three multi-agent rounds. None of it is ruled.

| Path | What it is |
|---|---|
| `brief.md` | The design brief every architect worked from: founder ask verbatim, governing frame, numbers, gaps, deliverable format |
| `notes/` | Nine reader notes with path:line citations: law (constitutional; identity and scale), x0x, BNRoSe, Buzz, the user-pays stack, PQ and tungsten, the load model, and a completeness critic |
| `designs/` | Five competing designs: `lawful-minimal.md` (BESIDE), `millennium-first.md` (STRATA), `planet-scale.md` (COMB, cell-only), `economics-first.md` (METABOLIC), `mesh-native.md` (COMB on x0x) |
| `judges.json` | Four lens judges (law and honesty; buildability and migration; scale and economics; tungsten and security), each scoring all five designs with fatal flaws, grafts and citation errors |
| `synthesis.md` | The merged draft before the attack round (BESIDE base plus grafts) |
| `attack-verdicts.json` | 70 findings from six adversarial lenses (PQ crypto, scale and mobile, economics and abuse, law and citations, continuity and tungsten, adversary), each adjudicated against sources (58 CONFIRMED, 5 CONFIRMED-ALT, 7 PARTIAL, 0 REFUTED), the fix list, and the completeness critic's report |
| `calc-s7.js` | The spec's Appendix A calculator: `node calc-s7.js` prints every ARITH figure in the spec |
| `lm/` | Supporting calculators from the BESIDE design (legacy and private-lane sizes) |

## Scores (0-10 per lens)

| Design | Law | Build | Arithmetic | Tungsten/security |
|---|---|---|---|---|
| BESIDE (lawful-minimal) | 8.5 | 8 | 6.5 | 6 |
| STRATA (millennium-first) | 7.5 | 6 | 4.5 | 8 |
| COMB, cell-only (planet-scale) | 6 | 5 | 8 | 7 |
| METABOLIC (economics-first) | 5.5 | 5 | 7.5 | 4.5 |
| COMB on x0x (mesh-native) | 6.5 | 4 | 6 | 6 |

## Provenance limits

- Reader notes and designs cite local paths of the seat's machine (`C:/Users/travi/...`), the Buzz fork at `skaists/buzz@e1035672`, x0x at `saorsa-labs/x0x@v0.48.0`, and LOVErnment-DAO specs. The spec rewrote its own citations to public forms; the notes keep the originals as written.
- Some notes cite seat memory files, which are not in this repo. The spec labels any such citation "seat memory, not in repo".
- After the critic, the integrating seat fixed one remaining design defect by hand (per-device chain tags; revision log row CRITIC-1). `calc-s7.js` here is the patched calculator.
