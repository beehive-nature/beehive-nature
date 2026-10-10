// Paste into bViEw DevTools BEFORE the measured play action. No network writes.
// This records one document only. Export before navigating away.
(() => {
  if (typeof window.__bviewEngine !== 'function') throw new Error('bViEw engine unavailable');
  if (window.bviewTrial) throw new Error('Export and reload before starting another capture');
  const start = performance.now(), rows = [], marks = [];
  let stopped = false, timer, chunkReceipts = [], chunkReceiptsTruncated = false;
  const number = value => Number.isFinite(value) ? value : null;
  const state = value => ['queued','reading','backoff','arrived','emitted','timeout','cancelled','failed','complete','opening','pending','short'].includes(value) ? value : null;
  const sample = () => {
    const e = window.__bviewEngine();
    const d = e.direct, v = e.video;
    const t = window.__antTransport?.snapshot();
    // Keep one bounded chunk timeline, not a full copy in every 250 ms row.
    // Peer attribution is unavailable at this layer; never invent it or copy IDs.
    chunkReceiptsTruncated = (d?.chunkReceipts?.length || 0) > 256;
    chunkReceipts = (d?.chunkReceipts || []).slice(0,256).map(c => ({
      index:number(c.index),start:number(c.start),length:number(c.length),state:state(c.state),
      arrivedMs:number(c.arrivedMs),emittedMs:number(c.emittedMs),peer:null,
      attempts:(c.attempts || []).slice(0,3).map(a => ({ number:number(a.number),
        startMs:number(a.startMs),endMs:number(a.endMs),outcome:state(a.outcome),bytes:number(a.bytes) }))
    }));
    // Allowlist: never copy URL/hash, addresses, door, error text, or storage.
    rows.push({ atMs: performance.now() - start, path: e.path, route: e.route,
      source: e.source?.kind ?? null, bytes: number(e.bytes), size: number(e.size),
      ttfbMs: number(e.ttfbMs), ttffMs: number(e.ttffMs), doneMs: number(e.doneMs),
      playhead: number(e.playhead), stalls: number(e.stalls), stallMs: number(e.stallMs),
      failed: e.fail, stalled: e.stalled, hidden: document.hidden,
      transport: t ? { dials:number(t.dials),opened:number(t.opened),closed:number(t.closed),
        dead:number(t.dead),waiting:number(t.waiting),bytes:number(t.bytes),endpoints:number(t.endpoints),
        endpointsReachable:number(t.endpointsReachable),endpointsUnreachable:number(t.endpointsUnreachable),
        endpointsRecovered:number(t.endpointsRecovered),openRate:number(t.openRate),endpointRate:number(t.endpointRate),
        failedPerOpened:number(t.failedPerOpened),deadMs:number(t.deadMs),
        deadAt:t.deadAt ? {dial:number(t.deadAt.dial),ice:number(t.deadAt.ice),dtls:number(t.deadAt.dtls)} : null,
        connectP50:number(t.connectP50),connectP95:number(t.connectP95),
        answerP50:number(t.answerP50),answerP95:number(t.answerP95) } : null,
      paused: v?.paused ?? null, ended: v?.ended ?? null, aheadSeconds: number(v?.ahead),
      video: v ? { duration:number(v.duration),width:number(v.width),height:number(v.height),
        srcChanges:number(v.srcChanges),quality:v.quality ? {
          total:number(v.quality.total),dropped:number(v.quality.dropped) } : null } : null,
      direct: d ? { reused: d.reused, requests: d.requests, completed: d.completed,
        failed: d.failed, uniqueBytes: d.uniqueBytes, readBytes: d.readBytes,
        readMs:number(d.readMs),firstFrameMs:number(d.firstFrameMs),
        connectMs: number(d.connectMs), openMs: number(d.openMs),
        firstReadMs: number(d.firstReadMs), startupElapsedMs: number(d.startupElapsedMs),
        chunks: number(d.chunks), lanes: number(d.lanes),
        startupBudgetMs: number(d.startupBudgetMs), startupCapMs: number(d.startupCapMs),
        starveMs: number(d.starveMs), only: typeof d.only === 'boolean' ? d.only : null,
        status:state(d.status),retries:number(d.retries),retryLimit:number(d.retryLimit),
        maxAttempts:number(d.maxAttempts),recoveredChunks:number(d.recoveredChunks),
        emittedBytes: number(d.emittedBytes), bufferedBytes: number(d.bufferedBytes),
        peakBufferedBytes: number(d.peakBufferedBytes), emittedChunks: number(d.emittedChunks),
        waitingForChunk: number(d.waitingForChunk), headWaitMs: number(d.headWaitMs) } : null });
    if (rows.length >= 7200) stop(); // bounded to 30 minutes at 250 ms
  };
  const stop = () => { stopped = true; clearInterval(timer); };
  window.bviewTrial = {
    mark(label) {
      if (stopped) throw new Error('Capture stopped');
      if (!['play', 'home', 'watch', 'seek', 'pause', 'resume'].includes(label)) throw new Error('Unknown action');
      marks.push({ label, atMs: performance.now() - start }); sample();
    },
    stop() { if (!stopped) sample(); stop(); },
    export() {
      return JSON.stringify({ schema: 'bview-trial/1', intervalMs: 250,
        boundary: 'one document; sampled engine counters and data-channel payload, not full wire bytes; action marks are manual; chunkReceipts describe the latest direct attempt',
        stopped, marks, rows, chunkReceipts, chunkReceiptsTruncated }, null, 2);
    }
  };
  timer = setInterval(sample, 250); sample();
})();
