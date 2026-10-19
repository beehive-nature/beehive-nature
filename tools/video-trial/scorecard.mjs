import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Descriptive arithmetic only: no significance, causal, or release verdict.
export function compare(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Nonempty rows required');
  const seen = new Set();
  return rows.map(row => {
    const key = `${row.scenario}/${row.metric}`;
    if (!row.scenario || !row.metric || seen.has(key)) throw new Error('Missing or duplicate metric');
    seen.add(key);
    for (const arm of ['baselineSeconds', 'trialSeconds']) {
      if (row[arm] !== null && (!Number.isFinite(row[arm]) || row[arm] < 0)) {
        throw new Error(`${key}: ${arm} must be nonnegative seconds or null`);
      }
    }
    const { baselineSeconds: b, trialSeconds: t } = row;
    const deltaSeconds = b === null || t === null ? null : t - b;
    return { ...row, deltaSeconds,
      changePercent: deltaSeconds === null || b === 0 ? null : 100 * deltaSeconds / b,
      direction: deltaSeconds === null ? 'unknown' : deltaSeconds === 0 ? 'unchanged' : deltaSeconds < 0 ? 'less time' : 'more time' };
  });
}

export function report(input) {
  if (input.evidence !== 'reported-transcription' || !input.source || !input.baseline || !input.trial) {
    throw new Error('Source, named arms and reported-transcription evidence label required');
  }
  return { evidence: input.evidence, source: input.source, baseline: input.baseline, trial: input.trial,
    limitation: 'Supplied summary only; raw screenshots, repetitions, build pins and uncertainty unavailable. No rollout verdict.',
    rows: compare(input.rows) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(report(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
