import test from 'node:test';
import assert from 'node:assert/strict';
import { CLEOS_EXPIRY_S, FRESH_MS, headTimeMs, notReadyReason } from './wb002-chain-ready.mjs';

// the exact moment of push run 37713028801: genesis head, real wall clock
const NOW = Date.parse('2026-10-08T01:28:05.551Z');
const at = (num, ms) => ({ head_block_num: num, head_block_time: new Date(ms).toISOString().replace('Z', '') });
const GENESIS = { head_block_num: 1, head_block_time: '2018-06-01T12:00:00.000' };

test('the failing run: head 1 at genesis time is not ready', () => {
  assert.match(notReadyReason(null, GENESIS, NOW), /genesis/);
  // and the arithmetic of the receipt: cleos expiry = genesis + 30s
  assert.equal(new Date(headTimeMs(GENESIS) + CLEOS_EXPIRY_S * 1000).toISOString(), '2018-06-01T12:00:30.000Z');
});

test('a current head that has not advanced since the last poll is not ready', () => {
  const h = at(2, NOW - 200);
  assert.match(notReadyReason(null, h, NOW), /not advanced/);
  assert.match(notReadyReason(h, h, NOW), /not advanced/);
});

test('a head stale past half the expiry window is not ready (the old 60s bound admitted it)', () => {
  const stale = at(5, NOW - 40_000); // tx would expire 10s BEFORE it was sent
  assert.match(notReadyReason(at(4, NOW - 40_500), stale, NOW), /bound/);
  assert.ok(40_000 < 60_000, 'the pre-fix predicate would have returned ready here');
});

test('a head from the future (clock skew) is not ready', () => {
  assert.match(notReadyReason(at(2, NOW), at(3, NOW + FRESH_MS + 1), NOW), /bound/);
});

test('an advancing, fresh, post-genesis head is ready and leaves >= 15s of expiry', () => {
  const h = at(3, NOW - 500);
  assert.equal(notReadyReason(at(2, NOW - 1000), h, NOW), null);
  assert.ok(headTimeMs(h) + CLEOS_EXPIRY_S * 1000 - NOW >= FRESH_MS);
});
