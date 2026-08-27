/* midi-pool-debug.mjs — one-off: what pool does the V3 factory really return
   for MiDi A and B? print the full address + token0/token1 of each candidate. */
const RPC = 'https://base-rpc.publicnode.com';
const B = '0xf7Cf2DF510bc0EC400232874f2fB4F2cDf9352d6';
const A = '0x569e1A337b095B1A6c8F206158072cEDb6325b56';
const WETH = '0x4200000000000000000000000000000000000006';
const V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfd';
const w = n => BigInt(n).toString(16).padStart(64, '0');
const ad = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
async function call(to, data) {
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call', params:[{ to, data }, 'latest'] }) });
  const j = await r.json();
  return j.result !== undefined ? j.result : 'ERR:' + JSON.stringify(j.error).slice(0, 100);
}
for (const [label, C] of [['B', B], ['A', A]]) {
  for (const fee of [100, 500, 3000, 10000]) {
    const gp = await call(V3_FACTORY, '0x1698ee82' + ad(C) + ad(WETH) + w(fee));
    if (!gp || gp === '0x' || gp.startsWith('ERR')) { console.log(`${label} fee ${fee}: ${gp}`); continue; }
    const pa = '0x' + gp.slice(26);
    const isZero = /^0x0+$/.test(pa);
    if (isZero) { console.log(`${label} fee ${fee}: no pool (zero address)`); continue; }
    const t0 = await call(pa, '0x0dfe1681'); // token0()
    const t1 = await call(pa, '0xd21220a7'); // token1()
    const wethBal = await call(WETH, '0x70a08231' + ad(pa));
    const midiBal = await call(C, '0x70a08231' + ad(pa));
    console.log(`${label} fee ${fee}: pool ${pa}`);
    console.log(`   token0=${t0 && !t0.startsWith('ERR') ? '0x' + t0.slice(26) : t0} token1=${t1 && !t1.startsWith('ERR') ? '0x' + t1.slice(26) : t1}`);
    console.log(`   WETH in pool=${Number(BigInt(wethBal)) / 1e18} · MiDi(${label}) in pool=${Number(BigInt(midiBal)) / 1e9}`);
  }
}
