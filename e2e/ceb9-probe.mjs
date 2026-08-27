/* ceb9-probe.mjs — one-off, two questions:
   1. FUNGI at the garden: live balance + derived seed — why the picture
      doesn't move on a self-send (self-send = zero balance delta = same seed).
   2. is 0xCeb9d2886b29aB2b6d429442540E819f578dB92a an ERC-20i? probe the
      family selectors, then fetch the founder's art (balance-derived seed,
      account extra) and save it for viewing. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const GARDEN = '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876';
const NEWC = '0xCeb9d2886b29aB2b6d429442540E819f578dB92a';
const FUNGI = '0x7d9Ce55D54FF3FEddb611fC63fF63ec01F26D15F';
const RPC = 'https://base-rpc.publicnode.com';

const browser = await chromium.launch({ args:['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8912/surfaces/blight/midi.html', { waitUntil:'domcontentloaded', timeout:30000 });
await page.waitForFunction(() => typeof keccak256 === 'function' && typeof extraOfAddress === 'function', null, { timeout:15000 });

const out = await page.evaluate(async ({ GARDEN, NEWC, FUNGI, RPC }) => {
  const W = n => BigInt(n).toString(16).padStart(64, '0');
  const AD = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const call = async (to, data) => {
    const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call', params:[{ to, data }, 'latest'] }) });
    const j = await r.json();
    return j.result !== undefined ? j.result : 'ERR:' + JSON.stringify(j.error).slice(0, 70);
  };
  const decodeStr = hex => {
    const h = hex.replace(/^0x/, '');
    if (h.length < 192) return null;
    const off = parseInt(h.slice(0, 64), 16);
    if (off !== 0x20) return null;
    const len = parseInt(h.slice(64, 128), 16);
    if (!(len > 0 && len <= 65536) || h.length < 128 + len * 2) return null;
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(parseInt(h.slice(128 + i*2, 130 + i*2), 16));
    return s;
  };

  const res = {};

  /* 1. FUNGI at the garden, this moment */
  const fb = await call(FUNGI, '0x70a08231' + AD(GARDEN));
  const fungBal = BigInt(fb);
  res.fungi = { raw: fungBal.toString(), whole: Number(fungBal)/1e9, derivedSeed: Number(fungBal/1000000000n) };

  /* 2. the candidate contract */
  res.newc = { addr: NEWC };
  res.newc.name = decodeStr(await call(NEWC, '0x06fdde03')) || '(no name())';
  res.newc.symbol = decodeStr(await call(NEWC, '0x95d89b41')) || '(no symbol())';
  res.newc.code = (await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_getCode', params:[NEWC,'latest'] }) }).then(r=>r.json())).result.length;
  res.newc.totalSupply = await call(NEWC, '0x18160ddd');
  res.newc.decimals = await call(NEWC, '0x313ce567');

  /* family probe: which art selector answers, tuple form */
  const extra = extraOfAddress(GARDEN);
  const balRaw = await call(NEWC, '0x70a08231' + AD(GARDEN));
  const bal = BigInt(balRaw === '0x' || balRaw.startsWith('ERR') ? 0 : balRaw);
  const dec = res.newc.decimals && !res.newc.decimals.startsWith('ERR') && res.newc.decimals !== '0x'
    ? Number(BigInt(res.newc.decimals)) : 18;
  const whole = dec === 9 ? Number(bal/1000000000n) : Number(bal)/Math.pow(10, dec);
  res.newc.balance = { raw: bal.toString(), decimals: dec, whole };
  const seed = dec === 9 ? Number(bal/1000000000n) : Math.floor(whole);
  res.newc.derivedSeed = seed;

  for (const sel of ['422b9e23', 'a435130b', 'a62f5b1b']) {
    const data = sel + W(0x20) + W(seed) + W(extra) + (sel === 'a62f5b1b' ? AD(GARDEN) : '');
    const r = await call(NEWC, data);
    const svg = r && !r.startsWith('ERR') && r !== '0x' ? decodeStr(r) : null;
    res.newc['sel_' + sel] = svg ? { ok: true, len: svg.length, closed: svg.includes('</svg>') } : { ok: false, ret: String(r).slice(0, 60) };
    if (svg && svg.includes('</svg>') && !res.newc.art) res.newc.art = svg;
  }
  /* also try extra=0 in case account-extra reverts */
  if (!res.newc.art) {
    for (const sel of ['422b9e23', 'a435130b']) {
      const r = await call(NEWC, sel + W(0x20) + W(seed) + W(0));
      const svg = r && !r.startsWith('ERR') && r !== '0x' ? decodeStr(r) : null;
      if (svg && svg.includes('</svg>')) { res.newc.art = svg; res.newc.artExtraZero = true; break; }
    }
  }
  /* enumeration: how many inscriptions does the garden hold here? */
  const cnt = await call(NEWC, '0x9c216508' + AD(GARDEN));
  res.newc.inscriptionCount = cnt && !cnt.startsWith('ERR') && cnt !== '0x' ? BigInt(cnt).toString() : String(cnt).slice(0, 50);

  return res;
}, { GARDEN, NEWC, FUNGI, RPC });

await browser.close();
console.log(JSON.stringify({
  fungi: out.fungi,
  newc_name: out.newc.name, newc_symbol: out.newc.symbol,
  code_bytes: out.newc.code, totalSupply: out.newc.totalSupply, decimals: out.newc.decimals,
  balance: out.newc.balance, derivedSeed: out.newc.derivedSeed,
  family: { s422b: out.newc['sel_422b9e23'], a435: out.newc['sel_a435130b'], a62f: out.newc['sel_a62f5b1b'] },
  inscriptionCount: out.newc.inscriptionCount,
  art: out.newc.art ? { len: out.newc.art.length, closed: out.newc.art.includes('</svg>'), extraZero: !!out.newc.artExtraZero } : 'NONE'
}, null, 1));
if (out.newc.art) {
  writeFileSync('C:/Users/travi/ceb9-art.svg', out.newc.art);
  console.log('art saved: C:/Users/travi/ceb9-art.svg');
}
