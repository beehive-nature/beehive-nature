// wb001-bridge.test.mjs — the node leg of the formal-wire bridge
// (founder review finding B1, 2026-10-07).
//
// WHAT WAS MISSING: the formal ladder proved `wireInjective` universally
// about the Cryptol wire, but the twin's BRIDGE block was comment-only —
// not one Cryptol wire byte had ever been compared to a runtime
// canonical() byte, so "the deployed envelope is the first envLen bytes
// of wire" was prose. This file and the .cry bridge properties close
// that gap from two sides:
//
//   this leg: canonical() re-derives every pinned term's envelope from
//   the runtime and compares byte-for-byte against wb001-bridge.json,
//   and asserts Intent.cry carries each envelope hex literal verbatim —
//   the two artifacts cannot silently diverge even though cryptol runs
//   only in the CI formal job;
//   the formal leg: wb001-formal-check.sh :checks each bridge property
//   (exact prefix + zero tail + envLen) as closed terms.
//
// Result-class honesty: this is sampled agreement on pinned terms —
// never EQUIVALENCE, never proof; each class keeps its own name.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { canonical, FIELDS } from './wb001-intent.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const bridge = JSON.parse(readFileSync(join(here, 'wb001-bridge.json'), 'utf8'));
const cry = readFileSync(join(here, 'wb001-cryptol', 'Intent.cry'), 'utf8');

// Rebuild a runtime intent from the JSON-safe form; canonical()
// re-validates every field, so a corrupted JSON row refuses loudly
// instead of comparing garbage.
const revive = (intent) => {
  const out = {};
  for (const f of FIELDS) {
    const v = intent[f.name];
    if (f.kind === 'u64') out[f.name] = BigInt(v);
    else if (f.kind === 'utf8') out[f.name] = v;
    else out[f.name] = Buffer.from(v, 'hex');
  }
  return out;
};

test('the formal-wire bridge: runtime canonical() re-derives every pinned envelope byte-for-byte, and Intent.cry carries each hex literal', () => {
  assert.ok(Array.isArray(bridge.terms) && bridge.terms.length >= 8, 'the bridge carries the 8 constructed terms');
  let pinned = 0, carried = 0, lens = 0;
  for (const t of bridge.terms) {
    const envelope = canonical(revive(t.intent));
    assert.equal(envelope.length, t.envLen, `${t.name}: envLen disagrees with the runtime envelope length`);
    assert.equal(envelope.toString('hex'), t.envelopeHex, `${t.name}: runtime bytes drifted from the pinned bridge`);
    pinned++;
    // the .cry must carry the SAME opaque constant — this is the link
    // that makes the formal leg (which cannot run node) comparable
    assert.ok(cry.includes(t.envelopeHex), `${t.name}: Intent.cry no longer carries the pinned envelope hex`);
    carried++;
    assert.ok(cry.includes(`b${t.name} : [${t.envLen}][8]`), `${t.name}: Intent.cry constant declaration drifted`);
    assert.ok(cry.includes(`bridge${t.name[0].toUpperCase()}${t.name.slice(1)}`), `${t.name}: Intent.cry bridge property missing`);
    lens++;
  }
  // and the twins/pairs the battery exists for are still distinct pairs
  const hex = Object.fromEntries(bridge.terms.map((t) => [t.name, t.envelopeHex]));
  assert.notEqual(hex.twinL, hex.twinR);
  assert.notEqual(hex.nearA, hex.nearB);
  console.log(`bT-WB001-bridge: runtime re-derive identical on ${pinned} terms; Intent.cry carries ${carried}/${carried} envelope hex literals + ${lens}/${lens} typed declarations; twin and near pairs distinct`);
});

test('the bridge generator agrees with the committed JSON (the drift gate the CI ratchet reads)', () => {
  // --check re-derives from the runtime and exits 1 on drift; running
  // it here keeps one source of truth (the generator) authoritative
  const out = execFileSync(process.execPath, [join(here, 'wb001-bridge-gen.mjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /identical across \d+ terms/);
  console.log(`bT-WB001-bridge: generator --check held 0 -> ${bridge.terms.length} terms`);
});
