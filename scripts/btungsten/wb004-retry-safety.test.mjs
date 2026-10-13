// wb004-retry-safety.test.mjs — the WB004 live lane's retry defect made
// deterministic (founder ruling 2026-10-13: PR #406 is protocol-
// characterization evidence, NOT a production autonomous settlement adapter;
// carry the retry failure into the Rust battery, not the unsafe behavior).
//
// THE INVARIANT UNDER TEST (the law for the BNROSE-RUST-001/SETTLE owner):
//   submission succeeds → response or inclusion reads lag → process
//   restarts → the orchestration must NOT create another proposal instance
//   or sign a replacement operation. Missing observations mean UNKNOWN —
//   not permission to rebuild, re-sign, or re-propose. Reconciling may
//   rebroadcast the IDENTICAL signed bytes (the chain's own
//   `duplicate transaction <id>` refusal is then the reconciliation), never
//   construct a new transaction for the same logical step.
//
// Three rows:
//   CONVICTION 1  unresolved inclusion → the current pushAction retry loop
//                 signs and submits a REPLACEMENT transaction (fresh TAPOS,
//                 new bytes, new signature, new txid) — demonstrated live at
//                 blocks 291734646/712 on 2026-10-12, here reproduced with
//                 zero chain and zero spend.
//   CONVICTION 2  restart on lagging/absent reads → the current P1 resume
//                 path re-proposes the same name and a second instance
//                 executes (the live incident: instances at blocks 291734646
//                 and 291734712, second exec 237aabde…).
//   REQUIRED      the safe reference: journal-before-submit, UNKNOWN on
//                 unresolved reads, rebroadcast-identical-only, replacement
//                 refused — executable acceptance criteria for the Rust
//                 implementation to match.
//
// Model honesty: the transaction packing, digests and signatures are the
// lane's REAL codec/keys code (a throwaway key, no custody, no chain). The
// endpoint is a deterministic simulator carrying exactly the three
// safety-relevant semantics measured live on Jungle4: per-transaction-id
// dedup ("duplicate transaction <id>", observed in the P6 control), row
// creation on propose / erasure on exec (name becomes reusable), and reads
// that lag writes (the CryptoLions load-balancer behavior, recorded in the
// lane's state.json). Per-transaction dedup is NOT operation-level replay
// protection — that is the finding.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  packTransaction, transactionId, signatureDigest, taposFromHeadBlockId,
  packProposeData, packTransferData, Writer,
} from './wb004-live/codec.mjs';
import { signDigest, randomSecret } from './wb004-live/keys.mjs';
import { JUNGLE4_CHAIN_ID } from './wb004-live/rpc.mjs';

// --- deterministic endpoint simulator ---------------------------------------

class FakeChain {
  constructor({ visibleReads = false } = {}) {
    this.blockNum = 291734200;          // era of the live run
    this.txs = new Map();               // txid -> {block, packedHex, sig, intent}
    this.blocks = new Map();            // blockNum -> [txid]
    this.proposalRows = new Map();      // name -> true (exists)
    this.opExecutions = 0;              // how many times the logical operation ran
    this.instances = 0;                 // proposal instances created
    this.visibleReads = visibleReads;   // false = the unresolved-read world
  }
  headId() {
    const b = Buffer.alloc(32);
    b.writeUInt32BE(this.blockNum, 0);
    b.writeUInt32LE((0xabcd1234 ^ this.blockNum) >>> 0, 8);
    return b.toString('hex');
  }
  getInfo() {
    return { head_block_id: this.headId(), head_block_num: this.blockNum };
  }
  push(sig, packed, intent) {
    const hex = packed.toString('hex');
    const txid = transactionId(packed);
    if (this.txs.has(txid)) {
      return { ok: false, chainMessage: 'duplicate transaction ' + txid };
    }
    const block = ++this.blockNum;
    this.txs.set(txid, { block, packedHex: hex, sig, intent });
    if (!this.blocks.has(block)) this.blocks.set(block, []);
    this.blocks.get(block).push(txid);
    // state application (labeled semantics; the packing itself is real)
    if (intent.kind === 'propose') { this.proposalRows.set(intent.name, true); this.instances++; }
    if (intent.kind === 'exec') { this.proposalRows.delete(intent.name); this.opExecutions++; }
    return { ok: true, txid, blockNum: block };
  }
  // bounded inclusion scan — exactly verifyInclusion()'s shape: reads only
  inclusionScan(txid, blockNum, spread = 8) {
    if (!this.visibleReads) return false;
    for (let b = blockNum; b <= blockNum + spread; b++) {
      if ((this.blocks.get(b) || []).includes(txid)) return true;
    }
    return false;
  }
  getProposals() {
    return this.visibleReads ? [...this.proposalRows.keys()] : [];
  }
}

