{- RB04 (scripts/btungsten/README.md section RB): the WB001 intent envelope,
   bT-WB01 version 1, as a Daedalus grammar.

   Written from the wire description, not translated from the BNR decoder it
   is compared with (crates/btungsten-wb001, `decode`): the magic "bT-WB01"
   and version byte 0x01, then ten tag-length-value blocks in ascending tag
   order, each a one-byte tag, a big-endian 32-bit length and that many value
   bytes. Text values are UTF-8 as RFC 3629 section 4 defines UTF8-char, a
   grammar over byte ranges (no surrogates, no overlongs, nothing past
   U+10FFFF). Numbers are big-endian 64-bit words with a length of exactly 8.

   rbench rb04 generates the Rust parser with
     daedalus --path=<pin>/lib compile-rust WB001.ddl --determinize
       --output-file=... --entry=Envelope --entry=Exact
   and derives each TEETH variant from this file by one declared textual
   substitution (lanes/rb04.rs, TEETH). ASCII only: the toolchain rejects
   other source bytes. -}
import Daedalus

-- The envelope as a prefix of the input: the harness reads the consumed
-- length from the input the parser returns.
def Envelope =
  block
    Match "bT-WB01"
    Match [0x01]
    domain      = Text 0x01 1 64
    nonce       = Fixed 0x02 32
    epoch       = Word 0x03
    action      = Fixed 0x04 32
    destination = Text 0x05 1 128
    capability  = Text 0x06 1 64
    amount      = Word 0x07
    expiry      = Word 0x08
    payer       = Text 0x09 1 128
    payload     = Raw 0x0a 0 4096

-- The accepted language: the whole input is exactly one envelope.
def Exact = Only Envelope

-- A block header: the tag, then a length within [lo, hi].
def Header (tag : uint 8) (lo : uint 32) (hi : uint 32) : uint 64 =
  block
    @Match [tag]
    let n = BEUInt32
    Guard (lo <= n && n <= hi)
    ^ n as uint 64

-- UTF-8 text: the value bytes, each of them inside a UTF8-char.
def Text (tag : uint 8) (lo : uint 32) (hi : uint 32) =
  block
    let n = Header tag lo hi
    let v = Many n UInt8
    WithStream (arrayStream v) (Only (Many UTF8Char))
    ^ v

-- Opaque bytes of exactly `size`.
def Fixed (tag : uint 8) (size : uint 32) =
  block
    let n = Header tag size size
    Many n UInt8

-- Opaque bytes, length within [lo, hi].
def Raw (tag : uint 8) (lo : uint 32) (hi : uint 32) =
  block
    let n = Header tag lo hi
    Many n UInt8

-- A big-endian 64-bit word in a block of length 8.
def Word (tag : uint 8) =
  block
    Header tag 8 8
    BEUInt64

-- RFC 3629 section 4, UTF8-char.
def $utf8tail = 0x80 .. 0xBF

def UTF8Char =
  First
    { @$[0x00 .. 0x7F] }
    { @$[0xC2 .. 0xDF]; @$[$utf8tail] }
    { @$[0xE0]; @$[0xA0 .. 0xBF]; @$[$utf8tail] }
    { @$[0xE1 .. 0xEC | 0xEE .. 0xEF]; @$[$utf8tail]; @$[$utf8tail] }
    { @$[0xED]; @$[0x80 .. 0x9F]; @$[$utf8tail] }
    { @$[0xF0]; @$[0x90 .. 0xBF]; @$[$utf8tail]; @$[$utf8tail] }
    { @$[0xF1 .. 0xF3]; @$[$utf8tail]; @$[$utf8tail]; @$[$utf8tail] }
    { @$[0xF4]; @$[0x80 .. 0x8F]; @$[$utf8tail]; @$[$utf8tail] }
