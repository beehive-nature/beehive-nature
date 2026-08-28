# SPRINT-2026-08-28 — THE MEGASPRINT PLAN
**Issued on founder order. zCode + goose are chiefs; this plan is input to them, not over them.**
**Prep consumed:** RAID_WALLET_SOVEREIGN_LIGHTNING (`0551e8b` post-rebase) · DESIGN-BRIEF-04 (`8ea8df6`) · RULING_DOMAIN_ATLAS (`dfc189a`) · the hadrian study brief · the hub first-fold audit · Brief 03 · the four wallet laws + SPEC-ADAPTER-CONTRACT-1 · today's rulings (anydoc TAKE, qrroses SMIL pilot).

---

## 0 · WHY THIS PLAN IS SHAPED THE WAY IT IS

Every sprint so far tripped at the same place: **the end.** The recorded causes, from the estate's own ledger — finished branches sitting unmerged while process accumulated; "shipped" claimed from a git state while Pages showed nothing; green claimed from self-picked suites while CI sat red for 15 pushes; four proven gates that ran on no push; lanes colliding on shared files; seats queued behind one exhausted human relay; a wrong-name order executed perfectly.

Every one of those is an **end-of-sprint convergence failure**. So this plan removes the end.

## 1 · THE ONE STRUCTURAL LAW: CONTINUOUS LANDING

**There is no integration phase. There is no end-state. Nothing waits for anything outside its own lane.**

- Within a lane, items run in strict order, and an item is **DONE only when its receipt exists: the LIVE public URL rendering the change** (or, for a doc/spec item, the committed file on origin/main). Then the next item starts.
- Consequence: **whenever the founder calls the pause — hour 2 or hour 12 — everything finished is already public.** The sprint cannot trip at the end because the end is just the last landing, identical to every landing before it.
- A lane that cannot land its current item **stops and parks with a one-line state note in its lane file.** It does not pile unlanded work behind the blockage.
- **No new gates, laws, or process may be created this sprint.** The ratio law binds: <10% gates and blocks, >90% functional code. Everything in §4 already exists.

## 2 · PRE-FLIGHT (chief runs once, before any lane starts — 15 minutes, hard stop if red)

