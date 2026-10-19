// Read-only GitHub observations. A receipt records evidence, not an attestation
// or a claim that all required workflows were scheduled. No credentials/events
// or raw logs are copied into the receipt. Requires an authenticated gh CLI.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

const exec = promisify(execFile);
const shaPattern = /^[a-f0-9]{40}$/;

export function checkoutCommit(log) {
  const lines = log.split(/\r?\n/);
  const commits = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\[command\].*\bgit log -1 --format=%H\s*$/.test(lines[i])) {
      const next = lines[i + 1].replace(/^\S+Z /, '').trim();
      if (!shaPattern.test(next)) throw new Error('Checkout command has no full commit SHA');
      commits.push(next);
    }
  }
  if (commits.length !== 1) throw new Error(`Expected one checkout SHA, observed ${commits.length}`);
  return commits[0];
}

export function seconds(start, end) {
  const value = (Date.parse(end) - Date.parse(start)) / 1000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function summarizeRuns(runs) {
  const jobs = runs.flatMap(run => run.jobs);
  const executed = jobs.filter(job => job.status === 'completed' && job.conclusion !== 'skipped');
  return {
    workflow_executions: runs.length,
    completed_successfully: runs.filter(run => run.status === 'completed' && run.conclusion === 'success').length,
    incomplete: runs.filter(run => run.status !== 'completed').length,
    non_success: runs.filter(run => run.status === 'completed' && run.conclusion !== 'success').map(run => run.id),
    all_recorded_runs_successful: runs.length > 0 && runs.every(run => run.status === 'completed' && run.conclusion === 'success'),
    executed_jobs: executed.length,
    jobs_with_checkout_binding: executed.filter(job => job.checkout?.commit && job.checkout?.tree).length,
    completed_job_execution_seconds: executed.reduce((sum, job) => sum + (job.execution_seconds ?? 0), 0),
    timing_missing_job_ids: executed.filter(job => job.execution_seconds === null).map(job => job.id),
    // Includes dependency waiting; GitHub's jobs API does not expose runner-ready time.
    dispatch_to_job_start_seconds: jobs.map(job => ({ id: job.id, seconds: job.dispatch_to_start_seconds })),
  };
}

async function gh(args) {
  const { stdout } = await exec('gh', args, { maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  return stdout;
}
async function api(endpoint) { return JSON.parse(await gh(['api', endpoint])); }
async function pages(endpoint, key) {
  return JSON.parse(await gh(['api', '--paginate', '--slurp', endpoint])).flatMap(page => page[key]);
}

export async function collectReceipt(repo, head, runIds = []) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !shaPattern.test(head)) throw new Error('Require owner/repo and a full commit SHA');
  const prefix = `repos/${repo}`;
  const selected = runIds.length
    ? await Promise.all(runIds.map(id => {
      if (!/^\d+$/.test(id)) throw new Error('Run IDs must be numeric');
      return api(`${prefix}/actions/runs/${id}`);
    }))
    : await pages(`${prefix}/actions/runs?head_sha=${head}&per_page=100`, 'workflow_runs');
  const trees = new Map();
  const runs = [];
  for (const run of selected) {
    if (run.head_sha !== head) throw new Error(`Run ${run.id} belongs to another head`);
    const jobs = await pages(`${prefix}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`, 'jobs');
    const observed = [];
    for (const job of jobs) {
      const item = {
        id: job.id, name: job.name, status: job.status, conclusion: job.conclusion,
        started_at: job.started_at, completed_at: job.completed_at,
        dispatch_to_start_seconds: seconds(run.created_at, job.started_at),
        execution_seconds: job.status === 'completed' ? seconds(job.started_at, job.completed_at) : null,
      };
      if (job.status === 'completed' && job.conclusion !== 'skipped') {
        try {
          const log = await gh(['api', `${prefix}/actions/jobs/${job.id}/logs`]);
          const commit = checkoutCommit(log);
          if (!trees.has(commit)) {
            const object = await api(`${prefix}/git/commits/${commit}`);
            if (object.sha !== commit || !shaPattern.test(object.tree?.sha)) throw new Error('Commit/tree lookup mismatch');
            trees.set(commit, object.tree.sha);
          }
          item.checkout = { commit, tree: trees.get(commit) };
          item['log_sha256_PUBLIC-CONSTANT'] = createHash('sha256').update(log).digest('hex');
        } catch {
          // A failed fetch/parse never substitutes run.head_sha for the checkout.
          // Avoid copying command stderr, which may contain authentication data.
          item.checkout_error = 'Checkout source binding unavailable; inspect this job and retry capture';
        }
      }
      observed.push(item);
    }
    runs.push({
      id: run.id, name: run.name, event: run.event, attempt: run.run_attempt,
      head: run.head_sha, status: run.status, conclusion: run.conclusion,
      created_at: run.created_at, url: run.html_url,
      pull_requests: run.pull_requests.map(pr => ({ number: pr.number, head: pr.head.sha, base: pr.base.sha })),
      jobs: observed,
    });
  }
  return {
    format: 'bnr.ci-observation.v1', provider: 'github', repository: repo, head,
    observed_at: new Date().toISOString(), attestation: 'unsigned API and job-log observations',
    coverage_note: 'Recorded runs only; compare against the required workflow/event plan before qualification.',
    timing_note: 'Dispatch-to-start includes dependency waiting; it is not pure runner queue time.',
    summary: summarizeRuns(runs), runs,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: {
    repo: { type: 'string' }, head: { type: 'string' }, out: { type: 'string' },
    run: { type: 'string', multiple: true, default: [] },
  } });
  if (!values.out) throw new Error('Specify --repo owner/repo --head full-SHA --out receipt.json [--run id]');
  const receipt = await collectReceipt(values.repo, values.head, values.run);
  await mkdir(dirname(resolve(values.out)), { recursive: true });
  await writeFile(values.out, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt.summary, null, 2));
}
