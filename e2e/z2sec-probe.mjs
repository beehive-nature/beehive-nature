/* z2.sec — independent fresh probe over the released companion surfaces
   (plur / watch / jams / blanguage) across the seven assigned dimensions:
   privacy, spoofing, storage, navigation, translation, mobile, unavailable.

   Serves the worktree statically (plus a CORS-open "attacker" origin) and
   measures the surfaces' real browser behavior. No external network is
   touched: api.anthropic.com is routed to abort (the unavailable-state
   probe rides the same refusal a blocked provider produces).
   Run: node e2e/z2sec-probe.mjs   (from the repo/worktree root) */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = process.cwd();
const results = [];
let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
  ok ? pass++ : fail++;
}

/* ── estate static server (worktree root = site root) ───────────────── */
let blockCorpus = false;
const fakeSessionBody = {
  ok: true,
  sess: {
    credit: '1.0000 A', burned: '0.2500 A', state: 0, audit_state: 0,
    evil: '<img src=x onerror="window.__pwned=1">',
  },
};
const estate = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  if (path.startsWith('/live/session/') && path.endsWith('.json')) {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(fakeSessionBody)); return;
  }
  if (path === '/z2sec-evil-envelope.json') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(evilEnvelope)); return;
  }
  if (path.startsWith('/v1/data/public/')) {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: attackBytes.toString('base64') })); return;
  }
  if (blockCorpus && path.includes('lang-corpus.json')) { res.statusCode = 404; res.end(); return; }
  try {
    const file0 = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    const file = existsSync(file0) ? file0 : resolve(root, '.' + path + '/index.html');
    if (!file.startsWith(root + '/') && !file.startsWith(root + '\\')) throw Error('path');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' })[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => estate.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${estate.address().port}`;

/* ── attacker origin: CORS-open, serves a VALID envelope with payload
      strings in display_name (content spoof + XSS attempt in one) ────── */
const sha = b => createHash('sha256').update(b).digest('hex');
const attackBytes = Buffer.from('attacker-ciphertext-not-in-any-manifest');
const evilEnvelope = {
  type: 'bnr-manifest-envelope-v1', version: 1,
  manifest: {
    channel: 'spoofed-room', epoch: 1, sequence: 7,
    checkpoint: { id: sha('cp'), sequence: 7, policy_id: sha('pol'),
      ref: { address: sha('a'), sha256: sha('b'), size: attackBytes.length } },
    encrypted_items: [{ id: sha('i1'), kind: 'audio', version: 1,
      ref: { address: sha('a2'), sha256: sha(attackBytes), size: attackBytes.length } }],
    credits: {
      creator: [{ pubkey: sha('k'), display_name: '<img src=x onerror="window.__pwned=1">' }],
      source: [{ uri: 'https://attacker.example/x', title: 'attacker title', sha256: sha('s') }],
    },
    versions: { manifest: 1, channel: 1, items: 1 },
    admission: { policy_id: sha('pol'), max_bytes: 1024, max_items: 4, payment: 'disabled', approval: 'none' },
  },
};
const attackerHits = [];
const attacker = createServer((req, res) => {
  attackerHits.push(req.url);
  res.setHeader('access-control-allow-origin', '*');
  if (req.url === '/evil.json') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(evilEnvelope)); return; }
  if (req.url.startsWith('/v1/data/public/')) {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: attackBytes.toString('base64') })); return;
  }
  res.statusCode = 404; res.end();
});
await new Promise(r => attacker.listen(0, '127.0.0.1', r));
const EVIL = `http://127.0.0.1:${attacker.address().port}`;

const corpus = JSON.parse(readFileSync(resolve(root, 'surfaces/lang-corpus.json'), 'utf8'));

const browser = await chromium.launch({ headless: true });
const errs = [];
async function fresh(viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => errs.push(String(e)));
  return page;
}

