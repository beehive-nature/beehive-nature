# DISPATCH · Seat 3 → zCode — bQueenBee's senses: hearing and seeing, law-bound

**2026-08-22 · founder, verbatim:** *"what about bQueenBee hearing and seeing us?"* +
*"remember to get zCode to labor the heavy token demand stuff"* — this is that labor.
Requires a COURSE_SYNC receipt. Seat 3 already landed her voice OUT + register-adaptive
pass-offs + KB update (`bqueenbee-live.html`, this hour) — read that implementation
first; your work extends it, never replaces it.

## THE LAW-TRAP, ruled before you start

Her own KB answer states: "This page is static and keyless: it sends nothing, records
nothing, observes nobody." **Every sense you add must keep that answer true or amend it
honestly.** Rulings:

1. **HEARING (speech-to-text) — two lanes, both consent-first:**
   - **Lane A (ships first): browser `SpeechRecognition`, disclosed-dependency pattern.**
     Chrome/Edge implementations SEND AUDIO TO THEIR VENDOR (Google/Microsoft) — that is
     an egress and must wear the bantfarm Trezor-bridge pattern: press-to-talk ONLY
     (never ambient, never auto-start), the mic button names the egress BEFORE the first
     press ("your browser's recognizer may send audio to its vendor — on your press
     only"), a visible live indicator while listening, hard stop on release/blur, and
     her KB privacy answer amended to name Lane A as the one disclosed exception when
     the user invokes it. Feature-detect; browsers without it get an honest absence.
   - **Lane B (evaluate + spec, founder-gated to build): local STT** — whisper-family
     WASM in-browser. Estate prior art: broom-agent runs whisper CPU locally. Deliver a
     sized evaluation (model download MB, cold-start, per-utterance latency on a mid
     phone) — if the poor-starving-artist budget can carry it, Lane B replaces Lane A as
     default and the egress disclosure retires. No build before the founder reads costs.
2. **SEEING — objects, never identities. HARD CEILING:** her spec gives her "no
   identity verdicts," and biometrics live behind BIO-1's founder-gated ceremonies.
   Therefore: camera lane is **press-to-see, on-device only** (getUserMedia frames
   never leave the page — state it), and she reads THINGS, not faces: (a) **bComb
   frames** — reuse the receive-lane decoder (onboarding/receive.html carries the
   inlined codec; the beam law says fixes apply to both inlined copies); (b) **kandi
   strings shown to the camera** (a KND1 string as QR or the comb-encoding — pick one,
   spec it); (c) explicitly refuse face/person analysis in code comments AND in her
   spoken refusal if asked ("I read receipts and light, never faces — by law").
   No frame persistence, no canvas kept beyond decode, indicator while camera is live.
3. **Register-adaptive senses UI** rides the existing pattern: bee = big friendly
   press-to-talk button; raver = glowing pulse chip; cypherpunk = the API named +
   egress fact visible. All three exist as data-reg variants like the pass-offs.
4. **Her replies stay KB-driven** (matching stays regex/local). Heard text lands in
   the ask box exactly as typed text would — hearing changes INPUT, never her brain.
   No cloud LLM enters this page; the handoff prompt remains the bridge to bigger minds.

## Deliverables

Patch series to Seat 3 (verify+push): (1) Lane A hearing + the KB privacy-answer
amendment + register UI; (2) camera bComb/kandi reading with the on-device guarantee;
(3) the Lane B evaluation as a receipt doc with measured numbers (no build). Gates:
smoke + estate-review green, behavioral checks for press-to-talk lifecycle (start,
live indicator, stop on blur) and camera indicator. Perf laws bind; consent law binds
hardest: NOTHING listens or looks except between press and release.

— Seat 3 ⚓ her senses arrive the way everything arrives here: on consent, with receipts.

## ADDENDUM — the ECO roster, exhaustive (founder-ordered same hour)

Founder, verbatim: *"she should know every engineer and code contributor to BNROsE ECO
… she will have to be the gold standard as Queen of the ECO."* Seat 3 landed the
mechanism + seed roster (`surfaces/eco-roster.json`, 9 entries; her matcher answers
by name, lists the roster, and gives unknowns the honest absence + dock-yourself-by-PR
door). **Your labor: make it exhaustive.** Mine every `Co-authored-by`/author identity
across ALL estate repos (beehive-nature, bnr-design-system, LOVErnment-DAO, b-domain,
bnri-contracts) into roster entries with receipts; add upstream Autonomi/MaidSafe
individual engineers ONLY where their public record supports an entry (their GitHub,
their published work — cite-or-stop; where you cannot cite a person, the org-door
entry already covers it honestly). THE PRIVACY LAW BINDS: public professional records
only, real names only where self-published, removal honored with history kept. Bump
the roster fetch `?v=` on every change.
