// forge-freeze.mjs — FORGE FREEZE (founder ruling, dispatched 2026-08-24).
//
// surfaces/forge/orbit.html is frozen founder-approved art: CI fails on ANY
// edit to its COMMITTED BLOB. The hash is taken from `git show HEAD:<path>`,
// never the worktree copy — on a Windows checkout the working file may differ
// in line endings; the committed blob is the truth (the same law the fleet
// preservation taught: verify blobs, not files).
//
// Tinkering forks to surfaces/forge/orbit-v2.html, which is NOT frozen.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const FROZEN = 'surfaces/forge/orbit.html';
const PINNED_SHA256 = '6e54b80deff87861e4ad0134799cbd8a28492ed9e851b26bdfd597f4258a6b29'; // PUBLIC-CONSTANT: pinned sha256 of the frozen orbit.html committed blob (8,644 B)

const show = spawnSync('git', ['show', `HEAD:${FROZEN}`], { encoding: 'buffer' });
if (show.status !== 0) {
  console.error(`FORGE FREEZE FAIL — cannot read committed blob of ${FROZEN}:`);
  console.error(String(show.stderr));
  process.exit(1);
}
const bytes = show.stdout.length;
const sha256 = createHash('sha256').update(show.stdout).digest('hex');

if (sha256 !== PINNED_SHA256) {
  console.error(`FORGE FREEZE FAIL — ${FROZEN} was edited`);
  console.error(`  committed blob: ${sha256} (${bytes} B)`);
  console.error(`  pinned        : ${PINNED_SHA256}`);
  console.error(`  orbit.html is frozen art. Fork your tinkering to surfaces/forge/orbit-v2.html.`);
  process.exit(1);
}
console.log(`FORGE FREEZE ok — ${FROZEN} committed blob ${sha256} (${bytes} B) matches the pin`);
// The pin binds the COMMITTED blob (what CI sees post-push). A diverging
// worktree file is a WARNING, not a failure — on Windows checkouts line
// endings may legitimately differ; on CI a true edit will be IN HEAD and the
// blob check above is what fails.
try {
  const wt = await readFile(FROZEN);
  const wtSha = createHash('sha256').update(wt).digest('hex');
  if (wtSha !== PINNED_SHA256) {
    console.warn(`  warn — worktree copy differs from the pinned blob (${wtSha.slice(0, 16)}…); uncommitted local state, not a freeze violation until committed`);
  }
} catch { /* file unreadable locally — CI is authoritative */ }
console.log(`  future tinkering lives in surfaces/forge/orbit-v2.html (not frozen)`);
