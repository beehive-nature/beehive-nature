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
   silently. Zero network beyond ordinary same-origin static fetch; the
   adapter rails (arweave/autonomi/x0x) are declared but NOT qualified —
   attempting them is a named refusal until their browser routes land. */
(function () {
  'use strict';

  const RAILS = [
    {
      id: 'github-pages',
      label: 'GitHub Pages — bootstrap',
      qualified: true,
      note: 'same-origin static fetch of the committed corpus artifacts',
      base: '../assets/profile-archive/lineage/',
    },
    { id: 'arweave', label: 'Arweave', qualified: false, note: 'declared rail — adapter-arweave browser route not yet qualified' },
    { id: 'autonomi', label: 'Autonomi', qualified: false, note: 'declared rail — adapter-autonomi browser route not yet qualified' },
    { id: 'x0x', label: 'x0x', qualified: false, note: 'declared rail — ops/x0x mesh route not yet qualified' },
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

  /* Verify one person against the seal. Returns a result ONLY after the
     person's own page bytes verified against the state; otherwise throws
     SealError with .attempts naming every rail refusal. */
  async function verifyPerson(opts) {
    const person = opts && opts.person;
    if (!person) throw new SealError('usage', 'person id required');
    const rootPin = ((opts && opts.rootPin) || '').trim().toLowerCase() || null;
    if (rootPin && !/^[0-9a-f]{64}$/.test(rootPin)) {
      throw new SealError('usage', 'root pin must be exactly 64 hex characters');
    }
    const rails = (opts.rails && opts.rails.length ? opts.rails : RAILS).slice();
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
    const stateBytes = await fetchBytes(rail.base + 'publication-state.json');
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
    const indexBytes = await fetchBytes(rail.base + 'publication-index.json');
    let index;
    try {
      index = JSON.parse(new TextDecoder().decode(indexBytes));
    } catch (e) {
      throw new SealError('seal-unparseable', 'index is not JSON: ' + e.message);
    }
    const claim = (index.stateSha256 || 'absent').toLowerCase();
    if (claim !== stateSha) {
      throw new SealError('index-not-bound', 'index claims ' + claim.slice(0, 16) + '… but this rail\u2019s state hashes ' + stateSha.slice(0, 16) + '…');
    }
    const entry = index.persons && index.persons[person];
    if (!entry) throw new SealError('person-unknown', person + ' is not in the sealed index');
    const pageState = (state.pages || []).find((p) => p.id === person);
    if (!pageState) throw new SealError('person-unknown', person + ' is not in the state pages');
    if (entry.pageHtmlSha256 !== pageState.html.sha256 || entry.pageJsonSha256 !== pageState.json.sha256) {
      throw new SealError('digest-disagreement', 'the index and the state disagree on ' + person + '\u2019s page digests');
    }
    const htmlBytes = await fetchBytes(rail.base + entry.pageHtml);
    const jsonBytes = await fetchBytes(rail.base + entry.pageJson);
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

  globalThis.BloodSeal = { RAILS, SealError, verifyPerson };
})();
