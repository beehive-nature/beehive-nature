// m4prep.js — builds the circuit input + the chain-side artifacts for the M4
// receipt run. commitment/nullifier via circomlibjs Poseidon (same parameters
// the circuit uses, from iden3/circomlib). Values recorded for reproducibility.
const fs = require('fs');
const { buildPoseidonOpt } = require('circomlibjs');

(async () => {
const poseidon = await buildPoseidonOpt();
const P = vs => poseidon.F.toString(poseidon(vs));

// fixed rehearsal secret (this is a rehearsal chain, values recorded on
// purpose — a real member's secret never leaves their wallet)
const secret = BigInt('0x' + Buffer.from('m4-rehearsal-secret-01').toString('hex').padEnd(16, '0')) * 2654435761n + 1n;
const amount = 1000n;
const tag    = 1n;

const commitment = P([secret, amount]);
const nullifier  = P([secret, tag]);

const input = {
  secret: secret.toString(),
  amount: amount.toString(),
  tag: tag.toString(),
  commitment: commitment,
  nullifier: nullifier,
};
const w32 = v => BigInt(v).toString(16).padStart(64, '0');
const out = {
  secret: secret.toString(),
  amount: amount.toString(),
  tag: tag.toString(),
  commitment_dec: commitment,
  nullifier_dec: nullifier,
  commitment_hex: w32(commitment),
  nullifier_hex: w32(nullifier),
};
fs.writeFileSync(process.argv[2] || 'input.json', JSON.stringify(input, null, 1));
fs.writeFileSync('m4-values.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
})();
