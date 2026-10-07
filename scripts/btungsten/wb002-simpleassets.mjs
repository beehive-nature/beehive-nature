// wb002-simpleassets.mjs — bTunGsTeN Workbench 002: SimpleAssets 2021 as an
// extinct-infrastructure specimen (founder order 2026-10-07).
//
// THE INVARIANT (the killer one, founder wording): no change of
// implementation, network, author, storage provider, cryptographic
// algorithm, or execution environment may transfer sovereign authority
// without the currently authorized sovereign action.
//
// This file is a faithful JS port of the frozen upstream state machine at
// commit e6a042f75256008edf38c73cc55f6499fc306a7a (2021-03-17, v1.6.1,
// LGPL-2.1), vendored verbatim under wb002-specimen/simpleassets-e6a042f/.
// Line references below cite that tree's src/SimpleAssets.cpp (SA.cpp) and
// include/SimpleAssets.hpp. Where this port deviates from upstream the
// deviation is named in a PORT NOTE; anything not ported is named at the
// bottom (EXCLUDED SURFACE). The port is evidence about a model of the
// contract, not the compiled contract itself — wasm-vs-model equivalence
// is a named gap (README §next).
//
// PROFILES:
//   'specimen'      — upstream semantics, quirks included. The quirks are
//                     the point: the specimen FAILS parts of the invariant
//                     by design, and each failure is a BNR adapter
//                     requirement (convicted by name in the battery).
//   'bnr-adapter'   — the same machine with the extracted BNR semantics:
//                     issuer authority is never confiscation authority,
//                     bounded tenure is enforced on every exit path,
//                     composition authority belongs to the sovereign,
//                     offers expire, authority envelopes move only with
//                     the sovereign's co-signature.
//
// Sovereign authority is defined by sovereignOf():
//   free NFT/NTT    -> the row's holder (the sassets scope)
//   delegated NFT   -> the delegates-table lender (the borrower holds
//                      possession only; redelegate chains never move it)
//   contained NFT   -> the containing asset's sovereign (recursively)
//   offered NFT     -> still the offerer (an open offer transfers nothing)
//   FT balance      -> the account holding it
//   burned / never  -> null

import { createHash } from 'node:crypto';

export class Refusal extends Error {
  constructor(code, message) { super(message); this.refusal = code; }
}

export const PROFILES = ['specimen', 'bnr-adapter'];

// Canonical serialization for commitments: sorted keys, UTF-8, no
// whitespace. Deterministic by construction; sha256 over these bytes is
// the specimen's commitment idiom (sound by construction at model level).
export function canon(v) {
  if (typeof v === 'bigint') return `${v}n`;
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}
export const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

const MAX_MEMO = 512;
const ADAPTER_OFFER_TTL = 3600n;  // bnr-adapter default offer expiry (seconds)
const CHECKPOINT_EVERY = 64;      // anchored state checkpoints in the event log

const name = (n) => {
  if (typeof n !== 'string' || !/^[a-z1-5.]{1,13}$/.test(n)) throw new Refusal('bt-wb002:name', `not an account name: ${n}`);
  return n;
};

// Offer rows carry an expiry key ONLY on the adapter profile — no
// undefined-valued properties anywhere in state, so snapshot/restore and
// canonical fingerprints stay byte-exact.
const offerRecord = (profile, now, owner, offeredto) => {
  const rec = { owner, offeredto, cdate: now };
  if (profile === 'bnr-adapter') rec.expiresAt = now + ADAPTER_OFFER_TTL;
  return rec;
};

// The model's transaction boundary (model-hardening beat, founder review
// 2026-10-07, finding R-1). Antelope specifies that a FAILED transaction
// restores prior state — the vendored C++ relies on that rollback
// boundary, and the port must reproduce it rather than assume it. Every
// PUBLIC action below runs inside tx(): state tables, counters and the
// committed event log roll back on any throw. Nested action calls
// (delegate -> transfer, undelegate -> transfer, issuef -> transferf)
// are internal method calls that bypass the proxy and therefore JOIN the
// outer transaction — the inline-action semantics of one Antelope
// transaction. tx() is also public: a caller may bundle several actions
// into one atomic unit, mirroring a multi-action transaction.
const TX_ACTIONS = new Set([
  'create', 'createntt', 'claim', 'claimntt', 'transfer', 'transferf',
  'offer', 'offerf', 'canceloffer', 'cancelofferf', 'claimf', 'update',
  'updatentt', 'burn', 'burnntt', 'burnf', 'delegate', 'delegatemore',
  'undelegate', 'attach', 'detach', 'attachf', 'detachf', 'changeauthor',
  'createf', 'issuef', 'setarampayer', 'importState',
]);

export class Chain {
  constructor({ profile = 'specimen', now = 1_700_000_000n } = {}) {
    if (!PROFILES.includes(profile)) throw new Refusal('bt-wb002:profile', `unknown profile ${profile}`);
    this.profile = profile;
    this.now = now;                       // injectable clock (sec_since_epoch, u64 in the contract)
    this.accounts = new Set();            // is_account()
    this.scopes = new Map();              // owner -> Map(assetid -> row)   [sassets scope law]
    this.nttScopes = new Map();           // owner -> Map(assetid -> row)   [snttassets]
    this.offers = new Map();              // assetid -> {owner, offeredto, cdate, expiresAt?}
    this.nttOffers = new Map();
    this.delegates = new Map();           // assetid -> {owner, delegatedto, cdate, period, redelegate}
    this.stats = new Map();               // `${author}:${sym}` -> {supply, max, issuer, id, authorctrl}
    this.balances = new Map();            // owner -> Map(ftid -> {sym, amount})
    this.ftOffers = new Map();            // offerid -> {author, owner, offeredto, amount, sym, ftid}
    this.arampayers = [];                 // {id, author, category, usearam, from_id}  [sarampayer]
    this.lnftid = 100000000000000n;       // SA.hpp global{} initial counters
    this.defid = 1000000n;
    this.ramPayerOf = new Map();          // assetid -> last ram payer (sponsored-sovereignty evidence)
    this.log = [];                        // anchored event log (the external-consumer surface)
    this.genesis = sha('bT-WB02:genesis');
    this._txDepth = 0;
    // The public seam: every action call from OUTSIDE the chain opens a
    // transaction; calls from inside (this.transfer inside delegate, the
    // inline-action pattern) join the one already open.
    return new Proxy(this, {
      get(target, prop, receiver) {
        const v = Reflect.get(target, prop, receiver);
        if (typeof prop === 'string' && TX_ACTIONS.has(prop) && typeof v === 'function') {
          return (...args) => target.tx(() => v.apply(target, args));
        }
        return v;
      },
    });
  }

