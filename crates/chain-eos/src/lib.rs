//! Minimal SHIP (Antelope state-history-plugin) binary codec — Phase 1.
//!
//! Hand-rolled on purpose. The brief named the `eosio` crate, but the
//! Verification Principle check against crates.io showed it is a
//! smart-contract SDK, last published 2020-02, with no SHIP stream support
//! (`eosio-shipper` does not exist on crates.io at all). The SHIP wire
//! format is small and frozen — LEB128 varuints plus fixed-width fields —
//! so Phase 1 decodes exactly what it needs and nothing more:
//!
//! - the `result` variant envelope (`get_status_result_v0`,
//!   `get_blocks_result_v0`)
//! - `block_position { block_num: u32, block_id: checksum256 }`
//! - enough of a packed `signed_block` to count transactions and actions
//!
//! Request encoding (`get_status_request_v0`, `get_blocks_request_v0`) lives
//! here too so it round-trips in tests.

#![forbid(unsafe_code)]

use std::fmt;

use sha2::{Digest, Sha256};

// ---------------------------------------------------------------------------
// errors
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecodeError {
    /// Ran out of bytes at `pos` wanting `wanted` more.
    UnexpectedEof { pos: usize, wanted: usize },
    /// LEB128 varuint exceeded 32 bits.
    VaruintTooLong,
    /// An `optional<T>` presence flag was neither 0 nor 1.
    BadOptionalFlag(u8),
    /// A structure Phase 1 deliberately does not handle (rare/legacy).
    Unsupported(&'static str),
}

impl fmt::Display for DecodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DecodeError::UnexpectedEof { pos, wanted } => {
                write!(
                    f,
                    "unexpected end of input at byte {pos} (wanted {wanted} more)"
                )
            }
            DecodeError::VaruintTooLong => write!(f, "varuint32 overflows 32 bits"),
            DecodeError::BadOptionalFlag(b) => write!(f, "optional presence flag was {b}"),
            DecodeError::Unsupported(what) => write!(f, "unsupported structure: {what}"),
        }
    }
}

impl std::error::Error for DecodeError {}

// ---------------------------------------------------------------------------
// binary reader
// ---------------------------------------------------------------------------

pub struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    pub fn new(buf: &'a [u8]) -> Self {
        Reader { buf, pos: 0 }
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], DecodeError> {
        if self.buf.len() - self.pos < n {
            return Err(DecodeError::UnexpectedEof {
                pos: self.pos,
                wanted: n,
            });
        }
        let s = &self.buf[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }

    pub fn u8(&mut self) -> Result<u8, DecodeError> {
        Ok(self.take(1)?[0])
    }

    pub fn u16_le(&mut self) -> Result<u16, DecodeError> {
        Ok(u16::from_le_bytes(self.take(2)?.try_into().unwrap()))
    }

    pub fn u32_le(&mut self) -> Result<u32, DecodeError> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    pub fn u64_le(&mut self) -> Result<u64, DecodeError> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }

    /// LEB128 unsigned varint, capped at 32 bits (SHIP `varuint32`).
    pub fn varuint32(&mut self) -> Result<u32, DecodeError> {
        let mut result: u64 = 0;
        let mut shift = 0u32;
        loop {
            let b = self.u8()?;
            result |= u64::from(b & 0x7f) << shift;
            if b & 0x80 == 0 {
                break;
            }
            shift += 7;
            if shift >= 35 {
                return Err(DecodeError::VaruintTooLong);
            }
        }
        u32::try_from(result).map_err(|_| DecodeError::VaruintTooLong)
    }

    pub fn checksum256(&mut self) -> Result<[u8; 32], DecodeError> {
        Ok(self.take(32)?.try_into().unwrap())
    }

    /// `bytes` field: varuint32 length prefix + raw bytes.
    pub fn length_prefixed(&mut self) -> Result<&'a [u8], DecodeError> {
        let len = self.varuint32()? as usize;
        self.take(len)
    }

    fn optional<T>(
        &mut self,
        read: impl FnOnce(&mut Self) -> Result<T, DecodeError>,
    ) -> Result<Option<T>, DecodeError> {
        match self.u8()? {
            0 => Ok(None),
            1 => Ok(Some(read(self)?)),
            b => Err(DecodeError::BadOptionalFlag(b)),
        }
    }
}

// ---------------------------------------------------------------------------
// SHIP result types (the subset Phase 1 reads)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockPosition {
    pub block_num: u32,
    pub block_id: [u8; 32],
}

