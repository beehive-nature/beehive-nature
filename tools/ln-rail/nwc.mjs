/* nwc.mjs — a minimal NWC (NIP-47) client for the estate's LN rail.
   Ours, tens of lines, because getalby/nwc-mcp-server is unlicensed (NONE)
   and quiet since 2025-06 — pattern-read, never depended on.
   The allowance law lives upstream of this file: the CONNECTION carries the
   budget (hub-side BudgetAmountSelect/get_budget_controller — Apache-2.0,
   cited in the dossier); a revoked/rotated secret is a dead connection.
   Usage: import { nwcCall, NWC_URI } from './nwc.mjs'  (env: NWC_URI) */
import 'websocket-polyfill';
import { finalizeEvent, nip44 } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';

export const NWC_URI = process.env.NWC_URI ||
  (() => { throw new Error('set NWC_URI=nostr+walletconnect://… (the app connection pairing URI)'); })();

export function parseUri(uri) {
  const u = new URL(uri.replace('nostr+walletconnect', 'https'));
  const relays = u.searchParams.getAll('relay');
  const secret = u.searchParams.get('secret');
  const wallet = u.hostname.replace(/^\//, '').toLowerCase();
  if (!relays.length || !secret || !wallet) throw new Error('malformed pairing URI');
  return { relays, secret, wallet };
}

/* one-shot NWC request/response over the pool. NIP-04 encryption is the
   compatibility floor (the hub accepts both; NIP-44 preferred once our
   bridge grows a stable connection — one-shot fresh keys per call also
   gives the rotation-revocation property for free). */
export async function nwcCall(method, params = {}, timeoutMs = 20000) {
  const { relays, secret, wallet } = parseUri(NWC_URI);
  const { getPublicKey } = await import('nostr-tools');
  const pool = new SimplePool();
  const sk = secret.padStart(64, '0');
  const skBytes = new Uint8Array(Buffer.from(sk, 'hex'));
  const pub = getPublicKey(skBytes);
  const conv = nip44.v2.utils.getConversationKey(skBytes, wallet);
  const content = nip44.v2.encrypt(JSON.stringify({ method, params }), conv);
  const ev = finalizeEvent({ kind: 4, created_at: Math.floor(Date.now() / 1000), tags: [['p', wallet], ['expiration', String(Math.floor(Date.now() / 1000) + 120)]], content }, skBytes);
  const subId = 'bnr_' + Math.random().toString(36).slice(2, 8);
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { close(); reject(new Error('NWC timeout')); }, timeoutMs);
    const close = () => { clearTimeout(timer); try { pool.close([subId]); } catch {} };
    pool.subscribeMany(relays, [{ kinds: [4], '#p': [pub], since: ev.created_at }], {
      id: subId,
      onevent: async (resp) => {
        if (resp.pubkey !== wallet) return;
        try {
          const plain = nip44.v2.decrypt(resp.content, nip44.v2.utils.getConversationKey(skBytes, resp.pubkey));
          close(); resolve(JSON.parse(plain));
        } catch { /* not for us */ }
      },
      onclose: () => { clearTimeout(timer); },
    });
    const pubRes = pool.publish(relays, ev);
    Promise.resolve(pubRes.catch ? pubRes : Promise.all(pubRes)).catch(e => { close(); reject(e); });
  });
  return done;
}
