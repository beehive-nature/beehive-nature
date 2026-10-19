// Local evidence reader. A provider URL is provenance, never a read fallback.
// The package manifest locates bounded person shards; artifacts are opened
// only after their actual bytes match the declared digest and length.
// Matching bytes establish copy integrity, not the truth of a historical claim.
export const LOCAL_EVIDENCE_SCHEMA = 'skaists.local-evidence/1';
export const PERSON_EVIDENCE_SCHEMA = 'skaists.person-evidence/1';

const HEX = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const VIEWABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const fail = (code, message) => { const e = new Error(message); e.code = code; throw e; };

export function localEvidencePath(path) {
  if (typeof path !== 'string' || path.length > 512 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path) ||
      path.split('/').some(p => !p || p === '.' || p === '..'))
    fail('PATH', 'Evidence paths must stay inside the local package.');
  return path;
}

function descriptor(d, maxBytes, artifact = false) {
  if (!plain(d)) fail('SHAPE', 'Evidence descriptor is missing.');
  localEvidencePath(d.path);
  const hex = artifact ? (typeof d.digest === 'string' && d.digest.startsWith('sha256:') ? d.digest.slice(7) : '') : d.sha256;
  if (!HEX.test(hex || '') || !Number.isSafeInteger(d.bytes) || d.bytes < 1 || d.bytes > maxBytes)
    fail('SHAPE', 'Evidence descriptor needs a SHA-256 digest and a bounded byte length.');
  if (artifact && !VIEWABLE.has(d.mediaType)) fail('MEDIA', 'This evidence media type cannot be opened in the local viewer.');
  return hex;
}

function freeze(value) {
  const work = [value];
  while (work.length) {
    const item = work.pop();
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) continue;
    Object.freeze(item);
    for (const v of Object.values(item)) work.push(v);
  }
  return value;
}