const key = randomSecret(); // throwaway; no custody, never a credential

function buildMsigTx(chain, actionData, intentName) {
  const info = chain.getInfo();
  const t = taposFromHeadBlockId(info.head_block_id);
  const expiration = 1760000000 + chain.blockNum; // deterministic, in-model future
  const packed = packTransaction({
    expiration,
    refBlockNum: t.refBlockNum,
    refBlockPrefix: t.refBlockPrefix,
    delaySec: 0,
    actions: [{
      account: 'eosio.msig', name: intentName,
      authorization: [{ actor: 'bzcodejungle', permission: 'wbfoursignr' }],
      data: actionData,
    }],
  });
  const sig = signDigest(key, signatureDigest(JUNGLE4_CHAIN_ID, packed));
  return { packed, sig, txid: transactionId(packed) };
}

const innerTransfer = (memo) => packTransferData('bzcodejungle', 'junglefaucet', '0.0001 EOS', memo);

// --- CONVICTION 1: the current pushAction retry re-signs a replacement ------

// Faithful copy of run-lifecycle.mjs pushAction's unresolved-inclusion path
// (the "phantom acceptance (no block inclusion) — repushing" loop): each
// attempt fetches FRESH TAPOS and builds/signs a NEW transaction.
function currentPushActionRetry(chain, actionData, intentName, intent, maxAttempts = 3) {
  const seen = [];
  for (let attempt = 0; ; attempt++) {
    const { packed, sig, txid } = buildMsigTx(chain, actionData, intentName); // fresh TAPOS + new signature every attempt
    const res = chain.push(sig, packed, intent);
    seen.push({ txid, sig });
    if (res.ok) {
      const included = chain.inclusionScan(txid, res.blockNum);
      if (!included) {
        if (attempt < maxAttempts) continue; // repush — a REPLACEMENT transaction
        return { unresolved: true, seen };
      }
      return { unresolved: false, seen };
    }
    return { refused: res.chainMessage, seen };
  }
}

test('CONVICTION 1 — unresolved inclusion makes the current retry sign and submit REPLACEMENT transactions', () => {
  const chain = new FakeChain({ visibleReads: false }); // reads lag forever
  const data = packProposeData('bzcodejungle', 'wb4convic1', [{ actor: 'bzcodejungle', permission: 'wbfoursignr' }], Buffer.alloc(20, 1));
  const out = currentPushActionRetry(chain, data, 'propose', { kind: 'propose', name: 'wb4convic1' });
  assert.equal(out.unresolved, true, 'reads never resolve in this scenario');
  // The defect, exactly: FOUR distinct transactions (distinct bytes → distinct
  // signatures → distinct ids) were submitted for ONE logical step. The
  // chain's per-txid dedup cannot see them as duplicates — per-transaction
  // dedup is not operation-level replay protection.
  assert.equal(out.seen.length, 4, 'one logical step produced ' + out.seen.length + ' distinct submissions');
  assert.equal(new Set(out.seen.map((s) => s.txid)).size, 4, 'all four txids distinct');
  assert.equal(new Set(out.seen.map((s) => s.sig)).size, 4, 'all four signatures distinct — replacements were signed, not rebroadcast');
  // had each submission executed, the operation would run four times:
  assert.equal(chain.instances, 4, 'the simulator applied four proposal instances from one logical step');
  console.log('  [defect demonstrated] unresolved inclusion → 4 signed replacements; chain-side dedup blind to all but byte-identical repeats');
});

// --- CONVICTION 2: restart on absent reads re-creates the proposal instance -

function currentP1Resume(chain, persisted) {
  // Faithful copy of stageP1's resume decision (run-lifecycle.mjs): consult
  // the p1_exec_txid FIELD (not the steps journal) and the table row; a miss
  // on both → buildProposal + propose.
  const alreadyThere = chain.getProposals().includes(persisted.p1_name);
  if (!alreadyThere && persisted.p1_exec_txid) {
    const inc = chain.inclusionScan(persisted.p1_exec_txid, persisted.p1_exec_block || 0);
    if (inc) return { action: 'duplicate-control' };
  }
  if (alreadyThere) return { action: 'resume-approvals' };
  return { action: 're-propose' }; // the hazard: absent row + absent field → NEW instance
}

