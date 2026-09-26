// comprehension.test.mjs — the disclosure proofs (founder order 2026-09-16):
// bee/raver meet summaries, not walls; cypherpunk stands open; a reader's own
// tap survives register changes; the full text is still in the page (nothing
// removed); ru summaries render corpus-exact; touch floors hold.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURF = join(HERE, '..', 'surfaces');
const corpus = JSON.parse(readFileSync(join(SURF, 'lang-corpus.json'), 'utf8'));
const cell = (k, l) => corpus.strings[k] && corpus.strings[k][l];

let b = null;
const srv = createServer(async (q, s) => {
  try {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/surfaces(?=\/|$)/, '').replace(/^\//, '');
    const ct = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    const body = await readFile(join(SURF, rel));
    if (!s.headersSent) s.writeHead(200, { 'content-type': ct });
    s.end(body);
  } catch { if (!s.headersSent) s.writeHead(404); s.end(); }
});
before(async () => { await new Promise(r => srv.listen(8866, '127.0.0.1', r)); b = await chromium.launch(); });
after(async () => { if (b) await b.close(); srv.close(); });

async function at(page, reg, lang = 'en') {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx.addInitScript(([r, l]) => { try { localStorage.setItem('bregister', r); localStorage.setItem('blang', l); } catch (e) {} }, [reg, lang]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://127.0.0.1:8866/surfaces/' + page, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2600);
  return { ctx, p, errs };
}

test('wallet bee: walls collapsed to summaries, nothing removed', async () => {
  const { ctx, p, errs } = await at('wallet.html', 'bee');
  const st = await p.evaluate(() => {
    const ds = [...document.querySelectorAll('details[data-reg-disclose]')];
    return {
      count: ds.length,
      open: ds.filter(d => d.open).length,
      passkeyText: document.querySelector('[data-i18n="wl.d.passkey"]') ? document.querySelector('[data-i18n="wl.d.passkey"]').textContent : '',
      fullTextKept: ds.every(d => (d.textContent || '').length > 200)
    };
  });
  assert.ok(st.count >= 7, 'seven disclosures on wallet, got ' + st.count);
  assert.equal(st.open, 0, 'all collapsed for bee');
  assert.match(st.passkeyText, /bzDiD/, 'summary renders');
  assert.ok(st.fullTextKept, 'the full technical text rides inside every disclosure');
  assert.equal(errs.length, 0, errs.join(' | '));
  await ctx.close();
});

test('wallet cypherpunk: disclosures stand open', async () => {
  const { ctx, p } = await at('wallet.html', 'cypherpunk');
  const open = await p.evaluate(() => [...document.querySelectorAll('details[data-reg-disclose]')].filter(d => d.open).length);
  const total = await p.evaluate(() => document.querySelectorAll('details[data-reg-disclose]').length);
  assert.equal(open, total, 'all open for cypherpunk');
  assert.ok(total >= 7);
  await ctx.close();
});

test('the reader\u2019s own tap survives a register switch', async () => {
  const { ctx, p } = await at('wallet.html', 'bee');
  // new bee opens on its home list (the three grammars, 2026-09-26): the
  // reader's first step to any note is a row; "show me everything" opens all
  await p.locator('#wl-bee [data-wl-go="all"]').click();
  await p.waitForTimeout(300);
  await p.locator('details[data-reg-disclose] > summary').first().click();
  await p.waitForTimeout(300);
  await p.locator('#breg-cypherpunk').click();
  await p.waitForTimeout(500);
  const st = await p.evaluate(() => {
    const ds = [...document.querySelectorAll('details[data-reg-disclose]')];
    return { total: ds.length, open: ds.filter(d => d.open).length, firstOpen: ds[0] ? ds[0].open : null };
  });
  // first was user-opened in bee → stays open after switching; the REST open for cypherpunk anyway
  assert.ok(st.firstOpen, 'the tapped one stays open');
  assert.equal(st.open, st.total, 'cypherpunk default opens the rest');
  await ctx.close();
});

test('summaries translate: ru renders corpus-exact on museum + wallet', async () => {
  const pollRu = async (page, key) => page.waitForFunction(k => {
    const el = document.querySelector('[data-i18n="' + k + '"]');
    return el && /[Ѐ-ӿ]/.test(el.textContent);
  }, key, { timeout: 12000 }).catch(() => {});
  const { ctx, p } = await at('blight/museum.html', 'bee', 'ru');
  await pollRu(p, 'mu.d.origin');
  const got = await p.locator('[data-i18n="mu.d.origin"]').textContent();
  assert.equal(got, cell('mu.d.origin', 'ru'));
  await ctx.close();
  const w = await at('wallet.html', 'bee', 'ru');

  await pollRu(w.p, 'wl.d.fiat');
  const gotW = await w.p.locator('[data-i18n="wl.d.fiat"]').textContent();
  assert.equal(gotW, cell('wl.d.fiat', 'ru'));
  await w.ctx.close();
});

test('touch floor: wallet controls meet the 44px canon at 390px', async () => {
  const { ctx, p } = await at('wallet.html', 'bee');
  const small = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('section button, section select, section input').forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) out.push((n.id || n.tagName) + ':' + Math.round(r.height));
    });
    return out;
  });
  assert.deepEqual(small, [], 'no sub-44px controls in sections: ' + small.join(', '));
  await ctx.close();
});

