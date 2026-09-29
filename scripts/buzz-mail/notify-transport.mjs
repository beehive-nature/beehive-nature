#!/usr/bin/env node
// notify-transport.mjs — the typed NATIVE Buzz notice builder + pinned signer.
//
// SOURCE-RESOLVED SHAPE (Astra native-buzz-mail-transport.md, sha256
// 717ee3ef…; buzz-sdk builders.rs:224 build_message): native Buzz room
// messages are kind 9 with an `h` tag carrying the actual channel UUID and
// PLAINTEXT content — there is no NIP-44 step. This builder is TYPED: kind
// is fixed at 9, the `h` tag comes from a VALIDATED private room, and the
// content is CONSTRUCTED here from schema-checked reference fields only.
// No caller-chosen kind, no encryption switch.
//
// ALL cryptography lives in pinned nostr-tools (2.25.2, the repo's existing
// pin) — no homemade primitives in this package (steer 83a2a264).
//
// VALIDATION BEFORE BUILD — signatures, not assertions (probe bfad123f):
//   V1 the room is proven by SIGNED EVENTS, not a citation string: a kind
//      39000 metadata event and a kind 39002 membership event, each
//      signature-verified with nostr-tools AND pubkey-checked against the
//      separately pinned expected relay signer; the d tag must equal the
//      channel id; the metadata must carry private/hidden; the membership
//      event's p tags must be exactly {sender, recipient}. Test fixtures
//      mint real signed metadata with an ephemeral relay key; production
//      discovery and keys stay disabled. A citation string is provenance
//      text, not validation.
//   V2 sender and recipient are members, no extra participant (one-agent
//      notice channel) — from the VERIFIED membership event.
//   V3 the binding is self-describing: it names its mailbox and recipient
//      pubkey, both must match THIS notice, and its citation must be a
//      verified:* receipt (membership alone is not mailbox authority).
//   V4 VALUES are schema-checked, not just field names: mailbox must be a
//      canonical roster local (sink KNOWN, passed in by the caller);
//      msg_sha256 exactly 64 hex; size a bounded non-negative integer;
//      type/v fixed values; state from a closed enum; notified_utc a
//      strict UTC timestamp. Rejected values are never echoed in errors.
//
// DISABLED SEAM: signing requires BUZZ_MAILGATE_KEY in the environment.
// No key is provisioned for this candidate; room creation (41010) and
// publishing remain activation-time gestures. `--selftest` proves the
// pinned path with ephemeral in-memory keys and fixture metadata signed
// by an ephemeral relay key; nothing is persisted or provisioned.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent, verifiedSymbol } from "nostr-tools";

export const NATIVE_KIND = 9;
export const METADATA_KIND = 39000;
export const MEMBERSHIP_KIND = 39002;
export const PAYLOAD_SCHEMA = {
  v: { type: "int", fixed: 1 },
  type: { type: "str", fixed: "bmail.notify" },
  mailbox: { type: "str", roster: true, max: 32 },
  msg_sha256: { type: "str", hex64: true },
  size: { type: "int", min: 0, max: 256 * 1024 },
  state: { type: "str", enum: ["received", "held_sensitive", "held_format"] },
  notified_utc: { type: "str", utc: true },
};

class Reject extends Error {
  constructor(rule, msg) { super(msg); this.rule = rule; }
}
export { Reject };

function hexRe(h) { return /^[0-9a-f]{64}$/.test(String(h || "")); }

function failNoEcho(rule, what) { throw new Reject(rule, `${what} failed validation`); }

export function freshVerify(ev) {
  // Strip nostr-tools' cached verifiedSymbol before verifying: a tampered
  // copy that carried the cache bit would otherwise short-circuit to true.
  // Validation never trusts a cache.
  const copy = { ...ev };
  delete copy[verifiedSymbol];
  return verifyEvent(copy);
}

