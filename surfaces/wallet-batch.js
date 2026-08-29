/* wallet-batch.js — shared EIP-5792 batching helper for Base-facing surfaces.
   Coinbase Smart Wallet compatibility, item 7.2: "one approval, many actions"
   when the connected wallet supports it, graceful sequential fallback for
   EOAs (MetaMask, Rabby, etc. — none support wallet_sendCalls today).

   Spec: EIP-5792 (eips.ethereum.org/EIPS/eip-5792) — wallet_sendCalls params
   are {version, chainId, calls:[{to,data,value}], atomicRequired, from?,
   id?, capabilities?}; wallet_getCapabilities discovers support WITHOUT a
   separate permission prompt; wallet_getCallsStatus polls a submitted
   batch. The spec's own fallback line: "Apps MAY attempt to send the same
   batch of calls serially via eth_sendTransaction" when unsupported — that
   line is this module's sendSequential().

   Nothing here auto-connects, auto-approves, or touches a key. Every call
   in this file is triggered by the caller passing an already-connected
   EIP-1193 provider; the wallet's own UI owns every approval prompt. */
(function(global){
'use strict';

/* wallet_getCapabilities — per EIP-5792, capability discovery does NOT
   itself prompt the user; a wallet that doesn't recognize the method
   throws or returns an error, both treated as "no batching support" so a
   caller never has to special-case an unknown wallet. */
async function getCapabilities(provider, address, chainIdHex){
  if(!provider || !provider.request) return null;
  try{
    var caps = await provider.request({method:'wallet_getCapabilities', params:[address]});
    if(!caps) return null;
    return caps[chainIdHex] || null;
  }catch(e){ return null; }
}

/* true only if the wallet explicitly advertises atomic batch support on
   THIS chain — never assumed from provider name or user-agent sniffing,
   because that is exactly the kind of naked-EOA assumption this lane
   exists to remove. */
async function supportsBatching(provider, address, chainIdHex){
  var caps = await getCapabilities(provider, address, chainIdHex);
  return !!(caps && caps.atomic && (caps.atomic.status === 'supported' || caps.atomic.status === 'ready'));
}

/* wallet_sendCalls — one signature, N on-chain calls, per EIP-5792.
   `calls` is [{to, data, value?}]; value defaults to '0x0'. Returns the
   batch id the wallet assigns (poll it with wallet_getCallsStatus, or use
   the caller's own outbox/receipt pattern — this module does not opine on
   confirmation, only on composing the request correctly). */
async function sendBatch(provider, {address, chainIdHex, calls, atomicRequired}){
  var norm = calls.map(function(c){ return {to:c.to, data:c.data||'0x', value:c.value||'0x0'}; });
  return provider.request({method:'wallet_sendCalls', params:[{
    version: '2.0.0',
    chainId: chainIdHex,
    from: address,
    atomicRequired: atomicRequired !== false,
    calls: norm
  }]});
}

/* the EIP-5792 spec's own fallback line, verbatim in intent: send the same
   calls serially via eth_sendTransaction. Returns an array of tx hashes in
   call order; stops and rethrows on the first failure so a caller never
   silently continues past a broken step in what was meant to be one
   approval — same-order execution is the only thing a sequential fallback
   can still promise once atomicity is gone. */
async function sendSequential(provider, {address, calls}){
  var hashes = [];
  for(var i=0;i<calls.length;i++){
    var c = calls[i];
    var hash = await provider.request({method:'eth_sendTransaction', params:[{
      from: address, to:c.to, data:c.data||'0x', value:c.value||'0x0'
    }]});
    hashes.push(hash);
  }
  return hashes;
}

/* the one entry point callers should use: detect, then route. Never
   assumes; always asks the wallet first. Returns {mode:'batch'|'sequential',
   result}. */
async function sendCallsOrFallback(provider, {address, chainIdHex, calls, atomicRequired}){
  var batching = await supportsBatching(provider, address, chainIdHex);
  if(batching){
    return {mode:'batch', result: await sendBatch(provider, {address, chainIdHex, calls, atomicRequired})};
  }
  return {mode:'sequential', result: await sendSequential(provider, {address, calls})};
}

global.WalletBatch = {
  getCapabilities: getCapabilities,
  supportsBatching: supportsBatching,
  sendBatch: sendBatch,
  sendSequential: sendSequential,
  sendCallsOrFallback: sendCallsOrFallback
};
})(typeof window !== 'undefined' ? window : globalThis);

