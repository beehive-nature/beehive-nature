// wb002-hardening.test.mjs — bTunGsTeN Workbench 002, model-hardening beat
// (founder review of the merged landing @c4b1b2b2d, 2026-10-07).
//
// TWO named model defects, red-first:
//   R-1  a REJECTED action retains its state mutations (no transaction
//        rollback in the port; Antelope specifies failed transactions
//        restore prior state — the C++ relies on a boundary the JS port
//        had not reproduced).
//   R-2  the AdapterUI authenticates a matching ROOT STRING, not the
//        checkpoint CONTENTS, and does not bound displayed state to an
//        authenticated history (checkpoint-body substitution; unconfirmed
//        log extension).
//
// Red-first receipt: this suite was run against the merged module BEFORE
// the repair — the R-1/R-2 rows were red, the control rows green (the
// receipt is in docs/dispatches/2026-10-07-btungsten-wb002-model-hardening.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  Chain, Refusal, reconstruct, Indexer, SpecimenUI, AdapterUI, canon, sha,
} from './wb002-simpleassets.mjs';

const PEOPLE = ['alice', 'bob', 'carol', 'dave', 'ed'];
const world = (profile, now = 1_700_000_000n) => {
  const c = new Chain({ profile, now });
  for (const n of ['authorgov', 'authorx', ...PEOPLE, 'mallory']) c.acct(n);
  return c;
};
const refusedWith = (fn) => {
  try { fn(); } catch (e) {
    assert.ok(e instanceof Refusal, `not a Refusal: ${e}`);
    return e.refusal;
  }
  assert.fail('expected a refusal');
};

test('R-1 control: a refusal that precedes any mutation changes nothing (control row, green before the repair too)', () => {
  for (const profile of ['specimen', 'bnr-adapter']) {
    const c = world(profile);
    const id = c.create('authorgov', 'cred', 'alice', 'cmt', '{}', false, ['authorgov']);
    const fp = c.fingerprint();
    const code = refusedWith(() => c.transfer('alice', 'bob', [id], '', ['mallory']));
    assert.equal(code, 'bt-wb002:auth');
    assert.equal(c.fingerprint(), fp, 'a plain wrong-signer refusal left state behind');
  }
});

test('R-1: a rejected return-to-lender transfer must not consume the delegation (founder counterexample)', () => {
  for (const profile of ['specimen', 'bnr-adapter']) {
    const c = world(profile);
    const id = c.create('authorgov', 'cred', 'alice', 'cmt', '{}', false, ['authorgov']);
    c.delegate('alice', 'dave', [id], 10_000_000n, false, '', ['alice']);
    assert.equal(c.sovereignOf(id), 'alice');
    assert.ok(c.delegates.has(id));
    const fp = c.fingerprint();
    const code = refusedWith(() => c.transfer('dave', 'alice', [id], '', ['mallory']));
    assert.equal(code, 'bt-wb002:auth', 'the stranger must be refused');
    // the whole point: the refusal must have rolled back the deletion of
    // the delegation record, its delegateclose event, and everything else
    assert.equal(c.sovereignOf(id), 'alice', `[${profile}] the rejected transfer changed the sovereign`);
    assert.ok(c.delegates.has(id), `[${profile}] the rejected transfer consumed the delegation record`);
    assert.equal(c.fingerprint(), fp, `[${profile}] the rejected transaction was not rolled back whole`);
  }
});

test('R-1: a partial batch must be all-or-nothing (founder counterexample)', () => {
  for (const profile of ['specimen', 'bnr-adapter']) {
    const c = world(profile);
    const good = c.create('authorgov', 'cred', 'alice', 'cmt', '{}', false, ['authorgov']);
    c.create('authorgov', 'cred', 'alice', 'cmt2', '{}', false, ['authorgov']);
    const fp = c.fingerprint();
    const code = refusedWith(() => c.transfer('alice', 'bob', [good, 999999999999999n], '', ['alice']));
    assert.equal(code, 'bt-wb002:not-found', 'the batch must refuse on the missing asset');
    assert.equal(c.sovereignOf(good), 'alice', `[${profile}] the first asset of a refused batch moved`);
    assert.equal(c.fingerprint(), fp, `[${profile}] the refused batch was not rolled back whole`);
  }
});

