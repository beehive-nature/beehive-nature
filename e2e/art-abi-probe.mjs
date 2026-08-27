/* art-abi-probe.mjs — one-off: why do FROGGI/PEPI pieces not render for the
   garden? Probe getSvg-family calls in BOTH ABI forms at real seeds:
   A) inline:  sel + W(seed) + W(0)                (profile's current form)
   B) tuple:   sel + W(0x20) + W(seed) + W(0)      (offset-word form)
   plus enumeration: inscriptionCount + first ownerOfInscriptionByIndex word.
   Reports: hex length, revert/empty, decoded length, closed </svg> or not. */
const RPC = 'https://base-rpc.publicnode.com';
const w = n => BigInt(n).toString(16).padStart(64, '0');
const ad = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
async function call(to, data) {
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call', params:[{ to, data }, 'latest'] }) });
  const j = await r.json();
  return j.result !== undefined ? j.result : ('ERR:' + JSON.stringify(j.error).slice(0, 90));
}
function decLen(hex) {
  if (!hex || hex === '0x' || hex.startsWith('ERR')) return null;
  const h = hex.slice(2);
  if (h.length < 128) return null;
  const len = parseInt(h.slice(64, 128), 16);
  return { len, closed: hex.includes('3c2f7376673e') }; // "</svg>" in hex-ish ascii? check decoded below
}
function decodeString(hex) {
  const h = hex.replace(/^0x/, '');
  if (h.length < 192) return null;
  const off = parseInt(h.slice(0, 64), 16);
  if (off !== 0x20) return null;
  const len = parseInt(h.slice(64, 128), 16); // len word = bytes 32..64
  if (!(len >= 0 && len <= 65536) || h.length < 128 + len * 2) return null;
  let out = '';
  for (let i = 0; i < len; i++) {
    const b = parseInt(h.slice(128 + i * 2, 130 + i * 2), 16);
    if (Number.isNaN(b)) return null;
    out += String.fromCharCode(b);
  }
  return out;
}
const GARDEN = '0xfbd201472d5a439f1f0e408eb5dfaf6ea3687876';
const PURSE = '0x100fd362abf7ef7f7a7ca3c331d4c718c6f45479';
const COLS = [
  { sym:'FROGGI',  c:'0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE', sel:'422b9e23', seeds:[247599, 52] },
  { sym:'PEPI v2', c:'0x28a5e71BFc02723eAC17E39c84c5190415C0de9F', sel:'a435130b', seeds:[58, 52] },
  { sym:'PEPI v1', c:'0x19706c142d33376240e418d6385f05691a5fa8e2', sel:'a435130b', seeds:[79, 52] },
  { sym:'FUNGI (control)', c:'0x7d9Ce55D54FF3FEddb611fC63fF63ec01F26D15F', sel:'422b9e23', seeds:[2601831] },
  { sym:'JELLI', c:'0xA1b9d812926a529D8B002E69FCd070c8275eC73c', sel:'422b9e23', seeds:[1100000] },
  { sym:'TRUFFI', c:'0x2496a9AF81A87eD0b17F6edEaf4Ac57671d24f38', sel:'a62f5b1b', seeds:[166] },
];
for (const col of COLS) {
  for (const seed of col.seeds) {
    const A = await call(col.c, col.sel + w(seed) + w(0) + (col.sel === 'a62f5b1b' ? ad(GARDEN) : ''));
    const B = await call(col.c, col.sel + w(0x20) + w(seed) + w(0) + (col.sel === 'a62f5b1b' ? ad(GARDEN) : ''));
    const C = col.sel === 'a62f5b1b' ? await call(col.c, col.sel + w(0x20) + w(seed) + w(0) + ad(GARDEN) + w(0)) : null;
    for (const [tag, hex] of [['inline', A], ['tuple ', B], ['tuple3', C]]) {
      if (hex === null) continue;
      const s = decodeString(hex || '');
      const brief = hex.startsWith('ERR') ? hex.slice(0, 60)
        : (hex === '0x' ? 'EMPTY' : `hexlen=${hex.length} decoded=${s ? s.length : 'FAIL'} closed=${s ? s.includes('</svg>') : '-'}`);
      console.log(`${col.sym.padEnd(15)} seed=${String(seed).padStart(8)} ${tag}: ${brief}`);
    }
  }
  // enumeration: how many inscriptions does the GARDEN hold here, and what's the first (seed, extra)?
  const cnt = await call(col.c, '0x9c216508' + ad(GARDEN));
  const n = cnt && cnt !== '0x' && !cnt.startsWith('ERR') ? BigInt(cnt) : null;
  let enumInfo = 'count=' + (n === null ? cnt : n.toString());
  if (n && n > 0n) {
    const rec = await call(col.c, '0x0fd9587e' + ad(GARDEN) + w(0));
    if (rec && rec !== '0x' && !rec.startsWith('ERR')) {
      const h = rec.slice(2);
      const words = h.match(/.{64}/g) || [];
      enumInfo += ` first(seed=${words[0] ? BigInt('0x'+words[0]) : '?'}, extra=${words[1] ? BigInt('0x'+words[1]) : '?'})`;
      // and can we draw THAT through the tuple form?
      if (words[0] && words[1]) {
        const seed = BigInt('0x' + words[0]), extra = BigInt('0x' + words[1]);
        const T = await call(col.c, col.sel + w(0x20) + w(seed) + w(extra));
        const s = decodeString(T || '');
        enumInfo += ` tuple(seed,extra)=${T === '0x' || !T ? 'EMPTY' : (T.startsWith('ERR') ? T.slice(0,50) : `hexlen=${T.length} decoded=${s ? s.length : 'FAIL'} closed=${s ? s.includes('</svg>') : '-'}`)}`;
      }
    }
  }
  console.log(`${col.sym.padEnd(15)} GARDEN enum: ${enumInfo}`);
  console.log('');
}
// also: FROGGI inscriptionCount for the PURSE (control — its art renders today)
const pc = await call(COLS[0].c, '0x9c216508' + ad(PURSE));
console.log('FROGGI purse inscriptionCount =', pc && !pc.startsWith('ERR') ? BigInt(pc).toString() : pc);
