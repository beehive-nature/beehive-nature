// NOTE (z3.2): runs on the BOX beside ~/src/web (needs its node_modules for nostr-tools).
// Proven there 2026-09-04: claim 200 joined → AUTH ok → room EOSE against relay.skaists.dev.
// phone-truth.mjs — the phone's exact steps, run headless on the box.
// 1. generate a fresh key (what the phone browser does)
// 2. NIP-98 sign POST /api/invites/claim — SIGNING with the canonical origin
//    the relay declares in NIP-11 /info push.origin (dual-home law: transport
//    may ride the clean road, identity is the community's own host)
// 3. if admitted: NIP-42 AUTH over the WebSocket (relay tag = canonical
//    origin, REQ only after the AUTH event's OK), read the room, print
// Usage: node phone-truth.mjs <origin> <code> <channelId>
import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools/pure";

const [origin, code, channelId] = process.argv.slice(2);
const sk = generateSecretKey();
const pk = getPublicKey(sk);
console.log("phone key:", pk);

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const info = await fetch(`${origin}/info`, {
  headers: { Accept: "application/nostr+json" },
}).then((r) => r.json()).catch(() => ({}));
const canonicalHttp = String((info.push && info.push.origin) || origin)
  .replace(/^wss:/, "https:").replace(/^ws:/, "http:");
const canonicalWs = String((info.push && info.push.origin) || origin);
console.log("canonical origin:", canonicalWs);

const body = JSON.stringify({ code });
const payload = await sha256Hex(body);
const signUrl = `${canonicalHttp.replace(/\/+$/, "")}/api/invites/claim`;
const auth = finalizeEvent({
  kind: 27235,
  tags: [["u", signUrl], ["method", "POST"], ["payload", payload], ["nonce", crypto.randomUUID()]],
  content: "",
  created_at: Math.floor(Date.now() / 1000),
}, sk);
const claim = await fetch(`${origin.replace(/\/+$/, "")}/api/invites/claim`, {
  method: "POST",
  headers: { Authorization: `Nostr ${btoa(JSON.stringify(auth))}`, "Content-Type": "application/json" },
  body,
});
const claimJson = await claim.json().catch(() => ({}));
console.log("claim:", claim.status, JSON.stringify(claimJson));
if (!claim.ok) process.exit(1);

const wsUrl = origin.replace(/^http/, "ws");
const ws = new WebSocket(wsUrl);
const deadline = setTimeout(() => { console.log("timeout"); process.exit(1); }, 12000);
let authId = null;
ws.addEventListener("message", (event) => {
  const m = JSON.parse(String(event.data));
  if (m[0] === "AUTH") {
    const ev = finalizeEvent({
      kind: 22242,
      tags: [["relay", canonicalWs], ["challenge", m[1]]],
      content: "",
      created_at: Math.floor(Date.now() / 1000),
    }, sk);
    authId = ev.id;
    ws.send(JSON.stringify(["AUTH", ev]));
    return;
  }
  if (m[0] === "OK" && m[1] === authId) {
    console.log("AUTH ok:", m[2], m[2] ? "" : String(m[3] || ""));
    if (m[2]) ws.send(JSON.stringify(["REQ", "room", { kinds: [9], "#h": [channelId], limit: 5 }]));
    else { clearTimeout(deadline); process.exit(1); }
    return;
  }
  if (m[0] === "EVENT" && m[1] === "room") {
    console.log("MSG", m[2].pubkey.slice(0, 8), JSON.stringify(m[2].content.slice(0, 80)));
    return;
  }
  if (m[0] === "EOSE" && m[1] === "room") {
    console.log("EOSE — room read ✓");
    ws.close(); clearTimeout(deadline); process.exit(0);
  }
  if (m[0] === "CLOSED" && m[1] === "room") { console.log("CLOSED:", m[2]); clearTimeout(deadline); process.exit(1); }
  if (m[0] === "NOTICE") console.log("NOTICE:", m[1]);
});
