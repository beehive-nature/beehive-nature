import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptUpdate, bytesDigest, canonicalDocument, commitment, parseDocument, signingBytes } from './contract.mjs';
import { validateManifest } from './manifest.mjs';
import { githubStatement } from './github.mjs';
import { fixture, envelope, keys, reseal, sourceGraph } from './fixtures.mjs';

const refuse = (f, code) => { const r = acceptUpdate(f); assert.equal(r.accepted, false, JSON.stringify(r)); if (code) assert.equal(r.code, code, JSON.stringify(r)); };
test('valid signed source update yields a deterministic shadow transition without mutation', () => {
  const f = fixture(), before = structuredClone(f), a = acceptUpdate(f), b = acceptUpdate(f);
  assert.equal(a.accepted, true, JSON.stringify(a)); assert.deepEqual(a, b); assert.equal(a.mode, 'shadow');
  assert.equal(a.next_state.head, f.manifest.source.commit); assert.equal(a.next_state.sequence, 1);
  assert.equal(commitment('state', a.next_state), a.next_state_digest); assert.deepEqual(structuredClone(f), before);
});
test('replay and a competing proposal lose once the accepted checkpoint advances', () => {
  const f = fixture(), accepted = acceptUpdate(f); f.state = accepted.next_state; f.trustedStateDigest = accepted.next_state_digest;
  refuse(f, 'STALE_STATE');
  const other = fixture(), graph = sourceGraph(other.state.head, 'competing change'); other.manifest.source = graph.source; other.payloads = graph.payloads; reseal(other);
  other.state = accepted.next_state; other.trustedStateDigest = accepted.next_state_digest; refuse(other, 'STALE_STATE');
});
const mutations = [
  ['untrusted checkpoint', f => { f.trustedStateDigest = bytesDigest(Buffer.from('attacker')); }, 'UNTRUSTED_STATE'],
  ['self supplied weaker policy', f => { f.policy.update_threshold = 0; }, 'SHAPE'],
  ['changed policy anchor', f => { f.policy.max_bytes++; }, 'POLICY'],
  ['wrong repository', f => { f.proposal.repository = 'other'; }, 'REPOSITORY'],
  ['wrong ref', f => { f.proposal.ref = 'refs/heads/other'; }, 'REPOSITORY'],
  ['stale sequence', f => { f.proposal.sequence = 0; }, 'STALE_STATE'],
  ['replayed prior checkpoint', f => { f.proposal.previous_state = bytesDigest(Buffer.from('old')); }, 'STALE_STATE'],
  ['proposal swaps policy', f => { f.proposal.policy_digest = bytesDigest(Buffer.from('other')); }, 'POLICY'],
  ['wrong manifest', f => { f.proposal.manifest_digest = bytesDigest(Buffer.from('other')); }, 'MANIFEST'],
  ['unknown version', f => { f.manifest.schema = 'bnr.repository-manifest/2'; }, 'VERSION'],
  ['unknown fields', f => { f.proposal.ignore_failures = true; }, 'SHAPE'],
  ['missing owner signature', f => { f.signatures = []; }, 'SHAPE'],
  ['executor cannot approve updates', f => { f.signatures = [envelope(signingBytes('proposal', f.proposal), 1)]; }, 'UNAUTHORIZED'],
  ['duplicate signer votes', f => { f.signatures.push(f.signatures[0]); }, 'DUPLICATE'],
  ['unknown signature algorithm', f => { f.signatures[0].alg = 'future'; }, 'SIGNATURE'],
  ['unknown digest algorithm', f => { f.signatures[0].content.digest.alg = 'future'; }, 'SIGNATURE'],
  ['altered signature', f => { f.signatures[0].signature.b64u = 'A'.repeat(4412); }, 'SIGNATURE'],
  ['wrong domain', f => { f.signatures = [envelope(signingBytes('evidence', f.proposal))]; }, 'SIGNATURE'],
  ['unsigned CI cannot qualify', f => { f.evidence[0].envelope = {}; }, 'UNAUTHORIZED'],
  ['wrong recipe', f => { f.evidence[0].statement.recipe_digest = bytesDigest(Buffer.from('other')); }, 'EVIDENCE_BINDING'],
  ['evidence from another update', f => { f.evidence[0].statement.proposal_digest = bytesDigest(Buffer.from('old')); }, 'EVIDENCE_BINDING'],
  ['skipped suite', f => { f.evidence[0].statement.result = 'skipped'; }, 'NOT_SUCCESS'],
  ['cancelled suite', f => { f.evidence[0].statement.result = 'cancelled'; }, 'NOT_SUCCESS'],
  ['failed suite', f => { f.evidence[0].statement.result = 'failure'; }, 'NOT_SUCCESS'],
  ['missing suite', f => { f.evidence = []; }, 'SHAPE'],
  ['duplicate executor vote', f => { f.evidence.push(f.evidence[0]); }, 'DUPLICATE'],
  ['unknown suite', f => { f.evidence[0].statement.suite = 'unrequired'; }, 'UNKNOWN_SUITE'],
  ['missing observation', f => { f.payloads.delete(f.evidence[0].statement.observation_digest); }, 'OBSERVATION'],
  ['tampered observation', f => { f.payloads.set(f.evidence[0].statement.observation_digest, Buffer.from('fake')); }, 'OBSERVATION'],
  ['missing source object', f => { f.payloads.delete(f.manifest.source.objects[0].digest); }, 'MISSING_OBJECT'],
  ['tampered source object', f => { f.payloads.set(f.manifest.source.objects[0].digest, Buffer.from('fake')); }, 'OBJECT_DIGEST'],
  ['wrong Git oid', f => { f.manifest.source.objects[0].oid = '3'.repeat(40); }, 'GIT_OID'],
  ['wrong tree claim', f => { f.manifest.source.tree = '3'.repeat(40); }, 'GIT_BINDING'],
  ['false history boundary', f => { f.manifest.source.parents = ['3'.repeat(40)]; }, 'GIT_BINDING'],
  ['incomplete declared graph', f => { f.manifest.source.objects = f.manifest.source.objects.filter(o => o.kind !== 'blob'); }, 'GIT_CLOSURE'],
  ['duplicate Git object', f => { f.manifest.source.objects.push(f.manifest.source.objects[0]); }, 'DUPLICATE'],
  ['network not bounded', f => { f.manifest.recipes[0].network = 'any'; }, 'NETWORK_POLICY'],
  ['undeclared input', f => { f.manifest.recipes[0].input_files = ['missing']; }, 'RECIPE_FILE'],
  ['oversized carried bytes', f => { f.policy.max_bytes = 1; reseal(f); }, 'RESOURCE_LIMIT'],
];
for (const [name, mutate, code] of mutations) test(`refuse ${name}`, () => { const f = fixture(); mutate(f); refuse(f, code); });

