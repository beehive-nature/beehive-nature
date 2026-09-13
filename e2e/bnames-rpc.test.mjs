/* bnames RPC regression — no dead host, exactly the two confirmed hosts,
   and the enfill bookkeeping stays TRUE (every recorded cell really is
   English-fill at the corpus).
   Origin defect (2026-09-12 live acceptance): HOSTS led with
   https://api.eosn.io, which is NXDOMAIN at Cloudflare/Google DoH — every
   visitor's first registry read died on DNS. The fix law is meter.py's:
   two confirmed hosts, and a third joins only with live proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('surfaces/bnames.html');
const corpus = JSON.parse(read('surfaces/lang-corpus.json'));

const CONFIRMED_HOSTS = ['https://eos.api.eosnation.io', 'https://eos.greymass.com'];

test('bnames never references the dead api.eosn.io host', () => {
  assert.equal(page.includes('api.eosn.io'), false,
    'api.eosn.io is NXDOMAIN (DoH-confirmed 2026-09-12); it must not appear anywhere in bnames.html');
});

test('bnames HOSTS is exactly the two confirmed hosts', () => {
  const m = page.match(/var HOSTS=\[([^\]]*)\]/);
  assert.ok(m, 'HOSTS declaration must exist');
  const hosts = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  assert.deepEqual(hosts, CONFIRMED_HOSTS,
    'a third host joins only with a live probe receipt — not by list edit');
});

test('edu-i18n-recovery enfill record exists and every recorded cell is really en-fill', () => {
  const list = corpus._meta.enfill['edu-i18n-recovery'];
  assert.ok(Array.isArray(list) && list.length === 6,
    'six key:lang cells (four keys) confirmed against the 6e96229d artifact');
  const norm = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  for (const entry of list) {
    const [key, lang] = entry.split(':');
    const row = corpus.strings[key];
    assert.ok(row, `key ${key} must exist`);
    assert.ok(row[lang], `cell ${entry} must exist`);
    assert.equal(norm(row[lang]), norm(row.en),
      `${entry} is recorded as English-fill but carries a translation — remove the stale enfill entry instead`);
  }
});