/* --selftest — pure-logic checks only (no live provider, no network, no
   key). Run: node surfaces/wallet-batch.js --selftest */
if(typeof require !== 'undefined' && require.main === module){
  (async function(){
    var WalletBatch = (typeof globalThis !== 'undefined' && globalThis.WalletBatch);
    var failures = 0;
    function check(name, cond){
      if(cond){ console.log('PASS', name); } else { console.log('FAIL', name); failures++; }
    }

    /* mock provider: advertises atomic batching only on 0x2105 (Base) */
    var batchCalls = [];
    var seqCalls = [];
    function mockProvider(caps){
      return { request: async function(req){
        if(req.method === 'wallet_getCapabilities') return caps;
        if(req.method === 'wallet_sendCalls'){ batchCalls.push(req.params[0]); return '0xbatchid'; }
        if(req.method === 'eth_sendTransaction'){ seqCalls.push(req.params[0]); return '0xtxhash'+seqCalls.length; }
        throw new Error('unexpected method '+req.method);
      }};
    }

    var supportedProvider = mockProvider({'0x2105': {atomic: {status:'supported'}}});
    var supported = await WalletBatch.supportsBatching(supportedProvider, '0xabc', '0x2105');
    check('detects atomic:supported as batching-capable', supported === true);

    var readyProvider = mockProvider({'0x2105': {atomic: {status:'ready'}}});
    check('detects atomic:ready as batching-capable',
      await WalletBatch.supportsBatching(readyProvider, '0xabc', '0x2105') === true);

    var unsupportedProvider = mockProvider({'0x2105': {atomic: {status:'unsupported'}}});
    check('atomic:unsupported is NOT batching-capable',
      await WalletBatch.supportsBatching(unsupportedProvider, '0xabc', '0x2105') === false);

    var noCapsProvider = mockProvider(null);
    check('no capabilities response = not batching-capable (never assumed)',
      await WalletBatch.supportsBatching(noCapsProvider, '0xabc', '0x2105') === false);

    var throwingProvider = { request: async function(){ throw new Error('method not found'); } };
    check('a wallet that throws on wallet_getCapabilities is treated as unsupported, not crashed on',
      await WalletBatch.supportsBatching(throwingProvider, '0xabc', '0x2105') === false);

    var calls = [{to:'0x1', data:'0xaa'}, {to:'0x2', data:'0xbb', value:'0x5'}];

    batchCalls.length = 0;
    var r1 = await WalletBatch.sendCallsOrFallback(supportedProvider, {address:'0xabc', chainIdHex:'0x2105', calls: calls});
    check('routes to batch mode when supported', r1.mode === 'batch');
    check('batch request carries both calls in order',
      batchCalls[0].calls.length === 2 && batchCalls[0].calls[0].to === '0x1' && batchCalls[0].calls[1].to === '0x2');
    check('batch request version is 2.0.0 per EIP-5792', batchCalls[0].version === '2.0.0');
    check('second call value defaults correctly, not dropped', batchCalls[0].calls[1].value === '0x5');
    check('first call value defaults to 0x0 when omitted', batchCalls[0].calls[0].value === '0x0');

    seqCalls.length = 0;
    var r2 = await WalletBatch.sendCallsOrFallback(unsupportedProvider, {address:'0xabc', chainIdHex:'0x2105', calls: calls});
    check('routes to sequential mode when unsupported', r2.mode === 'sequential');
    check('sequential fallback sends every call, same order',
      seqCalls.length === 2 && seqCalls[0].to === '0x1' && seqCalls[1].to === '0x2');
    check('sequential result is one hash per call, in order',
      r2.result.length === 2 && r2.result[0] === '0xtxhash1' && r2.result[1] === '0xtxhash2');

    var failingProvider = { request: async function(req){
      if(req.method === 'wallet_getCapabilities') return null;
      if(req.method === 'eth_sendTransaction'){
        if(seqCalls.length === 0){ seqCalls.push(req.params[0]); return '0xok'; }
        throw new Error('simulated failure on second call');
      }
    }};
    seqCalls.length = 0;
    var threw = false;
    try{ await WalletBatch.sendCallsOrFallback(failingProvider, {address:'0xabc', chainIdHex:'0x2105', calls: calls}); }
    catch(e){ threw = true; }
    check('sequential fallback stops and throws on first failure, never silently continues', threw === true);

    console.log('\n' + (failures === 0 ? 'ALL SELFTESTS PASS' : failures + ' FAILURE(S)'));
    process.exit(failures === 0 ? 0 : 1);
  })();
}
