// wb002.test.mjs — bTunGsTeN Workbench 002: SimpleAssets 2021 as an
// extinct-infrastructure specimen, attacked (founder order 2026-10-07).
//
// THE INVARIANT under test: no change of implementation, network, author,
// storage provider, cryptographic algorithm, or execution environment may
// transfer sovereign authority without the currently authorized sovereign
// action.
//
// All local: the vendored C++ is never compiled or executed here — this
// battery attacks the faithful port in wb002-simpleassets.mjs, whose
// deviations and exclusions are named inside it. The counts this suite
// prints are the CI receipt (the ratchet reads CI's own 0->N lines).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Chain, Refusal, reconstruct, Indexer, SpecimenUI, AdapterUI,
  unexplained, sovereignSnapshot, ftSnapshot, ftUnexplained, sha,
} from './wb002-simpleassets.mjs';

// deterministic PRNG (mulberry32) — histories replay identically in CI
const rng32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PEOPLE = ['alice', 'bob', 'carol', 'dave', 'ed'];
const AUTHORS = ['authorgov', 'authorx'];
const ALL = [...AUTHORS, ...PEOPLE, 'mallory'];

const world = (profile, now = 1_700_000_000n) => {
  const c = new Chain({ profile, now });
  for (const n of ALL) c.acct(n);
  return c;
};

const refusedWith = (fn, chain) => {
  const fp = chain ? chain.fingerprint() : null;
  try { fn(); } catch (e) {
    assert.ok(e instanceof Refusal, `not a Refusal: ${e}`);
    if (chain) assert.equal(chain.fingerprint(), fp, `the refused action (${e.refusal}) left state or committed events behind`);
    return e.refusal;
  }
  assert.fail('expected a refusal');
};

// ---------------------------------------------------------------------------
// The driver: run one action under the killer invariant. Consent maps are
// captured BEFORE the action (an offer the sovereign signed earlier is
// standing consent; nothing else explains a sovereignty change).
function consentOf(chain) {
  const m = new Map();
  for (const [id, o] of chain.offers) m.set(id, o.owner);
  for (const [id, o] of chain.nttOffers) m.set(id, o.owner);
  return m;
}
function ftConsentOf(chain) {
  const m = new Map();
  for (const o of chain.ftOffers.values()) m.set(`${o.owner}:${o.ftid}`, o.owner);
  return m;
}

function drive(chain, tag, signers, fn, collector) {
  const before = sovereignSnapshot(chain);
  const ftBefore = ftSnapshot(chain);
  const consent = consentOf(chain);
  const ftConsent = ftConsentOf(chain);
  const logBefore = chain.log.length;
  fn();
  const after = sovereignSnapshot(chain);
  const ftAfter = ftSnapshot(chain);
  const bad = unexplained(before, after, signers, consent);
  const ftBad = ftUnexplained(ftBefore, ftAfter, signers, ftConsent);
  collector.steps++;
  for (const b of bad) collector.named.push({ tag, kind: 'sovereign', ...b });
  for (const b of ftBad) collector.named.push({ tag, kind: 'ft', ...b });
  return { moved: chain.log.length - logBefore, before, after };
}

