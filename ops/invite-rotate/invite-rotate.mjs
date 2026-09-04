#!/usr/bin/env node
// invite-rotate.mjs — keep the standing invite alive (ops/invite-rotate)
//
// One run = decide → (maybe) mint → verify → swap join.json → log.
// DRY-RUN mode (ROTATE_DRY_RUN=1) decides and logs, never writes.
// Fail-closed: any unexpected answer stops BEFORE the swap, so the door
// keeps serving the old (still-valid) invite rather than a broken one.
import { finalizeEvent, verifyEvent } from "nostr-tools/pure";
import { readFileSync, writeFileSync, appendFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { request as httpRequest } from "node:http";

// tenant routing rides the Host header; node's fetch (undici) treats Host as
// a forbidden header and silently drops it — so the HTTP layer here is
// node:http, where the header is settable. The URL stays loopback.
function httpCall({ method, url, host, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpRequest({
      method, hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search,
      headers: { host, ...headers },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, text: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const env = process.env;
const CFG = {
  relay: env.ROTATE_RELAY_URL || "http://127.0.0.1:3311",
  host: env.ROTATE_HOST || "rotate-test.local",
  ownerSecret: env.ROTATE_OWNER_NSEC || "",       // hex secret (nsec-unwrap upstream)
  joinJson: env.ROTATE_JOIN_JSON || "/opt/invite-rotate/join.test.json",
  state: env.ROTATE_STATE || "/opt/invite-rotate/state.test.json",
  log: env.ROTATE_LOG || "/opt/invite-rotate/rotate.log.jsonl",
  ttl: parseInt(env.ROTATE_TTL_SECS || "2592000", 10),   // 30d, the relay max
  maxUses: parseInt(env.ROTATE_MAX_USES || "10000", 10), // the relay max
  margin: parseInt(env.ROTATE_MARGIN_SECS || "604800", 10), // rotate 7d early
  dryRun: env.ROTATE_DRY_RUN === "1",
};

const now = () => Math.floor(Date.now() / 1000);
const codePrefix = (c) => (c ? c.slice(0, 12) + "…" : "(none)");

function logLine(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  mkdirSync(dirname(CFG.log), { recursive: true });
  appendFileSync(CFG.log, line + "\n");
  console.log(line);
}

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

// NIP-98: kind 27235, u + method + payload(sha256 of body) tags. A random
// nonce tag rides every event: two identical mints inside one second would
// otherwise hash to the same event id and the relay's replay guard (rightly)
// refuses the second — the nonce makes each auth event unique by construction.
function nip98Auth(secretHex, url, method, bodyBytes) {
  const tags = [
    ["u", url],
    ["method", method],
    ["nonce", randomBytes(8).toString("hex")],
  ];
  if (bodyBytes && bodyBytes.length) {
    tags.push(["payload", createHash("sha256").update(bodyBytes).digest("hex")]);
  }
  const secret = Uint8Array.from(Buffer.from(secretHex, "hex")); // nostr-tools wants bytes
  const event = finalizeEvent({ kind: 27235, created_at: now(), tags, content: "" }, secret);
  if (!verifyEvent(event)) throw new Error("NIP-98 event failed self-verify");
  return "Nostr " + Buffer.from(JSON.stringify(event)).toString("base64");
}

async function mintInvite() {
  const body = Buffer.from(JSON.stringify({ ttl_secs: CFG.ttl, max_uses: CFG.maxUses }));
  const url = `${CFG.relay}/api/invites`;
  // the NIP-98 u tag names the relay's OWN origin (its relay_url — the
  // canonical-origin signing law), while transport rides the loopback URL;
  // ws:// deployments sign under http:// (the relay's own TLS-posture rule)
  const signUrl = `http://${CFG.host}/api/invites`;
  const res = await httpCall({
    method: "POST", url, host: CFG.host,
    headers: { "content-type": "application/json",
               authorization: nip98Auth(CFG.ownerSecret, signUrl, "POST", body) },
    body,
  });
  const json = JSON.parse(res.text || "{}");
  if (res.status !== 200) throw new Error(`mint refused ${res.status}: ${res.text.slice(0, 200)}`);
  if (!json.code || !json.expires_at) throw new Error("mint response missing code/expires_at");
  return json;
}

async function verifyLanding(code) {
  const res = await httpCall({ method: "GET", url: `${CFG.relay}/invite/${code}`, host: CFG.host });
  return res.status === 200; // the door link must answer before any swap
}

function swapJoinJson(code) {
  const join = readJson(CFG.joinJson);
  if (!join) throw new Error(`no join.json at ${CFG.joinJson} to rewrite`);
  const next = { ...join, invite_url: `/invite/${code}`, rotated_at: new Date().toISOString() };
  const tmp = CFG.joinJson + ".tmp";
  writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n");
  renameSync(tmp, CFG.joinJson); // atomic: mv, never in-place (inode law)
  return next;
}

async function main() {
  const state = readJson(CFG.state);
  const join = readJson(CFG.joinJson);
  const t = now();
  const remaining = state?.expires_at ? state.expires_at - t : null;

  const decision = state === null
    ? "bootstrap" // no state: first run mints the first tracked invite
    : remaining !== null && remaining < CFG.margin
      ? `ttl-low (${remaining}s < margin ${CFG.margin}s)`
      : "young"; // nothing to do

  if (decision === "young") {
    logLine({ mode: CFG.dryRun ? "dry-run" : "live", community: CFG.host,
      decision, current: codePrefix(state.code), expires_at: state.expires_at,
      remaining, action: "none" });
    return 0;
  }

  if (CFG.dryRun) {
    logLine({ mode: "dry-run", community: CFG.host, decision,
      current: codePrefix(join?.invite_url?.split("/invite/")[1]),
      action: "WOULD mint + rewrite join.json (dry-run: nothing written)",
      would_mint: { ttl_secs: CFG.ttl, max_uses: CFG.maxUses },
      note: !CFG.ownerSecret
        ? "no owner key held (bClaude admin not granted) — live TTL of the v2 code is unreadable without it; this line is the honest state"
        : undefined });
    return 0;
  }

  if (!CFG.ownerSecret) throw new Error("live rotation requires ROTATE_OWNER_NSEC");

  const invite = await mintInvite();
  if (!(await verifyLanding(invite.code)))
    throw new Error(`fresh invite ${codePrefix(invite.code)} landing page did not answer — refusing to swap`);

  const swapped = swapJoinJson(invite.code);
  writeFileSync(CFG.state, JSON.stringify({
    code: invite.code, expires_at: invite.expires_at,
    max_uses: invite.max_uses, minted_at: new Date().toISOString(),
  }, null, 2) + "\n");

  logLine({ mode: "live", community: CFG.host, decision,
    previous: codePrefix(state?.code), minted: codePrefix(invite.code),
    expires_at: invite.expires_at, max_uses: invite.maxUses,
    join_invite_url: swapped.invite_url, action: "rotated" });
  return 0;
}

main().then((rc) => process.exit(rc)).catch((e) => {
  logLine({ mode: CFG.dryRun ? "dry-run" : "live", community: CFG.host,
    action: "FAILED", error: String(e.message || e) });
  process.exit(1);
});