fn block_position(r: &mut Reader) -> Result<BlockPosition, DecodeError> {
    Ok(BlockPosition {
        block_num: r.u32_le()?,
        block_id: r.checksum256()?,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusResult {
    pub head: BlockPosition,
    pub last_irreversible: BlockPosition,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlocksResult {
    pub head: BlockPosition,
    pub last_irreversible: BlockPosition,
    pub this_block: Option<BlockPosition>,
    pub prev_block: Option<BlockPosition>,
    /// Raw packed `signed_block`, present iff the request set `fetch_block`.
    pub block: Option<Vec<u8>>,
    pub traces: Option<Vec<u8>>,
    pub deltas: Option<Vec<u8>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShipResult {
    Status(StatusResult),
    Blocks(BlocksResult),
}

/// Decode one binary SHIP `result` message.
pub fn decode_result(msg: &[u8]) -> Result<ShipResult, DecodeError> {
    let mut r = Reader::new(msg);
    match r.varuint32()? {
        // get_status_result_v0 — head + last_irreversible is all Phase 1
        // needs; trailing fields (trace/chain-state ranges, v1 chain_id)
        // are tolerated and ignored.
        0 => Ok(ShipResult::Status(StatusResult {
            head: block_position(&mut r)?,
            last_irreversible: block_position(&mut r)?,
        })),
        // get_blocks_result_v0
        1 => Ok(ShipResult::Blocks(BlocksResult {
            head: block_position(&mut r)?,
            last_irreversible: block_position(&mut r)?,
            this_block: r.optional(block_position)?,
            prev_block: r.optional(block_position)?,
            block: r.optional(|r| r.length_prefixed().map(<[u8]>::to_vec))?,
            traces: r.optional(|r| r.length_prefixed().map(<[u8]>::to_vec))?,
            deltas: r.optional(|r| r.length_prefixed().map(<[u8]>::to_vec))?,
        })),
        _ => Err(DecodeError::Unsupported("unknown result variant")),
    }
}

// ---------------------------------------------------------------------------
// signed_block summary: transaction + action counts
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockSummary {
    /// Derived from the header's `previous` id (big-endian first 4 bytes + 1)
    /// — cross-checkable against `this_block.block_num`.
    pub block_num_from_header: u32,
    pub transaction_count: u32,
    /// Actions in uncompressed packed transactions. Compressed transactions
    /// and id-only receipts contribute to the counters below instead.
    pub action_count: u32,
    pub compressed_skipped: u32,
    pub id_only_receipts: u32,
}

/// One transaction receipt, positioned for whichever consumer wants it.
enum ReceiptBody<'a> {
    /// Receipt carries only the transaction id — body not in this block.
    IdOnly,
    Packed {
        compression: u8,
        packed_trx: &'a [u8],
    },
}

/// Parse the block header, returning the header-derived block number and a
/// reader positioned at the transaction-receipt count.
fn open_block_body<'a>(block: &'a [u8]) -> Result<(u32, Reader<'a>), DecodeError> {
    let mut r = Reader::new(block);
    let _timestamp = r.u32_le()?;
    let _producer = r.u64_le()?;
    let _confirmed = r.u16_le()?;
    let previous = r.checksum256()?;
    let _transaction_mroot = r.checksum256()?;
    let _action_mroot = r.checksum256()?;
    let _schedule_version = r.u32_le()?;
    if r.u8()? != 0 {
        return Err(DecodeError::Unsupported("legacy new_producers schedule"));
    }
    let ext_count = r.varuint32()?;
    for _ in 0..ext_count {
        let _ext_type = r.u16_le()?;
        r.length_prefixed()?;
    }
    skip_signature(&mut r)?;

    let block_num = u32::from_be_bytes(previous[0..4].try_into().unwrap()).wrapping_add(1);
    Ok((block_num, r))
}

/// transaction_receipt: status, cpu_usage_us, net_usage_words, trx variant.
fn read_receipt<'a>(r: &mut Reader<'a>) -> Result<ReceiptBody<'a>, DecodeError> {
    let _status = r.u8()?;
    let _cpu_usage_us = r.u32_le()?;
    let _net_usage_words = r.varuint32()?;
    match r.varuint32()? {
        0 => {
            r.checksum256()?;
            Ok(ReceiptBody::IdOnly)
        }
        1 => {
            let sig_count = r.varuint32()?;
            for _ in 0..sig_count {
                skip_signature(r)?;
            }
            let compression = r.u8()?;
            r.length_prefixed()?; // packed_context_free_data
            let packed_trx = r.length_prefixed()?;
            Ok(ReceiptBody::Packed {
                compression,
                packed_trx,
            })
        }
        _ => Err(DecodeError::Unsupported("unknown trx variant")),
    }
}

/// Walk a packed `signed_block` far enough to count transactions and (for
/// uncompressed packed transactions) their actions.
pub fn summarize_signed_block(block: &[u8]) -> Result<BlockSummary, DecodeError> {
    let (block_num_from_header, mut r) = open_block_body(block)?;

    let transaction_count = r.varuint32()?;
    let mut action_count = 0u32;
    let mut compressed_skipped = 0u32;
    let mut id_only_receipts = 0u32;

    for _ in 0..transaction_count {
        match read_receipt(&mut r)? {
            ReceiptBody::IdOnly => id_only_receipts += 1,
            ReceiptBody::Packed {
                compression,
                packed_trx,
            } => {
                if compression == 0 {
                    action_count += count_actions(packed_trx)?;
                } else {
                    compressed_skipped += 1;
                }
            }
        }
    }
    // block_extensions may follow; Phase 1 has what it needs.

    Ok(BlockSummary {
        block_num_from_header,
        transaction_count,
        action_count,
        compressed_skipped,
        id_only_receipts,
    })
}

/// Antelope signature: 1-byte type tag + 65 bytes for K1/R1. WA signatures
/// are variable-length and out of Phase 1 scope.
fn skip_signature(r: &mut Reader) -> Result<(), DecodeError> {
    match r.u8()? {
        0 | 1 => {
            r.take(65)?;
            Ok(())
        }
        _ => Err(DecodeError::Unsupported("non-K1/R1 signature")),
    }
}

/// Count `actions` in an unpacked (uncompressed) `transaction`.
fn count_actions(packed_trx: &[u8]) -> Result<u32, DecodeError> {
    let mut r = Reader::new(packed_trx);
    // transaction_header
    let _expiration = r.u32_le()?;
    let _ref_block_num = r.u16_le()?;
    let _ref_block_prefix = r.u32_le()?;
    let _max_net_usage_words = r.varuint32()?;
    let _max_cpu_usage_ms = r.u8()?;
    let _delay_sec = r.varuint32()?;
    // context_free_actions: walk fully to reach `actions`
    let cf_count = r.varuint32()?;
    for _ in 0..cf_count {
        skip_action(&mut r)?;
    }
    r.varuint32() // actions count — Phase 1 needs the number, not the bodies
}

fn skip_action(r: &mut Reader) -> Result<(), DecodeError> {
    let _account = r.u64_le()?;
    let _name = r.u64_le()?;
    let auth_count = r.varuint32()?;
    for _ in 0..auth_count {
        let _actor = r.u64_le()?;
        let _permission = r.u64_le()?;
    }
    r.length_prefixed()?; // data
    Ok(())
}

// ---------------------------------------------------------------------------
// action extraction (§6 stretch: feed the normalizer)
// ---------------------------------------------------------------------------

/// One action lifted out of a block, ready to become the normalizer's
/// `RawChainAction`. `data` is the raw ABI-encoded payload — decoding it to
/// JSON needs the contract ABI, which is deliberately NOT implemented yet
/// (see STATUS: the ABI decoder is the one unglued seam in the pipeline).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractedAction {
    /// Contract account, decoded from its u64 name (e.g. "lovismarket").
    pub account: String,
    /// Action name, decoded from its u64 name (e.g. "addlisting").
    pub name: String,
    /// Transaction id: hex sha256 of the packed transaction.
    pub tx_id: String,
    /// Raw ABI-encoded action data (undecoded).
    pub data: Vec<u8>,
}

