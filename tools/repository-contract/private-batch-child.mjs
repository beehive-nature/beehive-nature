// TEST-ONLY independent-process race/crash worker; production has no fault knob.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CheckpointStore } from './checkpoint.mjs';
import { repositoryProofEngine } from './proof-engine.mjs';
import { verifyPrivateBatch } from './private-batch.mjs';
const [database, input, binary, mode] = process.argv.slice(2), v = JSON.parse(readFileSync(input, 'utf8'));
const store = new CheckpointStore(database, v.bootstrap);
const updates = v.updates.map(u => ({ candidate: u.candidate, payloads: new Map(u.payloads.map(([k, b]) => [k, Buffer.from(b, 'base64')])) }));
const capability = await verifyPrivateBatch({ document: v.document, updates, engine: repositoryProofEngine({ binary }) });
if (mode === 'race') { process.send('ready'); await new Promise(r => process.once('message', r)); }
if (mode.startsWith('crash-')) {
  const exec = DatabaseSync.prototype.exec;
  DatabaseSync.prototype.exec = function(sql) {
    if (sql === 'COMMIT' && mode === 'crash-before') process.exit(70);
    const result = exec.call(this, sql);
    if (sql === 'COMMIT' && mode === 'crash-after') process.exit(71);
    return result;
  };
}
try { console.log(JSON.stringify(store.applyPrivateBatch({ capability, expected: v.bootstrap.trusted_state_digest, previousBatch: v.bootstrap.ordering.batch.pin }))); }
catch (e) { console.log(JSON.stringify({ accepted: false, code: e.code })); }
finally { store.close(); }
