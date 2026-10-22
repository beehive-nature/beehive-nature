// The user's explicitly configured, built native organ. No endpoint/service.
import { spawn } from 'node:child_process';
import { canonicalDocument, need } from './contract.mjs';
const engines = new WeakSet();
export const PROOF_PROFILE = 'bnr.repository-hiding-stark/1';
export function repositoryProofEngine({ binary }) {
  need(typeof binary === 'string' && binary.length > 0, 'PROOF_CONFIG');
  const engine = Object.freeze({ async run(command, value) {
    need(['prove', 'commit', 'verify', 'check', 'log-extend', 'log-verify'].includes(command), 'PROOF_COMMAND');
    const input = canonicalDocument(value); need(input.length <= 10 * 1024 * 1024, 'RESOURCE_LIMIT');
    return new Promise((resolve, reject) => {
      const child = spawn(binary, [command], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      const chunks = []; let total = 0, overflow = false, timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120_000);
      child.stdin.on('error', () => {});
      child.stdout.on('data', b => { total += b.length; if (total > 10 * 1024 * 1024) { overflow = true; child.kill(); } else chunks.push(b); });
      child.on('error', () => { clearTimeout(timer); reject(Object.assign(new Error('Native proof organ unavailable'), { code: 'PROOF_UNAVAILABLE' })); });
      child.on('close', code => {
        clearTimeout(timer);
        try {
          need(!overflow && !timedOut && (code === 0 || code === 1), 'PROOF_UNAVAILABLE');
          // Do not echo private witness, paths or organ stderr into receipts.
          need(code === 0, 'PROOF_REFUSED', 'Native proof or append relation refused');
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) { reject(e.code ? e : Object.assign(new Error('Invalid native proof response'), { code: 'PROOF_UNAVAILABLE' })); }
      });
      child.stdin.end(input);
    });
  } });
  engines.add(engine); return engine;
}
export function requireProofEngine(engine) { need(engines.has(engine), 'PROOF_CONFIG'); }
