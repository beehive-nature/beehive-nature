// render-badges.test.mjs — the proof-lights gate against known forgeries (review of #250, 2026-09-27).
//
// Each probe copies docs/status/ to a scratch dir, forges one thing the way an
// editor (or a careless regeneration) would, and runs the real `--check` over it.
// Every forgery below PASSED the first gate (4ad06132): it compared the SVG with
// the document and never re-derived the document from its evidence. A badge is
// only as honest as the weakest link in revision -> evidence -> document -> SVG,
// so each link has a probe that must turn the per-badge line to FAIL and the exit
// nonzero. The control proves the probes fail for their forgery, not for the harness.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATUS = join(HERE, '..', 'docs', 'status');
const DOC = 'skaists-meter.json', EV = 'skaists-meter.source.json', SVG = 'skaists-meter.svg';
const blobId = b => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const sha3 = b => createHash('sha3-256').update(b).digest('hex');

async function probe(forge, opts = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'proof-lights-'));
  try {
    await cp(opts.signed ? opts.signed : STATUS, dir, { recursive: true });
    const doc = JSON.parse(await readFile(join(dir, DOC), 'utf8'));
    const put = d => writeFile(join(dir, DOC), JSON.stringify(d, null, 1) + '\n');
    // re-seal the evidence the way a forger would: new bytes, matching blob id and digest
    const reseal = async bytes => {
      await writeFile(join(dir, EV), bytes);
      doc.source_blob = blobId(bytes);
      doc.source_digest = { ...doc.source_digest, value: sha3(bytes) };
    };
    await forge({ dir, doc, put, reseal });
    const args = [join(HERE, 'render-badges.mjs'), '--check', '--dir', dir];
    if (opts.trust) args.push('--trust', opts.trust);
    if (opts.verifier) args.push('--verifier', opts.verifier);
    const env = { ...process.env, ...(opts.env || {}) };
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', env });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
const refused = (r, why) => {
  assert.notEqual(r.code, 0, `gate exited 0:\n${r.out}`);
  // scoped to the forged document: a second, untouched badge may legitimately PASS beside it
  assert.doesNotMatch(r.out, /^PASS skaists-meter\.json/m, `the forged badge's line still says PASS:\n${r.out}`);
  assert.match(r.out, /^FAIL skaists-meter\.json/m, `the forged badge has no FAIL line:\n${r.out}`);
  assert.match(r.out, why, r.out);
};

test('control: the committed badge passes, re-derived from its evidence', async () => {
  const r = await probe(() => {});
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^PASS skaists-meter\.json: .*re-derived from 321 evidence rows/m);
});

test('deleted evidence fails (it used to print PASS with "no source file committed")', async () => {
  refused(await probe(({ dir }) => rm(join(dir, EV))), /evidence .* is missing or unreadable/);
});

test('inflated counts + message with a matching SVG fail: the document is re-derived, not trusted', async () => {
  refused(await probe(async ({ dir, doc, put }) => {
    Object.assign(doc, { fronts: 999, fronts_at_100: 999, message: '999/999 fronts 100% @7d6808d' });
    await put(doc);
    const { makeBadge } = createRequire(import.meta.url)('badge-maker');
    await writeFile(join(dir, SVG), makeBadge({ label: doc.label, message: doc.message, color: doc.color, style: 'flat' }));
  }), /fronts is 999, evidence derives 321/);
});

test('a well-formed but nonexistent revision fails: forty hex chars are not a commit', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, revision: '0'.repeat(40) })), /is not a commit in this repository/);
});

test('a supplied signature fails as unverified and does not hide the unsigned state', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, signature: { alg: 'rot13', value: 'trust me' } })), /origin local documents are unsigned by definition/);
});

test('non-JSON evidence fails even with its blob id and digest updated to match', async () => {
  refused(await probe(async ({ doc, put, reseal }) => { await reseal(Buffer.from('not json\n')); await put(doc); }), /evidence is not JSON/);
});

