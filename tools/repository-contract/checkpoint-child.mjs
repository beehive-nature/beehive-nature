// TEST-ONLY child: real independent process, crash at the actual SQLite commit.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { CheckpointStore } from './checkpoint.mjs';
import { parseDocument } from './contract.mjs';
const [path, input, mode] = process.argv.slice(2), f = parseDocument(readFileSync(input));
const store = new CheckpointStore(path, f.bootstrap);
if (mode.startsWith('crash-')) {
  const original = DatabaseSync.prototype.exec;
  DatabaseSync.prototype.exec = function(sql) {
    if (sql === 'COMMIT' && mode === 'crash-before') process.exit(70);
    const r = original.call(this, sql);
    if (sql === 'COMMIT' && mode === 'crash-after') process.exit(71);
    return r;
  };
}
if (process.send) { process.send('ready'); await new Promise(r => process.once('message', r)); }
try {
  const result = store.applyLocal({ candidate: f.candidate, payloads: new Map(f.payloads.map(([k, b]) => [k, Buffer.from(b, 'base64')])), expected: f.bootstrap.trusted_state_digest });
  console.log(JSON.stringify(result));
} catch (e) { console.log(JSON.stringify({ accepted: false, code: e.code })); }
finally { store.close(); }
