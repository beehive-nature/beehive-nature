/*! bnr-keys — the BNR wallet's FIRST-PARTY Rust core, compiled to WASM.
 * Source of truth: crates/bnr-keys (this repo). Deps: k256 + sha2 + sha3 + ripemd
 * (RustCrypto, MIT OR Apache-2.0). Byte laws proven against the vendored eosjs/noble
 * lane: WIF37, EOS/PUB_K1 strings, EVM addresses, the chain digest, and the packed
 * transaction envelope are byte-identical; signatures differ in deterministic-nonce
 * law (RFC6979 vs elliptic) but are MUTUALLY VALID (each library verifies the other's).
 * The module refuses to arm unless its own pinned-vector self-test passes; on any
 * failure the wallet falls back to the vendored lane. Load: BNRKEYS → api|null. */
(function(){
  var DEC = new TextDecoder(), ENC = new TextEncoder();
  function apiOf(M){
    var OUT = M.bnr_out_ptr();
    function call(fn, input, extra){
      var v = new Uint8Array(M.memory.buffer);
      v.set(input, OUT);
      var n = (extra !== undefined) ? M[fn].apply(null, extra) : M[fn](input.length);
      if (!n) return null;
      v = new Uint8Array(M.memory.buffer);
      return v.slice(OUT, OUT + n);
    }
    function name8(s){
      var v = call('bnr_account_name', ENC.encode(s));
      if (!v) throw new Error('bad account name: ' + s);
      var u = new Uint8Array(8);
      new DataView(u.buffer).setBigUint64(0, new DataView(v.buffer, v.byteOffset, 8).getBigUint64(0, true), true);
      return u;
    }
    function cat(){
      var n = 0, i;
      for (i = 0; i < arguments.length; i++) n += arguments[i].length;
      var out = new Uint8Array(n), o = 0;
      for (i = 0; i < arguments.length; i++) { out.set(arguments[i], o); o += arguments[i].length; }
      return out;
    }
    function hexB(h){
      h = h.replace(/^0x/, '');
      var out = new Uint8Array(h.length >> 1);
      for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
      return out;
    }
    return {
      core: 'rust',
      wif37: function(seed){ return DEC.decode(call('bnr_wif37', seed)); },
      eosPub: function(seed){ return DEC.decode(call('bnr_eos_pub', seed)); },
      pubK1: function(seed){ return DEC.decode(call('bnr_pub_k1', seed)); },
      evmAddr: function(seed){ return DEC.decode(call('bnr_evm_addr', seed)); },
      accountName: function(s){
        var v = call('bnr_account_name', ENC.encode(s));
        return v ? new DataView(v.buffer, v.byteOffset, 8).getBigUint64(0, true) : null;
      },
      chainDigest: function(chainId32, packed){
        var r = call('bnr_chain_digest', cat(chainId32, packed));
        return (r && r.length === 32) ? r : null;
      },
      sign: function(seed32, digest32){
        return call('bnr_sign', cat(seed32, digest32)); // 65B [31+recid ‖ r ‖ s]
      },
      sigK1: function(payload65){ return DEC.decode(call('bnr_sig_k1', payload65)); },
      /** actions: [{account, action, actor, permission, dataHex}] → packed_trx bytes */
      packTx: function(expirationU32, refBlockNum, refBlockPrefix, actions){
        var parts = [new Uint8Array([actions.length & 0xff, actions.length >> 8])];
        for (var i = 0; i < actions.length; i++) {
          var a = actions[i];
          parts.push(name8(a.account), name8(a.action), name8(a.actor), name8(a.permission),
            new Uint8Array([a.dataHex ? (a.dataHex.replace(/^0x/,'').length >> 1) & 0xff : 0,
                            a.dataHex ? ((a.dataHex.replace(/^0x/,'').length >> 1) >> 8) & 0xff : 0]));
          if (a.dataHex) parts.push(hexB(a.dataHex));
        }
        var acts = parts.length === 1 ? parts[0] : cat.apply(null, parts);
        return call('bnr_pack_tx', acts, [expirationU32, refBlockNum, refBlockPrefix, acts.length]);
      }
    };
  }
  window.BNRKEYS = (async function(){
    try {
      // resolve the .wasm beside THIS script, not beside the page (wallet.html lives one dir up)
      var me = document.currentScript;
      var base = me ? me.src.replace(/[^/]*$/, '') : 'onboarding/vendor/';
      var r = await fetch(base + 'bnr-keys.wasm?v=1');
      if (!r.ok) return null;
      var t = await WebAssembly.instantiate(await r.arrayBuffer(), {});
      var M = t.instance.exports;
      if (M.bnr_self_test() !== 1) return null; // pinned vectors must pass or we stay on the vendored lane
      return apiOf(M);
    } catch (e) {
      return null;
    }
  })();
})();
