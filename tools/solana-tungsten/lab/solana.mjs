// Private validator only. Keys stay in memory; signed outbox is replayable only
// on this disposable genesis. This is a trusted fixture signer, not bPay custody.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const [nodeHome, root, bundleFile] = process.argv.slice(2);
const require = createRequire(path.join(nodeHome, 'package.json'));
const { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction,
  ComputeBudgetProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const c = new Connection('http://127.0.0.1:18899', 'confirmed');
const bundle = JSON.parse(fs.readFileSync(bundleFile));
const program = new PublicKey('GrPeAM83MtRfR8NvbW3tMMSBzQ9BsmQrgLjLCQNwZW4P');
const payer = Keypair.generate(), recipient = Keypair.generate(), staging = Keypair.generate();
const body = Buffer.from(bundle.verifying_key_body);
const hash = crypto.createHash('sha256').update(body).digest();
assert.deepEqual([...hash], bundle.verifying_key_hash);
const [vk] = PublicKey.findProgramAddressSync([Buffer.from('vk'), hash], program);
const key = (pubkey, isSigner = false, isWritable = false) => ({ pubkey, isSigner, isWritable });
const ix = (data, keys) => new TransactionInstruction({programId: program, data: Buffer.from(data), keys});
const budget = () => ComputeBudgetProgram.setComputeUnitLimit({units: 1_000_000});
async function send(instructions, signers = [payer]) {
  return sendAndConfirmTransaction(c, new Transaction().add(budget(), ...instructions), signers, {commitment: 'confirmed'});
}
const airdrop = await c.requestAirdrop(payer.publicKey, 2_000_000_000);
await c.confirmTransaction({signature: airdrop, ...await c.getLatestBlockhash()}, 'confirmed');
// Fixture mapping gives an existing rent-exempt destination to symbolic worker.
await send([SystemProgram.transfer({fromPubkey: payer.publicKey, toPubkey: recipient.publicKey, lamports: 1_000_000})]);
await send([SystemProgram.createAccount({fromPubkey: payer.publicKey, newAccountPubkey: staging.publicKey,
  lamports: await c.getMinimumBalanceForRentExemption(40 + body.length), space: 40 + body.length, programId: program}),
  ix([0, 5, 0], [key(payer.publicKey, true), key(staging.publicKey, false, true)])], [payer, staging]);
for (let offset = 0; offset < body.length; offset += 700) {
  const header = Buffer.alloc(5); header[0] = 1; header.writeUInt32LE(offset, 1);
  await send([ix(Buffer.concat([header, body.subarray(offset, offset + 700)]), [key(payer.publicKey, true), key(staging.publicKey, false, true)])]);
}
await send([ix([2], [key(payer.publicKey, true, true), key(payer.publicKey, true, true),
  key(staging.publicKey, false, true), key(vk, false, true), key(SystemProgram.programId)])]);
const account = await c.getAccountInfo(vk);
assert(account.owner.equals(program));
assert.deepEqual(account.data.subarray(8), body);
const publics = Buffer.concat(bundle.public_inputs.map(x => Buffer.from(x)));
const verify = proof => ix(Buffer.concat([Buffer.from([3]), Buffer.from(proof), publics]), [key(vk)]);
const transfer = () => SystemProgram.transfer({fromPubkey: payer.publicKey, toPubkey: recipient.publicKey, lamports: 7});
const before = await c.getBalance(recipient.publicKey);
// Actually submit a bad proof with transfer in the same transaction. The chain
// must reject it atomically; simulation alone is insufficient evidence here.
const bad = new Transaction().add(budget(), verify(new Uint8Array(256)), transfer());
bad.feePayer = payer.publicKey; bad.recentBlockhash = (await c.getLatestBlockhash()).blockhash; bad.sign(payer);
const badSignature = await c.sendRawTransaction(bad.serialize(), {skipPreflight: true});
const badResult = await c.confirmTransaction(badSignature, 'confirmed');
assert(badResult.value.err);
assert.equal(await c.getBalance(recipient.publicKey), before);
// Trusted fixture authority is immutable, separate from received bytes.
const expected = {domain:'bnr:tungsten:local:v1',job_id:'square-7',authorization_id:'fixture-grant-1',
  nonce:1,recipient:'fixture-worker',asset:'TEST-UNIT',amount:7,fee_asset:'TEST-FEE',fee:1,input:7};
assert.deepEqual(bundle.packet.job, expected);
const tx = new Transaction().add(budget(), verify(bundle.packet.proof), transfer());
const block = await c.getLatestBlockhash();
tx.feePayer = payer.publicKey; tx.recentBlockhash = block.blockhash;
const quoted = (await c.getFeeForMessage(tx.compileMessage())).value;
assert(quoted !== null && quoted <= 5000, 'fixture network-fee ceiling');
tx.sign(payer);
const raw = tx.serialize();
const outbox = path.join(root, 'solana-outbox.json');
// Exclusive creation is the local authorization reservation; never regenerate
// a new transaction after ambiguity. Expired transactions need reconciliation.
const fd = fs.openSync(outbox, 'wx', 0o600);
fs.writeFileSync(fd, JSON.stringify({authorization_id:expected.authorization_id,nonce:expected.nonce,
  genesis:await c.getGenesisHash(),raw:raw.toString('base64'),block,
  signature:require('bs58').encode(tx.signature),recipient:recipient.publicKey.toBase58(),before,
  program:program.toBase58(),key_address:vk.toBase58(),bad_proof_on_chain_error:badResult.value.err}));
fs.fsyncSync(fd); fs.closeSync(fd);
const dir = fs.openSync(root, 'r'); fs.fsyncSync(dir); fs.closeSync(dir);
await c.sendRawTransaction(raw);
// Fault injection: lose the worker after submission, before confirmation or a
// receipt. Parent starts a fresh process with only the durable public outbox.
process.exit(75);
