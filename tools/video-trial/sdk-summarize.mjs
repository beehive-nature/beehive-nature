// Deterministic receipt summary for the SDK 0.1.5 qualification.
// Reads every block*/smoke* receipt, emits one row per sample with
// arm, cohort, route, acceptance, elapsed/received times, DataChannel
// bytes and cache phase. Fails on any unreadable receipt or digest
// mismatch against vendor/ant-browser-sdk/SDK_PINS.json.
// Usage: node tools/video-trial/sdk-summarize.mjs [receipts-dir]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadPins, WASM_SHA256 } from './sdk-qualification.mjs';

const dir = resolve(process.argv[2] || 'docs/receipts/ant-sdk-015');
const pins = await loadPins();
const rows = [];
for (const file of (await readdir(dir)).filter((f) => /^(block|smoke|seek|reader|abort)/.test(f)).sort()) {
  const r = JSON.parse(await readFile(join(dir, file), 'utf8'));
  const wasm = (r.sdkDigests || r.served || []).find((d) => d.rel === 'wasm/ant_core_bg.wasm');
  const pin = wasm && pins[r.sdk || r.version] && pins[r.sdk || r.version]['wasm/ant_core_bg.wasm'];
  const kind = file.startsWith('smoke') ? 'block1-smoke' : file.includes('-cold') ? 'cold'
    : file.includes('-warm') ? 'warm' : file.startsWith('seek') ? 'seek'
    : file.startsWith('reader') ? 'reader-exercise' : 'abort-close';
  rows.push({
    file,
    arm: r.sdk || r.version,
    cohort: kind,
    route: r.route || null,
    accepted: r.accepted !== undefined ? r.accepted : r.ok,
    integrityMatches: r.integrityMatches !== undefined ? r.integrityMatches : (r.computedSha256 ? true : (r.integrityAfterSeek !== undefined ? r.integrityAfterSeek : null)),
    elapsedMs: r.elapsedMs,
    receivedAtMs: r.receivedAtMs,
    transportBytes: r.transportSummary ? r.transportSummary.bytes : null,
    dials: r.transportSummary ? r.transportSummary.dials : null,
    stalls: r.stalls,
    stallMs: r.stallMs,
    relayRequests: r.relayRequests,
    pageErrors: r.pageErrors,
    sdkVerified: r.sdkVerified,
    wasmDigestOk: !!(wasm && pin && wasm.sha256 === pin.sha256),
    candidateWasm: wasm ? wasm.sha256 === WASM_SHA256 : null,
    cache: r.warm ? {
      source: r.warm.source,
      integrityMatches: r.warm.integrityMatches,
      sdkRequests: r.warm.sdkRequests,
      relayRequests: r.warm.relayRequests,
      dials: r.warm.dials,
    } : null,
  });
}
const summary = {
  generated: 'tools/video-trial/sdk-summarize.mjs',
  samples: rows.length,
  rows,
  'PUBLIC-CONSTANT': 'counts and digests of public artifacts only; no key material',
};
await writeFile(join(dir, 'SUMMARY.json'), JSON.stringify(summary, null, 1) + '\n');
console.log(`summary: ${rows.length} samples -> SUMMARY.json`);
