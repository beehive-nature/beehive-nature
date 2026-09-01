#!/usr/bin/env node
/* buzz-road.mjs — the road switch for the Buzz desktop app (BRIDGE, not the
   destination; see docs/specs/SPEC-BUZZ-MULTIRELAY-1.md).
   The stock client holds ONE relay address per connection and has no
   failover. Our dual-home makes both roads the SAME community server-side,
   so switching roads client-side is a safe, instant swap the app picks up
   live (managed-agents.json carries auto_restart_on_config_change:true).

   Usage:
     node scripts/buzz-road.mjs            show the roads every entry uses
     node scripts/buzz-road.mjs clean      flip estate refs to the clean roads
                                           (relay.skaists.dev / relay2.skaists.dev)
     node scripts/buzz-road.mjs buzz       flip back to the identity roads
                                           (skaists.buzz / beehivenature.buzz)

   Touches ONLY these files inside %APPDATA%/xyz.block.buzz.app/agents/:
     managed-agents.json  (relay_url, avatar_url)
     global-agent-config.json (OPENAI_COMPAT_BASE_URL)
   A .bak-<timestamp> is written beside each file before any edit. Keys and
   everything else are carried through untouched. Vendor-host entries
   (*.communities.buzz.xyz) are never rewritten — that platform is not ours
   and has no clean twin. */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.env.APPDATA, 'xyz.block.buzz.app', 'agents');
const ROADS = {
  clean: { 'wss://skaists.buzz': 'wss://relay.skaists.dev', 'wss://beehivenature.buzz': 'wss://relay2.skaists.dev', 'https://skaists.buzz/': 'https://relay.skaists.dev/', 'https://beehivenature.buzz/': 'https://relay2.skaists.dev/' },
  buzz:  { 'wss://relay.skaists.dev': 'wss://skaists.buzz', 'wss://relay2.skaists.dev': 'wss://beehivenature.buzz', 'https://relay.skaists.dev/': 'https://skaists.buzz/', 'https://relay2.skaists.dev/': 'https://beehivenature.buzz/' },
};
const swap = (v, map) => { let out = v, hit = null; for (const [a, b] of Object.entries(map)) if (v.startsWith(a)) { out = b + v.slice(a.length); hit = [a, b]; } return { out, hit }; };

const mode = process.argv[2] || 'show';
if (mode !== 'show' && mode !== 'clean' && mode !== 'buzz') { console.error('usage: node scripts/buzz-road.mjs [show|clean|buzz]'); process.exit(1); }

const agentsPath = join(DIR, 'managed-agents.json');
const globalPath = join(DIR, 'global-agent-config.json');
const agents = JSON.parse(readFileSync(agentsPath, 'utf8'));
const glob = JSON.parse(readFileSync(globalPath, 'utf8'));

let changes = 0;
const apply = (obj, field, map) => {
  const v = obj[field];
  if (typeof v !== 'string' || !v) return;
  const { out, hit } = swap(v, map);
  if (hit) { obj[field] = out; changes++; console.log('  ' + (obj.name || 'global') + ' · ' + field + ': ' + hit[0] + ' → ' + hit[1]); }
};

if (mode === 'show') {
  console.log('roads today (' + agents.length + ' agent entries):');
  const seen = new Map();
  for (const a of agents) { const r = a.relay_url || '(inherit global/community)'; seen.set(r, (seen.get(r) || 0) + 1); }
  for (const [r, n] of seen) console.log('  ' + String(n).padStart(2) + ' × ' + r);
  console.log('  global compute rail: ' + (glob.env_vars.OPENAI_COMPAT_BASE_URL || '(none)'));
  process.exit(0);
}

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Date.now() % 100000;
copyFileSync(agentsPath, agentsPath + '.bak-' + stamp);
copyFileSync(globalPath, globalPath + '.bak-' + stamp);
const map = ROADS[mode];
console.log('switching to the ' + (mode === 'clean' ? 'CLEAN roads (filtered-network day)' : 'IDENTITY roads (.buzz names)') + ':');
for (const a of agents) { apply(a, 'relay_url', map); apply(a, 'avatar_url', map); }
apply(glob.env_vars, 'OPENAI_COMPAT_BASE_URL', map);
if (!changes) { console.log('  nothing to switch — already there'); process.exit(0); }
writeFileSync(agentsPath, JSON.stringify(agents, null, 2));
writeFileSync(globalPath, JSON.stringify(glob, null, 2));
console.log(changes + ' reference(s) switched · backups: .bak-' + stamp + ' · the app picks this up live');