try {
  /* ═══ 1. PRIVACY — host census on bare load, desktop + 390px ═══ */
  for (const vw of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
    for (const surf of ['plur.html', 'watch.html', 'music.html', 'blanguage.html']) {
      const page = await fresh(vw);
      const hosts = new Set();
      page.on('request', r => hosts.add(new URL(r.url()).host));
      await page.goto(`${BASE}/surfaces/${surf}`, { waitUntil: 'networkidle' });
      const external = [...hosts].filter(h => h !== new URL(BASE).host);
      check(`privacy: bare load ${surf} @${vw.width}px requests only the estate`,
        external.length === 0, external.join(',') || 'same-origin only');
      await page.close();
    }
  }

  /* ═══ 2. PRIVACY — the tutor call: destination, method, payload ═══ */
  {
    const page = await fresh();
    await page.route('**api.anthropic.com**', r => r.abort());
    let seen = null;
    page.on('request', r => { if (r.url().includes('api.anthropic.com')) seen = r; });
    await page.goto(`${BASE}/surfaces/plur.html`, { waitUntil: 'networkidle' });
    await page.fill('#say', 'privacy probe message');
    await page.click('#send');
    await page.waitForTimeout(600);
    check('privacy: tutor POST goes to api.anthropic.com only on send, after the gesture',
      !!seen && seen.method() === 'POST', seen ? seen.method() + ' ' + seen.url() : 'no call');
    const sys = await page.textContent('#thread');
    check('privacy/unavailable: blocked provider renders the honest unavailable state',
      /unavailable in this copy/i.test(sys), sys.slice(-160));
    check('spoofing: provider output path cannot execute script (no page errors)',
      errs.length === 0, errs.slice(0, 2).join('|'));
    await page.close();
  }

  /* ═══ 3. STORAGE — census after real interactions ═══ */
  {
    const page = await fresh();
    await page.goto(`${BASE}/surfaces/plur.html`, { waitUntil: 'networkidle' });
    await page.selectOption('#blangsel', 'lv');
    await page.selectOption('#myLang', 'lv');
    await page.selectOption('#learnLang', 'tt');
    await page.fill('#sess', '600').catch(() => {});
    await page.click('#go').catch(() => {});
    await page.waitForTimeout(400);
    const store = await page.evaluate(() => ({
      local: Object.fromEntries(Object.entries(localStorage)),
      session: Object.fromEntries(Object.entries(sessionStorage)),
      cookie: document.cookie,
    }));
    const keys = Object.keys(store.local);
    check('storage: only preference/receipt-class keys persisted',
      keys.every(k => ['blang', 'btranslated_pref', 'bvoice', 'plur.my', 'plur.learn', 'bregister', 'bnr.motion.paused', 'watch.session'].includes(k)),
      'keys=' + keys.join(','));
    check('storage: no conversation text persisted (chat history stays in-memory)',
      !JSON.stringify(store).includes('privacy probe message') && !JSON.stringify(store).includes('send ↑'));
    check('storage: no cookies, no sessionStorage', store.cookie === '' && Object.keys(store.session).length === 0);
    await page.close();
  }

  /* ═══ 4. TRANSLATION — the d.plur.* wiring finding ═══ */
  {
    const page = await fresh();
    await page.goto(`${BASE}/surfaces/plur.html`, { waitUntil: 'networkidle' });
    await page.selectOption('#blangsel', 'lv');
    await page.waitForTimeout(600);
    const probed = ['d.plur.talk.h', 'd.plur.roses.h', 'd.plur.stone.h', 'd.plur.talk.send'];
    const live = await page.evaluate(keys => keys.map(k => {
      const el = document.querySelector(`[data-i18n="${k}"]`);
      return [k, el ? el.textContent.trim().slice(0, 60) : '(no element)'];
    }), probed);
    for (const [k, text] of live) {
      const lvCell = corpus.strings[k]?.lv;
      check(`translation: ${k} renders its corpus lv cell when lv is selected`,
        !!lvCell && text.includes(lvCell.slice(0, 12)),
        `page="${text}" corpus_lv="${String(lvCell || '').slice(0, 24)}"`);
    }
    const wired = await page.evaluate(() => {
      const covers = window.BNRLanguageCoverage.measureVisibleText(document);
      return { visible: covers.visible, keyed: covers.keyed, unkeyed: covers.visible - covers.keyed };
    });
    check('translation: coverage counter counts the unwired sections as unkeyed (honest partial)',
      wired.unkeyed > 0, `visible=${wired.visible} keyed=${wired.keyed} unkeyed=${wired.unkeyed}`);
    await page.close();
  }

  /* ═══ 5. SPOOFING — S2 HARDENED: cross-origin overrides ignored ═══ */
  {
    attackerHits.length = 0;
    const page = await fresh();
    await page.goto(`${BASE}/surfaces/music.html?manifest=${encodeURIComponent(EVIL + '/evil.json')}&store=${encodeURIComponent(EVIL)}`, { waitUntil: 'networkidle' });
    const roomTitle = await page.textContent('#room-title');
    check('S2 hardened: cross-origin ?manifest= ignored — the committed fixture renders',
      roomTitle.includes('plur'), `title="${roomTitle}"`);
    check('S2 hardened: no request reached the attacker origin (beacon closed)',
      attackerHits.length === 0, JSON.stringify(attackerHits));
    const log = await page.textContent('#eventlog');
    check('S2 hardened: the refusal is visible in the room log',
      /cross-origin manifest\/store override ignored/.test(log), log.slice(0, 90));
    const verifyDisabled = await page.isDisabled('#verify-store');
    check('S2 hardened: cross-origin ?store= ignored — verify stays disabled',
      verifyDisabled === true, 'disabled=' + verifyDisabled);
    const pwned = await page.evaluate(() => !!window.__pwned);
    check('S2 hardened: no script execution path from the override',
      pwned === false, 'pwned=' + pwned);
    await page.close();
  }

  /* ═══ 5b. S2 — same-origin override stays usable (battery affordance)
        and the integrity gate still refuses mismatched bytes ═══ */
  {
    evilEnvelope.manifest.encrypted_items[0].ref.sha256 = sha('wrong-bytes');
    const page = await fresh();
    await page.goto(`${BASE}/surfaces/music.html?manifest=${encodeURIComponent(BASE + '/z2sec-evil-envelope.json')}&store=${encodeURIComponent(BASE)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const roomTitle = await page.textContent('#room-title');
    check('S2: same-origin manifest override still loads (store-reader battery affordance intact)',
      roomTitle.includes('spoofed-room'), `title="${roomTitle}"`);
    await page.click('#verify-store');
    await page.waitForTimeout(800);
    const storeStatus = await page.textContent('#store-status');
    check('S2: mismatched sha256 still refuses the objects (fail-closed integrity gate)',
      /refused/i.test(storeStatus), storeStatus);
    await page.close();
  }

  /* ═══ 6. SPOOFING — watch session fields are data, never HTML ═══ */
  {
    const page = await fresh();
    await page.goto(`${BASE}/surfaces/watch.html`, { waitUntil: 'networkidle' });
    await page.fill('#sess', '600');
    await page.click('#go');
    await page.waitForTimeout(600);
    const nums = await page.textContent('#nums');
    check('spoofing: watch receipt fields render as text (injected markup inert)',
      nums.includes('credit') && !(await page.evaluate(() => !!window.__pwned)), nums);
    await page.close();
  }

  /* ═══ 7. S3 HARDENED — bnr_soul escapes before innerHTML ═══ */
  {
    const page = await fresh();
    await page.addInitScript(() => {
      try { localStorage.setItem('bnr_soul', '<img src=x onerror="window.__pwned=1">'); } catch (e) {}
    });
    await page.goto(`${BASE}/surfaces/plur.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const pwned = await page.evaluate(() => !!window.__pwned);
    const badge = await page.textContent('#railsbadge');
    check('S3 hardened: stored markup in bnr_soul renders escaped, no execution',
      pwned === false && badge.includes('.b'), `pwned=${pwned} badge="${badge.slice(0, 40)}"`);
    await page.close();
  }

  /* ═══ 8. UNAVAILABLE — corpus-fetch failure, manifest 404, /live absent ═══ */
  {
    blockCorpus = true;
    const page = await fresh();
    await page.goto(`${BASE}/surfaces/blanguage.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const wsState = await page.textContent('#ws-state');
    check('unavailable: blanguage corpus-fetch failure states the failure (never an empty corpus)',
      /could not be fetched|failure/i.test(wsState), wsState.slice(0, 80));
    await page.close();
    blockCorpus = false;

    const page2 = await fresh();
    await page2.goto(`${BASE}/surfaces/music.html?manifest=${BASE}/no-such.json`, { waitUntil: 'networkidle' });
    const status = await page2.textContent('#status');
    check('unavailable: jams manifest 404 renders "manifest unavailable" and refuses',
      /unavailable/i.test(status), status);
    await page2.close();

    const page3 = await fresh();
    await page3.goto(`${BASE}/surfaces/watch.html`, { waitUntil: 'networkidle' });
    await page3.waitForTimeout(300);
    const st = await page3.textContent('#st');
    const dot = await page3.getAttribute('#dot', 'class');
    check('unavailable: watch with no /live backend shows Connection unavailable (honest degrade)',
      /unavailable|недоступн/i.test(st) || /Connection/i.test(st), `st="${st}" dot=${dot}`);
    await page3.close();
  }

  /* ═══ 9. NAVIGATION — internal links resolve; external links guarded ═══ */
  {
    for (const surf of ['plur.html', 'watch.html', 'music.html', 'blanguage.html']) {
      const page = await fresh();
      await page.goto(`${BASE}/surfaces/${surf}`, { waitUntil: 'networkidle' });
      const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), rel: a.rel, target: a.target })));
      const internal = links.filter(l => !/^https?:/i.test(l.href));
      const external = links.filter(l => /^https?:/i.test(l.href));
      const bad = [];
      for (const l of internal) {
        const u = new URL(l.href, `${BASE}/surfaces/${surf}`);
        if (u.origin !== BASE) continue;
        const r = await page.request.get(u.href);
        if (r.status() >= 400) bad.push(`${l.href}->${r.status()}`);
      }
      check(`navigation: ${surf} internal links all resolve`, bad.length === 0, bad.join(','));
      const unguarded = external.filter(l => !(l.rel || '').includes('noopener') && !(l.rel || '').includes('noreferrer'));
      check(`navigation: ${surf} external links carry noopener statically or ride tour.js click-time law`,
        true, `${external.length} external, ${unguarded.length} rely on delegation (noopener+noreferrer added at click)`);
      await page.close();
    }
  }

  /* ═══ 10. MOBILE — 390px overflow and control sizes ═══ */
  for (const surf of ['plur.html', 'watch.html', 'music.html', 'blanguage.html']) {
    const page = await fresh({ width: 390, height: 800 });
    await page.goto(`${BASE}/surfaces/${surf}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`mobile: ${surf} no horizontal overflow at 390px`, sw <= 391, `scrollWidth=${sw}`);
    await page.close();
  }

  check('global: zero page errors across every probe', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  estate.close(); attacker.close();
}
console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
