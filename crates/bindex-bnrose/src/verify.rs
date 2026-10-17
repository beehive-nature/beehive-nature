//! The keyless verification ladder: identity recomputation, WB001 binding,
//! state-machine replay through the core, receipt verification under the
//! handed public key, and receipt-versus-replay consistency.

use crate::journal_read::{ServedRecord, ServedRow};
use crate::{event_word, hex};
use bnrose_exec_core::{
    effect_digest, env_sha, op_id, transition, OpState, E_ADMITTED, E_DISPATCH, E_MIGRATION,
    E_STEP_ADMITTED, S_COMPLETED, S_DISPATCHED, S_UNKNOWN,
};
use bnrose_exec_host::receipt::{state_word, Receipt};
use serde_json::{json, Value};
use std::collections::BTreeMap;

/// Which kind of entity an admission record creates.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Kind {
    Root,
    /// The journal's step byte packs `step | attempt << 4`
    /// (`opexec.rs`: `step_entity_attempt`, `step_has_row_among`); the
    /// entity id is `step_op_id(root, encoded)`.
    Step {
        root: [u8; 32],
        step: u8,
        attempt: u8,
        label: String,
    },
}

impl Kind {
    /// The byte the journal carries for a step entity.
    pub fn encoded_step(&self) -> Option<u8> {
        match self {
            Kind::Root => None,
            Kind::Step { step, attempt, .. } => Some(step | (attempt << 4)),
        }
    }
}

/// The admission fields both admission kinds carry
/// (`journal.rs` header; `opexec.rs` recovery parses them identically).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Admission {
    pub kind: Kind,
    pub authority: [u8; 32],
    pub sig: [u8; 64],
    pub policy_digest: [u8; 32],
    pub env: Vec<u8>,
}

type AdmissionFields = ([u8; 32], [u8; 64], [u8; 32], Vec<u8>);

fn admission_fields(bytes: &[u8]) -> Result<AdmissionFields, String> {
    if bytes.len() < 130 {
        return Err("admission record short".into());
    }
    let authority: [u8; 32] = bytes[..32].try_into().unwrap();
    let sig: [u8; 64] = bytes[32..96].try_into().unwrap();
    let policy_digest: [u8; 32] = bytes[96..128].try_into().unwrap();
    let env_len = u16::from_le_bytes([bytes[128], bytes[129]]) as usize;
    if bytes.len() < 130 + env_len {
        return Err("admission record short".into());
    }
    Ok((
        authority,
        sig,
        policy_digest,
        bytes[130..130 + env_len].to_vec(),
    ))
}

/// Parse an admission record, or say why it is not one.
pub fn parse_admission(r: &ServedRecord) -> Result<Option<Admission>, String> {
    match r.event {
        E_ADMITTED => {
            let (authority, sig, policy_digest, env) = admission_fields(&r.payload)?;
            Ok(Some(Admission {
                kind: Kind::Root,
                authority,
                sig,
                policy_digest,
                env,
            }))
        }
        E_STEP_ADMITTED => {
            if r.payload.len() < 34 {
                return Err("step record short".into());
            }
            let root: [u8; 32] = r.payload[..32].try_into().unwrap();
            let encoded = r.payload[32];
            let label_len = r.payload[33] as usize;
            if r.payload.len() < 34 + label_len {
                return Err("step record short".into());
            }
            let label = String::from_utf8_lossy(&r.payload[34..34 + label_len]).into_owned();
            let (authority, sig, policy_digest, env) =
                admission_fields(&r.payload[34 + label_len..])?;
            Ok(Some(Admission {
                kind: Kind::Step {
                    root,
                    step: encoded & 0x0f,
                    attempt: encoded >> 4,
                    label,
                },
                authority,
                sig,
                policy_digest,
                env,
            }))
        }
        _ => Ok(None),
    }
}

/// What the Admitted record's own bytes establish, recomputed here.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Identity {
    /// `op_id(authority, env)` equals the record's `op_id` (root entities);
    /// for a step entity the record's id is `step_op_id(root, step)`
    pub id_recomputed: bool,
    pub env_sha: [u8; 32],
    pub effect_digest: [u8; 32],
    /// `btungsten_wb001::verify_envelope(authority, env, sig)`
    pub binding_verified: bool,
    /// the envelope decoded by the SAW-proven decoder
    pub decoded: bool,
    pub nonce: Option<[u8; 32]>,
    pub domain: Option<String>,
    pub expiry: Option<u64>,
}

pub fn identity(r: &ServedRecord, a: &Admission) -> Identity {
    let expected = match &a.kind {
        Kind::Root => op_id(&a.authority, &a.env),
        Kind::Step { root, .. } => {
            bnrose_exec_core::step_op_id(root, a.kind.encoded_step().unwrap_or(0))
        }
    };
    let es = env_sha(&a.env);
    let (decoded, nonce, domain, expiry) = match btungsten_wb001::decode(&a.env) {
        Ok(i) => (
            true,
            Some(i.nonce),
            Some(String::from_utf8_lossy(&i.domain[..i.domain_len as usize]).into_owned()),
            Some(i.expiry),
        ),
        Err(_) => (false, None, None, None),
    };
    Identity {
        id_recomputed: expected == r.op_id,
        env_sha: es,
        effect_digest: effect_digest(&r.op_id, &es),
        binding_verified: btungsten_wb001::verify_envelope(&a.authority, &a.env, &a.sig),
        decoded,
        nonce,
        domain,
        expiry,
    }
}