export function createLocalEvidence({
  base, fetcher = globalThis.fetch, crypto = globalThis.crypto,
  location = globalThis.location, urlAPI = globalThis.URL,
  maxManifestBytes = 1024 * 1024, maxShardBytes = 4 * 1024 * 1024,
  maxArtifactBytes = 64 * 1024 * 1024, maxPersonCache = 16, timeoutMs = 15000,
} = {}) {
  let root;
  if (typeof base !== 'string' || !base) fail('PATH', 'A local evidence package URL is required.');
  try { root = new URL(base, location?.href); } catch { fail('PATH', 'A local evidence package URL is required.'); }
  if (!['http:', 'https:'].includes(root.protocol) || root.username || root.password || root.search || root.hash ||
      !root.pathname.endsWith('/') || (location?.origin && root.origin !== location.origin) ||
      /(^|\.)familysearch\.org$/i.test(root.hostname))
    fail('PATH', 'Evidence must be read from the package origin, without a provider connection.');
  if (typeof fetcher !== 'function' || !crypto?.subtle) fail('CAPABILITY', 'Local evidence needs fetch and SHA-256 support.');
  for (const n of [maxManifestBytes, maxShardBytes, maxArtifactBytes, maxPersonCache, timeoutMs])
    if (!Number.isSafeInteger(n) || n < 1) fail('LIMIT', 'Evidence limits must be positive integers.');

  let manifestPromise = null, closed = false;
  const people = new Map(), urls = new Set(), active = new Set();
  const assertOpen = () => { if (closed) fail('CLOSED', 'This local evidence reader is closed.'); };
  const resolve = (path) => {
    const url = new URL(localEvidencePath(path), root);
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) fail('PATH', 'Evidence path left the local package.');
    return url.href;
  };

  async function read(path, limit, expected = null) {
    assertOpen();
    if (active.size >= 4) fail('BUSY', 'Other local evidence reads are still finishing; open this record again shortly.');
    const url = resolve(path), ctl = new AbortController();
    active.add(ctl);
    let timer;
    try {
      const request = (async () => {
        const response = await fetcher(url, { credentials: 'same-origin', redirect: 'error', signal: ctl.signal });
        if (response.status === 404) fail('MISSING', 'The selected evidence file is not stored in this package.');
        if (!response.ok || response.redirected || (response.url && response.url !== url))
          fail('READ', 'The local evidence file could not be read directly.');
        const length = Number(response.headers?.get('content-length'));
        if (Number.isFinite(length) && length > limit) fail('LIMIT', 'Evidence file exceeds the local reader limit.');
        let bytes;
        if (response.body?.getReader) {
          const reader = response.body.getReader(), chunks = [];
          let size = 0;
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > limit) { await reader.cancel(); fail('LIMIT', 'Evidence file exceeds the local reader limit.'); }
              chunks.push(value);
            }
          } finally { reader.releaseLock(); }
          bytes = new Uint8Array(size);
          let at = 0;
          for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
        } else {
          bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.byteLength > limit) fail('LIMIT', 'Evidence file exceeds the local reader limit.');
        }
        assertOpen();
        if (expected) {
          if (bytes.byteLength !== expected.bytes) fail('INTEGRITY', 'Stored evidence length differs from its receipt.');
          const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
          if (actual !== expected.hex) fail('INTEGRITY', 'Stored evidence digest differs from its receipt.');
        }
        return bytes;
      })();
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => {
        ctl.abort(); const e = new Error('Local evidence read timed out.'); e.code = 'TIMEOUT'; reject(e);
      }, timeoutMs); });
      return await Promise.race([request, deadline]);
    } finally { clearTimeout(timer); active.delete(ctl); }
  }

  function json(bytes) {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { fail('SHAPE', 'The local evidence file is not valid UTF-8 JSON.'); }
  }

  async function manifest() {
    if (!manifestPromise) manifestPromise = (async () => {
      const m = json(await read('manifest.json', maxManifestBytes));
      if (m?.schema !== LOCAL_EVIDENCE_SCHEMA || !plain(m.persons)) fail('SHAPE', 'Local evidence manifest has an unsupported shape.');
      for (const [id, d] of Object.entries(m.persons)) {
        if (!ID.test(id)) fail('SHAPE', 'Local evidence manifest has an invalid person identifier.');
        descriptor(d, maxShardBytes);
      }
      return freeze(m);
    })().catch(e => { manifestPromise = null; throw e; });
    return manifestPromise;
  }

  async function forPerson(personId) {
    assertOpen();
    if (!ID.test(personId || '')) fail('SHAPE', 'An internal person identifier is required.');
    if (people.has(personId)) return people.get(personId);
    const pending = (async () => {
      const m = await manifest();
      if (!own(m.persons, personId)) return freeze({ schema: PERSON_EVIDENCE_SCHEMA, personId, status: 'not-held', sources: [] });
      const d = m.persons[personId];
      const shard = json(await read(d.path, maxShardBytes, { bytes: d.bytes, hex: descriptor(d, maxShardBytes) }));
      if (shard?.schema !== PERSON_EVIDENCE_SCHEMA || shard.personId !== personId || !Array.isArray(shard.sources) ||
          shard.sources.some(s => !plain(s) || typeof s.id !== 'string' || !s.id))
        fail('SHAPE', 'Local evidence shard does not match the selected person.');
      return freeze({ ...shard, status: 'ready', integrity: 'verified' });
    })();
    people.set(personId, pending);
    if (people.size > maxPersonCache) people.delete(people.keys().next().value);
    try { return await pending; } catch (e) { if (people.get(personId) === pending) people.delete(personId); throw e; }
  }

  async function openArtifact(d) {
    const hex = descriptor(d, maxArtifactBytes, true);
    const bytes = await read(d.path, maxArtifactBytes, { bytes: d.bytes, hex });
    assertOpen();
    const url = urlAPI.createObjectURL(new Blob([bytes], { type: d.mediaType }));
    urls.add(url);
    return Object.freeze({ url, mediaType: d.mediaType, digest: d.digest, bytes: bytes.byteLength, integrity: 'verified',
      revoke() { if (urls.delete(url)) urlAPI.revokeObjectURL(url); } });
  }

  return Object.freeze({ forPerson, openArtifact, destroy() {
    closed = true; people.clear();
    for (const ctl of active) ctl.abort();
    for (const url of urls) urlAPI.revokeObjectURL(url);
    urls.clear();
  } });
}

