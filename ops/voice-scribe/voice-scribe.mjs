#!/usr/bin/env node
// voice-scribe — the estate's speech→text door for the buzz phone room
// (voice lane 2026-09-04). A phone records a voice note; the door
// transcribes it ON THE BOX (whisper.cpp, language pinned per request,
// lv first by the tongue order lv · th · ru · uk) and hands back the
// transcript plus the audio's sha256. THE RAW AUDIO IS DELETED after
// transcription — the message that reaches the room is TEXT carrying the
// digest, never a stored recording.
//
// Auth: NIP-98 (kind 27235), the same shape the relay's invite endpoints
// use. The `u` tag must name the community's CANONICAL origin (the
// canonical-origin signing law: sign the identity, ride the given road),
// the `payload` tag must be the sha256 of the raw audio bytes, and the
// signature must verify. Membership itself stays the relay's law — this
// door only proves possession of a key that can sign, and rate-limits it.
//
// One scribe, one whisper: jobs are serialized (llama.cpp shares this
// box); beyond a short queue the door says it is busy in plain words.

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { verifyEvent } from "nostr-tools/pure";

const BIND = process.env.VOICE_BIND || "172.18.0.1";
const PORT = Number(process.env.VOICE_PORT || 8093);
// The canonical URL the client must sign (community identity, not the road).
const CANONICAL_URL = process.env.VOICE_CANONICAL_URL || "https://skaists.buzz/voice";
// The tongue order is the lane's law: lv · th · ru · uk. First is the default.
const LANGS = (process.env.VOICE_LANGS || "lv,th,ru,uk").split(",").map((s) => s.trim()).filter(Boolean);
const DEFAULT_LANG = LANGS[0] || "lv";
const MODEL = process.env.VOICE_MODEL || "/opt/voice-scribe/whisper.cpp/models/ggml-large-v3-turbo-q5_0.bin";
const WHISPER_CLI = process.env.VOICE_WHISPER_CLI || "/opt/voice-scribe/whisper.cpp/build/bin/whisper-cli";
const FFMPEG = process.env.VOICE_FFMPEG || "ffmpeg";
const FFPROBE = process.env.VOICE_FFPROBE || "ffprobe";
const SPOOL = process.env.VOICE_SPOOL || "/opt/voice-scribe/spool";
const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB of opus is minutes of speech
const MAX_AUDIO_SECS = 120;
const JOB_TIMEOUT_MS = Number(process.env.VOICE_JOB_TIMEOUT_MS || 240_000);
const MAX_QUEUE = 3;

for (const dir of [SPOOL, path.dirname(MODEL)]) fs.mkdirSync(dir, { recursive: true });

