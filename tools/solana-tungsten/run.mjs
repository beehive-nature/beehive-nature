// Real host proof + existing INVOICE-1/RECON-1. No RPC, wallet, or settlement.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { buildGenericInvoice } from '../../scripts/lib/bpay-invoice-generic.mjs';
import { reconcileObligation } from '../../scripts/lib/recon-reconcile.mjs';

const manifest = fileURLToPath(new URL('./Cargo.toml', import.meta.url));
const run = spawnSync('cargo', ['run', '--quiet', '--locked', '--manifest-path', manifest], {
  encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
});
if (run.stderr) process.stderr.write(run.stderr);
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);
const result = JSON.parse(run.stdout);
const observation = result.observations[0];
assert.equal(observation.mode, 'local-fixture-only');
assert.equal(observation.settlement_status, 'dry-run-plan-only');
assert.equal(observation.value_observed, 'none');
assert.equal(observation.transaction_reference, null);
const job = observation.job;
const invoice = buildGenericInvoice({
  jobId: job.job_id, issuedAt: '2026-10-03T00:00:00Z',
  lines: [
    { asset: job.asset, quotes: [{ quote_hash: 'local-fixture-work-quote', amount_atto: String(job.amount) }] },
    { asset: job.fee_asset, quotes: [{ quote_hash: 'local-fixture-fee-quote', amount_atto: String(job.fee) }] },
  ],
  authorization: { ceilings: { [job.asset]: '7', [job.fee_asset]: '1' },
    authorizedBy: 'LOCAL FIXTURE ONLY - no human payment authorization', stopConditions: [] },
  domain: { experiment: 'solana-tungsten', realValue: false },
});
const recon = reconcileObligation(invoice, [{
  kind: 'instruction', asset: job.asset, amount: String(job.amount),
  value_observed: 'instruction', finality: 'as-reported', retryability: 'never',
  invoiceContentDigest: invoice.identity.contentDigest,
}]);
assert.equal(recon.conclusion, 'OPEN', 'host proof + plan must not close an invoice');
result.reconciliation = { primitive: 'scripts/lib/recon-reconcile.mjs:reconcileObligation',
  conclusion: recon.conclusion, real_value_moved: false };
console.log(JSON.stringify(result, null, 2));