test('a source-hash mismatch turns the per-badge line to FAIL, not only the exit code', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, source_blob: 'f'.repeat(40) })), /source blob mismatch/);
});

test('a SHA-1-only rebind fails: the sha3-256 digest is the integrity commitment', async () => {
  refused(await probe(async ({ dir, doc, put }) => {
    const bytes = Buffer.concat([await readFile(join(dir, EV)), Buffer.from(' ')]);   // any edit, SHA-1 locator updated
    await writeFile(join(dir, EV), bytes);
    await put({ ...doc, source_blob: blobId(bytes) });
  }), /source digest mismatch/);
});

test('a duplicated row cannot stand in for a missing one: coverage is checked against the manifest', async () => {
  refused(await probe(async ({ dir, doc, put, reseal }) => {
    const rows = JSON.parse(await readFile(join(dir, EV), 'utf8'));
    rows[1] = rows[0];   // same count, one front measured twice, one never
    await reseal(Buffer.from(JSON.stringify(rows, null, 1) + '\n'));
    await put(doc);
  }), /coverage: .* measured 2 times[\s\S]*not measured/);
});

test('a malformed row fails the evidence schema', async () => {
  refused(await probe(async ({ dir, doc, put, reseal }) => {
    const rows = JSON.parse(await readFile(join(dir, EV), 'utf8'));
    rows[5].score.COLOUR = 'green';
    await reseal(Buffer.from(JSON.stringify(rows, null, 1) + '\n'));
    await put(doc);
  }), /evidence row 5: score is not the six kinds/);
});

test('a CI-origin claim without a signature fails: the run binding is unproven', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, measurement: { origin: 'ci', run_id: 1, run_attempt: 1 } })), /measurement origin ci requires a signature/);
});

test('forged fixed metadata fails: the renderer and the law are exactly what derive writes', async () => {
  refused(await probe(({ doc, put }) => put({ ...doc, renderer: 'badge-maker 9.9.9 (live, signed)' })), /renderer is .* the installed renderer is badge-maker/);
  refused(await probe(({ doc, put }) => put({ ...doc, law: 'live status, signed by the founder' })), /law is not the fixed statement/);
  refused(await probe(({ doc, put }) => put({ ...doc, law: { live: true } })), /law is not the fixed statement/);
});

test('an inherited property name is not a badge: the check reports it, it does not crash', async () => {
  for (const name of ['constructor', '__proto__', 'toString']) {
    const r = await probe(({ doc, put }) => put({ ...doc, name }));
    refused(r, /no derivation for badge/);
    assert.doesNotMatch(r.out, /TypeError|at verify/, r.out);
  }
});

test('measured_at must be a canonical UTC timestamp: Date.parse leniency is refused', async () => {
  for (const t of ['0', '2026-02-31T00:00:00.000Z', '2026-99-01T00:00:00.000Z', '2026-09-27T25:00:00.000Z', '2026-09-27', 'Sep 27 2026']) {
    refused(await probe(({ doc, put }) => put({ ...doc, measured_at: t })), /measured_at .* is not a canonical ISO-8601 UTC timestamp/);
  }
});

test('a malformed document fails alone: the check continues and the good badge still passes', async () => {
  for (const body of ['null', '[]', '42', '"text"']) {
    const r = await probe(({ dir }) => writeFile(join(dir, 'aa-malformed.json'), body + '\n'));
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /^FAIL aa-malformed\.json: \n  - document is not a JSON object/m, r.out);
    assert.match(r.out, /^PASS skaists-meter\.json/m, `the check stopped at the malformed document:\n${r.out}`);
    assert.match(r.out, /1\/2 badges/, r.out);
  }
});

test('an all-clear row cannot hide a failed kind: no findings means every kind is 100', async () => {
  refused(await probe(async ({ dir, doc, put, reseal }) => {
    const rows = JSON.parse(await readFile(join(dir, EV), 'utf8'));
    const i = rows.findIndex(r => r.total === 100 && r.bad.length === 0);
    rows[i].score.COLOUR = 0;   // total 100 still sits between the kind extremes [0, 100]
    await reseal(Buffer.from(JSON.stringify(rows, null, 1) + '\n'));
    await put({ ...doc, kind_min: { ...doc.kind_min, COLOUR: 0 } });   // the derivation agrees, so only the row law can catch it
  }), /all-clear row with a kind below 100 \(COLOUR\)/);
});

