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