  // One modeled transaction: run fn(); on ANY throw, restore the entire
  // pre-state (tables, counters, committed log) and rethrow. This is the
  // rollback boundary the 2021 contract gets from Antelope for free.
  tx(fn) {
    if (this._txDepth > 0) return fn(); // nested: the outer transaction owns rollback
    const snap = this._snapshot();
    this._txDepth = 1;
    let out;
    try { out = fn(); } catch (e) {
      this._txDepth = 0;
      this._restore(snap);
      throw e;
    }
    this._txDepth = 0;
    return out;
  }
  _snapshot() {
    return {
      scopes: structuredClone(this.scopes), nttScopes: structuredClone(this.nttScopes),
      offers: structuredClone(this.offers), nttOffers: structuredClone(this.nttOffers),
      delegates: structuredClone(this.delegates), stats: structuredClone(this.stats),
      balances: structuredClone(this.balances), ftOffers: structuredClone(this.ftOffers),
      arampayers: structuredClone(this.arampayers), ramPayerOf: structuredClone(this.ramPayerOf),
      lnftid: this.lnftid, defid: this.defid, logLen: this.log.length,
    };
  }
  _restore(s) {
    this.scopes = s.scopes; this.nttScopes = s.nttScopes; this.offers = s.offers;
    this.nttOffers = s.nttOffers; this.delegates = s.delegates; this.stats = s.stats;
    this.balances = s.balances; this.ftOffers = s.ftOffers; this.arampayers = s.arampayers;
    this.ramPayerOf = s.ramPayerOf; this.lnftid = s.lnftid; this.defid = s.defid;
    this.log.length = s.logLen; // committed events of the refused transaction vanish too
  }
  // A fingerprint over EVERYTHING a modeled action can touch, plus the
  // committed log. The battery demands it be preserved across every
  // refused transaction (R-1 regression net).
  fingerprint() {
    const dump = (m) => [...m.entries()].map(([k, v]) => [k, v instanceof Map ? [...v.entries()] : v]);
    return sha(canon({
      scopes: dump(this.scopes), ntt: dump(this.nttScopes), offers: [...this.offers.entries()],
      nttOffers: [...this.nttOffers.entries()], delegates: [...this.delegates.entries()],
      stats: [...this.stats.entries()], balances: dump(this.balances), ftOffers: [...this.ftOffers.entries()],
      arampayers: this.arampayers, lnftid: this.lnftid, defid: this.defid,
      ramPayerOf: [...this.ramPayerOf.entries()], logLen: this.log.length, logRoot: this.logRoot(),
    }));
  }

  acct(n) { this.accounts.add(name(n)); return this; }

  // --- anchored event log -------------------------------------------------
  rawEmit(fields) {
    const prev = this.log.length ? this.log[this.log.length - 1].root : this.genesis;
    const seq = this.log.length;
    const root = sha(`${prev}|${canon({ seq, ...fields })}`);
    const ev = { seq, ...fields, root };
    this.log.push(ev);
    return ev;
  }
  // Periodic anchored state checkpoints: an archivist needs only the last
  // surviving checkpoint event plus everything after it to reconstruct
  // sovereignty — the mechanism the millennium leg stands on. Contained
  // children are checkpointed as STRUCTURE ({containerOf: parent}), not as
  // resolved owners, so a later move of the parent still propagates to
  // them in the fold.
  maybeCheckpoint() {
    if (this.log.length > 0 && this.log.length % CHECKPOINT_EVERY === 0) {
      const assets = [];
      const walkContained = (row) => {
        for (const c of row.container) { assets.push([c.id, { containerOf: row.id }, 'nft']); walkContained(c); }
      };
      for (const rows of this.scopes.values()) for (const row of rows.values()) { assets.push([row.id, this.sovereignOf(row.id), 'nft']); walkContained(row); }
      for (const rows of this.nttScopes.values()) for (const row of rows.values()) assets.push([row.id, row.owner, 'ntt']);
      const deleg = [...this.delegates.entries()].map(([assetid, d]) => [assetid, d.owner]);
      this.rawEmit({ type: 'checkpoint', assets, deleg });
    }
  }
  emit(fields) { const ev = this.rawEmit(fields); this.maybeCheckpoint(); return ev; }

  // --- lookup helpers -------------------------------------------------------
  scope(holder, ntt = false) {
    const m = ntt ? this.nttScopes : this.scopes;
    if (!m.has(holder)) m.set(holder, new Map());
    return m.get(holder);
  }
  findAsset(holder, id) {
    const row = this.scope(holder).get(id);
    if (!row) throw new Refusal('bt-wb002:not-found', `asset ${id} not found in scope ${holder}`);
    return row;
  }
  hasAuth(signers, a) { return signers.includes(a); }
  requireAuth(signers, a) { if (!signers.includes(a)) throw new Refusal('bt-wb002:auth', `missing authority of ${a}`); }
  check(cond, code, msg) { if (!cond) throw new Refusal(code, msg); }
  getid() { return ++this.lnftid; } // asset_id path (SA.cpp:843)

  // sovereignOf — the invariant's subject. See file header.
  sovereignOf(id) {
    if (this.delegates.has(id)) return this.delegates.get(id).owner;
    for (const rows of this.scopes.values()) {
      const row = rows.get(id);
      if (row) return row.owner;
    }
    for (const rows of this.nttScopes.values()) {
      const row = rows.get(id);
      if (row) return row.owner;
    }
    for (const rows of this.scopes.values()) {
      for (const row of rows.values()) {
        if (this.inContainer(row, id)) return this.sovereignOf(row.id);
      }
    }
    return null;
  }
  inContainer(row, id) {
    for (const c of row.container) { if (c.id === id) return c; if (this.inContainer(c, id)) return c; }
    return null;
  }

  // get_payer — SA.cpp:302. Sponsored RAM: the author may pay for rows of
  // assets they authored, per category, from a given asset id onward.
  // The payer is never an owner — the battery asserts it.
  get_payer(author, category, id) {
    for (const r of this.arampayers) {
      if (r.author === author && r.category === category && r.usearam && id > r.from_id) return author;
    }
    return '';
  }
  emplaceAsset(holder, row, payer) {
    this.scope(holder).set(row.id, row);
    this.ramPayerOf.set(row.id, payer);
  }

  // --- NFT actions (SA.cpp line refs) --------------------------------------
  create(author, category, owner, idata, mdata, requireclaim, signers) {
    author = name(author); category = name(category); owner = name(owner);
    this.requireAuth(signers, author);                                   // SA.cpp:100
    this.check(this.accounts.has(owner), 'bt-wb002:account', 'owner account does not exist');
    const newID = this.getid();
    this.check(!(author === owner && requireclaim), 'bt-wb02:claim-self', "can't requireclaim if author == owner"); // SA.cpp:105
    let assetOwner = owner;
    if (requireclaim) {
      assetOwner = author;
      this.offers.set(newID, offerRecord(this.profile, this.now, author, owner));
    }
    this.emplaceAsset(assetOwner, { id: newID, owner: assetOwner, author, category, idata, mdata, container: [], containerf: [] }, author);
    this.emit({ type: 'spawn', kind: 'nft', assetid: newID, author, category, owner: assetOwner, idata });
    this.emit({ type: 'mdata', assetid: newID, mdata });
    if (requireclaim) this.emit({ type: 'offeropen', assetid: newID, owner: author, offeredto: owner });
    return newID;
  }

