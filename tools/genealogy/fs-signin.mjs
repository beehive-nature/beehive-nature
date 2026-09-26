#!/usr/bin/env node
// ── fs-signin: one command, one FamilySearch sign-in, every line walked ──────
//   node tools/genealogy/fs-signin.mjs founder=<person id> spouse-1=<person id> …
// Reads the app registration from the PRIVATE store (never the repo):
//   C:/Users/travi/family-lineage/fs-app.json
//   { "appKey": "<FamilySearch app key>", "env": "integration" | "beta" | "production",
//     "redirectUri": "http://127.0.0.1:5173/callback" }
// Opens FamilySearch's own sign-in page; the callback lands on 127.0.0.1 only;
// the token lives in memory for this run and is never written anywhere.
// Each line's walk is written to C:/Users/travi/family-lineage/walks/ in the
// raw-walk shape the pipeline consumes.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { pkcePair, authorizeUrl, tokenRequest, walkAncestry, FS_ACCEPT, FSID } from "./fs-api.mjs";

const STORE = "C:/Users/travi/family-lineage/";
const APP = STORE + "fs-app.json";
if (!existsSync(APP)) {
  console.error(`missing ${APP}: register the app at https://www.familysearch.org/developers and save {"appKey","env","redirectUri"} there`);
  process.exit(1);
}
const app = JSON.parse(readFileSync(APP, "utf8"));
const env = app.env || "integration";
const redirectUri = app.redirectUri || "http://127.0.0.1:5173/callback";
const lines = process.argv.slice(2).map((a) => a.split("=")).filter(([k, id]) => /^(founder|spouse-[1-9]\d*)$/.test(k) && FSID.test(id || ""));
if (!lines.length) { console.error("usage: node fs-signin.mjs founder=<id> spouse-1=<id> …"); process.exit(1); }

const { verifier, challenge } = pkcePair();
const state = randomBytes(16).toString("hex");
const url = authorizeUrl({ env, clientId: app.appKey, redirectUri, state, challenge });
const cb = new URL(redirectUri);

const server = createServer(async (req, res) => {
  const u = new URL(req.url, redirectUri);
  if (u.pathname !== cb.pathname) { res.writeHead(404); return res.end(); }
  if (u.searchParams.get("state") !== state || !u.searchParams.get("code")) { res.writeHead(400); res.end("sign-in refused: state mismatch or no code"); return; }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("Signed in. You can close this tab; the walk is running in the terminal.");
  server.close();
  try {
    const t = tokenRequest({ env, clientId: app.appKey, redirectUri, code: u.searchParams.get("code"), verifier });
    const tr = await fetch(t.url, t.init);
    if (!tr.ok) throw new Error(`token exchange failed: HTTP ${tr.status}`);
    const token = (await tr.json()).access_token;
    const fetchJson = async (api) => {
      const r = await fetch(api, { headers: { authorization: `Bearer ${token}`, accept: FS_ACCEPT } });
      if (r.status === 204) return { persons: [] };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    };
    mkdirSync(STORE + "walks", { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    for (const [key, root] of lines) {
      console.log(`walking ${key} from ${root} …`);
      const walk = await walkAncestry({ fetchJson, env, root,
        onProgress: (p) => process.stdout.write(`\r  ${p.persons} people · ${p.calls} calls · ${p.open} open   `) });
      const out = `${STORE}walks/${key}-${day}.json`;
      writeFileSync(out, JSON.stringify(walk));
      console.log(`\n  saved ${out} · ${Object.keys(walk.persons).length} people · ${walk.meta.errors.length} errors · ${walk.meta.open} open`);
    }
    console.log("ALL LINES DONE");
  } catch (e) { console.error(e.message); process.exitCode = 1; }
});
server.listen(Number(cb.port), cb.hostname, () => {
  console.log("opening FamilySearch sign-in …\n" + url);
  // rundll32 hands the URL to the default browser untouched (cmd.exe would split it at every "&")
  execFile("rundll32.exe", ["url.dll,FileProtocolHandler", url]);
});
