// Adapter for scripts/ci-run-receipt.mjs observations. This produces an
// UNSIGNED statement for an explicitly trusted executor to inspect and sign.
// A GitHub green badge or a recomputed hash alone never authorizes an update.
import { bytesDigest, canonicalDocument, commitment, need, unique, record, list } from './contract.mjs';
export function githubStatement({ receipt, selector, proposal, manifest, suite }) {
  record(selector, ['repository', 'head', 'event', 'workflow', 'jobs']); list(selector.jobs, 1); unique(selector.jobs);
  need(receipt?.format === 'bnr.ci-observation.v1' && receipt.provider === 'github', 'PROVIDER');
  need(receipt.repository === selector.repository && receipt.head === selector.head, 'SOURCE');
  need(proposal.manifest_digest === commitment('manifest', manifest), 'MANIFEST');
  const runs = receipt.runs.filter(r => r.name === selector.workflow && r.event === selector.event);
  need(runs.length === 1, 'RUN_COVERAGE');
  const run = runs[0]; need(run.head === selector.head && run.status === 'completed' && run.conclusion === 'success' && Number.isSafeInteger(run.attempt) && run.attempt >= 1, 'NOT_SUCCESS');
  unique(run.jobs.map(j => j.name));
  for (const name of selector.jobs) {
    const job = run.jobs.find(j => j.name === name);
    need(job?.status === 'completed' && job.conclusion === 'success' && job.execution_started === true, 'JOB_COVERAGE');
    need(job.checkout?.commit === manifest.source.commit && job.checkout?.tree === manifest.source.tree && /^[a-f0-9]{64}$/.test(job['log_sha256_PUBLIC-CONSTANT']), 'EVIDENCE_BINDING');
  }
  const observation = canonicalDocument({ selector, receipt });
  return { unsigned_statement: { schema: 'bnr.repository-qualification/1', proposal_digest: commitment('proposal', proposal), suite: suite.id,
    recipe_digest: suite.recipe_digest, result: 'success', observation_digest: bytesDigest(observation) }, observation };
}