function log(line) {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), ...line }) + "\n");
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function run(cmd, args, { timeoutMs = JOB_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("the transcriber took too long and was stopped"));
    }, timeoutMs);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} exited ${code}`));
    });
  });
}

// --- NIP-98 ------------------------------------------------------------
const seenNonces = new Map(); // nonce -> ts (replay guard, single instance)
setInterval(() => {
  const horizon = Date.now() - 15 * 60_000;
  for (const [nonce, ts] of seenNonces) if (ts < horizon) seenNonces.delete(nonce);
}, 60_000).unref();

const rateBuckets = new Map(); // pubkey -> ts[] (10 jobs / 5 min / key)
setInterval(() => rateBuckets.clear(), 5 * 60_000).unref();

function tag(event, name) {
  for (const t of event.tags || []) if (Array.isArray(t) && t[0] === name) return t[1];
  return undefined;
}

/** Validate the NIP-98 header against the raw body. Returns the pubkey or throws plain words. */
function authorize(headerValue, bodyDigest) {
  const match = /^Nostr\s+(.+)$/.exec(headerValue || "");
  if (!match) throw new Error("this door needs a Nostr (NIP-98) Authorization header");
  let event;
  try {
    event = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
  } catch {
    throw new Error("the Authorization header is not a signed event");
  }
  if (event?.kind !== 27235) throw new Error("the auth event must be kind 27235 (NIP-98)");
  if (!verifyEvent(event)) throw new Error("the auth event's signature does not verify");
  const u = tag(event, "u");
  // the declared path carries the trailing slash the reverse-proxy path
  // match needs ("/voice/"); the signed identity is the door itself —
  // accept exactly the canonical URL with or without that slash, nothing else
  if (u !== CANONICAL_URL && u !== `${CANONICAL_URL}/`) {
    throw new Error(`the auth event must sign ${CANONICAL_URL}`);
  }
  if (tag(event, "method") !== "POST") throw new Error("the auth event must sign method POST");
  if (tag(event, "payload") !== bodyDigest) throw new Error("the audio does not match the signed payload digest");
  const age = Math.abs(Math.floor(Date.now() / 1000) - (event.created_at || 0));
  if (age > 600) throw new Error("the auth event is too old — sign again");
  const nonce = tag(event, "nonce");
  if (!nonce) throw new Error("the auth event needs a nonce tag");
  if (seenNonces.has(nonce)) throw new Error("this auth event was already used");
  seenNonces.set(nonce, Date.now());
  const now = Date.now();
  const bucket = (rateBuckets.get(event.pubkey) || []).filter((ts) => now - ts < 5 * 60_000);
  if (bucket.length >= 10) throw new Error("too many voice notes from this key just now — rest a moment");
  bucket.push(now);
  rateBuckets.set(event.pubkey, bucket);
  return event.pubkey;
}

// --- the scribe pipeline ------------------------------------------------
let queueDepth = 0;

async function transcribe(buffer, lang) {
  if (queueDepth >= MAX_QUEUE + 1) throw Object.assign(new Error("the scribe is busy — try again in a moment"), { statusCode: 503 });
  queueDepth += 1;
  const started = Date.now();
  const jobDir = await fsp.mkdtemp(path.join(SPOOL, "job-"));
  try {
    const inFile = path.join(jobDir, "in.bin");
    const wavFile = path.join(jobDir, "in.wav");
    const outBase = path.join(jobDir, "out");
    // 0600 from the first byte: the raw audio exists only in this dir,
    // for the length of one job, and is removed in the finally below.
    const fh = await fsp.open(inFile, "w", 0o600);
    try {
      await fh.write(buffer);
    } finally {
      await fh.close();
    }
    // Chrome's MediaRecorder writes live webm with no container duration
    // (no Cues seek head) — ffprobe on the RAW blob cannot answer. Convert
    // first (cheap, linear), then read the duration from the wav, where it
    // is exact by construction.
    await run(FFMPEG, ["-y", "-loglevel", "error", "-i", inFile, "-ac", "1", "-ar", "16000", wavFile]);
    const dur = await new Promise((resolve, reject) => {
      const child = spawn(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wavFile]);
      let out = "";
      child.stdout.on("data", (c) => (out += c));
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve(Number.parseFloat(out.trim())) : reject(new Error("the audio could not be read"))));
    });
    if (!Number.isFinite(dur)) throw new Error("the audio could not be read");
    if (dur < 0.3) throw new Error("that recording is too short to transcribe");
    if (dur > MAX_AUDIO_SECS) throw new Error(`voice notes are capped at ${MAX_AUDIO_SECS}s on this door`);
    await run(WHISPER_CLI, ["-m", MODEL, "-l", lang, "-f", wavFile, "-oj", "-of", outBase, "-np", "-t", "4"]);
    const report = JSON.parse(await fsp.readFile(`${outBase}.json`, "utf8"));
    const segments = Array.isArray(report?.transcription) ? report.transcription : [];
    const transcript = segments.map((s) => String(s?.text ?? "")).join(" ").replace(/\s+/g, " ").trim();
    if (!transcript) throw new Error("nothing intelligible was heard in that recording");
    return { transcript, ms: Date.now() - started };
  } finally {
    queueDepth -= 1;
    await fsp.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

// --- http ----------------------------------------------------------------
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }
  if (req.method === "GET" && req.url === "/healthz") {
    sendJson(res, 200, { ok: true, model: path.basename(MODEL), langs: LANGS, canonical: CANONICAL_URL, queue: queueDepth });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "the door speaks POST only" });
    return;
  }
  const contentType = String(req.headers["content-type"] || "");
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const chunks = [];
  let bytes = 0;
  let refused = null;
  req.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      refused = { status: 413, error: "that recording is larger than this door accepts" };
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("error", () => {});
  req.on("end", async () => {
    const body = Buffer.concat(chunks);
    try {
      if (refused) throw Object.assign(new Error(refused.error), { statusCode: refused.status });
      const lang = url.searchParams.get("lang") || DEFAULT_LANG;
      if (!LANGS.includes(lang)) throw Object.assign(new Error(`this door transcribes ${LANGS.join(" · ")} — ${lang} is not on the list`), { statusCode: 400 });
      if (!contentType.startsWith("audio/")) throw Object.assign(new Error("the body must be audio (audio/webm, audio/mp4, audio/ogg…)"), { statusCode: 400 });
      if (body.length === 0) throw Object.assign(new Error("no audio arrived"), { statusCode: 400 });
      const digest = sha256Hex(body);
      const pubkey = authorize(req.headers.authorization, digest);
      const { transcript, ms } = await transcribe(body, lang);
      log({ pubkey: pubkey.slice(0, 8), lang, bytes: body.length, ms, digest: digest.slice(0, 12), ok: true });
      sendJson(res, 200, { ok: true, transcript, lang, digest, model: path.basename(MODEL), ms, audio_deleted: true });
    } catch (error) {
      const status = error.statusCode || (String(error.message).includes("busy") ? 503 : 401);
      log({ lang: url.searchParams.get("lang"), bytes: body.length, ok: false, error: error.message });
      sendJson(res, status, { ok: false, error: error.message });
    }
  });
});

server.listen(PORT, BIND, () => {
  log({ listening: `${BIND}:${PORT}`, canonical: CANONICAL_URL, langs: LANGS, model: path.basename(MODEL) });
});
