// Driver: runs one buzz-acp binary against the dummy relay + scripted agent,
// captures the harness log and the relay tally, prints a summary.
// Usage: node run.mjs <path-to-buzz-acp.exe> <label> [seconds]
// Key material is read from the desktop's managed-agents.json IN-PROCESS and
// passed to the child via env only — never printed, never logged.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXE = process.argv[2];
const LABEL = process.argv[3] || 'run';
const SECS = Number(process.argv[4] || 45);
const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

// nsec -> hex (bech32 decode, no polymod verify needed for local use)
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32Decode(s) {
  const pos = s.lastIndexOf('1');
  if (pos < 1) return null;
  const d = [];
  for (const c of s.slice(pos + 1).toLowerCase()) { const i = CHARSET.indexOf(c); if (i < 0) return null; d.push(i); }
  const payload = d.slice(0, -6); // drop 6-char checksum
  // convert 5-bit groups to bytes
  let acc = 0, bits = 0; const out = [];
  for (const v of payload) {
    acc = (acc << 5) | v; bits += 5;
    while (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
    acc &= (1 << bits) - 1;
  }
  return Buffer.from(out).toString('hex');
}

const mgr = JSON.parse(fs.readFileSync('C:/Users/travi/AppData/Roaming/xyz.block.buzz.app/agents/managed-agents.json', 'utf8'));
const agents = Array.isArray(mgr) ? mgr : (mgr.agents || []);
const entry = agents.find(a => a.pubkey && a.pubkey.startsWith('7b94e29b')); // bKiMi — same key the incident ran under
if (!entry?.private_key_nsec) { console.error('no key entry'); process.exit(2); }
const KEYHEX = bech32Decode(entry.private_key_nsec);
if (!/^[0-9a-f]{64}$/.test(KEYHEX)) { console.error('key decode failed'); process.exit(2); }
console.log(`[${LABEL}] agent pubkey: ${entry.pubkey.slice(0, 8)}… (key decoded in-process, not printed)`);

fs.writeFileSync(path.join(DIR, 'buzz-acp.toml'), '');
try { fs.unlinkSync(path.join(DIR, `agent-${LABEL}.log`)); } catch {}

const relay = spawn(process.execPath, [path.join(DIR, 'relay.mjs')], {
  env: { ...process.env, PORT: '19848', AGENT_PUBKEY: entry.pubkey, OUT: path.join(DIR, `relay-${LABEL}.json`) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
relay.stdout.on('data', d => process.stdout.write(`[relay] ${d}`));
relay.stderr.on('data', d => process.stderr.write(`[relay!] ${d}`));

const harnessLog = fs.openSync(path.join(DIR, `harness-${LABEL}.log`), 'w');
const harness = spawn(EXE, [
  '--relay-url', 'ws://127.0.0.1:19848',
  '--private-key', KEYHEX,
  '--agent-command', process.execPath,
  '--agent-args', path.join(DIR, 'agent.mjs'),
  '--respond-to', 'anyone',
  '--no-mention-filter',
  '--subscribe', 'all',
  '--heartbeat-interval', '12',
  '--heartbeat-prompt', 'RED heartbeat: run your oversized emission and reply.',
  '--agents', '2',
  '--no-presence',
  '--relay-observer',
], {
  cwd: DIR,
  env: { ...process.env, RUST_LOG: 'buzz_acp=debug', AGENT_LABEL: LABEL, BUZZ_AUTH_TAG: entry.auth_tag || '' },
  stdio: ['ignore', harnessLog, harnessLog],
});

const t0 = Date.now();
const done = setTimeout(() => finish(), SECS * 1000);
function finish() {
  clearTimeout(done);
  try { harness.kill(); } catch {}
  setTimeout(() => {
    try { relay.kill('SIGTERM'); } catch {}
    setTimeout(report, 1200);
  }, 500);
}
function report() {
  fs.closeSync(harnessLog);
  let log = '';
  try { log = fs.readFileSync(path.join(DIR, `harness-${LABEL}.log`), 'utf8'); } catch {}
  const clean = log.replace(/\u001b\[[0-9;]*m/g, '');
  const warns = {};
  for (const line of clean.split('\n')) {
    const m = /WARN\s+(?:buzz_acp(::\w+)?):\s*(.{0,90})/.exec(line);
    if (m) { const k = m[2].replace(/\d+/g, 'N').slice(0, 60); warns[k] = (warns[k] || 0) + 1; }
  }
  let tally = null;
  try { tally = JSON.parse(fs.readFileSync(path.join(DIR, `relay-${LABEL}.json`), 'utf8')); } catch {}
  const kinds = {};
  for (const e of tally?.events || []) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  const maxContent = Math.max(0, ...(tally?.events || []).map(e => e.contentLen));
  console.log(`\n===== ${LABEL} SUMMARY (${((Date.now() - t0) / 1000).toFixed(0)}s) =====`);
  console.log('harness log bytes:', log.length);
  console.log('harness WARN buckets:', JSON.stringify(warns, null, 1));
  console.log('relay connections:', tally?.connections, 'REQs:', tally?.reqs?.length);
  console.log('relay events by kind:', JSON.stringify(kinds));
  console.log('relay max contentLen:', maxContent);
  let alog = '';
  try { alog = fs.readFileSync(path.join(DIR, `agent-${LABEL}.log`), 'utf8'); } catch {}
  console.log('agent prompts fired:', (alog.match(/prompt #\d+ received/g) || []).length);
  console.log('agent turns completed:', (alog.match(/end_turn/g) || []).length);
  process.exit(0);
}
process.on('SIGINT', () => finish());