test('a renamed status trio fails: the file name is the badge name', async () => {
  const r = await probe(async ({ dir }) => {
    for (const x of ['.json', '.source.json', '.svg']) await cp(join(dir, 'skaists-meter' + x), join(dir, 'other' + x));
    for (const x of ['.json', '.source.json', '.svg']) await rm(join(dir, 'skaists-meter' + x));
  });
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /^FAIL other\.json: .*\n  - file other\.json does not carry the document's name "skaists-meter"/m, r.out);
  assert.doesNotMatch(r.out, /^PASS /m, r.out);
});

test('evidence that parses to null cannot skip the derivation (independent review, 048f98c)', async () => {
  refused(await probe(async ({ dir, doc, put, reseal }) => {
    await reseal(Buffer.from('null\n'));
    Object.assign(doc, { fronts: 9999, fronts_at_100: 9999, surfaces: 9999, message: '9999/9999 fronts 100% @7d6808d' });
    await put(doc);
    const { makeBadge } = createRequire(import.meta.url)('badge-maker');
    await writeFile(join(dir, SVG), makeBadge({ label: doc.label, message: doc.message, color: doc.color, style: 'flat' }));
  }), /evidence is not an array of rows[\s\S]*not re-derived from its evidence/);
});

test('an SVG with no status document beside it is refused, not ignored', async () => {
  const r = await probe(({ dir }) => writeFile(join(dir, 'telemetry.svg'), '<svg>telemetry | none</svg>\n'));
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /^FAIL telemetry\.svg: no status document telemetry\.json beside it/m, r.out);
});

test('an SVG-only edit fails', async () => {
  refused(await probe(async ({ dir }) => {
    const s = await readFile(join(dir, SVG), 'utf8');
    await writeFile(join(dir, SVG), s.replace('321/321', '322/321'));
  }), /svg DIFFERS from render\(json\)/);
});

test('zero status documents fail closed', async () => {
  const r = await probe(async ({ dir }) => { for (const f of await readdir(dir)) await rm(join(dir, f)); });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /REFUSING — no status documents/);
});

/* ---- the CI-signing card's probes (2026-09-30) ------------------------------ */
//
// The card (docs/dispatches/2026-09-27-proof-lights-gate-repair.md, "The
// CI-signing card") names six negative probes — wrong key, unknown key id,
// expired key, revoked key, a signature over altered bytes, a CI run whose
// head_sha differs from the document's revision — plus the controls. Everything
// here runs on DISPOSABLE keys generated at test time by the estate's own
// signer (bsigner keygen, ml-dsa-65): no private key material is committed,
// printed, or written anywhere but the scratch dir, which is removed. The seed
// travels process-env to child processes only (the same delivery law as
// production, minus the secret).
//
// The rig is built ONCE (keygen x2, stage, sign — all fast) and shared; each
// probe copies the SIGNED trio into its own scratch dir, forges one thing, and
// runs the real --check with a forged or variant trust file.
const BIN = join(HERE, '..', 'target', 'debug', process.platform === 'win32' ? 'bsigner.exe' : 'bsigner');
const run2 = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', cwd: HERE, ...opts });
assert.ok(existsSync(BIN),
  `the signature probes need the estate's signer built first: cargo build --locked -p bsigner (looked for ${BIN}). A missing verifier is a dependency gap to name, never a probe to skip.`);

