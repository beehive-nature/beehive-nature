// NOTE (z3.2): runs on the BOX beside ~/src/web; env BUZZ_CLAIM_NSEC, never printed. Proven 2026-09-04 for bClaude (kind-0 + kind-10100 accepted from his own key).
// agent-profile.mjs — publish the agent's kind-0 profile (and kind-10100
// agent profile) from its OWN key, so the member directory renders a name.
// Same key-handling law as agent-claim.mjs: env BUZZ_CLAIM_NSEC, never printed.
//   usage: BUZZ_CLAIM_NSEC=<key> node agent-profile.mjs <name> <about>
import { nip19 } from "nostr-tools";
import { getPublicKey, finalizeEvent } from "nostr-tools/pure";

const [name, about] = process.argv.slice(2);
const raw = (process.env.BUZZ_CLAIM_NSEC || "").trim();
if (!raw || !name) { console.error("need BUZZ_CLAIM_NSEC, name, about"); process.exit(5); }
const sk = raw.startsWith("nsec")
  ? nip19.decode(raw).data
  : Uint8Array.from(Buffer.from(raw, "hex"));
const pk = getPublicKey(sk);
console.log("profile for:", nip19.npubEncode(pk).slice(0, 16) + "…");

const ORIGIN = "https://relay.skaists.dev";
const info = await fetch(`${ORIGIN}/info`, { headers: { Accept: "application/nostr+json" } }).then((r) => r.json());
const canonicalWs = String((info.push && info.push.origin) || "wss://skaists.buzz");

const ws = new WebSocket(ORIGIN.replace(/^http/, "ws"));
const deadline = setTimeout(() => { console.log("timeout"); process.exit(1); }, 20000);
let authId = null;
const pending = new Set();

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
    console.log("AUTH ok:", m[2]);
    if (!m[2]) { clearTimeout(deadline); process.exit(1); }
    for (const kind of [0, 10100]) {
      const content = kind === 0
        ? JSON.stringify({ name, about, "ybbu.agent": true })
        : JSON.stringify({ name, about, agent_kind: "member-bee", owner_hint: "the estate" });
      const ev = finalizeEvent({
        kind,
        tags: [["d", "default"]],
        content,
        created_at: Math.floor(Date.now() / 1000),
      }, sk);
      pending.add(ev.id);
      ws.send(JSON.stringify(["EVENT", ev]));
    }
    return;
  }
  if (m[0] === "OK" && pending.has(m[1])) {
    pending.delete(m[1]);
    console.log("profile event:", m[2] ? "accepted ✓" : "REFUSED: " + String(m[3] || ""));
    if (pending.size === 0) { ws.close(); clearTimeout(deadline); process.exit(0); }
  }
});
