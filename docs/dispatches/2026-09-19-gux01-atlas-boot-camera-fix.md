# GUX-01 Atlas engine — the boot-camera/home fix (the beat-2b camera defect)

Branch: `zcode/gux01-combined-prototype-2026-09-18` (this commit on `033b054d`)
Base: `033b054d` (serve-combined; engine bytes = the `9d9c3234`→`876338e7` lineage)
Executed by: ZcODe5.3max (GLM 5.3), zGeneUI seat, under the founder helm order
(channel event `153d87d1`, 2026-09-19: "YOU HAVE THE HELM… keep you two running
all night"). The defect was filed by the zGeneUI beat-2b mount (`2f7e2ca1`) and
routed to the zGeneAtlas seat; that seat has not moved on it, so under the helm
order the fix is taken here — ON THE ENGINE ORGAN'S CANONICAL BYTES, never
inside the zGeneUI mount diff. Per the rider-3 disposition (`3c00ce8d`), the
canonical engine bytes live on THIS branch (`9d9c3234`/`876338e7` lineage); the
engine branch tip `870206a1` predates the route-alternates law and is NOT the
freshest line; the rider-3 branch is a receipt, not a merge source.

## The defect (one asymmetry, four RED journey beats)

`createCore` froze `initial` (the home target) at construction time, BEFORE the
first `paint()` ran. At first paint, `reframe()` overwrote the live transform's
x/y (k kept), and `applyTransform()` synced the reframed camera back into core
state. Two lies resulted:

1. A serialized camera arriving via `initial.transform` (deep link / session
   return) was silently discarded at boot — the URL grammar's camera is the
   contract, and the engine threw half of it away.
2. `home()` restored the RAW `initial.transform` — a camera that was never
   displayed. Cold boots were wrong too (home returned `{k:1,x:0,y:0}` instead
   of the boot reframe); it merely LOOKED right whenever the starting camera
   happened to coincide with the reframe.

Additionally, the reframe fired on ANY view-root change including paints that
follow `back()`/`home()`/`restoreContext()` — reframing a context being
restored discards the exact camera the restore just put back. It only ever
passed the old journeys because their starting cameras coincided with the
pedigree reframe.

## The fix (three coordinated changes, one law)

LAW: **home returns to the framing boot SHOWED; an explicit boot camera is
authoritative; restored contexts keep their own camera.**

1. `createCore.adoptBootTransform(t)` — one-shot seam. The mount reports the
   transform the FIRST paint actually rendered (the honored explicit camera,
   or the first reframe). `initial` is updated from it; second reports are
   refused. `home()` is unchanged and now restores the right target. Before
   any paint, `home()` still restores the raw initial (documented, locked by
   test).
2. First paint honors an explicit camera: when `o.initial.transform` is
   PRESENT it is the authoritative boot camera — no reframe on the first
   paint. Callers that want auto-framing boot simply omit `transform`.
3. `paint(reason)` reframes only FRESH navigations (`reroot`/`setView`/
   `repaint`); paints reasoned `back`/`home`/`restore` keep the restored
   context's camera untouched.

Header (INTEGRATION API) documents all three.

## Evidence

- `node --test tools/genealogy/*.test.mjs` = **139/139** (135 prior + 4 new
  core contracts: explicit-camera boot state verbatim; adopt one-shot + home
  returns to the ADOPTED framing, never the raw initial; serialized-camera
  deep-link context round-trips exactly through home; pre-adoption home
  behavior locked). Zero regressions.
- Engine acceptance journey `e2e/blood-atlas-journey.mjs` = **21/21**, zero
  page errors (cold boot, select≠reroot, back×3 cold-context restore, LOD,
  ghost frontier, desktop pass — behavior preserved).
- Discovery shots journey = **14/14** incl. the hop-click-selection beat
  (green on this lineage; the rider-3 timeout was that branch's older tree).
- Checks: estate-check **PASS 96/105** (page asset — no surface drift);
  build-atlas clean; CR bytes 0 in both touched files; unmarked hex ≥48 = 0.
- Honest note: this branch's e2e harnesses still pin the worktree-local
  `./node_modules/playwright` junction (the portability fix landed only on the
  rider-3 receipt branch, `e2fc29a5`). Verification here used an uncommitted
  local junction to the shared checkout's `e2e/node_modules`. The real-surface
  proof for PR #125 (target 24/24) rides on `zcode/gux01-ui-atlas` immediately
  after this lands.

## Boundaries not crossed

No corpus writes; corpus/overlay/model untouched; only `surfaces/blood-atlas.mjs`
(+ its contract suite) changed; rider-3 bytes untouched; person-panel untouched;
blood.html untouched; no new fetches/deps; public projection only.

## Next

zGeneUI (same seat, other branch): compose this tip into `zcode/gux01-ui-atlas`
(pin refresh commit), re-run the full 186 suite + `gux01-blood-journey.mjs` →
target **24/24**. Then the remaining PR #125 gates: fresh-eyes review + the
founder's browser-seat pass. bFUzZ: read-only adversarial review of this
commit (offered at the mount checkpoint).

Authorship per ruling `03174e6c`: executing seat as author, provenance in
trailers, no founder impersonation, no machine Signed-off-by.
