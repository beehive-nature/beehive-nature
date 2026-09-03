#!/usr/bin/env node
/* spend-ledger-gen.mjs — authors surfaces/spend-ledger.json, the PUBLIC copy
   of the estate's spend-receipt record that wallet.html's receipts panel and
   comb.html's verifier lane read and recompute.

   HONESTY LAW, stated here and in the ledger's own _note: this is the
   REHEARSAL record. The live meter (scripts/buzz-meter/meter.py) writes real
   receipts on the box (/opt/buzz-meter/receipts); none are public yet, so
   this copy exists so the auditor has something true-shaped to audit. Every
   deliberately-broken row is labelled FIXTURE in its own bytes. The free-tier
   rates are real law (rateset-v2, verbatim structure); the fixture rate set
   prices NOTHING — inventing an A-rate for the closed paid lane would be a
   tokenomics constant, and those are fence-held (SPEC §4).

   The generator is its own test: after writing, it audits the ledger with
   surfaces/spend-audit.js and asserts every expected state. Run:
     node surfaces/spend-ledger-gen.mjs */
import { createRequire } from 'module';
import { writeFileSync, readFileSync } from 'node:fs';
const SA = createRequire(import.meta.url)('./spend-audit.js');

const RS_V2 = 'rateset-v2', RS_FIX = 'rateset-fixture-a';
const OBS_V2 = '2026-08-29T00:00:00Z', OBS_FIX = '2026-09-03T00:00:00Z';
const RATE_FIX = { prefill_token: '0.000003', decode_token: '0.000015' };  // FIXTURE — prices nothing

/* one receipt in meter.py's exact shape; the tithe line is appended last and
   computed from the basis lines, never stored independently */
async function mk(r) {
  const lines = [];
  for (const [cls, qty, rateVal, ref, obs] of r.lines)
    lines.push({
      adapter: r.adapter, rail: 'other', resource_class: cls,
      quantity: qty, quantity_unit: cls,
      charged: { value: SA.fromS(SA.toS(rateVal) * BigInt(qty)), unit: 'A' },
      rate: { value: rateVal, rate_set_ref: ref, observed_at: obs }
    });
  const basis = lines.reduce((a, l) => a + SA.toS(l.charged.value), 0n);
  const pct = SA.toS(String(r.tithePct));
  lines.push({
    adapter: r.adapter, rail: 'other', resource_class: 'decode_token',
    quantity: 0, quantity_unit: 'tithe',
    charged: { value: SA.fromS(basis * pct / SA.toS('100')), unit: 'A' },
    rate: { value: 0, rate_set_ref: r.lines[0][3], observed_at: r.lines[0][4] },
    tithe: { percent: r.tithePct, law: 'FOUNDER LAW: provider cost basis + 10% TITHE in A — a distinct visible line on every receipt, never buried in the rate' }
  });
  const rec = {
    schema_version: '1.0.0-draft',
    receipt_id: '',
    spender_bdid: { bzdid: null, note: r.spender },
    seller: { name: r.seller },
    occurred_at: r.at,
    operation: Object.assign({ kind: r.kind, lane: r.lane }, r.opNote ? { note: r.opNote } : {}),
    line_items: lines,
    visibility: 'public',
    provenance: { caused_by: r.causedBy, anchors: [], prior_receipt_id: r.prior || null }
  };
  rec.total_computed = { value: SA.fromS(lines.reduce((a, l) => a + SA.toS(l.charged.value), 0n)), unit: 'A' };
  rec.receipt_id = await SA.receiptId(rec);
  return rec;
}

const ADAPTER = 'buzz-compute/llama.cpp';
const ESTATE = 'the estate — free compute', FIXSEL = 'rehearsal seller A (FIXTURE rates)';
const free = (p, d) => [[ 'prefill_token', p, 0, RS_V2, OBS_V2 ], [ 'decode_token', d, 0, RS_V2, OBS_V2 ]];
const fix = (p, d) => [[ 'prefill_token', p, RATE_FIX.prefill_token, RS_FIX, OBS_FIX ], [ 'decode_token', d, RATE_FIX.decode_token, RS_FIX, OBS_FIX ]];

