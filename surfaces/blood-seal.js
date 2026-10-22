/* blood-seal.js — the dApp verification and retrieval layer for the sealed
   lineage corpus (founder order 2026-10-19: "consume the sealed index,
   obtain a trusted root independently, verify fetched content before
   rendering; GitHub bootstrap with Arweave/Autonomi/x0x as independently
   qualified adapter routes; missing or corrupted bytes fail closed").

   THE LAW OF THIS FILE: an unverified byte never renders. Content is
   returned only after its own digest was recomputed and matched the
   sealed state. The root pin — supplied OUT OF BAND (a git commit, the
   lane dispatch), never fetched from a rail — is the trust boundary:
   with a pin, a rail serving anything else is recorded and the next
   QUALIFIED rail is tried (the pin, not the rail, decides what is
   sealed); without a pin, the result is consistency-only and is labeled
   untrusted, never verified. Every refusal is named; nothing falls back
   silently.

   RAILS (2026-10-20 qualification pass): a rail says WHERE bytes may
   come from, never WHAT to trust — every byte from every rail is
   digest-verified against the pin, so a hostile rail (or a hostile
   rail-manifest.json) can only affect availability, never content.
   rail-manifest.json beside the seal carries endpoints, observed
   response shapes and honest statuses. github-pages is the one
   qualified rail. The autonomi estate door (relay.skaists.dev) is
   implemented with its OBSERVED response shape (JSON {"data": base64})
   and stays unqualified until corpus content lives on Autonomi (upload
   is a founder gesture). Arweave gateway fetch is implemented the same
   way, unqualified until content exists. x0x is loopback-only gossip
   with no stored history (ops/x0x verbatim) — structurally absent as a
   public read rail, and named as such. */