test('CONVICTION 2 — process restart with an unpersisted exec txid re-proposes and a SECOND instance executes', () => {
  const chain = new FakeChain({ visibleReads: true }); // chain truth available on demand
  const name = 'wb4convic2';
  const innerOf = () => {
    const info = chain.getInfo();
    const t = taposFromHeadBlockId(info.head_block_id);
    return packTransaction({ expiration: 1760000000 + chain.blockNum, refBlockNum: t.refBlockNum, refBlockPrefix: t.refBlockPrefix, delaySec: 0, actions: [{ account: 'eosio.token', name: 'transfer', authorization: [{ actor: 'bzcodejungle', permission: 'wbfoursignr' }], data: innerTransfer('wb004 conviction 2') }] });
  };
  const execDataOf = () => new Writer().name('bzcodejungle').name(name).name('bzcodejungle').build();
  // process 1: the full lifecycle succeeds on the simulator
  const propose = buildMsigTx(chain, packProposeData('bzcodejungle', name, [{ actor: 'bzcodejungle', permission: 'wbfoursignr' }], innerOf()), 'propose');
  assert.equal(chain.push(propose.sig, propose.packed, { kind: 'propose', name }).ok, true);
  const execTx = buildMsigTx(chain, execDataOf(), 'exec');
  assert.equal(chain.push(execTx.sig, execTx.packed, { kind: 'exec', name }).ok, true);
  assert.equal(chain.opExecutions, 1);
  // crash BEFORE the exec txid is persisted to the resume FIELD (the live
  // incident: record() ordering leaves p1_exec_txid unwritten — the step
  // journal has it, the resume path never consults the journal)
  const persisted = { p1_name: name };
  // restart: the row is legitimately gone (exec consumed it) — no read lag needed
  const decision = currentP1Resume(chain, persisted);
  assert.equal(decision.action, 're-propose', 'current resume re-proposes on row-absence without the exec field');
  const p2 = buildMsigTx(chain, packProposeData('bzcodejungle', name, [{ actor: 'bzcodejungle', permission: 'wbfoursignr' }], innerOf()), 'propose');
  assert.equal(chain.push(p2.sig, p2.packed, { kind: 'propose', name }).ok, true, 'the simulator accepts the re-propose — the name is free again');
  const exec2 = buildMsigTx(chain, execDataOf(), 'exec');
  assert.equal(chain.push(exec2.sig, exec2.packed, { kind: 'exec', name }).ok, true);
  assert.equal(chain.opExecutions, 2, 'the operation executed TWICE (live: blocks 291734646/712, second exec 237aabde)');
  assert.equal(chain.instances, 2);
  console.log('  [defect demonstrated] restart + unpersisted txid + consumed row → second instance executed');
});

// --- REQUIRED: the safe reference (executable acceptance criteria) ----------

class SafeOrchestrator {
  constructor(chain, journalDir) {
    this.chain = chain;
    this.journal = join(journalDir, 'operations.jsonl');
    this.sigsByOp = new Map(); // opId -> Set(sig) — produced signatures per logical operation
  }
  journalAppend(entry) {
    // THE LAW: persist logical op, instance identity, exact signed bytes and
    // txid BEFORE submission. writeFileSync = synchronous durability stand-in
    // (the Rust implementation owns real durability).
    appendFileSync(this.journal, JSON.stringify(entry) + '\n');
  }
  submitStep(opId, name, actionData, intentName, intent) {
    const { packed, sig, txid } = buildMsigTx(this.chain, actionData, intentName);
    if (!this.sigsByOp.has(opId)) this.sigsByOp.set(opId, new Set());
    this.sigsByOp.get(opId).add(sig);
    this.journalAppend({ opId, name, step: intentName, txid, packedHex: packed.toString('hex'), sig, status: 'SUBMITTING' });
    const res = this.chain.push(sig, packed, intent);
    if (!res.ok) { this.journalAppend({ opId, txid, status: 'REFUSED', message: res.chainMessage }); return { status: 'REFUSED', txid }; }
    const included = this.chain.inclusionScan(txid, res.blockNum);
    if (!included) {
      // missing observation = UNKNOWN. No retry loop, no re-sign.
      this.journalAppend({ opId, txid, status: 'UNKNOWN' });
      return { status: 'UNKNOWN', txid, signedBytes: { packedHex: packed.toString('hex'), sig } };
    }
    this.journalAppend({ opId, txid, status: 'EXECUTED', block: res.blockNum });
    return { status: 'EXECUTED', txid, block: res.blockNum };
  }
  restartReconcile(opId, name, signedBytes) {
    // after a restart, with UNKNOWN outstanding: rebroadcast the IDENTICAL
    // signed bytes only. The chain's duplicate refusal reconciles the id.
    const txid = transactionId(Buffer.from(signedBytes.packedHex, 'hex'));
    const res = this.chain.push(signedBytes.sig, Buffer.from(signedBytes.packedHex, 'hex'), { kind: 'propose', name });
    if (!res.ok && res.chainMessage.startsWith('duplicate transaction')) {
      return { status: 'UNKNOWN', reconciled: 'duplicate-txid-refusal', txid };
    }
    return { status: 'UNKNOWN', reconciled: 'unexpected-acceptance', txid };
  }
  requestReplacement(opId) {
    // automatic replacement under uncertainty is REFUSED, full stop
    return { status: 'REFUSED', reason: 'operation-level replay protection is not enforceable here; missing observation means UNKNOWN' };
  }
}

