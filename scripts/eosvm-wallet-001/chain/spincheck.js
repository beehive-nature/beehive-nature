// spincheck.js — EOSVM-WALLET-001: time probefree.wasm's spin directly in
// node (stubbed host imports) to verify the loop survived clang -O2.
const fs = require('fs');
(async () => {
  const bytes = fs.readFileSync(process.argv[2] || '/home/travi/eosvm001-lane/chain/probefree.wasm');
  const name = (s) => { let v = 0n; for (let i = 0; i < s.length; i++) v |= BigInt(s.charCodeAt(i) - 97 + 1) << BigInt(59 - 5 * i); return v; };
  let mem8;
  let currentN = 20000000n;
  const stubs = {
    action_data_size: () => 8,
    read_action_data: (ptr, len) => { for (let i = 0; i < 8; i++) mem8[ptr + i] = Number((currentN >> BigInt(8 * i)) & 0xffn); return len; },
    require_auth: () => {},
    eosio_assert: (t, m) => { if (!t) throw new Error('assert: ' + m); },
    db_store_i64: () => 0, db_update_i64: () => {}, db_find_i64: () => -1,
    db_get_i64: () => 0, current_time: () => 0,
  };
  const { instance } = await WebAssembly.instantiate(bytes, { env: stubs });
  mem8 = new Uint8Array(instance.exports.memory.buffer);
  const t0 = Date.now();
  instance.exports.apply(0n, 0n, name('spin'));
  console.log('spin(20M) via node:', Date.now() - t0, 'ms');
  const t1 = Date.now();
  instance.exports.apply(0n, 0n, name('putx'));
  console.log('putx:', Date.now() - t1, 'ms');
  currentN = 200000000n;
  const t2 = Date.now();
  instance.exports.apply(0n, 0n, name('spin'));
  console.log('spin(200M) via node:', Date.now() - t2, 'ms');
})().catch(e => { console.error(e); process.exit(1); });