const REV = '7d6808d87c6b78343e2471aa38581146f5aa6c03';   // the revision the committed evidence measured
const rigDir = await mkdtemp(join(tmpdir(), 'proof-lights-signing-'));
const keysDir = join(rigDir, 'keys');
const keygenOf = alg => {
  const r = run2(BIN, ['keygen', '--alg', alg, '--keydir', keysDir]);
  assert.equal(r.status, 0, `keygen ${alg}: ${r.stdout}${r.stderr}`);
  return JSON.parse(r.stdout);
};
const keyA = keygenOf('ml-dsa-65');   // the trusted signer
const keyB = keygenOf('ml-dsa-65');   // the wrong key
const seedOf = async kid => JSON.parse(await readFile(join(keysDir, `${kid}.json`), 'utf8')).seed_b64u;
const trustFile = async (name, keys, revoked = []) => {
  const p = join(rigDir, name);
  await writeFile(p, JSON.stringify({
    schema: 'proof-lights/trust/1',
    keys,
    revoked,
    law: 'probe trust — disposable keys, generated and destroyed by render-badges.test.mjs',
  }, null, 1) + '\n');
  return p;
};
const pin = (k, from, until) => ({ key_id: k.key_id, alg: 'ml-dsa-65', verifying_key_b64u: k.verifying_key_b64u,
  valid_from: from, valid_until: until, purpose: 'ci-attestation', note: 'disposable probe key' });
const WIDE = ['2020-01-01T00:00:00.000Z', '2040-01-01T00:00:00.000Z'];
const trustGood = await trustFile('trust-good.json', [pin(keyA, ...WIDE)]);
const trustWrong = await trustFile('trust-wrong.json', [pin(keyB, ...WIDE)]);
const trustRevoked = await trustFile('trust-revoked.json', [pin(keyA, ...WIDE)], [keyA.key_id]);
const trustExpired = await trustFile('trust-expired.json', [pin(keyA, '2020-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')]);
const trustFuture = await trustFile('trust-future.json', [pin(keyA, '2030-01-01T00:00:00.000Z', '2040-01-01T00:00:00.000Z')]);

// stage the unsigned ci document from the committed evidence, then sign it with keyA
const stageDir = join(rigDir, 'stage'), signedDir = join(rigDir, 'signed');
{
  const st = run2(process.execPath, ['render-badges.mjs', 'meter', '--from', '../docs/status/skaists-meter.source.json',
    '--revision', REV, '--origin', 'ci', '--run-id', '4242', '--run-attempt', '1', '--stage', stageDir]);
  assert.equal(st.status, 0, `staging the ci document failed:\n${st.stdout}${st.stderr}`);
  const sg = run2(process.execPath, ['sign-badges.mjs', '--stage', stageDir, '--out', signedDir, '--expect-sha', REV,
    '--trust', trustGood, '--seed-env', 'PROBE_SEED', '--verifier', BIN], { env: { ...process.env, PROBE_SEED: await seedOf(keyA.key_id) } });
  assert.equal(sg.status, 0, `signing the staged document failed:\n${sg.stdout}${sg.stderr}`);
}
// the rig is checked at teardown; probes below only read from it
after(() => rm(rigDir, { recursive: true, force: true }));

const probeSigned = (forge, opts = {}) => probe(forge, { signed: signedDir, trust: trustGood, ...opts });

test('control: a properly signed ci-origin badge passes with the signature provenance', async () => {
  const r = await probeSigned(() => {});
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /PASS skaists-meter\.json: .*origin ci \(run 4242 attempt 1; the CI-attestation signature binds them to 7d6808d\) · signed by \S+ \(ml-dsa-65, valid at signing time, not revoked\)/, r.out);
});

test('a signature by a key the trust does not pin fails (wrong key)', async () => {
  refused(await probeSigned(() => {}, { trust: trustWrong }), /signature key_id \S+ is not in the trust configuration/);
});

test('an unknown key id fails, whatever bytes the signature carries', async () => {
  refused(await probeSigned(async ({ dir, doc, put }) => {
    doc.signature.key_id = 'bheart-0000000000000000';
    await put(doc);
  }), /signature key_id bheart-0000000000000000 is not in the trust configuration/);
});

test('an expired key fails: validity is judged at signing time', async () => {
  refused(await probeSigned(() => {}, { trust: trustExpired }), /was not valid at signing time/);
});

