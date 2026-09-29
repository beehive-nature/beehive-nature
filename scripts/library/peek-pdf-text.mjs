#!/usr/bin/env node
// Extract readable text from a PDF's content streams (best-effort, read-only).
// Inflates FlateDecode streams and decodes LZWDecode streams (Distiller 3-era
// PDFs compress with LZW — a Flate-only reader sees "no text" where text
// exists; that gap is how a born-digital hybrid got misread as scan-only),
// then collects text-showing operators (Tj/TJ), plus raw latin1 fallback.
// For verification peeking, not full parsing.
// usage: node peek-pdf-text.mjs <file.pdf> [--max-chars N] [--streams N]
import fs from "node:fs";
import zlib from "node:zlib";

// PDF LZWDecode: 9..12-bit codes, 256=clear, 257=EOD, early-change width
// growth (width increments when the table reaches 2^width - 1 entries).
function lzwDecode(bytes) {
  const out = [];
  let dict = new Map(); let next = 258; let width = 9;
  const reset = () => { dict = new Map(); for (let i = 0; i < 256; i++) dict.set(i, [i]); next = 258; width = 9; };
  reset();
  let bitBuf = 0, bitCnt = 0, pos = 0, prev = null;
  const readCode = () => {
    while (bitCnt < width) {
      if (pos >= bytes.length) return 257;
      bitBuf = (bitBuf << 8) | bytes[pos++]; bitCnt += 8;
    }
    const code = (bitBuf >> (bitCnt - width)) & ((1 << width) - 1);
    bitCnt -= width;
    return code;
  };
  for (;;) {
    const code = readCode();
    if (code === 257) break;
    if (code === 256) { prev = null; reset(); continue; }
    let entry;
    if (dict.has(code)) entry = dict.get(code);
    else if (code === next && prev) entry = [...prev, prev[0]];
    else break; // corrupt
    out.push(...entry);
    if (prev) { dict.set(next++, [...prev, entry[0]]); if (next === (1 << width) - 1 && width < 12) width++; }
    prev = entry;
  }
  return Uint8Array.from(out);
}

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
  // only decode streams declared Flate or LZW (look back at the dict)
  const dictStart = Math.max(0, s - 600);
  const dict = buf.subarray(dictStart, s).toString("latin1");
  if (dict.includes("FlateDecode") || dict.includes("LZWDecode")) {
    try {
      const inf = (dict.includes("FlateDecode") ? zlib.inflateSync(data) : Buffer.from(lzwDecode(data))).toString("latin1");
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
