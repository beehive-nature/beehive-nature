// Portable repository acceptance, v1. No clock, network, filesystem or signing.
// Reuse INVOICE-1 canonical bytes and SETTLE's domain-separated commitments.
import { createHash } from 'node:crypto';
import { canonicalBytes } from '../../scripts/lib/bpay-invoice-generic.mjs';
import { digest } from '../../scripts/lib/bpay-settle.mjs';
import { verifyEnvelope } from './signature.mjs';

export const DOMAIN = Object.freeze({
  state: 'bnr/repository-state/v1', policy: 'bnr/repository-policy/v1',
  manifest: 'bnr/repository-manifest/v1', proposal: 'bnr/repository-update/v1',
  evidence: 'bnr/repository-qualification/v1', recipe: 'bnr/repository-recipe/v1',
});
export function need(ok, code, detail = code) {
  if (!ok) throw Object.assign(new Error(detail), { code });
}
// Closed schemas below exclude the invoice canonicalizer's special `quotes`
// collection. Reject ambiguous JS values before canonicalization, too.
export function jsonValue(value, depth = 0) {
  need(depth < 64, 'SHAPE', 'JSON depth limit');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    need(value.length <= 1_000_000 && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value), 'SHAPE', 'Invalid Unicode');
    return;
  }
  if (typeof value === 'number') { need(Number.isSafeInteger(value) && !Object.is(value, -0), 'SHAPE'); return; }
  need(value && typeof value === 'object', 'SHAPE');
  if (Array.isArray(value)) {
    need(value.length <= 100_000 && Object.keys(value).length === value.length, 'SHAPE');
    for (const v of value) jsonValue(v, depth + 1);
  } else {
    need(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'SHAPE');
    for (const [k, v] of Object.entries(value)) {
      need(!['__proto__', 'constructor', 'prototype', 'quotes'].includes(k), 'SHAPE');
      jsonValue(k, depth + 1); jsonValue(v, depth + 1);
    }
  }
}
export function record(value, keys) {
  need(value && !Array.isArray(value) && typeof value === 'object', 'SHAPE');
  need(Object.keys(value).sort().join(',') === [...keys].sort().join(','), 'SHAPE', `Expected fields: ${keys.join(',')}`);
}
export function list(value, min = 0, max = 100_000) { need(Array.isArray(value) && value.length >= min && value.length <= max, 'SHAPE'); }
export function text(value) { need(typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/[\x00-\x1f\x7f]/.test(value), 'SHAPE'); }
export function integer(value, min = 0) { need(Number.isSafeInteger(value) && value >= min && !Object.is(value, -0), 'SHAPE'); }
export function hash(value) { need(typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value), 'SHAPE'); }
export function oid(value) { need(typeof value === 'string' && /^[0-9a-f]{40}$/.test(value) && !/^0+$/.test(value), 'SHAPE'); }
export function unique(values) { need(new Set(values).size === values.length, 'DUPLICATE'); }
export function ref(value) {
  text(value);
  need(/^refs\/heads\/[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(value) && !value.includes('..') && !value.includes('//') && !value.endsWith('/') && !value.endsWith('.') && value.split('/').every(p => !p.startsWith('.') && !p.endsWith('.lock')), 'REF');
}
export function bytesDigest(bytes) { return `sha256:${createHash('sha256').update(bytes).digest('hex')}`; }
export function commitment(kind, value) { jsonValue(value); need(Object.hasOwn(DOMAIN, kind), 'DOMAIN'); return digest(DOMAIN[kind], value); }
export function signingBytes(kind, value) {
  jsonValue(value); need(['proposal', 'evidence'].includes(kind), 'DOMAIN');
  return Buffer.concat([Buffer.from(DOMAIN[kind]), Buffer.from([0]), canonicalBytes(value)]);
}
export function canonicalDocument(value) { jsonValue(value); return Buffer.concat([canonicalBytes(value), Buffer.from('\n')]); }
export function parseDocument(bytes) {
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  // Exact canonical transport rejects duplicate keys, alternate number forms,
  // BOMs and differing Unicode escapes instead of signing a lossy parse.
  need(Buffer.from(bytes).equals(canonicalDocument(value)), 'NONCANONICAL');
  return value;
}

export function validatePolicy(p) {
  jsonValue(p); record(p, ['schema', 'repository', 'ref', 'revision', 'keys', 'update_keys', 'update_threshold', 'suites', 'max_bytes']);
  need(p.schema === 'bnr.repository-policy/1', 'VERSION'); text(p.repository); ref(p.ref); integer(p.revision, 1); integer(p.max_bytes, 1);
  list(p.keys, 1, 64); unique(p.keys.map(k => k.id));
  for (const k of p.keys) { record(k, ['id', 'alg', 'public_key']); text(k.id); need(k.alg === 'ml-dsa-65', 'ALGORITHM'); text(k.public_key); }
  const keyIds = new Set(p.keys.map(k => k.id));
  const threshold = (ids, n) => { list(ids, 1, 64); unique(ids); ids.forEach(id => need(keyIds.has(id), 'UNKNOWN_KEY')); integer(n, 1); need(n <= ids.length, 'THRESHOLD'); };
  threshold(p.update_keys, p.update_threshold);
  list(p.suites, 1, 64); unique(p.suites.map(s => s.id));
  for (const s of p.suites) { record(s, ['id', 'recipe_digest', 'executor_keys', 'threshold']); text(s.id); hash(s.recipe_digest); threshold(s.executor_keys, s.threshold); }
}
export function validateState(s) {
  jsonValue(s); record(s, ['schema', 'repository', 'ref', 'sequence', 'head', 'tree', 'policy_digest']);
  need(s.schema === 'bnr.repository-state/1', 'VERSION'); text(s.repository); ref(s.ref); integer(s.sequence); oid(s.head); oid(s.tree); hash(s.policy_digest);
}

// Payload map is digest -> exact bytes. This validates contents as well as
// metadata; the manifest validator checks the entire declared Git graph.
export function checkPayload(entry, payloads, budget) {
  integer(entry.bytes); hash(entry.digest);
  const bytes = payloads.get(entry.digest);
  need(bytes instanceof Uint8Array, 'MISSING_OBJECT');
  need(bytes.byteLength === entry.bytes && bytesDigest(bytes) === entry.digest, 'OBJECT_DIGEST');
  budget.used += bytes.byteLength; need(budget.used <= budget.max, 'RESOURCE_LIMIT');
  return Buffer.from(bytes);
}

// validateManifest is supplied by a static import, never an injected verifier.
import { validateManifest } from './manifest.mjs';

export function acceptUpdate({ state, trustedStateDigest, policy, manifest, proposal, signatures, evidence, payloads }) {
  try {
    validateState(state); hash(trustedStateDigest);
    need(commitment('state', state) === trustedStateDigest, 'UNTRUSTED_STATE');
    validatePolicy(policy);
    need(commitment('policy', policy) === state.policy_digest, 'POLICY');
    need(policy.repository === state.repository && policy.ref === state.ref, 'REPOSITORY');
    validateManifest(manifest, payloads, policy.max_bytes);
    need(manifest.repository === state.repository && manifest.ref === state.ref, 'REPOSITORY');
    jsonValue(proposal); record(proposal, ['schema', 'repository', 'ref', 'sequence', 'previous_state', 'policy_digest', 'manifest_digest']);
    need(proposal.schema === 'bnr.repository-update/1', 'VERSION');
    need(proposal.repository === state.repository && proposal.ref === state.ref, 'REPOSITORY');
    need(Number.isSafeInteger(state.sequence + 1) && proposal.sequence === state.sequence + 1 && proposal.previous_state === trustedStateDigest, 'STALE_STATE');
    need(proposal.policy_digest === state.policy_digest, 'POLICY');
    need(proposal.manifest_digest === commitment('manifest', manifest), 'MANIFEST');
    need(manifest.source.parents.includes(state.head) && manifest.source.commit !== state.head, 'PARENT');
    const recipeMap = new Map(manifest.recipes.map(r => [r.id, r]));
    need(recipeMap.size === policy.suites.length, 'RECIPE');
    for (const suite of policy.suites) need(recipeMap.has(suite.id) && commitment('recipe', recipeMap.get(suite.id)) === suite.recipe_digest, 'RECIPE');
    const keys = new Map(policy.keys.map(k => [k.id, k]));
    const verify = (kind, value, env, allowed) => {
      need(allowed.includes(env?.key_id), 'UNAUTHORIZED');
      need(verifyEnvelope(keys.get(env.key_id), signingBytes(kind, value), env), 'SIGNATURE');
      return env.key_id;
    };
    list(signatures, 1, 64); const voters = signatures.map(env => verify('proposal', proposal, env, policy.update_keys));
    unique(voters); need(voters.length >= policy.update_threshold, 'THRESHOLD');
    list(evidence, 1, 4096);
    const votes = new Map(policy.suites.map(s => [s.id, new Set()]));
    for (const item of evidence) {
      jsonValue(item); record(item, ['statement', 'envelope']);
      const s = item.statement;
      record(s, ['schema', 'proposal_digest', 'suite', 'recipe_digest', 'result', 'observation_digest']);
      need(s.schema === 'bnr.repository-qualification/1', 'VERSION');
      const suite = policy.suites.find(r => r.id === s.suite); need(suite, 'UNKNOWN_SUITE');
      need(s.proposal_digest === commitment('proposal', proposal) && s.recipe_digest === suite.recipe_digest, 'EVIDENCE_BINDING');
      need(s.result === 'success', 'NOT_SUCCESS'); hash(s.observation_digest);
      // Raw observation bytes are carried and bound too. Their truth depends
      // on the explicitly pinned executor, not on an unkeyed digest.
      const observation = payloads.get(s.observation_digest);
      need(observation instanceof Uint8Array && bytesDigest(observation) === s.observation_digest, 'OBSERVATION');
      need(observation.byteLength <= policy.max_bytes, 'RESOURCE_LIMIT');
      const key = verify('evidence', s, item.envelope, suite.executor_keys);
      need(!votes.get(s.suite).has(key), 'DUPLICATE'); votes.get(s.suite).add(key);
    }
    for (const suite of policy.suites) need(votes.get(suite.id).size >= suite.threshold, 'MISSING_SUITE');
    const nextState = { ...state, sequence: proposal.sequence, head: manifest.source.commit, tree: manifest.source.tree };
    return { accepted: true, previous_state: trustedStateDigest, next_state: nextState, next_state_digest: commitment('state', nextState), proposal_digest: commitment('proposal', proposal), mode: 'shadow', effect: 'verdict only; authoritative storage must compare-and-swap previous_state' };
  } catch (e) { return { accepted: false, code: e.code ?? 'MALFORMED', detail: e.code ? e.message : 'Malformed contract input' }; }
}
