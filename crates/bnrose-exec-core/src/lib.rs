//! BNRoSe L2 execution core — the one authority for admission, the operation
//! state machine, and every digest binding (BNROSE-RUST-001; dispatch
//! `2026-10-12-bnrose-rust-001.md`).
//!
//! The same bytes decide everywhere: the native worker calls [`handle_admit`]
//! and [`handle_step`] directly, and the wasm worker (`bnrose-exec-wasm`,
//! compiled from this crate) answers the identical requests through its
//! exports. Native/Wasm agreement is therefore not a reimplementation to be
//! compared — it is one function, and the paranoid dual-run in the supervisor
//! compares the two backends' answers byte for byte anyway, because a
//! corrupted module must be caught, not assumed away.
//!
//! What this core does NOT do: it holds no keys, no clock, no I/O. Time is an
//! input (`clock`), secrets never arrive here, and every structure is a fixed
//! array so the crate builds `no_std` for wasm32-unknown-unknown with no
//! allocator. The intent it admits is a WB001 envelope, decoded by the
//! SAW-proven `btungsten-wb001-core` decoder — unchanged, so the WB001
//! input-boundary law (ill-formed strings refused, never replaced) holds here
//! with its existing receipts.
//!
//! ## The state machine (the transition authority)
//!
//! ```text
//! Admitted  --Reserve-->            Reserved
//! Admitted  --BoundedFail-->        Failed(code)          (reserve refused its caps)
//! Reserved  --Dispatch-->           Dispatched{effect}    (journaled BEFORE the effect)
//! Reserved  --Response(fail)-->     Failed(code)          (worker failed pre-dispatch)
//! Reserved  --BoundedFail-->        Failed(code)
//! Dispatched --Response(ok)-->      Completed
//! Dispatched --LostResponse-->      Unknown               (a missing response)
//! Dispatched --RecoveryEvidence-->  Completed{recovered}  (the effect ledger's row)
//! Unknown    --RecoveryEvidence-->  Completed{recovered}
//! Unknown    --RecoveryNone-->      Unknown               (audit record; nothing resolved)
//! everything else                  refused (illegal)
//! ```
//!
//! Two laws live in this table. A missing response is a STATE (`Unknown`),
//! never an authorization: no event turns `Unknown` into a fresh dispatch,
//! and a new attempt at the work is a NEW operation through normal admission
//! with a fresh nonce. And `Dispatched` precedes the effect: the digest the
//! dispatch event binds is the only digest the effect ledger will accept for
//! that operation id, so the external effect is a pure function of the
//! committed intent — the WB001 invariant carried into execution.
//!
//! Arithmetic is checked parse everywhere: a malformed request is refused
//! with a code, never a panic (a worker must not be crashable by bytes).

#![no_std]
#![forbid(unsafe_code)]

use btungsten_wb001_core::{
    decode_core, valid_intent, D_LENGTH, D_MAGIC, D_OK, D_SHORT, D_TAG_ORDER, D_TRAILING, D_UTF8,
    D_VERSION,
};
use sha2::{Digest, Sha256};

/// The wire ABI this core speaks. Bumped on any request/verdict layout change.
pub const ABI_VERSION: u32 = 1;

/// The longest WB001 envelope (btungsten-wb001-core's own capacity).
pub const MAX_ENV: usize = btungsten_wb001_core::MAX_ENV;

/// Request and verdict buffer capacities (the shim allocates these once).
pub const MAX_REQUEST: usize = 8192;
pub const MAX_VERDICT: usize = 128;

/// How many domains/capabilities a policy may carry.
pub const POLICY_SLOTS: usize = 4;
const TEXT_CAP: usize = 64;
const POLICY_FIXED: usize = POLICY_SLOTS * (1 + TEXT_CAP) * 2 + 8 + 8 + 4;

/// Reservation ceilings the core itself enforces (the supervisor may be
/// stricter; it may never be more generous than this).
pub const MAX_FUEL: u64 = 1 << 40;
pub const MAX_MEM_PAGES: u32 = 1024;
pub const MAX_WALL_SECS: u32 = 600;

// ---- states, events, refusals ---------------------------------------------

pub const S_ADMITTED: u8 = 1;
pub const S_RESERVED: u8 = 2;
pub const S_DISPATCHED: u8 = 3;
pub const S_COMPLETED: u8 = 4;
pub const S_FAILED: u8 = 5;
pub const S_UNKNOWN: u8 = 6;

