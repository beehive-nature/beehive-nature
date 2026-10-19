// Same existing INVOICE-1/RECON-1 primitives, with terminal local-chain evidence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {buildGenericInvoice} from '../../../scripts/lib/bpay-invoice-generic.mjs';
import {reconcileObligation} from '../../../scripts/lib/recon-reconcile.mjs';
const root = process.argv[2];
const read = name => JSON.parse(fs.readFileSync(path.join(root,name)));
const owner = read('owner-bundle.json'), received = read('delivery/received-bundle.json');
assert.deepEqual(received,owner);
const job = owner.packet.job;
const commitment = [...crypto.createHash('sha256').update('bnr-solana-tungsten/job/v1\0').update(JSON.stringify(job)).digest()];
const solana = read('solana/solana-receipt.json'), vaulta = read('vaulta/vaulta-receipt.json');
const transport = read('delivery/receipt.json');
assert.equal(transport.completed,true);
assert.equal(transport.bnr_inbox_restart_replay_refused,true);
assert.equal(transport.bnr_inbox_payload_conflict_refused,true);
assert.equal(transport.bnr_inbox_queued_jobs,111);
assert.equal(solana.finality,'finalized'); assert.equal(vaulta.finality,'irreversible');
assert.equal(solana.amount,job.amount); assert.equal(vaulta.amount,job.amount);
const invoice = buildGenericInvoice({jobId:job.job_id,issuedAt:'2026-10-03T00:00:00Z',
  lines:[{asset:job.asset,quotes:[{quote_hash:'tungsten-work',amount_atto:'7'}]},
         {asset:job.fee_asset,quotes:[{quote_hash:'tungsten-fee',amount_atto:'1'}]}],
  authorization:{ceilings:{[job.asset]:'7',[job.fee_asset]:'1'},authorizedBy:'LOCAL FIXTURE ONLY',stopConditions:[]},
  domain:{experiment:'tungsten-private-chain',realValue:false}});
const core = {job,job_commitment:commitment,output:49,authorization:'trusted-local-fixture',
  settlement_amount:7,settlement_asset:'TEST-UNIT',counterfactual_ledgers:true};
const observations = [
  {core,proof_adapter:'solana-groth16-sbf',settlement_adapter:'solana-local-signed-outbox',evidence:solana},
  {core:structuredClone(core),proof_adapter:'vaulta-plonk-square-wasm',settlement_adapter:'spring-fixture-escrow',evidence:vaulta},
];
assert.deepEqual(observations[0].core,observations[1].core);
for (const observation of observations) {
  const record = {kind:'observation',asset:job.asset,amount:'7',value_observed:'event-log+readback',
    finality:'terminal',retryability:'never',txRef:observation.evidence.signature??observation.evidence.transaction_id,
    invoiceContentDigest:invoice.identity.contentDigest};
  const recon = reconcileObligation(invoice,[record,record]);
  // Principal paid; the distinct fixture fee was never paid. Real network costs
  // are provider expenses and must not silently satisfy this invoice line.
  assert.equal(recon.conclusion,'PARTIALLY-SATISFIED');
  assert.equal(recon.basis.duplicates,1);
  assert.equal(recon.basis.observed[job.asset],'7');
  assert.equal(recon.basis.observed[job.fee_asset],'0');
  observation.reconciliation = recon;
}
const report = {schema:'bnr.tungsten-acceptance/2',scope:'private local chains and loopback delivery',
  semantic_core_equal:true,rail_evidence_intentionally_distinct:true,
  production_ready:false,universal_standard_certified:false,real_funds_moved:false,
  transport,observations};
fs.writeFileSync(path.join(root,'acceptance.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({acceptance:path.join(root,'acceptance.json'),semantic_core_equal:true,
  reconciliation:observations.map(x=>x.reconciliation.conclusion)}));