(function () {
  'use strict';

  const MANIFEST_URL = '../assets/profile-archive/lineage/rail-manifest.json';
  const GITHUB_RAIL = {
    id: 'github-pages',
    label: 'GitHub Pages — bootstrap',
    qualified: true,
    note: 'same-origin static fetch of the committed corpus artifacts',
    kind: 'same-origin-static',
    base: '../assets/profile-archive/lineage/',
  };
  const RAILS = [
    GITHUB_RAIL,
    { id: 'autonomi', label: 'Autonomi', qualified: false, note: 'declared rail — estate door route observed live; corpus content not yet on Autonomi' },
    { id: 'arweave', label: 'Arweave', qualified: false, note: 'declared rail — gateway route implemented; corpus content not yet on Arweave' },
    { id: 'x0x', label: 'x0x', qualified: false, note: 'declared rail — loopback-only gossip, no stored history; structurally absent as a public read rail' },
  ];

  class SealError extends Error {
    constructor(code, detail) {
      super(detail || code);
      this.code = code;
    }
  }

  async function sha256Hex(buf) {
    if (!globalThis.crypto || !crypto.subtle) {
      throw new SealError('secure-context-required', 'WebCrypto unavailable — the seal needs a secure context (https or localhost)');
    }
    const d = await crypto.subtle.digest('SHA-256', buf);
    let s = '';
    for (const b of new Uint8Array(d)) s += b.toString(16).padStart(2, '0');
    return s;
  }

  async function fetchBytes(url) {
    let r;
    try {
      r = await fetch(url, { cache: 'no-store' });
    } catch (e) {
      throw new SealError('fetch-failed', url + ' — ' + e.message);
    }
    if (!r.ok) throw new SealError('fetch-failed', url + ' — HTTP ' + r.status);
    return new Uint8Array(await r.arrayBuffer());
  }

  // base64 -> bytes (the estate door's observed wrapper shape)
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // A door-shaped rail: GET door+address, JSON {"data": <base64 raw bytes>}
  // (shape observed live 2026-10-20 against relay.skaists.dev).
  async function doorBytes(door, addr) {
    const raw = await fetchBytes(door + addr);
    let j;
    try {
      j = JSON.parse(new TextDecoder().decode(raw));
    } catch (e) {
      throw new SealError('fetch-failed', door + addr + ' — door payload is not its observed JSON shape');
    }
    if (!j || typeof j.data !== 'string') {
      throw new SealError('fetch-failed', door + addr + ' — door payload missing the data field');
    }
    return b64ToBytes(j.data);
  }

  // Build a fetch-one-artifact function for a rail configuration. The
  // address map names each seal artifact on that rail; a missing address
  // is a named refusal, never a skip.
  function railGetter(rail) {
    if (rail.kind === 'same-origin-static') {
      return (name) => fetchBytes(rail.base + name);
    }
    if (rail.kind === 'estate-door') {
      return (name) => {
        const a = rail.addresses && rail.addresses[name];
        if (!a) throw new SealError('address-missing', rail.id + ' has no address for ' + name);
        return doorBytes(rail.door, a);
      };
    }
    if (rail.kind === 'public-gateway') {
      return async (name) => {
        const a = rail.addresses && rail.addresses[name];
        if (!a) throw new SealError('address-missing', rail.id + ' has no address for ' + name);
        let lastErr;
        for (const gw of rail.gateways || []) {
          try {
            return await fetchBytes(gw + a);
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr || new SealError('fetch-failed', rail.id + ' has no gateway configured');
      };
    }
    return () => Promise.reject(new SealError('route-not-qualified', rail.note || rail.id));
  }

  // Merge the committed rail-manifest.json (WHERE, never WHAT) into the
  // rail set. A rail participates only when the manifest marks it
  // qualified AND carries addresses for the artifacts.
  function railsFromManifest(m) {
    const out = [GITHUB_RAIL];
    const r = m && m.rails;
    const entries = [
      ['autonomi', r && r.autonomi],
      ['arweave', r && r.arweave],
    ];
    for (const [id, cfg] of entries) {
      if (!cfg) {
        out.push(RAILS.find((x) => x.id === id));
        continue;
      }
      const hasAddresses = cfg.addresses && Object.keys(cfg.addresses).length > 0;
      out.push({
        id,
        label: id === 'autonomi' ? 'Autonomi — estate door' : 'Arweave — public gateway',
        qualified: !!(cfg.qualified && hasAddresses),
        note: cfg.status || 'declared rail',
        kind: cfg.kind,
        door: cfg.door,
        gateways: cfg.gateways,
        addresses: cfg.addresses || {},
      });
    }
    out.push(RAILS.find((x) => x.id === 'x0x'));
    return out;
  }

  async function loadManifestRails() {
    try {
      const bytes = await fetchBytes(MANIFEST_URL);
      return railsFromManifest(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (e) {
      return RAILS; // the manifest is WHERE-only; without it the built-ins stand
    }
  }

  /* Verify one person against the seal. Returns a result ONLY after the
     person's own page bytes verified against the state; otherwise throws
     SealError with .attempts naming every rail refusal. Issue #477: the
     index is authenticated by the STATE (sha256(index bytes) must equal
     state.indexSha256 — the index carries no self-claim), so a substituted
     index with forged metadata and intact page digests refuses before any
     of its fields are read. The pin authenticates the state; the state
     binds the index; the index carries the page digests. Acyclic. */
  async function verifyPerson(opts) {
    const person = opts && opts.person;
    if (!person) throw new SealError('usage', 'person id required');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(person)) {
      throw new SealError('person-id-rejected', 'ids are [A-Za-z0-9._-] and never begin with a dot — a person id is a shape, never a path');
    }
    const rootPin = ((opts && opts.rootPin) || '').trim().toLowerCase() || null;
    if (rootPin && !/^[0-9a-f]{64}$/.test(rootPin)) {
      throw new SealError('usage', 'root pin must be exactly 64 hex characters');
    }
    const rails = (opts.rails && opts.rails.length
      ? opts.rails
      : await loadManifestRails()
    ).slice();
    const attempts = [];
    for (const rail of rails) {
      if (!rail.qualified) {
        attempts.push({ rail: rail.id, refused: 'route-not-qualified', note: rail.note });
        continue;
      }
      try {
        const result = await verifyOnRail(rail, person, rootPin);
        result.attempts = attempts;
        result.rootPinUsed = !!rootPin;
        return result;
      } catch (e) {
        if (e instanceof SealError) {
          attempts.push({ rail: rail.id, refused: e.code, note: e.message });
          continue;
        }
        throw e;
      }
    }
    const err = new SealError(
      'all-rails-failed',
      attempts.map((a) => a.rail + ': ' + a.refused).join(' | ') || 'no qualified rail'
    );
    err.attempts = attempts;
    throw err;
  }

  async function verifyOnRail(rail, person, rootPin) {
    const get = railGetter(rail); // WHERE the bytes come from — the pin rules WHAT
    const stateBytes = await get('publication-state.json');
    const stateSha = await sha256Hex(stateBytes);
    if (rootPin && stateSha !== rootPin) {
      throw new SealError('pin-mismatch', 'rail ' + rail.id + ' state hashes ' + stateSha.slice(0, 16) + '…; the pin says otherwise');
    }
    let state;
    try {
      state = JSON.parse(new TextDecoder().decode(stateBytes));
    } catch (e) {
      throw new SealError('seal-unparseable', 'state is not JSON: ' + e.message);
    }
    const indexBytes = await get('publication-index.json');
    // issue #477: the STATE binds the index by digest — the index has no
    // self-claim to check. Forged names/refs/arks with intact page digests
    // still hash differently than the digest sealed in the state.
    const indexSha = await sha256Hex(indexBytes);
    const bound = (state.indexSha256 || 'absent').toLowerCase();
    if (bound !== indexSha) {
      throw new SealError('index-not-state-bound', 'the state binds ' + bound.slice(0, 16) + '…, this rail\u2019s index hashes ' + indexSha.slice(0, 16) + '… — substituted or stale index');
    }
    let index;
    try {
      index = JSON.parse(new TextDecoder().decode(indexBytes));
    } catch (e) {
      throw new SealError('seal-unparseable', 'index is not JSON: ' + e.message);
    }
    const entry = index.persons && index.persons[person];
    if (!entry) throw new SealError('person-unknown', person + ' is not in the sealed index');
    const pageState = (state.pages || []).find((p) => p.id === person);
    if (!pageState) throw new SealError('person-unknown', person + ' is not in the state pages');
    // locator discipline (#477, defense in depth): a person's locators are
    // their own pages under persons/ — nothing else is fetched, ever
    if (entry.pageHtml !== 'persons/' + person + '.html' || entry.pageJson !== 'persons/' + person + '.json') {
      throw new SealError('locator-escape', entry.pageHtml + ' / ' + entry.pageJson + ' — a person\u2019s locators are their own pages under persons/');
    }
    if (entry.pageHtmlSha256 !== pageState.html.sha256 || entry.pageJsonSha256 !== pageState.json.sha256) {
      throw new SealError('digest-disagreement', 'the index and the state disagree on ' + person + '\u2019s page digests');
    }
    const htmlBytes = await get(entry.pageHtml);
    const jsonBytes = await get(entry.pageJson);
    const htmlSha = await sha256Hex(htmlBytes);
    const jsonSha = await sha256Hex(jsonBytes);
    if (htmlSha !== pageState.html.sha256) {
      throw new SealError('page-drift', entry.pageHtml + ': the seal says ' + pageState.html.sha256.slice(0, 16) + '…, the rail served ' + htmlSha.slice(0, 16) + '…');
    }
    if (jsonSha !== pageState.json.sha256) {
      throw new SealError('page-drift', entry.pageJson + ': the seal says ' + pageState.json.sha256.slice(0, 16) + '…, the rail served ' + jsonSha.slice(0, 16) + '…');
    }
    return {
      status: rootPin ? 'verified' : 'untrusted-consistency',
      rail: rail.id,
      stateSha256: stateSha,
      person: {
        id: person,
        name: entry.name || null,
        lifespan: entry.lifespan || null,
        era: entry.era || null,
        fsRefs: entry.fsRefs || [],
        recordArks: entry.recordArks || [],
        pageHtml: entry.pageHtml,
        pageJson: entry.pageJson,
        pageHtmlSha256: pageState.html.sha256,
        pageJsonSha256: pageState.json.sha256,
      },
      htmlText: new TextDecoder().decode(htmlBytes),
      jsonText: new TextDecoder().decode(jsonBytes),
    };
  }

  globalThis.BloodSeal = { RAILS, SealError, verifyPerson, railsFromManifest };
})();
