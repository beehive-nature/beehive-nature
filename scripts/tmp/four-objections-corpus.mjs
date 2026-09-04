// four-objections-corpus.mjs — birth the hub.four.* corpus keys: EN filled
// (must match the generator's page bytes byte-for-byte), every other docked
// tongue honestly en-filled at birth (visible fallback, counted by the
// coverage counter — the K3 convention). Run once from the repo root:
//   node scripts/tmp/four-objections-corpus.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'surfaces/lang-corpus.json';
const c = JSON.parse(readFileSync(f, 'utf8'));
const langs = c._meta.langs;

const EN = {
  'hub.four.kicker': 'the four objections, answered by design',
  'hub.four.title': 'what stops people — and what we built about it',
  'hub.four.intro': "autonomi's own community named four reasons people hesitate. the estate answers each one by construction, not by promise — and writes the answers on the door.",
  'hub.four.q1': 'do I want this permanent?',
  'hub.four.a1': 'arweave keeps what you choose forever; autonomi keeps what you choose private — and deletable. two vaults, your call per record.',
  'hub.four.a1.bee': "your agent's birth certificate lives on arweave — permanent by physics, not by promise. your everyday files live on autonomi — private, and gone the day you delete them.",
  'hub.four.a1.raver': "the mixtape you want forever is forever. the selfies you don't? gone when you tap delete. no vault holds both hostage.",
  'hub.four.a1.cypher': 'permanence is a per-record property: arweave for the receipt of you, autonomi for the self that changes. lock-in requires immutability — deletion stays a first-class verb.',
  'hub.four.q2': 'do I trust it with personal data?',
  'hub.four.a2': 'encrypted under your own key before it leaves your device — the estate stores locked boxes, never the keys.',
  'hub.four.a2.bee': 'your files are locked with YOUR key before they travel. the estate can store them; it can never open them.',
  'hub.four.a2.raver': 'we built the locker. we never had a copy of your key. that is the whole point of a locker.',
  'hub.four.a2.cypher': 'client-side encryption under keys the estate never sees; the storage layer holds ciphertext and minimal pointers. trust is not required — verification is.',
  'hub.four.q3': 'my phone already backs up for free — where is my login-anywhere?',
  'hub.four.a3': 'one install, your own name (.b), every device — your stuff follows your name, not the machine.',
  'hub.four.a3.bee': 'install once, claim your .b name, sign in anywhere with it. new phone? same name, everything still yours.',
  'hub.four.a3.raver': 'your name is your login — same room, same crew, same files, from any phone. no new account per app, ever.',
  'hub.four.a3.cypher': 'the .b name is a self-sovereign pointer: keys you hold, a name you own, sessions anywhere — login-anywhere without an identity provider.',
  'hub.four.q4': 'tracking every crypto transaction for tax is agony.',
  'hub.four.a4': 'the meter receipts every spend the moment it happens — and sets the tax aside for you as it goes.',
  'hub.four.a4.bee': 'every spend prints its own receipt, and the tax slice is put aside automatically. april-you says thanks.',
  'hub.four.a4.raver': 'no spreadsheet hell. the house keeps the books and holds the tax bit aside while you spend.',
  'hub.four.a4.cypher': 'the meter emits signed, resource-denominated receipts per spend; the liability accrues to a reserved bucket at spend time — auditability without the ledger chores.'
};

let added = 0, filled = 0;
for (const [key, en] of Object.entries(EN)) {
  if (c.strings[key]) { console.log('exists, skipped:', key); continue; }
  c.strings[key] = { en };
  added++;
  for (const L of langs) {
    if (!c.strings[key][L]) { c.strings[key][L] = en; filled++; }
  }
}
writeFileSync(f, JSON.stringify(c, null, 1) + '\n');
console.log(`keys added: ${added} · en-fill cells: ${filled} · tongues: ${langs.length} · total keys now: ${Object.keys(c.strings).length}`);