export function validateRoom(channel, senderPubkey, recipientHex) {
  if (!channel || typeof channel !== "object") failNoEcho("V1", "room descriptor");
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,36}$/.test(String(channel.id || ""))) failNoEcho("V1", "room id");
  const signer = String(channel.relay_signer || "").toLowerCase();
  if (!hexRe(signer)) failNoEcho("V1", "expected relay signer");
  const meta = channel.metadata_event;
  const members = channel.membership_event;
  if (!meta || !members || typeof meta !== "object" || typeof members !== "object") failNoEcho("V1", "signed room events");
  for (const [ev, name] of [[meta, "metadata event"], [members, "membership event"]]) {
    if (!freshVerify(ev)) failNoEcho("V1", `room ${name} signature`);
    if (String(ev.pubkey || "").toLowerCase() !== signer) failNoEcho("V1", `room ${name} signer`);
    const dtags = (ev.tags || []).filter((t) => t && t[0] === "d");
    if (dtags.length !== 1 || dtags[0][1] !== String(channel.id)) failNoEcho("V1", `room ${name} channel id`); // F6: exactly ONE d tag, matching
  }
  if (meta.kind !== METADATA_KIND) failNoEcho("V1", "metadata kind");
  if (members.kind !== MEMBERSHIP_KIND) failNoEcho("V1", "membership kind");
  // STRICT DM privacy (6689f0e1): the relay's side_effects.rs emits
  // [hidden] for DMs with the comment "Not a security boundary", plus a
  // [t, <channel_type>] tag. A notice room must carry ALL THREE privacy
  // signals from TAGS: private AND hidden AND t=dm. A contradictory
  // [public] tag, duplicate/ambiguous flags, or privacy claimed only in
  // metadata JSON content are all refused. The relay-signer pin is
  // protected configuration, independent of the metadata under check.
  {
    const tags = meta.tags || [];
    const count = (name) => tags.filter((t) => t && t[0] === name).length;
    for (const name of ["private", "hidden", "public", "t"]) {
      if (count(name) > 1) failNoEcho("V1", "ambiguous room flag");
    }
    if (count("public") > 0) failNoEcho("V1", "contradictory public flag");
    if (count("private") !== 1 || count("hidden") !== 1) failNoEcho("V1", "room privacy flags");
    const ttag = tags.find((t) => t && t[0] === "t");
    if (!ttag || ttag[1] !== "dm") failNoEcho("V1", "room channel type");
  }
  const memberSet = (members.tags || []).filter((t) => t[0] === "p").map((t) => String(t[1]).toLowerCase());
  if (memberSet.length !== 2) failNoEcho("V2", "one-agent notice room membership size");
  if (!hexRe(senderPubkey) || !memberSet.includes(senderPubkey)) failNoEcho("V2", "sender membership");
  if (!hexRe(recipientHex) || !memberSet.includes(recipientHex)) failNoEcho("V2", "recipient membership");
  const extras = memberSet.filter((m) => m !== senderPubkey && m !== recipientHex);
  if (extras.length > 0) failNoEcho("V2", "extra participant");
  return true;
}

export function validateBinding(binding, mailbox, recipientHex) {
  if (!binding || typeof binding !== "object") failNoEcho("V3", "binding");
  if (binding.mailbox !== mailbox) failNoEcho("V3", "binding mailbox match");
  if (String(binding.recipient || "").toLowerCase() !== recipientHex) failNoEcho("V3", "binding recipient match");
  if (binding.authorized !== true) failNoEcho("V3", "binding authorization");
  if (!String(binding.citation || "").startsWith("verified:")) failNoEcho("V3", "binding citation");
  return true;
}

