// NOTE (z3.2): runs on the BOX beside ~/src/web (needs its node_modules for nostr-tools); the agent key arrives via env BUZZ_CLAIM_NSEC and is never printed. Proven 2026-09-04 for bClaude (claim + AUTH + post accepted).
// agent-claim.mjs — join an ESTATE AGENT to skaists.buzz with the same
// standing-invite claim the join-by-address phone performs (founder order
// 2026-09-04). The key arrives via env BUZZ_CLAIM_NSEC (nsec… or hex) and is
// NEVER printed. Idempotent: already_member is success.
//   usage: BUZZ_CLAIM_NSEC=<key> node agent-claim.mjs <label> [channelId "message"]
import { nip19 } from "nostr-tools";
import { getPublicKey, finalizeEvent } from "nostr-tools/pure";

const [label, channelId, message] = process.argv.slice(2);
const raw = (process.env.BUZZ_CLAIM_NSEC || "").trim();
if (!raw) { console.error("REFUSED: BUZZ_CLAIM_NSEC is not set"); process.exit(5); }

let sk;
if (raw.startsWith("nsec")) sk = nip19.decode(raw).data;
else if (/^[0-9a-fA-F]{64}$/.test(raw)) sk = Uint8Array.from(Buffer.from(raw, "hex"));
else { console.error("REFUSED: key is neither nsec nor 64-hex"); process.exit(5); }
const pk = getPublicKey(sk);
const npub = nip19.npubEncode(pk);
console.log(`agent: ${label} · ${npub.slice(0, 12)}… · ${pk.slice(0, 8)}…`);

const ORIGIN = "https://relay.skaists.dev";
const CODE = "v2.nyPIIUOZTvKbsN7ie0RwNohd_phcep0Xe3dsQGda5wk";

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const info = await fetch(`${ORIGIN}/info`, { headers: { Accept: "application/nostr+json" } }).then((r) => r.json());
const canonicalWs = String((info.push && info.push.origin) || "wss://skaists.buzz");
const canonicalHttp = canonicalWs.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
console.log("canonical origin:", canonicalWs);

// 1 · claim the standing invite (sign canonical, ride the given road)
const body = JSON.stringify({ code: CODE });
const signUrl = `${canonicalHttp.replace(/\/+$/, "")}/api/invites/claim`;
const payload = await sha256Hex(body);
const auth = finalizeEvent({
  kind: 27235,
  tags: [["u", signUrl], ["method", "POST"], ["payload", payload], ["nonce", crypto.randomUUID()]],
  content: "",
  created_at: Math.floor(Date.now() / 1000),
}, sk);
const claim = await fetch(`${ORIGIN}/api/invites/claim`, {
  method: "POST",
  headers: { Authorization: `Nostr ${btoa(JSON.stringify(auth))}`, "Content-Type": "application/json" },
  body,
});
const claimJson = await claim.json().catch(() => ({}));
console.log("claim:", claim.status, JSON.stringify(claimJson));
if (!claim.ok) process.exit(1);

// 2 · NIP-42 over the live wire; post the line if asked
const wsUrl = ORIGIN.replace(/^http/, "ws");
const ws = new WebSocket(wsUrl);
const deadline = setTimeout(() => { console.log("timeout"); process.exit(1); }, 20000);
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
    if (!m[2]) { clearTimeout(deadline); process.exit(1); }
    if (channelId && message) {
      const post = finalizeEvent({
        kind: 9,
        tags: [["h", channelId]],
        content: message,
        created_at: Math.floor(Date.now() / 1000),
      }, sk);
      ws.send(JSON.stringify(["EVENT", post]));
      postIds.add(post.id);
    } else {
      console.log("no post requested — done");
      ws.close(); clearTimeout(deadline); process.exit(0);
    }
    return;
  }
  if (m[0] === "OK" && postIds.has(m[1])) {
    console.log("post:", m[2] ? "accepted ✓" : "REFUSED: " + String(m[3] || ""));
    ws.close(); clearTimeout(deadline); process.exit(m[2] ? 0 : 1);
  }
});
const postIds = new Set();
