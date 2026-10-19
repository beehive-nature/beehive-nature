#!/usr/bin/env node
// Peer-local commands only. No listener, default RPC, signing, spending or push.
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CheckpointStore } from './checkpoint.mjs';
import { DEFAULT_MAX_BYTES, loadPackage, readDocument } from './package.mjs';
import { canonicalDocument, need, commitment, record } from './contract.mjs';
import { retrieveBundle, notice } from './storage.mjs';
import { hiveOperation, syncHiveBlock } from './hive.mjs';
import { nativeReader, verifyOwner } from './providers.mjs';
import { repositoryPrivacy } from './privacy.mjs';

export async function main(args) {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: Object.fromEntries(
    ['database', 'bootstrap', 'package', 'packet', 'checkpoint', 'pointer', 'readers', 'out', 'account', 'owner', 'policy', 'vault-env', 'topic'].map(k => [k, { type: 'string' }])) });
  need(positionals.length === 1, 'USAGE');
  if (positionals[0] === 'owner') return verifyOwner({ ...readDocument(v.owner), policy: readDocument(v.policy) });
  need(v.database && v.bootstrap, 'UNTRUSTED_STATE', 'A peer-local database and independently trusted bootstrap file are required');
  const store = new CheckpointStore(v.database, readDocument(v.bootstrap));
  try {
    const rails = () => {
      const config = readDocument(v.readers); need(Array.isArray(config) && config.length <= 8, 'RAILS');
      return config.map(c => { record(c, ['binary', 'scheme', 'endpoint']); return nativeReader(c); });
    };
    const privacy = () => {
      need(v['vault-env'] && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v['vault-env']), 'PRIVATE_REPOSITORY_REQUIRED');
      const encoded = process.env[v['vault-env']]; need(typeof encoded === 'string' && /^[A-Za-z0-9_-]{43}$/.test(encoded), 'VAULT_KEY');
      const self = Buffer.from(encoded, 'base64url'); need(self.length === 32 && self.toString('base64url') === encoded, 'VAULT_KEY');
      return repositoryPrivacy({ self, credentials: { self } });
    };
    switch (positionals[0]) {
      case 'init': case 'status': return store.current();
      case 'apply': {
        need(v.checkpoint, 'UNTRUSTED_STATE'); const p = readDocument(v.packet);
        record(p, ['state', 'policy', 'proposal', 'signatures', 'evidence']);
        need(commitment('state', p.state) === v.checkpoint, 'UNTRUSTED_STATE');
        const { manifest, payloads } = loadPackage(v.package, p.evidence.map(e => e.statement.observation_digest), Math.min(DEFAULT_MAX_BYTES, p.policy.max_bytes));
        const candidate = { policy: p.policy, manifest, proposal: p.proposal, signatures: p.signatures, evidence: p.evidence };
        return store.applyLocal({ candidate, payloads, expected: v.checkpoint });
      }
      case 'fetch': {
        const { candidate, payloads } = await retrieveBundle(readDocument(v.pointer), { store, rails: rails(), maxBytes: DEFAULT_MAX_BYTES, privacy: privacy() });
        const out = resolve(v.out); mkdirSync(out); mkdirSync(join(out, 'objects'));
        writeFileSync(join(out, 'manifest.json'), canonicalDocument(candidate.manifest), { flag: 'wx' });
        const { manifest: _manifest, ...packet } = candidate;
        writeFileSync(join(out, 'packet.json'), canonicalDocument({ state: store.current().state, ...packet }), { flag: 'wx' });
        for (const [id, bytes] of payloads) writeFileSync(join(out, 'objects', id.slice(7)), bytes, { flag: 'wx' });
        return { out, manifest_digest: commitment('manifest', candidate.manifest), authority: 'retrieval only; checkpoint unchanged' };
      }
      case 'sync-hive': return syncHiveBlock({ store, rails: rails(), maxBytes: DEFAULT_MAX_BYTES, privacy: privacy() });
      case 'hive-op': {
        const n = notice({ topic: v.topic, bundle: readDocument(v.pointer) });
        return { operation: hiveOperation(v.account, n), signed: false, submitted: false };
      }
      default: need(false, 'USAGE', 'Commands: init, status, apply, fetch, sync-hive, hive-op, owner. See STORAGE.md.');
    }
  } finally { store.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await main(process.argv.slice(2)); console.log(JSON.stringify(result)); if (result.accepted === false) process.exitCode = 1; }
  catch (e) { console.error(JSON.stringify({ accepted: false, code: e.code ?? 'INPUT', detail: e.code ? e.message : 'Cannot read or process replica inputs' })); process.exitCode = 1; }
}