const R = {};
R.r1 = await mk({ adapter: ADAPTER, spender: 'guest key qwen-3b (pre-bzdid)', seller: ESTATE, at: '2026-09-03T09:00:12Z',
  kind: 'compute.generation', lane: 'free_qwen', causedBy: 'llama-server usage.log print_timing', lines: free(1180, 402), tithePct: 10, prior: null });
R.r2 = await mk({ adapter: ADAPTER, spender: 'guest key qwen-3b (pre-bzdid)', seller: ESTATE, at: '2026-09-03T09:07:44Z',
  kind: 'compute.generation', lane: 'free_qwen', causedBy: 'llama-server usage.log print_timing', lines: free(3411, 1290), tithePct: 10, prior: R.r1.receipt_id });
R.r3 = await mk({ adapter: 'rehearsal/paid-lane', spender: 'rehearsal spender (FIXTURE)', seller: FIXSEL, at: '2026-09-03T09:15:02Z',
  kind: 'compute.generation', lane: 'rehearsal_paid_fixture', causedBy: 'FIXTURE generator — exercises nonzero arithmetic', lines: fix(4096, 512), tithePct: 10, prior: R.r2.receipt_id });
R.r4 = await mk({ adapter: 'rehearsal/paid-lane', spender: 'rehearsal spender (FIXTURE)', seller: FIXSEL, at: '2026-09-03T09:41:19Z',
  kind: 'compute.generation', lane: 'rehearsal_paid_fixture', causedBy: 'FIXTURE generator — exercises nonzero arithmetic', lines: fix(15360, 2048), tithePct: 10, prior: R.r3.receipt_id });
R.r5 = await mk({ adapter: ADAPTER, spender: 'guest key qwen-3b (pre-bzdid)', seller: ESTATE, at: '2026-09-03T11:48:03Z',
  kind: 'compute.generation', lane: 'free_qwen', causedBy: 'llama-server usage.log print_timing', lines: free(742, 118), tithePct: 10, prior: R.r4.receipt_id });
R.r6 = await mk({ adapter: 'future/paid-lane', spender: 'rehearsal spender (FIXTURE)', seller: FIXSEL, at: '2026-09-03T11:52:40Z',
  kind: 'compute.generation', lane: 'paid_claude (not yet open)', causedBy: 'FIXTURE generator — cites a rate set the public record does not carry',
  lines: [['prefill_token', 9000, '0.000004', 'rateset-open-0', OBS_FIX], ['decode_token', 700, '0.000018', 'rateset-open-0', OBS_FIX]], tithePct: 10, prior: R.r5.receipt_id,
  opNote: 'FIXTURE — INCONCLUSIVE by construction: the rate set is not published, so no honest auditor can price it' });

/* r7 — over-capture FIXTURE: the decode line is inflated after the honest
   computation (the seller signed a bigger bill than the quantities say) */
R.r7 = await mk({ adapter: 'rehearsal/paid-lane', spender: 'rehearsal spender (FIXTURE)', seller: FIXSEL, at: '2026-09-03T11:58:55Z',
  kind: 'compute.generation', lane: 'rehearsal_paid_fixture', causedBy: 'FIXTURE generator — over-capture on the decode line', lines: fix(2048, 256), tithePct: 10, prior: R.r6.receipt_id,
  opNote: 'FIXTURE — over-captured: the auditor must catch quantity × rate ≠ charged' });
{
  const infl = SA.toS(R.r7.line_items[1].charged.value) * 5n;
  R.r7.line_items[1].charged.value = SA.fromS(infl);
  const sum = R.r7.line_items.reduce((a, l) => a + SA.toS(l.charged.value), 0n);
  R.r7.total_computed.value = SA.fromS(sum);
  R.r7.receipt_id = await SA.receiptId(R.r7);   // honestly signed over-capture: id matches its own bytes
}

