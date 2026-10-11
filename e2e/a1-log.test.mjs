/* a1-log.test.mjs — the agent's memory log (contracts/vending/tool/a1.mjs).
   v1 must keep verifying exactly as before (vectors pinned from the code as it
   stood before v2 landed). v2 pins a post-quantum key at genesis: a revision
   counts only when it and every revision back to genesis carry a valid
   ed25519 AND a valid ML-DSA-65 signature from that pinned key. The attacker
   modelled here holds a working ed25519 forgery (the member's seed stands in
   for it) and a PQ key of their own, never the pinned one. Offline; every key
   is derived from a public string. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';

const A1 = await import('../contracts/vending/tool/a1.mjs');
const { canonicalJson: A1Canonical } = await import('../contracts/vending/tool/cert.mjs');
const seedOf = (s) => createHash('sha256').update(s, 'utf8').digest();
const b64u = (hex) => Buffer.from(hex, 'hex').toString('base64url');
const ts = (n) => '2026-10-04T00:00:' + String(n).padStart(2, '0') + '.000Z';

async function member(label) {
  const seed = seedOf(label);
  const priv = await A1.importMemberSeed(seed);
  const jwk = await webcrypto.subtle.exportKey('jwk', priv);
  return { seed, priv, pub: await A1.importMemberPub(Buffer.from(jwk.x, 'base64url')) };
}

/* pinned BEFORE v2 existed: a1.mjs at fe4a88ae2, seed sha256("a1 v1 vector seed"), agent "vector" */
const V1 = {
  pub: 'yEzcE88fHGFYtvIgt-sLyeedI6hymert7B4kb-YQ0Sc',
  h: ['tB65Fjldzx5XBhErfw-0sHA1MLQY1Qdx4QoZFx1gLQg', 'rs1mM6VbfHdl-ua2vD9NEk7CuzRvsw-3rzuatc27bdE', 'WdxEl5bfc20nvYlYWbeWu6iMRVeJc1e-QV88t0EaOTE'],
  sig0: '85kyC02xSVj7s53kp2ncYyLFUsxo-K_HX3mmnCqUrXulqKLgEu4dKsrfGJJBrMiaVuI8xrOs-gnhd3CJXGC5Dw',
  binding: '0PGD3aciJG2PSPVGI99CZEXwppv-X7OUwWpMlCN6wFU',
};

async function v1Chain(m) {
  const r0 = await A1.genesisRevision({ agent: 'vector', body: { note: 'genesis' }, memberPrivateKey: m.priv, ts: ts(0) });
  const r1 = await A1.appendRevision({ agent: 'vector', prevRevision: r0, body: { note: 'one' }, memberPrivateKey: m.priv, ts: ts(1) });
  const r2 = await A1.appendRevision({ agent: 'vector', prevRevision: r1, body: { note: 'two' }, memberPrivateKey: m.priv, ts: ts(2) });
  return [r0, r1, r2];
}

const AGENT = 'pq vector';
async function v2Chain(m, n = 3) {
  const pq = A1.a1PqKeys(m.seed, AGENT);
  const out = [await A1.genesisRevisionV2({ agent: AGENT, body: { note: 'genesis' }, memberPrivateKey: m.priv, pqKeys: pq, ts: ts(0) })];
  for (let i = 1; i < n; i++)
    out.push(await A1.appendRevision({ agent: AGENT, prevRevision: out[i - 1], body: { note: 'rev ' + i }, memberPrivateKey: m.priv, pqKeys: pq, ts: ts(i) }));
  return { pq, revs: out };
}

/* a1.mjs pqMessage, rebuilt here from the format text, not imported */
const pqMsg = (canon, edHex) => Buffer.concat([Buffer.from('a1/v2/pq' + canon, 'utf8'), Buffer.from(edHex, 'hex')]);

/* a RANDOMIZED ed25519 signer (RFC 8032 arithmetic, fresh nonce): what a holder
   of the secret scalar can do that WebCrypto's deterministic signer never shows */