test('spend-audit engine: register-aware at render time — bee collapses, cypherpunk opens, headline stays', async () => {
  const bee = await at('wallet.html', 'bee');
  await bee.p.waitForFunction(() => window.__spendAuditStats, null, { timeout: 15000 });
  await bee.p.waitForTimeout(400);
  const stB = await bee.p.evaluate(() => {
    const eng = document.getElementById('receiptsBody');
    const ds = [...eng.querySelectorAll('details[data-reg-disclose]')];
    return { total: ds.length, open: ds.filter(d => d.open).length,
      headline: !!eng.querySelector('span[style*="26px"]'),
      lead: (eng.querySelector('div[style*="11.5px"]') || {}).textContent || '' };
  });
  assert.equal(stB.total, 2, 'engine renders its two disclosures');
  assert.equal(stB.open, 0, 'collapsed for bee at mount time');
  assert.ok(stB.headline, 'the recomputed total headline stays visible for every register');
  assert.match(stB.lead, /browser|браузер/i, 'the friendly lead renders');
  // the receipts live in bee's "see how it works" task (the three grammars, 2026-09-26)
  await bee.p.locator('#wl-bee [data-wl-go="proof"]').click();
  await bee.p.waitForTimeout(300);
  await bee.p.locator('#receiptsBody details[data-reg-disclose] > summary').first().click();
  await bee.p.waitForTimeout(250);
  await bee.p.locator('#breg-cypherpunk').click();
  await bee.p.waitForTimeout(500);
  const stC = await bee.p.evaluate(() => {
    const ds = [...document.getElementById('receiptsBody').querySelectorAll('details[data-reg-disclose]')];
    return { open: ds.filter(d => d.open).length, total: ds.length };
  });
  assert.equal(stC.open, stC.total, 'cypherpunk opens all (tapped one stayed, rest opened)');
  assert.equal(bee.errs.length, 0, bee.errs.join(' | '));
  await bee.ctx.close();
});

test('stack organ board: walls become disclosures; bee-only walls never show empty to cypherpunk', async () => {
  const bee = await at('stack.html', 'bee');
  const stB = await bee.p.evaluate(() => {
    const ds = [...document.querySelectorAll('details[data-reg-disclose]')];
    return { total: ds.length, open: ds.filter(d => d.open).length,
      beeOnly: ds.filter(d => d.dataset.reg === 'bee').length,
      fullTextKept: ds.every(d => (d.textContent || '').length > 150) };
  });
  assert.ok(stB.total >= 7, 'seven disclosures on the organ board, got ' + stB.total);
  assert.equal(stB.open, 0, 'collapsed for bee');
  assert.equal(stB.beeOnly, 2, 'the two bee-only walls carry data-reg onto the whole disclosure');
  assert.ok(stB.fullTextKept, 'full text rides inside');
  assert.equal(bee.errs.length, 0, bee.errs.join(' | '));
  await bee.ctx.close();
  const cp = await at('stack.html', 'cypherpunk');
  const stC = await cp.p.evaluate(() => {
    const all = [...document.querySelectorAll('details[data-reg-disclose]')];
    const visible = all.filter(d => d.dataset.reg !== 'bee');
    return { total: all.length, visibleToCp: visible.length,
      open: visible.filter(d => d.open).length,
      beeOnlyHidden: all.filter(d => d.dataset.reg === 'bee').every(d => getComputedStyle(d).display === 'none') };
  });
  assert.ok(stC.beeOnlyHidden, 'bee-only disclosures never render for cypherpunk (no empty summary)');
  assert.equal(stC.open, stC.visibleToCp, 'cypherpunk sees the rest standing open');
  assert.equal(cp.errs.length, 0, cp.errs.join(' | '));
  await cp.ctx.close();
});

