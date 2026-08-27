/* midi-b-facts.mjs — one-off: verify MiDi B (0xf7Cf2DF5…) — the contract the
   sales pitch must name: owner renounced? LP real (pool + WETH)? burned tokens? */
const RPC = 'https://base-rpc.publicnode.com';
const B = '0xf7Cf2DF510bc0EC400232874f2fB4F2cDf9352d6';
const A = '0x569e1A337b095B1A6c8F206158072cEDb6325b56';
const WETH = '0x4200000000000000000000000000000000000006';
const DEAD = '0x000000000000000000000000000000000000dEaD';
const w = n => BigInt(n).toString(16).padStart(64, '0');
const ad = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
async function call(to, data) {
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call', params:[{ to, data }, 'latest'] }) });
  const j = await r.json();
  return j.result !== undefined ? j.result : 'ERR:' + JSON.stringify(j.error).slice(0, 80);
}
const V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfd'; // UniswapV3Factory on Base
for (const [label, C] of [['B', B], ['A (contrast)', A]]) {
  const owner = await call(C, '0x8da5cb5b');                    // owner()
  const supply = await call(C, '0x18160ddd');                   // totalSupply()
  const deadBal = await call(C, '0x70a08231' + ad(DEAD));       // burned?
  let poolInfo = 'no V3 pool found (fees 100/500/3000/10000)';
  for (const fee of [100, 500, 3000, 10000]) {
    const gp = await call(V3_FACTORY, '0x1698ee82' + ad(C) + ad(WETH) + w(fee)); // getPool(tokenA,tokenB,uint24)
    if (gp && gp !== '0x' && !gp.startsWith('ERR')) {
      const pa = '0x' + gp.slice(26);
      const wethBal = await call(WETH, '0x70a08231' + ad(pa));
      const midiInPool = await call(C, '0x70a08231' + ad(pa));
      poolInfo = 'V3 pool ' + pa.slice(0, 10) + '… (fee ' + fee + ') · WETH in pool = ' + (Number(BigInt(wethBal)) / 1e18).toFixed(4) +
                 ' · MiDi in pool = ' + (Number(BigInt(midiInPool)) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 0 });
      break;
    }
  }
  const fmt = x => x && !x.startsWith('ERR') ? (Number(BigInt(x)) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 }) : x;
  console.log(`MiDi ${label}: ${C}`);
  console.log('  owner      : ' + (owner === '0x' ? 'RENOUNCED (zero)' : '0x' + (owner || '?').slice(26)));
  console.log('  totalSupply: ' + fmt(supply));
  console.log('  burned(DEAD): ' + fmt(deadBal));
  console.log('  ' + poolInfo);
}
