// dock-claims.mjs — the Dock's three hero numbers, re-derived from source.
//
// WHY THIS EXISTS: "35 seconds" is a hand-maintained front-page number with
// nothing checking it — the same shape as any figure that quietly rots. All
// three hero numbers now carry equal proof, because they sit at equal weight.
//
// Each number is DERIVED here and compared against what the page prints, so
// the page cannot drift from its own evidence:
//
//   35  seconds to a proof   -> staleness is CAUSAL, not calendar-based. The
//                               timed thing is `cargo test -p chain-zano`, so
//                               the pin is the chain-zano TREE HASH. If that
//                               tree moves, the measurement is stale and this
//                               fails. `--remeasure` actually re-runs it.
//   3   held tests           -> counted from #[ignore] ATTRIBUTES across
//                               crates/ (doc comments mentioning #[ignore]
//                               don't count), each required to carry a reason.
//   2   lanes unstarted      -> the STATUS.md sentence that names them must
//                               still exist and still name both lanes.
//
// WHAT THIS DOES NOT CATCH, stated rather than implied: a dependency version
// bump inside chain-zano's 20-crate subgraph that leaves the tree hash intact,
// or a machine that simply got slower. It detects that the measured THING
// changed, not that the NUMBER is wrong. Only --remeasure does the latter.
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = process.env.DOCK_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCK = join(ROOT, 'surfaces', 'dock.html');
const REMEASURE = process.argv.includes('--remeasure');

// Pinned at measurement time, 2026-08-24. Both are PUBLIC-CONSTANT: git object
// ids of public source, not secrets.
const PINNED_CHAIN_ZANO_TREE = '6a56c1ba0e9b80db28e789bf842e4f3a1ea6529e'; // PUBLIC-CONSTANT: git tree id of crates/chain-zano when the 35s was measured
const BAND_SECONDS = { min: 20, max: 60 };   // observed 28 / 35 / 39

const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() ?? '';

let pass = 0, fail = 0;
const ok = (n, c, note = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}${note ? ' — ' + note : ''}`); c ? pass++ : fail++; };

const html = await readFile(DOCK, 'utf8');

// what the PAGE prints — parsed, never assumed
const heroes = [...html.matchAll(/<div class="n [a-z]+">(\d+)<\/div><div class="l">([^<]*)</g)]
  .map(m => ({ n: parseInt(m[1], 10), label: m[2].trim() }));
console.log(`  page prints: ${heroes.map(h => h.n).join(' · ')}`);
ok('the page prints exactly three hero numbers', heroes.length === 3, `${heroes.length} found`);

// ── CLAIM 1 · 35 seconds ────────────────────────────────────────────
const treeNow = git('rev-parse', 'HEAD:crates/chain-zano');
ok('CLAIM 35s · the timed crate is unchanged since measurement',
   treeNow === PINNED_CHAIN_ZANO_TREE,
   treeNow === PINNED_CHAIN_ZANO_TREE ? `chain-zano tree ${treeNow.slice(0, 8)}` :
   `chain-zano tree moved ${PINNED_CHAIN_ZANO_TREE.slice(0, 8)} -> ${treeNow.slice(0, 8)} — RE-MEASURE the Dock's 35s and re-pin`);
ok('CLAIM 35s · the page carries its stamp', /Stamped:<\/b> measured 2026-08-24/.test(html) && html.includes('6a56c1ba'));

if (REMEASURE) {
  console.log('  --remeasure: cold clone + cargo test -p chain-zano (this takes a minute)…');
  const sh = spawnSync('wsl', ['-e', 'sh', '-c',
    'rm -rf /tmp/dockre && mkdir -p /tmp/dockre/ch && cd /tmp/dockre && . "$HOME/.cargo/env" && ' +
    'CARGO_HOME=/tmp/dockre/ch && export CARGO_HOME && S=`date +%s` && ' +
    'git clone --quiet https://github.com/beehive-nature/beehive-nature.git && cd beehive-nature && ' +
    'cargo test -p chain-zano >/dev/null 2>&1; E=`date +%s`; expr $E - $S'],
    { encoding: 'utf8' });
  const secs = parseInt((sh.stdout || '').trim().split('\n').pop(), 10);
  ok(`CLAIM 35s · re-measured cold within band ${BAND_SECONDS.min}-${BAND_SECONDS.max}s`,
     Number.isFinite(secs) && secs >= BAND_SECONDS.min && secs <= BAND_SECONDS.max,
     Number.isFinite(secs) ? `${secs}s` : 'measurement failed');
} else {
  console.log('  (skipping the real cold run — pass --remeasure to actually time it)');
}

// ── CLAIM 2 · 3 held tests ──────────────────────────────────────────
const grep = spawnSync('git', ['grep', '-n', '#\\[ignore', 'HEAD', '--', 'crates/'], { cwd: ROOT, encoding: 'utf8' }).stdout || '';
const attrs = grep.split('\n').filter(Boolean).filter(l => {
  const code = l.split(/:\d+:/).slice(1).join('').trim();
  return code.startsWith('#[ignore');            // an ATTRIBUTE, not a doc comment
});
ok('CLAIM 3 · held-test count matches the page',
   heroes[1] && attrs.length === heroes[1].n,
   `#[ignore] attributes = ${attrs.length}, page says ${heroes[1]?.n}`);
ok('CLAIM 3 · every held test names its own blocker',
   attrs.length > 0 && attrs.every(l => /#\[ignore\s*=\s*"/.test(l)),
   attrs.map(l => l.split(/:\d+:/)[0].replace('HEAD:', '')).join(', '));

// ── CLAIM 3 · 2 unstarted lanes ─────────────────────────────────────
const status = await readFile(join(ROOT, 'STATUS.md'), 'utf8');
const sentence = /unstarted work between here and/i.test(status);
const namesBoth = /firmware/i.test(status) && /legal review/i.test(status);
ok('CLAIM 2 · STATUS.md still carries the unstarted-work sentence', sentence);
ok('CLAIM 2 · and it still names both lanes (firmware, legal review)', namesBoth);
ok('CLAIM 2 · the page says 2, matching the two lanes named', heroes[2]?.n === 2, `page says ${heroes[2]?.n}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
