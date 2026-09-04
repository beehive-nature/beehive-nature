// four-objections.patch.mjs — one-shot: inserts THE FOUR OBJECTIONS section
// (css + html + the EN copy map) into scripts/build-atlas.mjs, following the
// GLOSS pattern: the generator holds the EN strings, the template emits them
// inside data-i18n spans (corpus EN must match page bytes). Run once:
//   node scripts/tmp/four-objections.patch.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'scripts/build-atlas.mjs';
let s = readFileSync(f, 'utf8');

if (s.includes('hub.four.kicker')) { console.log('already patched'); process.exit(0); }

/* the EN strings, patch-time copy (the inserted map is build-atlas runtime) */
const FOUR = {
  kicker: 'the four objections, answered by design',
  title: 'what stops people — and what we built about it',
  intro: "autonomi's own community named four reasons people hesitate. the estate answers each one by construction, not by promise — and writes the answers on the door.",
  q1: 'do I want this permanent?',
  a1: 'arweave keeps what you choose forever; autonomi keeps what you choose private — and deletable. two vaults, your call per record.',
  'a1.bee': "your agent's birth certificate lives on arweave — permanent by physics, not by promise. your everyday files live on autonomi — private, and gone the day you delete them.",
  'a1.raver': "the mixtape you want forever is forever. the selfies you don't? gone when you tap delete. no vault holds both hostage.",
  'a1.cypher': 'permanence is a per-record property: arweave for the receipt of you, autonomi for the self that changes. lock-in requires immutability — deletion stays a first-class verb.',
  q2: 'do I trust it with personal data?',
  a2: 'encrypted under your own key before it leaves your device — the estate stores locked boxes, never the keys.',
  'a2.bee': 'your files are locked with YOUR key before they travel. the estate can store them; it can never open them.',
  'a2.raver': 'we built the locker. we never had a copy of your key. that is the whole point of a locker.',
  'a2.cypher': 'client-side encryption under keys the estate never sees; the storage layer holds ciphertext and minimal pointers. trust is not required — verification is.',
  q3: 'my phone already backs up for free — where is my login-anywhere?',
  a3: 'one install, your own name (.b), every device — your stuff follows your name, not the machine.',
  'a3.bee': 'install once, claim your .b name, sign in anywhere with it. new phone? same name, everything still yours.',
  'a3.raver': 'your name is your login — same room, same crew, same files, from any phone. no new account per app, ever.',
  'a3.cypher': 'the .b name is a self-sovereign pointer: keys you hold, a name you own, sessions anywhere — login-anywhere without an identity provider.',
  q4: 'tracking every crypto transaction for tax is agony.',
  a4: 'the meter receipts every spend the moment it happens — and sets the tax aside for you as it goes.',
  'a4.bee': 'every spend prints its own receipt, and the tax slice is put aside automatically. april-you says thanks.',
  'a4.raver': 'no spreadsheet hell. the house keeps the books and holds the tax bit aside while you spend.',
  'a4.cypher': 'the meter emits signed, resource-denominated receipts per spend; the liability accrues to a reserved bucket at spend time — auditability without the ledger chores.'
};

/* ── 1 · the EN copy map, inserted after the GLOSS const ────────────────── */
const GLOSS_TAIL = `  bnr: 'the kernel\\u2019s public face — quests for curious minds'
};`;
const FOUR_MAP = GLOSS_TAIL + `
/* THE FOUR OBJECTIONS — autonomi's own community named why people hesitate;
   the estate answers each by construction. Three audiences per answer (the
   register law's bee / raver / cypherpunk). EN is the corpus anchor: the
   generator emits it inside the spans, lang-corpus carries the tongues. */
const FOUR = {
  kicker: 'the four objections, answered by design',
  title: 'what stops people — and what we built about it',
  intro: 'autonomi\\u2019s own community named four reasons people hesitate. the estate answers each one by construction, not by promise — and writes the answers on the door.',
  q1: 'do I want this permanent?',
  a1: 'arweave keeps what you choose forever; autonomi keeps what you choose private — and deletable. two vaults, your call per record.',
  'a1.bee': 'your agent\\u2019s birth certificate lives on arweave — permanent by physics, not by promise. your everyday files live on autonomi — private, and gone the day you delete them.',
  'a1.raver': 'the mixtape you want forever is forever. the selfies you don\\u2019t? gone when you tap delete. no vault holds both hostage.',
  'a1.cypher': 'permanence is a per-record property: arweave for the receipt of you, autonomi for the self that changes. lock-in requires immutability — deletion stays a first-class verb.',
  q2: 'do I trust it with personal data?',
  a2: 'encrypted under your own key before it leaves your device — the estate stores locked boxes, never the keys.',
  'a2.bee': 'your files are locked with YOUR key before they travel. the estate can store them; it can never open them.',
  'a2.raver': 'we built the locker. we never had a copy of your key. that is the whole point of a locker.',
  'a2.cypher': 'client-side encryption under keys the estate never sees; the storage layer holds ciphertext and minimal pointers. trust is not required — verification is.',
  q3: 'my phone already backs up for free — where is my login-anywhere?',
  a3: 'one install, your own name (.b), every device — your stuff follows your name, not the machine.',
  'a3.bee': 'install once, claim your .b name, sign in anywhere with it. new phone? same name, everything still yours.',
  'a3.raver': 'your name is your login — same room, same crew, same files, from any phone. no new account per app, ever.',
  'a3.cypher': 'the .b name is a self-sovereign pointer: keys you hold, a name you own, sessions anywhere — login-anywhere without an identity provider.',
  q4: 'tracking every crypto transaction for tax is agony.',
  a4: 'the meter receipts every spend the moment it happens — and sets the tax aside for you as it goes.',
  'a4.bee': 'every spend prints its own receipt, and the tax slice is put aside automatically. april-you says thanks.',
  'a4.raver': 'no spreadsheet hell. the house keeps the books and holds the tax bit aside while you spend.',
  'a4.cypher': 'the meter emits signed, resource-denominated receipts per spend; the liability accrues to a reserved bucket at spend time — auditability without the ledger chores.'
};`;
if (!s.includes(GLOSS_TAIL)) { console.error('GLOSS TAIL MISSING'); process.exit(1); }
s = s.replace(GLOSS_TAIL, FOUR_MAP, 1);

