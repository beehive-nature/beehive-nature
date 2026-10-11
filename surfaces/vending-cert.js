/* vending-cert.js — the birth certificate, composed in the page.
   A byte-for-byte port of contracts/vending/tool/cert.mjs (composeCertificate,
   canonicalJson, contentHash, certTags) plus the a1-log genesis revision
   (v1 and v2) and store binding of tool/a1.mjs, so the machine can mint in a
   browser with no server between the member and the permaweb.
   e2e/vending-cert.test.mjs holds this file and cert.mjs to the SAME hash
   for the same inputs, and this file's genesis to a1.mjs's verifier — drift
   fails the gate. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VendingCert = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var subtle = (typeof crypto !== 'undefined' && crypto.subtle) || (typeof require === 'function' && require('node:crypto').webcrypto.subtle);
  var te = new TextEncoder();
  var CERT_VERSION = 1, A1_VERSION = 1, A1_V2 = 2;

  var sortDeep = function (v) {
    return Array.isArray(v) ? v.map(sortDeep)
      : (v && typeof v === 'object') ? Object.keys(v).sort().reduce(function (o, k) { o[k] = sortDeep(v[k]); return o; }, {})
      : v;
  };
  var canonicalJson = function (record) { return JSON.stringify(sortDeep(record)); };
  function hex(b) { return Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  async function sha256hex(s) { return hex(new Uint8Array(await subtle.digest('SHA-256', te.encode(s)))); }
  async function contentHash(record) {
    var copy = JSON.parse(JSON.stringify(record));
    if (copy.hash) delete copy.hash.value;
    return sha256hex(canonicalJson(copy));
  }

  /* cert.mjs composeCertificate, verbatim shape */
  async function composeCertificate(p) {
    var spec = p.spec || 'SPEC-VENDING-1';
    var record = {
      record: 'agent-birth-certificate',
      version: CERT_VERSION,
      law: {
        spec: spec,
        naming: 'SPEC-A-NAMES-1: .a agents, suffixless names, 27-tongue charset',
        pointer_law: 'location DERIVED from member-held inputs, never a curated list: the agent name resolves the vending contract\'s certs row (name road); the member ed25519 key locates the Arweave record by its Member-Key tag — and equals the AR owner when the ed25519 door signs the item (key road). Replication is not the mechanism.',
        fence: 'ANT farming is participation not revenue; the tithe is the business (SPEC-VENDING-1 §fence — ruled, closed)'
      },
      answers: {
        what_is_this: 'a member-owned AI agent minted by the skaists vending machine; it outlives the machine that made it',
        who_owns_it: { member_key_ed25519_hex: p.memberKeyHex, vaulta_account: p.memberAccount },
        when_minted_utc: p.mintedIso,
        where_memory_lives: p.storeBinding,
        how_to_make_another: 'the recipe below re-stands the whole machine — the species survives the estate'
      },
      agent: { name: p.agentName, house: p.house, tongue: p.tongue, template: p.template },
      recipe: {
        machine: 'the skaists member-agent vending machine (bQueenBee line)',
        layers: {
          arweave: { role: 'this birth certificate AND this recipe — the permanent layer',
            door: 'Arweave Turbo free tier (<=105 KiB; ed25519-signed so the OWNER equals the member key when that door is open, else Member-Key tag carries the key road)' },
          autonomi: { role: 'private working memory under the member\'s own key',
            format: 'a1-log v2: append-only hash-linked revisions, each signed by the member\'s ed25519 key and by an ML-DSA-65 key pinned at genesis; highest valid revision wins; v1 logs still verify under v1 rules; deletable by the member',
            funded_write: 'gated on the ANT custody review (storage-substrate-split item 8); never priced at zero (R3)' },
          vaulta: { role: 'rate table + tithe + one bounded pointer row per agent',
            contract: 'vending (contracts/vending/src/vending.cpp, cdt-cpp 4.x)',
            actions: 'init setrate settithe mint update release' },
          base: { role: 'the money: payments in; cash-out via the proven PYUSD door' }
        },
        restand_steps: [
          '1. compile vending (cdt-cpp) and deploy to a Vaulta chain seat',
          '2. init(admin, max_certs) — the RAM bound is law',
          '3. setrate vaulta 0.6000 A; settithe 1000bp -> tithe destination',
          '4. mint(agent_name, owner, member_key_hex, ar_id, sha256_hex, template, tongue)',
          '5. verify this record: canonical JSON (keys sorted, no whitespace), sha256, compare hash.value'
        ],
        source: 'estate tree beehive-nature (github); SPEC-VENDING-1 is the spec of record'
      },
      hash: {
        algorithm: 'sha256',
        computed_over: 'canonical JSON (UTF-8, keys sorted at every level, no whitespace) of this object with hash.value removed',
        value: ''
      }
    };
    if (p.extra) Object.keys(p.extra).forEach(function (k) { record[k] = p.extra[k]; });
    record.hash.value = await contentHash(record);
    return record;
  }

  var certTags = function (p) {
    return [
      { name: 'App-Name', value: 'skaists-vending' },
      { name: 'Type', value: 'agent-birth-certificate' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Agent-Name', value: p.agentName },
      { name: 'Member-Key', value: p.memberKeyHex },
      { name: 'Spec', value: p.spec || 'SPEC-VENDING-1' },
      { name: 'Hash-Algorithm', value: 'sha256' }
    ];
  };

  /* a1.mjs: hashRevision + genesisRevision (owner-signed ed25519, hex) */
  async function hashRevision(rev) { return sha256hex(canonicalJson(rev)); }
  async function genesisRevision(p) {
    var base = { v: A1_VERSION, agent: p.agent, rev: 0, prev: '', body: p.body, ts: p.ts || new Date().toISOString() };
    var sig = hex(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, p.memberPrivateKey, te.encode(canonicalJson(base)))));
    base.sig_ed25519 = sig; return base;
  }

  /* a1.mjs v2: a1PqKeys + genesisRevisionV2. The same genesis signed twice
     over the same canonical bytes: ed25519 by the member key, ML-DSA-65 by
     the post-quantum key it pins (BPQ.keys(member seed, 'a1:' + agent) —
     surfaces/bpq.js, SPEC-BPQ-1). Needs bpq-lib.js + bpq.js loaded first; a
     page without them is refused here, never handed a v1 genesis instead. */
  function bpq() {
    var B = typeof BPQ !== 'undefined' ? BPQ : null;
    if (!B) throw new Error('a1 v2 needs the post-quantum library (bpq-lib.js + bpq.js), and it did not load');
    return B;
  }
  function a1PqKeys(seed32, agent) {
    if (typeof agent !== 'string' || !agent) throw new Error('a1 v2: agent must be a non-empty string');
    return bpq().keys(seed32, 'a1:' + agent);
  }
  async function genesisRevisionV2(p) {
    var B = bpq(), k = p.pqKeys;
    if (!k || !k.dsa || !k.succession) throw new Error('a1 v2 needs the agent\'s PQ keys (a1PqKeys(member seed, agent))');
    if (k.context !== 'a1:' + p.agent) throw new Error('a1 v2: the PQ keys were derived for context ' + JSON.stringify(k.context) + ', not ' + JSON.stringify('a1:' + p.agent));
    var base = { v: A1_V2, agent: p.agent, rev: 0, prev: '', body: p.body, ts: p.ts || new Date().toISOString(),
      pq: { alg: 'ml-dsa-65', id: k.id, dsa: B.b64u(k.dsa.publicKey), succ: B.b64u(k.succession.commit) } };
    var canon = canonicalJson(base);
    var ed = hex(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, p.memberPrivateKey, te.encode(canon))));
    // a1.mjs pqMessage: the ML-DSA-65 signature also covers the ed25519 one
    var head = te.encode('a1/v2/pq' + canon), msg = new Uint8Array(head.length + 64);
    msg.set(head, 0);
    for (var i = 0; i < 64; i++) msg[head.length + i] = parseInt(ed.substr(i * 2, 2), 16);
    var ml = B.b64u(k.dsa.sign(msg));
    base.sig_ed25519 = ed; base.sig_ml_dsa_65 = ml; return base;
  }

  /* a1.mjs storeBinding: v1 text unchanged byte for byte; v2 names the pinned pq id */
  var FUNDED_WRITE_STATUS = 'GATED on the ANT custody review (storage-substrate-split item 8); the binding is derivable from this certificate the day it is funded';
  function storeBinding(genesis, genesisHash) {
    if (genesis.v === A1_VERSION) return { store: 'autonomi',
      binding: 'a1-log v1 — append-only hash-linked revisions, owner-signed ed25519 (this member key); resolver takes the highest valid revision; deletable by the member',
      a1_genesis: { rev: genesis.rev, sha256: genesisHash, ts: genesis.ts },
      funded_write_status: FUNDED_WRITE_STATUS };
    if (genesis.v === A1_V2) return { store: 'autonomi',
      binding: 'a1-log v2 — append-only hash-linked revisions, each signed twice: ed25519 (this member key) over the canonical bytes, and ML-DSA-65 (the post-quantum key pinned at genesis, a1_genesis.pq_id) over those bytes and the ed25519 signature; a revision counts only if every revision back to this genesis carries both; resolver takes the highest valid revision; deletable by the member',
      a1_genesis: { rev: genesis.rev, sha256: genesisHash, ts: genesis.ts, pq_id: genesis.pq.id },
      funded_write_status: FUNDED_WRITE_STATUS };
    throw new Error('unknown a1 version ' + JSON.stringify(genesis.v));
  }

  /* verify: the resurrection gate (cert.mjs verifyCertificate) */
  async function verifyCertificate(record) {
    if (!record || record.record !== 'agent-birth-certificate') return { ok: false, reason: 'not a birth certificate' };
    if (!record.hash || record.hash.algorithm !== 'sha256') return { ok: false, reason: 'no sha256 hash block' };
    var h = await contentHash(record);
    return h === record.hash.value ? { ok: true, hash: h } : { ok: false, reason: 'hash mismatch', hash: h, claimed: record.hash.value };
  }

  return { CERT_VERSION: CERT_VERSION, canonicalJson: canonicalJson, contentHash: contentHash, composeCertificate: composeCertificate, certTags: certTags, hashRevision: hashRevision, genesisRevision: genesisRevision, a1PqKeys: a1PqKeys, genesisRevisionV2: genesisRevisionV2, storeBinding: storeBinding, verifyCertificate: verifyCertificate };
});