  // SA.cpp:218. The auth seam is subtle and ported exactly:
  //   authorized_account = has_auth(to) ? to : from            (receiver-pays RAM)
  //   a delegated asset may move ONLY to its lender (closing the delegation)
  //     or to its current borrower (a no-op handback), else refusal
  //   the return path accepts EITHER the lender's or the holder's signature
  //     — PORT NOTE (finding F-2): on the 'specimen' profile this lets the
  //     lender reclaim before the delegation period expires (undelegate's
  //     period check at SA.cpp:514 is not repeated here). The 'bnr-adapter'
  //     profile enforces the period when the lender pulls, while the
  //     borrower may still return at any time (the documented tenure).
  transfer(from, to, assetids, memo, signers) {
    from = name(from); to = name(to);
    this.check(from !== to, 'bt-wb002:self', 'cannot transfer to yourself');
    this.check(this.accounts.has(to), 'bt-wb002:account', 'TO account does not exist');
    this.check((memo || '').length <= MAX_MEMO, 'bt-wb002:memo', 'memo too large');
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    const authorized = this.hasAuth(signers, to) ? to : from;           // SA.cpp:233
    for (const id of assetids) {
      let delegating = false;
      const rec = this.delegates.get(id);
      if (rec) {
        if (rec.owner === to || rec.delegatedto === to) {
          delegating = true;
          if (rec.owner === to) {
            const holderReturns = this.hasAuth(signers, from);
            const lenderPulls = this.hasAuth(signers, rec.owner);
            if (this.profile === 'bnr-adapter' && lenderPulls && !holderReturns) {
              this.check(rec.cdate + rec.period < this.now, 'bt-wb002:tenure', 'bnr-adapter: the delegation period has not expired; the lender cannot pull back early');
            }
            this.delegates.delete(id);
            this.emit({ type: 'delegateclose', assetid: id });
          }
        } else {
          throw new Refusal('bt-wb002:delegated', `asset ${id} is delegated and cannot be transferred`);
        }
      }
      this.requireAuth(signers, delegating && this.hasAuth(signers, rec?.owner) ? rec.owner : from); // SA.cpp:261-265
      const row = this.findAsset(from, id);
      this.check(row.owner === from, 'bt-wb002:not-owner', `asset ${id} is not ${from}'s to transfer`);
      this.check(!this.offers.has(id), 'bt-wb002:offered', 'asset offered for claim; cancel the offer first');
      const payer = this.get_payer(row.author, row.category, id) || authorized;
      this.scope(from).delete(id);
      this.emplaceAsset(to, { ...row, owner: to }, payer);
      this.emit({ type: 'move', assetid: id, from, to, via: delegating ? 'delegation' : 'transfer' });
    }
  }

  claim(claimer, assetids, signers) {
    claimer = name(claimer);
    this.requireAuth(signers, claimer);                                  // SA.cpp:144
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    for (const id of assetids) {
      const offer = this.offers.get(id);
      if (!offer) throw new Refusal('bt-wb002:no-offer', `no offer for asset ${id}`);
      this.check(claimer === offer.offeredto, 'bt-wb002:not-offered-to', `asset ${id} was offered to ${offer.offeredto}`);
      if (this.profile === 'bnr-adapter') {
        this.check(offer.expiresAt === undefined || this.now < offer.expiresAt, 'bt-wb002:offer-expired', 'bnr-adapter: the offer has expired');
      }
      const row = this.findAsset(offer.owner, id);                       // SA.cpp:169
      this.check(offer.owner === row.owner, 'bt-wb002:owner-drift', 'offer owner and asset owner disagree');
      const payer = this.get_payer(row.author, row.category, id) || claimer;
      this.scope(offer.owner).delete(id);
      this.emplaceAsset(claimer, { ...row, owner: claimer }, payer);
      this.offers.delete(id);
      this.emit({ type: 'move', assetid: id, from: offer.owner, to: claimer, via: 'claim' });
      this.emit({ type: 'offerclose', assetid: id, reason: 'claim' });
    }
  }

  offer(owner, newowner, assetids, memo, signers) {
    owner = name(owner); newowner = name(newowner);
    this.check(owner !== newowner, 'bt-wb002:self', 'cannot offer to yourself');
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    this.requireAuth(signers, owner);                                   // SA.cpp:340
    this.check(this.accounts.has(newowner), 'bt-wb002:account', 'newowner account does not exist');
    for (const id of assetids) {
      this.findAsset(owner, id);
      this.check(!this.offers.has(id), 'bt-wb002:offered', `asset ${id} is already offered`);
      this.check(!this.delegates.has(id), 'bt-wb002:delegated', `asset ${id} is delegated`);
      this.offers.set(id, offerRecord(this.profile, this.now, owner, newowner));
      this.emit({ type: 'offeropen', assetid: id, owner, offeredto: newowner });
    }
  }

  canceloffer(owner, assetids, signers) {
    this.requireAuth(signers, owner);
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    for (const id of assetids) {
      const offer = this.offers.get(id);
      if (!offer) throw new Refusal('bt-wb002:no-offer', `no offer for asset ${id}`);
      this.check(offer.owner === owner, 'bt-wb002:not-owner', 'not your offer to cancel');
      this.offers.delete(id);
      this.emit({ type: 'offerclose', assetid: id, reason: 'cancel' });
    }
  }

  update(author, owner, assetid, mdata, signers) {
    this.requireAuth(signers, author);                                  // SA.cpp:324
    const row = this.findAsset(owner, assetid);
    this.check(row.author === author, 'bt-wb002:not-author', 'only the author may update mdata');
    row.mdata = mdata;                                                  // idata is never touched — SA.cpp has no such path
    this.emit({ type: 'mdata', assetid, mdata });
  }

  // SA.cpp:439. Writes the delegation record FIRST, then transfers into
  // the borrower's scope; the delegates table remembers the true lender.
  delegate(owner, to, assetids, period, redelegate, memo, signers) {
    owner = name(owner); to = name(to);
    this.check(owner !== to, 'bt-wb002:self', 'cannot delegate to yourself');
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    this.requireAuth(signers, owner);
    this.check(this.accounts.has(to), 'bt-wb002:account', 'TO account does not exist');
    for (const id of assetids) {
      this.findAsset(owner, id);
      this.check(!this.offers.has(id), 'bt-wb002:offered', 'asset has an open offer');
      const existing = this.delegates.get(id);
      if (existing) {
        this.check(existing.redelegate, 'bt-wb002:no-redelegate', 'terms of delegation forbid re-delegation');
        this.check(existing.owner !== to, 'bt-wb002:redelegate-owner', 'not allowed to re-delegate to the original owner');
        existing.delegatedto = to;
        existing.redelegate = redelegate;
      } else {
        this.delegates.set(id, { owner, delegatedto: to, cdate: this.now, period, redelegate, memo });
        this.emit({ type: 'delegateopen', assetid: id, owner, delegatedto: to, period });
      }
    }
    this.transfer(owner, to, assetids, `Delegate memo: ${memo}`, signers); // SA.cpp:477
  }

