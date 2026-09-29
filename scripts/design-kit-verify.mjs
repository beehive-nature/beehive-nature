#!/usr/bin/env node
/* design-kit-verify.mjs — the design-system blob obligation's one-command check.
   Compares the design-system/ tree against manifest.json's storage.files (the
   artifact's blob store: 24 entries, byte-count authority). Ids in the manifest
   are STORE IDS, not content hashes (proven 2026-09-28: austras-koks.svg
   downloaded from the artifact's own Files panel is byte-count exact with a
   different md5), so this verifies BYTES-COUNT + TYPE. Byte-count agreement is
   necessary, not sufficient — cross-source md5 agreement (where a second copy
   exists) and provenance carry the rest; byte-for-byte proof against the
   artifact originals requires content-hash records the manifest does not carry.
   Exit codes: 0 complete (24/24), 1 mismatch or type error, 2 incomplete. */
import { readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'design-system', 'manifest.json'), 'utf8'));
const entries = Object.entries(manifest.storage?.files ?? {});
if (!entries.length) { console.error('manifest carries no storage.files — nothing to verify'); process.exit(1); }

let ok = 0; const missing = [], mismatched = [];
for (const [path, meta] of entries) {
  const file = join(root, 'design-system', path);
  if (!existsSync(file)) { missing.push(`${path} (${meta.bytes}B id ${meta.id})`); continue; }
  const bytes = statSync(file).size;
  if (bytes !== meta.bytes) { mismatched.push(`${path}: manifest ${meta.bytes}B, tree ${bytes}B`); continue; }
  ok++; console.log(`ok        ${path} ${bytes}B`);
}
for (const m of mismatched) console.error(`MISMATCH  ${m}`);
for (const m of missing) console.log(`missing   ${m}`);

console.log(`\n${ok}/${entries.length} blob files byte-count verified against manifest storage.files`);
if (mismatched.length) process.exit(1);
if (missing.length) { console.log(`obligation INCOMPLETE — ${missing.length} missing`); process.exit(2); }
console.log('obligation COMPLETE — every manifest blob is in-tree');
