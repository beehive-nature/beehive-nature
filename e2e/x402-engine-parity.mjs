// x402-engine-parity.mjs — ONE LAW, TWO ENGINES, PROVEN EQUAL (z3.2, 2026-09-04).
// The pure 9-check meter audit exists twice BY DESIGN: the node tool the
// contract's auditmark pins (contracts/vending/tool/x402audit.mjs) and the
// browser port a stranger's page runs (surfaces/x402-meter.js, vending.html
// §x402-sec). This gate runs BOTH over the same public record — the four
// demonstrations of the receipt, built here by the gate's own hand — and
// fails on ANY drift: state, check order, check names, ok flags, note bytes.
// If someone edits one engine's arithmetic, wording or precedence, this goes
// red the same hour; a port that silently disagrees with its tool is a fake
// verifier wearing the tool's name.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const tool = await import(pathToFileURL(join(ROOT, 'contracts/vending/tool/x402audit.mjs')).href);
const surfNs = await import(pathToFileURL(join(ROOT, 'surfaces/x402-meter.js')).href);
/* the UMD attaches to module.exports under node's CJS reading of .js and to
   globalThis in a browser — take whichever hand it landed in */
const surf = surfNs.auditSession ? surfNs : (surfNs.default && surfNs.default.auditSession ? surfNs.default : globalThis.X402Meter);
if (!surf) { console.error('FAIL the surface engine did not attach (UMD root)'); process.exit(1); }

const record = JSON.parse(readFileSync(join(ROOT, 'surfaces/x402-session42.json'), 'utf8'));
const base = { sess: record.sess, rate: record.rate, nonces: record.nonces, events: record.events };

/* the four demonstrations, built by the GATE (neither engine's own views()):
   the record as it stands · the pass-1 view (anchor not yet read) · a forged
   charge appended · a malformed anchor. Refused probes carry no timestamp —
   a refusal lands nothing — so the forged charge borrows the last landed
   event's time, exactly as the on-page demo states. */
const noAnchor = base.events.filter(e => e.kind !== 'anchor');
const views = {
  'as it stands': base,
  'pass 1 · before the anchor': { ...base, events: noAnchor },
  'a forged charge': { ...base, events: base.events.concat([{ kind: 'charge', units: 11, whilePaused: false, at: base.events[base.events.length - 1].at }]) },
  'a malformed anchor': { ...base, events: base.events.map(e => e.kind === 'anchor' ? { kind: 'anchor', hash: 'not-a-hash', at: e.at } : e) }
};

let fail = 0;
const ok = (name, cond, note = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : ''));
  if (!cond) fail++;
};

const MUST_STATE = {
  'as it stands': 'PASSED',
  'pass 1 · before the anchor': 'PENDING_ANCHOR',
  'a forged charge': 'FAILED',
  'a malformed anchor': 'INCONCLUSIVE'
};

for (const [label, input] of Object.entries(views)) {
  const a = tool.auditSession(input);        // node tool: numeric state enum
  const b = surf.auditSession(input);        // browser port: named state
  const toolState = tool.STATE_NAME[a.state];
  const same = b.state === toolState &&
    a.checks.length === b.checks.length &&
    a.checks.every((c, i) => c.name === b.checks[i].name && c.ok === b.checks[i].ok && c.note === b.checks[i].note);
  ok('verdicts identical · ' + label, same,
    same ? 'both ' + toolState + ' · ' + a.checks.length + ' checks, notes byte-equal'
         : 'tool ' + toolState + ' vs surface ' + b.state +
           (a.checks.length !== b.checks.length ? ' · check count ' + a.checks.length + ' vs ' + b.checks.length : ' · note drift: ' +
             a.checks.map((c, i) => c.note === (b.checks[i] || {}).note ? '' : c.name).filter(Boolean).join(', ')));
  ok('state is the receipt own word · ' + label, toolState === MUST_STATE[label], toolState);
}

/* the canonical record hash: the fingerprint of exactly what was checked —
   sha256 over canonical JSON {session, checks}. webcrypto vs node:crypto
   must agree byte for byte, or the pinned-hash vocabulary forks. */
const verdictTool = tool.auditSession(base);
const h1 = tool.auditHash({ session: record.session, checks: verdictTool.checks });
const h2 = await surf.auditHash({ session: record.session, checks: surf.auditSession(base).checks });
ok('audit record hash agrees across engines', h1 === h2, h1.slice(0, 16) + '…');

/* the arithmetic the receipt pins: 0.6000 A × 8 units = 4.8000 A, and the
   tithe split 4.3200 + 0.4800 at 1000 bp — read back from the CHECK NOTES,
   not from a stored total */
const notes = Object.fromEntries(verdictTool.checks.map(c => [c.name, c.note]));
ok('arithmetic note is the pinned one', notes.arithmetic_fraud === '0.6000 A × 8 = 4.8000 A', notes.arithmetic_fraud);
ok('tithe split note is the pinned one', notes.tithe_split === 'basis 4.3200 A + tithe 0.4800 A = 4.8000 A @ 1000bp', notes.tithe_split);
ok('the chain-pinned audit_hash sits in the record', /^[0-9a-f]{64}$/.test(record.sess.audit_hash), record.sess.audit_hash.slice(0, 16) + '…');

console.log(fail ? fail + ' check(s) failed' : 'x402 engine parity: tool and surface agree on every verdict, note and hash');
process.exit(fail ? 1 : 0);
