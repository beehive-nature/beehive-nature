// Demand arithmetic for the serverless design. No endpoint or throughput claim.
export function serverlessDemand({ population, activeFraction, mediaMbps, segmentSeconds,
  checkpointSeconds, receiptsPerProof, proofsPerAnchor }) {
  for (const [key, value] of Object.entries({ population, mediaMbps, segmentSeconds, checkpointSeconds, receiptsPerProof, proofsPerAnchor }))
    if (!Number.isFinite(value) || value <= 0) throw Error('Invalid ' + key);
  if (!(activeFraction > 0 && activeFraction <= 1)) throw Error('Invalid active fraction');
  const simultaneousViewers = population * activeFraction;
  const receiptRate = simultaneousViewers / checkpointSeconds;
  return { schema: 'bnr.serverless-demand/1',
    boundary: 'arithmetic demand, not measured network capacity; batch and anchor sizes are hypothetical',
    assumptions: { population, activeFraction, mediaMbps, segmentSeconds, checkpointSeconds, receiptsPerProof, proofsPerAnchor },
    simultaneousViewers, aggregateMediaPbps: simultaneousViewers * mediaMbps / 1e9,
    applicationRangeReadsPerSecond: simultaneousViewers / segmentSeconds,
    localCheckpointsPerSecond: receiptRate, hypotheticalProofsPerSecond: receiptRate / receiptsPerProof,
    hypotheticalAnchorsPerSecond: receiptRate / receiptsPerProof / proofsPerAnchor,
    operatorsMediaGatewayRequired: false,
    networkCapacity: 'UNVERIFIED', proofBatchCapacity: 'UNVERIFIED', costPerViewer: 'UNMEASURED' };
}
