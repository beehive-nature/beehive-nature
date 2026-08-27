/* abi-truth.mjs — the collections' verified ABIs from Blockscout: what are
   the REAL art + enumeration signatures? (the founder reports our inscriptions
   don't match inscriptions.app — suspect: under-argued tuples and/or a
   different enumeration interface on JELLI/FROGGI) */
const BS = 'https://base.blockscout.com/api/v2/smart-contracts/';
const COLS = {
  FUNGI:  '0x7d9Ce55D54FF3FEddb611fC63fF63ec01F26D15F',
  JELLI:  '0xA1b9d812926a529D8B002E69FCd070c8275eC73c',
  PEPIv2: '0x28a5e71BFc02723eAC17E39c84c5190415C0de9F',
  FROGGI: '0x88A78C5035BdC8C9A8bb5c029e6cfCDD14B822FE',
};
const skip = /transfer|approv|allowance|^balanceOf\(address\)$|^owner\(\)|totalSupply|decimals|^symbol\(\)|^name\(\)|mint|burn|pause|renounce|^set[A-Z]|emit|^before|^after|increase|decrease/i;
for (const [sym, addr] of Object.entries(COLS)) {
  try {
    const r = await fetch(BS + addr);
    const j = await r.json();
    if (!Array.isArray(j.abi)) { console.log('== ' + sym + ': no verified ABI =='); continue; }
    console.log('== ' + sym + ' (' + (j.name || '?') + ') ==');
    for (const x of j.abi) {
      if (x.type !== 'function') continue;
      const params = (x.inputs || []).map(i => {
        if (i.components && i.components.length) return '(' + i.components.map(c => c.type + ' ' + c.name).join(', ') + ')';
        return i.type + ' ' + i.name;
      }).join(', ');
      const outs = (x.outputs || []).map(i => {
        if (i.components && i.components.length) return '(' + i.components.map(c => c.type + ' ' + c.name).join(', ') + ')';
        return i.type;
      }).join(', ');
      const sig = x.name + '(' + params + ')';
      if (skip.test(x.name + '(' + params + ')')) continue;
      console.log('   ' + sig + (outs ? ' → ' + outs : ''));
    }
  } catch (e) { console.log(sym + ': fetch fail ' + String(e).slice(0, 60)); }
}
