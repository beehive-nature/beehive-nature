//! One ingest: read the replica set, decide agreement, verify every entity,
//! write the sealed store in one transaction, record the ingest itself.
//! Idempotent on the same bytes; a changed prefix is a fork and refuses.

use crate::journal_read::{index_head, read_ledger, read_replicas, Agreement, ServedRecord};
use crate::store::Store;
use crate::verify::{
    check_receipt, group_by_entity, identity, parse_admission, replay, EntityView,
};
use crate::{event_word, hex, now_unix, Error};
use rusqlite::params;
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Clone, Debug, Default)]
pub struct IngestOptions {
    /// without this, one unreadable replica refuses the ingest (the
    /// `--allow-single-source` discipline of bindexer)
    pub allow_single_replica: bool,
}

/// One replica as read: path, byte length, outcome word.
pub type ReplicaSummary = (String, Option<u64>, String);

#[derive(Clone, Debug)]
pub struct IngestReport {
    pub covered_through_seq: u64,
    pub index_head: [u8; 32],
    pub agreement: String,
    pub single_replica: bool,
    pub entities: u64,
    pub receipts_present: u64,
    pub receipts_verified: u64,
    pub entities_attested: u64,
    pub effect_rows: u64,
    pub ledger_note: Option<String>,
    pub replicas: Vec<ReplicaSummary>,
}

fn read_receipts(state_dir: &Path) -> BTreeMap<[u8; 32], Value> {
    let mut m = BTreeMap::new();
    let Ok(rd) = std::fs::read_dir(state_dir.join("receipts")) else {
        return m;
    };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        let Some(h) = name
            .strip_prefix("op-")
            .and_then(|s| s.strip_suffix(".json"))
        else {
            continue;
        };
        let Ok(id) = crate::unhex32(h) else { continue };
        if let Ok(text) = std::fs::read_to_string(e.path()) {
            if let Ok(v) = serde_json::from_str::<Value>(&text) {
                m.insert(id, v);
            }
        }
    }
    m
}

