# 2026-09-28 — wallet fund-block: the Meld card route leaves new bee's (and raver's) add money until it is wired into bPay

Lane: #237 follow-up, the escalated item of the final independent check
(post-merge, main `e063fb00e`). This seat (zCode, GLM-5.3 Max) was made
implementation owner by the founder's scale-out order; the reviewer seat's
direction (issuecomment-5882215580) and order of review
(issuecomment-5882246535) define the contract and the merge gate.

**Competition check first:** 30 open PRs inspected — none touches the wallet
fund block. No competing author; this seat implemented.

## What changed (one surface, moved never deleted)

1. **The register law** (`surfaces/wallet.html`, register-grammar sheet):
   `body[data-reg]:not([data-reg="cypherpunk"]) #fund-sec{display:none!important}`
   plus the same for raver's `💳 card` glyph card. New bee and raver's
   "add money" — task view, "everything"/"all" scroll, deep link — carry no
   card route at all. The rule is scoped to a REGISTERED body so the noscript
   note (no register is known with scripting off) stands as it always did.
2. **Cypherpunk keeps the built panel, now declared:** a plain statement opens
   the panel — "a separate card way in, **not wired into bPay yet** … new bee
   and raver do not see it until the two are one; here it stays declared,
   dormant until its key is set." The launcher machinery (buildUrl, hosts,
   key plumbing, resolve-then-confirm) is untouched and still exercised.
3. **No dead button anywhere:** unconfigured (the committed state, no
   `BNR_MELD_PUBLIC_KEY`) renders NO launch control — the greyed
   `aria-disabled` pattern is deleted; `paint()` writes a sentence with its
   reason (key name, deployment knob, sandbox host) and hides the link
   (`[hidden]` + a rule that outranks the author `display`, the classic
   hidden-attribute trap). Configured (a future deployment with a key), the
   button returns live — in cypherpunk only.
4. **The three presentation fixes** (the F1 residue): the fund summary is
   lowercased ("how the card checkout works: …"); the 0x/chain-select
   machinery left bee entirely; peer-sec's raw address row, keyless-read
   button and machine stat line now fold behind the section's own
   "show the details" in bee (controls visible for raver, everything open
   for cypherpunk); peer's summary is lowercased too ("the fiat funnel's
   role: …").
5. **Raver's add line tells the truth:** "bring money in, three ways" →
   "two ways", in every tongue (29 corpus cells, numeral swaps only:
   тремя→двома, 三种→两种, 세→두, ثلاث→اثنتين, dhà, and so on; Sanskrit
   instrumental dual त्रिभिः→द्वाभ्याम्).
6. **Corpus EN cells updated with their HTML:** `wl.d.fiat`, `wl.d.funnel`
   (casing law), `wl.rv.line.add` (count) — 31 corpus lines total. No new
   keys; the panel's new prose follows the fund section's existing unkeyed
   precedent.

## Facts preserved

- The voucher's "prepay for compute" stays untouched: one field, `look up`,
  engineering folded — bee's working next step in "add money".
- Peer funnel facts unchanged in every register; only their resting depth in
  bee changed (one tap, never deleted).
- The three-register contract holds (measured, see gates): raver deals cards,
  bee opens sections, cypherpunk keeps the pipeline; identical facts.

## Gates — what now proves the law (criterion 6, by content not length)

`e2e/wallet-registers.mjs` — **GREEN 124/124** — new §4j:
- bee "add" at rest: fund section has no boxes and NONE of its words
  (Meld, USDC, a chain name, an 0x field, a buy link, "card") are visible;
  the voucher field + button still work (criteria 1, and its working next step)
- no bee-visible sentence in "add" starts with a capital (names excepted);
  no dash, no 0x before "show the details" (criteria 3–4)
- raver's add deck deals voucher + fiat in only, and its "all" scroll keeps
  the route out too; cypherpunk shows the panel with the bPay statement, the
  checkout-state sentence and the config reason (criterion 2)
- no dead or greyed buy button renders anywhere; the panel's builder, hosts,
  key plumbing and launch words all remain in the file (moved, never deleted)
- §4d/§4e/§5/§10 reworked around the new truth; the deep link `#fund-sec`
  still paints "add money" first-paint in bee, with the voucher as the next
  step, and lands cypherpunk ON the panel

`e2e/wallet-fund.mjs` — **GREEN ×3 registers** (94/15/15): the launcher
suites (armed key, URL locking, name resolution, RPC rotation, production
opt-in) run in cypherpunk, where the panel lives; bee and raver assert the
panel carries no boxes even with a key ARMED (the block is the bPay order,
not a key state) and that no buy button renders; noscript unchanged.

Also green locally: wallet vault/matrix/arweave/signer/adapter ×3 registers
(201/33/66/315/84), r5-surface-audit, estate-check, door-counts (9),
university-smoke (87), no-page-errors (113 walked), polish-i18n (25),
orb-seat (5), lang-coverage (13), i18n-coverage selftest.

## Browser verification (actual words and taps, 390px, served from the worktree)

- new bee, "add money" row tapped: sections read `voucher-sec, peer-sec`,
  fund boxes 0; visible words: "🎟 prepay for compute", the meter-key field,
  "look up", "show the details", "🏧 money in, person to person", the
  lowercased funnel summary. Peer's "show the details" tapped: address row,
  read button and stat appear (one tap away, verified).
- raver, add glyph: deck = voucher + "fiat in"; the line reads
  "bring money in, two ways"; no card glyph.
- cypherpunk, scrolled to the panel: statement "not wired into bPay yet"
  visible; summary row lowercased; the unconfigured sentence with
  BNR_MELD_PUBLIC_KEY / sb.meldcrypto.com; buy link `hidden` — not rendered.
- Screenshots analyzed (bee add, raver deck, cypherpunk panel): no card
  purchase UI, no USDC selector, no 0x field, no disabled button in the two
  person registers; the panel's select/field appear only in cypherpunk, whose
  sentence says why no button is there.

## Boundary not crossed

No signing, no payment execution, no secrets; the Meld key stays empty on
disk (tests arm it by rewriting the served copy only); register.js (the
golden dress contract) untouched; no surfaces added or moved, so no
registration ritual due.

## Standing disposition

Per the reviewer's order of review: this PR is NOT to be merged until the
reviewer seat posts PASS on the exact head sha and CI is green; a new commit
after a PASS needs a new PASS. After merge the reviewer runs a short check on
main; only then is the lane closed.