  delegatemore(owner, assetidc, period, signers) {
    this.requireAuth(signers, owner);
    const rec = this.delegates.get(assetidc);
    if (!rec) throw new Refusal('bt-wb002:no-delegate', `asset ${assetidc} is not delegated`);
    this.check(rec.owner === owner, 'bt-wb002:not-owner', 'not your delegation to extend');
    rec.period += period;
  }

  // SA.cpp:493. The lender reclaims — only after cdate+period expires.
  undelegate(owner, assetids, signers) {
    this.requireAuth(signers, owner);
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    const first = this.delegates.get(assetids[0]);
    if (!first) throw new Refusal('bt-wb02:no-delegate', 'asset is not delegated');
    const from = first.delegatedto;
    for (const id of assetids) {
      const rec = this.delegates.get(id);
      if (!rec) throw new Refusal('bt-wb02:no-delegate', 'asset is not delegated');
      this.check(rec.owner === owner, 'bt-wb002:not-owner', 'not your delegation');
      this.check(rec.delegatedto === from, 'bt-wb002:mixed', 'all undelegations must share one borrower');
      const row = this.findAsset(from, id);
      this.check(row.owner === rec.delegatedto, 'bt-wb002:owner-drift', 'holder does not match delegatedto');
      this.check(rec.cdate + rec.period < this.now, 'bt-wb002:period', 'cannot undelegate until the PERIOD expires'); // SA.cpp:514
    }
    this.transfer(from, owner, assetids, 'undelegate', signers); // the return path erases the record
  }

  // SA.cpp:527 — PORT NOTE (finding F-3): attach requires the AUTHOR's
  // signature, not the sovereign's. The sovereign's assets can be locked
  // into a container without their consent, and only detach (also
  // author-gated) frees them. 'bnr-adapter' requires the sovereign's
  // signature instead: composition belongs to the sovereign.
  attach(owner, assetidc, assetids, signers) {
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    this.check(!this.delegates.has(assetidc), 'bt-wb002:delegated', 'container is delegated');
    const parent = this.findAsset(owner, assetidc);
    if (this.profile === 'bnr-adapter') {
      this.requireAuth(signers, this.sovereignOf(assetidc));
    } else {
      this.requireAuth(signers, parent.author);                          // SA.cpp:537
    }
    for (const id of assetids) {
      const child = this.findAsset(owner, id);
      this.check(assetidc !== id, 'bt-wb002:self', 'cannot attach to self');
      this.check(child.author === parent.author, 'bt-wb002:authors', 'all assets must share one author');
      this.check(!this.delegates.has(id), 'bt-wb002:delegated', 'cannot attach a delegated asset');
      this.check(!this.offers.has(id), 'bt-wb002:offered', 'cannot attach an offered asset');
      parent.container.push(child);
      this.scope(owner).delete(id);
      this.emit({ type: 'attach', parent: assetidc, assetid: id, holder: owner });
    }
  }

  detach(owner, assetidc, assetids, signers) {
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    const parent = this.findAsset(owner, assetidc);
    this.check(!this.delegates.has(assetidc), 'bt-wb002:delegated', 'container is delegated');
    if (this.profile === 'bnr-adapter') {
      this.requireAuth(signers, this.sovereignOf(assetidc));
    } else {
      this.requireAuth(signers, parent.author);                          // SA.cpp:568
    }
    for (const id of assetids) {
      const kept = [];
      let found = false;
      for (const c of parent.container) {
        if (c.id === id) {
          found = true;
          this.emplaceAsset(owner, { ...c, container: c.container || [], containerf: c.containerf || [] }, parent.author);
          this.emit({ type: 'detach', parent: assetidc, assetid: id, holder: owner });
        } else kept.push(c);
      }
      this.check(found, 'bt-wb002:not-attached', `asset ${id} is not attached to ${assetidc}`);
      parent.container = kept;
    }
  }

  burn(owner, assetids, signers) {
    this.requireAuth(signers, owner);                                   // SA.cpp:380
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    for (const id of assetids) {
      const row = this.findAsset(owner, id);
      this.check(row.container.length === 0, 'bt-wb002:contains', 'detach NFT children before burning');
      this.check(row.containerf.length === 0, 'bt-wb002:contains-f', 'detach FT value before burning');
      this.check(row.owner === owner, 'bt-wb002:not-owner', 'not yours to burn');
      this.check(!this.offers.has(id), 'bt-wb002:offered', 'asset has an open offer');
      this.check(!this.delegates.has(id), 'bt-wb002:delegated', 'asset is delegated');
      this.scope(owner).delete(id);
      this.emit({ type: 'burn', assetid: id, owner });
    }
  }

  // SA.cpp:12 — finding F-8 (adapter co-sign): the author field says who
  // may rewrite mdata (the mutable status pointer). Upstream moves it on
  // the author's signature alone; 'bnr-adapter' also demands the
  // sovereign's co-signature — an authority envelope does not travel
  // without its subject.
  changeauthor(author, newauthor, owner, assetids, memo, signers) {
    newauthor = name(newauthor);
    this.requireAuth(signers, author);                                  // SA.cpp:14
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    if (this.profile === 'bnr-adapter') this.requireAuth(signers, owner);
    for (const id of assetids) {
      const row = this.findAsset(owner, id);
      this.check(!this.offers.has(id), 'bt-wb002:offered', 'asset is offered');
      this.check(!this.delegates.has(id), 'bt-wb002:delegated', 'asset is delegated');
      this.check(row.author === author, 'bt-wb002:not-author', 'only the current author may change author');
      this.check(row.container.length === 0 && row.containerf.length === 0, 'bt-wb002:contains', 'asset holds attached items');
      for (const r of this.arampayers) {
        this.check(!(r.author === newauthor && r.category === row.category && r.usearam), 'bt-wb02:arampayer', 'new author sponsors RAM for this category'); // SA.cpp:36
      }
      row.author = newauthor;
      this.emit({ type: 'chauthor', assetid: id, newauthor, owner });
    }
  }

  setarampayer(author, category, usearam, signers) {
    author = name(author); category = name(category);
    this.requireAuth(signers, author);                                  // SA.cpp:1147
    const hit = this.arampayers.find((r) => r.author === author && r.category === category);
    if (hit) { hit.usearam = usearam; hit.from_id = this.lnftid; }
    else this.arampayers.push({ id: ++this.defid, author, category, usearam, from_id: this.lnftid });
  }