test('a freshly signed change cannot silently replace the pinned execution recipe', () => {
  const f = fixture(); f.manifest.recipes[0].argv = ['true']; reseal(f); refuse(f, 'RECIPE');
});
test('signatures by fewer than the declared independent keys cannot meet a quorum', () => {
  const f = fixture(); f.policy.suites[0].executor_keys.push(keys[2].id); f.policy.suites[0].threshold = 2; reseal(f); refuse(f, 'MISSING_SUITE');
  const statement = f.evidence[0].statement; f.evidence.push({ statement, envelope: envelope(signingBytes('evidence', statement), 2) }); assert.equal(acceptUpdate(f).accepted, true);
});
test('an update must directly include the trusted current head as a parent', () => {
  const f = fixture(), graph = sourceGraph('3'.repeat(40)); f.manifest.source = graph.source; f.payloads = graph.payloads; reseal(f); refuse(f, 'PARENT');
});
test('LFS pointer and submodule are refused instead of claiming missing external content', () => {
  for (const graph of [sourceGraph(undefined, 'version https://git-lfs.github.com/spec/v1\noid sha256:unresolved\n'), sourceGraph(undefined, 'x', '160000')]) {
    const f = fixture(); f.manifest.source = graph.source; f.payloads = graph.payloads; reseal(f); refuse(f, 'EXTERNAL_OBJECT');
  }
});
test('input and output artifacts are carried and byte verified', () => {
  const f = fixture(); const bytes = Buffer.from('result'); const digest = bytesDigest(bytes);
  f.payloads.set(digest, bytes); f.manifest.files.push({ name: 'result.txt', role: 'output', bytes: bytes.length, digest }); f.manifest.recipes[0].output_files.push('result.txt');
  f.policy.suites[0].recipe_digest = commitment('recipe', f.manifest.recipes[0]); reseal(f); assert.equal(acceptUpdate(f).accepted, true);
  f.payloads.set(digest, Buffer.from('forged')); refuse(f, 'OBJECT_DIGEST');
});
test('canonical transport refuses duplicate fields, lossy values and unknown object keys', () => {
  const doc = { a: 1, b: ['z', 'a'] }; assert.deepEqual(parseDocument(canonicalDocument(doc)), doc);
  for (const raw of ['{"a":1,"a":2}\n', '{"a":1.0}\n', '{"a":1}', '{"__proto__":{}}\n']) assert.throws(() => parseDocument(Buffer.from(raw)));
  for (const value of [{ a: NaN }, { a: -0 }, { a: undefined }, { a: '\ud800' }, { quotes: [] }]) assert.throws(() => canonicalDocument(value));
  assert.equal(commitment('recipe', { b: 2, a: 1 }), commitment('recipe', { a: 1, b: 2 }));
});

