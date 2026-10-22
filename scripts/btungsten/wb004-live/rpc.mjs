// WB004 live lane — minimal Jungle4 RPC client.
//
// Endpoints: CryptoLions (primary, the one pinned in the account receipt) and
// Greymass (independent second source for cross-verification). Error rule:
// a push refusal is a first-class RESULT (chain message extracted verbatim),
// never an exception-shaped guess.
export const ENDPOINTS = {
  primary: 'https://jungle4.cryptolions.io',
  secondary: 'https://jungle4.greymass.com',
};

export const JUNGLE4_CHAIN_ID = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d'; // PUBLIC-CONSTANT Jungle4 chain id

export class Rpc {
  constructor(base, { timeoutMs = 20000 } = {}) {
    this.base = base;
    this.timeoutMs = timeoutMs;
  }
  async call(path, body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        return { ok: false, httpStatus: res.status, raw: text.slice(0, 400) };
      }
      if (!res.ok) {
        // nodeos error shape: { code, message, error: { name, what, details: [{message}] } }
        const det = json && json.error && Array.isArray(json.error.details) && json.error.details[0];
        const chainMsg = det ? det.message : (json && json.error && (json.error.what || json.error.name)) || json.message || text.slice(0, 200);
        return { ok: false, httpStatus: res.status, chainMessage: String(chainMsg), body: json };
      }
      return { ok: true, body: json };
    } catch (e) {
      return { ok: false, transportError: String(e && e.message || e) };
    } finally {
      clearTimeout(t);
    }
  }
  get_info() { return this.call('/v1/chain/get_info', {}); }
  get_account(account_name) { return this.call('/v1/chain/get_account', { account_name }); }
  get_code(account_name) { return this.call('/v1/chain/get_code', { account_name, code_as_wasm: true }); }
  get_code_hash(account_name) { return this.call('/v1/chain/get_code_hash', { account_name }); }
  get_abi(account_name) { return this.call('/v1/chain/get_abi', { account_name }); }
  get_table_rows(q) { return this.call('/v1/chain/get_table_rows', q); }
  abi_json_to_bin(code, action, args) { return this.call('/v1/chain/abi_json_to_bin', { code, action, args }); }
  push_transaction(signatures, packedTrxHex) {
    return this.call('/v1/chain/push_transaction', {
      signatures,
      compression: 0,
      packed_context_free_data: '',
      packed_trx: packedTrxHex,
    });
  }
  history_get_transaction(id) { return this.call('/v2/history/get_transaction', { id }); }
  history_get_actions(account, limit = 20) {
    return this.call('/v2/history/get_actions?account=' + account + '&limit=' + limit + '&sort=desc', {});
  }
  // returns the clean assertion message when a push fails on a check()
  static refusedBecause(res) {
    const m = /assertion failure with message: (.+)/.exec(res.chainMessage || '');
    return m ? m[1] : (res.chainMessage || res.transportError || 'unknown');
  }
}