  // --- NTT (non-transferable) — SA.cpp:967-1090 ----------------------------
  createntt(author, category, owner, idata, mdata, requireclaim, signers) {
    author = name(author); category = name(category); owner = name(owner);
    this.requireAuth(signers, author);
    this.check(this.accounts.has(owner), 'bt-wb002:account', 'owner account does not exist');
    this.check(!(author === owner && requireclaim), 'bt-wb02:claim-self', "can't requireclaim if author == owner");
    const newID = this.getid();
    let assetOwner = owner;
    if (requireclaim) {
      assetOwner = author;
      this.nttOffers.set(newID, offerRecord(this.profile, this.now, author, owner));
    }
    this.scope(assetOwner, true).set(newID, { id: newID, owner: assetOwner, author, category, idata, mdata });
    this.emit({ type: 'spawn', kind: 'ntt', assetid: newID, author, category, owner: assetOwner, idata });
    this.emit({ type: 'mdata', assetid: newID, mdata });
    if (requireclaim) this.emit({ type: 'offeropen', assetid: newID, owner: author, offeredto: owner });
    return newID;
  }
  claimntt(claimer, assetids, signers) {
    claimer = name(claimer);
    this.requireAuth(signers, claimer);
    this.check(assetids.length > 0, 'bt-wb002:empty', 'empty assetids');
    for (const id of assetids) {
      const offer = this.nttOffers.get(id);
      if (!offer) throw new Refusal('bt-wb02:no-offer', `no NTT offer for ${id}`);
      this.check(claimer === offer.offeredto, 'bt-wb002:not-offered-to', 'not offered to you');
      if (this.profile === 'bnr-adapter') {
        this.check(offer.expiresAt === undefined || this.now < offer.expiresAt, 'bt-wb002:offer-expired', 'bnr-adapter: the offer has expired');
      }
      const row = this.scope(offer.owner, true).get(id);
      if (!row) throw new Refusal('bt-wb02:not-found', 'NTT not found at offer scope');
      this.check(offer.owner === row.owner, 'bt-wb002:owner-drift', 'offer owner and NTT owner disagree');
      this.scope(offer.owner, true).delete(id);
      this.scope(claimer, true).set(id, { ...row, owner: claimer });
      this.nttOffers.delete(id);
      this.emit({ type: 'move', assetid: id, from: offer.owner, to: claimer, via: 'claim' });
    }
  }
  updatentt(author, owner, assetid, mdata, signers) {
    this.requireAuth(signers, author);                                  // SA.cpp:1008
    const row = this.scope(owner, true).get(assetid);
    if (!row) throw new Refusal('bt-wb02:not-found', 'NTT not found');
    this.check(row.author === author, 'bt-wb002:not-author', 'only the author may update NTT mdata');
    row.mdata = mdata;
    this.emit({ type: 'mdata', assetid, mdata });
  }
  burnntt(owner, assetids, signers) {
    this.requireAuth(signers, owner);                                   // SA.cpp:1065
    for (const id of assetids) {
      const row = this.scope(owner, true).get(id);
      if (!row) throw new Refusal('bt-wb02:not-found', 'NTT not found');
      const offer = this.nttOffers.get(id);
      if (offer) {
        this.check(offer.owner === owner, 'bt-wb002:not-owner', 'offer owner mismatch');
        this.nttOffers.delete(id);
      }
      this.scope(owner, true).delete(id);
      this.emit({ type: 'burn', assetid: id, owner });
    }
  }

