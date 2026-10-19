#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptUpdate, commitment, need, record, signingBytes, validateState, validatePolicy } from './contract.mjs';
import { DEFAULT_MAX_BYTES, loadPackage, packSnapshot, readDocument, restoreSnapshot } from './package.mjs';

export function main(args) {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: Object.fromEntries(
    ['repo', 'repository', 'ref', 'plan', 'out', 'package', 'packet', 'checkpoint', 'document', 'kind'].map(k => [k, { type: 'string' }])) });
  need(positionals.length === 1, 'USAGE');
  switch (positionals[0]) {
    case 'pack': { const result = packSnapshot({ repo: v.repo, repository: v.repository, ref: v.ref, plan: readDocument(v.plan), out: v.out }); return { directory: result.directory, manifest_digest: commitment('manifest', result.manifest) }; }
    case 'inspect': { const { manifest } = loadPackage(v.package); return { valid: true, manifest_digest: commitment('manifest', manifest), source: { commit: manifest.source.commit, tree: manifest.source.tree, history: manifest.source.history }, authority: 'content only; no acceptance claim' }; }
    case 'restore': return restoreSnapshot(v.package, v.out);
    case 'signing-bytes': writeFileSync(v.out, signingBytes(v.kind, readDocument(v.document)), { flag: 'wx' }); return { written: v.out, signed: false };
    case 'verify': {
      need(v.checkpoint, 'UNTRUSTED_STATE', '--checkpoint must come from a trusted channel, never the proposal package');
      const packet = readDocument(v.packet); record(packet, ['state', 'policy', 'proposal', 'signatures', 'evidence']);
      validateState(packet.state); need(commitment('state', packet.state) === v.checkpoint, 'UNTRUSTED_STATE');
      validatePolicy(packet.policy); need(commitment('policy', packet.policy) === packet.state.policy_digest, 'POLICY');
      const { manifest, payloads } = loadPackage(v.package, packet.evidence.map(e => e.statement.observation_digest), Math.min(DEFAULT_MAX_BYTES, packet.policy.max_bytes));
      return acceptUpdate({ ...packet, trustedStateDigest: v.checkpoint, manifest, payloads });
    }
    default: throw Object.assign(new Error('Commands: pack, inspect, restore, signing-bytes, verify. See README.md.'), { code: 'USAGE' });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = main(process.argv.slice(2)); console.log(JSON.stringify(result)); if (result.accepted === false) process.exitCode = 1; }
  catch (e) { console.error(JSON.stringify({ accepted: false, code: e.code ?? 'INPUT', detail: e.code ? e.message : 'Cannot read or process contract inputs' })); process.exitCode = 1; }
}
