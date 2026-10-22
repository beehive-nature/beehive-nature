// One run's verdict on one endpoint: opened if any attempt opened, dead if every attempt settled
// dead, otherwise unsettled. Shared by ant-reach-compare.mjs and ant-reach-cohort.mjs.
export function verdict(attempts) {
  if (attempts.some(a => a.stage === 'opened' || a.stage === 'answered')) return 'opened';
  if (attempts.length && attempts.every(a => a.stage.startsWith('no-') || a.stage.includes('-no-'))) return 'dead';
  return 'unsettled';
}
