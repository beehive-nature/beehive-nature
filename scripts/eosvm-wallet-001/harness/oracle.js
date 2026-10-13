// oracle.js — EOSVM-WALLET-001 host crypto oracle (ffjavascript, the same
// bn128 implementation snarkjs rides; correctness stops there).
//   node oracle.js pair   < hex(n x 192B pairs)  -> 0 product==1 · 1 else · -1 malformed
//   node oracle.js g1add  < hex(op1 64B||op2 64B) -> 64B BE result hex, or "-1"
//   node oracle.js g1mul  < hex(g1 64B||scalar 32B) -> 64B BE result hex, or "-1"
// Point bytes: uncompressed affine BIG-endian (the EVM/intrinsic format).
const fs = require('fs');
const path = require('path');
const { getCurveFromName } = require(process.env.FFJS_PATH ||
  path.join(process.env.HOME || '', 'eosvm001', 'oracle', 'node_modules', 'ffjavascript'));

async function main() {
  const mode = process.argv[2] || 'pair';
  const hex = fs.readFileSync(0, 'utf8').trim();
  const buf = Buffer.from(hex, 'hex');
  const curve = await getCurveFromName('bn128');
  const G1 = curve.G1, F = G1.F;
  try {
    if (mode === 'pair') {
      if (buf.length === 0 || buf.length % 192 !== 0) { console.log(-1); return; }
      let acc = null;
      for (let i = 0; i < buf.length; i += 192) {
        const x = BigInt('0x' + buf.slice(i, i + 32).toString('hex'));
        const y = BigInt('0x' + buf.slice(i + 32, i + 64).toString('hex'));
        if (x === 0n && y === 0n) continue;
        const c = [0, 32, 64, 96].map(j => BigInt('0x' + buf.slice(i + 64 + j, i + 96 + j).toString('hex')));
        const p1 = G1.fromObject([x, y]);
        const p2 = curve.G2.fromObject([[c[0], c[1]], [c[2], c[3]]]);
        const f = curve.pairing(p1, p2);
        acc = acc === null ? f : curve.F12.mul(acc, f);
      }
      if (acc === null) { console.log(0); return; }
      console.log(curve.F12.eq(acc, curve.F12.one) ? 0 : 1);
    } else if (mode === 'g1add' || mode === 'g1mul') {
      let p1, p2;
      if (mode === 'g1add') {
        if (buf.length !== 128) { console.log(-1); return; }
        const ax = BigInt('0x' + buf.slice(0, 32).toString('hex'));
        const ay = BigInt('0x' + buf.slice(32, 64).toString('hex'));
        const bx = BigInt('0x' + buf.slice(64, 96).toString('hex'));
        const by = BigInt('0x' + buf.slice(96, 128).toString('hex'));
        p1 = G1.fromObject([ax, ay]);
        p2 = G1.fromObject([bx, by]);
      } else {
        if (buf.length !== 96) { console.log(-1); return; }
        const x = BigInt('0x' + buf.slice(0, 32).toString('hex'));
        const y = BigInt('0x' + buf.slice(32, 64).toString('hex'));
        const s = BigInt('0x' + buf.slice(64, 96).toString('hex'));
        p1 = G1.fromObject([x, y]);
        p2 = s;   // timesScalar takes a bigint
      }
      let r;
      if (mode === 'g1add') r = G1.add(p1, p2);
      else                  r = G1.timesScalar(p1, p2);
      // normalize to affine and print x||y BE
      const a = G1.toAffine ? G1.toAffine(r) : r;
      const o = G1.toObject(a);
      let X, Y;
      if (Array.isArray(o) && o.length >= 2) { [X, Y] = o; }
      else { const an = G1.toObject(G1.affine(r)); [X, Y] = an; }
      const w = (v) => BigInt(v).toString(16).padStart(64, '0');
      console.log(w(X) + w(Y));
    } else {
      console.log(-1);
    }
  } catch (e) {
    console.log(-1);
  } finally {
    await curve.terminate();
  }
}
main().catch(e => { console.log(-1); process.exit(0); });
