// Paste into bViEw DevTools BEFORE the measured play action. No network writes.
// This records one document only. Export before navigating away.
(() => {
  if (typeof window.__bviewEngine !== 'function') throw new Error('bViEw engine unavailable');
  if (window.bviewTrial) throw new Error('Export and reload before starting another capture');
  const start = performance.now(), rows = [], marks = [];
  let stopped = false, timer;
  const number = value => Number.isFinite(value) ? value : null;
  const sample = () => {
    const e = window.__bviewEngine();
    const d = e.direct, v = e.video;
    // Allowlist: never copy URL/hash, addresses, door, error text, or storage.
    rows.push({ atMs: performance.now() - start, path: e.path, route: e.route,
      source: e.source?.kind ?? null, bytes: number(e.bytes), size: number(e.size),
      ttfbMs: number(e.ttfbMs), ttffMs: number(e.ttffMs), doneMs: number(e.doneMs),
      playhead: number(e.playhead), stalls: number(e.stalls), stallMs: number(e.stallMs),
      failed: e.fail, stalled: e.stalled, hidden: document.hidden,
      paused: v?.paused ?? null, ended: v?.ended ?? null, aheadSeconds: number(v?.ahead),
      direct: d ? { reused: d.reused, requests: d.requests, completed: d.completed,
        failed: d.failed, uniqueBytes: d.uniqueBytes, readBytes: d.readBytes,
        connectMs: number(d.connectMs), openMs: number(d.openMs),
        firstReadMs: number(d.firstReadMs), startupElapsedMs: number(d.startupElapsedMs),
        chunks: number(d.chunks), lanes: number(d.lanes),
        startupBudgetMs: number(d.startupBudgetMs), startupCapMs: number(d.startupCapMs),
        starveMs: number(d.starveMs), only: typeof d.only === 'boolean' ? d.only : null,
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
        boundary: 'one document; sampled engine counters, not wire telemetry; action marks are manual',
        stopped, marks, rows }, null, 2);
    }
  };
  timer = setInterval(sample, 250); sample();
})();
