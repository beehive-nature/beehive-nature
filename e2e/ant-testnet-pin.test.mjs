// The TEST network pin of the hosted ANT storage payer (ant-pay.js createHosted).
// A mainnet payer never accepts the local test chain; a test payer never accepts Arbitrum
// One; and a test purchase keeps its own journal and quote claims. Fixture-only: no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createHosted}=createRequire(import.meta.url)('../surfaces/ant-pay.js');

const addr=n=>'0x'+n.repeat(40);
const artifact={name:'probe.txt',bytes:49,sha256:'b'.repeat(64)};
const store=()=>{const m=new Map();return {m,getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
const signer={address:async()=>addr('e'),signTransaction:()=>{throw Error('not in this test');}};
const verify={keccak256:()=>new Uint8Array(32),recover:()=>addr('e')};
const net=chainId=>({chainId,paymentTokenAddress:addr('a'),paymentVaultAddress:addr('b')});
const rpcOn=hex=>async m=>{if(m==='eth_chainId')return hex;throw Error('unused '+m);};
const make=(o)=>createHosted({artifact,storage:store(),signer,verify,rpc:rpcOn('0xa4b1'),...o});

test('a mainnet payer refuses the local test chain', () => {
  assert.throws(()=>make({network:net(31337)}),/Arbitrum One/);
});
test('a test payer refuses Arbitrum One', () => {
  assert.throws(()=>make({network:net(42161),testnet:true}),/local test network/);
});
test('testnet is exactly true or false, never a truthy string', () => {
  assert.throws(()=>make({network:net(31337),testnet:'yes'}),/true or false/);
});
test('a test purchase keeps its own journal key, apart from a real one for the same file', () => {
  const s=store();
  createHosted({artifact,storage:s,signer,verify,rpc:rpcOn('0x7a69'),network:net(31337),testnet:true});
  const keys=[...s.m.keys()];
  assert.deepEqual(keys,['bnr.ant.purchase.test.v1:'+artifact.sha256]);
  // the same browser can still start the real purchase of that file: the journals never meet
  createHosted({artifact,storage:s,signer,verify,rpc:rpcOn('0xa4b1'),network:net(42161)});
  assert.ok(s.m.has('bnr.ant.purchase.v1:'+artifact.sha256));
});
test('a test payer refuses a payment RPC on another chain', async () => {
  const p=createHosted({artifact,storage:store(),signer,verify,rpc:rpcOn('0xa4b1'),network:net(31337),testnet:true});
  await assert.rejects(p.invoice(net(31337),[{quoteHash:'0x'+'c'.repeat(64),rewardsAddress:addr('d'),amount:'1'}],'1000'),/not the local test network/);
});
