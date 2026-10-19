// SQLite is the local transaction boundary, not a replacement consensus chain.
// Mirrors bindexer's keyless SQLite posture with FULL durability for checkpoints.
import { DatabaseSync } from 'node:sqlite';
import { acceptUpdate, commitment, validateState, canonicalDocument, parseDocument, bytesDigest, need, record, hash, integer, text, oid } from './contract.mjs';
import { packet, payloadEntries, checkBytes, location } from './storage.mjs';
import { normalizeNodes } from '../keychain-release/anchor.mjs';
import { validateBatchBootstrap, validateBatchPin, verifiedPrivateBatch } from './private-batch.mjs';

export function validateBootstrap(b) {
  record(b, ['state', 'trusted_state_digest', 'ordering']); validateState(b.state); hash(b.trusted_state_digest);
  need(commitment('state', b.state) === b.trusted_state_digest, 'UNTRUSTED_STATE');
  const o = b.ordering;
  if (o.mode === 'local-shadow') record(o, ['mode']);
  else if (o.mode === 'local-batch-shadow') { record(o, ['mode', 'batch']); validateBatchBootstrap(o.batch); }
  else {
    need(['hive-shadow', 'hive-batch-shadow'].includes(o.mode), 'ORDERING');
    record(o, ['mode', 'account', 'nodes', 'cursor', 'topic', ...(o.mode === 'hive-batch-shadow' ? ['batch'] : [])]); hash(o.topic);
    if (o.mode === 'hive-batch-shadow') validateBatchBootstrap(o.batch);
    need(typeof o.account === 'string' && /^[a-z][a-z0-9.-]{2,15}$/.test(o.account), 'HIVE_ACCOUNT');
    need(Array.isArray(o.nodes) && o.nodes.length >= 2 && o.nodes.length <= 8, 'ORACLES');
    need(normalizeNodes(o.nodes).length === o.nodes.length, 'ORACLES');
    record(o.cursor, ['height', 'block_id']); integer(o.cursor.height, 1); oid(o.cursor.block_id);
    need(Number.parseInt(o.cursor.block_id.slice(0, 8), 16) === o.cursor.height, 'BLOCK_HEIGHT');
  }
}

