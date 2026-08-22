# DISPATCH · Seat 3 → zCode — SPRINT: the Dock — self-service contributor onboarding

**2026-08-22 · founder-approved sprint** (his word on the dock-yourself-by-PR flow:
*"this sounds like a good next sprint for zCode?"* — affirmed by Seat 3, shaped here).
Requires a COURSE_SYNC receipt. Foundation already live: `surfaces/eco-roster.json`
(9 seed entries, the privacy law in `_law`) + bQueenBee's roster matcher (`9e8453f`).

## The sprint's shape — GitHub's PR flow IS the identity ceremony

**S1 · The Dock wizard** (`surfaces/dock.html`): a keyless form that BUILDS your
roster entry — handle, aliases, role (one honest sentence), receipts (2+ URLs to
public work). Live JSON preview, validated in-page against the schema; then two
doors: 📋 copy the entry, and **→ open the PR** (deep-link to
`github.com/beehive-nature/beehive-nature/edit/main/surfaces/eco-roster.json` —
GitHub walks fork→edit→PR itself; we never touch their identity). Three-register
prose; the raver register is the welcome mat (PLUR law binds: everyone's already in).
The wizard bumps nothing — the `?v=` bump happens at merge time (S3 gate reminds).

**S2 · The schema gate** (`verify/roster-lint.mjs` + wire into e2e): machine-enforces
the privacy law — required fields only (id, names[], role, since, receipts[]);
REJECTS: email addresses anywhere, phone-shaped strings, birthdates, physical
addresses, any field not in schema; receipts must be https or estate-relative;
name-collision check against existing ids/aliases; role length cap (280); entries
sorted stable. Runs green on the current 9 before anything else lands.

**S3 · The Queen greets**: her matcher gains "newest on the roster" (last N entries
by file order) and a merged dock earns a `receipts.drop` line in her feed format.
On the wizard she gets one cameo answer: ask her "how do I join?" → she walks you to
the Dock. Roster fetch `?v=` bump rides every roster change (cache law).

**S4 · The exhaustive mining sweep** (folds in from the QUEEN_SENSES addendum):
every Co-authored-by/author identity across the five estate repos → entries with
receipts; upstream individuals only where their public record supports it —
cite-or-stop; the org-door covers the rest honestly.

**LAWS BINDING THE SPRINT**: public professional records only; real names only where
self-published; removal on request honored with history kept (a removed entry leaves
a dated tombstone line in the file's _law history, name struck); no accounts, no
cookies, no telemetry on the wizard; a PR from a stranger merges only after a human
seat checks the receipts actually belong to the claimant (the gate lints shape —
HUMANS verify ownership; say so on the wizard).

Delivery: patch series to Seat 3 (verify+push). Order: S2 gate first (protects
everything after), S1 wizard, S3 queen, S4 sweep.

— Seat 3 ⚓ the hive grows by people docking themselves, receipts in hand.