/// Extract every action from the uncompressed packed transactions of a
/// `signed_block`. Compressed and id-only receipts are skipped (the summary
/// counters report those); this never guesses at content it cannot read.
pub fn extract_actions(block: &[u8]) -> Result<Vec<ExtractedAction>, DecodeError> {
    let (_block_num, mut r) = open_block_body(block)?;

    let transaction_count = r.varuint32()?;
    let mut out = Vec::new();

    for _ in 0..transaction_count {
        match read_receipt(&mut r)? {
            ReceiptBody::IdOnly => {}
            ReceiptBody::Packed {
                compression,
                packed_trx,
            } => {
                if compression != 0 {
                    continue;
                }
                let tx_id = to_hex(&Sha256::digest(packed_trx));
                collect_actions(packed_trx, &tx_id, &mut out)?;
            }
        }
    }
    Ok(out)
}

/// Like `count_actions`, but reads the action bodies.
fn collect_actions(
    packed_trx: &[u8],
    tx_id: &str,
    out: &mut Vec<ExtractedAction>,
) -> Result<(), DecodeError> {
    let mut r = Reader::new(packed_trx);
    let _expiration = r.u32_le()?;
    let _ref_block_num = r.u16_le()?;
    let _ref_block_prefix = r.u32_le()?;
    let _max_net_usage_words = r.varuint32()?;
    let _max_cpu_usage_ms = r.u8()?;
    let _delay_sec = r.varuint32()?;
    let cf_count = r.varuint32()?;
    for _ in 0..cf_count {
        skip_action(&mut r)?;
    }
    let action_count = r.varuint32()?;
    for _ in 0..action_count {
        let account = r.u64_le()?;
        let name = r.u64_le()?;
        let auth_count = r.varuint32()?;
        for _ in 0..auth_count {
            let _actor = r.u64_le()?;
            let _permission = r.u64_le()?;
        }
        let data = r.length_prefixed()?;
        out.push(ExtractedAction {
            account: u64_to_name(account),
            name: u64_to_name(name),
            tx_id: tx_id.to_string(),
            data: data.to_vec(),
        });
    }
    Ok(())
}