/// Ingest `state_dir` into `store` under the handed receipt public key.
pub fn ingest(
    store: &mut Store,
    state_dir: &Path,
    receipt_pk: &[u8; 32],
    opts: &IngestOptions,
) -> Result<IngestReport, Error> {
    let at = now_unix();
    let (reads, agreement) = read_replicas(state_dir);
    let replicas: Vec<ReplicaSummary> = reads
        .iter()
        .map(|r| {
            (
                r.path.display().to_string(),
                r.bytes_len,
                match &r.result {
                    Ok(v) => format!("ok:{}", v.len()),
                    Err(e) => format!("unreadable:{e}"),
                },
            )
        })
        .collect();

    let (records, single_replica): (Vec<ServedRecord>, bool) = match &agreement {
        Agreement::NoneReadable => {
            record_ingest(
                store,
                at,
                0,
                &[0u8; 32],
                &agreement.word(),
                false,
                "refused:none-readable",
            )?;
            return Err(Error::Refused("no journal replica could be read".into()));
        }
        Agreement::Diverge {
            seq,
            a,
            b,
            digest_a,
            digest_b,
        } => {
            store.conn.execute(
                "INSERT INTO divergences(at_unix, seq, replica_a, replica_b, digest_a, digest_b) VALUES (?1,?2,?3,?4,?5,?6)",
                params![at as i64, *seq as i64, a, b, digest_a.to_vec(), digest_b.to_vec()],
            )?;
            record_ingest(
                store,
                at,
                0,
                &[0u8; 32],
                &agreement.word(),
                false,
                "refused:diverge",
            )?;
            return Err(Error::Refused(format!(
                "replica divergence at seq {seq}: {} vs {} (recorded, nothing merged)",
                hex(&digest_a[..8]),
                hex(&digest_b[..8])
            )));
        }
        Agreement::Agree { readable } | Agreement::Prefix { readable, .. } => {
            let single = *readable < reads.len();
            if single && !opts.allow_single_replica {
                record_ingest(
                    store,
                    at,
                    0,
                    &[0u8; 32],
                    &agreement.word(),
                    true,
                    "refused:single-replica",
                )?;
                return Err(Error::Refused(
                    "only one journal replica was readable; pass allow_single_replica to index it marked".into(),
                ));
            }
            let common = match &agreement {
                Agreement::Prefix { common, .. } => *common,
                _ => reads
                    .iter()
                    .find_map(|r| r.result.as_ref().ok().map(|v| v.len()))
                    .unwrap_or(0),
            };
            let first_ok = reads
                .iter()
                .find_map(|r| r.result.as_ref().ok())
                .cloned()
                .unwrap_or_default();
            (first_ok.into_iter().take(common).collect(), single)
        }
    };

    // the index's own commitment, and the fork check against what the
    // store already holds for the same prefix
    let n = records.len() as u64;
    let stored = store.record_count()?;
    let check_n = stored.min(n);
    if let Some(prev) = store.stored_head_at(check_n)? {
        let now_head = index_head(&records, check_n as usize);
        if prev != now_head {
            record_ingest(
                store,
                at,
                0,
                &now_head,
                &agreement.word(),
                single_replica,
                "refused:fork",
            )?;
            return Err(Error::Refused(format!(
                "fork: the store's commitment for the first {check_n} records ({}) differs from what the journal now serves ({}); nothing merged",
                hex(&prev[..8]),
                hex(&now_head[..8])
            )));
        }
    }
    let head = index_head(&records, records.len());

    // the effect ledger, served
    let (ledger_rows, ledger_note) = match read_ledger(&state_dir.join("effects.bin")) {
        Ok(rows) => (rows, None),
        Err(e) => (Vec::new(), Some(e.to_string())),
    };
    let receipts = read_receipts(state_dir);

    // verify every entity before writing anything
    let groups = group_by_entity(&records);
    let mut views: Vec<EntityView> = Vec::new();
    for (id, recs) in &groups {
        let first = recs[0];
        let adm = match parse_admission(first) {
            Ok(Some(a)) => a,
            Ok(None) => {
                return Err(Error::Refused(format!(
                    "seq {}: {} for entity {} before any admission",
                    first.seq,
                    event_word(first.event),
                    hex(id)
                )))
            }
            Err(e) => return Err(Error::Refused(format!("seq {}: {e}", first.seq))),
        };
        let ident = identity(first, &adm);
        let rp = replay(recs);
        let rc = check_receipt(receipts.get(id), receipt_pk, id, &ident, &rp, &records);
        let row = ledger_rows.iter().find(|row| row.op_id == *id).cloned();
        views.push(EntityView {
            id: *id,
            admission: adm,
            identity: ident,
            replay: rp,
            receipt: rc,
            first_seq: first.seq,
            last_seq: recs.last().unwrap().seq,
            effect_row_served: row,
        });
    }

    // write: one transaction
    let tx = store.conn.transaction()?;
    for (i, r) in records.iter().enumerate() {
        let h = index_head(&records, i + 1);
        tx.execute(
            "INSERT OR REPLACE INTO records(seq, op_id, event, event_word, payload, served_tag, content_digest, index_head) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                r.seq as i64,
                r.op_id.to_vec(),
                r.event as i64,
                event_word(r.event),
                r.payload.clone(),
                r.served_tag.to_vec(),
                r.content_digest.to_vec(),
                h.to_vec()
            ],
        )?;
    }
    for row in &ledger_rows {
        tx.execute(
            "INSERT OR REPLACE INTO effect_rows(seq, op_id, env_sha, effect_digest, wall, served_tag) VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                row.seq as i64,
                row.op_id.to_vec(),
                row.env_sha.to_vec(),
                row.effect_digest.to_vec(),
                row.wall as i64,
                row.served_tag.to_vec()
            ],
        )?;
    }
    let mut receipts_present = 0u64;
    let mut receipts_verified = 0u64;
    let mut attested = 0u64;
    for v in &views {
        let (kind, root, step, attempt, label) = match &v.admission.kind {
            crate::verify::Kind::Root => ("root", None, None, None, None),
            crate::verify::Kind::Step {
                root,
                step,
                attempt,
                label,
            } => (
                "step",
                Some(root.to_vec()),
                Some(*step as i64),
                Some(*attempt as i64),
                Some(label.clone()),
            ),
        };
        let is_attested = v.attested();
        if is_attested {
            attested += 1;
        }
        tx.execute(
            "INSERT OR REPLACE INTO entities(id, kind, root, step, attempt, label, authority, policy_digest, nonce, domain, first_seq, last_seq, id_recomputed, binding_verified, replay_state, replay_recovered, replay_fail, replay_refusal, attested, view_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
            params![
                v.id.to_vec(),
                kind,
                root,
                step,
                attempt,
                label,
                v.admission.authority.to_vec(),
                v.admission.policy_digest.to_vec(),
                v.identity.nonce.map(|n| n.to_vec()),
                v.identity.domain.clone(),
                v.first_seq as i64,
                v.last_seq as i64,
                v.identity.id_recomputed as i64,
                v.identity.binding_verified as i64,
                v.replay.state.state as i64,
                v.replay.state.recovered as i64,
                v.replay.state.fail as i64,
                v.replay.refusal.clone(),
                is_attested as i64,
                v.to_json().to_string()
            ],
        )?;
        if v.receipt.present {
            receipts_present += 1;
            if v.receipt.verified {
                receipts_verified += 1;
            }
            if let Some(r) = &v.receipt.receipt {
                tx.execute(
                    "INSERT OR REPLACE INTO receipts(entity_id, json, verified, head_bound, covers_entity, mismatches_json, seq_head, journal_head) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                    params![
                        v.id.to_vec(),
                        r.to_json().to_string(),
                        v.receipt.verified as i64,
                        v.receipt.head_bound.map(|b| b as i64),
                        v.receipt.covers_entity as i64,
                        serde_json::to_string(&v.receipt.mismatches).unwrap(),
                        r.seq_head as i64,
                        r.journal_head.to_vec()
                    ],
                )?;
            }
        }
    }
    tx.execute(
        "INSERT INTO ingests(at_unix, covered_through_seq, index_head, agreement, single_replica, outcome) VALUES (?1,?2,?3,?4,?5,?6)",
        params![at as i64, n as i64, head.to_vec(), agreement.word(), single_replica as i64, "ok"],
    )?;
    tx.commit()?;

    store.set_meta("state_dir", &state_dir.display().to_string())?;
    store.set_meta("receipt_public_key", &hex(receipt_pk))?;
    store.set_meta("covered_through_seq", &n.to_string())?;
    store.set_meta("index_head", &hex(&head))?;
    store.set_meta("read_at_unix", &at.to_string())?;
    store.set_meta("agreement", &agreement.word())?;
    store.set_meta(
        "single_replica",
        if single_replica { "true" } else { "false" },
    )?;
    store.set_meta(
        "replicas",
        &serde_json::to_string(&replicas).unwrap_or_default(),
    )?;
    if let Some(note) = &ledger_note {
        store.set_meta("ledger_note", note)?;
    }
    store.seal()?;

    Ok(IngestReport {
        covered_through_seq: n,
        index_head: head,
        agreement: agreement.word(),
        single_replica,
        entities: views.len() as u64,
        receipts_present,
        receipts_verified,
        entities_attested: attested,
        effect_rows: ledger_rows.len() as u64,
        ledger_note,
        replicas,
    })
}

fn record_ingest(
    store: &Store,
    at: u64,
    covered: u64,
    head: &[u8; 32],
    agreement: &str,
    single: bool,
    outcome: &str,
) -> Result<(), Error> {
    store.conn.execute(
        "INSERT INTO ingests(at_unix, covered_through_seq, index_head, agreement, single_replica, outcome) VALUES (?1,?2,?3,?4,?5,?6)",
        params![at as i64, covered as i64, head.to_vec(), agreement, single as i64, outcome],
    )?;
    Ok(())
}
