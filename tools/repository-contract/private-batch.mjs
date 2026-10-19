// Private, PQ-authorized acceptance plus a bound hiding receipt-chain proof.
// Public relation verification never substitutes for acceptUpdate authority.
import { randomBytes } from 'node:crypto';
import { acceptUpdate, bytesDigest, canonicalDocument, commitment, parseDocument, need, record, hash, integer, list, validateState } from './contract.mjs';
import { MAX_DOCUMENT, packet, payloadEntries, checkBytes, publishBundle, publishPrivateBytes, pointer, retrieve, retrieveBundle } from './storage.mjs';
import { requirePrivacy } from './privacy.mjs';
import { requireProofEngine, PROOF_PROFILE } from './proof-engine.mjs';

const plans = new WeakMap(), verified = new WeakMap();
const ZERO = 'sha256:' + '0'.repeat(64);
export const EMPTY_LOG_ROOT = bytesDigest(Buffer.alloc(0));
export const DEFAULT_BATCH_MAX_BYTES = 64 * 1024 * 1024;
const equal = (a, b) => canonicalDocument(a).equals(canonicalDocument(b));
const copy = v => parseDocument(canonicalDocument(v));
const salt = () => 'sha256:' + randomBytes(32).toString('hex');
export function validateLogHead(h) { record(h, ['size', 'root']); integer(h.size); hash(h.root); if (h.size === 0) need(h.root === EMPTY_LOG_ROOT, 'BATCH_CHAIN'); }
export function validateFrontier(f) {
  record(f, ['size', 'peaks']); integer(f.size); list(f.peaks, 64, 64);
  f.peaks.forEach((p, k) => { if (BigInt(f.size) & (1n << BigInt(k))) hash(p); else need(p === null, 'BATCH_CHAIN'); });
}
export function validateBatchPin(p) {
  record(p, ['stream', 'epoch', 'digest', 'head']); hash(p.stream); integer(p.epoch); validateLogHead(p.head);
  need(p.head.size === p.epoch, 'BATCH_CHAIN'); if (p.epoch === 0) need(p.digest === null, 'BATCH_CHAIN'); else hash(p.digest);
}
export function initialBatch(stream) {
  hash(stream); return { pin: { stream, epoch: 0, digest: null, head: { size: 0, root: EMPTY_LOG_ROOT } }, frontier: { size: 0, peaks: Array(64).fill(null) } };
}
export function validateBatchBootstrap(b) {
  record(b, ['pin', 'frontier']); validateBatchPin(b.pin); validateFrontier(b.frontier); need(b.pin.head.size === b.frontier.size, 'BATCH_CHAIN');
}
const context = (stream, epoch, previous) => bytesDigest(canonicalDocument({ schema: 'bnr.repository-private-context/1', stream, epoch, previous }));
export function validateProof(p) {
  record(p, ['profile', 'bucket', 'context', 'root', 'chunks']); need(p.profile === PROOF_PROFILE, 'PROOF_PROFILE');
  need([8, 16, 32, 64].includes(p.bucket), 'RESOURCE_LIMIT'); hash(p.context); list(p.root, 8, 8);
  p.root.forEach(n => { integer(n); need(n < 2_130_706_433, 'PROOF_FIELD'); });
  list(p.chunks, 1, 128); p.chunks.forEach((s, i) => need(typeof s === 'string' && s.length > 0 && s.length <= 65536 && s.length % 2 === 0 && /^[0-9a-f]+$/.test(s) && (i === p.chunks.length - 1 || s.length === 65536), 'PROOF_ENCODING'));
}
function validateHeader(h, proof) {
  record(h, ['schema', 'stream', 'epoch', 'previous', 'context', 'root', 'bucket']);
  need(h.schema === 'bnr.repository-private-checkpoint/1', 'VERSION'); hash(h.stream); integer(h.epoch, 1);
  if (h.epoch === 1) need(h.previous === null, 'BATCH_CHAIN'); else hash(h.previous);
  validateProof(proof); need(h.context === context(h.stream, h.epoch, h.previous) && h.context === proof.context && h.bucket === proof.bucket && equal(h.root, proof.root), 'BATCH_BINDING');
}
function validateLog(log, withFrontier) {
  record(log, withFrontier ? ['previous', 'head', 'frontier', 'inclusion', 'consistency'] : ['previous', 'head', 'inclusion', 'consistency']);
  validateLogHead(log.previous); validateLogHead(log.head); for (const k of ['inclusion', 'consistency']) { list(log[k], 0, 64); log[k].forEach(hash); }
  if (withFrontier) { validateFrontier(log.frontier); need(log.frontier.size === log.head.size, 'BATCH_CHAIN'); }
}
function bindPrevious(header, log, previous) {
  validateBatchPin(previous);
  need(header.stream === previous.stream && header.epoch === previous.epoch + 1 && header.previous === previous.digest && equal(log.previous, previous.head) && log.head.size === header.epoch, 'BATCH_CHAIN');
}
async function verifyLog(engine, header, log) {
  const result = await engine.run('log-verify', { previous: log.previous, head: log.head, leaf: canonicalDocument(header).toString('hex'), inclusion: log.inclusion, consistency: log.consistency });
  need(result.verified === true, 'PROOF_REFUSED');
}
export async function verifyOpaqueReceipt({ engine, receipt, previous }) {
  requireProofEngine(engine); record(receipt, ['header', 'proof', 'log']);
  validateHeader(receipt.header, receipt.proof); validateLog(receipt.log, false); bindPrevious(receipt.header, receipt.log, previous);
  const p = await engine.run('verify', receipt.proof); need(p.verified === true && p.profile === PROOF_PROFILE && p.security_proven_bits >= 100, 'PROOF_REFUSED');
  await verifyLog(engine, receipt.header, receipt.log);
  return { valid_relation: true, digest: bytesDigest(canonicalDocument(receipt.header)), authority: 'Opaque receipt-chain and BEELOG relation only; private full acceptance is mandatory' };
}
function snapshot(state, trustedStateDigest, updates, maxBytes, salts, bucket) {
  validateState(state); need(commitment('state', state) === trustedStateDigest, 'UNTRUSTED_STATE'); integer(maxBytes, 1);
  list(updates, 1, bucket); const captured = [], records = []; let current = copy(state), used = 0;
  const scope = bytesDigest(canonicalDocument({ repository: state.repository, ref: state.ref }));
  for (let i = 0; i < updates.length; i++) {
    const candidate = copy(packet(updates[i].candidate)); const payloads = new Map();
    for (const e of payloadEntries(candidate, updates[i].payloads)) { used += e.bytes; need(used <= maxBytes, 'RESOURCE_LIMIT'); payloads.set(e.digest, checkBytes(e, updates[i].payloads.get(e.digest))); }
    const previous_state = commitment('state', current), verdict = acceptUpdate({ ...candidate, payloads, state: current, trustedStateDigest: previous_state });
    need(verdict.accepted, 'BATCH_ACCEPTANCE', verdict.code ?? 'Acceptance refused');
    const s = salts?.[i] ?? salt(); hash(s);
    records.push({ previous_state, next_state: verdict.next_state_digest, proposal_digest: verdict.proposal_digest, policy_digest: current.policy_digest,
      manifest_digest: commitment('manifest', candidate.manifest), qualification_digest: bytesDigest(canonicalDocument(candidate.evidence)), salt: s, scope,
      previous_sequence: current.sequence, sequence: verdict.next_state.sequence, active: true });
    captured.push({ state: current, candidate, payloads }); current = verdict.next_state;
  }
  while (records.length < bucket) {
    const s = salts?.[records.length] ?? salt(); hash(s); const final = commitment('state', current);
    records.push({ previous_state: final, next_state: final, proposal_digest: ZERO, policy_digest: current.policy_digest, manifest_digest: ZERO,
      qualification_digest: ZERO, salt: s, scope, previous_sequence: current.sequence, sequence: current.sequence, active: false });
  }
  return { captured, records, state: copy(state), next: current, bytes: used };
}
export async function preparePrivateBatch({ store, state, trustedStateDigest, previous, frontier, updates, engine, bucket = 32, maxBytes = DEFAULT_BATCH_MAX_BYTES }) {
  requireProofEngine(engine); need([8, 16, 32, 64].includes(bucket), 'RESOURCE_LIMIT'); validateBatchPin(previous); validateFrontier(frontier);
  need(previous.head.size === frontier.size && Number.isSafeInteger(previous.epoch + 1), 'BATCH_CHAIN');
  previous = copy(previous); frontier = copy(frontier);
  const current = store.current(); need(current.batch && current.digest === trustedStateDigest && equal(current.batch.pin, previous), 'STALE_BATCH');
  let snapshotData = snapshot(state, trustedStateDigest, updates, maxBytes, null, bucket);
  const base = { schema: 'bnr.repository-private-checkpoint/1', stream: previous.stream, epoch: previous.epoch + 1, previous: previous.digest };
  // Stable logical operation identity excludes proof bytes/randomness. Persist
  // the winning private plan before any wallet put, including across restart.
  const operation = bytesDigest(canonicalDocument({ base, bucket, state: trustedStateDigest, inputs: snapshotData.captured.map(u => bytesDigest(canonicalDocument(u.candidate))) }));
  const restore = async bytes => {
    const stored = parseDocument(bytes); record(stored, ['state', 'previous', 'header', 'proof', 'records', 'log']);
    need(equal(stored.state, state) && equal(stored.previous, previous) && stored.proof.bucket === bucket, 'BATCH_BINDING');
    snapshotData = snapshot(state, trustedStateDigest, updates, maxBytes, stored.records.map(r => r.salt), bucket);
    need(equal(snapshotData.records, stored.records), 'BATCH_BINDING'); validateHeader(stored.header, stored.proof); validateLog(stored.log, true); bindPrevious(stored.header, stored.log, previous);
    const check = await engine.run('check', { proof: stored.proof, records: stored.records }); need(check.verified === true && check.profile === PROOF_PROFILE && check.security_proven_bits >= 100, 'PROOF_REFUSED');
    await verifyLog(engine, stored.header, stored.log);
    const plan = Object.freeze({ kind: 'bnr.repository-private-plan/1', operation, bytes: snapshotData.bytes, updates: updates.length, bucket });
    plans.set(plan, { ...snapshotData, previous, header: stored.header, proof: stored.proof, log: stored.log }); return plan;
  };
  const prior = store.privatePlan(operation); if (prior) return restore(prior);
  const proof = await engine.run('prove', { context: context(base.stream, base.epoch, base.previous), records: snapshotData.records }); validateProof(proof);
  const header = { ...base, context: proof.context, root: proof.root, bucket }; validateHeader(header, proof);
  const log = await engine.run('log-extend', { frontier, leaf: canonicalDocument(header).toString('hex') }); validateLog(log, true); bindPrevious(header, log, previous);
  const check = await engine.run('check', { proof, records: snapshotData.records }); need(check.verified === true && check.profile === PROOF_PROFILE && check.security_proven_bits >= 100, 'PROOF_REFUSED');
  const saved = store.reservePrivatePlan(operation, canonicalDocument({ state: snapshotData.state, previous, header, proof, records: snapshotData.records, log }));
  return restore(saved);
}
export async function publishPrivateBatch({ plan, store, rails, privacy }) {
  requirePrivacy(privacy); const p = plans.get(plan); need(p, 'PRIVATE_PLAN_REQUIRED');
  const current = store.current(); need(current.batch && current.digest === commitment('state', p.state) && equal(current.batch.pin, p.previous), 'STALE_BATCH');
  const bundles = [];
  for (const u of p.captured) bundles.push((await publishBundle({ store, state: u.state, trustedStateDigest: commitment('state', u.state), ...u, rails, privacy })).bundle);
  const document = { schema: 'bnr.repository-private-batch/1', state: p.state, header: p.header, proof: p.proof, records: p.records, log: p.log, bundles };
  const bytes = canonicalDocument(document); need(bytes.length <= MAX_DOCUMENT, 'RESOURCE_LIMIT');
  return { bundle: await publishPrivateBytes({ store, bytes, rails, privacy }), digest: bytesDigest(canonicalDocument(p.header)), scope: 'Private byte readback; no chain inclusion, retention or settlement claim' };
}
export async function verifyPrivateBatch({ document, updates, engine, maxBytes = DEFAULT_BATCH_MAX_BYTES }) {
  requireProofEngine(engine); document = copy(document);
  record(document, ['schema', 'state', 'header', 'proof', 'records', 'log', 'bundles']); need(document.schema === 'bnr.repository-private-batch/1', 'VERSION');
  const { state, header, proof, log } = document; validateHeader(header, proof); validateLog(log, true);
  list(document.bundles, 1, header.bucket); document.bundles.forEach(pointer); need(updates.length === document.bundles.length, 'BATCH_BINDING');
  list(document.records, header.bucket, header.bucket); const salts = document.records.map(r => { hash(r.salt); return r.salt; });
  const s = snapshot(state, commitment('state', state), updates, maxBytes, salts, header.bucket);
  need(equal(s.records, document.records), 'BATCH_BINDING');
  const previous = { stream: header.stream, epoch: header.epoch - 1, digest: header.previous, head: log.previous }; bindPrevious(header, log, previous);
  const checked = await engine.run('check', { proof, records: s.records }); need(checked.verified === true && checked.profile === PROOF_PROFILE && checked.security_proven_bits >= 100, 'PROOF_REFUSED');
  await verifyLog(engine, header, log);
  // Check the exact compact append state too, without retaining/scanning history.
  const frontierCheck = await engine.run('log-extend', { frontier: log.frontier, leaf: '00' }); need(equal(frontierCheck.previous, log.head), 'BATCH_BINDING');
  const digest = bytesDigest(canonicalDocument(header));
  const nextPin = { stream: header.stream, epoch: header.epoch, digest, head: log.head }; validateBatchPin(nextPin);
  const capability = Object.freeze({ kind: 'bnr.repository-private-verified/1', digest });
  verified.set(capability, { ...s, metadataBytes: canonicalDocument(document).length, previous, pin: nextPin, frontier: log.frontier, document, receipt: { header, proof, log: { previous: log.previous, head: log.head, inclusion: log.inclusion, consistency: log.consistency } } });
  return capability;
}
export function verifiedPrivateBatch(capability) {
  const v = verified.get(capability); need(v, 'PRIVATE_VERIFICATION_REQUIRED');
  // A consumer gets a copy; it cannot mutate another use of the capability.
  return { ...structuredClone(v), captured: v.captured.map(u => ({ state: copy(u.state), candidate: copy(u.candidate), payloads: new Map([...u.payloads].map(([k, b]) => [k, Buffer.from(b)])) })) };
}
export function privateBatchUsage(capability) {
  const v = verified.get(capability); need(v, 'PRIVATE_VERIFICATION_REQUIRED');
  return Object.freeze({ bytes: v.bytes, metadataBytes: v.metadataBytes });
}
export async function retrievePrivateBatch(bundle, options) {
  requirePrivacy(options.privacy); requireProofEngine(options.engine); integer(options.maxBytes); need(options.maxBytes > 0, 'RESOURCE_LIMIT');
  const metadataLimit = Math.min(MAX_DOCUMENT, options.maxMetadataBytes ?? MAX_DOCUMENT); integer(metadataLimit); need(metadataLimit > 0, 'RESOURCE_LIMIT');
  const cipher = await retrieve(bundle, { ...options, maxBytes: 2 * metadataLimit + 65536 });
  const bytes = await options.privacy.open(cipher); need(bytes.length <= metadataLimit, 'RESOURCE_LIMIT');
  const document = parseDocument(bytes); record(document, ['schema', 'state', 'header', 'proof', 'records', 'log', 'bundles']);
  validateHeader(document.header, document.proof); list(document.bundles, 1, document.header.bucket);
  const updates = []; let remaining = options.maxBytes;
  for (const p of document.bundles) {
    need(remaining > 0, 'RESOURCE_LIMIT');
    const u = await retrieveBundle(p, { ...options, maxBytes: remaining }); updates.push(u);
    remaining -= payloadEntries(u.candidate, u.payloads).reduce((n, e) => n + e.bytes, 0); need(remaining >= 0, 'RESOURCE_LIMIT');
  }
  return verifyPrivateBatch({ document, updates, engine: options.engine, maxBytes: options.maxBytes });
}