// Optional person-panel organ. Hosts decide which person may be shown; this
// renderer never changes genealogy claims or fetches any provenance URL.
export function mountLocalEvidence(host, reader, personId) {
  const doc = host.ownerDocument;
  let alive = true;
  const opened = new Set();
  const add = (parent, tag, value) => {
    const el = doc.createElement(tag);
    if (value !== undefined) el.textContent = typeof value === 'string' ? value : JSON.stringify(value);
    parent.appendChild(el); return el;
  };
  host.replaceChildren();
  add(host, 'h3', 'Evidence on this device');
  const state = add(host, 'p', 'Reading the saved source entries…');
  const list = add(host, 'div');

  function sourceRow(source) {
    const item = add(list, 'details');
    add(item, 'summary', source.title || source.id);
    let filled = false;
    item.addEventListener('toggle', () => {
      if (!item.open || filled || !alive) return;
      filled = true;
      add(item, 'p', source.citation || 'No citation text was stored for this entry.');
      add(item, 'p', 'Source: ' + (source.provider || 'unrecorded') + ' · ' + source.id +
        (source.retrieved ? ' · read ' + source.retrieved : ''));
      if (Array.isArray(source.affected) && source.affected.length)
        add(item, 'p', 'Attached to these fields: ' + source.affected.join(', ') + '. Attachment alone does not establish a claim.');
      if (source.event) add(item, 'p', 'Recorded event metadata: ' + JSON.stringify(source.event));
      if (Array.isArray(source.evidence) && source.evidence.length) {
        const facts = add(item, 'details'); add(facts, 'summary', 'Recorded text and transcription');
        const dl = add(facts, 'dl');
        for (const fact of source.evidence) {
          if (!plain(fact)) continue;
          add(dl, 'dt', [fact.factType, fact.fieldType].filter(Boolean).join(' · ') || 'Unclassified field');
          add(dl, 'dd', own(fact, 'value') ? fact.value : 'Value absent from this edition.');
        }
      }
      const textValue = value => {
        if (value == null) return 'not recorded';
        if (typeof value !== 'object') return String(value);
        if (Array.isArray(value)) return value.map(textValue).join('; ');
        return Object.entries(value).map(([key, v]) => key + ': ' + textValue(v)).join('; ');
      };
      function claimText(row) {
        const claim = row.claim || row, binding = row.binding || null;
        const box = add(item, 'div');
        add(box, 'p', [claim.subject, claim.predicate, textValue(claim.value)].filter(Boolean).join(' · '));
        if (binding) {
          add(box, 'p', 'This source ' + (binding.relation || 'has no recorded relation to') + ' this claim.' +
            (binding.locator ? ' Location: ' + textValue(binding.locator) + '.' : ''));
          if (binding.quote) add(box, 'blockquote', binding.quote);
          if (binding.note) add(box, 'p', binding.note);
        }
        if (claim.note) add(box, 'p', claim.note);
      }
      if (Array.isArray(source.claims)) for (const claim of source.claims) if (plain(claim)) claimText(claim);
      if (Array.isArray(source.bindings)) for (const binding of source.bindings) if (plain(binding)) {
        add(item, 'p', 'Recorded relation: ' + (binding.relation || 'unspecified') +
          (binding.claimId ? ' · claim ' + binding.claimId : '') + (binding.locator ? ' · ' + textValue(binding.locator) : ''));
        if (binding.quote) add(item, 'blockquote', binding.quote);
        if (binding.note) add(item, 'p', binding.note);
      }
      if (Array.isArray(source.conflicts)) for (const conflict of source.conflicts) if (plain(conflict)) {
        add(item, 'p', 'Recorded conflict: ' + textValue(conflict.value ?? conflict.claim?.value) +
          (conflict.basis ? ' · ' + textValue(conflict.basis) : ''));
        if (conflict.note) add(item, 'p', conflict.note);
      }
      if (Array.isArray(source.assessments)) for (const assessment of source.assessments) if (plain(assessment))
        add(item, 'p', 'Recorded assessment: ' + textValue(assessment.status || assessment.assessment) +
          (assessment.basis || assessment.note ? ' · ' + textValue(assessment.basis || assessment.note) : ''));
      const artifacts = Array.isArray(source.artifacts) ? source.artifacts : [];
      if (!artifacts.length) add(item, 'p', 'No page image is stored for this source in this package.');
      for (const artifact of artifacts) {
        const row = add(item, 'div');
        if (artifact?.locator) add(row, 'p', artifact.locator);
        if (artifact?.note) add(row, 'p', artifact.note);
        if (!artifact?.path || !artifact?.digest) { add(row, 'p', 'Page bytes are not stored here.'); continue; }
        const info = add(row, 'p', 'Page listed as stored; its bytes have not yet been checked in this view.');
        const button = add(row, 'button', 'Verify and open saved page'); button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true; info.textContent = 'Reading and checking the saved page…';
          try {
            const result = await reader.openArtifact(artifact);
            if (!alive) { result.revoke(); return; }
            opened.add(result);
            info.textContent = 'Saved bytes match the receipt. This verifies the copy, not the historical claim.';
            if (result.mediaType.startsWith('image/')) {
              const image = add(row, 'img'); image.alt = 'Saved page for ' + (source.title || source.id);
              image.style.maxWidth = '100%'; image.src = result.url;
            }
            const link = add(row, 'a', 'Open the verified local file — new tab');
            link.href = result.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            button.remove();
          } catch (e) {
            if (!alive) return;
            info.textContent = 'Page unavailable: ' + e.message; button.disabled = false;
          }
        });
      }
      for (const value of (Array.isArray(source.urls) ? source.urls : []).slice(0, 8)) {
        let url;
        try { url = new URL(typeof value === 'string' ? value : value?.url); } catch { continue; }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
        const p = add(item, 'p'), link = add(p, 'a', 'Source provenance at ' + url.hostname + ' — opens a new tab');
        link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      }
    });
  }

  reader.forPerson(personId).then(data => {
    if (!alive) return;
    if (data.status === 'not-held') { state.textContent = 'No source entries are stored for this person in this package yet.'; return; }
    state.textContent = data.sources.length + ' source entries stored locally. Conflicting dates and interpretations remain as recorded.';
    let at = 0;
    const more = add(host, 'button', 'Show more saved sources'); more.type = 'button';
    const next = () => {
      const end = Math.min(at + 25, data.sources.length);
      while (at < end) sourceRow(data.sources[at++]);
      more.hidden = at === data.sources.length;
    };
    more.addEventListener('click', next); next();
  }).catch(e => { if (alive) state.textContent = 'Local evidence could not be read: ' + e.message; });

  return () => { alive = false; for (const result of opened) result.revoke(); opened.clear(); };
}
