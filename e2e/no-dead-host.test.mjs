/* Fleet no-dead-host gate — the #67 law, extended estate-wide (2026-09-13 sweep).
   api.eosn.io is NXDOMAIN (DoH-confirmed 2026-09-12). No browser-side runtime
   code may carry it. Rules:
     1. Zero `api.eosn.io` occurrences in every .html/.js/.tmp file under
        surfaces/ and every .html/.js under crates/bmesh-serve/assets/
        (executable code and near-code temps; .md vendor notes and docs/
        records are not executable and are out of scan).
     2. Rust source: the literal is allowed ONLY inside a #[cfg(test)] region
        (test-fixture labels, no runtime fetch — the structural check proves
        the region, so the fixtures stay untouched per the sweep order).
     3. Per-site: each healed array holds exactly its two confirmed hosts in
        the file's PRE-SWEEP survivor order (remove-only, never reordered).
     4. Selection semantics survive structurally: fixed-order failover loops,
        the wallet probe-and-cache, the adapter's Fisher-Yates shuffle, and
        vaulta-reader's round-robin modulo all still exist. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DEAD = 'api.eosn.io';

const walk = (dir, exts, out = []) => {
  for (const e of readdirSync(new URL('../' + dir, import.meta.url))) {
    const p = join(dir, e);
    const st = statSync(new URL('../' + p, import.meta.url));
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some(x => e.endsWith(x))) out.push(p);
  }
  return out;
};

test('zero dead-host literals in surfaces code and crate assets', () => {
  const files = [
    ...walk('surfaces', ['.html', '.js', '.tmp']),
    ...walk('crates/bmesh-serve/assets', ['.html', '.js']),
  ];
  assert.ok(files.length > 80, 'scanner must actually be finding the fleet');
  const offenders = files.filter(f => read(f).includes(DEAD));
  assert.deepEqual(offenders, [],
    'api.eosn.io is NXDOMAIN; these files still carry it');
});

test('rust literal allowed only inside #[cfg(test)] regions', () => {
  const rs = read('crates/bmesh-serve/src/main.rs').split('\n');
  let cfgTestLine = -1;
  rs.forEach((l, i) => { if (l.includes('#[cfg(test)]') && cfgTestLine < 0) cfgTestLine = i; });
  const hits = [];
  rs.forEach((l, i) => { if (l.includes(DEAD)) hits.push(i); });
  for (const h of hits) {
    assert.ok(cfgTestLine >= 0 && h > cfgTestLine,
      `main.rs line ${h + 1} carries the dead host OUTSIDE the #[cfg(test)] region`);
  }
});

const SITES = [
  { file: 'surfaces/bmeshasi.html', decl: /var VH=\[([^\]]*)\]/, expect: ['https://eos.api.eosnation.io', 'https://eos.greymass.com'] },
  { file: 'surfaces/wallet.html', decl: /var VH=\[([^\]]*)\]/, expect: ['https://eos.api.eosnation.io', 'https://eos.greymass.com'] },
  { file: 'surfaces/wallet-adapter-vaulta.js', decl: /var MAIN_HOSTS ?= ?\[([^\]]*)\]/, expect: ['https://eos.api.eosnation.io', 'https://eos.greymass.com'] },
  { file: 'surfaces/bantfarm.html', decl: /var VAPI=\[([^\]]*)\]/, expect: ['https://eos.greymass.com', 'https://eos.api.eosnation.io'] },
  { file: 'surfaces/blight/workbench.html', decl: /const VAPI=\[([^\]]*)\]/, expect: ['https://eos.greymass.com', 'https://eos.api.eosnation.io'] },
  { file: 'surfaces/blight/vaulta-reader.html', decl: /const VAPI=\[([^\]]*)\]/, expect: ['https://eos.greymass.com', 'https://eos.api.eosnation.io'] },
  { file: 'crates/bmesh-serve/assets/page.html', decl: /var VH=\[([^\]]*)\]/, expect: ['https://eos.api.eosnation.io', 'https://eos.greymass.com'] },
  { file: 'surfaces/workbench.tmp', decl: /const VAPI=\[([^\]]*)\]/, expect: ['https://eos.greymass.com', 'https://eos.api.eosnation.io'] },
];

for (const s of SITES) {
  test(`${s.file}: exactly the two confirmed hosts, survivor order preserved`, () => {
    const m = read(s.file).match(s.decl);
    assert.ok(m, 'host array declaration must exist');
    const hosts = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
    assert.deepEqual(hosts, s.expect, 'remove-only sweep: the dead host left, nobody reordered');
  });
}

test('selection semantics survive structurally', () => {
  const adapter = read('surfaces/wallet-adapter-vaulta.js');
  assert.match(adapter, /for \(var j = hs\.length - 1; j > 0; j--\)/, 'Fisher-Yates shuffle must survive');
  const reader = read('surfaces/blight/vaulta-reader.html');
  assert.match(reader, /VAPI\[\(vidx\+i\)%VAPI\.length\]/, 'round-robin modulo must survive');
  const wallet = read('surfaces/wallet.html');
  assert.match(wallet, /LIVE_HOST=VH\[i\]/, 'probe-once-cache must survive');
  const mesh = read('surfaces/bmeshasi.html');
  assert.match(mesh, /vi\+\+; ?vNext\(\)/, 'fixed-order failover walk must survive');
});