  // --- fungible — SA.cpp:612-799 -------------------------------------------
  createf(author, maximum, symbol, authorctrl, data, signers) {
    author = name(author);
    this.requireAuth(signers, author);                                  // SA.cpp:614
    this.check(typeof maximum === 'bigint' && maximum > 0n, 'bt-wb002:supply', 'max-supply must be positive');
    if (this.profile === 'bnr-adapter') {
      // Founder ruling 2026-10-07: for sovereign funds the issuer's
      // authority must never equal confiscation authority. The specimen
      // keeps the flag (as an adversarial vector); the adapter refuses it.
      this.check(authorctrl === false, 'bt-wb02:adapter-authorctrl', 'bnr-adapter: authorctrl FTs are refused — issuer authority is not confiscation authority');
    }
    const key = `${author}:${symbol}`;
    this.check(!this.stats.has(key), 'bt-wb002:symbol', 'token with symbol already exists');
    const id = this.getid();                                            // SA.cpp:627
    this.stats.set(key, { supply: 0n, max: maximum, issuer: author, id, authorctrl, data, symbol });
    this.emit({ type: 'ftcreate', author, symbol, ftid: id, authorctrl, max: maximum });
    return id;
  }
  stat(author, symbol) {
    const st = this.stats.get(`${name(author)}:${symbol}`);
    if (!st) throw new Refusal('bt-wb02:no-token', `token ${symbol} of ${author} does not exist`);
    return st;
  }
  bal(owner, ftid) { return this.balances.get(owner)?.get(ftid)?.amount ?? 0n; }
  addBal(owner, st, amount) {
    if (!this.balances.has(owner)) this.balances.set(owner, new Map());
    const m = this.balances.get(owner);
    const cur = m.get(st.id) ?? { sym: st.symbol, amount: 0n };
    cur.amount += amount;
    m.set(st.id, cur);
  }
  subBal(owner, st, amount) {
    const cur = this.balances.get(owner)?.get(st.id);
    this.check(cur && cur.amount >= amount, 'bt-wb002:overdrawn', 'overdrawn balance');
    cur.amount -= amount;
  }
  issuef(to, author, quantity, memo, signers) {
    to = name(to);
    const st = this.stat(author, quantity.symbol);
    this.requireAuth(signers, st.issuer);                               // SA.cpp:655
    this.check(quantity.amount > 0n, 'bt-wb02:quantity', 'must issue positive quantity');
    this.check(st.supply + quantity.amount <= st.max, 'bt-wb02:max-supply', 'quantity exceeds available supply');
    st.supply += quantity.amount;
    this.addBal(st.issuer, st, quantity.amount);
    this.emit({ type: 'ftissue', ftid: st.id, to: st.issuer, amount: quantity.amount, symbol: st.symbol });
    if (to !== st.issuer) this.transferf(st.issuer, to, author, quantity, memo, signers);
  }
  // SA.cpp:673 — the F-1 seam, ported exactly: with authorctrl=true the
  // issuer's signature alone moves or destroys ANY holder's balance. The
  // adapter profile refuses that path unconditionally — including for
  // authorctrl tokens migrated in from specimen chains.
  transferf(from, to, author, quantity, memo, signers) {
    from = name(from); to = name(to);
    this.check(from !== to, 'bt-wb02:self', 'cannot transfer to self');
    this.check(this.accounts.has(to), 'bt-wb02:account', 'to account does not exist');
    const st = this.stat(author, quantity.symbol);
    this.check(quantity.amount > 0n, 'bt-wb02:quantity', 'must transfer positive quantity');
    let checkAuth = from;                                               // SA.cpp:690 — the holder always authorizes
    if (st.authorctrl && this.hasAuth(signers, st.issuer)) {
      checkAuth = st.issuer;                                            // SA.cpp:692-695 — the confiscation path
    }
    if (this.profile === 'bnr-adapter' && st.authorctrl && checkAuth === st.issuer && !this.hasAuth(signers, from)) {
      throw new Refusal('bt-wb02:adapter-authorctrl-move', 'bnr-adapter: an issuer signature never moves a holder balance');
    }
    this.requireAuth(signers, checkAuth);
    this.subBal(from, st, quantity.amount);
    this.addBal(to, st, quantity.amount);
    this.emit({ type: 'ftmove', ftid: st.id, from, to, amount: quantity.amount, symbol: st.symbol });
  }
  burnf(from, author, quantity, memo, signers) {
    const st = this.stat(author, quantity.symbol);
    const issuerPath = st.authorctrl && this.hasAuth(signers, st.issuer);
    if (this.profile === 'bnr-adapter' && issuerPath && !this.hasAuth(signers, from)) {
      throw new Refusal('bt-wb02:adapter-authorctrl-move', 'bnr-adapter: an issuer signature never burns a holder balance');
    }
    this.requireAuth(signers, issuerPath ? st.issuer : from);           // SA.cpp:787
    this.check(quantity.amount > 0n, 'bt-wb02:quantity', 'must retire positive quantity');
    st.supply -= quantity.amount;
    this.subBal(from, st, quantity.amount);
    this.emit({ type: 'ftburn', ftid: st.id, from, amount: quantity.amount, symbol: st.symbol });
  }
  offerf(owner, newowner, author, quantity, memo, signers) {
    owner = name(owner); newowner = name(newowner);
    this.requireAuth(signers, owner);                                   // SA.cpp:704
    this.check(this.accounts.has(newowner), 'bt-wb02:account', 'newowner does not exist');
    this.check(owner !== newowner, 'bt-wb02:self', 'cannot offer to yourself');
    const st = this.stat(author, quantity.symbol);
    this.check(quantity.amount > 0n, 'bt-wb02:quantity', 'must offer positive quantity');
    // merge with an existing (owner, author, offeredto, symbol) offer — SA.cpp:721
    for (const [id, o] of this.ftOffers) {
      if (o.owner === owner && o.author === author && o.offeredto === newowner && o.sym === st.symbol) {
        o.amount += quantity.amount;
        this.subBal(owner, st, quantity.amount);
        this.emit({ type: 'ftofferopen', offerid: id, ftid: st.id, owner, offeredto: newowner, amount: o.amount, symbol: st.symbol, merged: true });
        return;
      }
    }
    const id = ++this.defid;
    this.ftOffers.set(id, { author, owner, offeredto: newowner, amount: quantity.amount, sym: st.symbol, ftid: st.id, cdate: this.now });
    this.subBal(owner, st, quantity.amount);
    this.emit({ type: 'ftofferopen', offerid: id, ftid: st.id, owner, offeredto: newowner, amount: quantity.amount, symbol: st.symbol });
  }
  cancelofferf(owner, ftofferids, signers) {
    this.requireAuth(signers, owner);                                   // SA.cpp:747
    this.check(ftofferids.length > 0, 'bt-wb002:empty', 'empty ftofferids');
    for (const id of ftofferids) {
      const o = this.ftOffers.get(id);
      if (!o) throw new Refusal('bt-wb02:no-offer', 'offer not found');
      this.check(o.owner === owner, 'bt-wb002:not-owner', 'not your offer');
      const st = this.stat(o.author, o.sym);
      this.addBal(owner, st, o.amount);
      this.ftOffers.delete(id);
      this.emit({ type: 'ftofferkill', offerid: id, reason: 'cancel' });
    }
  }
  claimf(claimer, ftofferids, signers) {
    this.requireAuth(signers, claimer);                                 // SA.cpp:765
    this.check(ftofferids.length > 0, 'bt-wb002:empty', 'empty ftofferids');
    for (const id of ftofferids) {
      const o = this.ftOffers.get(id);
      if (!o) throw new Refusal('bt-wb02:no-offer', 'offer not found');
      this.check(claimer === o.offeredto, 'bt-wb002:not-offered-to', 'not offered to you');
      const st = this.stat(o.author, o.sym);
      this.addBal(claimer, st, o.amount);
      this.ftOffers.delete(id);
      this.emit({ type: 'ftmove', ftid: st.id, from: o.owner, to: claimer, amount: o.amount, symbol: st.symbol });
      this.emit({ type: 'ftofferkill', offerid: id, reason: 'claim' });
    }
  }
  attachf(owner, author, quantity, assetidc, signers) { this.attachdetach(owner, author, quantity, assetidc, true, signers); }
  detachf(owner, author, quantity, assetidc, signers) { this.attachdetach(owner, author, quantity, assetidc, false, signers); }
  attachdetach(owner, author, quantity, assetidc, attach, signers) {
    const st = this.stat(author, quantity.symbol);
    this.requireAuth(signers, author);                                  // SA.cpp:874
    if (this.profile === 'bnr-adapter') {
      // F-3's fungible twin: upstream lets the AUTHOR lock a holder's FT
      // value into a container on the author's signature alone. The
      // adapter demands the holder's signature too.
      this.requireAuth(signers, owner);
    }
    this.check(quantity.amount > 0n, 'bt-wb02:quantity', 'must be positive');
    this.check(st.issuer === author, 'bt-wb02:authors', 'FT issuer must be the signing author');
    const row = this.findAsset(owner, assetidc);
    this.check(row.author === author, 'bt-wb02:authors', 'asset author mismatch');
    this.check(!this.delegates.has(assetidc), 'bt-wb002:delegated', 'asset is delegated');
    this.check(!this.offers.has(assetidc), 'bt-wb002:offered', 'asset is offered');
    let found = false;
    const kept = [];
    for (const accf of row.containerf) {
      if (accf.id === st.id) {
        if (attach) accf.amount += quantity.amount;
        else {
          this.check(accf.amount >= quantity.amount, 'bt-wb02:overdrawn', 'overdrawn container balance');
          accf.amount -= quantity.amount;
        }
        found = true;
      }
      if (accf.amount > 0n) kept.push(accf);
    }
    if (!found && attach) kept.push({ id: st.id, amount: quantity.amount, sym: st.symbol });
    if (!attach) this.check(found, 'bt-wb02:not-attached', 'not attached');
    row.containerf = kept;
    if (attach) { this.subBal(owner, st, quantity.amount); this.emit({ type: 'ftattach', ftid: st.id, holder: owner, assetid: assetidc, amount: quantity.amount, symbol: st.symbol }); }
    else { this.addBal(owner, st, quantity.amount); this.emit({ type: 'ftdetach', ftid: st.id, holder: owner, assetid: assetidc, amount: quantity.amount, symbol: st.symbol }); }
  }

  // --- migration / continuity surface (WB002's own, not upstream) ----------
  // The anchored fold over the whole log: this is what an external
  // consumer, a successor contract, or a 3019 archivist reconstructs from.
  logRoot() { return this.log.length ? this.log[this.log.length - 1].root : this.genesis; }

  // Consensus anchors for display truth (model-hardening beat, founder
  // review 2026-10-07, finding R-2). The checkpoint anchor carries the
  // checkpoint's PARENT root so a verifier can recompute the checkpoint
  // root from its CONTENTS — a matching root string alone authenticates
  // nothing. The tip anchor brackets a stream's end; only it promotes a
  // post-checkpoint suffix to current ownership.
  checkpointAnchor() {
    const cp = this.log.filter((e) => e.type === 'checkpoint').at(-1);
    if (!cp) return null;
    const parentRoot = cp.seq > 0 ? this.log[cp.seq - 1].root : this.genesis;
    return { seq: cp.seq, root: cp.root, parentRoot };
  }
  tipAnchor() { return this.log.length ? { seq: this.log.length - 1, root: this.logRoot() } : null; }