test('R-1: every refusing seam of the wrong-signer matrix preserves the whole pre-state', () => {
  // the matrix's own rows, re-run here with the fingerprint demand: each
  // refusing call must leave EVERYTHING untouched — tables, counters, log.
  const rows = [
    (c) => c.transfer('alice', 'bob', [c.ids.id1], '', ['mallory']),
    (c) => c.transfer('alice', 'bob', [c.ids.id1], '', ['bob']),
    (c) => c.burn('alice', [c.ids.id1], ['authorgov']),
    (c) => c.delegate('alice', 'dave', [c.ids.id1], 100n, false, '', ['mallory']),
    (c) => c.update('authorgov', 'alice', c.ids.id1, 'x', ['alice']),
    (c) => c.offerf('bob', 'carol', 'authorgov', { symbol: 'WOOD', amount: 1n }, '', ['mallory']),
    (c) => c.transferf('bob', 'carol', 'authorgov', { symbol: 'WOOD', amount: 1n }, '', ['carol']),
    (c) => c.setarampayer('authorgov', 'cred', true, ['mallory']),
    (c) => c.attach('alice', c.ids.id1, [c.ids.id2], ['mallory']),       // specimen wants the author, adapter the sovereign — a stranger refuses on both
    (c) => c.changeauthor('authorgov', 'authorx', 'alice', [c.ids.id1], '', ['alice']),
  ];
  let refused = 0;
  for (const profile of ['specimen', 'bnr-adapter']) {
    for (const row of rows) {
      const c = world(profile);
      const id1 = c.create('authorgov', 'cred', 'alice', 'c1', '{}', false, ['authorgov']);
      const id2 = c.create('authorgov', 'cred', 'alice', 'c2', '{}', false, ['authorgov']);
      c.createf('authorgov', 10_000n, 'WOOD', profile === 'specimen', '{}', ['authorgov']);
      c.issuef('bob', 'authorgov', { symbol: 'WOOD', amount: 100n }, '', ['authorgov']);
      c.ids = { id1, id2 };
      const fp = c.fingerprint();
      const code = refusedWith(() => row(c));
      assert.ok(code.startsWith('bt-wb0'), `row refused with ${code}`);
      assert.equal(c.fingerprint(), fp, `[${profile}] a refusing seam retained state changes (${code})`);
      refused++;
    }
  }
  console.log(`bT-WB002: refusing seams proven rollback-whole (fingerprint-stable) 0 -> ${refused}`);
});

test('R-1: multi-action bundles are atomic — tx() rolls the WHOLE bundle back on any refusal', () => {
  const c = world('bnr-adapter');
  const id1 = c.create('authorgov', 'cred', 'alice', 'c1', '{}', false, ['authorgov']);
  const id2 = c.create('authorgov', 'cred', 'alice', 'c2', '{}', false, ['authorgov']);
  const fp = c.fingerprint();
  // a bundle whose second action refuses: the first action's move must vanish with it
  assert.throws(() => c.tx(() => {
    c.transfer('alice', 'bob', [id1], '', ['alice']);
    c.burn('alice', [id2], ['mallory']); // refuses
  }), Refusal);
  assert.equal(c.fingerprint(), fp, 'a refused bundle left its prefix committed');
  assert.equal(c.sovereignOf(id1), 'alice', 'the bundle prefix leaked');
  // and the same bundle, legal, commits whole
  c.tx(() => { c.transfer('alice', 'bob', [id1], '', ['alice']); c.transfer('bob', 'carol', [id1], '', ['bob']); });
  assert.equal(c.sovereignOf(id1), 'carol');
});

// Build a chain with at least one anchored checkpoint and a post-
// checkpoint suffix; return { chain, cp, victimId }.
// A lattice world with one anchored checkpoint. The VICTIM is quiescent:
// created before the checkpoint, never moved after it — so a display of
// its owner derives straight from the checkpoint contents (exactly the
// founder's substitution case), while the log still carries a genuine
// post-checkpoint suffix.
const latticeWorld = () => {
  const c = world('specimen');
  const TARGETS = ['bob', 'carol', 'dave', 'ed'];
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(c.create('authorgov', 'cred', 'alice', `cmt-${i}`, '{}', false, ['authorgov']));
  const victim = ids[0];
  for (let i = 0; c.log.filter((e) => e.type === 'checkpoint').length === 0; i++) {
    const id = c.create('authorgov', 'cred', 'alice', `cmt-suffix-${i}`, '{}', false, ['authorgov']);
    ids.push(id);
    c.transfer('alice', TARGETS[i % TARGETS.length], [id], '', ['alice']);
    c.transfer(TARGETS[i % TARGETS.length], 'alice', [id], '', [TARGETS[i % TARGETS.length]]);
  }
  const cp = c.log.filter((e) => e.type === 'checkpoint').at(-1);
  const tail = c.create('authorgov', 'cred', 'alice', 'cmt-tail', '{}', false, ['authorgov']);
  c.transfer('alice', 'bob', [tail], '', ['alice']); // a genuine post-checkpoint suffix
  return { c, cp, victim };
};