/// The journal event that creates an operation (its payload is the
/// admission record: authority, signature, policy digest, envelope). The
/// transition authority never sees this event — creation is the journal's
/// `Admitted` record; every later event goes through [`transition`].
pub const E_ADMITTED: u8 = 0;
pub const E_RESERVE: u8 = 1;
pub const E_DISPATCH: u8 = 2;
pub const E_RESPONSE: u8 = 3;
pub const E_BOUNDED_FAIL: u8 = 4;
pub const E_LOST_RESPONSE: u8 = 5;
pub const E_RECOVERY_EVIDENCE: u8 = 6;
pub const E_RECOVERY_NONE: u8 = 7;

/// Every refusal the core can name. The string is the receipt's word for it.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Refusal {
    DecodeShort,
    DecodeMagic,
    DecodeVersion,
    DecodeTagOrder,
    DecodeLength,
    DecodeUtf8,
    DecodeTrailing,
    EnvOversize,
    InvalidIntent,
    PolicyDomain,
    PolicyCapability,
    PolicyAmount,
    PolicyPayload,
    PolicyExpired,
    PolicyMinLead,
    PolicyEpochFuture,
    ReservationCaps,
    IllegalTransition,
    DispatchExpired,
    DigestMismatch,
    WireTruncated,
    WireOversize,
    WireUnknownKind,
}

impl Refusal {
    pub fn code(self) -> u32 {
        self as u32
    }
    pub fn word(self) -> &'static str {
        match self {
            Refusal::DecodeShort => "decode:short",
            Refusal::DecodeMagic => "decode:magic",
            Refusal::DecodeVersion => "decode:version",
            Refusal::DecodeTagOrder => "decode:tag-order",
            Refusal::DecodeLength => "decode:length",
            Refusal::DecodeUtf8 => "decode:utf8",
            Refusal::DecodeTrailing => "decode:trailing",
            Refusal::EnvOversize => "env:oversize",
            Refusal::InvalidIntent => "intent:invalid",
            Refusal::PolicyDomain => "policy:domain",
            Refusal::PolicyCapability => "policy:capability",
            Refusal::PolicyAmount => "policy:amount",
            Refusal::PolicyPayload => "policy:payload",
            Refusal::PolicyExpired => "policy:expired",
            Refusal::PolicyMinLead => "policy:min-lead",
            Refusal::PolicyEpochFuture => "policy:epoch-future",
            Refusal::ReservationCaps => "reservation:caps",
            Refusal::IllegalTransition => "step:illegal-transition",
            Refusal::DispatchExpired => "step:dispatch-expired",
            Refusal::DigestMismatch => "step:digest-mismatch",
            Refusal::WireTruncated => "wire:truncated",
            Refusal::WireOversize => "wire:oversize",
            Refusal::WireUnknownKind => "wire:unknown-kind",
        }
    }
}

// ---- little-endian helpers (checked; never panic) --------------------------

fn put_u16(o: &mut [u8], v: u16) {
    o[..2].copy_from_slice(&v.to_le_bytes());
}
fn put_u32(o: &mut [u8], v: u32) {
    o[..4].copy_from_slice(&v.to_le_bytes());
}
fn put_u64(o: &mut [u8], v: u64) {
    o[..8].copy_from_slice(&v.to_le_bytes());
}

struct Rd<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> Rd<'a> {
    fn new(b: &'a [u8]) -> Self {
        Rd { b, i: 0 }
    }
    fn take(&mut self, n: usize) -> Result<&'a [u8], Refusal> {
        let end = self.i.checked_add(n).ok_or(Refusal::WireTruncated)?;
        if end > self.b.len() {
            return Err(Refusal::WireTruncated);
        }
        let s = &self.b[self.i..end];
        self.i = end;
        Ok(s)
    }
    fn u8(&mut self) -> Result<u8, Refusal> {
        Ok(self.take(1)?[0])
    }
    fn u16(&mut self) -> Result<u16, Refusal> {
        let s = self.take(2)?;
        Ok(u16::from_le_bytes([s[0], s[1]]))
    }
    fn u32(&mut self) -> Result<u32, Refusal> {
        let s = self.take(4)?;
        Ok(u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
    }
    fn u64(&mut self) -> Result<u64, Refusal> {
        let s = self.take(8)?;
        let mut a = [0u8; 8];
        a.copy_from_slice(s);
        Ok(u64::from_le_bytes(a))
    }
    fn a32(&mut self) -> Result<[u8; 32], Refusal> {
        let s = self.take(32)?;
        let mut a = [0u8; 32];
        a.copy_from_slice(s);
        Ok(a)
    }
    fn rest(&mut self) -> &'a [u8] {
        let s = &self.b[self.i..];
        self.i = self.b.len();
        s
    }
}

