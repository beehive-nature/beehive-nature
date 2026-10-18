// Build a local working evidence set. No network, publication, payment or
// identity minting occurs here. Public projection remains in preserve.mjs.
import { createHash } from 'node:crypto';
import { openSync, closeSync, readSync, writeSync, fstatSync, readFileSync,
  writeFileSync, mkdirSync, existsSync, renameSync, rmSync, lstatSync } from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { createStore, validateStore, parties } from './source-contract.mjs';

const MAX_SHARD = 4 * 1024 * 1024;
const MAX_MANIFEST = 1024 * 1024;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const DIGEST = /^sha256:([0-9a-f]{64})$/;
const own = (o, k) => Object.hasOwn(o, k);
const map = (v) => v && typeof v === 'object' && !Array.isArray(v);
const hash = (b) => createHash('sha256').update(b).digest('hex');
const bytes = (v) => Buffer.from(JSON.stringify(v) + '\n');
const requireMap = (v, name) => { if (!map(v)) throw new Error(name + ' must be an object'); };
function localFile(path) {
  if (typeof path !== 'string' || !path || path.includes('\0') || /^(?:[/\\]{2}|[a-z][a-z0-9+.-]*:\/\/)/i.test(path))
    throw new Error('artifact file must name a local file, never a URL or network share');
  return path;
}

export function heldFileReceipt(path) {
  if (lstatSync(path).isSymbolicLink()) throw new Error('held file must not be a symlink');
  const fd = openSync(path, 'r'), digest = createHash('sha256'), chunk = Buffer.alloc(1024 * 1024);
  try {
    if (!fstatSync(fd).isFile()) throw new Error('held file must be a regular file');
    let bytes = 0, n;
    while ((n = readSync(fd, chunk, 0, chunk.length, null)) > 0) { digest.update(chunk.subarray(0, n)); bytes += n; }
    return { sha256: digest.digest('hex'), bytes };
  } finally { closeSync(fd); }
}

// One fixed buffer per copy, including files much larger than a browser can
// display. A declared digest binds the imported bytes, never their meaning.
export function copyHeldArtifact(input, target, expected) {
  if (!DIGEST.test(expected || '')) throw new Error('artifact requires sha256:<64 lowercase hex>');
  const source = resolve(localFile(input));
  if (lstatSync(source).isSymbolicLink()) throw new Error('artifact input must be a regular file, not a symlink');
  const fd = openSync(source, 'r');
  let output;
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error('artifact input must be a regular file');
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    output = openSync(target, 'wx', 0o600);
    const digest = createHash('sha256'), chunk = Buffer.alloc(1024 * 1024);
    let total = 0, n;
    while ((n = readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      digest.update(chunk.subarray(0, n));
      for (let offset = 0; offset < n;) offset += writeSync(output, chunk, offset, n - offset);
      total += n;
    }
    const actual = digest.digest('hex');
    if ('sha256:' + actual !== expected) throw new Error('artifact digest mismatch: imported bytes differ from the declared evidence');
    if (fstatSync(fd).size !== total) throw new Error('artifact changed size while being copied');
    return { sha256: actual, bytes: total };
  } catch (error) {
    if (output !== undefined) { closeSync(output); output = undefined; rmSync(target, { force: true }); }
    throw error;
  } finally {
    if (output !== undefined) closeSync(output);
    closeSync(fd);
  }
}

// Revive only the two map containers the source contract requires to have no
// prototype. Every source, claim and binding still passes its existing gate.
function reviveStore(raw) {
  if (!raw) return createStore();
  requireMap(raw, 'source store');
  requireMap(raw.sources, 'store.sources'); requireMap(raw.claims, 'store.claims');
  if (!Array.isArray(raw.bindings) || !Array.isArray(raw.leads)) throw new Error('store.bindings and store.leads must be arrays');
  const store = createStore();
  Object.assign(store.sources, raw.sources); Object.assign(store.claims, raw.claims);
  store.bindings = raw.bindings; store.leads = raw.leads;
  const problems = validateStore(store);
  if (problems.length) throw new Error('local source contract: ' + problems.join('; '));
  return store;
}