  // A migration bundle is the sovereign state + its commitment. The
  // commitment is over the CANONICAL serialization only — no identity, no
  // heartbeat, no personal material rides in state (COMMIT owns that
  // boundary in BNR; here idata already models it as a bare commitment).
  serializeRow(row) {
    return {
      id: row.id, author: row.author, category: row.category, idata: row.idata, mdata: row.mdata,
      contains: row.container.map((c) => this.serializeRow(c)),
      containsF: row.containerf.map((f) => ({ id: f.id, amount: f.amount, sym: f.sym })),
    };
  }
  materializeRow(ser, holder) {
    return {
      id: ser.id, owner: holder, author: ser.author, category: ser.category, idata: ser.idata, mdata: ser.mdata,
      container: ser.contains.map((c) => this.materializeRow(c, holder)),
      containerf: ser.containsF.map((f) => ({ ...f })),
    };
  }
  exportState() {
    const assets = [];
    for (const [holder, rows] of this.scopes) {
      for (const row of rows.values()) assets.push({ kind: 'nft', holder, sovereign: this.sovereignOf(row.id), row: this.serializeRow(row) });
    }
    for (const [holder, rows] of this.nttScopes) {
      for (const row of rows.values()) assets.push({ kind: 'ntt', holder, sovereign: row.owner, row: { id: row.id, author: row.author, category: row.category, idata: row.idata, mdata: row.mdata, contains: [], containsF: [] } });
    }
    const fts = [];
    for (const [owner, m] of this.balances) for (const [ftid, b] of m) fts.push({ owner, ftid, amount: b.amount, sym: b.sym });
    const delegates = [...this.delegates.entries()].map(([assetid, d]) => ({ assetid, owner: d.owner, delegatedto: d.delegatedto, cdate: d.cdate, period: d.period, redelegate: d.redelegate }));
    return { assets, fts, delegates, logRoot: this.logRoot(), count: assets.length + fts.length };
  }
  stateCommitment(bundle) { return sha(canon({ assets: bundle.assets, fts: bundle.fts, delegates: bundle.delegates })); }

  // Import into THIS chain (the successor network). The anchor is the
  // commitment the predecessor chain published while alive; a tampered
  // bundle (one owner flipped) fails it. Continuity is then behavioral:
  // every imported sovereign exercises alone; nobody else does. FT stats
  // are NOT migrated by this call — the successor network's token
  // contracts must exist first (the battery creates them explicitly).
  importState(bundle, anchorCommitment) {
    if (this.stateCommitment(bundle) !== anchorCommitment) {
      throw new Refusal('bt-wb02:migration-anchor', 'bundle commitment does not match the predecessor anchor — refusing the migration');
    }
    for (const a of bundle.assets) {
      // rows land at their HOLDER; sovereignty of a delegated asset is
      // restored by the imported delegation records (the borrower keeps
      // possession, the lender keeps sovereignty — the bounded-authority
      // relationship itself migrates)
      if (a.kind === 'ntt') this.scope(a.holder, true).set(a.row.id, { id: a.row.id, owner: a.holder, author: a.row.author, category: a.row.category, idata: a.row.idata, mdata: a.row.mdata });
      else this.scope(a.holder).set(a.row.id, this.materializeRow(a.row, a.holder));
      this.emit({ type: 'spawn', kind: a.kind, assetid: a.row.id, author: a.row.author, category: a.row.category, owner: a.holder, idata: a.row.idata, migrated: true });
    }
    for (const d of bundle.delegates) this.delegates.set(d.assetid, { ...d });
    for (const f of bundle.fts) {
      const st = [...this.stats.values()].find((s) => s.id === f.ftid);
      if (st) this.addBal(f.owner, st, f.amount);
    }
  }
}

// ---------------------------------------------------------------------------
// reconstruct(events) — the archivist's fold. Sovereignty derived from the
// anchored log ALONE: spawn/move/burn/attach/detach/delegate events, with
// anchored 'checkpoint' events as full-state restarts (an archivist needs
// only the last surviving checkpoint plus everything after it). Must equal
// the live chain after every legal history; that equality is the
// consensus-truth leg of the truth lattice.
export function reconstruct(events) {
  const st = { owner: new Map(), ntt: new Map(), delegated: new Map() };
  const applyCheckpoint = (assets, deleg) => {
    st.owner = new Map(); st.ntt = new Map(); st.delegated = new Map(deleg.map(([assetid, lender]) => [assetid, lender]));
    for (const [id, sov, kind] of assets) (kind === 'ntt' ? st.ntt : st.owner).set(id, sov);
  };
  for (const ev of events) {
    switch (ev.type) {
      case 'checkpoint': applyCheckpoint(ev.assets, ev.deleg); break;
      case 'spawn': (ev.kind === 'ntt' ? st.ntt : st.owner).set(ev.assetid, ev.owner); break;
      case 'move':
        if (st.ntt.has(ev.assetid)) st.ntt.set(ev.assetid, ev.to);
        else st.owner.set(ev.assetid, ev.to);
        break;
      case 'burn': st.owner.delete(ev.assetid); st.ntt.delete(ev.assetid); st.delegated.delete(ev.assetid); break;
      case 'attach': st.owner.set(ev.assetid, { containerOf: ev.parent }); st.delegated.delete(ev.assetid); break; // sovereign follows the container
      case 'detach': st.owner.set(ev.assetid, ev.holder); break;
      case 'delegateopen': st.delegated.set(ev.assetid, ev.owner); break;
      case 'delegateclose': st.delegated.delete(ev.assetid); break;
      default: break; // offer/mdata/chauthor/ft-* events do not move NFT sovereignty
    }
  }
  const sovereign = (id) => {
    let cur = id; const seen = new Set();
    while (!seen.has(cur)) {
      seen.add(cur);
      const v = st.delegated.has(cur) ? st.delegated.get(cur) : st.ntt.has(cur) ? st.ntt.get(cur) : st.owner.get(cur);
      if (v === undefined || v === null) return null;
      if (typeof v === 'string') return v;
      cur = v.containerOf;
    }
    return null;
  };
  return { sovereign, folded: st };
}