fn to_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

// ---------------------------------------------------------------------------
// EOSIO/Antelope name codec (base32, 12 chars + 4-bit 13th)
// ---------------------------------------------------------------------------

const NAME_CHARMAP: &[u8; 32] = b".12345abcdefghijklmnopqrstuvwxyz";

/// Encode an account/action name to its u64 (None if not a valid name:
/// only `.1-5a-z`, max 13 chars, 13th char restricted to `.1-5a-j`).
pub fn name_to_u64(s: &str) -> Option<u64> {
    let bytes = s.as_bytes();
    if bytes.is_empty() || bytes.len() > 13 {
        return None;
    }
    let mut value: u64 = 0;
    for (i, &b) in bytes.iter().enumerate() {
        let sym = u64::from(char_to_symbol(b)?);
        if i < 12 {
            value |= (sym & 0x1f) << (64 - 5 * (i as u32 + 1));
        } else {
            // 13th character carries only the low 4 bits.
            if sym > 0x0f {
                return None;
            }
            value |= sym;
        }
    }
    Some(value)
}

fn char_to_symbol(b: u8) -> Option<u8> {
    match b {
        b'.' => Some(0),
        b'1'..=b'5' => Some(b - b'1' + 1),
        b'a'..=b'z' => Some(b - b'a' + 6),
        _ => None,
    }
}

/// Decode a u64 name to its canonical string (trailing dots trimmed).
pub fn u64_to_name(value: u64) -> String {
    let mut out = [b'.'; 13];
    let mut v = value;
    for i in 0..13 {
        let (mask, shift) = if i == 0 { (0x0f, 4) } else { (0x1f, 5) };
        out[12 - i] = NAME_CHARMAP[(v & mask) as usize];
        v >>= shift;
    }
    let full = std::str::from_utf8(&out).expect("charmap is ASCII");
    full.trim_end_matches('.').to_string()
}

// ---------------------------------------------------------------------------
// request encoding
// ---------------------------------------------------------------------------

fn put_varuint32(out: &mut Vec<u8>, mut v: u32) {
    loop {
        let mut b = (v & 0x7f) as u8;
        v >>= 7;
        if v != 0 {
            b |= 0x80;
        }
        out.push(b);
        if v == 0 {
            break;
        }
    }
}

/// `["get_status_request_v0", {}]` — request variant 0, no fields.
pub fn encode_get_status_request() -> Vec<u8> {
    vec![0]
}

/// `["get_blocks_request_v0", {...}]` — request variant 1. Streams from
/// `start_block_num` with no end, block bodies fetched, traces/deltas not.
pub fn encode_get_blocks_request(start_block_num: u32) -> Vec<u8> {
    let mut out = Vec::with_capacity(32);
    put_varuint32(&mut out, 1); // variant: get_blocks_request_v0
    out.extend_from_slice(&start_block_num.to_le_bytes());
    out.extend_from_slice(&u32::MAX.to_le_bytes()); // end_block_num: none
    out.extend_from_slice(&u32::MAX.to_le_bytes()); // max_messages_in_flight
    put_varuint32(&mut out, 0); // have_positions: empty
    out.push(0); // irreversible_only: false
    out.push(1); // fetch_block: true
    out.push(0); // fetch_traces: false (Phase 1)
    out.push(0); // fetch_deltas: false (Phase 1)
    out
}

// ---------------------------------------------------------------------------
// stream engine — SHIP handshake + block stream over WebSocket
// ---------------------------------------------------------------------------

