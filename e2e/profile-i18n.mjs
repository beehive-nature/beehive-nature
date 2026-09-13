// profile-i18n.mjs — the dynasty profile's three-mode translation regression.
// Born of the 2026-09-12 translation lane: the house-archive chrome (headings,
// controls, editor and privacy copy, mode-specific labels) is keyed in the
// corpus, while published house-record prose stays the English record of
// origin. This proves the RENDERED side in a real browser, per register:
//   - every checked control/heading renders its exact corpus cell (ru)
//   - the three registers carry their own mode-specific renderings
//   - dynamic statuses (audience note, editor, share) ride the corpus through
//     BNRLanguage.text, including after a live language switch
//   - RTL tongues set dir=rtl; record data stays English, visibly and honestly
//   - zero uncaught page errors
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SURF = join(ROOT, 'surfaces');
const corpus = JSON.parse(readFileSync(join(SURF, 'lang-corpus.json'), 'utf8'));
const cell = (k, l) => corpus.strings[k]?.[l];

const srv = createServer(async (q, s) => {
  try {
    const p = join(SURF, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '').replace('surfaces/', ''));
    const body = await readFile(p);
    s.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream', 'cache-control': 'no-store' });
    s.end(body);
  } catch { s.writeHead(404); s.end(); }
});

let pass = 0; const fails = [];
const ok = (name, cond, note = '') => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fails.push(name + (note ? ' — ' + note : '')); console.log('FAIL ' + name + (note ? ' — ' + note : '')); }
};
const textOf = (p, sel) => p.evaluate(s => document.querySelector(s)?.textContent ?? null, sel);

async function openState(browser, { reg, lang, beat }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e).slice(0, 120)));
  await p.addInitScript(([r, l]) => {
    try { localStorage.setItem('bregister', r); localStorage.setItem('blang', l); } catch (e) {}
  }, [reg, lang]);
  await p.goto('http://127.0.0.1:8841/profile.html', { waitUntil: 'load' });
  // wait for the corpus swap to land on a translated kicker
  await p.waitForFunction(() => {
    const k = document.querySelector('.archive-kicker');
    return k && k.textContent !== 'skaists .b · house archive · v2';
  }, { timeout: 5000 }).catch(() => {});
  if (beat) await p.evaluate(b => document.body.setAttribute('data-prof-beat', b), beat);
  return { ctx, p, errors };
}