// ---------------------------------------------------------------------------
// The truth lattice: consensus truth / indexer truth / UI truth / author
// assertion. The Indexer consumes the event stream with injectable faults
// (drop, replay, corrupt, lag). The AdapterUI refuses to answer DISPUTED
// when the indexer's stream breaks hash-chain continuity or disagrees with
// the latest consensus checkpoint; the SpecimenUI trusts the indexer
// blindly — the exact posture the field evidence (upstream issues #26,
// #19) describes.
export class Indexer {
  constructor() { this.events = []; }
  feed(events) { this.events = events.map((e) => structuredClone(e)); }
  drop(seq) { this.events = this.events.filter((e) => e.seq !== seq); }
  replay(seq) { const e = this.events.find((x) => x.seq === seq); if (e) this.events.push(structuredClone(e)); }
  corrupt(seq, patch) { const e = this.events.find((x) => x.seq === seq); if (e) Object.assign(e, patch); }
  lag(k) { this.events = this.events.slice(0, k); }
  // A stream is consistent when seqs are contiguous and every verifiable
  // hash link holds. The FIRST event's link can only be verified when it
  // is seq 0 (its predecessor is the public genesis); a stream starting
  // mid-log begins from an assumed root, so its first event is trusted
  // only provisionally — the AdapterUI's checkpoint comparison is what
  // anchors such a stream (or convicts it).
  chainConsistent() {
    let prevSeq = null;
    let prevRoot = null;
    for (const e of this.events) {
      if (prevSeq !== null && e.seq !== prevSeq + 1) return false;      // gap or replay
      const { root, seq, ...fields } = e;
      if (prevRoot !== null) {
        if (root !== sha(`${prevRoot}|${canon({ seq, ...fields })}`)) return false;
      } else if (seq === 0) {
        if (root !== sha(`${sha('bT-WB02:genesis')}|${canon({ seq, ...fields })}`)) return false;
      }
      prevSeq = seq; prevRoot = root;
    }
    return true;
  }
  fold() { return reconstruct(this.events); }
}

export class SpecimenUI {
  constructor(indexer) { this.indexer = indexer; }
  // Upstream-era posture: the indexer's word IS the displayed owner.
  displayOwner(id) { return this.indexer.fold().sovereign(id); }
}

export class AdapterUI {
  // checkpoint: {seq, root, parentRoot} from Chain.checkpointAnchor() —
  //             consensus-trusted AND content-authenticating.
  // tip (optional): {seq, root} from Chain.tipAnchor() — brackets the
  //             authenticated end of a stream.
  constructor(indexer, checkpoint, tip) { this.indexer = indexer; this.checkpoint = checkpoint; this.tip = tip ?? null; }

  // display(id) -> { owner, asOfSeq, scope } where scope is one of:
  //   'authenticated-tip'  — the stream is bracketed cp..tip by trusted
  //                          roots with every link verified: current truth
  //   'checkpoint-scoped'  — the checkpoint contents are authenticated and
  //                          every link after it verifies, but no trusted
  //                          tip brackets the suffix: the truth AS OF the
  //                          checkpoint, at its explicit height; an
  //                          arbitrary (possibly fabricated) suffix is
  //                          never promoted to current ownership
  //   'disputed'           — owner 'DISPUTED': authentication failed
  display(id) {
    const disputed = { owner: 'DISPUTED', asOfSeq: null, scope: 'disputed' };
    const cp = this.checkpoint;
    if (!cp || typeof cp.parentRoot !== 'string' || typeof cp.root !== 'string' || typeof cp.seq !== 'number') return disputed;
    const ev = this.indexer.events.find((e) => e.seq === cp.seq);
    if (!ev) return disputed;
    // OBLIGATION A — authenticate the checkpoint CONTENTS: recompute the
    // root from the event body over the trusted parent root. A
    // substituted body hiding behind a genuine root string dies here.
    const { root, ...fields } = ev;
    if (sha(`${cp.parentRoot}|${canon(fields)}`) !== root || root !== cp.root) return disputed;
    // every link AFTER the checkpoint must verify (contiguity + content)
    let prevSeq = ev.seq;
    let prevRoot = root;
    for (const e of this.indexer.events) {
      if (e.seq <= ev.seq) continue;
      if (e.seq !== prevSeq + 1) return disputed;
      const { root: r, ...f } = e;
      if (sha(`${prevRoot}|${canon(f)}`) !== r) return disputed;
      prevSeq = e.seq; prevRoot = r;
    }
    // OBLIGATION B — bound the displayed state to an authenticated
    // history. Links prove self-consistency, not consensus acceptance:
    // a fabricated suffix recomputes perfectly. Only a trusted tip that
    // brackets the stream's exact end promotes the suffix; otherwise the
    // answer is checkpoint-scoped, never the suffix's fold.
    const atTip = this.tip && prevSeq === this.tip.seq && prevRoot === this.tip.root;
    if (atTip) {
      return { owner: reconstruct(this.indexer.events).sovereign(id), asOfSeq: this.tip.seq, scope: 'authenticated-tip' };
    }
    const uptoCp = this.indexer.events.filter((e) => e.seq <= ev.seq);
    return { owner: reconstruct(uptoCp).sovereign(id), asOfSeq: ev.seq, scope: 'checkpoint-scoped' };
  }
  displayOwner(id) { return this.display(id).owner; }
}

// ---------------------------------------------------------------------------
// The continuity predicate — THE killer invariant, executable. Given the
// sovereign map before and after one action, every sovereignty change must
// be explained by an authorized sovereign action of the PREVIOUS sovereign
// (direct signature, or their standing consent: an offer they signed into
// existence). Returns the list of UNEXPLAINED changes; empty == invariant
// holds for this step.
export function unexplained(before, after, signers, pendingConsent) {
  const bad = [];
  const ids = new Set([...before.keys(), ...after.keys()]);
  for (const id of ids) {
    const b = before.get(id) ?? null;
    const a = after.get(id) ?? null;
    if (b === a) continue;
    // destruction is sovereign-authorized via burn (signers checked there);
    // creation is issuance, not transfer; both are legal transitions.
    if (b === null || a === null) continue;
    const consentedByOwner = pendingConsent?.has(id) && pendingConsent.get(id) === b;
    if (!signers.includes(b) && !consentedByOwner) bad.push({ id, from: b, to: a });
  }
  return bad;
}

// snapshot of every asset's sovereign on a chain (the invariant's subject)
export function sovereignSnapshot(chain) {
  const snap = new Map();
  for (const rows of chain.scopes.values()) for (const row of rows.values()) snap.set(row.id, chain.sovereignOf(row.id));
  for (const rows of chain.nttScopes.values()) for (const row of rows.values()) snap.set(row.id, chain.sovereignOf(row.id));
  return snap;
}

// FT twin of the same predicate: a balance moves only under its holder's
// signature or a standing FT offer they signed.
export function ftSnapshot(chain) {
  const snap = new Map();
  for (const [owner, m] of chain.balances) for (const [ftid, b] of m) snap.set(`${owner}:${ftid}`, b.amount);
  return snap;
}
export function ftUnexplained(before, after, signers, ftConsent) {
  const bad = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const b = before.get(key) ?? 0n;
    const a = after.get(key) ?? 0n;
    if (b === a) continue;
    if (a > b) continue; // receipt of funds is never a taking
    const [holder] = key.split(':');
    const consent = ftConsent?.get(key);
    if (!signers.includes(holder) && consent !== holder) bad.push({ key, from: b, to: a });
  }
  return bad;
}

// EXCLUDED SURFACE (named, per the port's honesty clause): authorreg /
// authorupdate (display metadata only), md* more-data tables, updatever,
// the *log notification actions (their payload rides this model's own
// anchored event log instead), the backtoken cross-contract call in burn
// (SA.cpp:396), the IMPOSSIBLE_ID scope-warming dance (a RAM artifact),
// and getid's md_id/defid split (single counter here). None of them move
// sovereignty; the battery's invariant would notice if one did.