/// What the stream emits to its caller as the protocol progresses.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StreamEvent {
    /// The server's opening ABI text frame arrived (size only; Phase 1
    /// does not parse the ABI).
    AbiReceived { bytes: usize },
    /// `get_status_result_v0` answered: this is the head we stream from.
    Head { block_num: u32 },
    /// One `get_blocks_result_v0` with a `this_block`. `block` carries the
    /// raw packed `signed_block` when the server sent it.
    Block {
        block_num: u32,
        block: Option<Vec<u8>>,
    },
}

/// Connect to a SHIP endpoint, perform the handshake, and stream blocks
/// until the server closes.
///
/// `start_block: None` asks the server for its head first (status round
/// trip) and streams from there; `Some(n)` resumes directly from `n` — the
/// checkpoint/watermark path (§6 stretch) — skipping the status request.
///
/// Returns `Ok(())` on a clean server close, `Err` on protocol violations
/// or transport failure. Reconnect/backoff policy belongs to the caller.
pub async fn stream_ship(
    url: &str,
    start_block: Option<u32>,
    mut on_event: impl FnMut(StreamEvent),
) -> Result<(), Box<dyn std::error::Error>> {
    use futures_util::SinkExt;
    use tokio_tungstenite::tungstenite::Message;

    let (mut ws, _response) = tokio_tungstenite::connect_async(url).await?;

    // 1. Server speaks first: the state-history ABI as a text frame.
    match next_message(&mut ws).await? {
        Some(Message::Text(t)) => on_event(StreamEvent::AbiReceived { bytes: t.len() }),
        Some(other) => return Err(format!("expected ABI text frame, got {other:?}").into()),
        None => return Err("connection ended before ABI".into()),
    }

    // 2. Resume from the watermark, or ask the server for its head.
    let start = match start_block {
        Some(n) => n,
        None => {
            ws.send(Message::Binary(encode_get_status_request().into()))
                .await?;
            let head = loop {
                match next_message(&mut ws).await? {
                    Some(Message::Binary(bin)) => match decode_result(&bin)? {
                        ShipResult::Status(s) => break s.head,
                        other => {
                            return Err(format!("expected status result, got {other:?}").into())
                        }
                    },
                    Some(Message::Ping(p)) => ws.send(Message::Pong(p)).await?,
                    Some(Message::Close(_)) | None => return Err("closed during handshake".into()),
                    Some(_) => {}
                }
            };
            head.block_num
        }
    };
    on_event(StreamEvent::Head { block_num: start });

    // 3. Stream blocks from `start` until the server closes.
    ws.send(Message::Binary(encode_get_blocks_request(start).into()))
        .await?;

    loop {
        match next_message(&mut ws).await? {
            Some(Message::Binary(bin)) => {
                let ShipResult::Blocks(b) = decode_result(&bin)? else {
                    continue;
                };
                let Some(this_block) = b.this_block else {
                    continue; // head-only heartbeat
                };
                on_event(StreamEvent::Block {
                    block_num: this_block.block_num,
                    block: b.block,
                });
            }
            Some(Message::Ping(p)) => ws.send(Message::Pong(p)).await?,
            Some(Message::Close(_)) | None => return Ok(()), // clean end
            Some(_) => {}
        }
    }
}

async fn next_message<S>(
    ws: &mut tokio_tungstenite::WebSocketStream<S>,
) -> Result<Option<tokio_tungstenite::tungstenite::Message>, Box<dyn std::error::Error>>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    use futures_util::StreamExt;
    match ws.next().await {
        Some(msg) => Ok(Some(msg?)),
        None => Ok(None),
    }
}

// ---------------------------------------------------------------------------
// blobs — synthetic SHIP blob builders (mirror encoders)
// ---------------------------------------------------------------------------

/// Builders for synthetic SHIP wire blobs. This is the "pre-recorded SHIP
/// blob" toolkit from brief §6: unit tests, the mock WS server integration
/// test, and any future capture tooling all construct protocol-shaped bytes
/// from these instead of each keeping a private mirror encoder.
pub mod blobs {
    use super::{name_to_u64, put_varuint32};

    pub fn put_block_position(out: &mut Vec<u8>, block_num: u32, fill: u8) {
        out.extend_from_slice(&block_num.to_le_bytes());
        out.extend_from_slice(&[fill; 32]);
    }

    pub fn put_bytes_field(out: &mut Vec<u8>, data: &[u8]) {
        put_varuint32(out, data.len() as u32);
        out.extend_from_slice(data);
    }

    /// Well-formed packed `action` (fixed account/name, empty auth + data).
    pub fn put_action(out: &mut Vec<u8>) {
        out.extend_from_slice(&0x1122334455667788u64.to_le_bytes());
        out.extend_from_slice(&0x8877665544332211u64.to_le_bytes());
        put_varuint32(out, 0);
        put_varuint32(out, 0);
    }