// ---- digests: every binding the receipts rely on ---------------------------

fn tagged(tag: &[u8], parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(tag);
    for p in parts {
        h.update(p);
    }
    h.finalize().into()
}

/// The operation identity: the authority and the exact envelope it signed.
pub fn op_id(authority: &[u8; 32], env: &[u8]) -> [u8; 32] {
    tagged(b"bnrose-exec/op-id/1", &[authority, env])
}

/// The envelope's standing hash (the journal and every receipt name this).
pub fn env_sha(env: &[u8]) -> [u8; 32] {
    tagged(b"bnrose-exec/env/1", &[env])
}

/// The one external effect this operation may produce: fully determined by
/// the committed intent. The effect ledger accepts nothing else for this id.
pub fn effect_digest(op: &[u8; 32], env_hash: &[u8; 32]) -> [u8; 32] {
    tagged(b"bnrose-exec/effect/1", &[op, env_hash])
}

/// A journal record's content digest (the receipt binds the head of these).
pub fn record_digest(seq: u64, op: &[u8; 32], event: u8, payload: &[u8]) -> [u8; 32] {
    let mut seqb = [0u8; 8];
    put_u64(&mut seqb, seq);
    tagged(
        b"bnrose-exec/rec/1",
        &[&seqb, op, &[event], payload],
    )
}

/// The policy's own digest (bound into the Admitted record at admission).
pub fn policy_digest(wire_policy: &[u8]) -> [u8; 32] {
    tagged(b"bnrose-exec/policy/1", &[wire_policy])
}

pub const STMT_TAG: &[u8] = b"bnrose-exec/receipt/1";
pub const STMT_LEN: usize =
    STMT_TAG.len() + 32 + 32 + 1 + 1 + 4 + 32 + 32 + 8 + 8;

/// The receipt statement the supervisor signs: everything a verifier needs to
/// know about how one operation ended, in one preimage.
#[allow(clippy::too_many_arguments)]
pub fn receipt_statement(
    op: &[u8; 32],
    env_hash: &[u8; 32],
    state: u8,
    recovered: u8,
    fail: u32,
    effect: &[u8; 32],
    journal_head: &[u8; 32],
    completed_at: u64,
    seq_head: u64,
    out: &mut [u8; STMT_LEN],
) {
    let mut i = 0;
    out[..STMT_TAG.len()].copy_from_slice(STMT_TAG);
    i += STMT_TAG.len();
    out[i..i + 32].copy_from_slice(op);
    i += 32;
    out[i..i + 32].copy_from_slice(env_hash);
    i += 32;
    out[i] = state;
    i += 1;
    out[i] = recovered;
    i += 1;
    put_u32(&mut out[i..], fail);
    i += 4;
    out[i..i + 32].copy_from_slice(effect);
    i += 32;
    out[i..i + 32].copy_from_slice(journal_head);
    i += 32;
    put_u64(&mut out[i..], completed_at);
    i += 8;
    put_u64(&mut out[i..], seq_head);
}

// ---- policy (fixed wire form) ----------------------------------------------

/// Serialize a policy into its fixed wire form (parsed by the worker).
pub fn encode_policy(p: &Policy, out: &mut [u8]) -> usize {
    let mut i = 0;
    for s in p.domains.iter() {
        out[i] = s.1 as u8;
        i += 1;
        out[i..i + TEXT_CAP].copy_from_slice(&s.0);
        i += TEXT_CAP;
    }
    for s in p.capabilities.iter() {
        out[i] = s.1 as u8;
        i += 1;
        out[i..i + TEXT_CAP].copy_from_slice(&s.0);
        i += TEXT_CAP;
    }
    put_u64(&mut out[i..], p.max_amount);
    i += 8;
    put_u64(&mut out[i..], p.min_lead);
    i += 8;
    put_u32(&mut out[i..], p.max_payload);
    i += 4;
    debug_assert_eq!(i, POLICY_FIXED);
    i
}