test('wave-3 classification: genuine walls fold; narrative and operational prose stay visible for bee', async () => {
  // museum: the two technical notes fold; thesis, exhibit ledes, Autoglyph
  // interpretation and corrections culture STAY in the reading flow
  const mu = await at('blight/museum.html', 'bee');
  const muSt = await mu.p.evaluate(() => {
    const ds = [...document.querySelectorAll('details[data-reg-disclose]')];
    const vis = s => { const el = [...document.querySelectorAll('body *')].find(n => n.children.length === 0 && (n.textContent || '').trim().startsWith(s)); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return { open: ds.filter(d => d.open).length,
      thesisVisible: [...document.querySelectorAll('.note.panel,.lede')].some(n => (n.textContent || '').includes('more on-chain than most people think') && n.getBoundingClientRect().height > 0),
      autoglyphVisible: [...document.querySelectorAll('.lede')].some(n => (n.textContent || '').includes("There isn't one") && n.getBoundingClientRect().height > 0),
      bitcoinLedeVisible: [...document.querySelectorAll('.lede')].some(n => (n.textContent || '').includes('Counterparty, 2014') && n.getBoundingClientRect().height > 0) };
  });
  assert.equal(muSt.open, 0, 'museum disclosures collapsed for bee');
  assert.ok(muSt.thesisVisible, 'the museum thesis stays visible');
  assert.ok(muSt.autoglyphVisible, 'the Autoglyph interpretation stays visible');
  assert.ok(muSt.bitcoinLedeVisible, 'the Bitcoin exhibit lede stays visible');
  assert.equal(mu.errs.length, 0, mu.errs.join(' | '));
  await mu.ctx.close();
  // midivault: provenance folds; the SIMULATED banner and share-mode flow STAY
  const mv = await at('blight/midivault.html', 'bee');
  const mvSt = await mv.p.evaluate(() => {
    const b = document.getElementById('bmsg');
    return { open: [...document.querySelectorAll('details[data-reg-disclose]')].filter(d => d.open).length,
      simVisible: b && b.getBoundingClientRect().height > 0 && /SIMULATED/.test(b.textContent),
      modesVisible: [...document.querySelectorAll('p.law')].some(n => (n.textContent || '').includes('share it three ways') && n.getBoundingClientRect().height > 0) };
  });
  assert.equal(mvSt.open, 0, 'midivault disclosure collapsed for bee');
  assert.ok(mvSt.simVisible, 'the SIMULATED operational banner stays visible');
  assert.ok(mvSt.modesVisible, 'the share-mode flow explanation stays visible');
  assert.equal(mv.errs.length, 0, mv.errs.join(' | '));
  await mv.ctx.close();
  // c1-aid: the recap folds; the lede and the two-numbers lesson STAY
  const c1 = await at('blight/c1-aid.html', 'bee');
  const c1St = await c1.p.evaluate(() => {
    return { open: [...document.querySelectorAll('details[data-reg-disclose]')].filter(d => d.open).length,
      ledeVisible: [...document.querySelectorAll('.lede')].some(n => (n.textContent || '').includes("founder's bar") && n.getBoundingClientRect().height > 0),
      lessonVisible: [...document.querySelectorAll('.note')].some(n => (n.textContent || '').includes('Two numbers, both true') && n.getBoundingClientRect().height > 0) };
  });
  assert.equal(c1St.open, 0, 'c1-aid disclosure collapsed for bee');
  assert.ok(c1St.ledeVisible, 'the c1-aid lede stays visible');
  assert.ok(c1St.lessonVisible, 'the two-numbers lesson stays visible');
  assert.equal(c1.errs.length, 0, c1.errs.join(' | '));
  await c1.ctx.close();
});

test('blight cluster: midi + workbench + b4b disclosures collapse for bee', async () => {
  for (const page of ['blight/midi.html', 'blight/workbench.html', 'b4b.html']) {
    const { ctx, p, errs } = await at(page, 'bee');
    const st = await p.evaluate(() => {
      const ds = [...document.querySelectorAll('details[data-reg-disclose]')];
      return { total: ds.length, open: ds.filter(d => d.open).length };
    });
    assert.ok(st.total >= 3, page + ' carries its disclosures');
    assert.equal(st.open, 0, page + ' collapsed for bee');
    assert.equal(errs.length, 0, page + ': ' + errs.join('|'));
    await ctx.close();
  }
});