/* r8 — tampered-after-signing FIXTURE: r3's id over altered content */
R.r8 = JSON.parse(JSON.stringify(R.r3));
R.r8.occurred_at = '2026-09-03T12:04:31Z';
R.r8.provenance.prior_receipt_id = R.r7.receipt_id;
R.r8.operation.note = 'FIXTURE — tampered after signing: content hash must fail';
R.r8.receipt_id = R.r3.receipt_id;              // the stale id is the point

/* r9 — backdated FIXTURE: cites a prior but occurs BEFORE it */
R.r9 = await mk({ adapter: 'rehearsal/paid-lane', spender: 'rehearsal spender (FIXTURE)', seller: FIXSEL, at: '2026-09-03T09:30:00Z',
  kind: 'compute.generation', lane: 'rehearsal_paid_fixture', causedBy: 'FIXTURE generator — occurred_at runs backwards against its prior', lines: fix(512, 64), tithePct: 10, prior: R.r4.receipt_id,
  opNote: 'FIXTURE — forward_only must fail: bTiMeLine runs one way' });

/* scan-law markers, AFTER the ids are computed: receipt ids are 64-hex PUBLIC
   constants (content hashes of a public record). the hex-law hook requires a
   same-line PUBLIC-CONSTANT marker; each marker key is written onto the hex
   line itself (receipt_id lines by direct append; prior/anchor ids by joining
   the adjacent marker line). the auditor strips every _hexlaw key before
   hashing, so the ids are stable whether or not the markers ride along. */
const HEXLAW = 'PUBLIC-CONSTANT — content-addressed receipt ids are public by construction';
for (const r of [R.r1, R.r2, R.r3, R.r4, R.r5, R.r6, R.r7, R.r8, R.r9])
  if (r.provenance && r.provenance.prior_receipt_id) r.provenance._hexlaw = HEXLAW;

const ledger = {
  _note: [
    'THE PUBLIC SPEND-RECEIPT RECORD — rehearsal copy. The live meter (scripts/buzz-meter/meter.py, SPEC-SPEND-RECEIPT-1) writes real receipts on the box; none are public yet, so this in-tree copy gives the auditor true-shaped rows. Free-tier rates are real law (rateset-v2); rateset-fixture-a prices NOTHING — an A-rate for the closed paid lane would be a tokenomics constant, and those are fence-held. Rows labelled FIXTURE are deliberately broken so the four verifier states are all present; the auditor catches each one.',
    'VISIBILITY LAW (SPEC §3a): only visibility:"public" rows live in a public store — a private receipt written here would be published. The spender\'s private rows stay in the spender\'s store. Totals are computed at every read, never stored (the stored total_computed is itself re-derived and checked). CARE: this is topology and vocabulary, NEVER a security claim.'
  ],
  ledger: 'spend-receipts-public-1',
  as_of: '2026-09-03T12:00:00Z',
  rate_sets: {
    'rateset-v2': {
      version: 'rateset-v2', minted_at: OBS_V2, unit: 'A',
      tithe: { percent: 10, law: 'FOUNDER LAW (Lane M rider, 2026-08-29): the Claude-agents API lane prices at PROVIDER COST BASIS + 10% TITHE in A — a distinct visible TITHE line on every receipt, never buried in the rate. The tithe percentage changes by founder word ALONE; rate_set versions track cost basis only.' },
      tiers: {
        free_qwen: { tier: 'FREE (founder tier-ladder ruling, 2026-08-29): the box/qwen compute lane — guest keys, no charge, capped fairly', rates: { prefill_token: { value: 0 }, decode_token: { value: 0 } } },
        paid_claude: { tier: 'PAID (founder tier-ladder ruling): A-metered at provider cost basis + the 10% tithe', status: 'CLOSED_UNTIL_FUNDED — basis disclosed as reference; no rates are published here', cost_basis: { model_class: 'sonnet-class', prefill_token_per_million_usd: 3, decode_token_per_million_usd: 15, a_conversion_reference: null, basis: 'POSTED-REFERENCE — not a billed rate until the lane opens' } }
      }
    },
    'rateset-fixture-a': {
      version: 'rateset-fixture-a', minted_at: OBS_FIX, unit: 'A',
      note: 'FIXTURE RATES — not a rate ruling. The paid lane is CLOSED_UNTIL_FUNDed and its A-conversion is unruled (fence-held); these arbitrary round numbers exist only so the auditor has nonzero arithmetic to check.',
      tithe: { percent: 10, law: 'same founder law — the tithe line is audited like any other' },
      tiers: { rehearsal_paid_fixture: { tier: 'FIXTURE lane — prices nothing', rates: { prefill_token: { value: '0.000003' }, decode_token: { value: '0.000015' } } } }
    }
  },
  anchors: [
    { anchor_id: 'rehearsal-anchor-1', anchored_at: '2026-09-03T10:30:00Z',
      where: 'rehearsal:in-tree — the box\'s anchor service writes Arweave mainnet anchors once the rehearsal graduates',
      law: 'two-tier anchoring: cheap checkpoints frequent, one anchor committing to the checkpoint head; refunds never wait for an anchor',
      covers: [R.r1.receipt_id, R.r2.receipt_id, R.r3.receipt_id, R.r4.receipt_id],
      _hexlaw: HEXLAW }
  ],
  services: [
    { name: 'buzz-compute (free tier)', heartbeats: ['2026-09-03T11:44:10Z', '2026-09-03T11:59:41Z', '2026-09-03T11:59:52Z'], note: 'liveness derives from timestamps only — never a self-declared flag' },
    { name: 'rehearsal seller A (FIXTURE rates)', heartbeats: ['2026-09-03T09:00:00Z', '2026-09-03T11:50:00Z'], note: 'same rule; the record is a snapshot, so states are read as of as_of' },
    { name: 'rehearsal seller B (retired)', heartbeats: ['2026-08-28T08:00:00Z'], note: 'same rule — no beat for days reads offline, whatever it claims' }
  ],
  receipts: [R.r1, R.r2, R.r3, R.r4, R.r5, R.r6, R.r7, R.r8, R.r9]
};