/// A policy as the core holds it: allowed domains and capabilities (text,
/// compared against the envelope's own bytes), an amount ceiling, a minimum
/// expiry lead, and a payload ceiling.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Policy {
    pub domains: [([u8; TEXT_CAP], u32); POLICY_SLOTS],
    pub capabilities: [([u8; TEXT_CAP], u32); POLICY_SLOTS],
    pub max_amount: u64,
    pub min_lead: u64,
    pub max_payload: u32,
}

impl Policy {
    pub fn wire(&self) -> [u8; POLICY_FIXED] {
        let mut b = [0u8; POLICY_FIXED];
        encode_policy(self, &mut b);
        b
    }
    fn parse(wire: &[u8]) -> Result<Policy, Refusal> {
        if wire.len() != POLICY_FIXED {
            return Err(Refusal::WireTruncated);
        }
        let mut r = Rd::new(wire);
        let mut read_slot = |r: &mut Rd| -> Result<([u8; TEXT_CAP], u32), Refusal> {
            let len = r.u8()? as u32;
            let b = r.take(TEXT_CAP)?;
            let mut a = [0u8; TEXT_CAP];
            a.copy_from_slice(b);
            if len as usize > TEXT_CAP {
                return Err(Refusal::WireTruncated);
            }
            Ok((a, len))
        };
        let mut domains = [([0u8; TEXT_CAP], 0); POLICY_SLOTS];
        for s in domains.iter_mut() {
            *s = read_slot(&mut r)?;
        }
        let mut capabilities = [([0u8; TEXT_CAP], 0); POLICY_SLOTS];
        for s in capabilities.iter_mut() {
            *s = read_slot(&mut r)?;
        }
        Ok(Policy {
            domains,
            capabilities,
            max_amount: r.u64()?,
            min_lead: r.u64()?,
            max_payload: r.u32()?,
        })
    }
}

// ---- the operation state (fixed wire form) ---------------------------------

pub const STATE_BLOB: usize = 46;

/// Where one operation stands. `bound_effect` is the digest fixed at
/// dispatch; it survives into `Unknown` so recovery evidence can be checked
/// against exactly what was dispatched.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct OpState {
    pub state: u8,
    pub recovered: u8,
    pub fail: u32,
    pub bound_effect: [u8; 32],
    pub seq: u64,
}

impl OpState {
    pub const ADMITTED_ZERO: OpState = OpState {
        state: S_ADMITTED,
        recovered: 0,
        fail: 0,
        bound_effect: [0; 32],
        seq: 0,
    };

    pub fn wire(&self) -> [u8; STATE_BLOB] {
        let mut b = [0u8; STATE_BLOB];
        b[0] = self.state;
        b[1] = self.recovered;
        put_u32(&mut b[2..], self.fail);
        b[6..38].copy_from_slice(&self.bound_effect);
        put_u64(&mut b[38..], self.seq);
        b
    }

    pub fn parse(wire: &[u8]) -> Result<OpState, Refusal> {
        if wire.len() != STATE_BLOB {
            return Err(Refusal::WireTruncated);
        }
        Ok(OpState {
            state: wire[0],
            recovered: wire[1],
            fail: u32::from_le_bytes([wire[2], wire[3], wire[4], wire[5]]),
            bound_effect: wire[6..38].try_into().unwrap(),
            seq: u64::from_le_bytes(wire[38..46].try_into().unwrap()),
        })
    }
}

// ---- the transition authority ----------------------------------------------

/// Legal reservations: inside the core's own ceilings.
pub fn reservations_ok(payload: &[u8]) -> bool {
    if payload.len() != 16 {
        return false;
    }
    let fuel = u64::from_le_bytes(payload[..8].try_into().unwrap());
    let mem = u32::from_le_bytes(payload[8..12].try_into().unwrap());
    let secs = u32::from_le_bytes(payload[12..16].try_into().unwrap());
    fuel <= MAX_FUEL && mem <= MAX_MEM_PAGES && secs <= MAX_WALL_SECS
}

