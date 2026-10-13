// keccak_oracle.js — EOSVM-WALLET-001 host keccak (js-sha3, the same library
// family the snarkjs/circom ecosystem uses; verified against the canonical
// empty/"abc" vectors at harness startup and by engine-suite receipts).
// stdin: input hex · stdout: keccak256 hex (64 chars)
const { keccak256 } = require('/home/travi/plonkport/node_modules/js-sha3');
const fs = require('fs');
const hex = fs.readFileSync(0, 'utf8').trim();
console.log(keccak256(Buffer.from(hex, 'hex')));