test('a key that is not valid yet fails the same way', async () => {
  refused(await probeSigned(() => {}, { trust: trustFuture }), /was not valid at signing time/);
});

test('a revoked key fails absolutely', async () => {
  refused(await probeSigned(() => {}, { trust: trustRevoked }), /signature key \S+ is revoked/);
});

test('a signature over altered bytes fails on the digest mismatch', async () => {
  // measured_at is not derived from evidence, so ONLY the signature can catch
  // this edit: one millisecond of drift and the signed canonical bytes differ
  refused(await probeSigned(async ({ doc, put }) => {
    doc.measured_at = '2026-09-27T05:13:54.467Z';
    await put(doc);
  }), /signature does not verify \(content digest mismatch/);
});

test('a signed document stripped of its signature fails: origin ci requires one', async () => {
  refused(await probeSigned(async ({ doc, put }) => {
    doc.signature = null;
    await put(doc);
  }), /measurement origin ci requires a signature/);
});

test('a signature on a local-origin document fails: assertions are never attested', async () => {
  refused(await probeSigned(async ({ doc, put }) => {
    doc.measurement = { origin: 'local', run_id: null, run_attempt: null };
    await put(doc);
  }), /origin local documents are unsigned by definition/);
});

test('a broken verifier binary fails closed, it does not pass unchecked', async () => {
  const notAnExe = join(rigDir, 'not-an-executable.txt');
  await writeFile(notAnExe, 'this exists but cannot verify anything\n');
  refused(await probeSigned(() => {}, { verifier: notAnExe }), /signature does not verify \(bsigner verify-env gave no verdict\)/);
});

test('a malformed trust configuration refuses the whole check, not one badge', async () => {
  const bad = join(rigDir, 'trust-bad.json');
  await writeFile(bad, '{ "schema": "proof-lights/trust/1", "keys": "not-an-array" }\n');
  const r = await probeSigned(() => {}, { trust: bad });
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /REFUSING — trust configuration .* does not validate/, r.out);
});

/* ---- the signing job's own refusals (e2e/sign-badges.mjs) -------------------- */

const signRun = async (opts = {}) => {
  const env = { ...process.env };
  if (opts.noSeed) delete env.PROBE_SEED; else env.PROBE_SEED = await seedOf(keyA.key_id);
  return run2(process.execPath, ['sign-badges.mjs', '--stage', stageDir, '--out', join(rigDir, 'out-' + Math.random().toString(36).slice(2)),
    '--expect-sha', opts.expectSha || REV, '--trust', opts.trust || trustGood, '--seed-env', 'PROBE_SEED', '--verifier', BIN], { env });
};

test('the signing job refuses a document whose revision is not the run\'s head_sha', async () => {
  const r = await signRun({ expectSha: '0123456789abcdef0123456789abcdef01234567' });
  assert.notEqual(r.status, 0, `signed a revision the run did not check out:\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /REFUSING — .*revision \S+ is not the run's head/, r.stderr);
});

test('the signing job refuses to sign with a key the trust does not pin', async () => {
  const r = await signRun({ trust: trustWrong });
  assert.notEqual(r.status, 0, `signed with an unpinned key:\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /REFUSING — the environment's key \S+ is not pinned/, r.stderr);
});

test('the signing job refuses an already-signed document', async () => {
  // stage a second unsigned doc set? simpler: point --stage at the SIGNED dir
  const r = run2(process.execPath, ['sign-badges.mjs', '--stage', signedDir, '--out', join(rigDir, 'out-resign'),
    '--expect-sha', REV, '--trust', trustGood, '--seed-env', 'PROBE_SEED', '--verifier', BIN],
    { env: { ...process.env, PROBE_SEED: await seedOf(keyA.key_id) } });
  assert.notEqual(r.status, 0, `re-signed an already-signed document:\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /REFUSING — .*already carries a signature/, r.stderr);
});

test('without a seed in the environment the signing job skips BY NAME, exit 0', async () => {
  const r = await signRun({ noSeed: true });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /no PROBE_SEED in the environment — nothing to sign/, r.stdout);
});
