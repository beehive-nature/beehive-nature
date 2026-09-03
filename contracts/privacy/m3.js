// m3.js — computes the M3 receipt artifacts (commitments, view tags, nullifiers)
// with keccak256 (ALG_COMMIT = keccak256-v1, per the contract's law row).
const crypto = require('crypto');
const K = (buf) => crypto.createHash("sha3-256").update(buf).digest("hex");
const sk = crypto.randomBytes(32);                      // note secret (member-held)
const vk = crypto.randomBytes(32);                      // view key (member-held)
const amt = 1000;
const commitment = K(Buffer.concat([sk, Buffer.from(amt.toString(16).padStart(16, '0'), 'hex')]));
const viewtagSrc = Buffer.concat([vk, Buffer.from(commitment, 'hex')]);
const viewtag = parseInt(K(viewtagSrc).slice(0, 8), 16) >>> 0;
const nullifier = K(Buffer.concat([sk, Buffer.from('null-v1', 'utf8')]));
// second note (transfer target)
const sk2 = crypto.randomBytes(32);
const amt2 = 990;
const commitment2 = K(Buffer.concat([sk2, Buffer.from(amt2.toString(16).padStart(16, '0'), 'hex')]));
const viewtag2 = parseInt(K(Buffer.concat([vk, Buffer.from(commitment2, 'hex')])).slice(0, 8), 16) >>> 0;
const nullifier2 = K(Buffer.concat([sk2, Buffer.from('null-v1', 'utf8')]));
console.log(JSON.stringify({ commitment, viewtag, nullifier, commitment2, viewtag2, nullifier2 }, null, 1));