function observationFixture() {
  const f = fixture(), job = { name: 'static', status: 'completed', conclusion: 'success', execution_started: true, checkout: { commit: f.manifest.source.commit, tree: f.manifest.source.tree }, 'log_sha256_PUBLIC-CONSTANT': 'a'.repeat(64) };
  const receipt = { format: 'bnr.ci-observation.v1', provider: 'github', repository: 'owner/repo', head: f.manifest.source.commit, runs: [{ id: 1, name: 'tests', event: 'push', head: f.manifest.source.commit, attempt: 1, status: 'completed', conclusion: 'success', jobs: [job] }] };
  return { f, args: { receipt, selector: { repository: 'owner/repo', head: receipt.head, event: 'push', workflow: 'tests', jobs: ['static'] }, proposal: f.proposal, manifest: f.manifest, suite: f.policy.suites[0] } };
}
test('existing GitHub observation format yields an explicitly unsigned statement', () => {
  const { f, args } = observationFixture(), result = githubStatement(args);
  assert.equal(result.unsigned_statement.observation_digest, bytesDigest(result.observation));
  f.payloads.set(bytesDigest(result.observation), result.observation); f.evidence = [{ statement: result.unsigned_statement, envelope: {} }]; refuse(f, 'UNAUTHORIZED');
  f.evidence[0].envelope = envelope(signingBytes('evidence', result.unsigned_statement), 1); assert.equal(acceptUpdate(f).accepted, true);
});
for (const [name, mutate] of [
  ['wrong checkout', a => { a.receipt.runs[0].jobs[0].checkout.commit = '4'.repeat(40); }],
  ['wrong tree', a => { a.receipt.runs[0].jobs[0].checkout.tree = '4'.repeat(40); }],
  ['missing job', a => { a.receipt.runs[0].jobs = []; }],
  ['queued run', a => { a.receipt.runs[0].status = 'queued'; }],
  ['skipped job', a => { a.receipt.runs[0].jobs[0].conclusion = 'skipped'; }],
  ['duplicate attempts', a => { a.receipt.runs.push(a.receipt.runs[0]); }],
]) test(`GitHub adapter refuses ${name}`, () => assert.throws(() => { const { args } = observationFixture(); mutate(args); githubStatement(args); }));

test('valid snapshot can be validated without authority or GitHub APIs', () => {
  const f = fixture(); assert.equal(validateManifest(f.manifest, f.payloads, f.policy.max_bytes), true);
});
