// Real frozen-organ interoperability. Missing binary is a failure, never skip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acceptUpdate, signingBytes, commitment } from './contract.mjs';
import { verifyEnvelope } from './signature.mjs';
import { fixture } from './fixtures.mjs';

test('native bSigner authorizes an offline repository update through the frozen envelope', t => {
  const bin = process.env.REPOSITORY_BSIGNER_BIN; assert.ok(bin, 'REPOSITORY_BSIGNER_BIN must name the built frozen bsigner organ');
  const root = mkdtempSync(join(tmpdir(), 'repository-bsigner-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  // TEST-ONLY public recovery fixture, passed by environment as the organ requires.
  const env = { ...process.env, REPOSITORY_TEST_REC: 'bdidrec1q9r0n4djklfz8l57r3mtajrstnze98jxsa37w2l980tn6xkljllvkh5lf9u' };
  const organ = args => { const r = spawnSync(resolve(bin), args, { encoding: 'utf8', windowsHide: true, env }); assert.equal(r.status, 0, r.error?.message ?? r.stderr); return JSON.parse(r.stdout); };
  const publicResult = organ(['keygen', '--alg', 'ml-dsa-65', '--keydir', root, '--rec-env', 'REPOSITORY_TEST_REC']);
  assert.ok(!JSON.stringify(publicResult).includes('seed'));
  const id = publicResult.key_id;
  const stored = JSON.parse(readFileSync(join(root, id + '.json'), 'utf8'));
  const key = { id, alg: 'ml-dsa-65', public_key: stored.verifying_key_b64u };
  const f = fixture(); f.policy.keys = [key]; f.policy.update_keys = [id]; f.policy.suites[0].executor_keys = [id];
  f.state.policy_digest = commitment('policy', f.policy); f.trustedStateDigest = commitment('state', f.state);
  f.proposal.previous_state = f.trustedStateDigest; f.proposal.policy_digest = f.state.policy_digest;
  f.evidence[0].statement.proposal_digest = commitment('proposal', f.proposal);
  const sign = (kind, value) => {
    const bytes = signingBytes(kind, value), file = join(root, kind + '.bytes'), out = join(root, kind + '.json'); writeFileSync(file, bytes);
    organ(['sign', '--key-id', id, '--file', file, '--keydir', root, '--out', out, '--rec-env', 'REPOSITORY_TEST_REC']);
    const envelope = JSON.parse(readFileSync(out, 'utf8')); assert.equal(verifyEnvelope(key, bytes, envelope), true, 'noble verifies RustCrypto bheart.signature/1');
    const checked = organ(['verify', '--key-id', id, '--file', file, '--envelope', out, '--keydir', root]); assert.equal(checked.verified, true);
    assert.equal(verifyEnvelope(key, Buffer.concat([bytes, Buffer.from('tampered')]), envelope), false);
    return envelope;
  };
  f.signatures = [sign('proposal', f.proposal)]; f.evidence[0].envelope = sign('evidence', f.evidence[0].statement);
  const result = acceptUpdate(f); assert.equal(result.accepted, true, JSON.stringify(result));
  f.proposal.ref = 'refs/heads/attacker'; assert.equal(acceptUpdate(f).accepted, false);
});