/// One event against one state. Returns the next state, or the refusal that
/// names why this event may not touch this operation.
pub fn transition(st: &OpState, event: u8, payload: &[u8], clock: u64, expiry: u64) -> Result<OpState, Refusal> {
    let mut next = *st;
    match (st.state, event) {
        (S_ADMITTED, E_RESERVE) => {
            if !reservations_ok(payload) {
                next.state = S_FAILED;
                next.fail = Refusal::ReservationCaps.code();
            } else {
                next.state = S_RESERVED;
            }
            Ok(next)
        }
        (S_ADMITTED, E_BOUNDED_FAIL) | (S_RESERVED, E_BOUNDED_FAIL) => {
            let code = be_u32(payload);
            next.state = S_FAILED;
            next.fail = code;
            Ok(next)
        }
        (S_RESERVED, E_DISPATCH) => {
            if payload.len() != 32 {
                return Err(Refusal::WireTruncated);
            }
            if clock > expiry {
                next.state = S_FAILED;
                next.fail = Refusal::DispatchExpired.code();
                return Ok(next);
            }
            next.state = S_DISPATCHED;
            next.bound_effect.copy_from_slice(payload);
            Ok(next)
        }
        (S_RESERVED, E_RESPONSE) => {
            // pre-dispatch, the payload's first byte says ok(1) or fail(0)
            match payload.first() {
                Some(1) => Err(Refusal::IllegalTransition), // cannot complete what was never dispatched
                Some(0) => {
                    next.state = S_FAILED;
                    next.fail = be_u32(&payload[1..]);
                    Ok(next)
                }
                _ => Err(Refusal::WireTruncated),
            }
        }
        (S_DISPATCHED, E_RESPONSE) => match payload.first() {
            Some(1) => {
                next.state = S_COMPLETED;
                Ok(next)
            }
            // a failure CLAIM after dispatch is not trusted as terminal: the
            // effect may already be out. It goes through Lost/Recovery.
            _ => Err(Refusal::IllegalTransition),
        },
        (S_DISPATCHED, E_LOST_RESPONSE) => {
            next.state = S_UNKNOWN;
            Ok(next)
        }
        (S_DISPATCHED, E_RECOVERY_EVIDENCE) | (S_UNKNOWN, E_RECOVERY_EVIDENCE) => {
            if payload.len() != 32 || payload != st.bound_effect {
                return Err(Refusal::DigestMismatch);
            }
            next.state = S_COMPLETED;
            next.recovered = 1;
            Ok(next)
        }
        (S_UNKNOWN, E_RECOVERY_NONE) => Ok(next), // audit record; nothing resolved
        _ => Err(Refusal::IllegalTransition),
    }
}

fn be_u32(b: &[u8]) -> u32 {
    if b.len() < 4 {
        return Refusal::WireTruncated.code();
    }
    u32::from_le_bytes([b[0], b[1], b[2], b[3]])
}

// ---- request handling (the exports the shim marshals) ----------------------

pub const K_ADMIT: u8 = 1;
pub const K_STEP: u8 = 2;

/// Admit-request wire:
/// `[version u8][kind u8][clock u64][authority 32][policy 540][env_len u16][env]`
///
/// Verdict wire: `1 [op_id 32][env_sha 32][effect 32]` or `2 [refusal u32]`.
pub fn handle_admit(req: &[u8], out: &mut [u8]) -> Result<usize, Refusal> {
    if req.len() > MAX_REQUEST {
        return Err(Refusal::WireOversize);
    }
    let mut r = Rd::new(req);
    if r.u8()? != 1 {
        return Err(Refusal::WireUnknownKind);
    }
    if r.u8()? != K_ADMIT {
        return Err(Refusal::WireUnknownKind);
    }
    let clock = r.u64()?;
    let authority = r.a32()?;
    let policy = Policy::parse(r.take(POLICY_FIXED)?)?;
    let env_len = r.u16()? as usize;
    let env = r.take(env_len)?;
    if !r.rest().is_empty() {
        return Err(Refusal::WireOversize);
    }
    admit(&authority, env, &policy, clock, out)
}

/// Step-request wire:
/// `[version u8][kind u8][op_id 32][env_sha 32][state 46][event u8]
///  [clock u64][expiry u64][payload_len u16][payload]`
///
/// Verdict wire: `1 [new state 46]` or `2 [refusal u32]`.
pub fn handle_step(req: &[u8], out: &mut [u8]) -> Result<usize, Refusal> {
    if req.len() > MAX_REQUEST {
        return Err(Refusal::WireOversize);
    }
    let mut r = Rd::new(req);
    if r.u8()? != 1 || r.u8()? != K_STEP {
        return Err(Refusal::WireUnknownKind);
    }
    let _op = r.a32()?;
    let _env_hash = r.a32()?;
    let st = OpState::parse(r.take(STATE_BLOB)?)?;
    let event = r.u8()?;
    let clock = r.u64()?;
    let expiry = r.u64()?;
    let plen = r.u16()? as usize;
    let payload = r.take(plen)?;
    if !r.rest().is_empty() {
        return Err(Refusal::WireOversize);
    }
    let next = transition(&st, event, payload, clock, expiry)?;
    Ok(put_step_verdict(&next, out))
}