    /// Packed action with real (account, name) u64s and given data bytes.
    pub fn put_named_action(out: &mut Vec<u8>, account: &str, name: &str, data: &[u8]) {
        out.extend_from_slice(&name_to_u64(account).expect("valid account").to_le_bytes());
        out.extend_from_slice(&name_to_u64(name).expect("valid name").to_le_bytes());
        put_varuint32(out, 1); // one authorization
        out.extend_from_slice(&name_to_u64("seller").unwrap().to_le_bytes());
        out.extend_from_slice(&name_to_u64("active").unwrap().to_le_bytes());
        put_bytes_field(out, data);
    }

    /// Packed `transaction` with `n_actions` anonymous actions.
    pub fn packed_trx(n_actions: u32) -> Vec<u8> {
        packed_trx_body(n_actions, &[])
    }

    /// Packed `transaction` containing the given named actions.
    pub fn packed_trx_named(actions: &[(&str, &str, &[u8])]) -> Vec<u8> {
        packed_trx_body(0, actions)
    }

    fn packed_trx_body(n_anon: u32, named: &[(&str, &str, &[u8])]) -> Vec<u8> {
        let mut t = Vec::new();
        t.extend_from_slice(&0u32.to_le_bytes()); // expiration
        t.extend_from_slice(&0u16.to_le_bytes()); // ref_block_num
        t.extend_from_slice(&0u32.to_le_bytes()); // ref_block_prefix
        put_varuint32(&mut t, 0); // max_net_usage_words
        t.push(0); // max_cpu_usage_ms
        put_varuint32(&mut t, 0); // delay_sec
        put_varuint32(&mut t, 0); // context_free_actions: none
        put_varuint32(&mut t, n_anon + named.len() as u32);
        for _ in 0..n_anon {
            put_action(&mut t);
        }
        for (account, name, data) in named {
            put_named_action(&mut t, account, name, data);
        }
        put_varuint32(&mut t, 0); // transaction_extensions
        t
    }

    /// Receipt wrapping an arbitrary packed transaction.
    pub fn put_receipt_for(out: &mut Vec<u8>, packed_trx: &[u8], compression: u8) {
        out.push(0); // status: executed
        out.extend_from_slice(&100u32.to_le_bytes()); // cpu_usage_us
        put_varuint32(out, 1); // net_usage_words
        put_varuint32(out, 1); // trx variant: packed_transaction
        put_varuint32(out, 1); // one signature
        out.push(0); // K1
        out.extend_from_slice(&[0u8; 65]);
        out.push(compression);
        put_bytes_field(out, &[]); // packed_context_free_data
        put_bytes_field(out, packed_trx);
    }

    /// Receipt wrapping a packed transaction of `n_actions` anonymous actions.
    pub fn put_packed_receipt(out: &mut Vec<u8>, n_actions: u32, compression: u8) {
        put_receipt_for(out, &packed_trx(n_actions), compression);
    }

    pub fn put_id_only_receipt(out: &mut Vec<u8>) {
        out.push(0);
        out.extend_from_slice(&0u32.to_le_bytes());
        put_varuint32(out, 0);
        put_varuint32(out, 0); // trx variant: transaction_id
        out.extend_from_slice(&[0xAB; 32]);
    }

    /// Packed `signed_block` for block `block_num` containing `receipts`.
    pub fn signed_block(block_num: u32, receipts: &[Vec<u8>]) -> Vec<u8> {
        let mut b = Vec::new();
        b.extend_from_slice(&1000u32.to_le_bytes()); // timestamp
        b.extend_from_slice(&0x5530ea0000000000u64.to_le_bytes()); // producer
        b.extend_from_slice(&0u16.to_le_bytes()); // confirmed
        let mut previous = [0u8; 32];
        previous[0..4].copy_from_slice(&(block_num - 1).to_be_bytes());
        b.extend_from_slice(&previous);
        b.extend_from_slice(&[0u8; 32]); // transaction_mroot
        b.extend_from_slice(&[0u8; 32]); // action_mroot
        b.extend_from_slice(&0u32.to_le_bytes()); // schedule_version
        b.push(0); // new_producers: none
        put_varuint32(&mut b, 0); // header_extensions
        b.push(0); // signature type K1
        b.extend_from_slice(&[0u8; 65]);
        put_varuint32(&mut b, receipts.len() as u32);
        for rcpt in receipts {
            b.extend_from_slice(rcpt);
        }
        put_varuint32(&mut b, 0); // block_extensions
        b
    }