1. **Prove CI runs are being created:** push one trivial rider commit and watch a run APPEAR. (Actions previously stopped spawning runs on this account — quota/billing class. If no run appears, STOP: that is founder-account territory, ask #2 below fires, and no lane starts until CI is alive, because every DONE in this plan depends on it.)
2. **Triage the worktree residue FIRST** (zCode's own call): the uncommitted midi e2e changes (`e2e/midi-agent-verify.mjs`, `e2e/build-midi-blue.mjs`, `e2e/purse-look.mjs`, modified shots). Commit what's real, drop what's dead, land it. The sprint starts on a clean tree or it inherits a landmine.
3. **Confirm lane file-ownership is disjoint** (§3 table). The cC/cD collision came from two lanes touching one file. If two lanes need the same file, the chief re-draws the boundary NOW, not at merge time.

## 3 · THE LANE MAP

Each lane: one seat, one worktree (shared-checkout law), disjoint files, items in strict order, land-live-then-next. Chiefs assign seats to lanes as the founder brings them up; **no lane is "waiting on" another lane for anything.**

| Lane | Files owned (exclusive) | Ordered items |
|---|---|---|
| **A · HUB ATLAS REBUILD** (the centerpiece) | `surfaces/index.html`, the new registry file, `surfaces/doors/**` | A1 → A2 → A3 → A4 |
| **B · WALLET ROOM** | `surfaces/wallet.html`, adapter/vault modules, `docs/SPEC-ADAPTER-CONTRACT-1.md` | B1 → B2 → B3 |
| **C · BUZZ ROOM** | `surfaces/buzz-studio.html` | C1 → C2 |
| **D · qrroses SMIL PILOT** (already ordered) | `surfaces/blight/qrroses-smil.html` (NEW file — never touches the live qrroses) | D1 per the standing dispatch |
| **E · ANYDOC TAKE** (already ordered) | mirror repo + `surfaces/` one new file | E1 per the standing dispatch |
| **F · RECON (read-only, no tree writes)** | none | F1, F2 |

### LANE A — Hub Atlas rebuild
**Design bar (from the study):** one ground, one accent, one job per screen, counts that reconcile, every door reachable in one honest gesture. Restraint — the work invisible in the result.
- **A1 — THE REGISTRY BECOMES THE SINGLE SOURCE.** One registry file (extend `estate.json`) carrying every surface exactly once: family (per the seven Atlas families), home, honest state badge (LIVE / DNS-PENDING / BUILT-UNHOSTED / SEAT-OPEN). **Every count on the hub — hero, footer, search, panels — is COMPUTED from this file at build. The 78/70/29 mismatch dies by construction, permanently.** DONE = registry committed + a computed-count check green in the repo's OWN CI.
- **A2 — FIX THE FIVE AUDIT DEFECTS ON THE LIVE PAGE:** (1) gear button off the search input; (2) `03 · WHAT IT COSTS` un-clipped; (3) counts rendered from A1; (4) the six domains appear ONCE (family sections replace doors-row + panels + widget triplication); (5) first-screen jargon pass — a stranger's first fold uses human words, deep vocabulary lives behind the doors. DONE = live URL at 390px, before/after shots.
- **A3 — THE SEVEN OPEN ATLAS SEATS: PICK DEFAULTS, LOG, MOVE.** These are reversible by the Atlas's own graduation law (one registry row changes, old paths keep serving). The seat PICKS a sensible default for each, logs the pick in the lane file, and does not ask. The founder redlines any of them whenever he wants; a redline is one registry-row change. **An ask here is a defect** — nothing in the seven touches keys, money, his public name, or his art.
- **A4 — plur.earth front:** create `plur-earth` in the skaists org (consistent with siblings), holding page, Pages on. DONE = the github.io URL serving. (DNS pointing stays founder-hands, known state, not this sprint.)

### LANE B — Wallet room
Binding: the four wallet laws (redaction wall · ephemeral op keys · sign-then-outbox · receipt-is-the-chain-read) + SPEC-ADAPTER-CONTRACT-1 + Brief 03 + Brief 04's PROTOCOL/SERVICE/PATTERN classing (PROTOCOL may be core; SERVICE degrades gracefully, never load-bearing; PATTERN is rebuilt first-party).
- **B1 — LAND THE ADAPTER CONTRACT + Vaulta `buildAction()`** per the standing dispatch: spec file committed, Vaulta adapter on the §3 contract, outbox moved to the shell, submit/confirm split, mutation gates 2–6. **This is the item that retires Unicove from the user path** — `walletAction()` points at our own composer. DONE = live wallet.html composing + the chain-read receipt showing on a real testnet action.
- **B2 — RENDER THE CHAIN MATRIX FROM DATA:** Brief 04's sixteen chains as a wallet panel — per-chain read path, sign path per custody tier, honest state — rendered from a data block, never typed prose. DONE = live at 390px.
- **B3 — SECOND ADAPTER (Arweave, `buildPublish`)** — closes the Rail 2 anchor as wallet feature work per the standing ruling. DONE = anchor payload signed-and-outboxed path demonstrated end-to-end on the live surface (actual mainnet publish waits for the founder loading the key — his hands, stated, not this sprint's receipt).

### LANE C — Buzz room
- **C1 —** buzz-studio.html brought to the same design bar as A2 (one accent, human first fold, honest state), against SPEC-BUZZFORGE-1. DONE = live at 390px.
- **C2 —** the covenant-zapper PATTERN (BOLT12-offer-in-profile-metadata, zappable) recorded as a design note in the buzz spec — **pattern only, upstream is unlicensed, not one line copied.** DONE = committed note.

### LANE D / LANE E — already dispatched today
Run exactly per their standing paste blocks (qrroses SMIL pilot; anydoc L-VERIFY → mirror → vendor → prove-offline → one surface). No changes here.

### LANE F — Recon (read-only)
- **F1 — exSAT DEX incumbent check** (the one-hour task): which DEX actually holds exSAT volume beside xBTC's ~$171M. Report = facts + a recommendation. **NO deploy, NO pool, NO LP — that is founder money and waits for his word.**
- **F2 — Ark + Clams license reads** at pinned commits (closes two of the Lightning raid's six open questions without founder involvement).

## 4 · THE LAWS THAT BIND (all pre-existing — cited, not extended)

1. **Receipt for DONE = the LIVE URL** (never a git state).
2. **Green = the repo's CI run, opened and read** (never a self-selected suite). The forge-freeze/15-red-pushes lesson.
3. **Whole-chain execution** — gate, merge, push, next item — no reporting between steps; stop only on a real failure.
4. **Read-back rule** before any order that repoints/replaces/deletes a named identifier: state which is which and why, confirm against a founder statement. **Extended 2026-08-28 (founder): the rule explicitly covers Safe addresses — any order touching one states WHOSE Safe it is, founder-confirmed, before executing.**
5. **Cache sweeps via `scripts/bump-rider.sh` only.** `orbit.html` stays byte-pinned at v22, forever.
6. **Choice law** on creative surfaces: new capabilities land as options beside existing ones, never replacements, never silent default swaps.
7. **Handle-passing between seats (ruled today, and it is functional):** seats exchange REPO FILE PATHS, never pasted bodies. A dispatch that quotes a document instead of pointing at it is burning the context budget that has ended lanes early.
8. **Corner law** on anything crossing a live code: data middle only, three finders untouched, decoder-proven per frame.
9. **Claude Design exports are UNBOUND `{{ }}`** — real data from the `text/x-dc` block; entity hues from `docs/tokens.css` only; gold = b amounts only.
10. **Post-gate edits re-run the full battery.** Never pipe a gate through anything — the pipe eats the exit code.

## 5 · WHAT THE FOUNDER SEES

Nothing, until he calls the pause. At the pause, the report is **a picture, not a claim list**: for each lane, the live URL + before/after at 390px + one sentence of what a stranger can now do that they couldn't this morning. Chain-level detail stays in the lane files.

## 6 · FOUNDER ITEMS — the complete list, nothing held back

**FOUNDER CORRECTION APPLIED 2026-08-28 — READ THIS BEFORE TOUCHING ANY TREASURY PANEL:** the DAO Safe on Base read during the raid (proxy, 3 owners `0x9276…1db4` · `0x5fed…ab63` · `0x73c5…0702`, threshold read reverted) is **NOT the estate's. It belongs to Sam, TRUFFi's dev.** It is a boarding fact about a third party's treasury, read as study material. Consequences: (a) the former ask #1 (owner confirmation) is VOID — there is nothing for the founder to confirm; (b) **no estate surface wires, displays, or labels that Safe as the estate's DAO treasury, ever**; if any panel, brief, or schematic drawn from the raid references "the DAO Safe" as ours, that reference is WRONG and gets corrected on sight; (c) this is the read-back rule firing again — an identifier reached the founder mapped to the wrong owner, and he caught it. Any future order touching a Safe address states WHOSE Safe it is, confirmed against a founder statement, before anything executes.

**Remaining founder items (answer whenever, blocking nothing):**
1. **Conditional only:** if pre-flight #1 finds CI runs not spawning, that is an account/billing check only you can do — the chief will say so in one line and hold all lanes.

**Notices, not questions (defaults will be picked and logged; redline anytime):**
- The seven Atlas IA seats (A3) — reversible by the graduation law.
- BNRi:xBTC deploy/LP, Trezor firmware BCH/Zcash/Monero extension, scanner pricing, ElTor reading room, cdk-vs-Fedimint build order — **all founder-gated, all parked, none blocking this sprint.** They come back to you at a pause with facts attached (F1/F2 supply two of them).

---

## 7 · PRE-FLIGHT RESULTS (chief's log, 2026-08-28 — all three GREEN, lanes may open)

1. **CI spawn proof — GREEN.** Push `a909d19..81bf8b3` (5 commits: last night's three briefs rebased + triage + correction) spawned three runs, all read to conclusion: `secret-scan` 33181815675 **success** (12s) · `tests` 33181815664 **success** (1m24s) · `pages-build-deployment` 33181814324 **success** (26s — the corrections are already LIVE on Pages). No founder action needed; the conditional ask #1 does not fire.
2. **Worktree triage — GREEN, tree clean.** `b9285d2`: verifier `PAGE=` override, `build-midi-blue.mjs`, `purse-look.mjs` and their receipt shots committed; `.hubshots/` gitignored (intake pool stays on disk — record serves from `surfaces/record/`, zero refs to `.hubshots`); the two-zero-byte `contracts/rollback/kingbeelovis.live.wasm` dropped. The founder Safe-correction landed as `81bf8b3` before any lane opened: raid §6.4 + open-question 1 rewritten, schematic fleet-dividend box de-wired, Brief 04 BASE row corrected — sweep verified zero remaining "DAO Safe"/"our treasury" references across all four artifacts.
3. **Disjoint-file check — GREEN, one boundary drawn now:** §3 table holds as issued (`estate.json` and `docs/SPEC-ADAPTER-CONTRACT-1.md` do not yet exist — A and B create them, no conflicts). Boundary notes: **`.github/workflows/**` is assigned to Lane A alone** (A1's computed-count check is the only item needing CI edits — no other lane touches workflows); **Lane E's new surface file gets a chief-assigned name at lane-open** that collides with nothing in A's registry or doors; **e2e receipts stay lane-name-prefixed** per existing convention (no new process). `tour.js`/`agent-dock.js` themselves are edited by no lane — `?v=` bumps live inside each lane's own HTML via `bump-rider.sh`, so rider sweeps cannot collide.
