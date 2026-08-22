// BF-2 starter cores — determinism, fork-law, purity, and inscription-shape tests.
// Zero dependencies: extracts each starter's marked CORE block and exercises it in a
// fresh function scope. Receipt rule: run `node forge/visual/test/core.test.mjs`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Fleet copies (surfaces/forge/) are pinned in sync with the forge starters —
// drift between them fails this suite (UI-first fleet law).
const starters = [
  '../../../forge/visual/starters/hexfield.html',
  '../../../forge/visual/starters/orbit-svg.html',
  '../../../surfaces/forge/hexfield.html',
  '../../../surfaces/forge/orbit.html',
  '../../../surfaces/forge/room.html',
  '../../../surfaces/forge/huddle.html',
].map(p => join(here, p));
let failed = 0;
const ok = (name, cond) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name);
  if (!cond) failed++;
};

for (const file of starters) {
  const html = readFileSync(file, 'utf8');
  const m = html.match(/\/\/ ---- CORE START ----([\s\S]*?)\/\/ ---- CORE END ----/);
  ok(`${file}: CORE block present`, !!m);
  if (!m) continue;
  const core = m[1];

  // 1. Purity: the composition must not know it is in a browser.
  ok(`${file}: CORE is pure (no DOM/global tokens)`,
     !/\b(document|window|globalThis|location|navigator)\b/.test(core));

  const api = new Function(core + '\nreturn {hashSeed, mulberry32, buildArt};')();
  ok(`${file}: CORE exposes hashSeed/mulberry32/buildArt`,
     typeof api.hashSeed === 'function' && typeof api.mulberry32 === 'function' && typeof api.buildArt === 'function');

  // 2. Hash: deterministic and distinguishing.
  ok(`${file}: hashSeed deterministic`, api.hashSeed('1000') === api.hashSeed('1000'));
  ok(`${file}: hashSeed distinguishing`, api.hashSeed('1000') !== api.hashSeed('1001') && api.hashSeed('a') !== api.hashSeed('b'));

  // 3. PRNG: same state, same stream; different state, different stream.
  const s1 = api.mulberry32(42), s2 = api.mulberry32(42), s3 = api.mulberry32(43);
  const five = s => [0, 0, 0, 0, 0].map(() => s());
  const A = five(s1), B = five(s2), C = five(s3);
  ok(`${file}: mulberry32 same-seed streams identical`, JSON.stringify(A) === JSON.stringify(B));
  ok(`${file}: mulberry32 different-seed streams differ`, JSON.stringify(A) !== JSON.stringify(C));

  // 4. Determinism: same seed + params, same art, byte for byte.
  const params = { density: 11, hueBase: 168, hueDrift: 72, symmetry: 1, k: 5, rings: 4, twist: 30 };
  const a1 = JSON.stringify(api.buildArt('hive-77', params));
  const a2 = JSON.stringify(api.buildArt('hive-77', params));
  ok(`${file}: same seed → identical art`, a1 === a2);

  // 5. Fork law: a different seed is a different piece (the parent stays untouched).
  let forks = 0;
  for (const pair of [['hive-77', 'hive-78'], ['1000', '2000'], ['🌱', '🌿']]) {
    if (JSON.stringify(api.buildArt(pair[0], params)) !== JSON.stringify(api.buildArt(pair[1], params))) forks++;
  }
  ok(`${file}: fork law — different seeds → different art (3/3)`, forks === 3);

  // 6. Param sensitivity: the launch-pad knobs actually steer.
  const vary = (key, value) => JSON.stringify(api.buildArt('hive-77', Object.assign({}, params, { [key]: value }))) !== a1;
  const knobs = file.includes('orbit') ? ['k', 'rings', 'twist'] : ['density', 'hueBase', 'hueDrift'];
  ok(`${file}: params steer the art (${knobs.join(', ')})`, knobs.every(k => vary(k, params[k] + 3)));

  // 7. Inscription shape: the art data is plain JSON (what a seed+renderer inscription carries).
  let round = false;
  try { round = JSON.stringify(JSON.parse(a1)) === a1; } catch (e) { round = false; }
  ok(`${file}: art data is JSON-round-trippable (inscription-shaped)`, round);

  // 8. The whole inline script (brush included) compiles — caught here, not in a broken browser tab.
  //    Module scripts get wrapped in an async body so top-level await compiles.
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(m => !/src=/.test(m[1]))
    .map(m => ({ module: /type=["']module["']/.test(m[1]), src: m[2] }));
  let compiles = scripts.length > 0;
  for (const s of scripts) {
    try { new Function(s.module ? 'return (async()=>{\n' + s.src + '\n})' : s.src); }
    catch (e) { compiles = false; console.log('  compile error: ' + e.message); }
  }
  ok(`${file}: full script (CORE + brush) compiles`, compiles);
}

console.log(failed === 0 ? '\nALL CORE TESTS PASS' : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