srv.listen(8841, '127.0.0.1', async () => {
  const browser = await chromium.launch();

  /* ── New bee · ru · the house-archive beat ─────────────────────────── */
  {
    const { ctx, p, errors } = await openState(browser, { reg: 'bee', lang: 'ru', beat: 'house' });
    ok('bee: register applied', await p.evaluate(() => document.body.getAttribute('data-reg')) === 'bee');
    ok('bee: kicker renders the ru corpus cell', await textOf(p, '.crest-copy .archive-kicker') === cell('prof.arch.kicker', 'ru'));
    ok('bee: mode-specific lead is the bee register', await textOf(p, 'p[data-i18n="prof.arch.lead.bee"]') === cell('prof.arch.lead.bee', 'ru'));
    ok('bee: lineage heading is welcoming bee copy', await textOf(p, '#lineage-title span[data-reg="bee"]') === cell('prof.arch.lin.h.bee', 'ru'));
    ok('bee: audience buttons render ru', await textOf(p, '[data-audience-choice="public"]') === cell('prof.arch.aud.public', 'ru'));
    ok('bee: share control renders ru', await textOf(p, '#share-house') === cell('prof.arch.share', 'ru'));
    ok('bee: editor summary renders ru', await textOf(p, '#profile-editor > summary') === cell('prof.arch.ed.summary', 'ru'));
    // dynamic audience note through BNRLanguage.text
    await p.click('[data-audience-choice="circle"]');
    ok('audience note follows the circle choice in ru', await textOf(p, '#audience-note') === cell('prof.arch.aud.note.circle', 'ru'));
    await p.click('[data-audience-choice="private"]');
    ok('audience note follows the private choice in ru', await textOf(p, '#audience-note') === cell('prof.arch.aud.note.private', 'ru'));
    // editor statuses through BNRLanguage.text
    await p.click('#profile-editor > summary');
    await p.fill('#profile-name-input', '');
    await p.click('#profile-edit-form button[type="submit"]');
    ok('empty-field editor status renders ru', await textOf(p, '#profile-edit-status') === cell('prof.arch.ed.req', 'ru'));
    await p.fill('#profile-name-input', 'Travis Mark Remington');
    await p.click('#profile-edit-form button[type="submit"]');
    ok('applied editor status renders ru', await textOf(p, '#profile-edit-status') === cell('prof.arch.ed.applied', 'ru'));
    // a live language switch re-renders the CURRENT status, not the boot default
    await p.evaluate(() => document.dispatchEvent(new CustomEvent('blang', { detail: { lang: 'ru' } })));
    ok('blang re-render keeps the current editor status', await textOf(p, '#profile-edit-status') === cell('prof.arch.ed.applied', 'ru'));
    ok('bee: zero page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── Raver · ru · figure → house beats ─────────────────────────────── */
  {
    const { ctx, p, errors } = await openState(browser, { reg: 'raver', lang: 'ru' });
    ok('raver: arrival feel line renders ru', await textOf(p, '.feel') === cell('prof.raver.feel', 'ru'));
    await p.evaluate(() => document.body.setAttribute('data-prof-beat', 'figure'));
    ok('raver: consciousness line renders ru', await textOf(p, '.consciousness') === cell('prof.raver.consciousness', 'ru'));
    await p.evaluate(() => document.body.setAttribute('data-prof-beat', 'house'));
    ok('raver: mode-specific lead is the raver register', await textOf(p, 'p[data-i18n="prof.arch.lead.raver"]') === cell('prof.arch.lead.raver', 'ru'));
    ok('raver: symbols heading is approachable set-list copy', await textOf(p, '#symbol-title') === cell('prof.arch.sym.h', 'ru'));
    ok('raver: symbol card body renders ru', await textOf(p, '.symbol-card span[data-i18n="prof.arch.sym.bee.p"]') === cell('prof.arch.sym.bee.p', 'ru'));
    ok('raver: evidence chip renders ru', await textOf(p, '.symbol-card .evidence-chip') === cell('prof.arch.sym.chip', 'ru'));
    ok('raver: lineage heading is circle-choice copy', await textOf(p, '#lineage-title span[data-reg="raver"]') === cell('prof.arch.lin.h.raver', 'ru'));
    ok('raver: zero page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── Cypherpunk · ru · the instrument and the technical panels ─────── */
  {
    const { ctx, p, errors } = await openState(browser, { reg: 'cypherpunk', lang: 'ru' });
    ok('cypher: masthead eyebrow renders ru', await textOf(p, '#masthead .eyebrow') === cell('prof.mast.eyebrow', 'ru'));
    ok('cypher: masthead disclosure renders ru', await textOf(p, '#masthead .sub') === cell('prof.mast.sub', 'ru'));
    ok('cypher: mode-specific lead is the technical register', await textOf(p, 'p[data-i18n="prof.arch.lead.cypher"]') === cell('prof.arch.lead.cypher', 'ru'));
    ok('cypher: lineage heading is the disclosure-projection copy', await textOf(p, '#lineage-title span[data-reg="cypherpunk"]') === cell('prof.arch.lin.h.cypher', 'ru'));
    ok('cypher: privacy matrix heading renders ru', await textOf(p, '#privacy-title') === cell('prof.arch.priv.h', 'ru'));
    ok('cypher: privacy matrix header cell renders ru', await textOf(p, '.privacy-matrix thead th[data-i18n="prof.arch.priv.th.field"]') === cell('prof.arch.priv.th.field', 'ru'));
    ok('cypher: privacy value cell renders ru', await p.evaluate(() => document.querySelector('.privacy-matrix td[data-i18n="prof.arch.priv.v.yes"]')?.textContent) === cell('prof.arch.priv.v.yes', 'ru'));
    ok('cypher: schema dt renders ru', await textOf(p, '[data-profile-schema="person"] dt[data-i18n="prof.arch.schema.person.holder"]') === cell('prof.arch.schema.person.holder', 'ru'));
    ok('cypher: kind toggle renders ru', await textOf(p, '[data-kind-choice="agent"]') === cell('prof.arch.kind.agent', 'ru'));
    ok('cypher: manifest heading renders ru', await textOf(p, '#manifest-title') === cell('prof.arch.man.h', 'ru'));
    const manifest = await p.evaluate(() => document.querySelector('#profile-manifest')?.textContent ?? '');
    ok('cypher: manifest stays a local JSON receipt', manifest.includes('"skaists.house-disclosure/1"'));
    ok('cypher: instrument law renders ru', await textOf(p, 'h2[data-i18n="prof.inst.h1"]') === cell('prof.inst.h1', 'ru'));
    ok('cypher: honest English record of origin — holder name untranslated', await p.evaluate(() => [...document.querySelectorAll('.bname')].some(n => n.textContent.includes('Travis Mark Remington'))));
    ok('cypher: coverage counter is honest and machine-marked', await p.evaluate(() => /^⚙ \d+\/\d+$/.test(document.querySelector('#blangnote')?.textContent ?? '')));
    ok('cypher: zero page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── RTL: he and ar set direction ──────────────────────────────────── */
  for (const lang of ['he', 'ar']) {
    const { ctx, p, errors } = await openState(browser, { reg: 'bee', lang, beat: 'house' });
    ok(lang + ': dir=rtl on the document', await p.evaluate(() => document.documentElement.dir) === 'rtl');
    ok(lang + ': kicker renders the ' + lang + ' corpus cell', await textOf(p, '.crest-copy .archive-kicker') === cell('prof.arch.kicker', lang));
    ok(lang + ': zero page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ── Sanskrit + Tatar spot render (script reach) ───────────────────── */
  for (const lang of ['sa', 'tt']) {
    const { ctx, p, errors } = await openState(browser, { reg: 'bee', lang, beat: 'house' });
    const t = await textOf(p, '#lineage-title span[data-reg="bee"]');
    ok(lang + ': lineage heading renders in its own script', t === cell('prof.arch.lin.h.bee', lang) && /[^\u0000-\u007F]/.test(t ?? ''), JSON.stringify(t));
    ok(lang + ': zero page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log('\n' + pass + ' passed, ' + fails.length + ' failed');
  fails.forEach(f => console.log('  ' + f));
  process.exit(fails.length ? 1 : 0);
});