/* ── 2 · the css ─────────────────────────────────────────────────────────── */
const CSS_ANCHOR = '.orgnav{display:flex;flex-wrap:wrap;gap:8px;padding:16px 0 4px}';
const FOUR_CSS = `.four{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:clamp(12px,2.5vw,18px);margin:0 0 22px}
.four .kick{color:var(--faint);font-size:10px;letter-spacing:.34em;text-transform:uppercase;margin:0 0 10px}
.four .fourhead h2{font-size:20px;font-weight:700;margin:0;letter-spacing:-.01em}
.four .fourintro{color:var(--dim);font-size:12.5px;line-height:1.75;max-width:76ch;margin:0 2px 14px}
.four .row{background:var(--inset);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-top:10px}
.four .q{color:var(--b-value);font-size:13px;line-height:1.6;margin:0}
.four .a{color:var(--ink);font-size:13.5px;line-height:1.65;margin:7px 0 0}
.four .regs{display:flex;flex-direction:column;gap:4px;margin-top:9px}
.four .reg{display:flex;gap:8px;align-items:baseline;font-size:11.5px;line-height:1.7;color:var(--dim)}
.four .reg .who{flex:none;color:var(--faint);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;min-width:104px}
@media (max-width:600px){.four{padding:13px 12px}.four .reg .who{min-width:88px}}
`;
if (!s.includes(CSS_ANCHOR)) { console.error('CSS ANCHOR MISSING'); process.exit(1); }
s = s.replace(CSS_ANCHOR, FOUR_CSS + CSS_ANCHOR, 1);

/* ── 3 · the html ────────────────────────────────────────────────────────── */
const esc2 = (t) => t; // the map's strings are estate-authored, no user input; GLOSS precedent interpolates raw
const ROW = (n) => `<div class="row">
<p class="q">“<span data-i18n="hub.four.q${n}">${esc2(FOUR['q' + n])}</span>”</p>
<p class="a" data-i18n="hub.four.a${n}">${esc2(FOUR['a' + n])}</p>
<div class="regs">
<div class="reg"><span class="who">🐝 the new bee</span><span class="t" data-i18n="hub.four.a${n}.bee">${esc2(FOUR['a' + n + '.bee'])}</span></div>
<div class="reg"><span class="who">🪩 the raver</span><span class="t" data-i18n="hub.four.a${n}.raver">${esc2(FOUR['a' + n + '.raver'])}</span></div>
<div class="reg"><span class="who">🕶 the cypherpunk</span><span class="t" data-i18n="hub.four.a${n}.cypher">${esc2(FOUR['a' + n + '.cypher'])}</span></div>
</div>
</div>`;

const HTML_ANCHOR = `<div class="wrap">
<!--ATLAS-STATIC-START-->`;
const FOUR_HTML = `<div class="wrap">
<section class="four" aria-label="the four objections, answered by design">
<p class="kick" data-i18n="hub.four.kicker">${esc2(FOUR.kicker)}</p>
<div class="fourhead"><h2 data-i18n="hub.four.title">${esc2(FOUR.title)}</h2></div>
<p class="fourintro" data-i18n="hub.four.intro">${esc2(FOUR.intro)}</p>
${ROW(1)}
${ROW(2)}
${ROW(3)}
${ROW(4)}
</section>
<!--ATLAS-STATIC-START-->`;
if (!s.includes(HTML_ANCHOR)) { console.error('HTML ANCHOR MISSING'); process.exit(1); }
s = s.replace(HTML_ANCHOR, FOUR_HTML, 1);

writeFileSync(f, s);
console.log('generator patched — FOUR map + css + section html');