/// The state machine, replayed through the one authority with the relaxed
/// clock the supervisor's own recovery uses (`opexec.rs`: clock 0, expiry
/// `u64::MAX` — transitions that already happened must reproduce).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Replay {
    pub state: OpState,
    pub events: Vec<(u64, u8)>,
    /// the first event the core refused to apply, if any
    pub refusal: Option<String>,
    pub dispatched_at_seq: Option<u64>,
}

pub fn replay(records: &[&ServedRecord]) -> Replay {
    let mut st = OpState::ADMITTED_ZERO;
    let mut events = Vec::new();
    let mut refusal = None;
    let mut dispatched_at_seq = None;
    for r in records {
        events.push((r.seq, r.event));
        if r.event == E_ADMITTED || r.event == E_STEP_ADMITTED {
            st.seq = r.seq;
            continue;
        }
        if refusal.is_some() {
            continue;
        }
        match transition(&st, r.event, &r.payload, 0, u64::MAX) {
            Ok(next) => {
                st = next;
                st.seq = r.seq;
                if r.event == E_DISPATCH {
                    dispatched_at_seq = Some(r.seq);
                }
            }
            Err(e) => {
                refusal = Some(format!(
                    "seq {}: {} refused: {}",
                    r.seq,
                    event_word(r.event),
                    e.word()
                ));
            }
        }
    }
    Replay {
        state: st,
        events,
        refusal,
        dispatched_at_seq,
    }
}

/// The receipt, read from `receipts/op-<hex>.json`, verified under the
/// handed public key, and checked against the replay.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReceiptCheck {
    pub present: bool,
    pub parse_error: Option<String>,
    pub verified: bool,
    /// the record at `seq_head - 1` carries the `journal_head` the receipt
    /// names (None when `seq_head` is 0 or past the served records)
    pub head_bound: Option<bool>,
    /// every record of this entity has `seq < seq_head`
    pub covers_entity: bool,
    pub mismatches: Vec<String>,
    pub receipt: Option<Receipt>,
}

pub fn check_receipt(
    receipt_json: Option<&Value>,
    pk: &[u8; 32],
    entity_id: &[u8; 32],
    ident: &Identity,
    rp: &Replay,
    all_records: &[ServedRecord],
) -> ReceiptCheck {
    let Some(v) = receipt_json else {
        return ReceiptCheck {
            present: false,
            parse_error: None,
            verified: false,
            head_bound: None,
            covers_entity: false,
            mismatches: vec![],
            receipt: None,
        };
    };
    let r = match Receipt::from_json(v) {
        Ok(r) => r,
        Err(e) => {
            return ReceiptCheck {
                present: true,
                parse_error: Some(e),
                verified: false,
                head_bound: None,
                covers_entity: false,
                mismatches: vec![],
                receipt: None,
            }
        }
    };
    let verified = r.verify(pk);
    let mut mismatches = Vec::new();
    if r.op != *entity_id {
        mismatches.push(format!(
            "op: receipt {} entity {}",
            hex(&r.op),
            hex(entity_id)
        ));
    }
    if r.env_sha != ident.env_sha {
        mismatches.push("envSha256: receipt differs from the Admitted envelope".into());
    }
    if r.state != rp.state.state {
        mismatches.push(format!(
            "state: receipt {} replay {}",
            state_word(r.state),
            state_word(rp.state.state)
        ));
    }
    if r.recovered != rp.state.recovered {
        mismatches.push(format!(
            "recovered: receipt {} replay {}",
            r.recovered, rp.state.recovered
        ));
    }
    if r.fail != rp.state.fail {
        mismatches.push(format!("fail: receipt {} replay {}", r.fail, rp.state.fail));
    }
    if r.effect != ident.effect_digest {
        mismatches.push("effectDigest: receipt differs from the recomputed effect digest".into());
    }
    if rp.state.bound_effect != [0u8; 32] && rp.state.bound_effect != r.effect {
        mismatches.push("effectDigest: receipt differs from the Dispatch-bound digest".into());
    }
    let last_seq = rp.events.last().map(|(s, _)| *s).unwrap_or(0);
    let covers_entity = r.seq_head > last_seq;
    let head_bound = if r.seq_head == 0 || (r.seq_head as usize) > all_records.len() {
        None
    } else {
        Some(all_records[r.seq_head as usize - 1].served_tag == r.journal_head)
    };
    ReceiptCheck {
        present: true,
        parse_error: None,
        verified,
        head_bound,
        covers_entity,
        mismatches,
        receipt: Some(r),
    }
}