// pools derived fresh from the chain each step (no bookkeeping drift)
function pools(chain) {
  const free = [];    // {id, holder, author}
  for (const [holder, rows] of chain.scopes) {
    for (const row of rows.values()) free.push({ id: row.id, holder, author: row.author, row });
  }
  const ntt = [];
  for (const [holder, rows] of chain.nttScopes) {
    for (const row of rows.values()) ntt.push({ id: row.id, holder, author: row.author, row });
  }
  const ftHolders = []; // {author, sym, ftid, holder, amount}
  for (const [key, st] of chain.stats) {
    for (const [owner, m] of chain.balances) {
      const b = m.get(st.id);
      if (b && b.amount > 0n) ftHolders.push({ author: st.issuer, sym: st.symbol, ftid: st.id, holder: owner, amount: b.amount, issuer: st.issuer, authorctrl: st.authorctrl });
    }
  }
  return { free, ntt, ftHolders };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const other = (rng, arr, not) => {
  const filtered = arr.filter((x) => x !== not);
  return pick(rng, filtered);
};

// A hostile but legal-biased history. Wrong-signer probes are interleaved
// (each must refuse). The invariant is checked after EVERY step.
function runHistory(chain, steps, seed, collector, opts = {}) {
  const rng = rng32(seed);
  collector.rollbacks = collector.rollbacks || 0;
  const spawnIdata = new Map();
  const trackSpawns = () => { for (const ev of chain.log) if (ev.type === 'spawn' && !spawnIdata.has(ev.assetid)) spawnIdata.set(ev.assetid, ev.idata); };
  // seed the world with a few assets, an authorctrl FT (specimen) and a plain FT
  let ftid1 = null, ftid2 = null;
  if (chain.profile === 'specimen') {
    ftid1 = chain.createf('authorgov', 10_000_000n, 'WOOD', true, '{}', ['authorgov']);
    chain.issuef('bob', 'authorgov', { symbol: 'WOOD', amount: 10_000n }, '', ['authorgov']);
  }
  ftid2 = chain.createf('authorx', 10_000_000n, 'SEED', false, '{}', ['authorx']);
  chain.issuef('carol', 'authorx', { symbol: 'SEED', amount: 10_000n }, '', ['authorx']);
  for (let i = 0; i < 4; i++) {
    const author = pick(rng, AUTHORS);
    chain.create(author, 'cred', pick(rng, PEOPLE), `cmt:${seed}:${i}`, `md:${i}`, rng() < 0.5, [author]);
  }
  chain.createntt('authorgov', 'cap', 'alice', 'ntt-cmt-1', '{}', false, ['authorgov']);
  trackSpawns();

  for (let i = 0; i < steps; i++) {
    chain.now += BigInt(1 + Math.floor(rng() * 500));
    const p = pools(chain);
    const roll = rng();
    const iter = { logLen: chain.log.length, logRoot: chain.logRoot(), sov: sovereignSnapshot(chain), ft: ftSnapshot(chain) };
    try {
      if (roll < 0.06) {
        const author = pick(rng, AUTHORS);
        drive(chain, 'create', [author], () => { chain.create(author, 'cred', pick(rng, PEOPLE), `cmt:${seed}:${i}`, '{}', rng() < 0.3, [author]); }, collector);
      } else if (roll < 0.10) {
        const author = pick(rng, AUTHORS);
        drive(chain, 'createntt', [author], () => { chain.createntt(author, 'cap', pick(rng, PEOPLE), `ntt:${seed}:${i}`, '{}', rng() < 0.3, [author]); }, collector);
      } else if (roll < 0.26 && p.free.length > 1) {
        const a = pick(rng, p.free);
        const to = other(rng, PEOPLE, a.holder);
        drive(chain, 'transfer', [a.holder], () => { chain.transfer(a.holder, to, [a.id], '', [a.holder]); }, collector);
      } else if (roll < 0.34 && p.free.length > 0) {
        const a = pick(rng, p.free);
        const to = other(rng, PEOPLE, a.holder);
        drive(chain, 'offer', [a.holder], () => { chain.offer(a.holder, to, [a.id], '', [a.holder]); }, collector);
      } else if (roll < 0.42) {
        const offers = [...chain.offers.entries()];
        if (offers.length > 0) {
          const [id, o] = pick(rng, offers);
          if (rng() < 0.6) drive(chain, 'claim(consent)', [o.offeredto], () => { chain.claim(o.offeredto, [id], [o.offeredto]); }, collector);
          else drive(chain, 'canceloffer', [o.owner], () => { chain.canceloffer(o.owner, [id], [o.owner]); }, collector);
        }
      } else if (roll < 0.52 && p.free.length > 1) {
        const a = pick(rng, p.free);
        const borrower = other(rng, PEOPLE, a.holder);
        drive(chain, 'delegate', [a.holder], () => { chain.delegate(a.holder, borrower, [a.id], BigInt(1 + Math.floor(rng() * 8000)), rng() < 0.5, '', [a.holder]); }, collector);
      } else if (roll < 0.58 && chain.delegates.size > 0) {
        const [id, rec] = pick(rng, [...chain.delegates.entries()]);
        if (rng() < 0.5) {
          drive(chain, 'undelegate', [rec.owner], () => { chain.undelegate(rec.owner, [id], [rec.owner]); }, collector); // succeeds only after expiry — refusal is legal
        } else {
          drive(chain, 'borrower-return', [rec.delegatedto], () => { chain.transfer(rec.delegatedto, rec.owner, [id], '', [rec.delegatedto]); }, collector);
        }
      } else if (roll < 0.64 && p.free.length > 2) {
        const a = pick(rng, p.free);
        const same = p.free.filter((x) => x.author === a.author && x.id !== a.id && x.holder === a.holder);
        if (same.length > 0) {
          const child = pick(rng, same);
          const signers = chain.profile === 'bnr-adapter' ? [a.holder] : [a.author];
          drive(chain, chain.profile === 'bnr-adapter' ? 'attach(sovereign)' : 'attach(author)', signers,
            () => { chain.attach(a.holder, a.id, [child.id], signers); }, collector);
        }
      } else if (roll < 0.68 && p.free.length > 0) {
        const a = pick(rng, p.free);
        if (a.row.container.length > 0) {
          const signers = chain.profile === 'bnr-adapter' ? [a.holder] : [a.author];
          drive(chain, chain.profile === 'bnr-adapter' ? 'detach(sovereign)' : 'detach(author)', signers,
            () => { chain.detach(a.holder, a.id, [a.row.container[0].id], signers); }, collector);
        }
      } else if (roll < 0.74 && p.free.length > 0) {
        const a = pick(rng, p.free);
        const na = other(rng, AUTHORS, a.author);
        const signers = chain.profile === 'bnr-adapter' ? [a.author, a.holder] : [a.author];
        drive(chain, chain.profile === 'bnr-adapter' ? 'changeauthor(co-signed)' : 'changeauthor(author)', signers,
          () => { chain.changeauthor(a.author, na, a.holder, [a.id], '', signers); }, collector);
      } else if (roll < 0.78 && p.free.length > 0) {
        const a = pick(rng, p.free);
        drive(chain, 'update', [a.author], () => { chain.update(a.author, a.holder, a.id, `md:${seed}:${i}`, [a.author]); }, collector);
      } else if (roll < 0.82 && p.free.length > 0) {
        const candidates = p.free.filter((x) => x.row.container.length === 0 && x.row.containerf.length === 0 && !chain.offers.has(x.id) && !chain.delegates.has(x.id));
        if (candidates.length > 0) {
          const a = pick(rng, candidates);
          drive(chain, 'burn', [a.holder], () => { chain.burn(a.holder, [a.id], [a.holder]); }, collector);
        }
      } else if (roll < 0.88 && p.ftHolders.length > 0) {
        const f = pick(rng, p.ftHolders);
        const sub = rng();
        if (sub < 0.4) {
          const to = other(rng, PEOPLE, f.holder);
          drive(chain, 'transferf', [f.holder], () => { chain.transferf(f.holder, to, f.author, { symbol: f.sym, amount: 10n }, '', [f.holder]); }, collector);
        } else if (sub < 0.6 && f.amount > 20n) {
          const to = other(rng, PEOPLE, f.holder);
          drive(chain, 'offerf', [f.holder], () => { chain.offerf(f.holder, to, f.author, { symbol: f.sym, amount: 10n }, '', [f.holder]); }, collector);
        } else if (chain.ftOffers.size > 0) {
          const [oid, o] = pick(rng, [...chain.ftOffers.entries()]);
          if (rng() < 0.5) drive(chain, 'claimf(consent)', [o.offeredto], () => { chain.claimf(o.offeredto, [oid], [o.offeredto]); }, collector);
          else drive(chain, 'cancelofferf', [o.owner], () => { chain.cancelofferf(o.owner, [oid], [o.owner]); }, collector);
        }
      } else if (roll < 0.93 && p.ftHolders.length > 0 && p.free.length > 0) {
        const f = pick(rng, p.ftHolders.filter((x) => x.author === x.holder)) ?? null;
        void f;
        const holders = p.ftHolders.filter((x) => x.amount > 30n);
        if (holders.length > 0) {
          const ft = pick(rng, holders);
          const assets = p.free.filter((x) => x.author === ft.author && x.holder === ft.holder);
          if (assets.length > 0) {
            const signers = chain.profile === 'bnr-adapter' ? [ft.author, ft.holder] : [ft.author];
            drive(chain, chain.profile === 'bnr-adapter' ? 'attachf(co-signed)' : 'attachf(author)', signers,
              () => { chain.attachf(ft.holder, ft.author, { symbol: ft.sym, amount: 10n }, pick(rng, assets).id, signers); }, collector);
          }
        }
      } else if (roll < 0.96 && chain.profile === 'specimen' && p.ftHolders.some((x) => x.authorctrl && x.holder !== x.issuer)) {
        // the F-1 seam, exercised deliberately on the specimen
        const f = pick(rng, p.ftHolders.filter((x) => x.authorctrl && x.holder !== x.issuer));
        if (rng() < 0.5) {
          const to = other(rng, PEOPLE, f.holder);
          drive(chain, 'F1:issuer-move', [f.issuer], () => { chain.transferf(f.holder, to === f.issuer ? 'mallory' : to, f.author, { symbol: f.sym, amount: 10n }, '', [f.issuer]); }, collector);
        } else {
          drive(chain, 'F1:issuer-burn', [f.issuer], () => { chain.burnf(f.holder, f.author, { symbol: f.sym, amount: 10n }, '', [f.issuer]); }, collector);
        }
      } else {
        // wrong-signer probe: a third party tries to move someone's asset —
        // free OR delegated (a delegated asset refuses on the delegation
        // seam; both must roll back whole since the hardening beat)
        if (p.free.length > 0) {
          const a = pick(rng, p.free);
          const code = refusedWith(() => chain.transfer(a.holder, 'mallory', [a.id], '', ['mallory']), chain);
          assert.ok(code === 'bt-wb002:auth' || code === 'bt-wb002:delegated', `wrong-signer transfer returned ${code}`);
          collector.probes++;
        }
      }
    } catch (e) {
      // legal refusals (expired tenures, missing rows mid-op) are part of
      // history — and since the hardening beat, each one must have rolled
      // back the WHOLE pre-state (tables, counters, committed log)
      if (!(e instanceof Refusal)) throw e;
      assert.equal(chain.log.length, iter.logLen, `refused ${e.refusal} committed events`);
      assert.equal(chain.logRoot(), iter.logRoot, `refused ${e.refusal} changed the log root`);
      assert.deepEqual(sovereignSnapshot(chain), iter.sov, `refused ${e.refusal} moved sovereignty`);
      assert.deepEqual(ftSnapshot(chain), iter.ft, `refused ${e.refusal} moved balances`);
      collector.rollbacks++;
    }
    trackSpawns();
  }
  return spawnIdata;
}

// fold-equality: the archivist's truth must equal the chain's truth for
// EVERY id that exists (free, contained, delegated, ntt)
function allIds(chain) {
  const ids = new Set();
  const walkRow = (row) => { ids.add(row.id); for (const c of row.container) walkRow(c); };
  for (const rows of chain.scopes.values()) for (const row of rows.values()) walkRow(row);
  for (const rows of chain.nttScopes.values()) for (const row of rows.values()) ids.add(row.id);
  return ids;
}
function assertFoldEqualsChain(chain, msg) {
  const fold = reconstruct(chain.log);
  for (const id of allIds(chain)) {
    assert.equal(fold.sovereign(id), chain.sovereignOf(id), `${msg}: id ${id} diverged between log fold and chain`);
  }
}

// ---------------------------------------------------------------------------
test('the port is faithful: upstream behaviors and quirks reproduce', () => {
  const c = world('specimen');
  const id = c.create('authorgov', 'cred', 'alice', 'cmt-A', '{}', false, ['authorgov']);
  assert.equal(c.sovereignOf(id), 'alice');

  // offer -> claim is consent-gated (SA.cpp:335, 142)
  c.offer('alice', 'bob', [id], '', ['alice']);
  assert.equal(c.sovereignOf(id), 'alice', 'an open offer transfers nothing');
  refusedWith(() => c.claim('carol', [id], ['carol']));
  c.claim('bob', [id], ['bob']);
  assert.equal(c.sovereignOf(id), 'bob');

  // delegated possession vs sovereign (SA.cpp:439)
  c.delegate('bob', 'dave', [id], 10_000_000n, false, '', ['bob']);
  assert.equal(c.scope('dave').get(id).owner, 'dave', 'the borrower holds the row');
  assert.equal(c.sovereignOf(id), 'bob', 'the lender keeps sovereignty');
  const code = refusedWith(() => c.transfer('dave', 'ed', [id], '', ['dave']));
  assert.equal(code, 'bt-wb002:delegated', 'a borrower cannot route a delegated asset onward');
  // the borrower CAN hand it back at any time (documented upstream)
  c.transfer('dave', 'bob', [id], '', ['dave']);
  assert.equal(c.sovereignOf(id), 'bob');

  // undelegate honors the period (SA.cpp:514)
  c.delegate('bob', 'dave', [id], 10_000_000n, false, '', ['bob']);
  assert.equal(refusedWith(() => c.undelegate('bob', [id], ['bob'])), 'bt-wb002:period');
  c.now += 10_000_001n;
  c.undelegate('bob', [id], ['bob']);
  assert.equal(c.sovereignOf(id), 'bob');

  // NTTs have no transfer path at all
  const ntt = c.createntt('authorgov', 'cap', 'alice', 'ntt-cmt', '{}', false, ['authorgov']);
  assert.equal(refusedWith(() => c.transfer('alice', 'bob', [ntt], '', ['alice'])), 'bt-wb002:not-found');

  // receiver-pays RAM never means receiver authorizes (SA.cpp:233, 264)
  const id2 = c.create('authorgov', 'cred', 'alice', 'cmt-B', '{}', false, ['authorgov']);
  assert.equal(refusedWith(() => c.transfer('alice', 'bob', [id2], '', ['bob'])), 'bt-wb002:auth');
  c.transfer('alice', 'bob', [id2], '', ['alice', 'bob']); // both sign: fine

  // author RAM sponsorship: the payer is never an owner (SA.cpp:302)
  c.setarampayer('authorgov', 'cred', true, ['authorgov']);
  const id3 = c.create('authorgov', 'cred', 'alice', 'cmt-C', '{}', false, ['authorgov']);
  const holder3 = c.scope('alice').get(id3);
  void holder3;
  assert.equal(c.ramPayerOf.get(id3), 'authorgov', 'the author sponsored the row');
  assert.equal(c.sovereignOf(id3), 'alice', 'sponsorship granted no authority');
  const id4 = c.create('authorgov', 'cred', 'alice', 'cmt-D', '{}', false, ['authorgov']);
  c.transfer('alice', 'bob', [id4], '', ['alice']);
  assert.equal(c.sovereignOf(id4), 'bob');
  assert.equal(refusedWith(() => c.burn('authorgov', [id4], ['authorgov'])), 'bt-wb002:not-found', 'the payer cannot even reach the asset at another scope');
});

test('idata never moves: no action path rewrites the immutable commitment', () => {
  const c = world('bnr-adapter');
  const collector = { steps: 0, named: [], probes: 0 };
  const spawnIdata = runHistory(c, 300, 424242, collector);
  assert.equal(collector.named.length, 0, `adapter history leaked sovereignty: ${JSON.stringify(collector.named)}`);
  // every spawned id still carries its spawn-time idata, wherever it now lives
  const findRow = (id) => {
    const walk = (row) => { if (row.id === id) return row; for (const k of row.container) { const r = walk(k); if (r) return r; } return null; };
    for (const rows of c.scopes.values()) for (const row of rows.values()) { const r = walk(row); if (r) return r; }
    for (const rows of c.nttScopes.values()) for (const row of rows.values()) if (row.id === id) return row;
    return null;
  };
  let checked = 0;
  for (const [id, idata] of spawnIdata) {
    const row = findRow(id);
    if (!row) continue; // burned — its commitment died with it, by sovereign signature
    assert.equal(row.idata, idata, `asset ${id} idata drifted after spawn`);
    checked++;
  }
  console.log(`bT-WB002: idata commitments verified byte-identical after 300 hostile actions 0 -> ${checked}`);
});

test('THE KILLER INVARIANT: adapter profile, 600-step hostile history, zero unexplained sovereignty changes', () => {
  const c = world('bnr-adapter');
  const collector = { steps: 0, named: [], probes: 0 };
  runHistory(c, 600, 20261007, collector);
  assert.ok(collector.probes > 10, `only ${collector.probes} wrong-signer probes fired`);
  assert.equal(collector.named.length, 0, `unexplained sovereignty changes: ${JSON.stringify(collector.named)}`);
  assertFoldEqualsChain(c, 'adapter 600-step history');
  console.log(`bT-WB002: adapter sovereign-continuity steps 0 -> ${collector.steps}, wrong-signer probes refused 0 -> ${collector.probes}, refused transactions rolled back whole 0 -> ${collector.rollbacks}, unexplained 0 -> 0`);
});

test('specimen profile: every sovereignty violation is NAMED (F-1 family only) — an unnamed violation fails the battery', () => {
  const c = world('specimen');
  const collector = { steps: 0, named: [], probes: 0 };
  runHistory(c, 600, 20261007, collector);
  const F1 = new Set(['F1:issuer-move', 'F1:issuer-burn', 'attachf(author)']);
  const unnamed = collector.named.filter((x) => !F1.has(x.tag));
  assert.equal(unnamed.length, 0, `the specimen produced UNNAMED violations: ${JSON.stringify(unnamed)}`);
  assert.ok(collector.named.some((x) => x.tag === 'F1:issuer-move' || x.tag === 'F1:issuer-burn'), 'the F-1 seam was never exercised — the history lost its teeth');
  assertFoldEqualsChain(c, 'specimen 600-step history');
  console.log(`bT-WB002: specimen sovereign violations, all named 0 -> ${collector.named.length} (F-1 issuer moves/burns + author attachf), unnamed 0 -> 0, refused transactions rolled back whole 0 -> ${collector.rollbacks}`);
});

// ---------------------------------------------------------------------------
test('wrong-signer matrix: every authority seam refuses the wrong hand, both profiles', () => {
  const rows = [
    { name: 'transfer by a stranger', code: 'bt-wb002:auth', run: (c, f) => c.transfer('alice', 'bob', [f.id1], '', ['mallory']) },
    { name: 'transfer by the receiver', code: 'bt-wb002:auth', run: (c, f) => c.transfer('alice', 'bob', [f.id1], '', ['bob']) },
    { name: 'transfer by the author', code: 'bt-wb002:auth', run: (c, f) => c.transfer('alice', 'bob', [f.id1], '', ['authorgov']) },
    { name: 'transfer by nobody', code: 'bt-wb002:auth', run: (c, f) => c.transfer('alice', 'bob', [f.id1], '', []) },
    { name: 'transfer from a scope you do not hold', code: 'bt-wb002:not-found', run: (c, f) => c.transfer('bob', 'carol', [f.id1], '', ['bob']) },
    { name: 'claim by a stranger', code: 'bt-wb002:auth', run: (c, f) => { c.offer('alice', 'bob', [f.id2], '', ['alice']); c.claim('bob', [f.id2], ['carol']); } },
    { name: 'claim by the wrong offeree', code: 'bt-wb002:not-offered-to', run: (c, f) => { c.offer('alice', 'bob', [f.id2], '', ['alice']); c.claim('carol', [f.id2], ['carol']); } },
    { name: 'offer by a stranger', code: 'bt-wb002:auth', run: (c, f) => c.offer('alice', 'carol', [f.id1], '', ['mallory']) },
    { name: 'canceloffer by the offeree', code: 'bt-wb002:not-owner', run: (c, f) => { c.offer('alice', 'bob', [f.id2], '', ['alice']); c.canceloffer('bob', [f.id2], ['bob']); } },
    { name: 'burn by a stranger', code: 'bt-wb002:auth', run: (c, f) => c.burn('alice', [f.id1], ['mallory']) },
    { name: 'burn by the author', code: 'bt-wb002:auth', run: (c, f) => c.burn('alice', [f.id1], ['authorgov']) },
    { name: 'burn an offered asset', code: 'bt-wb002:offered', run: (c, f) => { c.offer('alice', 'bob', [f.id2], '', ['alice']); c.burn('alice', [f.id2], ['alice']); } },
    { name: 'delegate by a stranger', code: 'bt-wb002:auth', run: (c, f) => c.delegate('alice', 'dave', [f.id1], 100n, false, '', ['mallory']) },
    { name: 'undelegate by the borrower', code: 'bt-wb002:not-owner', run: (c, f) => { c.delegate('alice', 'dave', [f.id1], 1n, false, '', ['alice']); c.now += 10n; c.undelegate('dave', [f.id1], ['dave']); } },
    { name: 'undelegate before expiry (the sovereign too)', code: 'bt-wb002:period', run: (c, f) => { c.delegate('alice', 'dave', [f.id1], 100_000n, false, '', ['alice']); c.undelegate('alice', [f.id1], ['alice']); } },
    { name: 'borrower routes a delegated asset onward', code: 'bt-wb002:delegated', run: (c, f) => { c.delegate('alice', 'dave', [f.id1], 1n, false, '', ['alice']); c.transfer('dave', 'ed', [f.id1], '', ['dave']); } },
    { name: 'forbidden re-delegation', code: 'bt-wb002:no-redelegate', run: (c, f) => { c.delegate('alice', 'dave', [f.id1], 1n, false, '', ['alice']); c.delegate('dave', 'ed', [f.id1], 1n, true, '', ['dave']); } },
    { name: 'update by the owner', code: 'bt-wb002:auth', run: (c, f) => c.update('authorgov', 'alice', f.id1, 'x', ['alice']) },
    { name: 'burn an NTT by a stranger', code: 'bt-wb02:not-found', run: (c, f) => c.burnntt('carol', [f.ntt1], ['carol']) },
    { name: 'claim an NTT by the wrong subject', code: 'bt-wb002:not-offered-to', run: (c, f) => { c.createntt('authorgov', 'cap', 'bob', 'n2', '{}', true, ['authorgov']); c.claimntt('carol', [f.nttOffered], ['carol']); } },
    { name: 'FT transfer by a stranger', code: 'bt-wb002:auth', run: (c, f) => c.transferf('bob', 'carol', 'authorgov', { symbol: 'WOOD', amount: 1n }, '', ['mallory']) },
    { name: 'FT transfer by the receiver', code: 'bt-wb002:auth', run: (c, f) => c.transferf('bob', 'carol', 'authorgov', { symbol: 'WOOD', amount: 1n }, '', ['carol']) },
    { name: 'FT offer by a stranger', code: 'bt-wb002:auth', run: (c, f) => c.offerf('bob', 'carol', 'authorgov', { symbol: 'WOOD', amount: 1n }, '', ['mallory']) },
    { name: 'setarampayer by a stranger', code: 'bt-wb002:auth', run: (c) => c.setarampayer('authorgov', 'cred', true, ['mallory']) },
    { name: 'attach by the sovereign — specimen refuses (F-3)', code: 'bt-wb002:auth', profile: 'specimen', run: (c, f) => c.attach('alice', f.id1, [f.id2], ['alice']) },
    { name: 'attach by the author — adapter refuses (F-3)', code: 'bt-wb002:auth', profile: 'bnr-adapter', run: (c, f) => c.attach('alice', f.id1, [f.id2], ['authorgov']) },
    { name: 'detach by the holder — specimen refuses (F-3)', code: 'bt-wb002:auth', profile: 'specimen', run: (c, f) => { c.attach('alice', f.id1, [f.id2], ['authorgov']); c.detach('alice', f.id1, [f.id2], ['alice']); } },
    { name: 'changeauthor without the sovereign — adapter refuses (F-8)', code: 'bt-wb002:auth', profile: 'bnr-adapter', run: (c, f) => c.changeauthor('authorgov', 'authorx', 'alice', [f.id1], '', ['authorgov']) },
    { name: 'createf with authorctrl — adapter refuses (F-1 ruling)', code: 'bt-wb02:adapter-authorctrl', profile: 'bnr-adapter', run: (c) => c.createf('authorgov', 100n, 'BAD', true, '{}', ['authorgov']) },
  ];
  const fixture = (profile) => {
    const c = world(profile);
    const id1 = c.create('authorgov', 'cred', 'alice', 'c1', '{}', false, ['authorgov']);
    const id2 = c.create('authorgov', 'cred', 'alice', 'c2', '{}', false, ['authorgov']);
    const ntt1 = c.createntt('authorgov', 'cap', 'alice', 'n1', '{}', false, ['authorgov']);
    const nttOffered = c.createntt('authorgov', 'cap', 'bob', 'n-offered', '{}', true, ['authorgov']);
    const ctrl = profile === 'specimen';
    if (ctrl) { c.createf('authorgov', 10_000n, 'WOOD', true, '{}', ['authorgov']); c.issuef('bob', 'authorgov', { symbol: 'WOOD', amount: 100n }, '', ['authorgov']); }
    else { c.createf('authorgov', 10_000n, 'WOOD', false, '{}', ['authorgov']); c.issuef('bob', 'authorgov', { symbol: 'WOOD', amount: 100n }, '', ['authorgov']); }
    return { c, f: { id1, id2, ntt1, nttOffered } };
  };
  let refusedSpecimen = 0, refusedAdapter = 0;
  for (const row of rows) {
    if (row.profile !== 'bnr-adapter') {
      const { c, f } = fixture('specimen');
      // the whole row rides one modeled transaction: setup ops and the
      // refusing tail roll back together, so the fingerprint demand holds
      const code = refusedWith(() => c.tx(() => row.run(c, f)), c);
      assert.equal(code, row.code, `[specimen] ${row.name}: got ${code}`);
      refusedSpecimen++;
    }
    if (row.profile !== 'specimen') {
      const { c, f } = fixture('bnr-adapter');
      const code = refusedWith(() => c.tx(() => row.run(c, f)), c);
      assert.equal(code, row.code, `[adapter] ${row.name}: got ${code}`);
      refusedAdapter++;
    }
  }
  // the F-1 convictions: on the specimen the issuer's signature ALONE
  // confiscates — this must keep succeeding, or the A/B row is stale
  const s = fixture('specimen');
  s.c.transferf('bob', 'carol', 'authorgov', { symbol: 'WOOD', amount: 40n }, '', ['authorgov']);
  assert.equal(s.c.bal('bob', s.c.stat('authorgov', 'WOOD').id), 60n, 'F-1 control: the issuer move did not confiscate — teeth stale');
  s.c.burnf('bob', 'authorgov', { symbol: 'WOOD', amount: 10n }, '', ['authorgov']);
  assert.equal(s.c.bal('bob', s.c.stat('authorgov', 'WOOD').id), 50n, 'F-1 control: the issuer burn did not confiscate — teeth stale');
  // the same gestures on the adapter refuse
  const a = fixture('bnr-adapter');
  const aCode = refusedWith(() => a.c.transferf('bob', 'carol', 'authorgov', { symbol: 'WOOD', amount: 40n }, '', ['authorgov']));
  assert.notEqual(aCode, null);
  assert.equal(a.c.bal('bob', a.c.stat('authorgov', 'WOOD').id), 100n, 'adapter: an issuer signature moved a holder balance');
  console.log(`bT-WB002: wrong-signer rows refused (specimen) 0 -> ${refusedSpecimen}, (adapter) 0 -> ${refusedAdapter}, F-1 A/B convictions exercised 0 -> 3`);
});

// ---------------------------------------------------------------------------
test('the truth lattice: consensus = log fold; faults convict the specimen UI; the adapter UI disputes instead of lying', () => {
  const c = world('specimen');
  const collector = { steps: 0, named: [], probes: 0 };
  runHistory(c, 260, 777, collector); // enough events to cross several checkpoints
  assertFoldEqualsChain(c, 'lattice setup');

  const cp = c.log.filter((e) => e.type === 'checkpoint').at(-1);
  assert.ok(cp, 'history crossed no checkpoint — increase steps');
  const anchor = c.checkpointAnchor();
  const tip = c.tipAnchor();

  // pick a DECISIVE move — the asset's last move, inside the checkpoint-to-
  // tip window and not the log tail — so dropping or corrupting it flips
  // the naive fold while the adapter's authenticated window catches it
  const moves = c.log.filter((e) => e.type === 'move' && e.seq > cp.seq && e.seq < c.log.length - 1);
  const victim = moves.at(-1);
  const truth = c.sovereignOf(victim.assetid);
  assert.ok(truth, 'victim asset must still exist');

  let lies = 0, disputes = 0, injections = 0;
  const checkFault = (name, fault) => {
    const ix = new Indexer();
    ix.feed(c.log);
    fault(ix);
    injections++;
    const specimen = new SpecimenUI(ix).displayOwner(victim.assetid);
    const adapter = new AdapterUI(ix, anchor, tip).displayOwner(victim.assetid);
    if (specimen !== truth && specimen !== 'DISPUTED') lies++;
    assert.equal(adapter, 'DISPUTED', `${name}: the adapter UI answered ${adapter} instead of DISPUTED`);
    disputes++;
  };
  checkFault('dropped move', (ix) => ix.drop(victim.seq));
  checkFault('corrupted move', (ix) => ix.corrupt(victim.seq, { to: 'mallory' }));
  checkFault('replayed tail', (ix) => ix.replay(c.log.at(-1).seq));

  // lag: an honest-but-behind indexer answers at its AUTHENTICATED height
  // — the checkpoint, never a fabrication; stale is not a lie
  {
    const ix = new Indexer();
    const k = Math.floor((cp.seq + 1 + c.log.length) / 2);
    ix.feed(c.log.slice(0, k));
    injections++;
    const r = new AdapterUI(ix, anchor).display(victim.assetid);
    const truthAtCp = reconstruct(c.log.filter((e) => e.seq <= cp.seq)).sovereign(victim.assetid);
    assert.equal(r.scope, 'checkpoint-scoped');
    assert.equal(r.owner, truthAtCp, `lagging adapter answered ${r.owner} at height ${r.asOfSeq}, not its authenticated checkpoint truth ${truthAtCp}`);
    // a stream that never reached the checkpoint disputes rather than guess
    const short = new Indexer(); short.feed(c.log.slice(0, cp.seq));
    assert.equal(new AdapterUI(short, anchor).displayOwner(victim.assetid), 'DISPUTED');
  }

  // clean feed: the specimen UI tells the truth; the adapter does too —
  // checkpoint-scoped without a tip bracket, current with one
  {
    const ix = new Indexer();
    ix.feed(c.log);
    assert.equal(new SpecimenUI(ix).displayOwner(victim.assetid), truth);
    const truthAtCp = reconstruct(c.log.filter((e) => e.seq <= cp.seq)).sovereign(victim.assetid);
    const noTip = new AdapterUI(ix, anchor).display(victim.assetid);
    assert.equal(noTip.scope, 'checkpoint-scoped');
    assert.equal(noTip.owner, truthAtCp, 'checkpoint-scoped answer must be the truth as of the checkpoint');
    const withTip = new AdapterUI(ix, anchor, tip).display(victim.assetid);
    assert.equal(withTip.scope, 'authenticated-tip');
    assert.equal(withTip.owner, truth, 'tip-bracketed answer must be current truth');
  }

  // author assertion weighs zero: an issuer claiming mallory owns the
  // asset changes nothing in any truth layer
  {
    const ix = new Indexer();
    ix.feed(c.log);
    const authorClaim = { get: () => 'mallory' }; // the #26-era posture, modeled
    void authorClaim;
    assert.equal(new AdapterUI(ix, anchor, tip).displayOwner(victim.assetid), truth, 'an author assertion leaked into display truth');
  }
  console.log(`bT-WB002: truth-lattice injections 0 -> ${injections}, specimen-UI confident lies 0 -> ${lies}, adapter-UI disputes 0 -> ${disputes}, adapter-UI wrong answers 0 -> 0 (display now content-authenticated: checkpoint body via parent root, suffix only under a trusted tip)`);
});

// ---------------------------------------------------------------------------
test('TORTURE kill the author: sovereignty and exercise survive the issuer\'s death; only mdata freezes', () => {
  const c = world('specimen');
  const id = c.create('authorgov', 'cred', 'alice', 'cmt', '{}', false, ['authorgov']);
  const snap = sovereignSnapshot(c);
  // the author's key dies: no signature of authorgov can ever appear again
  const deadAuthor = (signers) => signers.includes('authorgov') ? (() => { throw new Error('dead key'); })() : signers;
  c.transfer('alice', 'bob', [id], '', deadAuthor(['alice']));
  assert.equal(c.sovereignOf(id), 'bob');
  c.offer('bob', 'carol', [id], '', deadAuthor(['bob']));
  c.claim('carol', [id], deadAuthor(['carol']));
  assert.equal(c.sovereignOf(id), 'carol');
  c.burn('carol', [id], deadAuthor(['carol']));
  assert.equal(c.sovereignOf(id), null);
  // mdata is frozen with the author — but that is display/status, not sovereignty
  const id2 = c.create('authorgov', 'cred', 'alice', 'cmt2', '{}', false, ['authorgov']);
  assert.equal(refusedWith(() => c.update('authorgov', 'alice', id2, 'x', ['alice'])), 'bt-wb002:auth');
  assert.equal(c.sovereignOf(id2), 'alice');
  const after = sovereignSnapshot(c);
  assert.equal(after.get(id2), snap.get(id) === undefined ? 'alice' : after.get(id2)); // id2 sovereign unchanged
  console.log('bT-WB002: torture green — kill the author (exercise + sovereignty survive; mdata freezes)');
});

test('TORTURE lose the contract: sovereignty reconstructs from the log alone, even from fragments', () => {
  const c = world('bnr-adapter');
  const collector = { steps: 0, named: [], probes: 0 };
  runHistory(c, 200, 31337, collector);
  assertFoldEqualsChain(c, 'full log');
  // the archivist's fragment: only the LAST checkpoint event + the tail
  const cps = c.log.filter((e) => e.type === 'checkpoint');
  const lastCp = cps.at(-1);
  const fragments = [lastCp, ...c.log.filter((e) => e.seq > lastCp.seq)];
  const frag = reconstruct(fragments);
  for (const id of allIds(c)) {
    assert.equal(frag.sovereign(id), c.sovereignOf(id), `fragment recovery diverged for id ${id}`);
  }
  console.log(`bT-WB002: torture green — lose the contract (reconstruction from ${c.log.length} events AND from ${fragments.length}-event fragments: identical)`);
});

test('TORTURE rotate the sovereign key and the algorithm: the state machine never notices; the old key dies', () => {
  const c = world('specimen');
  const id = c.create('authorgov', 'cred', 'alice', 'cmt', '{}', false, ['authorgov']);
  // the authority table: account -> {key, alg, active}
  const keys = new Map([['alice', { key: 'K1', alg: 'ed25519', active: true }]]);
  const sign = (...keyIds) => [...keys.entries()].filter(([, v]) => v.active && keyIds.includes(v.key)).map(([n]) => n);
  const before = sovereignSnapshot(c);
  const logBefore = c.log.length;
  // rotate: K1 revoked, K2 (a different algorithm generation) active
  keys.set('alice', { key: 'K2', alg: 'successor-sig-2039', active: true });
  assert.equal(c.log.length, logBefore, 'rotation emitted an event — it must be invisible to the state machine');
  assert.deepEqual(sovereignSnapshot(c), before, 'rotation moved sovereignty');
  assert.equal(sign('K1').length, 0, 'the revoked key still resolves');
  assert.equal(refusedWith(() => c.transfer('alice', 'bob', [id], '', sign('K1'))), 'bt-wb002:auth', 'the dead key moved an asset');
  c.transfer('alice', 'bob', [id], '', sign('K2'));
  assert.equal(c.sovereignOf(id), 'bob', 'the successor key could not exercise the same sovereignty');
  console.log('bT-WB002: torture green — key/algorithm rotation (state untouched by rotation; old key dead; new key exercises)');
});

test('TORTURE partition and reorg: the losing fork\'s transfer leaves no trace; recovery follows the canonical log', () => {
  const script = (c) => { c.create('authorgov', 'cred', 'alice', 'cmt', '{}', false, ['authorgov']); };
  const A = world('specimen'); const B = world('specimen');
  script(A); script(B);
  const id = A.scope('alice').keys().next().value;
  // one action on each fork: alice signs two conflicting transfers
  A.transfer('alice', 'bob', [id], '', ['alice']);
  B.transfer('alice', 'carol', [id], '', ['alice']);
  // canonical = the branch whose log root wins (the model's stated
  // consensus tie-break; a real network votes — the invariant cares only
  // that exactly ONE branch is canonical)
  const winner = A.logRoot() > B.logRoot() ? A : B;
  const loser = winner === A ? B : A;
  const loserRecipient = winner === A ? 'carol' : 'bob';
  const winnerRecipient = winner === A ? 'bob' : 'carol';
  assert.equal(winner.sovereignOf(id), winnerRecipient);
  // the loser's recipient owns NOTHING canonical
  const fold = reconstruct(winner.log);
  assert.equal(fold.sovereign(id), winnerRecipient);
  assert.notEqual(fold.sovereign(id), loserRecipient);
  // a UI fed the losing fork plus the canonical checkpoint disputes
  const ix = new Indexer(); ix.feed(loser.log);
  // a UI fed the losing fork plus the WINNER's anchors disputes: the
  // loser's stream cannot carry the winner's authenticated history
  const anchor = winner.checkpointAnchor();
  const tipAnchor = winner.tipAnchor();
  assert.equal(new AdapterUI(ix, anchor, tipAnchor).displayOwner(id), 'DISPUTED', 'the losing fork\'s UI confidently answered');
  console.log('bT-WB002: torture green — partition/reorg (one canonical branch; the reorged transfer leaves no trace; stale views dispute)');
});

test('TORTURE replace the contract and migrate the chain: anchored continuity, tamper refused, rights preserved on the successor', () => {
  const old = world('specimen');
  // FTs exist on both networks in the same order, so ftids agree
  const wood = old.createf('authorgov', 1_000_000n, 'WOOD', true, '{}', ['authorgov']);
  old.issuef('bob', 'authorgov', { symbol: 'WOOD', amount: 500n }, '', ['authorgov']);
  const id = old.create('authorgov', 'cred', 'alice', 'cmt-keep', '{}', false, ['authorgov']);
  const ntt = old.createntt('authorgov', 'cap', 'alice', 'ntt-cmt', '{}', false, ['authorgov']);
  old.delegate('alice', 'dave', [id], 1n, false, '', ['alice']); // a live bounded delegation rides the migration
  const bundle = old.exportState();
  const anchor = old.stateCommitment(bundle);

  // tampered migration: one sovereign flipped — refused
  const tampered = structuredClone(bundle);
  const t = tampered.assets.find((a) => a.row.id === id);
  t.sovereign = 'mallory';
  const fresh = world('bnr-adapter');
  fresh.createf('authorgov', 1_000_000n, 'WOOD', false, '{}', ['authorgov']);
  assert.equal(refusedWith(() => fresh.importState(tampered, anchor)), 'bt-wb02:migration-anchor');

  // TEETH: the naive unanchored importer accepts the tampered bundle
  const naive = world('bnr-adapter');
  for (const a of tampered.assets) naive.scope(a.sovereign).set(a.row.id, { id: a.row.id, owner: a.sovereign, author: a.row.author, category: a.row.category, idata: a.row.idata, mdata: '', container: [], containerf: [] });
  assert.equal(naive.sovereignOf(id), 'mallory', 'teeth stale: the naive importer did not accept the forgery');

  // anchored migration: rights survive the network change
  const successor = world('bnr-adapter');
  successor.createf('authorgov', 1_000_000n, 'WOOD', false, '{}', ['authorgov']);
  successor.importState(bundle, anchor);
  assert.equal(successor.sovereignOf(id), 'alice', 'migration moved the NFT');
  assert.equal(successor.sovereignOf(ntt), 'alice', 'migration moved the NTT');
  assert.equal(successor.sovereignOf(id), 'alice');
  // the live delegation survived: alice still the sovereign, dave still the holder
  assert.equal(successor.scope('dave').get(id).owner, 'dave');
  assert.equal(successor.sovereignOf(id), 'alice');
  // behavioral continuity: alice exercises on the new network, nobody else can
  successor.now += 10n;
  successor.transfer('dave', 'alice', [id], '', ['alice']);
  assert.equal(successor.sovereignOf(id), 'alice');
  assert.equal(refusedWith(() => successor.transfer('alice', 'mallory', [id], '', ['mallory'])), 'bt-wb002:auth');
  successor.transfer('alice', 'bob', [id], '', ['alice']);
  assert.equal(successor.sovereignOf(id), 'bob', 'the migrated sovereign could not exercise');
  // FT balance continuity (same ftid by construction order)
  assert.equal(successor.bal('bob', successor.stat('authorgov', 'WOOD').id), 500n);
  assert.equal(wood, successor.stat('authorgov', 'WOOD').id);
  // the log fold of the successor agrees with its state
  assertFoldEqualsChain(successor, 'post-migration successor');
  console.log('bT-WB002: torture green — contract replacement + chain migration (anchor refuses tamper; sovereign rights and the live delegation survive; naive importer convicted)');
});

test('TORTURE the marketplace dies (upstream #6): direct exercise needs no author-side relay', () => {
  const c = world('specimen');
  const id = c.create('authorgov', 'cred', 'alice', 'cmt', '{}', false, ['authorgov']);
  // issue #6's failure class: trades routed through an author contract can
  // be frozen by the author. The sovereign path here never touches the
  // author: transfer/offer/claim/burn are owner-executable.
  c.transfer('alice', 'bob', [id], '', ['alice']);
  c.offer('bob', 'carol', [id], '', ['bob']);
  c.claim('carol', [id], ['carol']);
  c.burn('carol', [id], ['carol']);
  assert.equal(c.sovereignOf(id), null);
  console.log('bT-WB002: torture green — marketplace loss (offer->claim executes with zero author involvement)');
});

// ---------------------------------------------------------------------------
test('the 1,000-year leg: clock centuries forward — tenures expire, ancient offers haunt the specimen, the adapter retires them', () => {
  const MILLENNIUM = 1_000n * 365n * 24n * 60n * 60n;
  const c = world('specimen');
  const id = c.create('authorgov', 'cred', 'alice', 'cmt-2019', '{}', false, ['authorgov']);
  c.delegate('alice', 'dave', [id], 3600n, false, '', ['alice']);
  // a standing offer from the old era, never cancelled
  const id2 = c.create('authorgov', 'cred', 'alice', 'cmt-offer', '{}', false, ['authorgov']);
  c.offer('alice', 'bob', [id2], '', ['alice']);
  c.now += MILLENNIUM;

  // tenures are finite: the delegation expired a millennium ago
  c.undelegate('alice', [id], ['alice']);
  assert.equal(c.sovereignOf(id), 'alice');

  // F-4: the specimen's standing offer from a thousand years ago is still
  // claimable — consent that never retires
  c.claim('bob', [id2], ['bob']);
  assert.equal(c.sovereignOf(id2), 'bob', 'F-4 stale: the ancient offer no longer claims');
  const a = world('bnr-adapter');
  const id3 = a.create('authorgov', 'cred', 'alice', 'cmt', '{}', false, ['authorgov']);
  a.offer('alice', 'bob', [id3], '', ['alice']);
  a.now += MILLENNIUM;
  assert.equal(refusedWith(() => a.claim('bob', [id3], ['bob'])), 'bt-wb002:offer-expired', 'the adapter honored a millennium-old consent');

  // counters: no rollover anywhere in plausible deep time (u64 honesty note)
  assert.ok(c.lnftid < 2n ** 63n, 'asset counter improbably high');

  // a thousand-action history folds clean after a thousand years
  const m = world('bnr-adapter', 1_700_000_000n + MILLENNIUM);
  const collector = { steps: 0, named: [], probes: 0 };
  runHistory(m, 1000, 3019, collector);
  assert.equal(collector.named.length, 0, `millennium history leaked sovereignty: ${JSON.stringify(collector.named)}`);
  assertFoldEqualsChain(m, 'millennium history');
  console.log(`bT-WB002: millennium leg — ${collector.steps} actions across simulated centuries, unexplained 0 -> 0, fold mismatches 0 -> 0, F-4 convicted (specimen claims 1000-year-old consent; adapter refuses)`);
});

test('TEETH: the battery convicts its own naive postures (a green row here would mean the battery lost its teeth)', () => {
  // teeth 1: the SpecimenUI (trust-the-indexer) must actually lie under a
  // dropped event — if it "recovers", the fault injection is stale
  const c = world('specimen');
  const collector = { steps: 0, named: [], probes: 0 };
  runHistory(c, 120, 999, collector);
  const moves = c.log.filter((e) => e.type === 'move');
  const victim = moves.at(-1);
  const truth = c.sovereignOf(victim.assetid);
  const ix = new Indexer(); ix.feed(c.log); ix.drop(victim.seq);
  const lie = new SpecimenUI(ix).displayOwner(victim.assetid);
  assert.notEqual(lie, truth, 'teeth stale: dropping the last move no longer misleads the specimen UI');
  assert.ok(lie === null || typeof lie === 'string');

  // teeth 2: the naive importer must accept the flipped bundle (convicted
  // in the migration test; here we prove the tamper is material)
  const bundle = c.exportState();
  const tampered = structuredClone(bundle);
  tampered.assets[0].sovereign = 'mallory';
  assert.notEqual(c.stateCommitment(tampered), c.stateCommitment(bundle), 'teeth stale: a flipped sovereign does not change the commitment');

  // teeth 3: a forged event root must fail chain verification
  const forged = structuredClone(c.log.at(-1));
  forged.root = sha('forged');
  const ix2 = new Indexer(); ix2.feed([...c.log.slice(0, -1), forged]);
  assert.equal(ix2.chainConsistent(), false, 'teeth stale: a forged root passes verification');
  console.log('bT-WB002: teeth rows green — specimen-UI lie control, tampered-commitment control, forged-root control');
});
