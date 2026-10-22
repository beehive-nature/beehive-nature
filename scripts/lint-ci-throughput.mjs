// Guard the repository's deliberately small, canonical CI policy blocks.
// This is a policy check, not a general YAML parser. Unsupported event or
// concurrency syntax fails closed and needs an explicit policy update.
import { readFileSync } from 'node:fs';

export const qualificationWorkflows = [
  'btungsten-pq.yml', 'btungsten-pq-saw.yml', 'wb001-saw.yml',
  'wb002-saw.yml', 'wb002-wasm.yml', 'bnrose-rust-001.yml',
  'bnrose-adapters-real.yml',
];
export const auditWorkflows = ['tests.yml', 'secret-scan.yml'];
export const cacheWorkspaces = {
  'tests.yml': ['.', 'rust/bsafe-host', 'ops/x402-door', 'ops/ant-writedoor'],
  'btungsten-pq.yml': ['crates/btungsten-x0x-pq', 'crates/btungsten-p3count'],
};

export function readWorkflows() {
  return Object.fromEntries([...qualificationWorkflows, ...auditWorkflows].map(name =>
    [name, readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')],
  ));
}

function block(text, key) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const starts = lines.flatMap((line, index) => line.startsWith(`${key}:`) ? [index] : []);
  if (starts.length !== 1) return null;
  const result = [];
  for (let i = starts[0]; i < lines.length; i++) {
    const line = lines[i].replace(/\s+#.*$/, '').trimEnd();
    if (!line || line.startsWith('#')) continue;
    if (i > starts[0] && /^\S/.test(line)) break;
    result.push(line);
  }
  return result.join('\n');
}

const qualificationEvents = 'on:\n  push:\n    branches: [main]\n  pull_request:\n  workflow_dispatch:';
const auditEvents = 'on:\n  push:\n  pull_request:';
const qualificationConcurrency = [
  'concurrency:',
  "  group: ${{ github.workflow }}-${{ github.event_name }}-${{ (github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch') && github.run_id || github.ref }}",
  '  cancel-in-progress: true',
].join('\n');

export function auditThroughput(workflows) {
  const failures = [];
  for (const name of qualificationWorkflows) {
    const text = workflows[name] ?? '';
    if (block(text, 'on') !== qualificationEvents) {
      failures.push(`${name}: require PR qualification, main verification and manual dispatch; no duplicate feature-push run`);
    }
    if (block(text, 'concurrency') !== qualificationConcurrency) {
      failures.push(`${name}: only superseded PR runs may share a cancellation group; main/manual runs must retain run_id`);
    }
  }
  for (const name of auditWorkflows) {
    const text = workflows[name] ?? '';
    if (block(text, 'on') !== auditEvents || /^concurrency:/m.test(text)) {
      failures.push(`${name}: retain unrestricted push and PR audits without workflow cancellation`);
    }
  }
  for (const [name, expected] of Object.entries(cacheWorkspaces)) {
    const text = workflows[name] ?? '';
    const mappings = [...text.matchAll(/^\s+(?:workspaces:\s+)?([^\s#]+)\s+->\s+([^\s#]+)\s*$/gm)]
      .map(([, workspace, target]) => [workspace, target]);
    if (mappings.length !== expected.length || expected.some(root =>
      mappings.filter(([workspace, target]) => workspace === root && target === 'target').length !== 1)) {
      failures.push(`${name}: each declared workspace must map exactly once to its relative target directory`);
    }
  }
  return failures;
}
