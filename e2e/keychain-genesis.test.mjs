import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const G=createRequire(import.meta.url)('../keychain/genesis.js');
const sha256=b=>new Uint8Array(createHash('sha256').update(b).digest());
const fill=(x,n)=>new Uint8Array(n).fill(x);

// crates/bzdid/tests/genesis_vector.rs — the foreign oracle this codec is held to.
const FROZEN_DID='did:b:e2xsu3qrmtomrkrvgjkfhgcxhxwvauoobf2qlcg6ycn6h67ktlfa';
const vector={rotationKeys:[{alg:'ed25519',key:fill(0xa1,32)},{alg:'ed25519',key:fill(0xb2,32)},{alg:'ed25519',key:fill(0xc3,32)}],
 signingKey:{alg:'ed25519',key:fill(0x5d,32)},services:['https://vector.example'],alsoKnownAs:['did:web:vector.example'],validUntil:4102444800};

test('the JS genesis codec reproduces the Rust frozen BDID-GENESIS-V1 vector',()=>{
 assert.equal(G.didOf(G.build(vector),sha256),FROZEN_DID);
});
test('any change to the op moves the did',()=>{
 for(const change of [{validUntil:4102444801},{services:[]},{alsoKnownAs:['did:web:other.example']},{signingKey:{alg:'ed25519',key:fill(0x5e,32)}},{rotationKeys:vector.rotationKeys.slice().reverse()}])
  assert.notEqual(G.didOf(G.build({...vector,...change}),sha256),FROZEN_DID);
});
test('malformed ops are refused',()=>{
 for(const bad of [{rotationKeys:[]},{rotationKeys:Array(9).fill(0).map((_,i)=>({alg:'ed25519',key:fill(i,32)}))},{rotationKeys:[vector.rotationKeys[0],vector.rotationKeys[0]]},
  {signingKey:{alg:'secp256k1',key:fill(1,33)}},{signingKey:{alg:'ed25519',key:fill(1,31)}},{validUntil:0},{services:Array(17).fill('x')},{alsoKnownAs:['x'.repeat(257)]}])
  assert.throws(()=>G.build({...vector,...bad}));
});
test('base32 is lowercase RFC 4648 without padding, 52 chars for a digest',()=>{
 assert.equal(G.base32(new TextEncoder().encode('foobar')),'mzxw6ytboi');
 assert.match(G.didOf(G.build(vector),sha256).slice(6),/^[a-z2-7]{52}$/);
});
