# RECEIPT — i18n coverage: the denominator nobody had

**From:** cc1 · **2026-08-26** · **Trigger:** the founder opened `hardware/lab.html` with Russian
selected and saw **one** Russian string on the page.

## Why every gate was green while the page was English

| gate | what it proves | why it could not see this |
|---|---|---|
| `estate-source` | every `data-i18n` key exists in the corpus | walks `[data-i18n]` — an unkeyed paragraph is not in its universe |
| `estate-source` | all 26 tongues cover every corpus key | measures the corpus against itself |
| the blind round-trip | door keys *say* the right thing | only reads keys that exist |

All three measure **keys**. None measures **pages**. 100% of the keys can be perfect while 3% of a
page is translated, and that is exactly what shipped. The missing number was never the numerator —
it was the denominator.

`e2e/i18n-coverage.mjs` is new and re-runnable: it loads every surface in a real browser with a tongue
selected and counts what a reader can *see*.

## 1 · Coverage, all 79 surfaces, Russian

| | |
|---|---|
| visible strings estate-wide | **6,180** |
| reach Russian | **507 — 8%** |
| **UNKEYED** | **5,673** |
| keyed but empty cell | **0** |

A *visible string* is a leaf element carrying words a reader can see, excluding the estate's injected
chrome (the tour bar, the dock, the pickers) — that is this page's content, not its furniture.

### The ten worst (surfaces with 10+ visible strings)

| % | visible | keyed | reaches ru | unkeyed | page |
|---:|---:|---:|---:|---:|---|
| 0% | 327 | 1 | 1 | 326 | `bset.html` |
| 0% | 127 | 0 | 0 | 127 | `bmeshasi.html` |
| 0% | 125 | 0 | 0 | 125 | `devroom.html` |
| 0% | 115 | 0 | 0 | 115 | `wallet.html` |
| 0% | 114 | 0 | 0 | 114 | `fleet-hosted/gallery/acid-cascade.html` |
| 0% | 96 | 0 | 0 | 96 | `fleet-hosted/gallery/indigo-index.html` |
| 0% | 95 | 0 | 0 | 95 | `bnames.html` |
| 0% | 66 | 0 | 0 | 66 | `dock.html` |
| 0% | 62 | 0 | 0 | 62 | `fleet-hosted/gallery/resonance.html` |
| 0% | 59 | 0 | 0 | 59 | `fleet-hosted/lab/spliff-lab.html` |

For scale, the surfaces that *have* been keyed: the hub **45%**, the seven doors **24–48%**. Even the
audited doors are under half, because their tile names and captions are keyed while their section
headings, file paths and "not built yet" lists are not.

## 2 · `hardware/lab.html` — the diagnosis

| visible | keyed | reaches ru | **unkeyed** | **empty cell** |
|---:|---:|---:|---:|---:|
| 56 | 6 | 6 | **50** | **0** |

**UNKEYED.** Not one empty cell. Every key on that page has a full Russian rendering — all six of them
— and the other fifty strings were never keyed, so no tongue can reach them and no gate could report
them. The founder saw one Russian string because six keys sit in one block and fifty do not exist.

**Estate-wide there are ZERO empty cells.** The corpus law is working exactly as written; the failure
mode is entirely "never keyed", never "keyed and untranslated". That distinction is the whole point of
this receipt: the two look identical to a reader, and the fixes are completely different work —
keying a page is an authoring pass, filling a cell is a translation pass.

## 3 · Distinguishable in the report, invisible in the render

This tool changes nothing a reader sees. It sets no marker, injects no class, ships no debug mode. The
separation lives here, in three columns — `unkeyed`, `emptyCell`, `missingKey` — and nowhere near a
page. A reader must never learn about our instrumentation by reading it.

## 4 · What to key next — reported, not touched

The founder's scope: **do not key all 70.** The doors are keyed and audited; key what a stranger hits
*after* arriving.

**One tap from a door: 70 pages, 5,649 visible strings, 5% reaching Russian, 5,361 unkeyed.**

The heaviest twenty, by unkeyed strings:

| unkeyed | visible | % | page |
|---:|---:|---:|---|
| 566 | 578 | 2% | `bfood.html` |
| 342 | 354 | 3% | `blanguage.html` |
| 340 | 417 | 18% | `plur.html` |
| 326 | 327 | 0% | `bset.html` |
| 210 | 222 | 5% | `bigen.html` |
| 201 | 211 | 5% | `blight/museum.html` |
| 161 | 170 | 5% | `bearth.html` |
| 137 | 147 | 7% | `hardware/index.html` |
| 131 | 141 | 7% | `bsymposium.html` |
| 127 | 127 | 0% | `bmeshasi.html` |
| 126 | 127 | 1% | `blight/compare.html` |
| 125 | 125 | 0% | `devroom.html` |
| 121 | 130 | 7% | `stack.html` |
| 115 | 115 | 0% | `wallet.html` |
| 114 | 114 | 0% | `fleet-hosted/gallery/acid-cascade.html` |
| 111 | 120 | 8% | `blongevity.html` |
| 101 | 108 | 6% | `university/index.html` |
| 96 | 96 | 0% | `fleet-hosted/gallery/indigo-index.html` |
| 95 | 95 | 0% | `bnames.html` |
| 86 | 91 | 5% | `dao-dashboard/index.html` |

…and 50 more. **Nothing on this list was touched in this run**, per the order.

An honest note on the size: "one tap from a door" is 70 of the 79 surfaces, because the doors
deliberately list everything behind them. It bounds the *work* far less than it sounds. If the point
is a stranger's first hop, the twenty above are 3,700 of the 5,361 unkeyed strings — keying those and
stopping would take Russian from 5% to roughly 70% of the one-tap surface, and that is the cut this
seat would recommend rather than "all 70".

## The limit of this receipt

Coverage is not correctness. A page at 100% may still say the wrong thing in a tongue — that is what
the blind round-trip is for, and 240 corpus keys (68%) have still never been read back. And every
rendering remains **⚙ machine-drafted until a human who speaks the tongue attests it**.