export function readLocalEvidenceInput(file) {
  if (!file) return { artifacts: [], store: null };
  const value = JSON.parse(readFileSync(file, 'utf8'));
  if (value?.schema !== 'skaists.local-evidence-input/1' || !Array.isArray(value.artifacts))
    throw new Error('local evidence input must use skaists.local-evidence-input/1 with artifacts[]');
  return { store: value.store || null, artifacts: value.artifacts.map((a) => {
    localFile(a?.file);
    return { ...a, file: isAbsolute(a.file) ? a.file : resolve(dirname(file), a.file) };
  }) };
}

export function buildLocalEvidence({ index, records, corpus, out, artifacts = [], store: rawStore = null }) {
  if (index?.schema !== 'skaists.sources/1' || records?.schema !== 'skaists.sources-records/1')
    throw new Error('local evidence requires the retained source index and full source records');
  requireMap(index.persons, 'index.persons'); requireMap(records.records, 'records.records');
  requireMap(corpus?.persons, 'corpus.persons');
  if (!Array.isArray(artifacts)) throw new Error('artifacts must be an array');
  if (existsSync(out)) throw new Error('local evidence output must be a fresh directory');
  const contract = reviveStore(rawStore), providerIds = new Map(), shards = new Map();
  for (const id of Object.keys(contract.sources))
    if (own(records.records, id)) throw new Error('local source id collides with a retained source: ' + id);
  const crosswalk = { direct: 0, providerReferences: 0 };
  for (const [iid, p] of Object.entries(corpus.persons)) {
    for (const ref of p.refs || []) {
      const key = JSON.stringify([ref.provider, ref.id]);
      if (!providerIds.has(key)) providerIds.set(key, new Set());
      providerIds.get(key).add(iid);
    }
  }
  function person(iid) {
    if (!ID.test(iid) || !own(corpus.persons, iid)) throw new Error('evidence subject is not an existing internal person: ' + iid);
    if (corpus.persons[iid].living) throw new Error('this public-graph local edition does not expose evidence for living stubs: ' + iid);
    if (!shards.has(iid)) shards.set(iid, new Map());
    return shards.get(iid);
  }
  let references = 0;
  const heldIds = new Set();
  for (const [key, row] of Object.entries(index.persons)) {
    if (!Array.isArray(row?.sources)) throw new Error('index row has no sources: ' + key);
    let iid = own(corpus.persons, key) ? key : null;
    if (iid) {
      if (row.fsid && !(corpus.persons[iid].refs || []).some(ref => ref.provider === 'familysearch' && ref.id === row.fsid))
        throw new Error('source index provider reference contradicts its internal identity: ' + key);
      crosswalk.direct++;
    }
    else {
      const candidates = providerIds.get(JSON.stringify(['familysearch', row.fsid]));
      if (!candidates || candidates.size !== 1) throw new Error('missing or ambiguous recorded identity crosswalk: ' + key);
      iid = [...candidates][0]; crosswalk.providerReferences++;
    }
    if (row.iid && row.iid !== iid) throw new Error('source index iid contradicts the recorded identity: ' + key);
    const target = person(iid);
    for (const ref of row.sources) {
      if (typeof ref?.id !== 'string' || !own(records.records, ref.id)) throw new Error('indexed source detail missing: ' + ref?.id);
      const record = records.records[ref.id];
      if (record?.id !== ref.id) throw new Error('source record key/id mismatch: ' + ref.id);
      references++; heldIds.add(ref.id);
      if (!target.has(ref.id)) target.set(ref.id, { ...record, affected: ref.affected || [], artifacts: [],
        evidenceKind: 'provider-assertion', note: 'Retained source assertion; an attachment is not proof of every affected fact.' });
      else target.get(ref.id).affected = [...new Set([...target.get(ref.id).affected, ...(ref.affected || [])])];
    }
  }
  const extras = Object.keys(records.records).filter((id) => !heldIds.has(id));
  if (extras.length) throw new Error('source records not covered by the retained index: ' + extras.length);

  // Independent town books, testimony, and other local sources enter through
  // the existing source/claim/binding contract. Their assertions remain beside
  // the provider import; no graph edge, date or identity is rewritten.
  for (const binding of contract.bindings) {
    const source = contract.sources[binding.sourceId], claim = contract.claims[binding.claimId];
    for (const iid of new Set(parties(claim.subject))) {
      const target = person(iid);
      if (!target.has(source.id)) target.set(source.id, { id: source.id, title: source.title,
        citation: source.note || source.title, provider: source.provider, urls: source.url ? [source.url] : [],
        retrieved: source.accessedAt, evidenceKind: 'local-source-contract', evidence: [], affected: [],
        source: { ...source }, claims: [], artifacts: [] });
      target.get(source.id).claims.push({ claim: { ...claim }, binding: { ...binding } });
      heldIds.add(source.id);
    }
  }
  // Unbound sources and leads remain retained for later work, but are never
  // promoted into a person's evidence list merely because a document exists.
  const knownSource = (id) => heldIds.has(id) || own(contract.sources, id);
  for (const a of artifacts) {
    if (!map(a) || !knownSource(a.sourceId)) throw new Error('artifact needs an explicit held sourceId');
    if (!DIGEST.test(a.digest || '') || typeof a.file !== 'string' || !a.file) throw new Error('artifact requires a local file and declared digest');
    if (typeof a.mediaType !== 'string' || !a.mediaType.trim()) throw new Error('artifact requires its mediaType');
    for (const field of ['locator', 'note', 'acquisition'])
      if (a[field] !== undefined && typeof a[field] !== 'string') throw new Error('artifact ' + field + ' must be text');
  }

  const staging = out + '.preparing-' + process.pid;
  if (existsSync(staging)) throw new Error('local evidence staging directory already exists');
  mkdirSync(staging, { recursive: true, mode: 0o700 });
  const files = Object.create(null), objects = new Map(), associations = new Map();
  const write = (path, value, max = Infinity) => {
    const data = bytes(value);
    if (data.length > max) throw new Error('local evidence file exceeds its bounded reader size: ' + path);
    mkdirSync(dirname(join(staging, path)), { recursive: true, mode: 0o700 });
    writeFileSync(join(staging, path), data, { mode: 0o600 });
    files[path] = { sha256: hash(data), bytes: data.length };
    return { path, ...files[path] };
  };
  try {
    for (const a of artifacts) {
      const digest = a.digest.slice(7), path = 'objects/sha256/' + digest.slice(0, 2) + '/' + digest;
      if (!objects.has(digest)) {
        files[path] = copyHeldArtifact(a.file, join(staging, path), a.digest);
        objects.set(digest, files[path]);
      }
      const descriptor = { digest: a.digest, path, bytes: objects.get(digest).bytes,
        mediaType: a.mediaType, acquisition: a.acquisition || 'local-file', verification: 'verified',
        ...(a.locator ? { locator: a.locator } : {}), ...(a.note ? { note: a.note } : {}) };
      if (!associations.has(a.sourceId)) associations.set(a.sourceId, []);
      associations.get(a.sourceId).push(descriptor);
    }
    const manifest = { schema: 'skaists.local-evidence/1', scope: 'local-working-copy',
      integrity: 'Digests verify retained bytes, not historical truth, rights or independent corroboration.',
      persons: Object.create(null), crosswalk, counts: { persons: shards.size, sourceReferences: references,
        uniqueImportedSources: Object.keys(records.records).length, localSources: Object.keys(contract.sources).length,
        objects: objects.size } };
    for (const [iid, sources] of [...shards].sort(([a], [b]) => a.localeCompare(b))) {
      for (const source of sources.values()) source.artifacts = associations.get(source.id) || [];
      manifest.persons[iid] = write('persons/' + iid + '.json', { schema: 'skaists.person-evidence/1',
        personId: iid, sources: [...sources.values()] }, MAX_SHARD);
    }
    // This retains full local work, including unbound leads. It is not read by
    // the per-person UI and is never admitted into a public/ANT edition.
    write('source-store.json', { sources: contract.sources, claims: contract.claims,
      bindings: contract.bindings, leads: contract.leads });
    write('artifact-associations.json', Object.fromEntries(associations));
    write('manifest.json', manifest, MAX_MANIFEST);
    if (existsSync(out)) throw new Error('local evidence output appeared during preparation');
    renameSync(staging, out);
    return { manifest, files };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}
