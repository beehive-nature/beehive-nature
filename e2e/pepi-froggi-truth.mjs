/* pepi-froggi-truth.mjs — one-off diagnosis: FROGGI + PEPI v1/v2 ground truth.
   1. direct balanceOf (publicnode) for purse + garden
   2. live profile render for purse address, garden chip, and the name
   3. Blockscout top holders for FROGGI + PEPI v2 + PEPI v1 (where do they live?) */
const RPC = 'https://base-rpc.publicnode.com';
const w = n => BigInt(n).toString(16).padStart(64, '0');
const ad = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const PURSE = '0x100fd362abf7ef7f7a7ca3c331d4c718c6f45479';
const GARDEN = '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876';
const TOKENS = {
  'FROGGI' : '0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE',
  'PEPI v2': '0x28a5e71BFc02723eAC17E39c84c5190415C0de9F',
  'PEPI v1': '0x19706c142d33376240e418d6385f05691a5fa8e2',
};
async function rpc(method, params){
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params }) });
  const j = await r.json(); return j.result;
}
console.log('=== 1. direct balanceOf (publicnode, raw /1e9 for v2+v1? report both scales) ===');
for (const [who, addr] of [['purse', PURSE], ['garden', GARDEN]]) {
  for (const [sym, c] of Object.entries(TOKENS)) {
    const res = await rpc('eth_call', [{ to: c, data: '0x70a08231' + ad(addr) }, 'latest']);
    const raw = BigInt(res || 0);
    console.log(`${who} ${sym}: raw=${raw.toString()} /1e9=${Number(raw)/1e9} /1e18=${Number(raw)/1e18}`);
  }
}
console.log('\n=== 2. does each token contract answer at all? (totalSupply) ===');
for (const [sym, c] of Object.entries(TOKENS)) {
  const res = await rpc('eth_call', [{ to: c, data: '0x18160ddd' }, 'latest']);
  console.log(`${sym} totalSupply raw=${res === '0x' ? 'EMPTY/REVERT' : BigInt(res).toString()}`);
}
console.log('\n=== 3. Blockscout top holders ===');
for (const [sym, c] of Object.entries(TOKENS)) {
  try {
    const r = await fetch(`https://base.blockscout.com/api/v2/tokens/${c}/holders`);
    const j = await r.json();
    const rows = (j.items || []).slice(0, 6).map(h => `${h.address.address?.slice(0,10)}…=${(Number(h.value)/1e9).toFixed(2)}`);
    console.log(`${sym}: ` + rows.join(' · '));
  } catch (e) { console.log(`${sym}: blockscout failed — ${String(e).slice(0,80)}`); }
}
console.log('\n=== 4. live profile renders ===');
const { chromium } = await import('playwright');
const b = await chromium.launch({ args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{ width:900, height:1000 } });
async function profileVisit(label, typed) {
  await p.goto('https://skaists.dev/surfaces/blight/profile.html', { waitUntil:'domcontentloaded', timeout:30000 });
  await p.fill('#addr', typed);
  await p.click('#go');
  await p.waitForFunction(() => /rendered from chain|holds nothing|did not resolve/.test(document.getElementById('msg').textContent), null, { timeout:90000 }).catch(() => {});
  const chips = ((await p.textContent('#chips').catch(()=>'')) || '').replace(/\s+/g,' ').trim();
  const wall = ((await p.textContent('#wall').catch(()=>'')) || '').replace(/\s+/g,' ').trim();
  const msg = ((await p.textContent('#msg').catch(()=>'')) || '').replace(/\s+/g,' ').trim();
  const sub = ((await p.textContent('#subline').catch(()=>'')) || '').replace(/\s+/g,' ').trim();
  console.log(`[${label}] typed=${typed}`);
  console.log(`  subline: ${sub}`);
  console.log(`  chips  : ${chips.slice(0,220)}`);
  console.log(`  wall   : FROGGI=${/FROGGI/i.test(wall)} PEPI=${/PEPI/i.test(wall)} | ${wall.slice(0,120)}`);
  console.log(`  msg    : ${msg.slice(0,180)}`);
}
await profileVisit('purse', PURSE);
await profileVisit('garden-name', 'bqueenbee.base.eth');
await b.close();
console.log('\ndone');
