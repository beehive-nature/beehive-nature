// Arithmetic planning envelope, deliberately not a load test or capacity certificate.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
export function capacity({ viewers = 1e9, videoMbps = 2.5, overhead = 1.15, segmentSeconds = 4,
  cacheHit = 0.999, edgeGbps = 100, utilization = 0.6, regions = 100, startWindowSeconds = 300,
  startupRequests = 4, directDials = 993, directOpenPeers = 42 } = {}) {
  for (const [k, v] of Object.entries({ viewers, videoMbps, overhead, segmentSeconds, edgeGbps, regions, startWindowSeconds, startupRequests }))
    if (!Number.isFinite(v) || v <= 0) throw new RangeError(`${k} must be finite and positive`);
  if (!(cacheHit >= 0 && cacheHit <= 1 && utilization > 0 && utilization <= 1)) throw new RangeError('Invalid cache hit/utilization');
  if (![directDials, directOpenPeers].every(v => Number.isFinite(v) && v >= 0)) throw new RangeError('Invalid peer counts');
  const deliveryBps = viewers * videoMbps * 1e6 * overhead, segmentRps = viewers / segmentSeconds;
  return { schema: 'bview-capacity/1', boundary: 'arithmetic assumptions only; no deployed capacity or audience measured',
    assumptions: { viewers, videoMbps, overhead, segmentSeconds, cacheHit, edgeGbps, utilization, regions, startWindowSeconds, startupRequests, directDials, directOpenPeers },
    deliveryPbps: deliveryBps / 1e15, deliveryPBPerHour: deliveryBps * 3600 / 8 / 1e15,
    segmentRps, coldStartRps: viewers * startupRequests / startWindowSeconds,
    originMissGbps: deliveryBps * (1 - cacheHit) / 1e9, originMissRps: segmentRps * (1 - cacheHit),
    edge100PercentUnits: Math.ceil(deliveryBps / (edgeGbps * 1e9)),
    provisionedEdgeUnits: Math.ceil(deliveryBps / (edgeGbps * 1e9 * utilization)),
    averageRegionGbps: deliveryBps / regions / 1e9,
    extrapolatedDirectDials: viewers * directDials, extrapolatedOpenPeers: viewers * directOpenPeers };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify({ original32_6Mbps: capacity({ videoMbps: 32.6 }), adaptive2_5Mbps: capacity(),
    poorCache95Percent: capacity({ cacheHit: 0.95 }), coldCache: capacity({ cacheHit: 0 }) }, null, 2));
}
