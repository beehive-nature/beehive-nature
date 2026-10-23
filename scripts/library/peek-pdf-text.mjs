#!/usr/bin/env node
// Extract readable text from a PDF's content streams (best-effort, read-only).
// Inflates FlateDecode streams and collects text-showing operators (Tj/TJ),
// plus raw latin1 fallback. For verification peeking, not full parsing.
// usage: node peek-pdf-text.mjs <file.pdf> [--max-chars N] [--streams N]
import fs from "node:fs";
import zlib from "node:zlib";

const argv = process.argv.slice(2);
const file = argv[0];
const MAX = Number(argv.includes("--max-chars") ? argv[argv.indexOf("--max-chars") + 1] : 3000);
const NS = Number(argv.includes("--streams") ? argv[argv.indexOf("--streams") + 1] : 40);
if (!file) { console.error("usage: peek-pdf-text.mjs <file.pdf>"); process.exit(2); }

const buf = fs.readFileSync(file);
const out = [];
let i = 0, streams = 0;
while (streams < NS) {
  const s = buf.indexOf("stream", i);
  if (s === -1) break;
  const e = buf.indexOf("endstream", s);
  if (e === -1) break;
  let data = buf.subarray(s + 6, e);
  if (data[0] === 13) data = data.subarray(1);
  if (data[0] === 10) data = data.subarray(1);
  // only inflate streams declared Flate (look back at the dict)
  const dictStart = Math.max(0, s - 600);
  const dict = buf.subarray(dictStart, s).toString("latin1");
  if (dict.includes("FlateDecode")) {
    try {
      const inf = zlib.inflateSync(data).toString("latin1");
      // text-showing ops: (string) Tj, [(s1) n (s2)] TJ, and <hex> variants
      const texts = [];
      for (const m of inf.matchAll(/\((?:\\.|[^\\()])*\)/g)) {
        const t = m[0].slice(1, -1).replace(/\\([()\\])/g, "$1").replace(/\\[0-7]{1,3}/g, " ");
        if (t.trim()) texts.push(t);
      }
      for (const m of inf.matchAll(/<([0-9A-Fa-f\s]+)>\s*(?:Tj|TJ|'|")/g)) {
        const hex = m[1].replace(/\s+/g, "");
        if (hex.length % 4 === 0) {
          const b = Buffer.from(hex, "hex");
          const t = (b[0] === 0xfe && b[1] === 0xff) ? b.subarray(2).swap16().toString("utf16le") : b.toString("latin1");
          if (t.trim()) texts.push(t);
        } else if (hex.length % 2 === 0) {
          const t = Buffer.from(hex, "hex").toString("latin1");
          if (/[A-Za-z]{3,}/.test(t)) texts.push(t);
        }
      }
      if (texts.length) out.push(texts.join(" "));
    } catch { /* not a content stream or partial — skip */ }
  }
  i = e + 9;
  streams++;
}
const text = out.join(" ").replace(/\s+/g, " ").slice(0, MAX);
console.log(text);
