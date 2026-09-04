# DISPATCH — NEVER SEND A SECRET + the phone room switcher — 2026-09-04

Seat: z3.2. Two user-facing findings from the founder's own phone test of
/join, both landed, both receipted at 390px. PR block/buzz#7311 updated
(256b4b45).

## ⚠ FOR THE FOUNDER'S EYES FIRST — a secret was pasted into welcome-everyone

The receipt shot caught it live: member `db1ccc71…7a89` pasted what looks
like a REAL nsec secret into #welcome-everyone ~7h before this build
("nsec1v9ra7fwacmk54qmlcd2d7p84nsprs4fe4z070cw k40×0g5ckaegq9ppmw7"), and a
human (`1de4137e…ed49`) already asked for a deletion in-room. That key must
be considered COMPROMISED — owner actions, not mine to take:
1. revoke/rotate the `db1ccc71…` relay membership row (owner/admin gesture);
2. tell the member to make a fresh identity (the /join flow makes one in
   one tap) and treat the old one as burned;
3. the in-room deletion request can ride the relay's kind-5 deletion path
   (moderation lane).
The guard this dispatch ships would have refused that paste at the composer
and again at the relay.

## 1 · NEVER SEND A SECRET

**Relay (defense in depth, PR upstream)**: kind 9 content carrying a bech32
secret key is refused before ingest — `content_leaks_secret` matches the
TOKEN SHAPE (`nsec1` + ≥15 bech32 digits; a real nsec is ~63), so ordinary
words that merely contain the prefix pass (the first cut was a bare
substring and my own false-positive test caught it). Plain-words refusal:
*"invalid: that looks like a private key (nsec1...) -- never send a secret
into a room"*. 3 unit tests green.

**FORK-TO-PROVEN LIVE**: on the throwaway stack (rotate-test.local, OUR
debug binary, fresh throwaway owner + fresh member): mint 200 → claim 200
joined → NIP-42 AUTH ok → the nsec post returned **OK FALSE** with exactly
the guard refusal → `GUARD_VERDICT=PROVEN`. One [cfg(test)] attribute
placement bug in the first cut (the helper landed under the attribute and
vanished from non-test builds) was caught by cargo-build vs cargo-test
divergence and fixed; the tests mod's pre-existing rot was re-fenced.

**Client**: the composer refuses the same shape BEFORE signing — plain
words, draft KEPT, a clear-the-draft action; the substring trap sends
normally (precision proven on the live hive by an actual send + receive).
The copy-the-secret control moved OFF the composer into its own bottom
sheet (opened from the header "key" chip) with the never-paste warning
beside the copy button — the control that handles the secret is never next
to the control that broadcasts.

## 2 · The phone room switcher

`join.json` gains optional `rooms: [{id, name}]` (operator-curated; a
malformed rooms array refuses the whole material — fail-closed). The phone
view renders the rooms as chips under the header; switching resets the pane
and re-opens the live socket on that channel; the join lands on
default_channel. Estate rooms live: **welcome-everyone · general · huddle ·
PLUR** (huddle is private — a non-member sees the relay's verdict verbatim
in the room pane). Receipt: a message read in TWO rooms in one session.

## Receipts (e2e/shots-buzz/)

- `join-390-nsec-refused.png` — the order's receipt: the paste, the
  plain-words refusal, the kept draft — and the leaked-key finding visible
  in the history behind it
- `join-390-switcher-general.png` — #general with its own history
  (the founder's photo + "bClaude present.") after switching
- `join-390-switcher-welcome.png` — back on welcome-everyone
- `join-390-key-sheet.png` — the secret in its own sheet, away from the
  composer
- `e2e/buzz-guard-shot.mjs` — 16/16 PASS (guard + precision send + two-room
  switch + sheet placement)

## Ledger

- fork: skaists/buzz branch join-by-address @ 256b4b45 (bundle-push, the box
  has no GitHub creds); PR block/buzz#7311 updated with a findings comment
- estate deploy: /join/ SPA rebuilt (guard + switcher); join.json carries
  the four rooms (backups: join dir is regenerated from
  `/tmp/join-dist` builds; join.json edits are single-file)
- throwaway stack restored: stock relay container re-started is PENDING —
  `sudo docker start invite-rotate-test-relay-1` (stopped for the fork
  proof; the deps stayed up)