/* write with the same-line markers: receipt_id lines get the marker appended
   directly; covers arrays collapse to one line and every remaining _hexlaw
   line joins onto the hex line above it */
let txt = JSON.stringify(ledger, null, 1) + '\n';
txt = txt.replace(/^([ ]*"receipt_id": "sha256:[0-9a-f]{64}",)$/gm, '$1 "_hexlaw": "' + HEXLAW + '",');
txt = txt.replace(/"covers": \[\n(?:[ ]*"sha256:[0-9a-f]{64}",?\n)+[ ]*\]/g, m => m.replace(/\n[ ]+/g, ' '));
txt = txt.replace(/\n[ ]*"_hexlaw": ("PUBLIC-CONSTANT[^"]*")/g, ' "_hexlaw": $1');
writeFileSync(new URL('./spend-ledger.json', import.meta.url), txt);

/* ── self-check: audit THE FILE AS WRITTEN (re-parsed), not memory — proves
   the markers did not disturb one canonical byte ────────────────────────── */
const fileLedger = JSON.parse(readFileSync(new URL('./spend-ledger.json', import.meta.url), 'utf8'));
const res = await SA.auditLedger(fileLedger);
const want = ['PASSED', 'PASSED', 'PASSED', 'PASSED', 'PENDING_ANCHOR', 'INCONCLUSIVE', 'FAILED', 'FAILED', 'FAILED'];
let bad = 0;
res.receipts.forEach((a, i) => {
  const ok = a.state === want[i];
  if (!ok) bad++;
  console.log((ok ? 'PASS' : 'FAIL') + ' r' + (i + 1) + ' — ' + a.state + (ok ? '' : ' (wanted ' + want[i] + ')') + ' · ' + a.owedA +
    (a.state === 'FAILED' ? ' · failed checks: ' + a.checks.filter(c => !c.ok).map(c => c.name).join(', ') : ''));
});
const byState = { PASSED: 0, PENDING_ANCHOR: 0, FAILED: 0, INCONCLUSIVE: 0 };
res.receipts.forEach(a => byState[a.state]++);
console.log('ledger written · states ' + JSON.stringify(byState) + ' · sellers ' + JSON.stringify(res.sellers));
process.exit(bad ? 1 : 0);
