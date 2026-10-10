import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capacity } from './capacity.mjs';
test('billion viewer units, cold-start load, cache misses and utilization remain explicit', () => {
  const x = capacity({ overhead: 1 });
  assert.equal(x.deliveryPbps, 2.5); assert.equal(x.deliveryPBPerHour, 1125);
  assert.equal(x.segmentRps, 250000000); assert.equal(x.coldStartRps, 4000000000 / 300);
  assert.ok(Math.abs(x.originMissGbps - 2500) < 1e-8);
  assert.equal(x.provisionedEdgeUnits, 41667);
  assert.equal(capacity({ cacheHit: 0, overhead: 1 }).originMissGbps, 2500000);
  assert.equal(capacity({ cacheHit: 1 }).originMissGbps, 0);
  assert.throws(() => capacity({ cacheHit: 1.1 })); assert.throws(() => capacity({ utilization: 0 }));
  assert.throws(() => capacity({ videoMbps: NaN }));
});
