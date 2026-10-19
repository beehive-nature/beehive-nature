import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditThroughput, auditWorkflows, cacheWorkspaces,
  qualificationWorkflows, readWorkflows,
} from '../scripts/lint-ci-throughput.mjs';

const actual = readWorkflows();

test('checked-in workflows retain qualification and independent push audit coverage', () => {
  assert.deepEqual(auditThroughput(actual), []);
});

function rejected(name, from, to) {
  assert.ok(actual[name].includes(from), `mutation anchor missing in ${name}`);
  const mutated = { ...actual, [name]: actual[name].replace(from, to) };
  assert.ok(auditThroughput(mutated).some(error => error.startsWith(`${name}:`)),
    `bad policy accepted in ${name}: ${from} -> ${to}`);
}

for (const name of qualificationWorkflows) {
  test(`${name}: reject duplicate qualification and loss of PR/main/manual coverage`, () => {
    rejected(name, '    branches: [main]', '    branches: ["**"]');
    rejected(name, '    branches: [main]', '    branches: [release]');
    rejected(name, '  pull_request:', '  pull_request_target:');
    rejected(name, '  workflow_dispatch:', '  repository_dispatch:');
  });
  test(`${name}: refuse cancellation of main or manual qualification`, () => {
    rejected(name, 'github.run_id || github.ref', 'github.ref');
    rejected(name, "github.event_name == 'workflow_dispatch'", "github.event_name == 'pull_request'");
  });
}

for (const name of auditWorkflows) {
  test(`${name}: reject lost push coverage and cancellation`, () => {
    rejected(name, '  push:', '  push:\n    branches: [main]');
    rejected(name, '  pull_request:', '  pull_request:\n    paths: ["docs/**"]');
    rejected(name, 'permissions:', 'concurrency: audits\n\npermissions:');
  });
}

for (const [name, roots] of Object.entries(cacheWorkspaces)) {
  for (const root of roots) {
    test(`${name}: reject broken or missing ${root} build-cache mapping`, () => {
      rejected(name, `${root} -> target`, `${root} -> ${root === '.' ? 'wrong' : root}/target`);
      rejected(name, `${root} -> target`, `${root} -> missing`);
    });
  }
}

test('missing workflows and duplicate event blocks fail closed', () => {
  assert.ok(auditThroughput({}).length > 0);
  rejected('wb001-saw.yml', 'on:', 'on: [push]\non:');
});
