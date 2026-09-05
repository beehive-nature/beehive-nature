#!/usr/bin/env node
// join-event-publish.mjs — publish the community's JOIN MATERIAL as the
// owner-signed Nostr event (kind 34550), so a client that knows only the
// wss:// URL can fetch it and join (docs/dispatches Order D, 2026-09-05).
//
// LAW (the invite-re-mint shape): the owner key arrives via env
// BUZZ_OWNER_SEC (nsec… or hex) and is NEVER printed, NEVER written to
// disk. Dry-run by default — --live refuses without BUZZ_OWNER_SEC.
//
//   usage: node join-event-publish.mjs [--relay wss://…] [--live]
//          BUZZ_OWNER_SEC=<owner nsec> node join-event-publish.mjs --live
//
// The event:
//   kind    34550 (NIP-29's community-definition kind, reused as the
//           join-material carrier — the relay serves this ONE kind to
//           unauthenticated REQs, pinned by a fail-closed shape guard)
//   content the same v1 JSON join.json carries (community, invite_url,
//           default_channel, rooms) — read from the live join.json so
//           this script and the door never disagree
//   tags     d      = the community host (parameterized-replaceable key:
//                    re-publishing REPLACES — invite rotation updates in
//                    place, one event alive at a time)
//           name   = the community name
//           origin = the canonical ws origin (the AUTH relay tag clients
//                    must sign — sign-the-identity, ride-the-road)
//
// After --live the script VERIFIES the way a stranger would: a fresh
// unauthenticated connection REQs kinds:[34550] and must receive the
// event back.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
} from "nostr-tools";

const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const RELAY =
  args.find((_, i) => args[i - 1] === "--relay") ??
  "wss://relay.skaists.dev";
const JOIN_JSON =
  args.find((_, i) => args[i - 1] === "--join") ??
  "/opt/buzz/deploy/compose/join/join.json";

function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

if (LIVE && !process.env.BUZZ_OWNER_SEC) {
  die(5, "REFUSED: --live needs BUZZ_OWNER_SEC (the owner nsec; dry-run only otherwise)");
}

const raw = (process.env.BUZZ_OWNER_SEC || "").trim();
let sk;
if (raw.startsWith("nsec1")) {
  sk = Buffer.from(nip19.decode(raw).data);
} else if (/^[0-9a-f]{64}$/i.test(raw)) {
  sk = Buffer.from(raw, "hex");
} else if (raw.length === 0) {
  sk = generateSecretKey(); // dry-run only — signs with a throwaway
} else {
  die(6, "REFUSED: BUZZ_OWNER_SEC is neither nsec… nor 64-hex");
}
const pk = getPublicKey(sk);

let join;
try {
  join = JSON.parse(readFileSync(JOIN_JSON, "utf8"));
} catch {
  die(7, `cannot read ${JOIN_JSON} — run beside the door's files`);
}
if (!join?.community?.host || !join?.invite_url || !join?.default_channel?.id) {
  die(8, "join.json malformed (community/invite_url/default_channel required)");
}

const canonicalWs = `wss://${join.community.host}`;
const event = finalizeEvent(
  {
    kind: 34550,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["d", join.community.host],
      ["name", join.community.name ?? join.community.host],
      ["origin", canonicalWs],
      [
        "alt",
        `join material for ${join.community.host} — the standing invite and room list`,
      ],
    ],
    content: JSON.stringify(join),
  },
  sk,
);

console.log(`== join-event publish (${LIVE ? "LIVE" : "DRY-RUN"}) ==`);
console.log(`relay     : ${RELAY}`);
console.log(`owner     : ${pk.slice(0, 12)}…${LIVE ? "" : " (throwaway — dry-run)"}`);
console.log(`community : ${join.community.host}`);
console.log(`invite    : ${String(join.invite_url).slice(0, 24)}…`);
console.log(`event id  : ${event.id}`);

if (!LIVE) {
  console.log("(dry-run — nothing was sent; run with --live + BUZZ_OWNER_SEC)");
  process.exit(0);
}

// ── publish over the wire, AUTHED (the relay gates EVENT ingest behind
// NIP-42; the owner's key answers the challenge first) ──
const WebSocket = (await import("ws")).default;
const ws = new WebSocket(RELAY);
await new Promise((res, rej) => {
  ws.once("open", res);
  ws.once("error", rej);
});
const awaitFrame = (match, timeoutMs = 10000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout " + match)), timeoutMs);
    const on = (data) => {
      let f;
      try {
        f = JSON.parse(String(data));
      } catch {
        return;
      }
      if (!Array.isArray(f) || f.length === 0) return;
      if (match(f)) {
        ws.off("message", on);
        clearTimeout(timer);
        resolve(f);
      }
    };
    ws.on("message", on);
  });
// answer the AUTH challenge with the owner key (canonical == road on this
// publish; the relay validates the tag against ITS configured origin)
{
  const challenge = await awaitFrame((f) => f[0] === "AUTH" && typeof f[1] === "string");
  const authEvent = finalizeEvent(
    {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["relay", RELAY],
        ["challenge", challenge[1]],
      ],
      content: "",
    },
    sk,
  );
  ws.send(JSON.stringify(["AUTH", authEvent]));
  const okAuth = await awaitFrame((f) => f[0] === "OK" && f[1] === authEvent.id);
  if (okAuth[2] !== true) die(11, `AUTH refused: ${okAuth[3] ?? ""}`);
  console.log("auth      : OK true");
}
ws.send(JSON.stringify(["EVENT", event]));
const okEv = await awaitFrame((f) => f[0] === "OK" && f[1] === event.id);
if (okEv[2] !== true) die(9, `publish REFUSED by the relay: ${okEv[3] ?? ""}`);
console.log("publish   : OK true");

// ── verify the stranger's way: a FRESH UNAUTHENTICATED socket REQs the
// kind and must receive the event back ──
{
  const vs = new WebSocket(RELAY);
  await new Promise((res, rej) => {
    vs.once("open", res);
    vs.once("error", rej);
  });
  vs.send(JSON.stringify(["REQ", "verify", { kinds: [34550], limit: 1 }]));
  const got = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    vs.on("message", (data) => {
      let f;
      try {
        f = JSON.parse(String(data));
      } catch {
        return;
      }
      if (f[0] === "EVENT" && f[2]?.id === event.id) {
        clearTimeout(timer);
        resolve(f[2]);
      }
      if (f[0] === "EOSE" || f[0] === "CLOSED") {
        clearTimeout(timer);
        resolve(null);
      }
    });
  });
  vs.close();
  if (!got) {
    die(10, "VERIFY FAILED — the unauthenticated REQ did not return the event");
  }
  console.log("verify    : an unauthenticated REQ returned the event — a stranger can join");
  ws.close();
}
if (!got || got.id !== event.id) {
  die(10, "VERIFY FAILED — the unauthenticated REQ did not return the event");
}
console.log("verify    : an unauthenticated REQ returned the event — a stranger can join");