test('REQUIRED — the safe reference: journal-before-submit, UNKNOWN on unresolved reads, rebroadcast-identical-only, replacement refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wb004-retry-'));
  try {
    const chain = new FakeChain({ visibleReads: false });
    const orch = new SafeOrchestrator(chain, dir);
    const name = 'wb4safe1';
    const inner = (() => {
      const info = chain.getInfo();
      const t = taposFromHeadBlockId(info.head_block_id);
      return packTransaction({ expiration: 1760000000 + chain.blockNum, refBlockNum: t.refBlockNum, refBlockPrefix: t.refBlockPrefix, delaySec: 0, actions: [{ account: 'eosio.token', name: 'transfer', authorization: [{ actor: 'bzcodejungle', permission: 'wbfoursignr' }], data: innerTransfer('wb004 safe reference') }] });
    })();
    const proposeData = packProposeData('bzcodejungle', name, [{ actor: 'bzcodejungle', permission: 'wbfoursignr' }], inner);

    const r1 = orch.submitStep('op-1', name, proposeData, 'propose', { kind: 'propose', name });
    assert.equal(r1.status, 'UNKNOWN', 'unresolved inclusion resolves to UNKNOWN, never to retry');

    // the journal exists and holds the exact signed bytes and txid BEFORE any observation
    assert.ok(existsSync(orch.journal), 'journal written');
    const entries = readFileSync(orch.journal, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.ok(entries.some((e) => e.opId === 'op-1' && e.txid === r1.txid && e.packedHex && e.sig), 'op identity, exact bytes and txid persisted');

    // restart + reconcile: rebroadcast the identical bytes only
    const rc = orch.restartReconcile('op-1', name, r1.signedBytes);
    assert.equal(rc.status, 'UNKNOWN');
    assert.equal(rc.reconciled, 'duplicate-txid-refusal', 'identical bytes refused as duplicate — exactly-once holds, id reconciled');

    // replacement refused under uncertainty
    const rp = orch.requestReplacement('op-1');
    assert.equal(rp.status, 'REFUSED');
    assert.match(rp.reason, /UNKNOWN/);

    // exactly ONE signature ever produced for the logical operation; ONE instance
    assert.equal(orch.sigsByOp.get('op-1').size, 1, 'no replacement signature was ever created');
    assert.equal(chain.instances, 1, 'no second proposal instance exists');
    assert.equal(chain.txs.size, 1, 'the chain saw exactly one distinct transaction for this operation');
    assert.equal(chain.opExecutions, 0, 'nothing executed under unresolved reads — UNKNOWN, not spend');
    console.log('  [law demonstrated] one signature per operation, one instance, UNKNOWN preserved, duplicate-id reconciliation only');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SCOPE — recorded limits of the live evidence (no assertion of the unproven)', () => {
  // These are the founder-ruled classifications, pinned here so no successor
  // inherits them by accident from a green CI run:
  const scope = {
    linkauth_bounds: 'action CLASSES only (approve/unapprove/transfer) — NOT chain-enforced recipient or amount limits',
    quorum: 'one delegated permission, threshold 1 — no multiparty quorum was exercised',
    cold_recovery: 'reconstructed KNOWN transactions from a supplied receipt — recovering an interrupted unsaved operation is the Rust battery\'s job',
    separation: 'threshold-1 behavior, multiparty quorum, BNR policy checks and on-chain aggregate verification are four separate things; only the first was measured live',
  };
  assert.ok(scope.linkauth_bounds.includes('NOT chain-enforced'));
  assert.ok(scope.quorum.includes('threshold 1'));
  console.log('  [scope pinned] ' + Object.keys(scope).join(', '));
});