export function validatePayload(payload, rosterLocals) {
  if (!payload || typeof payload !== "object") failNoEcho("V4", "payload");
  const keys = Object.keys(payload).sort().join(",");
  if (keys !== Object.keys(PAYLOAD_SCHEMA).sort().join(",")) failNoEcho("V4", "payload field set");
  if (!Array.isArray(rosterLocals) || rosterLocals.length === 0) failNoEcho("V4", "roster locals");
  for (const [field, rule] of Object.entries(PAYLOAD_SCHEMA)) {
    const value = payload[field];
    if (rule.type === "int") {
      if (!Number.isInteger(value)) failNoEcho("V4", `field ${field} type`);
      if (rule.fixed !== undefined && value !== rule.fixed) failNoEcho("V4", `field ${field} fixed value`);
      if (rule.min !== undefined && value < rule.min) failNoEcho("V4", `field ${field} range`);
      if (rule.max !== undefined && value > rule.max) failNoEcho("V4", `field ${field} range`);
    } else {
      if (typeof value !== "string") failNoEcho("V4", `field ${field} type`);
      if (rule.fixed !== undefined && value !== rule.fixed) failNoEcho("V4", `field ${field} fixed value`);
      if (rule.hex64 && !/^[0-9a-f]{64}$/.test(value)) failNoEcho("V4", `field ${field} format`);
      if (rule.max && value.length > rule.max) failNoEcho("V4", `field ${field} length`);
      if (rule.roster && !rosterLocals.includes(value)) failNoEcho("V4", `field ${field} roster membership`);
      if (rule.enum && !rule.enum.includes(value)) failNoEcho("V4", `field ${field} enum`);
      if (rule.utc && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) failNoEcho("V4", `field ${field} timestamp shape`);
      if (rule.utc) {
        // impossible dates are rejected, not just malformed strings: the
        // components must round-trip through Date.UTC (2026-02-31 etc.)
        // and the year must be plausibly real.
        const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(value);
        const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
        if (!d || Number.isNaN(d.getTime()) || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1
            || d.getUTCDate() !== +m[3] || d.getUTCHours() !== +m[4] || +m[1] < 2020 || +m[1] > 2100) {
          failNoEcho("V4", `field ${field} timestamp`);
        }
      }
    }
  }
  return true;
}

export function buildContent(payload) {
  // Opaque BY REFERENCE, assembled from schema-checked fields only.
  return `bMAIL notice: mailbox=${payload.mailbox} msg_sha256=${payload.msg_sha256} state=${payload.state} size=${payload.size} at=${payload.notified_utc}`;
}

export function buildNativeNotice(keyBytes, { channel, recipient, payload, binding, rosterLocals, kind }) {
  const senderPubkey = getPublicKey(keyBytes);
  const recipientHex = String(recipient || "").toLowerCase();
  validateRoom(channel, senderPubkey, recipientHex);
  validateBinding(binding, payload ? payload.mailbox : null, recipientHex);
  validatePayload(payload, rosterLocals);
  if (kind !== undefined && kind !== NATIVE_KIND) throw new Reject("kind", "caller-supplied kind refused — the native notice kind is fixed");
  const unsigned = {
    kind: NATIVE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["h", String(channel.id)], ["p", recipientHex]],
    content: buildContent(payload),
  };
  return finalizeEvent(unsigned, keyBytes);
}

function die(code, msg) { process.stderr.write(`notify-transport: ${msg}\n`); process.exit(code); }

export function fixtureRoom(relayKey, senderPubkey, recipientHex, { id = "00000000-0000-4000-8000-000000000003", forge = false } = {}) {
  // Test-fixture factory (also used by --selftest): REAL signed 39000/39002
  // events from an EPHEMERAL relay key. `forge` produces the tampered/
  // unsigned variants the regression tests must reject.
  const meta = forge?.metadata
    ? { ...forge.metadata }
    : finalizeEvent({ kind: METADATA_KIND, created_at: 1, tags: [["d", id], ["private", ""], ["hidden", ""], ["t", "dm"]], content: "" }, relayKey);
  const members = forge?.membership
    ? { ...forge.membership }
    : finalizeEvent({ kind: MEMBERSHIP_KIND, created_at: 1, tags: [["d", id], ["p", senderPubkey], ["p", recipientHex]], content: "" }, relayKey);
  return { id, relay_signer: getPublicKey(relayKey), metadata_event: meta, membership_event: members };
}

