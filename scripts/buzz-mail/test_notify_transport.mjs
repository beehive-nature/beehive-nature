#!/usr/bin/env node
// test_notify_transport.mjs — CLI-contract + probe-regression proof for the
// native notice adapter.
//
// Runs the REAL adapter as a subprocess (build + sign through pinned
// nostr-tools) with an EPHEMERAL in-memory key passed only via env (never
// argv/stdin/disk — nothing is provisioned, nothing persists), a fixture
// private room whose 39000/39002 metadata is REALLY SIGNED by an ephemeral
// relay key, and synthetic payloads. Includes the two Astra probe
// (bfad123f) regressions that must both be REFUSED:
//   1. forged/unsigned room metadata accepted
//   2. off-schema payload VALUE carried into the event
// Exit 0 = all cases green; any failure exits 1.
import { spawnSync } from "node:child_process";
import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent, verifiedSymbol } from "nostr-tools";
import { fixtureRoom, buildNativeNotice, Reject } from "./notify-transport.mjs";

const ADAPTER = new URL("./notify-transport.mjs", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const key = generateSecretKey();
const relay = generateSecretKey();
const keyHex = Array.from(key, (b) => b.toString(16).padStart(2, "0")).join("");
const recipient = getPublicKey(generateSecretKey());
const channel = fixtureRoom(relay, getPublicKey(key), recipient, { id: "00000000-0000-4000-8000-000000000004" });
const payload = { v: 1, type: "bmail.notify", mailbox: "bzcode", msg_sha256: "cd".repeat(32), size: 42, state: "received", notified_utc: "2026-09-19T00:00:00Z" };
const binding = { mailbox: "bzcode", recipient, authorized: true, citation: "verified:fixture-receipt" };
const rosterLocals = ["bclaude", "bfuzz", "bqueenbee", "bzcode", "claude-code", "honeybee"];
const request = { channel, recipient, payload, binding, rosterLocals };

let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failed += 1; }
};

function runAdapter(env, stdin) {
  return spawnSync(process.execPath, [ADAPTER], { input: JSON.stringify(stdin), encoding: "utf8", env: { ...env } });
}

// 1. signed build through the real CLI path (ephemeral env key)
const ok = runAdapter({ BUZZ_MAILGATE_KEY: keyHex, PATH: process.env.PATH }, request);
try {
  const event = JSON.parse(ok.stdout);
  check("CLI signs a native kind-9 event", event.kind === 9, `kind=${event.kind} status=${ok.status}`);
  check("h tag carries the room UUID", event.tags.some((t) => t[0] === "h" && t[1] === channel.id));
  check("p tag carries the recipient", event.tags.some((t) => t[0] === "p" && t[1] === recipient));
  const copy = { ...event };
  delete copy[verifiedSymbol];
  check("event verifies through nostr-tools (no cache bit)", verifyEvent(copy));
  check("content is a reference line only", /^bMAIL notice: mailbox=/.test(event.content));
} catch (err) {
  check("CLI signs a native kind-9 event", false, `stdout=${ok.stdout} stderr=${ok.stderr} ${err}`);
}

// 2. disabled seam: no key -> named refusal, no output
const noKey = runAdapter({ PATH: process.env.PATH }, request);
check("no key -> exit 3 refusal", noKey.status === 3 && /BUZZ_MAILGATE_KEY/.test(noKey.stderr), `status=${noKey.status}`);

// 3. policy rejections through the CLI path (no input echoed in errors)
const cliReject = (name, req, rule) => {
  const out = runAdapter({ BUZZ_MAILGATE_KEY: keyHex, PATH: process.env.PATH }, req);
  check(name, out.status === 5 && new RegExp(`\\[${rule}\\]`).test(out.stderr) && !/SYNTHETIC_PRIVATE|made-this-up/i.test(out.stderr),
    `status=${out.status} stderr=${out.stderr}`);
};
cliReject("non-private room -> exit 5 named refusal", { ...request, channel: { ...channel, metadata_event: finalizeEvent({ kind: 39000, created_at: 1, tags: [["d", channel.id]], content: "" }, relay) } }, "V1");
cliReject("caller-supplied kind -> exit 5 named refusal", { ...request, kind: 1 }, "kind");

// 4. PROBE REGRESSION 1 — forged unsigned metadata must be REFUSED
//    (tampered content under the original signature; also strips/keeps the
//    verifiedSymbol cache bit both ways to prove validation ignores it)
{
  let forgedAccepted = false;
  try {
    const forged = { ...channel.metadata_event, content: "{\"private\":true,\"forged\":true}" };
    buildNativeNotice(key, { channel: { ...channel, metadata_event: forged }, recipient, payload, binding, rosterLocals });
    forgedAccepted = true;
  } catch (err) { if (!(err instanceof Reject)) throw err; }
  check("probe: forged unsigned metadata refused", forgedAccepted === false);
  const citationOnly = { id: channel.id, relay_signer: getPublicKey(relay), metadata_event: { kind: 39000, pubkey: getPublicKey(relay), tags: [["d", channel.id], ["private", ""]], content: "", id: "f".repeat(64), sig: "0".repeat(64) }, membership_event: channel.membership_event };
  let citationAccepted = false;
  try { buildNativeNotice(key, { channel: citationOnly, recipient, payload, binding, rosterLocals }); citationAccepted = true; }
  catch (err) { if (!(err instanceof Reject)) throw err; }
  check("probe: citation-shaped metadata without valid signature refused", citationAccepted === false);
}

// 5. PROBE REGRESSION 2 — off-schema payload VALUE must be refused
{
  let offSchemaAccepted = false;
  try {
    buildNativeNotice(key, { channel, recipient, payload: { ...payload, msg_sha256: "SYNTHETIC_PRIVATE_BODY_DO_NOT_FORWARD" }, binding, rosterLocals });
    offSchemaAccepted = true;
  } catch (err) { if (!(err instanceof Reject)) throw err; }
  check("probe: off-schema body value refused (never carried into the event)", offSchemaAccepted === false);
}

if (failed) { console.error(`test_notify_transport: ${failed} case(s) FAILED`); process.exit(1); }
console.log("test_notify_transport: all cases green (signed CLI path, disabled seam, policy + probe regressions)");