const EP = 2n ** 255n - 19n, EL = 2n ** 252n + 27742317777372353535851937790883648493n;
const emod = (a, m = EP) => ((a % m) + m) % m;
const epow = (b, e, m = EP) => { let r = 1n; b = emod(b, m); while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
const ED = emod(-121665n * epow(121666n, EP - 2n));
const EB = [15112221349535400772501151409588531511454012693041857206046113283949847762202n, 46316835694926478169428394003475163141307993866256225615783033603165251855960n]; /* PUBLIC-CONSTANT: RFC 8032 Ed25519 base point (x, y), public by definition */
const eadd = ([X1, Y1, Z1, T1], [X2, Y2, Z2, T2]) => {
  const A = emod((Y1 - X1) * (Y2 - X2)), B = emod((Y1 + X1) * (Y2 + X2)), C = emod(T1 * 2n * ED * T2), D = emod(Z1 * 2n * Z2);
  const E = B - A, F = D - C, G = D + C, H = B + A;
  return [emod(E * F), emod(G * H), emod(F * G), emod(E * H)];
};
const emul = (k) => { let R = [0n, 1n, 1n, 0n], Q = [EB[0], EB[1], 1n, emod(EB[0] * EB[1])]; while (k > 0n) { if (k & 1n) R = eadd(R, Q); Q = eadd(Q, Q); k >>= 1n; } return R; };
const leInt = (b) => b.reduceRight((n, x) => (n << 8n) + BigInt(x), 0n);
const intLe = (n) => { const o = Buffer.alloc(32); for (let i = 0; i < 32; i++) { o[i] = Number(n & 255n); n >>= 8n; } return o; };
const enc = ([X, Y, Z]) => { const zi = epow(Z, EP - 2n), x = emod(X * zi), y = emod(Y * zi), o = intLe(y); o[31] |= Number(x & 1n) << 7; return o; };
function edSignRandom(seed, msg) {
  const h = createHash('sha512').update(seed).digest(), a = Buffer.from(h.subarray(0, 32));
  a[0] &= 248; a[31] &= 127; a[31] |= 64;
  const s = leInt(a), A = enc(emul(s));
  const r = emod(leInt(webcrypto.getRandomValues(new Uint8Array(64))), EL), R = enc(emul(r));
  const k = emod(leInt(createHash('sha512').update(R).update(A).update(msg).digest()), EL);
  return Buffer.concat([R, intLe(emod(r + k * s, EL))]).toString('hex');
}

/* what an ed25519 forger can make: a revision with a valid ed25519 signature,
   and whatever ML-DSA-65 signature they can produce (or none) */
async function forge(m, base, pqSign) {
  const c = A1Canonical(base);
  const ed = Buffer.from(await webcrypto.subtle.sign({ name: 'Ed25519' }, m.priv, Buffer.from(c, 'utf8'))).toString('hex');
  const r = { ...base, sig_ed25519: ed };
  if (pqSign) r.sig_ml_dsa_65 = globalThis.BPQ.b64u(pqSign(pqMsg(c, ed)));
  return r;
}

test('v1 vectors are unchanged: same bytes, same hashes, same verdicts, same reasons', async () => {
  const m = await member('a1 v1 vector seed');
  assert.equal(Buffer.from(await webcrypto.subtle.exportKey('raw', m.pub)).toString('base64url'), V1.pub);
  const [r0, r1, r2] = await v1Chain(m);
  assert.deepEqual([r0, r1, r2].map((r) => b64u(A1.hashRevision(r))), V1.h);
  assert.equal(b64u(r0.sig_ed25519), V1.sig0);
  assert.deepEqual(Object.keys(r1).sort(), ['agent', 'body', 'prev', 'rev', 'sig_ed25519', 'ts', 'v']);

  const ok = await A1.verifyChain([r2, r0, r1], m.pub);
  assert.equal(ok.ok, true); assert.equal(ok.head, r2); assert.equal(b64u(ok.headHash), V1.h[2]);
  const tampered = structuredClone(r1); tampered.body.note = 'forged';
  assert.deepEqual(await A1.verifyChain([r0, tampered, r2], m.pub), { ok: false, reason: 'signature invalid at rev 1' });
  assert.deepEqual(await A1.verifyChain([r0, r2], m.pub), { ok: false, reason: 'hash chain breaks at rev 2' });
  assert.deepEqual(await A1.verifyChain([r0, { ...r1, v: 9 }], m.pub), { ok: false, reason: 'unknown a1 version at rev 1' });

  /* the store binding a v1 genesis gets is byte for byte the one minted before v2 */
  const binding = A1.storeBinding(r0, A1.hashRevision(r0));
  assert.equal(createHash('sha256').update(A1Canonical(binding)).digest('base64url'), V1.binding);

  /* the resolver reads v1 under v1 rules; a v1 chain cannot satisfy a pq pin */
  const res = await A1.resolveHead([r1, r2, r0, r1], m.pub, { legacyV1Unpinned: true });
  assert.equal(res.ok, true); assert.equal(res.head, r2); assert.equal(res.version, 1);
  assert.equal((await A1.resolveHead([r1, r2, r0, r1], m.pub, { genesisHash: A1.hashRevision(r0) })).head, r2);
  assert.match((await A1.resolveHead([r1, r2, r0, r1], m.pub)).reason, /reads against the certificate's pin/);
  assert.equal((await A1.verifyChain([r0, r1, r2], m.pub, { genesisHash: A1.hashRevision(r0) })).ok, true);
  const some = A1.a1PqKeys(m.seed, 'vector').id;
  assert.match((await A1.verifyChain([r0, r1, r2], m.pub, { pqId: some })).reason, /not a v2 chain/);
  assert.equal((await A1.resolveHead([r0, r1, r2], m.pub, { pqId: some })).ok, false);
  await assert.rejects(A1.appendRevision({ agent: 'vector', prevRevision: r2, body: {}, memberPrivateKey: m.priv, pqKeys: A1.a1PqKeys(m.seed, 'vector') }), /a v1 chain stays v1/);
});

test('v2 roundtrip: one genesis pins the PQ key, every revision carries both signatures over the same bytes', async () => {
  const m = await member('a1 v2 owner seed');
  const { pq, revs } = await v2Chain(m, 3);
  const [g, r1, r2] = revs;
  const P = globalThis.BPQ;
  assert.ok(P, 'a1.mjs loaded the estate PQ library');
  assert.equal(pq.context, 'a1:' + AGENT);
  assert.match(g.pq.id, /^bzpq1[02-9ac-hj-np-z]+$/);
  assert.deepEqual(Object.keys(g.pq).sort(), ['alg', 'dsa', 'id', 'succ']);
  assert.equal(g.pq.alg, 'ml-dsa-65');
  assert.equal(P.idFrom(P.unb64u(g.pq.dsa), P.unb64u(g.pq.succ)), g.pq.id, 'the pinned id is the bzpq1 id of its card fields');
  assert.deepEqual(r1.pq, { alg: 'ml-dsa-65', id: g.pq.id });
  for (const r of revs) {
    assert.equal(r.v, 2);
    assert.equal(P.unb64u(r.sig_ml_dsa_65).length, 3309);
    const { sig_ed25519, sig_ml_dsa_65, ...base } = r;
    const bytes = A1Canonical(base);
    assert.equal(await webcrypto.subtle.verify({ name: 'Ed25519' }, m.pub, Buffer.from(sig_ed25519, 'hex'), Buffer.from(bytes, 'utf8')), true);
    assert.equal(globalThis.BPQ_LIB.ml_dsa65.verify(P.unb64u(sig_ml_dsa_65), pqMsg(bytes, sig_ed25519), pq.dsa.publicKey), true);
    assert.equal(globalThis.BPQ_LIB.ml_dsa65.verify(P.unb64u(sig_ml_dsa_65), new TextEncoder().encode('a1/v2/pq' + bytes), pq.dsa.publicKey), false, 'the PQ signature covers the ed25519 one');
    assert.equal(globalThis.BPQ_LIB.ml_dsa65.verify(P.unb64u(sig_ml_dsa_65), new TextEncoder().encode(bytes), pq.dsa.publicKey), false, 'the PQ signature is domain-separated');
  }
  const gh = A1.hashRevision(g);
  for (const pins of [{ genesisHash: gh }, { pqId: g.pq.id }, { genesisHash: gh, pqId: g.pq.id }]) {
    const v = await A1.verifyChain([r2, g, r1], m.pub, pins);
    assert.equal(v.ok, true, JSON.stringify(v)); assert.equal(v.head, r2); assert.equal(v.pqId, g.pq.id);
    const res = await A1.resolveHead([r2, g, r1], m.pub, pins);
    assert.equal(res.ok, true); assert.equal(res.head, r2); assert.equal(res.version, 2); assert.equal(res.pqId, g.pq.id);
  }
  /* unanchored: a v2 chain is read against the certificate's pin, never without one */
  assert.match((await A1.verifyChain(revs, m.pub)).reason, /read against the certificate's pin/);
  assert.equal((await A1.resolveHead(revs, m.pub)).ok, false);
  /* the binding names the pinned id */
  const b = A1.storeBinding(g, gh);
  assert.deepEqual(b.a1_genesis, { rev: 0, sha256: gh, ts: g.ts, pq_id: g.pq.id });
  assert.match(b.binding, /^a1-log v2 — /);
  pq.wipe();
});

test('a revision with only ed25519 on a v2 chain is refused, and cannot become the head', async () => {
  const m = await member('a1 v2 owner seed');
  const { pq, revs } = await v2Chain(m, 3);
  const pins = { pqId: revs[0].pq.id };
  const base = { v: 2, agent: AGENT, rev: 3, prev: A1.hashRevision(revs[2]), body: { note: 'i am the memory now' }, ts: ts(3), pq: { alg: 'ml-dsa-65', id: revs[0].pq.id } };
  const edOnly = await forge(m, base, null);
  assert.match((await A1.verifyChain([...revs, edOnly], m.pub, pins)).reason, /holds exactly .* at rev 3/);
  /* an empty or junk PQ field is no better */
  const junk = { ...edOnly, sig_ml_dsa_65: Buffer.alloc(3309).toString('base64url') };
  assert.match((await A1.verifyChain([...revs, junk], m.pub, pins)).reason, /ML-DSA-65 signature does not verify under the pinned key at rev 3/);
  const res = await A1.resolveHead([...revs, edOnly, junk], m.pub, pins);
  assert.equal(res.ok, true); assert.equal(res.head, revs[2], 'the head stays the owner\'s rev 2');
  assert.equal(res.ignored.length, 2);
  /* the API will not make one either */
  await assert.rejects(A1.appendRevision({ agent: AGENT, prevRevision: revs[2], body: {}, memberPrivateKey: m.priv }), /needs the agent's PQ keys/);
  pq.wipe();
});

test('a forged PQ signature is refused: the forger\'s own ML-DSA key, a flipped bit, a replayed signature', async () => {
  const m = await member('a1 v2 owner seed');
  const { pq, revs } = await v2Chain(m, 3);
  const pins = { genesisHash: A1.hashRevision(revs[0]) };
  const theirs = A1.a1PqKeys(seedOf('attacker seed'), AGENT);
  const base = { v: 2, agent: AGENT, rev: 3, prev: A1.hashRevision(revs[2]), body: { note: 'forged' }, ts: ts(3), pq: { alg: 'ml-dsa-65', id: revs[0].pq.id } };
  const ownKey = await forge(m, base, (msg) => theirs.dsa.sign(msg));
  const flipped = structuredClone(revs[2]);
  const sig = globalThis.BPQ.unb64u(flipped.sig_ml_dsa_65); sig[100] ^= 1; flipped.sig_ml_dsa_65 = globalThis.BPQ.b64u(sig);
  const replay = await forge(m, base, null); replay.sig_ml_dsa_65 = revs[2].sig_ml_dsa_65;
  for (const [bad, chain] of [[ownKey, [...revs, ownKey]], [flipped, [revs[0], revs[1], flipped]], [replay, [...revs, replay]]]) {
    const v = await A1.verifyChain(chain, m.pub, pins);
    assert.equal(v.ok, false); assert.match(v.reason, /ML-DSA-65 signature does not verify under the pinned key/);
    const res = await A1.resolveHead([...revs, bad], m.pub, pins);
    assert.equal(res.head, revs[2]);
  }
  /* a flipped bit in the middle cuts everything above it */
  const res = await A1.resolveHead([revs[0], revs[1], flipped, ...(await v2ChainFrom(m, pq, flipped, 2))], m.pub, pins);
  assert.equal(res.ok, true); assert.equal(res.head, revs[1], 'nothing built on an invalid revision counts');
  assert.equal(res.ignored.length, 1, 'the revisions above the bad one are never reached');
  pq.wipe(); theirs.wipe();
});
async function v2ChainFrom(m, pq, from, n) {
  const out = []; let prev = from;
  for (let i = 0; i < n; i++) { prev = await A1.appendRevision({ agent: AGENT, prevRevision: prev, body: { i }, memberPrivateKey: m.priv, pqKeys: pq, ts: ts(10 + i) }); out.push(prev); }
  return out;
}

test('a wrong pinned id is refused: the certificate\'s pin, the genesis\'s own id, a later revision\'s id', async () => {
  const m = await member('a1 v2 owner seed');
  const { pq, revs } = await v2Chain(m, 3);
  const theirs = A1.a1PqKeys(seedOf('attacker seed'), AGENT);
  /* 1 · the certificate pins another id than this genesis */
  assert.match((await A1.verifyChain(revs, m.pub, { pqId: theirs.id })).reason, /pins a different pq id than the certificate/);
  /* 2 · a genesis naming an id its key does not hash to */
  const g = revs[0], lie = { ...g, pq: { ...g.pq, id: theirs.id } };
  const lieG = await forge(m, (({ sig_ed25519, sig_ml_dsa_65, ...b }) => b)(lie), (msg) => pq.dsa.sign(msg));
  assert.match((await A1.verifyChain([lieG], m.pub, { genesisHash: A1.hashRevision(lieG) })).reason, /pinned pq id does not match its key/);
  /* 3 · the forger's whole new genesis under their own PQ key, and a longer chain on it */
  const fg = await A1.genesisRevisionV2({ agent: AGENT, body: { note: 'mine now' }, memberPrivateKey: m.priv, pqKeys: theirs, ts: ts(0) });
  const fchain = [fg, ...(await v2ChainFrom(m, theirs, fg, 5))];
  assert.equal((await A1.verifyChain(fchain, m.pub, { pqId: theirs.id })).ok, true, 'internally consistent — which is why the pin decides');
  for (const pins of [{ pqId: g.pq.id }, { genesisHash: A1.hashRevision(g) }]) {
    const res = await A1.resolveHead([...fchain, ...revs], m.pub, pins);
    assert.equal(res.ok, true); assert.equal(res.head, revs[2], 'the pinned chain wins though the forged one is longer');
  }
  /* 4 · a later revision naming the forger's id (signed by the forger's key) on the owner's chain */
  const base = { v: 2, agent: AGENT, rev: 3, prev: A1.hashRevision(revs[2]), body: {}, ts: ts(3), pq: { alg: 'ml-dsa-65', id: theirs.id } };
  const swapped = await forge(m, base, (msg) => theirs.dsa.sign(msg));
  assert.match((await A1.verifyChain([...revs, swapped], m.pub, { pqId: g.pq.id })).reason, /names a pq id other than the one pinned at genesis at rev 3/);
  await assert.rejects(A1.appendRevision({ agent: AGENT, prevRevision: revs[2], body: {}, memberPrivateKey: m.priv, pqKeys: theirs }), /not the key this chain pinned/);
  assert.throws(() => A1.a1PqKeys(m.seed, ''), /non-empty/);
  await assert.rejects(A1.genesisRevisionV2({ agent: 'another agent', body: {}, memberPrivateKey: m.priv, pqKeys: pq }), /derived for context/);
  pq.wipe(); theirs.wipe();
});

test('a chain never mixes versions: v1 on a v2 genesis, v2 on a v1 genesis', async () => {
  const m = await member('a1 v2 owner seed');
  const { pq, revs } = await v2Chain(m, 2);
  const pins = { genesisHash: A1.hashRevision(revs[0]) };
  /* a v1 revision (all v1 asks for: one ed25519 signature) on the v2 chain */
  const v1on2 = await forge(m, { v: 1, agent: AGENT, rev: 2, prev: A1.hashRevision(revs[1]), body: { note: 'downgrade' }, ts: ts(2) }, null);
  assert.deepEqual(await A1.verifyChain([...revs, v1on2], m.pub, pins), { ok: false, reason: 'mixed chain: a v1 revision on a v2 genesis at rev 2' });
  const res = await A1.resolveHead([...revs, v1on2], m.pub, pins);
  assert.equal(res.head, revs[1]); assert.match(res.ignored[0].why, /mixed chain/);
  /* a v2 revision, both signatures good, on a v1 genesis */
  const g1 = await A1.genesisRevision({ agent: AGENT, body: {}, memberPrivateKey: m.priv, ts: ts(0) });
  const v2on1 = await forge(m, { v: 2, agent: AGENT, rev: 1, prev: A1.hashRevision(g1), body: {}, ts: ts(1), pq: { alg: 'ml-dsa-65', id: pq.id } }, (msg) => pq.dsa.sign(msg));
  assert.deepEqual(await A1.verifyChain([g1, v2on1], m.pub), { ok: false, reason: 'mixed chain: a v2 revision on a v1 genesis at rev 1' });
  const r1 = await A1.resolveHead([g1, v2on1], m.pub, { legacyV1Unpinned: true });
  assert.equal(r1.head, g1); assert.match(r1.ignored[0].why, /mixed chain/);
  /* unknown versions and algorithms are refused, never defaulted */
  const v3 = { ...revs[1], v: 3 };
  assert.match((await A1.verifyChain([revs[0], v3], m.pub, pins)).reason, /unknown a1 version at rev 1/);
  const alg = await forge(m, { v: 2, agent: AGENT, rev: 2, prev: A1.hashRevision(revs[1]), body: {}, ts: ts(2), pq: { alg: 'ml-dsa-87', id: pq.id } }, (msg) => pq.dsa.sign(msg));
  assert.match((await A1.verifyChain([...revs, alg], m.pub, pins)).reason, /unknown post-quantum algorithm/);
  assert.throws(() => A1.storeBinding({ v: 3 }, 'x'), /unknown a1 version/);
  pq.wipe();
});

test('the resolver: highest valid revision among valid chains only; a replay loses; a fork is named, not picked', async () => {
  const m = await member('a1 v2 owner seed');
  const { pq, revs } = await v2Chain(m, 3);
  const pins = { pqId: revs[0].pq.id };
  /* replays and duplicates change nothing */
  const res = await A1.resolveHead([revs[1], revs[0], revs[2], revs[1], revs[0]], m.pub, pins);
  assert.equal(res.ok, true); assert.equal(res.head, revs[2]); assert.equal(res.ignored.length, 0);
  /* junk in the set is ignored, never fatal */
  const withJunk = await A1.resolveHead([null, 7, 'x', { prev: '' }, { rev: 0, prev: '', v: 2 }, ...revs], m.pub, pins);
  assert.equal(withJunk.head, revs[2]);
  /* the owner signs two different rev 3s: a fork the ruling breaks by content-hash order, direction unruled */
  const a = await A1.appendRevision({ agent: AGENT, prevRevision: revs[2], body: { branch: 'a' }, memberPrivateKey: m.priv, pqKeys: pq, ts: ts(3) });
  const b = await A1.appendRevision({ agent: AGENT, prevRevision: revs[2], body: { branch: 'b' }, memberPrivateKey: m.priv, pqKeys: pq, ts: ts(3) });
  const fork = await A1.resolveHead([...revs, a, b], m.pub, pins);
  assert.equal(fork.ok, false); assert.match(fork.reason, /^fork at rev 3: 2 valid revisions/);
  assert.deepEqual(fork.fork, [A1.hashRevision(a), A1.hashRevision(b)].sort());
  /* height settles it */
  const c = await A1.appendRevision({ agent: AGENT, prevRevision: b, body: { on: 'b' }, memberPrivateKey: m.priv, pqKeys: pq, ts: ts(4) });
  const settled = await A1.resolveHead([...revs, a, b, c], m.pub, pins);
  assert.equal(settled.ok, true); assert.equal(settled.head, c);
  /* verifyChain is for exactly one chain: a fork in the given set is refused there */
  assert.match((await A1.verifyChain([...revs, a, b], m.pub, pins)).reason, /fork or gap at rev 3/);
  assert.deepEqual(await A1.verifyChain([], m.pub), { ok: false, reason: 'no revisions' });
  /* a malformed pin is the caller's error, said as one */
  await assert.rejects(A1.verifyChain(revs, m.pub, { genesisHash: 'not hex' }), TypeError);
  await assert.rejects(A1.resolveHead(revs, m.pub, { pqId: 'bzpq1' + 'b'.repeat(10) }), TypeError);
  pq.wipe();
});

test('an ed25519 forger cannot twin a v2 revision: the ML-DSA-65 signature binds the ed25519 one', async () => {
  const m = await member('a1 v2 owner seed');
  const { revs } = await v2Chain(m, 3);
  const g = revs[0];
  const twin = async (r) => {
    const { sig_ed25519, sig_ml_dsa_65, ...base } = r;
    const c = Buffer.from(A1Canonical(base), 'utf8');
    const ed2 = edSignRandom(m.seed, c);
    assert.notEqual(ed2, sig_ed25519, 'a fresh nonce gives a different ed25519 signature');
    assert.equal(await webcrypto.subtle.verify({ name: 'Ed25519' }, m.pub, Buffer.from(ed2, 'hex'), c), true, 'and it is a valid one');
    return { ...base, sig_ed25519: ed2, sig_ml_dsa_65 };
  };
  const t2 = await twin(revs[2]);
  assert.notEqual(A1.hashRevision(t2), A1.hashRevision(revs[2]));
  const atHead = await A1.resolveHead([...revs, t2], m.pub, { genesisHash: A1.hashRevision(g) });
  assert.equal(atHead.ok, true, JSON.stringify(atHead.reason)); assert.equal(atHead.head, revs[2]);
  assert.ok(atHead.ignored.some((i) => i.hash === A1.hashRevision(t2)), 'the twin is ignored, not a fork');
  assert.equal((await A1.verifyChain([g, revs[1], t2], m.pub, { genesisHash: A1.hashRevision(g) })).ok, false);
  const tg = await twin(g);
  const atGenesis = await A1.resolveHead([...revs, tg], m.pub, { pqId: g.pq.id });
  assert.equal(atGenesis.ok, true, JSON.stringify(atGenesis.reason)); assert.equal(atGenesis.head, revs[2]);
  assert.equal((await A1.verifyChain([tg], m.pub, { pqId: g.pq.id })).ok, false);
});

test('resolveHead never reads without the certificate pin: a forged v1 genesis cannot take over a v2 store', async () => {
  const m = await member('a1 v2 owner seed');
  const { revs } = await v2Chain(m, 3);
  const forged = await A1.genesisRevision({ agent: AGENT, body: { n: 'attacker' }, memberPrivateKey: m.priv, ts: ts(9) });
  const store = [...revs, forged];
  const bare = await A1.resolveHead(store, m.pub);
  assert.equal(bare.ok, false); assert.match(bare.reason, /reads against the certificate's pin/);
  const pinned = await A1.resolveHead(store, m.pub, { genesisHash: A1.hashRevision(revs[0]) });
  assert.equal(pinned.ok, true); assert.equal(pinned.head, revs[2]); assert.equal(pinned.version, 2);
  const byId = await A1.resolveHead(store, m.pub, { pqId: revs[0].pq.id });
  assert.equal(byId.ok, true); assert.equal(byId.head, revs[2]);
  await assert.rejects(A1.resolveHead(store, m.pub, { legacyV1Unpinned: 'yes' }), /legacyV1Unpinned/);
});
