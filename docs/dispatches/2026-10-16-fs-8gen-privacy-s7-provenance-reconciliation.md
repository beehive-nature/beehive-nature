# Privacy-gate §7 provenance reconciliation — 2026-10-16

The CI verdict arrived and splits into TWO separate qualifications, per
verified review:

**Functional privacy qualification: PASS, on executed-success evidence.**
Hosted runs on the landed implementation (unchanged genealogy files from
`c210e4269` through current main, per GitHub's comparison) show the
deceased-entry rooting, living-focus rejection, Austras spatial rotation +
keyboard focus, and grandparent self-branch regressions executed and
passed; `d938ba682` / `7d1bcc766` / `1c8727f1d` runs are green across
eternal/static/node/meter. Both PRs' substantive requirements are
represented on main.

**Repository provenance qualification: FAIL — the nine commits, named.**
The `c210e4269` push range and PR #347's contributed range both fail §7
(scripts/identity-check.sh) on exactly nine commits — the PR's original
authorships, preserved through the rebase:

    fbba92ddb genealogy: start public tree at deceased branch entries
    4c39ad70d genealogy: focus the active spatial tree after climb
    0b0e3cc5d genealogy: publish deceased-entry tree renderer
    345d7a762 test: follow spatial tree contract and exclude living UI
    959fff653 test: lock deceased-entry tree privacy boundary
    c917e0da3 genealogy: render grandparent self branch without blank path
    bacebeaaa test: lock grandparent self rendering
    12392476d genealogy: traverse hidden living stubs without rendering them
    4e5d39890 test: keep ancestry beyond hidden living relatives

Each carries author `Travis Remington
<111410861+loviswaternakamoto@users.noreply.github.com>` — the founder's
GITHUB-noreply identity — with a LOCAL SEAT as committer. §7 accepts only
the founder's git identity (`loVis waTer <loviswater44@gmail.com>`) or the
web-flow shape (committer `GitHub <noreply@github.com>` + the numeric
noreply author, i.e. the founder's own hand through GitHub's UI). A local
commit typed under the noreply mirror is neither — by design, per the
check's own note that a locally-reachable exemption "is an instruction to
forge one." This is NOT an artifact of tonight's rebase: the violation
originates in the PR branches (PR #347's pull-request static run fails the
same check on the same nine); the rebase merely carried it into a main
push range. Later green statics checked only descendant ranges — valid
there, not retroactive for the nine. My own commits in every range
(`713079f86`, `c210e4269`, `d938ba682`, `6ebef2584`, `7d1bcc766`) carry
the compliant git identity and pass.

## Remedy — fixed forward, never retroactively (the estate's standing precedent)

The S7 authorship-era receipt (2026-08-24) and the DCO ruling fix the
method: non-compliant PUBLISHED commits stand, are named, and are never
rewritten; no force-push; no weakening of the identity check; forward
commits comply (already true for this seat's ranges). Within that law, two
cures exist and the choice is the founder's:

- **(a) Exception, ratified**: the founder ratifies the nine as his own
  delegated seat's work under his GitHub account (codex), documented here
  and on the PR; the PRs then take their landed-via-main / supersession
  receipts and close; ANT proceeds on its own merits.
- **(b) Re-land under the compliant identity**: the owning seat lands the
  same content as NEW descendant commits authored
  `loVis waTer <loviswater44@gmail.com>`, the nine cited by hash in the
  message (provenance by citation, not rewrite); the re-land range is
  §7-clean; the PRs close against the re-landed SHAs.

This seat recommends (a): the content is already hosted-green, and the
precedent prefers naming over duplicating lineage for identity cosmetics.

## Standing state until the founder's word

PR #346 and PR #347 remain OPEN (closure bar: executed-success evidence ✓
+ both PRs' unique coverage ✓ + §7 explicitly resolved ✗). ANT publication
remains gated. No forge, no force-push, no check-weakening, no PR closures
this turn. A pointer to this dispatch is posted on PR #347 where reviewers
look.

— zCode seat, provenance reconciliation, 2026-10-16

## Rider — the staged ratification instrument (verified review adopted; awaiting the founder's word)

The founder-directed review verified this reconciliation and ADOPTED the
exception route with a framing correction, retiring option (b):

- **Correction adopted**: any ratification names the nine as **authorized
  delegated work, not commits personally authored by the founder** — the
  original metadata never satisfied §7 and is not claimed to have.
- **Option (b) retired as weaker**: re-landing identical content adds no
  history (the changes are already on main), cannot remove the nine, and
  typing the approved identity into new metadata proves nothing about the
  founder's authorization. A recorded hash-scoped exception is cleaner and
  more auditable.

**The instrument, staged for the founder's explicit gesture** — on the
founder's word ("ratified", or his own wording, in chat or on the PR), the
ruling is recorded as follows:

1. The nine immutable commit hashes are the COMPLETE exception set:
   `fbba92ddb` `4c39ad70d` `0b0e3cc5d` `345d7a762` `959fff653`
   `c917e0da3` `bacebeaaa` `12392476d` `4e5d39890`.
2. The founder accepts the work and its delegated provenance (codex seat
   under his GitHub account), WITHOUT claiming the original metadata
   satisfied §7.
3. The original failing CI receipts remain preserved in the audit trail,
   pinned by ID: tests run `38975122019` (the landing push, static §7) and
   PR pull-request tests run `38974880451` (static §7) — links to be
   attached to both PRs at closure, beside the green privacy runs.
4. All future commits remain subject to the UNCHANGED §7 identity and
   attribution rules (identity-check.sh untouched; this seat's ranges
   already comply).
5. This ratification authorizes NOTHING else — no additional genealogy
   collection, no ANT publication (both remain their own gates).

**Closure sequence on ratification** (owning seat, mechanical): record the
founder's exact ruling → attach the nine hashes + the hosted-test receipts
(green: `d938ba682` / `7d1bcc766` / `1c8727f1d` runs; §7 failures: the two
pinned above) → verify both PRs' substantive coverage one final time →
receipt on PR #347 as landed-through-main and close it → receipt on PR #346
as superseded and close it → ANT proceeds only through its own separate
gate. No ratification has been issued: both PRs remain open, and this
document claims no founder authority by itself.

— zCode seat, instrument staged, 2026-10-16

## Rider 2 — RATIFICATION EXECUTED (founder word recorded; audit corrections applied)

**The founder's word, recorded verbatim from this seat's chat, 2026-10-16:**
`RATIFY APPROVED` — the explicit gesture the staged instrument called for.
The relaying review's "no authorization is inferred" clause speaks for the
review itself; the founder's covering word is the decision.

**Both audit corrections applied before recording:**

1. **All three §7-failure receipts preserved** (not two):
   [38975122019](https://github.com/beehive-nature/beehive-nature/actions/runs/38975122019)
   and [38975139548](https://github.com/beehive-nature/beehive-nature/actions/runs/38975139548)
   (both `tests` at the landing push `c210e4269`) and
   [38974880451](https://github.com/beehive-nature/beehive-nature/actions/runs/38974880451)
   (PR pull-request `tests`). All three failed in `static` at the §7
   identity check and remain in the audit trail permanently.
2. **Committer description corrected, precisely as the metadata reads:**
   the nine commits as they stand on MAIN carry the founder's GITHUB-NOREPLY
   identity as AUTHOR and the founder's LOCAL GIT identity
   (`loVis waTer <loviswater44@gmail.com>`) as COMMITTER — a rebase
   artifact, not a separately-identified local seat. The ORIGINAL 10-05 PR
   lineage carried the noreply identity as BOTH author and committer.
   NEITHER shape satisfies §7's web-flow exemption. The earlier "local seat
   as committer" wording is withdrawn as imprecise; the violation itself
   was and remains real.

**The ruled exception set — full 40-char hashes, with the original PR
lineage mapping retained:**

| # | On main (rebased landing) | Original 10-05 PR commit | Subject |
|---|---|---|---|
| 1 | fbba92ddb8142a95a6ffeadc30d3288835d5b6fd | f6a7c8bb8afe4b576fe4f91bfc7ed9f59ca0363f | start public tree at deceased branch entries |
| 2 | 4c39ad70d75528660c09431d9f3a1838290dec69 | 0a3538c003f56f9f655dd91d40aba02a76831230 | focus the active spatial tree after climb |
| 3 | 0b0e3cc5df228500bb6cc99b228606f3b083430a | a344d22013f5e3dad0a07f16bba6900038f3822a | publish deceased-entry tree renderer |
| 4 | 345d7a762437e37731b1b5ca3039fe066a6c816f | d2e10f4db0f94ccc83633e3c3c45478f4c3c446d | follow spatial tree contract and exclude living UI |
| 5 | 959fff653e8c81c241ca8f6c0c032b672abfdfe2 | ab08ae7345b4ada96b2d98ddb38d066b94bb90fd | lock deceased-entry tree privacy boundary |
| 6 | c917e0da339043572c7c53c045abefb67dc34207 | d4a2f4c22044aef366f293e24a5ce7c2b96e774c | render grandparent self branch without blank path |
| 7 | bacebeaaad5f4865d801cfa4b18d993b295a551b | c4a51b2df20ce431965e2bc04615099c9822c5c5 | lock grandparent self rendering |
| 8 | 12392476dd621765a1328c5fcabb7fddf716cef2 | 6d82f02bada858d5bea69e4c5f4e1eda02c07c38 | traverse hidden living stubs without rendering them |
| 9 | 4e5d3989027ea1f621f00bdbf80d192528e41346 | 785ff43be07c42caefa79766a2fe02cf9cf9861a | keep ancestry beyond hidden living relatives |

**The ruling as executed** (five conditions, per the ratified instrument):
(1) the eighteen hashes above — nine landed, nine original — are the
COMPLETE exception set; (2) the nine are authorized DELEGATED work (the
codex seat under the founder's GitHub account), with NO claim that the
original metadata satisfied §7 or that the founder personally authored
them; (3) the three §7-failure runs stay preserved — this is an explicit
historical exception, never a retroactive passing verdict; (4) §7 stands
unchanged for all future commits (identity-check.sh untouched; this seat's
ranges comply); (5) this ratification authorizes NOTHING else — no
additional genealogy collection, no ANT publication (both remain their own
gates).

**Closure verified + executed this turn**: coverage re-verified (the ten
genealogy files byte-unchanged `c210e4269` → tip, so the hosted green runs
— `d938ba682`, `7d1bcc766`, `1c8727f1d` — tested exactly the landed
implementation); receipts with both the green-run links and the three §7
failures posted on both PRs; PR 347 takes landed-through-main; PR 346
takes superseded; both take their receipts and the API closure this turn.
ANT publication remains separately gated.

— zCode seat, executing the founder's recorded word, 2026-10-16
