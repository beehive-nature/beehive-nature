import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const [nodeHome, root] = process.argv.slice(2);
const require = createRequire(path.join(nodeHome,'package.json'));
const {Connection,PublicKey} = require('@solana/web3.js');
const c = new Connection('http://127.0.0.1:18899','confirmed');
const outbox = path.join(root,'solana-outbox.json');
const r = JSON.parse(fs.readFileSync(outbox));
assert.equal(r.genesis,await c.getGenesisHash());
// No signer is available in this process. Resubmit only the original bytes.
assert.equal(await c.sendRawTransaction(Buffer.from(r.raw,'base64'),{skipPreflight:true}),r.signature);
assert.equal((await c.confirmTransaction({signature:r.signature,...r.block},'finalized')).value.err,null);
assert.equal(await c.getBalance(new PublicKey(r.recipient),'finalized'),r.before+7);
assert.equal(await c.sendRawTransaction(Buffer.from(r.raw,'base64'),{skipPreflight:true}),r.signature);
assert.throws(()=>fs.openSync(outbox,'wx'),{code:'EEXIST'});
const details = await c.getTransaction(r.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
assert(details && !details.meta.err);
assert.equal(await c.getBalance(new PublicKey(r.recipient),'finalized'),r.before+7);
const receipt = {schema:'bnr.tungsten-solana-local/1',scope:'private validator; faucet lamports; trusted fixture signer',
  program:r.program,key_address:r.key_address,genesis:r.genesis,signature:r.signature,
  slot:details.slot,finality:'finalized',recipient:r.recipient,amount:7,
  network_fee_lamports:details.meta.fee,compute_units:details.meta.computeUnitsConsumed,
  bad_proof_on_chain_error:r.bad_proof_on_chain_error,bad_proof_transfer_rolled_back:true,
  exact_signed_transaction_retry_no_double_payment:true,exclusive_outbox_refused:true,
  worker_exit_after_submission_recovered:true,production_bpay_authority:false};
fs.writeFileSync(path.join(root,'solana-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
