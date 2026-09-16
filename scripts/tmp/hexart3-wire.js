// hexart3-wire.js — wire the export/import UI + the shelf digest upgrade
const fs = require('fs');
let s = fs.readFileSync('surfaces/hexart.html', 'utf8');

// 1. UI: export .hexart.json + import button beside save/load recipe
const oldRecipe = `    <button class="small" id="saveRecipe" data-i18n="hexart.saveRecipe">save recipe</button>
    <button class="small" id="loadRecipe" data-i18n="hexart.loadRecipe">load recipe</button>`;
const newRecipe = `    <button class="small" id="exportPortable" data-i18n="hexart.exportObj">⬡ export .hexart.json</button>
    <button class="small" id="importPortable" data-i18n="hexart.importObj">import piece</button>
    <button class="small" id="saveRecipe" data-i18n="hexart.saveRecipe">save recipe</button>
    <button class="small" id="loadRecipe" data-i18n="hexart.loadRecipe">load recipe</button>
    <input type="file" id="importFile" accept=".json,application/json" hidden>`;
if (!s.includes(oldRecipe)) { console.error('recipe UI anchor missing'); process.exit(1); }
s = s.replace(oldRecipe, newRecipe);

// 2. wiring: export downloads the canonical object; import validates + applies or refuses
const wireAnchor = `$('shelfSave').addEventListener('click', shelfSave);`;
const wireNew = `$('exportPortable').addEventListener('click', () => {
  const obj = toPortable();
  download(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }),
    'hexart-' + (obj.prompt ? obj.prompt.slice(0, 16).replace(/[^a-z0-9]+/gi, '-') : obj.seed.toString(16)) + '.hexart.json');
  say('piece exported — recipe_digest ' + obj.recipe_digest.slice(0, 14) + ' · render_digest ' + obj.render_digest.slice(0, 14));
});
$('importPortable').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', ev => {
  const f = ev.target.files[0]; if (!f) return;
  if (f.size > 5 * 1024 * 1024) { say('import refused: file > 5MB'); return; }   // pre-parse guard
  const fr = new FileReader();
  fr.onload = async () => {
    // snapshot the current state — refusal mutates nothing
    const snap = JSON.stringify({ t: state.topology, c: state.cols, r: state.rows, s: state.seed,
      p: state.palette, e: state.edits, eng: state.engine, cells: state.cells.join(',') });
    const verdict = importPortable(String(fr.result));
    if (!verdict.ok) { say('import refused: ' + verdict.err + (verdict.detail ? ' (' + verdict.detail + ')' : '')); return; }
    const obj = verdict.obj;
    try {
      state.topology = obj.topology; state.cols = obj.cols; state.rows = obj.rows; state.seed = obj.seed;
      state.palette = obj.palette.slice(); state.palName = obj.palName || 'custom';
      state.threshold = obj.threshold; state.detail = obj.detail; state.dither = obj.dither;
      state.edits = obj.edits || {};
      state.engine = obj.engine;
      $('prompt').value = obj.prompt || ''; $('cols').value = obj.cols; $('colsV').textContent = obj.cols;
      $('thr').value = obj.threshold; $('thrV').textContent = obj.threshold + '%';
      $('oct').value = obj.detail; $('octV').textContent = obj.detail; $('dither').checked = obj.dither;
      setTopoUI(obj.topology); selectSwatch(0);
      let src = null;
      if (obj.image && obj.image.data) {
        const im2 = new Image();
        await new Promise(res => { im2.onload = res; im2.onerror = res; im2.src = obj.image.data; });
        if (!im2.width) { throw new Error('embedded image failed to decode'); }
        state.imgCanvas = im2; state.imgSrc = true; state.imgData = null; src = imgDataFor({ ...obj });
      } else { state.imgSrc = false; state.imgData = null; }
      state.cells = window.HexArtEngines[state.engine].generate(obj, src);
      applyEdits(); render();
      const rendered = renderDigestOf(state.cells);
      if (obj.render_digest && rendered !== obj.render_digest) {
        say('import WARNING: render_digest mismatch (expected ' + obj.render_digest.slice(0, 14) + ', produced ' + rendered.slice(0, 14) + ') — the piece rendered but differs from the export');
      } else {
        say('piece imported' + (obj.migrated_from ? ' (migrated from v' + obj.migrated_from + ')' : '') + ' — render_digest verified: ' + rendered.slice(0, 14));
      }
    } catch (e) {
      // restore the snapshot — the promise of zero mutation on failure
      const p = JSON.parse(snap);
      state.topology = p.t; state.cols = p.c; state.rows = p.r; state.seed = p.s;
      state.palette = p.p; state.edits = p.e; state.engine = p.eng;
      state.cells = p.cells.split(',').map(Number);
      render();
      say('import refused: ' + e.message + ' — canvas and shelf untouched');
    }
  };
  fr.readAsText(f);
});
$('shelfSave').addEventListener('click', shelfSave);`;
if (!s.includes(wireAnchor)) { console.error('wire anchor missing'); process.exit(1); }
s = s.replace(wireAnchor, wireNew);

// 3. expose for e2e
s = s.replace('window.__hexartShelf = { save: shelfSave, list: shelfRead, load: shelfLoad, digest: recipeDigest };',
  'window.__hexartShelf = { save: shelfSave, list: shelfRead, load: shelfLoad, digest: recipeDigest };\nwindow.__hexartPort = { toPortable, importPortable, recipeDigestOf, renderDigestOf, SCHEMA: HEXART_SCHEMA };');

fs.writeFileSync('surfaces/hexart.html', s);
console.log('UI + wiring + e2e handle applied');