test('R-2 control: an honest checkpoint fragment and the honest full log display the truth (control row)', () => {
  const { c, cp, victim } = latticeWorld();
  const truth = c.sovereignOf(victim);
  const anchor = c.checkpointAnchor();
  assert.ok(anchor, 'the fixture crossed a checkpoint');
  const honest = new Indexer(); honest.feed(c.log);
  const frag = new Indexer(); frag.feed(c.log.filter((e) => e.seq >= cp.seq));
  for (const ix of [honest, frag]) {
    const ui = new AdapterUI(ix, anchor);
    const r = ui.display(victim);
    assert.equal(r.owner, truth, 'an honest stream displayed a wrong owner');
    assert.equal(r.scope, 'checkpoint-scoped', 'an unbracketed honest stream must scope its answer to the checkpoint');
    assert.equal(r.asOfSeq, cp.seq, 'the checkpoint-scoped answer must carry its explicit height');
  }
  // with the consensus tip bracketing the full stream, the answer is current
  const withTip = new AdapterUI(honest, anchor, c.tipAnchor()).display(victim);
  assert.equal(withTip.owner, truth);
  assert.equal(withTip.scope, 'authenticated-tip');
});

test('R-2: a substituted checkpoint BODY behind a genuine root must not be believed', () => {
  const { c, cp, victim } = latticeWorld();
  const truth = c.sovereignOf(victim);
  const anchor = c.checkpointAnchor();
  // the attack: the fragment's checkpoint keeps its genuine root while its
  // ASSETS are rewritten — the UI must authenticate CONTENTS, not the root
  // string
  const tampered = structuredClone(c.log.filter((e) => e.seq >= cp.seq));
  const cpEv = tampered[0];
  const row = cpEv.assets.find((a) => a[0] === victim);
  assert.ok(row, 'the victim must live in the checkpoint (quiescent fixture)');
  row[1] = 'mallory';
  for (const tip of [null, c.tipAnchor()]) {
    const ix = new Indexer(); ix.feed(tampered);
    const r = new AdapterUI(ix, anchor, tip).display(victim);
    assert.equal(r.scope, 'disputed', 'a substituted checkpoint body was believed');
    assert.equal(r.owner, 'DISPUTED');
    void truth;
  }
});

test('R-2: a self-consistent but unconfirmed log extension must not be promoted to current ownership', () => {
  const { c, cp, victim } = latticeWorld();
  const truth = c.sovereignOf(victim);
  const anchor = c.checkpointAnchor();
  // the attack: append a fabricated move AFTER the genuine log with a
  // fully correct hash link — internally consistent, never executed
  const forged = structuredClone(c.log);
  const prevRoot = forged[forged.length - 1].root;
  const seq = forged.length;
  const fields = { seq, type: 'move', assetid: victim, from: truth, to: 'mallory', via: 'transfer' };
  forged.push({ ...fields, root: sha(`${prevRoot}|${canon(fields)}`) });
  // without a tip anchor: the suffix is ignored — checkpoint-scoped truth
  const ix = new Indexer(); ix.feed(forged);
  const r = new AdapterUI(ix, anchor).display(victim);
  assert.equal(r.owner, truth, 'an unconfirmed extension changed the displayed owner');
  assert.equal(r.scope, 'checkpoint-scoped', 'an unbracketed suffix was promoted');
  // with the consensus tip: the fabricated tail cannot match it — DISPUTED
  const r2 = new AdapterUI(ix, anchor, c.tipAnchor()).display(victim);
  assert.equal(r2.scope, 'checkpoint-scoped', 'a stream that outruns the consensus tip must not answer at its own end');
  assert.equal(r2.owner, truth, 'the fabricated tail leaked into display truth');
});

test('R-2: a lagging honest stream answers at its authenticated height, never a fabrication', () => {
  const { c, cp, victim } = latticeWorld();
  const anchor = c.checkpointAnchor();
  // an honest prefix that PAST the checkpoint but short of the tip
  const k = Math.floor((cp.seq + 1 + c.log.length) / 2);
  const ix = new Indexer(); ix.feed(c.log.slice(0, k));
  const r = new AdapterUI(ix, anchor).display(victim);
  const truthAtCp = reconstruct(c.log.filter((e) => e.seq <= cp.seq)).sovereign(victim);
  assert.equal(r.scope, 'checkpoint-scoped');
  assert.equal(r.owner, truthAtCp, 'a lagging stream answered something other than its authenticated height');
  // a prefix that never reached the checkpoint disputes rather than guess
  const short = new Indexer(); short.feed(c.log.slice(0, cp.seq));
  assert.equal(new AdapterUI(short, anchor).display(victim).owner, 'DISPUTED');
});

test('R-2: a root-only anchor (no parent root) fails closed', () => {
  const { c, cp, victim } = latticeWorld();
  const ix = new Indexer(); ix.feed(c.log);
  const r = new AdapterUI(ix, { seq: cp.seq, root: cp.root }).display(victim);
  assert.equal(r.owner, 'DISPUTED', 'an anchor that cannot authenticate contents was accepted');
});
