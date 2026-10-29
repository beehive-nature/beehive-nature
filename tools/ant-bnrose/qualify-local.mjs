#!/usr/bin/env node
// Local SDK-consumer qualification measurement for the ANT browser
// SDK read path, through the existing verified-observer contract.
//
// This measures the consumer-side contract only: a stand-in transport
// serves identical bytes at a controlled latency, and every read must
// verify (receiver-selected size + SHA-256) before the bounded bnrose
// observation is admitted. It does not touch the network, a wallet,
// payment, upload, or the vendored SDK; SDK-version qualification
// still requires the pinned vendor artifact and its owners.
//
// Output is one JSON object: latency, connections (transport
// invocations / max concurrency), bytes, memory, cancellation and
// recovery, all for identical verified content under the observer's
// existing resource limits (2 MiB max, see verified-observer.mjs).

import fs from 'node:fs/promises';
import { createVerifiedDownloader } from './verified-observer.mjs';

const FIXTURE_BYTES = 1024 * 1024; // 1 MiB, inside the 2 MiB limit
const SIMULATED_LATENCY_MS = 25;

const content = new Uint8Array(FIXTURE_BYTES);
for (let i = 0; i < content.length; i++) content[i] = (i * 31 + 7) & 0xff;
const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', content)).toString('hex');
const fixture = { address: 'a'.repeat(64), sha256, size: content.length };
const module = await WebAssembly.compile(
  await fs.readFile(new URL('./kernel.wasm', import.meta.url)),
);

function transport({ latencyMs = SIMULATED_LATENCY_MS, failFirst = 0 } = {}) {
  const state = { calls: 0, active: 0, maxActive: 0 };
  const client = {
    download: async () => {
      state.calls++;
      state.active++;
      state.maxActive = Math.max(state.maxActive, state.active);
      try {
        await new Promise((resolve) => setTimeout(resolve, latencyMs));
        if (state.calls <= failFirst) throw new Error('transport refused');
        return { bytes: content.slice() };
      } finally {
        state.active--;
      }
    },
  };
  return { client, state };
}

async function timed(fn) {
  const start = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - start };
}

// Latency: observed vs opt-out, same identical content.
const latencyObserved = await timed(async () => {
  const { client } = transport();
  const downloader = await createVerifiedDownloader(client, fixture, { enabled: true, module });
  return downloader.download();
});
const latencyOptOut = await timed(async () => {
  const { client } = transport();
  const downloader = await createVerifiedDownloader(client, fixture, { enabled: false });
  return downloader.download();
});

// Connections + bytes: four concurrent identical reads.
const concurrent = transport();
const heapBefore = process.memoryUsage().heapUsed;
const concurrentRun = await timed(async () => {
  const downloader = await createVerifiedDownloader(concurrent.client, fixture, {
    enabled: true,
    module,
  });
  return Promise.all([downloader.download(), downloader.download(), downloader.download(), downloader.download()]);
});
const heapAfter = process.memoryUsage().heapUsed;
const verifiedBytes = concurrentRun.value.reduce(
  (sum, r) => sum + r.result.bytes.byteLength,
  0,
);

// Cancellation: an aborted read rejects and consumes no observation.
const cancellation = { rejected: false, nextSequence: null };
{
  const controller = new AbortController();
  const { client } = transport();
  const downloader = await createVerifiedDownloader(
    {
      download: async () => {
        controller.abort();
        return client.download();
      },
    },
    fixture,
    { enabled: true, module },
  );
  try {
    await downloader.download({ signal: controller.signal });
  } catch {
    cancellation.rejected = true;
  }
  const after = await downloader.download();
  cancellation.nextSequence = after.observation.sequence;
}

// Recovery: a transport failure, then the same downloader succeeds
// with identical verified content and the first observation sequence.
const recoveryTransport = transport({ failFirst: 1 });
const recovery = { failedFirst: false, sequence: null, hashVerified: false };
{
  const downloader = await createVerifiedDownloader(recoveryTransport.client, fixture, {
    enabled: true,
    module,
  });
  try {
    await downloader.download();
  } catch {
    recovery.failedFirst = true;
  }
  const second = await downloader.download();
  recovery.sequence = second.observation.sequence;
  const secondHash = Buffer.from(
    await crypto.subtle.digest('SHA-256', second.result.bytes),
  ).toString('hex');
  recovery.hashVerified = secondHash === sha256;
}

console.log(
  JSON.stringify(
    {
      fixture: { bytes: FIXTURE_BYTES, sha256, simulatedLatencyMs: SIMULATED_LATENCY_MS },
      latencyMs: {
        observed: Number(latencyObserved.ms.toFixed(2)),
        optOut: Number(latencyOptOut.ms.toFixed(2)),
        observedBreakdown: latencyObserved.value.timing,
        status: latencyObserved.value.observation.status,
      },
      connections: {
        transportCalls: concurrent.state.calls,
        maxConcurrent: concurrent.state.maxActive,
        wallMs: Number(concurrentRun.ms.toFixed(2)),
      },
      bytes: { perRead: FIXTURE_BYTES, verifiedTotal: verifiedBytes },
      memory: { heapUsedDeltaBytes: heapAfter - heapBefore },
      cancellation,
      recovery,
    },
    null,
    2,
  ),
);
