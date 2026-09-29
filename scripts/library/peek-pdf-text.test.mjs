// ── peek-pdf-text.test.mjs — LZWDecode content streams are text-visible ────
// Synthetic fixtures ONLY (no corpus bytes in CI). The law under test: a
// Flate-only reader reports "no text" on Distiller-3-era PDFs whose streams
// are LZWDecode — that gap misread a born-digital hybrid as scan-only and
// buried an in-document publication statement. The tool must now decode both.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PEEK = path.join(path.dirname(fileURLToPath(import.meta.url)), "peek-pdf-text.mjs");

// PDF LZW encoder mirroring the decoder (9..12 bits, early change).
function lzwEncode(input) {
  const keyOf = (a) => String.fromCharCode(...a);
  let dict = new Map();
  for (let i = 0; i < 256; i++) dict.set(keyOf([i]), i);
  let next = 258, width = 9;
  const out = [];
  let bitBuf = 0, bitCnt = 0, w = [];
  const emit = (code) => {
    bitBuf = (bitBuf << width) | code; bitCnt += width;
    while (bitCnt >= 8) { out.push((bitBuf >> (bitCnt - 8)) & 0xff); bitCnt -= 8; }
  };
  for (const c of input) {
    const wc = [...w, c];
    if (dict.has(keyOf(wc))) { w = wc; continue; }
    emit(dict.get(keyOf(w)));
    dict.set(keyOf(wc), next++);
    // grow one entry later than the decoder: the encoder's table runs one
    // entry ahead (it adds before emitting the next code, the decoder after
    // reading), so growing at 2^width would desync by one code
    if (next === (1 << width) && width < 12) width++;
    w = [c];
  }
  if (w.length) emit(dict.get(keyOf(w)));
  emit(257);
  if (bitCnt > 0) out.push((bitBuf << (8 - bitCnt)) & 0xff);
  return Uint8Array.from(out);
}

function pdfWith(filter, streamBytes) {
  return Buffer.concat([
    Buffer.from("%PDF-1.1\n1 0 obj\n<< /Length " + streamBytes.length + " /Filter " + filter + " >>\nstream\n", "latin1"),
    Buffer.from(streamBytes),
    Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"),
  ]);
}

const run = (file, ...args) => {
  const p = spawnSync(process.execPath, [PEEK, file, ...args], { encoding: "utf8" });
  return { code: p.status, out: p.stdout };
};

test("LZWDecode content stream text is extracted, incl. past the 511-entry width growth", () => {
  // enough varied content to carry the table past 511 entries (width 9 -> 10)
  let content = "BT\n";
  for (let i = 0; i < 40; i++) content += `(lzw sentence number ${i} carries novel dictionary entries; )Tj\n`;
  content += "ET\n";
  const pdf = pdfWith("/LZWDecode", lzwEncode(Buffer.from(content, "latin1")));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "peek-")), "fixture-lzw.pdf");
  fs.writeFileSync(file, pdf);
  const r = run(file, "--max-chars", "4000");
  assert.equal(r.code, 0);
  assert.match(r.out, /lzw sentence number 0 /);
  assert.match(r.out, /lzw sentence number 39 /, "late-stream text must survive width growth");
});

test("FlateDecode path still extracts (regression)", () => {
  const content = Buffer.from("BT (flate still works)Tj ET", "latin1");
  const pdf = pdfWith("/FlateDecode", zlib.deflateSync(content));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "peek-")), "fixture-flate.pdf");
  fs.writeFileSync(file, pdf);
  const r = run(file);
  assert.equal(r.code, 0);
  assert.match(r.out, /flate still works/);
});

test("no decodable streams yields empty output, not a crash", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "peek-")), "fixture-empty.pdf");
  fs.writeFileSync(file, Buffer.from("%PDF-1.1\n%%EOF\n", "latin1"));
  const r = run(file);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), "");
});
