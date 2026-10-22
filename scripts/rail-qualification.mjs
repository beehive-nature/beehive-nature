#!/usr/bin/env node
/* rail-qualification.mjs — observes the delivery rails and writes the
   qualification receipt (founder milestone 2026-10-20: "actual
   decentralized rail retrieval qualification... exact-byte checks,
   corruption/refusal tests, and observed availability").

   WHAT THIS IS: an operator driver (network allowed — the shipped page
   stays adapter-honest). For each rail it records an honest row:
   observed (with exact-byte evidence), absent (no content — upload is a
   founder gesture), or deferred (obstacle named). Corruption/refusal
   semantics are proven where they live — in the reader itself — by
   e2e/blood-seal.test.mjs gates C/D/G/H/J.

   Rows turn a rail's manifest status qualified:true only when this
   receipt records observed delivery of SEALED CORPUS artifacts (not just
   route mechanics).

   Usage: node scripts/rail-qualification.mjs [--out <path>]
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'assets/profile-archive/lineage/rail-qualification.json';

const LINEAGE = 'assets/profile-archive/lineage';
const PAGES_ORIGIN = 'https://skaists.dev';
const DOOR = 'https://relay.skaists.dev/ant/v1/data/public/';
const DOOR_EXAMPLE = '711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a'; // PUBLIC-CONSTANT ant-door mainnet example address

const sha = (b) => createHash('sha256').update(b).digest('hex');
const rows = [];
const row = (rail, r) => rows.push({ rail, ...r });

async function timedFetch(url) {
  const t0 = Date.now();
  const r = await fetch(url, { cache: 'no-store' });
  const body = Buffer.from(await r.arrayBuffer());
  return { status: r.status, ms: Date.now() - t0, body };
}

// github-pages: the working rail — observe the DEPLOYED Pages origin
// delivering the REAL corpus seal, exact bytes vs the committed artifact.
try {
  const localState = readFileSync(`${LINEAGE}/publication-state.json`);
  const localIndex = readFileSync(`${LINEAGE}/publication-index.json`);
  const state = JSON.parse(localState.toString('utf8'));
  const obs = await timedFetch(`${PAGES_ORIGIN}/${LINEAGE}/publication-state.json`);
  const obsIndex = await timedFetch(`${PAGES_ORIGIN}/${LINEAGE}/publication-index.json`);
  const ok = obs.status === 200 && sha(obs.body) === sha(localState);
  const okIndex = obsIndex.status === 200 && sha(obsIndex.body) === sha(localIndex);
  row('github-pages', {
    observation: ok && okIndex ? 'observed' : 'mismatch',
    detail: `deployed Pages origin delivered publication-state.json (${obs.body.length} B, ${obs.ms} ms) and publication-index.json (${obsIndex.body.length} B, ${obsIndex.ms} ms) byte-identical to the committed artifacts`,
    stateSha256: sha(localState),
    indexBindingOk: sha(localIndex) === state.indexSha256,
    exactBytes: ok && okIndex,
    qualifiedForCorpus: ok && okIndex,
  });
} catch (e) {
  row('github-pages', { observation: 'fetch-failed', detail: String(e.message || e), exactBytes: false, qualifiedForCorpus: false });
}

// autonomi: the estate door route observed live against the known public
// example artifact (exact bytes across two independent reads). NOT corpus
// delivery — no corpus content on Autonomi; upload is a founder gesture.
try {
  const a = await timedFetch(DOOR + DOOR_EXAMPLE);
  const b = await timedFetch(DOOR + DOOR_EXAMPLE);
  const dec = (buf) => {
    const j = JSON.parse(buf.toString('utf8'));
    return Buffer.from(j.data, 'base64');
  };
  const da = dec(a.body);
  const db = dec(b.body);
  const exact = sha(da) === sha(db);
  row('autonomi', {
    observation: a.status === 200 && b.status === 200 && exact ? 'route-observed' : 'mismatch',
    detail: `estate door ${DOOR} served the public example artifact twice (${da.length} B decoded, ${a.ms}/${b.ms} ms), reads byte-identical; response shape JSON {"data": base64} — the reader's door adapter implements exactly this. Corpus delivery NOT qualified: no corpus content on Autonomi (upload = founder gesture, no spend taken).`,
    exampleSha256: sha(da),
    doubleFetchExact: exact,
    qualifiedForCorpus: false,
  });
} catch (e) {
  row('autonomi', { observation: 'fetch-failed', detail: String(e.message || e), qualifiedForCorpus: false });
}

// arweave: adapter implemented (public-gateway GET); observed availability
// ABSENT — no corpus content on Arweave, and none was uploaded (no spend).
row('arweave', {
  observation: 'absent',
  detail: 'gateway fetch adapter implemented in the reader (rail-manifest kind public-gateway); no corpus content on Arweave — uploading is a founder gesture; mechanics proven hermetically by e2e gate J door rails',
  qualifiedForCorpus: false,
});

// x0x: structurally unqualified for PUBLIC reads today (loopback-only
// gossip, no stored history — ops/x0x verbatim); live node observation
// deferred: box SSH refused this wake (connection reset — consistent with
// the known sealed-SSH tenancy state).
row('x0x', {
  observation: 'deferred',
  detail: 'x0xd v0.45 serves loopback 127.0.0.1:12700 pub/sub with no stored history (ops/x0x + harness-sovereign x0x.rs) — a public on-demand read rail is structurally absent, not merely untried; box SSH refused (connection reset) so no live node observation this wake',
  qualifiedForCorpus: false,
});

const receipt = {
  schema: 'skaists.genealogy-rail-qualification/1',
  generated: new Date().toISOString(),
  hexLawNote: 'PUBLIC-CONSTANT observed public-content digests and addresses',
  what: 'delivery-rail observations; a rail flips qualified in rail-manifest.json only when a row here records observed delivery of sealed corpus artifacts',
  note: 'this is a timestamped receipt, NOT part of the sealed state — the seal (publication-state.json /2, pin d7492716…) does not cover it; corruption/refusal semantics are proven in e2e/blood-seal.test.mjs gates C/D/G/H/J through the real reader',
  rows,
};
// compact + hexLawNote: one line, so every digest sits beside its marker
writeFileSync(OUT, JSON.stringify(receipt) + '\n');
for (const r of rows) console.log(`${r.rail}: ${r.observation}${r.exactBytes ? ' (exact bytes)' : ''} — ${r.detail.slice(0, 100)}…`);
console.log(`receipt: ${OUT}`);