if (process.argv.includes("--selftest")) {
  const sk = generateSecretKey();
  const rk = generateSecretKey();
  const relay = generateSecretKey();
  const recipient = getPublicKey(rk);
  const channel = fixtureRoom(relay, getPublicKey(sk), recipient);
  const payload = { v: 1, type: "bmail.notify", mailbox: "bzcode", msg_sha256: "ab".repeat(32), size: 10, state: "received", notified_utc: "2026-09-19T00:00:00Z" };
  const binding = { mailbox: "bzcode", recipient, authorized: true, citation: "verified:fixture-receipt" };
  const rosterLocals = ["bclaude", "bfuzz", "bqueenbee", "bzcode", "claude-code", "honeybee"];
  const base = { channel, recipient, rosterLocals };
  const event = buildNativeNotice(sk, { ...base, payload, binding });
  const cases = [
    ["wrong kind", () => buildNativeNotice(sk, { ...base, payload, binding, kind: 1 })],
    ["missing h (bad id)", () => buildNativeNotice(sk, { ...base, channel: { ...channel, id: "not-a-uuid" }, payload, binding })],
    ["unsigned metadata (forged citation)", () => {
      const forged = { ...channel.metadata_event, content: "x" }; // broken signature
      buildNativeNotice(sk, { ...base, channel: { ...channel, metadata_event: forged }, payload, binding });
    }],
    ["wrong relay signer", () => buildNativeNotice(sk, { ...base, channel: { ...channel, relay_signer: getPublicKey(generateSecretKey()) }, payload, binding })],
    ["non-private room", () => {
      const open = fixtureRoom(relay, getPublicKey(sk), recipient);
      const meta = finalizeEvent({ kind: METADATA_KIND, created_at: 1, tags: [["d", channel.id]], content: "" }, relay);
      buildNativeNotice(sk, { ...base, channel: { ...open, metadata_event: meta }, payload, binding });
    }],
    ["json-only privacy claim", () => {
      const open = fixtureRoom(relay, getPublicKey(sk), recipient);
      const meta = finalizeEvent({ kind: METADATA_KIND, created_at: 1, tags: [["d", channel.id]], content: "{\"private\":true,\"hidden\":true,\"t\":\"dm\"}" }, relay);
      buildNativeNotice(sk, { ...base, channel: { ...open, metadata_event: meta }, payload, binding });
    }],
    ["contradictory public tag", () => {
      const open = fixtureRoom(relay, getPublicKey(sk), recipient);
      const meta = finalizeEvent({ kind: METADATA_KIND, created_at: 1, tags: [["d", channel.id], ["private", ""], ["hidden", ""], ["t", "dm"], ["public", ""]], content: "" }, relay);
      buildNativeNotice(sk, { ...base, channel: { ...open, metadata_event: meta }, payload, binding });
    }],
    ["non-dm channel type", () => {
      const open = fixtureRoom(relay, getPublicKey(sk), recipient);
      const meta = finalizeEvent({ kind: METADATA_KIND, created_at: 1, tags: [["d", channel.id], ["private", ""], ["hidden", ""], ["t", "group"]], content: "" }, relay);
      buildNativeNotice(sk, { ...base, channel: { ...open, metadata_event: meta }, payload, binding });
    }],
    ["duplicate privacy flag", () => {
      const open = fixtureRoom(relay, getPublicKey(sk), recipient);
      const meta = finalizeEvent({ kind: METADATA_KIND, created_at: 1, tags: [["d", channel.id], ["private", ""], ["private", ""], ["hidden", ""], ["t", "dm"]], content: "" }, relay);
      buildNativeNotice(sk, { ...base, channel: { ...open, metadata_event: meta }, payload, binding });
    }],
    ["impossible timestamp date", () => buildNativeNotice(sk, { ...base, payload: { ...payload, notified_utc: "2026-02-31T00:00:00Z" }, binding })],
    ["recipient not member", () => {
      const other = getPublicKey(generateSecretKey());
      const room = fixtureRoom(relay, getPublicKey(sk), other);
      buildNativeNotice(sk, { ...base, channel: room, recipient, payload, binding });
    }],
    ["extra participant", () => {
      const room = fixtureRoom(relay, getPublicKey(sk), recipient);
      const wide = finalizeEvent({ kind: MEMBERSHIP_KIND, created_at: 1, tags: [["d", room.id], ["p", getPublicKey(sk)], ["p", recipient], ["p", getPublicKey(generateSecretKey())]], content: "" }, relay);
      buildNativeNotice(sk, { ...base, channel: { ...room, membership_event: wide }, payload, binding });
    }],
    ["binding names a different mailbox", () => buildNativeNotice(sk, { ...base, payload, binding: { ...binding, mailbox: "bclaude" } })],
    ["binding names a different recipient", () => buildNativeNotice(sk, { ...base, payload, binding: { ...binding, recipient: getPublicKey(generateSecretKey()) } })],
    ["binding not authorized", () => buildNativeNotice(sk, { ...base, payload, binding: { ...binding, authorized: false } })],
    ["binding citation not verified", () => buildNativeNotice(sk, { ...base, payload, binding: { ...binding, citation: "unverified" } })],
    ["payload field off-schema value (probe case 2)", () => buildNativeNotice(sk, { ...base, payload: { ...payload, msg_sha256: "SYNTHETIC_PRIVATE_BODY_DO_NOT_FORWARD" }, binding })],
    ["payload mailbox not in roster", () => buildNativeNotice(sk, { ...base, payload: { ...payload, mailbox: "not-a-local" }, binding: { ...binding, mailbox: "not-a-local" } })],
    ["payload state off-enum", () => buildNativeNotice(sk, { ...base, payload: { ...payload, state: "arbitrary" }, binding })],
    ["payload timestamp malformed", () => buildNativeNotice(sk, { ...base, payload: { ...payload, notified_utc: "not-a-time" }, binding })],
    ["payload size out of bounds", () => buildNativeNotice(sk, { ...base, payload: { ...payload, size: -1 }, binding })],
  ];
  let failed = 0;
  for (const [name, fn] of cases) {
    try { fn(); console.error(`  selftest FAIL — ${name} was NOT rejected`); failed += 1; }
    catch (err) { if (!(err instanceof Reject)) { console.error(`  selftest FAIL — ${name} threw non-Reject: ${err}`); failed += 1; } }
  }
  const shapeOk = event.kind === NATIVE_KIND && event.tags.some((t) => t[0] === "h" && t[1] === channel.id)
    && event.tags.some((t) => t[0] === "p" && t[1] === recipient) && verifyEvent(event)
    && event.content.startsWith("bMAIL notice: mailbox=bzcode");
  if (!shapeOk) { console.error("  selftest FAIL — signed event shape/verify"); failed += 1; }
  if (failed) die(4, `selftest: ${failed} case(s) failed`);
  console.log(`notify-transport selftest ok — native kind-9 builder signs+verifies against signed room metadata; ${cases.length} rejection rules bite`);
  process.exit(0);
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  const keyHex = process.env.BUZZ_MAILGATE_KEY;
  if (!keyHex) die(3, "BUZZ_MAILGATE_KEY is not set — the seam is disabled without a provisioned service key");
  let request;
  try { request = JSON.parse(readFileSync(0, "utf8")); } catch { die(3, "stdin is not valid JSON"); }
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) die(3, "BUZZ_MAILGATE_KEY must be 64-hex");
  const keyBytes = Uint8Array.from(keyHex.match(/../g).map((b) => parseInt(b, 16)));
  let event2;
  try { event2 = buildNativeNotice(keyBytes, request); }
  catch (err) { if (err instanceof Reject) die(5, `refused [${err.rule}]`); die(3, "request rejected"); }
  if (!verifyEvent(event2)) die(4, "adapter produced an event that failed its own verification");
  process.stdout.write(JSON.stringify(event2));
}
