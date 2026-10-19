// TEST-ONLY, public deterministic fixture keys. Never a production policy.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { bytesDigest, commitment, signingBytes } from './contract.mjs';
import { gitOid } from './manifest.mjs';
createRequire(import.meta.url)('../../surfaces/onboarding/vendor/bpq-lib.js');
const dsa = globalThis.BPQ_LIB.ml_dsa65;
const sha3 = b => createHash('sha3-256').update(b).digest('base64url');
const pairs = [17, 18, 19].map(n => dsa.keygen(new Uint8Array(32).fill(n)));
export const keys = pairs.map(pair => ({ id: `bheart-${sha3(Buffer.concat([Buffer.from('ml-dsa-65'), Buffer.from(pair.publicKey)])).slice(0, 16)}`, alg: 'ml-dsa-65', public_key: Buffer.from(pair.publicKey).toString('base64url') }));
export function envelope(bytes, index = 0) {
  const signature = dsa.sign(bytes, pairs[index].secretKey);
  return { type: 'bheart.signature/1', alg: 'ml-dsa-65', key_id: keys[index].id,
    content: { bytes: bytes.length, digest: { alg: 'sha3-256', b64u: sha3(bytes), bytes: bytes.length } },
    signature: { alg: 'ml-dsa-65', b64u: Buffer.from(signature).toString('base64url'), bytes: signature.length }, signed_at_ms: 0, agility: 'TEST-ONLY' };
}
export function object(kind, bytes) {
  bytes = Buffer.from(bytes); return { entry: { oid: gitOid(kind, bytes), kind, bytes: bytes.length, digest: bytesDigest(bytes) }, bytes };
}
export function sourceGraph(parent = '1'.repeat(40), content = 'portable source\n', mode = '100644') {
  const blob = object('blob', content);
  const tree = object('tree', Buffer.concat([Buffer.from(`${mode} file.txt\0`), Buffer.from(blob.entry.oid, 'hex')]));
  const commit = object('commit', `tree ${tree.entry.oid}\nparent ${parent}\nauthor Test <test@example.invalid> 1792380000 +0000\ncommitter Test <test@example.invalid> 1792380000 +0000\n\nTest snapshot\n`);
  return { source: { object_format: 'sha1', history: 'snapshot', commit: commit.entry.oid, tree: tree.entry.oid, parents: [parent], objects: [commit.entry, tree.entry, blob.entry].sort((a, b) => a.oid.localeCompare(b.oid)) }, payloads: new Map([commit, tree, blob].map(o => [o.entry.digest, o.bytes])) };
}
export function fixture() {
  const { source, payloads } = sourceGraph();
  const recipe = { id: 'contract-tests', argv: ['node', '--test', 'test.mjs'], runtime_digest: bytesDigest(Buffer.from('TEST-ONLY runtime')), input_files: [], output_files: [], network: 'none', limits: { cpu_seconds: 60, ram_bytes: 1_000_000, net_bytes: 0 } };
  const policy = { schema: 'bnr.repository-policy/1', repository: 'urn:bnr:test-repository', ref: 'refs/heads/main', revision: 1, keys: structuredClone(keys), update_keys: [keys[0].id], update_threshold: 1, suites: [{ id: recipe.id, recipe_digest: commitment('recipe', recipe), executor_keys: [keys[1].id], threshold: 1 }], max_bytes: 1_000_000 };
  const state = { schema: 'bnr.repository-state/1', repository: policy.repository, ref: policy.ref, sequence: 0, head: source.parents[0], tree: '2'.repeat(40), policy_digest: commitment('policy', policy), last_proposal: null };
  const manifest = { schema: 'bnr.repository-manifest/1', repository: policy.repository, ref: policy.ref, source, files: [], recipes: [recipe] };
  const f = { state, policy, manifest, payloads };
  return reseal(f);
}
export function reseal(f) {
  f.state.policy_digest = commitment('policy', f.policy); f.trustedStateDigest = commitment('state', f.state);
  f.proposal = { schema: 'bnr.repository-update/1', repository: f.state.repository, ref: f.state.ref, sequence: f.state.sequence + 1, previous_state: f.trustedStateDigest, policy_digest: f.state.policy_digest, manifest_digest: commitment('manifest', f.manifest) };
  f.signatures = [envelope(signingBytes('proposal', f.proposal))];
  const observation = Buffer.from('TEST-ONLY executor observation, not a live run');
  const observation_digest = bytesDigest(observation); f.payloads.set(observation_digest, observation);
  f.evidence = f.policy.suites.map(suite => {
    const statement = { schema: 'bnr.repository-qualification/1', proposal_digest: commitment('proposal', f.proposal), suite: suite.id, recipe_digest: suite.recipe_digest, result: 'success', observation_digest };
    return { statement, envelope: envelope(signingBytes('evidence', statement), 1) };
  });
  return f;
}
