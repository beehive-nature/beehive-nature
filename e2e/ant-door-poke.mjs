#!/usr/bin/env node
// Local + Pages poke path for surfaces/ant-door.html
//
// GitHub Pages (skaists.dev) has no Caddy /ant proxy — same-origin
// /ant/v1/... is Pages HTML 404. The live door is relay.skaists.dev
// (CORS grants Origin https://skaists.dev).
//
// This server serves the repo and proxies GET /ant/v1/* to the relay
// so a laptop preview is same-origin, like the box door.
//
//   node e2e/ant-door-poke.mjs              # listen, print URL, stay up
//   node e2e/ant-door-poke.mjs --check      # listen, assert door + page, exit
//
// Pages preview after deploy: https://skaists.dev/surfaces/ant-door.html
// Overrides: ?door=relay  ·  ?door=same
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = process.cwd().replace(/[/\\]e2e$/, "");
const RELAY = "https://relay.skaists.dev";
const ADDR = "711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a"; // PUBLIC-CONSTANT
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

function safePath(urlPath) {
  const rel = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  const full = normalize(join(ROOT, rel));
  if (!full.startsWith(normalize(ROOT))) return null;
  return full;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/ant/v1/")) {
      if (req.method !== "GET") {
        res.writeHead(403, { "content-type": "text/plain" });
        res.end("GET-only");
        return;
      }
      const up = await fetch(RELAY + url.pathname);
      const buf = Buffer.from(await up.arrayBuffer());
      res.writeHead(up.status, {
        "content-type": up.headers.get("content-type") || "application/json",
        "access-control-allow-origin": req.headers.origin || "*",
      });
      res.end(buf);
      return;
    }
    let file = safePath(url.pathname);
    if (!file) {
      res.writeHead(400);
      res.end("bad path");
      return;
    }
    if (url.pathname === "/" || url.pathname === "/surfaces" || url.pathname === "/surfaces/") {
      file = join(ROOT, "surfaces", "ant-door.html");
    }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("nf");
  }
});

const check = process.argv.includes("--check");
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const page = `${base}/surfaces/ant-door.html`;
console.log("POKE local:  " + page);
console.log("POKE same:   " + page + "?door=same");
console.log("POKE relay:  " + page + "?door=relay  (CORS may refuse from 127.0.0.1)");
console.log("POKE Pages:  https://skaists.dev/surfaces/ant-door.html");
console.log("POKE proxy:  " + base + "/ant/v1/data/public/" + ADDR);

if (!check) {
  console.log("listening — Ctrl+C to stop");
} else {
  let failed = 0;
  const ok = (name, cond, note) => {
    if (cond) console.log("PASS " + name);
    else {
      failed++;
      console.log("FAIL " + name + (note ? " — " + note : ""));
    }
  };
  const door = await fetch(base + "/ant/v1/data/public/" + ADDR);
  const json = await door.json();
  ok("proxied door HTTP 200", door.status === 200);
  ok("proxied door JSON envelope", typeof json.data === "string" && json.data.startsWith("/9j/"));
  const html = await (await fetch(page)).text();
  ok("page served", html.includes("the Autonomi door") && html.includes("doorBases"));
  ok("atlas connect fetch", html.includes('fetch(new URL("index.html"'));
  const live = await fetch(RELAY + "/ant/v1/data/public/" + ADDR, {
    headers: { Origin: "https://skaists.dev" },
  });
  ok("live relay 200", live.status === 200);
  ok("live relay CORS", (live.headers.get("access-control-allow-origin") || "") === "https://skaists.dev");
  server.close();
  process.exit(failed ? 1 : 0);
}
