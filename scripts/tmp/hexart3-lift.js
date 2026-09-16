// hexart3-lift.js — apply the round-3 portability core to hexart.html
const fs = require('fs');
let s = fs.readFileSync('surfaces/hexart.html', 'utf8');

// find the shelf comment block by a stable substring
const shelfIdx = s.indexOf('the shelf: recipe persistence in localStorage');
if (shelfIdx < 0) { console.error('shelf comment not found'); process.exit(1); }
// back up to the start of that comment line
const lineStart = s.lastIndexOf('/*', shelfIdx);

const portability = `/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 portability: the canonical .hexart.json object \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   A piece is portable between humans/devices as ONE JSON file. The object
   carries: schema version, engine id, topology, dims, palette, seed, prompt,
   embedded source (image-conv only), deterministic edits, and TWO digests \u2014
   recipe_digest (proves the instructions) and render_digest (proves what
   those instructions produced). Import either reproduces the same artwork
   or REFUSES with a named incompatibility; refusal mutates neither shelf
   nor canvas. MIGRATION LAW: v1 recipes (no schema field) migrate
   deterministically to v2 by adding schema and computing digests fresh;
   unknown schema versions are refused loudly, never silently reinterpreted. */
const HEXART_SCHEMA = 2;
const MAX_EMBED_BYTES = 3 * 1024 * 1024;   // 3MB dataURL ceiling \u2014 hostile-import guard
function recipeDigestOf(rec) { let h = 2166136261; const j = JSON.stringify(rec);
  for (let i = 0; i < j.length; i += 7) { h ^= j.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return 'rd-' + h.toString(36) + '-' + j.length.toString(36); }
function renderDigestOf(cells) { let h = 2166136261;
  for (let i = 0; i < cells.length; i++) { h ^= (cells[i] + 2) * (i + 1); h = Math.imul(h, 16777619) >>> 0; }
  return 'xd-' + h.toString(36) + '-' + cells.length; }
function toPortable() {
  const rec = recipe();
  const cells = state.cells.slice();
  const obj = { schema: HEXART_SCHEMA, engine: rec.engine, engine_version: '1',
    topology: rec.topology, cols: rec.cols, rows: rec.rows, palette: rec.palette.slice(), palName: rec.palName,
    seed: rec.seed, prompt: rec.prompt, threshold: rec.threshold, detail: rec.detail, dither: rec.dither,
    edits: { ...rec.edits }, ...(rec.image ? { image: rec.image } : {}),
    recipe_digest: recipeDigestOf(rec), render_digest: renderDigestOf(cells) };
  return obj;
}
/* Import: validate everything hostile-input-first; refuse named; zero mutation on refusal */
function importPortable(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { ok: false, err: 'json-parse-refused' }; }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return { ok: false, err: 'not-an-object' };
  if (obj.schema === undefined) obj.schema = 1;   // v1 migration (round-1/2 shape)
  if (obj.schema === 1) {
    obj.schema = 2; obj.engine_version = obj.engine_version || '1';
    const rec1 = { v: 1, engine: obj.engine, topology: obj.topology, cols: obj.cols, rows: obj.rows,
      seed: obj.seed, prompt: obj.prompt || '', palette: obj.palette, palName: obj.palName || 'custom',
      threshold: obj.threshold, detail: obj.detail, dither: obj.dither, transparent: true, edits: obj.edits || {} };
    obj.recipe_digest = recipeDigestOf(rec1);
    obj.migrated_from = 1;
    if (!obj.render_digest) obj.render_digest = null;   // cannot know before render
  }
  if (obj.schema !== HEXART_SCHEMA) return { ok: false, err: 'schema-unknown-refused', detail: 'schema ' + obj.schema + ' > ' + HEXART_SCHEMA };
  if (!TOPO[obj.topology]) return { ok: false, err: 'topology-refused', detail: String(obj.topology) };
  if (!Number.isSafeInteger(obj.cols) || obj.cols < 4 || obj.cols > 512) return { ok: false, err: 'cols-refused' };
  if (!Number.isSafeInteger(obj.rows) || obj.rows < 4 || obj.rows > 512) return { ok: false, err: 'rows-refused' };
  if (!Array.isArray(obj.palette) || obj.palette.length < 1 || obj.palette.length > 64) return { ok: false, err: 'palette-refused' };
  for (const p of obj.palette) if (!/^#[0-9a-fA-F]{3,8}$/.test(p)) return { ok: false, err: 'palette-color-refused', detail: p };
  if (!Number.isSafeInteger(obj.seed)) return { ok: false, err: 'seed-refused' };
  if (typeof obj.prompt !== 'string' || obj.prompt.length > 512) return { ok: false, err: 'prompt-refused' };
  if (obj.image) {
    if (typeof obj.image.data !== 'string' || !obj.image.data.startsWith('data:image/')) return { ok: false, err: 'image-format-refused' };
    if (obj.image.data.length > MAX_EMBED_BYTES) return { ok: false, err: 'image-oversized-refused', detail: obj.image.data.length + ' > ' + MAX_EMBED_BYTES };
  }
  if (obj.edits !== undefined && obj.edits !== null) {
    if (typeof obj.edits !== 'object' || Array.isArray(obj.edits)) return { ok: false, err: 'edits-refused' };
    let count = 0;
    for (const k of Object.keys(obj.edits)) {
      count++; if (count > 5000) return { ok: false, err: 'edits-count-refused' };
      const m = k.match(/^(\\d+),(\\d+)$/); if (!m) return { ok: false, err: 'edit-key-refused', detail: k };
      const c = +m[1], r = +m[2];
      if (c >= obj.cols || r >= obj.rows) return { ok: false, err: 'edit-bounds-refused', detail: k };
      const v = obj.edits[k];
      if (v !== -1 && !(Number.isSafeInteger(v) && v >= 0 && v < obj.palette.length)) return { ok: false, err: 'edit-value-refused', detail: k + '=' + v };
    }
  }
  if (obj.engine !== 'comb-field' && obj.engine !== 'image-conv') return { ok: false, err: 'engine-refused', detail: String(obj.engine) };
  if (obj.engine === 'image-conv' && !obj.image) return { ok: false, err: 'image-missing-refused' };
  if (obj.recipe_digest !== undefined && typeof obj.recipe_digest !== 'string') return { ok: false, err: 'digest-refused' };
  if (obj.render_digest !== null && obj.render_digest !== undefined && typeof obj.render_digest !== 'string') return { ok: false, err: 'render-digest-refused' };
  return { ok: true, obj };
}

`;

s = s.slice(0, lineStart) + portability + s.slice(lineStart);
fs.writeFileSync('surfaces/hexart.html', s);
console.log('portability core inserted before the shelf block');