    /// Full binary `get_status_result_v0` message.
    pub fn status_result_blob(head: u32, last_irreversible: u32) -> Vec<u8> {
        let mut m = Vec::new();
        put_varuint32(&mut m, 0); // result variant: get_status_result_v0
        put_block_position(&mut m, head, 0xAA);
        put_block_position(&mut m, last_irreversible, 0xBB);
        m.extend_from_slice(&[0u8; 16]); // trace / chain-state ranges
        m
    }

    /// Full binary `get_blocks_result_v0` message ("pre-recorded SHIP blob").
    pub fn blocks_result_blob(block_num: u32, block: Option<&[u8]>) -> Vec<u8> {
        let mut m = Vec::new();
        put_varuint32(&mut m, 1); // result variant: get_blocks_result_v0
        put_block_position(&mut m, block_num + 10, 0x11); // head
        put_block_position(&mut m, block_num - 1, 0x22); // last_irreversible
        m.push(1);
        put_block_position(&mut m, block_num, 0x33); // this_block
        m.push(1);
        put_block_position(&mut m, block_num - 1, 0x44); // prev_block
        match block {
            Some(bytes) => {
                m.push(1);
                put_bytes_field(&mut m, bytes);
            }
            None => m.push(0),
        }
        m.push(0); // traces: none
        m.push(0); // deltas: none
        m
    }
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::blobs::*;
    use super::*;

    // -- acceptance criterion: blob in, block number out ------------------

    #[test]
    fn blocks_result_blob_yields_block_number() {
        let blob = blocks_result_blob(31_415_926, None);
        match decode_result(&blob).unwrap() {
            ShipResult::Blocks(b) => {
                assert_eq!(b.this_block.unwrap().block_num, 31_415_926);
                assert_eq!(b.head.block_num, 31_415_936);
                assert!(b.block.is_none());
            }
            other => panic!("wrong variant: {other:?}"),
        }
    }

    #[test]
    fn full_block_yields_block_number_and_action_count() {
        let mut receipts = Vec::new();
        let mut r1 = Vec::new();
        put_packed_receipt(&mut r1, 2, 0);
        receipts.push(r1);
        let mut r2 = Vec::new();
        put_packed_receipt(&mut r2, 1, 0);
        receipts.push(r2);

        let block = signed_block(7_000_000, &receipts);
        let blob = blocks_result_blob(7_000_000, Some(&block));

        let ShipResult::Blocks(b) = decode_result(&blob).unwrap() else {
            panic!("wrong variant")
        };
        let summary = summarize_signed_block(&b.block.unwrap()).unwrap();
        assert_eq!(b.this_block.unwrap().block_num, 7_000_000);
        assert_eq!(summary.block_num_from_header, 7_000_000);
        assert_eq!(summary.transaction_count, 2);
        assert_eq!(summary.action_count, 3);
        assert_eq!(summary.compressed_skipped, 0);
        assert_eq!(summary.id_only_receipts, 0);
    }

    #[test]
    fn compressed_and_id_only_receipts_are_counted_not_miscounted() {
        let mut receipts = Vec::new();
        let mut r1 = Vec::new();
        put_packed_receipt(&mut r1, 5, 1); // zlib-compressed: skipped
        receipts.push(r1);
        let mut r2 = Vec::new();
        put_id_only_receipt(&mut r2);
        receipts.push(r2);
        let mut r3 = Vec::new();
        put_packed_receipt(&mut r3, 4, 0);
        receipts.push(r3);

        let block = signed_block(42, &receipts);
        let summary = summarize_signed_block(&block).unwrap();
        assert_eq!(summary.transaction_count, 3);
        assert_eq!(summary.action_count, 4); // only the uncompressed one
        assert_eq!(summary.compressed_skipped, 1);
        assert_eq!(summary.id_only_receipts, 1);
    }

    #[test]
    fn status_result_decodes_head() {
        let mut m = Vec::new();
        put_varuint32(&mut m, 0); // get_status_result_v0
        put_block_position(&mut m, 123_456, 0xAA);
        put_block_position(&mut m, 123_400, 0xBB);
        // trailing v0 fields the decoder tolerates/ignores:
        m.extend_from_slice(&[0u8; 16]);

        let ShipResult::Status(s) = decode_result(&m).unwrap() else {
            panic!("wrong variant")
        };
        assert_eq!(s.head.block_num, 123_456);
        assert_eq!(s.last_irreversible.block_num, 123_400);
    }