export class CheckpointStore {
  #db;
  constructor(path, bootstrap) {
    validateBootstrap(bootstrap);
    this.#db = new DatabaseSync(path);
    try {
      this.#db.exec(`PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), bootstrap BLOB NOT NULL);
        CREATE TABLE IF NOT EXISTS checkpoint(id INTEGER PRIMARY KEY CHECK(id=1), state BLOB NOT NULL, digest TEXT NOT NULL, cursor BLOB);
        CREATE TABLE IF NOT EXISTS objects(digest TEXT PRIMARY KEY, data BLOB NOT NULL);
        CREATE TABLE IF NOT EXISTS sealed(plain TEXT NOT NULL, audience TEXT NOT NULL, cipher TEXT NOT NULL, PRIMARY KEY(plain,audience));
        CREATE TABLE IF NOT EXISTS publications(digest TEXT NOT NULL, rail TEXT NOT NULL, status TEXT NOT NULL, location BLOB, PRIMARY KEY(digest,rail));
        CREATE TABLE IF NOT EXISTS decisions(position TEXT PRIMARY KEY, result BLOB NOT NULL);
        CREATE TABLE IF NOT EXISTS blocks(height INTEGER PRIMARY KEY, block_id TEXT NOT NULL, receipt BLOB NOT NULL);
        CREATE TABLE IF NOT EXISTS inbox(sender TEXT NOT NULL, logical_id TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(sender,logical_id));
        CREATE TABLE IF NOT EXISTS batch_checkpoint(id INTEGER PRIMARY KEY CHECK(id=1), pin BLOB NOT NULL, frontier BLOB NOT NULL);
        CREATE TABLE IF NOT EXISTS private_plans(id TEXT PRIMARY KEY, data BLOB NOT NULL, digest TEXT NOT NULL);`);
      this.#transaction(() => {
        const stored = this.#db.prepare('SELECT bootstrap FROM settings WHERE id=1').get();
        const bytes = canonicalDocument(bootstrap);
        if (stored) need(Buffer.from(stored.bootstrap).equals(bytes), 'BOOTSTRAP_MISMATCH');
        else {
          this.#db.prepare('INSERT INTO settings VALUES(1,?)').run(bytes);
          this.#db.prepare('INSERT INTO checkpoint VALUES(1,?,?,?)').run(canonicalDocument(bootstrap.state), bootstrap.trusted_state_digest,
            bootstrap.ordering.cursor ? canonicalDocument(bootstrap.ordering.cursor) : null);
          if (bootstrap.ordering.batch) this.#db.prepare('INSERT INTO batch_checkpoint VALUES(1,?,?)').run(canonicalDocument(bootstrap.ordering.batch.pin), canonicalDocument(bootstrap.ordering.batch.frontier));
        }
      });
      this.bootstrap = structuredClone(bootstrap);
      this.current();
    } catch (e) { this.#db.close(); throw e; }
  }
  close() { this.#db.close(); }
  #transaction(fn) {
    this.#db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.#db.exec('COMMIT'); return result; }
    catch (e) { this.#db.exec('ROLLBACK'); throw e; }
  }
  current() {
    const row = this.#db.prepare('SELECT * FROM checkpoint WHERE id=1').get(); need(row, 'CHECKPOINT_MISSING');
    const state = parseDocument(row.state); validateState(state);
    need(commitment('state', state) === row.digest, 'CHECKPOINT_CORRUPT');
    const result = { state, digest: row.digest, cursor: row.cursor ? parseDocument(row.cursor) : null, mode: this.bootstrap?.ordering.mode };
    if (this.bootstrap?.ordering.batch) {
      const batch = this.#db.prepare('SELECT pin,frontier FROM batch_checkpoint WHERE id=1').get(); need(batch, 'CHECKPOINT_MISSING');
      result.batch = { pin: parseDocument(batch.pin), frontier: parseDocument(batch.frontier) };
      validateBatchBootstrap(result.batch);
    }
    return result;
  }
  privatePlan(id) {
    hash(id); const r = this.#db.prepare('SELECT data,digest FROM private_plans WHERE id=?').get(id);
    if (!r) return null; need(bytesDigest(r.data) === r.digest, 'STORAGE_CORRUPT'); return Buffer.from(r.data);
  }
  reservePrivatePlan(id, bytes) {
    hash(id); need(bytes instanceof Uint8Array && bytes.length <= 10 * 1024 * 1024, 'RESOURCE_LIMIT');
    return this.#transaction(() => {
      this.#db.prepare('INSERT OR IGNORE INTO private_plans VALUES(?,?,?)').run(id, bytes, bytesDigest(bytes));
      return this.privatePlan(id);
    });
  }
  get(id) {
    hash(id); const row = this.#db.prepare('SELECT data FROM objects WHERE digest=?').get(id);
    if (!row) return null;
    need(bytesDigest(row.data) === id, 'STORAGE_CORRUPT'); return Buffer.from(row.data);
  }
  put(bytes) {
    need(bytes instanceof Uint8Array, 'SHAPE'); const id = bytesDigest(bytes);
    this.#db.prepare('INSERT OR IGNORE INTO objects VALUES(?,?)').run(id, bytes);
    checkBytes({ digest: id, bytes: bytes.length }, this.get(id)); return id;
  }
  publication(id, rail) {
    hash(id); text(rail); const r = this.#db.prepare('SELECT status,location FROM publications WHERE digest=? AND rail=?').get(id, rail);
    return r ? { status: r.status, location: r.location ? parseDocument(r.location) : null } : null;
  }
  sealed(plain, audience) {
    hash(plain); hash(audience);
    const row = this.#db.prepare('SELECT cipher FROM sealed WHERE plain=? AND audience=?').get(plain, audience);
    return row ? this.get(row.cipher) : null;
  }
  keepSealed(plain, audience, bytes) {
    hash(plain); hash(audience);
    return this.#transaction(() => {
      const id = this.put(bytes);
      this.#db.prepare('INSERT OR IGNORE INTO sealed VALUES(?,?,?)').run(plain, audience, id);
      return this.sealed(plain, audience);
    });
  }
  reservePublication(id, rail) {
    hash(id); text(rail); need(this.get(id), 'MISSING_OBJECT');
    this.#db.prepare('INSERT INTO publications VALUES(?,?,?,NULL)').run(id, rail, 'reserved');
  }
  confirmPublication(id, rail, loc) {
    hash(id); text(rail); location(loc);
    const r = this.#db.prepare("UPDATE publications SET status='verified',location=? WHERE digest=? AND rail=?").run(canonicalDocument(loc), id, rail);
    need(r.changes === 1, 'PUBLICATION_STATE');
  }
  // x0x transport history IDs are NOT logical IDs. The exact application bytes
  // are reserved atomically, so a replay after restart cannot create a new job.
  receive(sender, logicalId, bytes) {
    text(sender); hash(logicalId); const id = bytesDigest(bytes);
    return this.#transaction(() => {
      const old = this.#db.prepare('SELECT digest FROM inbox WHERE sender=? AND logical_id=?').get(sender, logicalId);
      if (old) { need(old.digest === id, 'LOGICAL_ID_COLLISION'); return { fresh: false, digest: id }; }
      this.put(bytes); this.#db.prepare('INSERT INTO inbox VALUES(?,?,?)').run(sender, logicalId, id);
      return { fresh: true, digest: id };
    });
  }
  #apply(candidate, payloads, position) {
    packet(candidate); const current = this.current();
    const result = acceptUpdate({ ...candidate, payloads, state: current.state, trustedStateDigest: current.digest });
    if (result.accepted) {
      const entries = payloadEntries(candidate, payloads);
      need(entries.reduce((n, e) => n + e.bytes, 0) <= candidate.policy.max_bytes, 'RESOURCE_LIMIT');
      for (const e of entries) this.put(checkBytes(e, payloads.get(e.digest)));
      // Keep the verified packet and byte references in the same transaction.
      this.put(canonicalDocument({ candidate, objects: entries }));
      const updated = this.#db.prepare('UPDATE checkpoint SET state=?,digest=? WHERE id=1 AND digest=?').run(
        canonicalDocument(result.next_state), result.next_state_digest, current.digest);
      need(updated.changes === 1, 'CAS_CONFLICT');
    }
    this.#db.prepare('INSERT INTO decisions VALUES(?,?)').run(position, canonicalDocument(result));
    return result;
  }
  applyLocal({ candidate, payloads, expected }) {
    need(this.bootstrap.ordering.mode === 'local-shadow', 'ORDERING'); hash(expected);
    return this.#transaction(() => {
      const c = this.current(); need(c.digest === expected, 'CAS_CONFLICT');
      // A refusal must not poison a later attempt with corrected signatures or
      // restored payloads. Keep every local attempt; accepted replay is already
      // excluded by the predecessor CAS and acceptUpdate's state binding.
      const { next } = this.#db.prepare('SELECT coalesce(max(rowid),0)+1 AS next FROM decisions').get();
      const position = `local:${commitment('proposal', candidate.proposal)}:${next}`;
      return this.#apply(candidate, payloads, position);
    });
  }
  #applyPrivate(capability, position) {
    const v = verifiedPrivateBatch(capability), c = this.current();
    need(c.batch && c.digest === commitment('state', v.state), 'STALE_BATCH');
    need(canonicalDocument(c.batch.pin).equals(canonicalDocument(v.previous)), 'STALE_BATCH');
    const results = v.captured.map((u, i) => {
      const r = this.#apply(u.candidate, u.payloads, `${position}:${i}`);
      need(r.accepted, 'BATCH_ACCEPTANCE', r.code ?? 'Private batch refused'); return r;
    });
    need(this.current().digest === commitment('state', v.next), 'BATCH_BINDING');
    this.put(canonicalDocument(v.document));
    const changed = this.#db.prepare('UPDATE batch_checkpoint SET pin=?,frontier=? WHERE id=1 AND pin=?').run(canonicalDocument(v.pin), canonicalDocument(v.frontier), canonicalDocument(c.batch.pin));
    need(changed.changes === 1, 'CAS_CONFLICT');
    return { accepted: true, results, checkpoint: this.current(), mode: 'private-batch-shadow' };
  }
  applyPrivateBatch({ capability, expected, previousBatch }) {
    need(this.bootstrap.ordering.mode === 'local-batch-shadow', 'ORDERING'); hash(expected); validateBatchPin(previousBatch);
    return this.#transaction(() => {
      const c = this.current(); need(c.digest === expected && canonicalDocument(c.batch.pin).equals(canonicalDocument(previousBatch)), 'CAS_CONFLICT');
      return this.#applyPrivate(capability, `private:${capability?.digest}`);
    });
  }
  // Only the Hive synchronizer calls this after fetching every ordered bundle.
  // Caller-supplied receipts are trusted RPC observations, not consensus proofs.
  // The transaction rechecks the cursor after all asynchronous I/O.
  applyHiveBlock({ expectedCursor, block, prepared, receipt }) {
    need(['hive-shadow', 'hive-batch-shadow'].includes(this.bootstrap.ordering.mode), 'ORDERING');
    return this.#transaction(() => {
      const c = this.current();
      need(canonicalDocument(c.cursor).equals(canonicalDocument(expectedCursor)), 'CAS_CONFLICT');
      need(block.height === c.cursor.height + 1 && block.previous === c.cursor.block_id, 'CHAIN_GAP');
      const results = [];
      for (const item of prepared) {
        const position = `hive:${block.height}:${item.transaction}:${item.operation}`;
        if (item.refusal) {
          const result = { accepted: false, code: item.refusal };
          this.#db.prepare('INSERT INTO decisions VALUES(?,?)').run(position, canonicalDocument(result)); results.push(result);
        } else if (item.privateBatch) {
          need(this.bootstrap.ordering.mode === 'hive-batch-shadow', 'ORDERING');
          const v = verifiedPrivateBatch(item.privateBatch), current = this.current();
          if (current.digest !== commitment('state', v.state) || !canonicalDocument(current.batch.pin).equals(canonicalDocument(v.previous))) {
            const result = { accepted: false, code: 'STALE_BATCH' };
            this.#db.prepare('INSERT INTO decisions VALUES(?,?)').run(position, canonicalDocument(result)); results.push(result);
          } else results.push(this.#applyPrivate(item.privateBatch, position));
        } else {
          need(this.bootstrap.ordering.mode === 'hive-shadow', 'PRIVATE_VERIFICATION_REQUIRED');
          results.push(this.#apply(item.candidate, item.payloads, position));
        }
      }
      this.#db.prepare('INSERT INTO blocks VALUES(?,?,?)').run(block.height, block.block_id, canonicalDocument(receipt));
      this.#db.prepare('UPDATE checkpoint SET cursor=? WHERE id=1').run(canonicalDocument({ height: block.height, block_id: block.block_id }));
      return { results, checkpoint: this.current(), mode: 'hive-shadow' };
    });
  }
  decisions() { return this.#db.prepare('SELECT position,result FROM decisions ORDER BY rowid').all().map(r => ({ position: r.position, result: parseDocument(r.result) })); }
}