fn put_refusal(out: &mut [u8], rf: Refusal) -> usize {
    out[0] = 2;
    put_u32(&mut out[1..], rf.code());
    5
}

/// Encode a wire-level refusal as its verdict form (the ABI surface never
/// panics and never fails to answer).
pub fn refusal_verdict(rf: Refusal, out: &mut [u8]) -> usize {
    put_refusal(out, rf)
}

fn put_step_verdict(next: &OpState, out: &mut [u8]) -> usize {
    out[0] = 1;
    out[1..1 + STATE_BLOB].copy_from_slice(&next.wire());
    1 + STATE_BLOB
}

/// The admission decision. Every check is named; every refusal is a verdict,
/// not an exception.
pub fn admit(
    authority: &[u8; 32],
    env: &[u8],
    policy: &Policy,
    clock: u64,
    out: &mut [u8],
) -> Result<usize, Refusal> {
    let refused = |rf: Refusal, out: &mut [u8]| Ok::<usize, Refusal>(put_refusal(out, rf));
    if env.len() > MAX_ENV {
        return refused(Refusal::EnvOversize, out);
    }
    // strict decode through the SAW-proven decoder, zero-filled past the end
    let mut buf = [0u8; MAX_ENV];
    buf[..env.len()].copy_from_slice(env);
    let mut intent = btungsten_wb001_core::Intent::ZERO;
    let verdict = decode_core(&buf, env.len() as u64, &mut intent);
    let rf = match verdict {
        D_OK => None,
        D_SHORT => Some(Refusal::DecodeShort),
        D_MAGIC => Some(Refusal::DecodeMagic),
        D_VERSION => Some(Refusal::DecodeVersion),
        D_TAG_ORDER => Some(Refusal::DecodeTagOrder),
        D_LENGTH => Some(Refusal::DecodeLength),
        D_UTF8 => Some(Refusal::DecodeUtf8),
        D_TRAILING => Some(Refusal::DecodeTrailing),
        _ => return refused(Refusal::InvalidIntent, out),
    };
    if let Some(rf) = rf {
        return refused(rf, out);
    }
    if !valid_intent(&intent) {
        return refused(Refusal::InvalidIntent, out);
    }
    // clock laws (u64 seconds; the WB004 specimen's u32 horizon is a boundary
    // this representation does not share, and the battery tests the crossing)
    if clock > intent.expiry {
        return refused(Refusal::PolicyExpired, out);
    }
    if intent.expiry < clock.saturating_add(policy.min_lead) {
        return refused(Refusal::PolicyMinLead, out);
    }
    if intent.epoch > clock {
        return refused(Refusal::PolicyEpochFuture, out);
    }
    // scope laws: the envelope's own bytes against the policy's slots
    let d = &intent.domain[..intent.domain_len as usize];
    if !policy
        .domains
        .iter()
        .any(|(s, l)| &s[..*l as usize] == d)
    {
        return refused(Refusal::PolicyDomain, out);
    }
    let c = &intent.capability[..intent.capability_len as usize];
    if !policy
        .capabilities
        .iter()
        .any(|(s, l)| &s[..*l as usize] == c)
    {
        return refused(Refusal::PolicyCapability, out);
    }
    if intent.amount > policy.max_amount {
        return refused(Refusal::PolicyAmount, out);
    }
    if intent.payload_len > policy.max_payload {
        return refused(Refusal::PolicyPayload, out);
    }
    // the binding triple every later record and receipt names
    let op = op_id(authority, env);
    let hash = env_sha(env);
    let effect = effect_digest(&op, &hash);
    out[0] = 1;
    out[1..33].copy_from_slice(&op);
    out[33..65].copy_from_slice(&hash);
    out[65..97].copy_from_slice(&effect);
    Ok(97)
}

#[cfg(test)]
mod tests {
    extern crate alloc;
    use alloc::vec::Vec;
    use super::*;

    fn domain_policy() -> Policy {
        let slot = |s: &str| {
            let mut a = [0u8; TEXT_CAP];
            a[..s.len()].copy_from_slice(s.as_bytes());
            (a, s.len() as u32)
        };
        Policy {
            domains: [slot("test/bnrose"), slot(""), slot(""), slot("")],
            capabilities: [slot("test/exec"), slot(""), slot(""), slot("")],
            max_amount: 1_000_000,
            min_lead: 10,
            max_payload: 4096,
        }
    }