    #[test]
    fn truncated_input_errors_cleanly() {
        let blob = blocks_result_blob(1_000, None);
        for cut in [0, 1, 5, 40, blob.len() - 1] {
            let err = decode_result(&blob[..cut]);
            assert!(
                matches!(err, Err(DecodeError::UnexpectedEof { .. })),
                "cut at {cut} gave {err:?}"
            );
        }
    }

    #[test]
    fn bad_optional_flag_is_an_error_not_a_guess() {
        let mut m = Vec::new();
        put_varuint32(&mut m, 1);
        put_block_position(&mut m, 10, 0);
        put_block_position(&mut m, 9, 0);
        m.push(7); // invalid optional flag for this_block
        assert_eq!(decode_result(&m), Err(DecodeError::BadOptionalFlag(7)));
    }

    #[test]
    fn varuint_multibyte_roundtrips() {
        for v in [0u32, 1, 127, 128, 300, 16_383, 16_384, u32::MAX] {
            let mut out = Vec::new();
            put_varuint32(&mut out, v);
            assert_eq!(Reader::new(&out).varuint32().unwrap(), v, "value {v}");
        }
    }

    #[test]
    fn get_blocks_request_encodes_expected_layout() {
        let req = encode_get_blocks_request(500);
        assert_eq!(req[0], 1); // variant
        assert_eq!(&req[1..5], &500u32.to_le_bytes()); // start_block_num
        assert_eq!(&req[5..9], &u32::MAX.to_le_bytes()); // end_block_num
        assert_eq!(&req[9..13], &u32::MAX.to_le_bytes()); // max_in_flight
        assert_eq!(&req[13..], &[0, 0, 1, 0, 0]); // have_positions, flags
        assert_eq!(encode_get_status_request(), vec![0]);
    }

    // -- name codec --------------------------------------------------------

    #[test]
    fn name_codec_matches_known_eosio_vector() {
        assert_eq!(name_to_u64("eosio"), Some(0x5530_EA00_0000_0000));
        assert_eq!(u64_to_name(0x5530_EA00_0000_0000), "eosio");
    }

    #[test]
    fn name_codec_roundtrips() {
        for n in ["eosio", "lovismarket", "eosio.token", "a", "zzzzzzzzzzzzj"] {
            let v = name_to_u64(n).unwrap_or_else(|| panic!("{n} should encode"));
            assert_eq!(u64_to_name(v), n, "roundtrip for {n}");
        }
    }

    #[test]
    fn name_codec_rejects_invalid_names() {
        assert_eq!(name_to_u64(""), None);
        assert_eq!(name_to_u64("EOS"), None); // uppercase
        assert_eq!(name_to_u64("has6digit"), None); // '6' not in charmap
        assert_eq!(name_to_u64("morethanthirteen"), None); // too long
        assert_eq!(name_to_u64("zzzzzzzzzzzzz"), None); // 13th char must be .1-5a-j
    }

    // -- action extraction --------------------------------------------------

    #[test]
    fn extract_actions_yields_named_actions_with_tx_id() {
        let inner = packed_trx_named(&[
            ("lovismarket", "addlisting", &[0xDE, 0xAD, 0xBE, 0xEF]),
            ("eosio.token", "transfer", &[]),
        ]);
        let expected_tx_id = to_hex(&Sha256::digest(&inner));

        // Receipt wrapping that packed transaction, plus noise the extractor
        // must skip: one id-only receipt and one compressed receipt.
        let mut named_receipt = Vec::new();
        put_receipt_for(&mut named_receipt, &inner, 0);

        let mut id_only = Vec::new();
        put_id_only_receipt(&mut id_only);
        let mut compressed = Vec::new();
        put_packed_receipt(&mut compressed, 3, 1);

        let block = signed_block(42, &[id_only, named_receipt, compressed]);
        let actions = extract_actions(&block).unwrap();

        assert_eq!(actions.len(), 2);
        assert_eq!(actions[0].account, "lovismarket");
        assert_eq!(actions[0].name, "addlisting");
        assert_eq!(actions[0].data, vec![0xDE, 0xAD, 0xBE, 0xEF]);
        assert_eq!(actions[0].tx_id, expected_tx_id);
        assert_eq!(actions[1].account, "eosio.token");
        assert_eq!(actions[1].name, "transfer");
        assert_eq!(actions[1].data, Vec::<u8>::new());
        assert_eq!(actions[1].tx_id, expected_tx_id); // same transaction

        // The summary over the same block stays consistent with extraction.
        let summary = summarize_signed_block(&block).unwrap();
        assert_eq!(summary.transaction_count, 3);
        assert_eq!(summary.action_count, 2);
        assert_eq!(summary.compressed_skipped, 1);
        assert_eq!(summary.id_only_receipts, 1);
    }
}
