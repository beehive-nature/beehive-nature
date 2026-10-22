// Birth republication — Buzz-app side (staged, not forced).
// Production relays refused the terminal seat (NIP-42). Run this
// from inside the Buzz app context (or anywhere the app's relay
// key is available): it rebuilds kind 31337 + 31340 for the Spark
// pool agent and publishes them with proper NIP-42 auth.
// Usage: RELAY_KEY_NSEC=<from app env> node republish.mjs
import { readFileSync } from "node:fs";

const birth = JSON.parse(readFileSync(new URL("./birth-statement.json", import.meta.url)));
const envelope = JSON.parse(readFileSync(new URL("./birth-statement.json.sig.json", import.meta.url)));

if (!process.env.RELAY_KEY_NSEC) {
  console.error("RELAY_KEY_NSEC missing (app env only, never a file)");
  process.exit(2);
}

// Event shapes mirror harness/nostr_pub.py (agent_status /
// identity_proof). Signing + NIP-42 are the app's relay client
// responsibilities; this staging file pins WHAT is published:
//  - kind 31337: ["d","birth-<slug8>"] state "born",
//    backend "llama-pool-door", turn 0
//  - kind 31340: content = birth statement + bsigner_envelope
//    (ML-DSA-65, key bheart-XAoTNYsd0JPyUfxj, verified true at
//    birth; original local-relay ids 3cc069ae… / dbf38474…)
console.log(JSON.stringify({ birth, envelope_alg: envelope.alg, key_id: envelope.key_id }, null, 2));
console.log("Stage the two kinds above through the Buzz app relay client (NIP-42 authenticated).");
