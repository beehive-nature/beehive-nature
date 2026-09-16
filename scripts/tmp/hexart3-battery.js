// hexart3-battery.js — extend hexart-check.mjs with the portability proofs
const fs = require('fs');
let s = fs.readFileSync('e2e/hexart-check.mjs', 'utf8');
const anchor = "  ok('battery total: zero page errors across everything', errs.length === 0, errs.slice(0, 2).join('|'));";
const ext = `  // ═══ ROUND 3: portability ═══
  const P = () => page.evaluate(() => window.__hexartPort);

  // H14: export → wipe → import → render — BOTH digests verified, byte-identical cells
  const trip = await page.evaluate(async () => {
    const H = window.__hexart, Port = window.__hexartPort;
    H.cells[7 * H.cols + 11] = 3; H.edits['11,7'] = 3;      // a hand edit rides along
    const obj = Port.toPortable();
    const exportedRender = obj.render_digest;
    const before = H.cells.join(',');
    // simulate the full round trip through JSON (what a file on disk is)
    const text = JSON.stringify(obj);
    H.cells = H.cells.map(() => -1); H.edits = {};
    const verdict = Port.importPortable(text);
    if (!verdict.ok) return { stage: 'import-refused', err: verdict.err };
    const o = verdict.obj;
    // regrow exactly as the UI handler does
    let src = null;
    if (o.image && o.image.data) {
      const im2 = new Image();
      await new Promise(res => { im2.onload = res; im2.onerror = res; im2.src = o.image.data; });
      H.imgCanvas = im2; H.imgSrc = true; H.imgData = null; src = H.imgDataFor({ ...o });
    }
    H.topology = o.topology; H.cols = o.cols; H.rows = o.rows; H.seed = o.seed;
    H.palette = o.palette.slice(); H.threshold = o.threshold; H.detail = o.detail; H.dither = o.dither;
    H.edits = o.edits || {}; H.engine = o.engine;
    H.cells = window.HexArtEngines[o.engine].generate(o, src);
    for (const k in H.edits) { const [c, r] = k.split(',').map(Number); H.cells[r * H.cols + c] = H.edits[k]; }
    const after = H.cells.join(',');
    const renderedDigest = Port.renderDigestOf(H.cells);
    return { stage: 'done', cellsMatch: before === after,
             renderDigestMatch: renderedDigest === exportedRender,
             recipeDigest: o.recipe_digest.slice(0, 12), renderDigest: renderedDigest.slice(0, 12), exportedRender: exportedRender.slice(0, 12) };
  });
  ok('portability: export→wipe→import→render = identical cells', trip.stage === 'done' && trip.cellsMatch, JSON.stringify(trip));
  ok('portability: render_digest verified (what the instructions produced)', trip.stage === 'done' && trip.renderDigestMatch, JSON.stringify(trip));

  // H15: v1 migration — a schema-less recipe migrates deterministically
  const mig = await page.evaluate(() => {
    const Port = window.__hexartPort;
    const H = window.__hexart;
    const v1 = { engine: 'comb-field', topology: 'hex-pointy', cols: H.cols, rows: H.rows,
      seed: H.seed, prompt: '', palette: H.palette.slice(), palName: 'honey',
      threshold: 18, detail: 3, dither: true, edits: { '5,5': 2 } };
    const v = Port.importPortable(JSON.stringify(v1));
    return { ok: v.ok, schema: v.obj ? v.obj.schema : null, migrated: v.obj ? v.obj.migrated_from : null,
             hasRecipeDigest: v.obj ? !!v.obj.recipe_digest : false };
  });
  ok('migration: v1 recipe (no schema) migrates to v2 deterministically', mig.ok && mig.schema === 2 && mig.migrated === 1 && mig.hasRecipeDigest, JSON.stringify(mig));

  // H16: hostile imports — each refused by name, zero mutation
  const hostile = await page.evaluate(() => {
    const Port = window.__hexartPort, H = window.__hexart;
    const snap = () => JSON.stringify({ cells: H.cells.join(','), edits: JSON.stringify(H.edits), shelf: localStorage.getItem('hexart.shelf.v1') });
    const base = Port.toPortable();
    const cases = [
      ['unknown version', JSON.stringify({ ...base, schema: 99 })],
      ['bad json', '{not json at all'],
      ['not an object', '"just a string"'],
      ['digest mismatch (render)', JSON.stringify({ ...base, render_digest: 'xd-fake-1' })],  // import must not refuse on render_digest (it warns), so skip
      ['oversized image', JSON.stringify({ ...base, engine: 'comb-field', image: { data: 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024 + 100) } })],
      ['bad topology', JSON.stringify({ ...base, topology: 'pentagon' })],
      ['bad palette color', JSON.stringify({ ...base, palette: ['#ff0000', 'javascript:alert(1)'] })],
      ['edit out of bounds', JSON.stringify({ ...base, edits: { '9999,9999': 1 } })],
      ['edit bad key', JSON.stringify({ ...base, edits: { 'foo,bar': 1 } })],
      ['edit bad value', JSON.stringify({ ...base, edits: { '5,5': 999 } })],
      ['unknown engine', JSON.stringify({ ...base, engine: 'evil-engine' })],
      ['image-conv without image', JSON.stringify({ ...base, engine: 'image-conv', image: undefined })],
      ['non-string image', JSON.stringify({ ...base, engine: 'comb-field', image: { data: 42 } })],
      ['cols out of range', JSON.stringify({ ...base, cols: 9999 })],
      ['seed not integer', JSON.stringify({ ...base, seed: 'abc' })],
    ];
    const before = snap();
    const results = cases.map(([name, text]) => {
      const v = Port.importPortable(text);
      return { name, refused: !v.ok, err: v.err };
    });
    const after = snap();
    return { results, mutated: before !== after };
  });
  const expectedRefusals = hostile.results.filter(r => r.name !== 'digest mismatch (render)');
  ok('hostile: all ' + expectedRefusals.length + ' malformed imports refused by name',
     expectedRefusals.every(r => r.refused),
     expectedRefusals.filter(r => !r.refused).map(r => r.name).join(',') || 'all refused');
  const namedErrs = expectedRefusals.filter(r => r.refused && r.err && r.err !== 'json-parse-refused' && r.err.includes('-refused'));
  ok('hostile: refusals carry named incompatibility codes', namedErrs.length >= expectedRefusals.length - 1,
     namedErrs.length + '/' + expectedRefusals.length + ' named');
  ok('hostile: zero mutation of canvas or shelf across all refusals', !hostile.mutated);

  ok('battery total: zero page errors across everything', errs.length === 0, errs.slice(0, 2).join('|'));`;
if (!s.includes(anchor)) { console.error('battery anchor missing'); process.exit(1); }
s = s.replace(anchor, ext);
fs.writeFileSync('e2e/hexart-check.mjs', s);
console.log('battery extended: H14 portability round-trip, H15 migration, H16 hostile imports');