    // a minimal strict-decodable envelope is built with the real builder in
    // the host crate's battery; here the state machine and digests are the
    // subject, so decode refusals use hand-mangled prefixes.
    #[test]
    fn empty_and_short_envelopes_refuse_named_codes() {
        let mut out = [0u8; MAX_VERDICT];
        let p = domain_policy();
        let n = admit(&[9; 32], b"", &p, 1_000, &mut out).unwrap();
        assert_eq!(&out[..n], &[2u8, 0, 0, 0, 0][..], "short");
        let n = admit(&[9; 32], &[0u8; 3], &p, 1_000, &mut out).unwrap();
        assert_eq!(&out[..n], &[2u8, 0, 0, 0, 0][..], "still short");
        let mut magic = alloc::vec![0u8; 40];
        magic[..8].copy_from_slice(&b"bT-WB99\x01"[..]);
        let n = admit(&[9; 32], &magic, &p, 1_000, &mut out).unwrap();
        assert_eq!(&out[..n], &[2u8, 1, 0, 0, 0][..], "bad magic");
    }

    #[test]
    fn oversize_envelope_refuses_before_decode() {
        let mut out = [0u8; MAX_VERDICT];
        let p = domain_policy();
        let n = admit(&[9; 32], &[0u8; MAX_ENV + 1], &p, 1_000, &mut out)
            .unwrap();
        assert_eq!(&out[..n], &[2u8, 7, 0, 0, 0][..]);
    }

    fn st(state: u8) -> OpState {
        OpState {
            state,
            recovered: 0,
            fail: 0,
            bound_effect: [7; 32],
            seq: 4,
        }
    }

    #[test]
    fn the_legal_table_is_exactly_the_documented_one() {
        let res = {
            let mut b = [0u8; 16];
            put_u64(&mut b, 1000);
            put_u32(&mut b[8..], 64);
            put_u32(&mut b[12..], 30);
            b
        };
        // the happy path
        assert_eq!(transition(&st(S_ADMITTED), E_RESERVE, &res, 0, u64::MAX).unwrap().state, S_RESERVED);
        assert_eq!(
            transition(&st(S_RESERVED), E_DISPATCH, &[7; 32], 0, u64::MAX)
                .unwrap()
                .state,
            S_DISPATCHED
        );
        assert_eq!(
            transition(&st(S_DISPATCHED), E_RESPONSE, &[1], 0, u64::MAX)
                .unwrap()
                .state,
            S_COMPLETED
        );
        // the lost-response family
        assert_eq!(
            transition(&st(S_DISPATCHED), E_LOST_RESPONSE, &[], 0, u64::MAX)
                .unwrap()
                .state,
            S_UNKNOWN
        );
        let done = transition(&st(S_UNKNOWN), E_RECOVERY_EVIDENCE, &[7; 32], 0, u64::MAX)
            .unwrap();
        assert_eq!((done.state, done.recovered), (S_COMPLETED, 1));
        // evidence must be the digest dispatch bound
        assert_eq!(
            transition(&st(S_UNKNOWN), E_RECOVERY_EVIDENCE, &[8; 32], 0, u64::MAX),
            Err(Refusal::DigestMismatch)
        );
        // pre-dispatch failure paths
        assert_eq!(
            transition(&st(S_RESERVED), E_RESPONSE, &[0, 9, 0, 0, 0], 0, u64::MAX)
                .unwrap()
                .state,
            S_FAILED
        );
        assert_eq!(
            transition(&st(S_RESERVED), E_BOUNDED_FAIL, &[9, 0, 0, 0], 0, u64::MAX)
                .unwrap()
                .state,
            S_FAILED
        );
        // over-cap reservations fail closed at reserve time
        let mut wild = res;
        put_u64(&mut wild, MAX_FUEL + 1);
        let next = transition(&st(S_ADMITTED), E_RESERVE, &wild, 0, u64::MAX).unwrap();
        assert_eq!((next.state, next.fail), (S_FAILED, Refusal::ReservationCaps.code()));
        // dispatch past expiry is a terminal failure, not a dispatch
        let next = transition(&st(S_RESERVED), E_DISPATCH, &[7; 32], 500, 499).unwrap();
        assert_eq!((next.state, next.fail), (S_FAILED, Refusal::DispatchExpired.code()));
    }

