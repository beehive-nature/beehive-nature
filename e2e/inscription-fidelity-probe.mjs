/* inscription-fidelity-probe.mjs — why our explorer doesn't match
   inscriptions.app. Three suspects, measured:
   A. per-collection enumeration selectors (mushroom vs medusa vs inscription naming)
   B. PEPI getSvg arity: pair vs triple — different art?
   C. SVG internals: do multiple inlined pieces carry colliding classes and styles? */
import { chromium } from 'playwright';

const GARDEN = '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876';
const COLS = {
  FUNGI:  '0x7d9Ce55D54FF3FEddb611fC63fF63ec01F26D15F',
  JELLI:  '0xA1b9d812926a529D8B002E69FCd070c8275eC73c',
  PEPIv2: '0x28a5e71BFc02723eAC17E39c84c5190415C0de9F',
  FROGGI: '0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE',
};
const RPC = 'https://base-rpc.publicnode.com';

const browser = await chromium.launch({ args:['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8912/surfaces/blight/midi.html', { waitUntil:'domcontentloaded', timeout:30000 });
await page.waitForFunction(() => typeof keccak256 === 'function', null, { timeout:15000 });

const out = await page.evaluate(async ({ GARDEN, COLS, RPC }) => {
  const hexB = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  const sel = sig => '0x' + hexB(keccak256(new TextEncoder().encode(sig))).slice(0, 8);
  const W = n => BigInt(n).toString(16).padStart(64, '0');
  const AD = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const call = async (to, data) => {
    const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call', params:[{ to, data }, 'latest'] }) });
    const j = await r.json();
    return j.result !== undefined ? j.result : 'ERR:' + JSON.stringify(j.error).slice(0, 60);
  };
  const decodeStr = hex => {
    const h = hex.replace(/^0x/, '');
    if (h.length < 192) return null;
    if (parseInt(h.slice(0, 64), 16) !== 0x20) return null;
    const len = parseInt(h.slice(64, 128), 16);
    if (!(len > 0 && len <= 65536) || h.length < 128 + len * 2) return null;
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(parseInt(h.slice(128 + i*2, 130 + i*2), 16));
    return s;
  };
  const words = ret => (ret.replace(/^0x/, '').match(/.{64}/g) || []);

  const res = { selectors: {}, probes: {} };

  /* A. the true selectors */
  res.selectors = {
    mushroomCount: sel('mushroomCount(address)'),
    mushroomOfOwnerByIndex: sel('mushroomOfOwnerByIndex(address,uint256)'),
    medusaCount: sel('medusaCount(address)'),
    medusaOfOwnerByIndex: sel('medusaOfOwnerByIndex(address,uint256)'),
    inscriptionCount: sel('inscriptionCount(address)'),
    inscriptionOfOwnerByIndex: sel('inscriptionOfOwnerByIndex(address,uint256)'),
  };

  /* B. enumerate the garden on each contract with the RIGHT selector */
  for (const [sym, addr] of Object.entries(COLS)) {
    const pair = sym === 'JELLI' ? ['medusaCount', 'medusaOfOwnerByIndex']
      : sym === 'FROGGI' ? ['inscriptionCount', 'inscriptionOfOwnerByIndex']
      : ['mushroomCount', 'mushroomOfOwnerByIndex'];
    const cnt = await call(addr, res.selectors[pair[0]] + AD(GARDEN));
    const n = cnt && !cnt.startsWith('ERR') && cnt !== '0x' ? Number(BigInt(cnt)) : 0;
    const info = { countSelector: pair[0], count: n, records: [] };
    for (let i = 0; i < Math.min(n, 3); i++) {
      const rec = await call(addr, res.selectors[pair[1]] + AD(GARDEN) + W(i));
      const w = words(rec);
      if (w.length >= 2) info.records.push({ seed: BigInt('0x' + w[0]).toString(), w1: BigInt('0x' + w[1]).toString(), w2: w[2] ? BigInt('0x' + w[2]).toString().slice(0, 30) + '…' : null });
    }
    res.probes[sym] = info;
  }

  /* C. PEPI pair vs triple on its first record */
  {
    const p = res.probes.PEPIv2;
    if (p.records.length) {
      const r0 = p.records[0];
      const s = BigInt(r0.seed), w1 = BigInt(r0.w1), w2 = r0.w2 ? BigInt(r0.w2.replace('…', '')) : 0n;
      const pair2 = await call(COLS.PEPIv2, '0xa435130b' + W(0x20) + W(s) + W(w1));
      const triple = await call(COLS.PEPIv2, '0xa435130b' + W(0x20) + W(s) + W(w1) + W(w2));
      const a = decodeStr(pair2) || '', b = decodeStr(triple) || '';
      res.pepiArity = { pairLen: a.length, tripleLen: b.length, differ: a !== b };
    }
  }

  /* D. SVG internals — colliding classes/styles across pieces? */
  res.svgInternals = {};
  for (const [sym, addr] of Object.entries({ FUNGI: COLS.FUNGI, JELLI: COLS.JELLI })) {
    const p = res.probes[sym];
    if (!p.records.length) { res.svgInternals[sym] = 'no records'; continue; }
    const internals = [];
    for (let i = 0; i < Math.min(2, p.records.length); i++) {
      const r = p.records[i];
      const svgHex = await call(addr, (sym === 'FUNGI' ? '0x422b9e23' : '0x422b9e23') + W(0x20) + W(BigInt(r.seed)) + W(BigInt(r.w1)));
      const svg = decodeStr(svgHex) || '';
      const classes = [...svg.matchAll(/class="([^"]+)"/g)].map(m => m[1]);
      const hasStyle = /<style/.test(svg);
      internals.push({ len: svg.length, classes: [...new Set(classes)].slice(0, 12), hasStyle, ids: [...new Set([...svg.matchAll(/id="([^"]+)"/g)].map(m => m[1]))].slice(0, 8) });
    }
    res.svgInternals[sym] = internals;
  }
  return res;
}, { GARDEN, COLS, RPC });

await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 3200));