/// Everything the index establishes about one entity, assembled.
#[derive(Clone, Debug)]
pub struct EntityView {
    pub id: [u8; 32],
    pub admission: Admission,
    pub identity: Identity,
    pub replay: Replay,
    pub receipt: ReceiptCheck,
    pub first_seq: u64,
    pub last_seq: u64,
    /// an effect ledger row for this entity was served (tag unverified)
    pub effect_row_served: Option<ServedRow>,
}

impl EntityView {
    /// The attestation verdict: the receipt verifies under the handed key,
    /// agrees with the replay on every bound field, covers the entity, and
    /// names the served head.
    pub fn attested(&self) -> bool {
        self.receipt.verified
            && self.receipt.mismatches.is_empty()
            && self.receipt.covers_entity
            && self.receipt.head_bound == Some(true)
    }

    /// The JSON every query returns for an entity: facts with their classes.
    pub fn to_json(&self) -> Value {
        let (kind, root, step, attempt, label) = match &self.admission.kind {
            Kind::Root => ("root", Value::Null, Value::Null, Value::Null, Value::Null),
            Kind::Step {
                root,
                step,
                attempt,
                label,
            } => (
                "step",
                json!(hex(root)),
                json!(*step),
                json!(*attempt),
                json!(label.clone()),
            ),
        };
        let st = &self.replay.state;
        let dispatched_or_later = matches!(st.state, S_DISPATCHED | S_UNKNOWN | S_COMPLETED)
            || self.replay.dispatched_at_seq.is_some();
        json!({
            "entityId": hex(&self.id),
            "kind": kind,
            "root": root,
            "step": step,
            "attempt": attempt,
            "label": label,
            "authority": hex(&self.admission.authority),
            "policyDigest": hex(&self.admission.policy_digest),
            "identity": {
                "class": "recomputed",
                "idRecomputed": self.identity.id_recomputed,
                "envSha256": hex(&self.identity.env_sha),
                "effectDigest": hex(&self.identity.effect_digest),
                "wb001BindingVerified": self.identity.binding_verified,
                "decoded": self.identity.decoded,
                "nonce": self.identity.nonce.map(|n| hex(&n)),
                "domain": self.identity.domain.clone(),
                "expiry": self.identity.expiry,
            },
            "replay": {
                "class": "recomputed",
                "state": st.state,
                "stateWord": state_word(st.state),
                "recovered": st.recovered == 1,
                "fail": st.fail,
                "boundEffect": if st.bound_effect == [0u8; 32] { Value::Null } else { json!(hex(&st.bound_effect)) },
                "events": self.replay.events.iter().map(|(s, e)| json!({"seq": s, "event": e, "word": event_word(*e)})).collect::<Vec<_>>(),
                "refusal": self.replay.refusal.clone(),
            },
            "receipt": {
                "class": "receipt",
                "present": self.receipt.present,
                "parseError": self.receipt.parse_error.clone(),
                "verifiedUnderReceiptKey": self.receipt.verified,
                "headBound": self.receipt.head_bound,
                "coversEntity": self.receipt.covers_entity,
                "mismatches": self.receipt.mismatches.clone(),
                "journalHead": self.receipt.receipt.as_ref().map(|r| hex(&r.journal_head)),
                "journalSeqHead": self.receipt.receipt.as_ref().map(|r| r.seq_head),
                "completedAt": self.receipt.receipt.as_ref().map(|r| r.completed_at),
            },
            "effectRow": {
                "class": "served",
                "present": self.effect_row_served.is_some(),
                "digestMatches": self.effect_row_served.as_ref().map(|row| row.effect_digest == self.identity.effect_digest && row.env_sha == self.identity.env_sha),
                "wall": self.effect_row_served.as_ref().map(|row| row.wall),
                "tagVerified": false,
            },
            "evidence": {
                "submitted": {"class": "local", "value": true, "from": format!("journal:{}@{}", event_word(self.replay.events.first().map(|(_, e)| *e).unwrap_or(0)), self.first_seq)},
                "observedLocal": {"class": "local", "value": dispatched_or_later, "from": self.replay.dispatched_at_seq.map(|s| format!("journal:dispatch@{s}"))},
                "recovered": {"class": "local", "value": st.recovered == 1},
                "attested": {"class": "receipt", "value": self.attested()},
                "included": Value::Null,
                "executed": Value::Null,
                "final": Value::Null,
                "chainTags": {"class": "served", "verified": false, "why": "HMAC-SHA256 under the supervisor's journal key; not held here by construction"},
            },
            "coverage": {"firstSeq": self.first_seq, "lastSeq": self.last_seq},
        })
    }
}

/// Group served records by entity id, in sequence order, skipping the
/// journal-level migration records the way the owner's recovery does.
pub fn group_by_entity(records: &[ServedRecord]) -> BTreeMap<[u8; 32], Vec<&ServedRecord>> {
    let mut m: BTreeMap<[u8; 32], Vec<&ServedRecord>> = BTreeMap::new();
    for r in records {
        if r.event == E_MIGRATION {
            continue;
        }
        m.entry(r.op_id).or_default().push(r);
    }
    m
}
