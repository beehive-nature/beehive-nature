# DISPATCH · Seat 3 → zCode — the bData Archive: mirror the mUseUm's evidence before it rots

**2026-08-22 · founder, verbatim:** *"we need clickable links to a pop out/new tab pointed
to the AR/ANT mirror bData Archieve before it is all censored on central servers."*
Requires a COURSE_SYNC receipt. Seat 3 landed the immediate half this hour: every
external source anchor in plur.html now opens a new tab, the flagged legislation card
got its missing links (enacted + current), and the museum carries the bData Archive
law block naming the plan and its honest status.

## Your labor — the snapshot-and-manifest pipeline (NO uploads, NO funds)

1. **LINKIFY THE REST**: many RECORD cards cite sources as plain text. The exact URLs
   live in `docs/dispatches/payloads/*.json` and the two fleet payloads' claims —
   restore every citable URL as a `target="_blank" rel="noopener"` anchor on its card.
   Books stay text (cite the edition). Wayback links are already the citable copy for
   dead paths — keep them.
2. **SNAPSHOT**: for every external URL cited by a RECORD card, fetch and store a
   single-file snapshot (HTML with assets inlined, or the PDF where the source is one)
   under `archive-staging/` (gitignored — snapshots of third-party pages do NOT enter
   the public repo; copyright law binds: we archive for preservation, we do not
   republish paywalled/full third-party works on our Pages).
3. **MANIFEST**: `surfaces/bdata-manifest.json` — per source: canonical URL, fetch
   date, sha256 of the snapshot, byte size, lane per the price-break law (≤~100 kB
   public → Arweave; larger or private → Autonomi), status `pending-founder-upload`,
   `ar_tx: null`, `ant_addr: null`. The manifest IS public; the staging files are not.
4. **THE MUSEUM READS THE MANIFEST**: plur.html grows a tiny loader — when a card's
   source URL has a manifest entry with a live `ar_tx`/`ant_addr`, a 🗄 mirror link
   appears beside the source (new tab, pointing at the AR gateway / Autonomi address);
   `pending` entries render nothing in bee/raver and an honest `mirror queued` note in
   the cypherpunk register only. No fake links, ever.
5. **THE FOUNDER'S RUNBOOK**: one page of exact commands for HIS hand — ant CLI upload
   per staged file (his wallet), Arweave upload for the small lane — each command
   printing the id to paste into the manifest. Per house law 4a: if it needs his
   identity, it is a script with checks and one line to run — he is a signature,
   never a typist. **No seat executes an upload, holds a key, or spends a token.**

Gates: manifest schema-validated; every manifest sha256 reproducible from staging;
smoke/estate-review green; the cypherpunk register states the mechanism. Patch series
to Seat 3, who verifies and pushes.

— Seat 3 ⚓ evidence that can't be un-published is the only evidence a museum should trust.

## ADDENDUM — the sponsor lane (founder ruling, same hour, verbatim):
*"one contributer to mirror and spend ANT/AR and boom everyone has it forever"*

The paying hand is ANY contributor, not only the founder. Therefore:
6. **Manifest entries are open bounties.** Each `pending-founder-upload` becomes
   `pending-sponsor`. Anyone uploads a staged snapshot with THEIR OWN wallet and PRs
   the tx id / address into the manifest.
7. **The gate verifies mirrors trustlessly** (`verify/mirror-check.mjs`): fetch the
   claimed AR tx / Autonomi address, hash the served bytes, compare to the manifest
   sha256 — match or reject, no sponsor trust involved. Content-addressing makes
   sponsorship a pure gift: one pays once, everyone holds it forever.
8. **Credit rides the roster**: a verified sponsor may dock a `receipts` line for the
   mirror they funded — permanence as a public act. The runbook (item 5) becomes
   the SPONSOR runbook: same one-line commands, anyone's wallet, still never a seat's.
