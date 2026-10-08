// WB002 boot readiness: when may the first transaction go to a fresh nodeos?
//
// cleos stamps every transaction expiration = head_block_time + 30s (its
// default -x), reading get_info anew per invocation (so TAPOS and expiry are
// re-fetched per transaction; nothing here caches them). The failure this
// guards (push run 37713028801, job 113103087283): the harness answered at
// head 1, the 2018 genesis block, so the tx carried "expiration
// 2018-06-01T12:00:30.000" and died at "block time 2026-10-08T01:28:06.000".
//
// Ready means all three, each against a named failure:
//   1. past genesis      head_block_num >= 2 (head 1 carries genesis time)
//   2. producing         head advanced since the previous poll (a current
//                        timestamp on a stalled producer is not production)
//   3. fresh             |now - head time| under half the expiry window, so
//                        head + 30s is still at least 15s in the future when
//                        the transaction lands — a looser bound (the earlier
//                        60s) admits heads whose transactions are born expired

export const CLEOS_EXPIRY_S = 30;
export const FRESH_MS = (CLEOS_EXPIRY_S * 1000) / 2;

export function headTimeMs(info) {
  const t = info.head_block_time;
  return Date.parse(`${t}${t.endsWith('Z') ? '' : 'Z'}`);
}

// prev: the previous successful get_info (or null); returns the reason it
// is NOT ready, or null when ready — a reason, never a bare false
export function notReadyReason(prev, info, nowMs) {
  if (!(info.head_block_num >= 2)) return `head ${info.head_block_num} is genesis`;
  if (!prev || !(info.head_block_num > prev.head_block_num)) return `head ${info.head_block_num} has not advanced since the last poll`;
  const skew = nowMs - headTimeMs(info);
  if (!Number.isFinite(skew)) return `unparsed head_block_time ${info.head_block_time}`;
  if (Math.abs(skew) >= FRESH_MS) return `head time ${info.head_block_time} is ${skew}ms from now (bound ${FRESH_MS}ms)`;
  return null;
}
