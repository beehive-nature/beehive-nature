#!/bin/sh
# keyshape.sh - the shared key-shape implementation (WIF_RE + classifier/minter).
# SOURCE OF TRUTH for the base58/bech32 key arms, sourced by BOTH enforcers:
#   scripts/push-preflight.sh  (check 3, ACCOUNTING class, seat-box, push time)
#   scripts/secret-scan.sh     (BLOCK class, pre-commit diff + CI tree backstop)
# The standing law (identity-check.sh header, 2026-08-24): two enforcers of one
# rule share the implementation, never agree by convention. Born 2026-09-20 when
# the second enforcer arrived (bee-laborer ruling: the class must be guarded
# where no seat runs); extracted byte-for-behavior from push-preflight.sh.

# Three shape arms:
#   arm1  uncompressed Bitcoin WIF: 5 + [HJK] + 49 base58 chars = 51
#   arm2  compressed Bitcoin WIF: [KL] + 51 base58 chars        = 52
#   arm3  nostr secret, the estate's own format: literal nsec1 prefix +
#         bech32 (real shape is 58 chars after the prefix; the floor is 50 so
#         near-shape fixtures route through the classifier, not around the arm)
# npub1, the PUBLIC identifier, can never match: arm3 anchors on the nsec1
# prefix and no other arm can start a match at an n.
# The arms are shape-only; keyshape() below separates real key material
# (checksum VALID) from the base64-asset noise class (checksum INVALID).
WIF_RE='\b5[HJK][1-9A-HJ-NP-Za-km-z]{49}\b|\b[KL][1-9A-HJ-NP-Za-km-z]{51}\b|\bnsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{50,}'

# keyshape classify <string> -> "VALID <detail>" | INVALID | ERR
# keyshape mint <unc|cmp|nsec|npub> -> a checksum-minted fixture | ERR
# Fixtures mint from 32x 0x11, a documented non-secret constant: a VALID
# checksum is what makes a fixture exercise the whole gate, and minting at
# runtime keeps the literal out of the repo so no scanner blocks its own
# commit. ERR (node unavailable or broken) must be treated by every caller
# as fail-toward-flagging, never as clean.
keyshape() {
  KEYSHAPE_MODE=$1 KEYSHAPE_ARG=$2 node -e '
    const crypto = require("crypto");
    const sha256 = (b) => crypto.createHash("sha256").update(b).digest();
    const B58A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const BECH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    function b58decode(s) {
      let n = 0n;
      for (const ch of s) { const i = B58A.indexOf(ch); if (i < 0) return null; n = n * 58n + BigInt(i); }
      const out = [];
      while (n > 0n) { out.unshift(Number(n & 0xffn)); n >>= 8n; }
      for (const ch of s) { if (ch === "1") out.unshift(0); else break; }
      return Uint8Array.from(out);
    }
    function b58check(bytes) {
      const c = sha256(sha256(bytes)).subarray(0, 4);
      const full = Buffer.concat([Buffer.from(bytes), c]);
      let n = 0n; for (const b of full) n = (n << 8n) | BigInt(b);
      let s = "";
      while (n > 0n) { s = B58A[Number(n % 58n)] + s; n /= 58n; }
      for (const b of full) { if (b === 0) s = "1" + s; else break; }
      return s;
    }
    const GEN = [0x3b07a, 0x1b, 0x3d0e, 0x2b];
    function polymod(values) {
      let chk = 1;
      for (const value of values) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ value;
        for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
      }
      return chk >>> 0;
    }
    const hrpExpand = (hrp) => [...hrp].map((c) => c.charCodeAt(0) >> 5).concat([0]).concat([...hrp].map((c) => c.charCodeAt(0) & 31));
    function to5bit(bytes) {
      let acc = 0, bits = 0; const out = [];
      for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { out.push((acc >> (bits - 5)) & 31); bits -= 5; } }
      if (bits > 0) out.push((acc << (5 - bits)) & 31);
      return out;
    }
    function bech32Encode(hrp, data5) {
      const values = hrpExpand(hrp).concat(data5).concat([0, 0, 0, 0, 0, 0]);
      const mod = polymod(values) ^ 1;
      const cs = [];
      for (let i = 0; i < 6; i++) cs.push((mod >> (5 * (5 - i))) & 31);
      return hrp + "1" + data5.concat(cs).map((v) => BECH[v]).join("");
    }
    function bech32Verify(s) {
      const pos = s.lastIndexOf("1");
      if (pos < 1 || pos + 7 > s.length) return false;
      const hrp = s.slice(0, pos).toLowerCase();
      const idx = [...s.slice(pos + 1)].map((c) => BECH.indexOf(c));
      if (idx.some((v) => v < 0)) return false;
      return polymod(hrpExpand(hrp).concat(idx)) === 1;
    }
    const mode = process.env.KEYSHAPE_MODE || "";
    const arg = process.env.KEYSHAPE_ARG || "";
    if (mode === "mint") {
      const key = new Uint8Array(32).fill(0x11);
      if (arg === "unc") console.log(b58check(new Uint8Array([0x80, ...key])));
      else if (arg === "cmp") console.log(b58check(new Uint8Array([0x80, ...key, 0x01])));
      else if (arg === "nsec") console.log(bech32Encode("nsec", to5bit(key)));
      else if (arg === "npub") console.log(bech32Encode("npub", to5bit(key)));
      else { console.log("ERR"); process.exit(1); }
    } else if (mode === "classify") {
      if (/^nsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(arg)) {
        console.log(bech32Verify(arg) ? "VALID bech32(nsec)" : "INVALID");
      } else {
        const raw = b58decode(arg);
        const ok = raw && (raw.length === 37 || raw.length === 38) && raw[0] === 0x80 &&
          Buffer.compare(sha256(sha256(raw.subarray(0, raw.length - 4))).subarray(0, 4), raw.subarray(raw.length - 4)) === 0;
        console.log(ok ? "VALID ver=0x80 paylen=" + (raw.length - 4) : "INVALID");
      }
    } else { console.log("ERR"); process.exit(1); }
  ' 2>/dev/null || echo ERR
}