    #[test]
    fn the_illegal_table_refuses_every_skip_and_resurrection() {
        let res = [0u8; 16];
        // no skipping the journal's order
        assert_eq!(
            transition(&st(S_ADMITTED), E_DISPATCH, &[7; 32], 0, u64::MAX),
            Err(Refusal::IllegalTransition)
        );
        assert_eq!(
            transition(&st(S_ADMITTED), E_RESPONSE, &[1], 0, u64::MAX),
            Err(Refusal::IllegalTransition)
        );
        // cannot complete what was never dispatched
        assert_eq!(
            transition(&st(S_RESERVED), E_RESPONSE, &[1], 0, u64::MAX),
            Err(Refusal::IllegalTransition)
        );
        // a failure claim after dispatch is not a terminal: the effect may be out
        assert_eq!(
            transition(&st(S_DISPATCHED), E_RESPONSE, &[0, 1, 0, 0, 0], 0, u64::MAX),
            Err(Refusal::IllegalTransition)
        );
        // no resurrecting terminals, no touching an unknown into dispatch
        for s in [S_COMPLETED, S_FAILED] {
            for e in [E_RESERVE, E_DISPATCH, E_RESPONSE, E_LOST_RESPONSE] {
                assert_eq!(
                    transition(&st(s), e, &res, 0, u64::MAX),
                    Err(Refusal::IllegalTransition)
                );
            }
        }
        assert_eq!(
            transition(&st(S_UNKNOWN), E_DISPATCH, &[7; 32], 0, u64::MAX),
            Err(Refusal::IllegalTransition)
        );
        assert_eq!(
            transition(&st(S_UNKNOWN), E_LOST_RESPONSE, &[], 0, u64::MAX),
            Err(Refusal::IllegalTransition)
        );
        // unknown events refuse
        assert_eq!(
            transition(&st(S_RESERVED), 99, &[], 0, u64::MAX),
            Err(Refusal::IllegalTransition)
        );
    }

    #[test]
    fn state_blob_round_trips_and_digests_bind_inputs() {
        let s = st(S_UNKNOWN);
        assert_eq!(OpState::parse(&s.wire()).unwrap(), s);
        let a = op_id(&[1; 32], b"env-a");
        let b = op_id(&[2; 32], b"env-a");
        let c = op_id(&[1; 32], b"env-b");
        assert_ne!(a, b);
        assert_ne!(a, c);
        assert_ne!(env_sha(b"env-a"), env_sha(b"env-b"));
        assert_ne!(
            effect_digest(&a, &env_sha(b"env-a")),
            effect_digest(&a, &env_sha(b"env-b"))
        );
        let mut stmt = [0u8; STMT_LEN];
        receipt_statement(&a, &env_sha(b"x"), S_COMPLETED, 1, 0, &[7; 32], &[8; 32], 5, 9, &mut stmt);
        assert_eq!(stmt[..STMT_TAG.len()], *STMT_TAG);
    }

    #[test]
    fn policy_wire_round_trips() {
        let p = domain_policy();
        let w = p.wire();
        assert_eq!(Policy::parse(&w).unwrap(), p);
        assert!(Policy::parse(&w[..w.len() - 1]).is_err());
    }

    #[test]
    fn truncated_requests_refuse_never_panic() {
        let mut out = [0u8; MAX_VERDICT];
        let full: Vec<u8> = [alloc::vec![1u8, K_STEP], alloc::vec![0x41; 32], alloc::vec![0x42; 32], st(S_RESERVED).wire().to_vec(), alloc::vec![E_DISPATCH], alloc::vec![0u8; 8], alloc::vec![0xff; 8], alloc::vec![32, 0], alloc::vec![7; 32]].concat();
        let n = handle_step(&full, &mut out).unwrap();
        assert_eq!(out[0], 1);
        for cut in [1usize, 5, 40, 80, 90, full.len() - 1] {
            assert_eq!(
                handle_step(&full[..cut], &mut out),
                Err(Refusal::WireTruncated),
                "cut at {cut}"
            );
        }
        // trailing junk refuses
        let mut junk = full.clone();
        junk.push(0);
        assert_eq!(handle_step(&junk, &mut out), Err(Refusal::WireOversize));
        // unknown kind refuses
        let mut kind = full.clone();
        kind[1] = 9;
        assert_eq!(handle_step(&kind, &mut out), Err(Refusal::WireUnknownKind));
    }
}
