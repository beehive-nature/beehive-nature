# I1 EXEMPTION · BY ART LAW · surfaces/fleet-hosted/

**Granted:** ORDER cc2-FLEET item 2, 2026-08-24. **Scope: seven files, named below.**
Silence would read as a pass, so this is the written record.

## What is exempt

Seven hosted surfaces load `../vendor/chart.js` at page-open — **1 request, 222 KB** —
and therefore cannot satisfy I1's zero-subresource expectation:

| | |
|---|---|
| `gallery/acid-cascade.html` | `lab/blend-lab.html` |
| `gallery/indigo-index.html` | `lab/bnr-dashboard.html` |
| `gallery/resonance.html` | `lab/flower-lab.html` |
| | `lab/spliff-lab.html` |

**Scope correction, stated rather than glossed:** the order says "the hosted *gallery*
surfaces." The measured fact is **seven surfaces across gallery AND lab**, not three.
Four of the seven are lab instruments. The exemption is written to the fact.

## Why it cannot be fixed

Each of these seven calls `new Chart(...)` against a `<canvas>` that is part of the
work. Removing the dependency means removing the charts, which means **editing the
art** — forbidden by ORDER cc2-FLEET item 3 and by the preservation law the whole
`fleet/` tree stands on. The originals are byte-identical to their sources and stay
that way. There is no version of this that is fixable from the hosting side.

What *was* fixable has been fixed: the request is no longer **cross-origin**. The
originals fetch `https://cdn.jsdelivr.net/npm/chart.js` forever; these hosted copies
point at a vendored, hash-pinned copy on this origin. Measured, pinned method, median
of five:

| | FCP | requests | KB |
|---|---|---|---|
| `fleet/acid-cascade.html` (original, CDN) | 272ms | 1 | 222.0 |
| `fleet-hosted/gallery/acid-cascade.html` | **128ms** | 1 | 222.0 |

**144ms recovered on identical bytes, with the art untouched.** That is the whole of
what hosting can do here.

## What this exemption does NOT cover

- **It is not a directory-wide pass.** Three files in `fleet-hosted/` make **zero**
  subresource requests and are **not** exempt — `index.html`, `lab/intake-tracker.html`,
  `lab/edible-tracker.html`. If any of them ever gains a request, that is a regression
  and I1 should fail it.
- **It exempts I1 only.** I2 (first contentful paint under 1000ms) still applies and
  still passes — the worst of the seven is 128ms.
- **It exempts exactly one dependency: `vendor/chart.js`.** Any *additional* subresource
  on any of the seven is outside this exemption and fails.
- **It does not exempt cross-origin.** Zero off-origin requests, asserted in
  `e2e/fleet-bus.mjs`. A hosted surface that reaches off-origin fails regardless.

## What would end it

Founder word to edit the art, or an art revision that drops `chart.js`. Neither is a
placement decision, and neither is a seat's to take.

## Receipts

- Chart.js **draws** in the hosted copy — not merely loads: `e2e/fleet-pixels.mjs`
  reads the real canvas back on `gallery/acid-cascade.html`. 1038×240 = 249,120 px,
  **11,420 painted (4.6%)**, **132 distinct colours**, zero page errors. Control: an
  undrawn canvas of identical size reads 0 painted, so the probe can see an empty one.
- Vendored bytes: 208,522. sha256 `48444a82d4edcb5bec0f1965faacdde18d9c17db3063d042abada2f705c9f54a` PUBLIC-CONSTANT (Chart.js 4.5.1 content hash — a published build digest, not a secret)
  — matching both the pinned record and what the CDN served at fetch time.
