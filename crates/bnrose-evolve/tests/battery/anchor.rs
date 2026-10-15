//! The external anchor, on both engines. The attacker here has write access
//! to the store and knows the chain: every rewrite below is re-chained, link
//! by link and head included, exactly as the journal writes them, so a plain
//! open ACCEPTS it (each row shows that first). Only the anchor taken before
//! the rewrite convicts it.

use super::common::*;

use adapter_store::{open_named, Edit, EmbeddedStore};
use bnrose_evolve::digest::hash;
use bnrose_evolve::journal::{Journal, Record};
use bnrose_evolve::{
    AnchorCheck, AnchorLookup, AnchorStatement, Controller, DecisionKind, Digest32,
};

const SUBJECT: &str = "evolve.ctr1";

/// Adopt, repair, verify, canary, PROMOTE, observe once more; return the
/// anchor statement as a carrier would hand it back (its bytes, decoded).
fn promoted(w: &World) -> AnchorStatement {
    let (mut c, _) = w.open();
    w.adopt(&mut c, &Knobs::default());
    let dir = w.candidate("cand-fix", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    run_required(&mut c, &cand, &dir);
    c.verify(&cand).unwrap();
    run_canary(&mut c, &cand, &dir);
    let d = c.decide(&cand).unwrap();
    assert_eq!(d.kind(), DecisionKind::Promote, "{:?}", d.reasons());
    c.observe("after the promotion", b"one").unwrap();
    let s = AnchorStatement::of(&c, SUBJECT).unwrap();
    assert_eq!(s.promote, Some(d.digest()), "the latest PROMOTE is bound");
    assert_eq!(s.policy, c.policy_digest(), "the policy in force is bound");
    assert_eq!((s.count, s.head), c.head(), "the head is bound");
    AnchorStatement::decode(&s.encode()).unwrap()
}

fn store(w: &World) -> Box<dyn EmbeddedStore> {
    open_named(w.engine, &w.state.join("store")).unwrap()
}

fn records(w: &World) -> Vec<Record> {
    Journal::open(store(w)).unwrap().1
}

/// The attacker: replace the journal with `recs`, every link and the head
/// recomputed as the journal computes them.
fn rechain(w: &World, recs: &[Record]) {
    let s = store(w);
    let old = s.scan_prefix(b"j/").unwrap();
    let mut edits = Vec::new();
    let mut head = Digest32::ZERO;
    for (seq, r) in recs.iter().enumerate() {
        let seq = seq as u64;
        let body = r.encode();
        let l = hash(
            "bnrose-evolve/journal/v1",
            &[&head.0, &seq.to_be_bytes(), &body],
        );
        let mut k = b"j/".to_vec();
        k.extend_from_slice(&seq.to_be_bytes());
        let mut v = body;
        v.extend_from_slice(&l.0);
        edits.push(Edit::Put(k, v));
        head = l;
    }
    for (k, _) in old.iter().skip(recs.len()) {
        edits.push(Edit::Delete(k.clone()));
    }
    let mut h = (recs.len() as u64).to_be_bytes().to_vec();
    h.extend_from_slice(&head.0);
    edits.push(Edit::Put(b"h".to_vec(), h));
    s.write_batch(&edits).unwrap();
}

/// A plain open accepts the rewrite: the gap the anchor exists for.
fn plain_open_accepts(w: &World, what: &str) {
    let r = Controller::open(&w.state, w.engine, w.trust());
    assert!(
        r.is_ok(),
        "{}: {what}: the chain alone accepts it",
        w.engine
    );
}

fn anchored_open(w: &World, latest: &AnchorLookup) -> Result<AnchorCheck, String> {
    Controller::open_anchored(&w.state, w.engine, w.trust(), SUBJECT, latest)
        .map(|(_, _, chk)| chk)
        .map_err(|e| format!("{} {e}", e.code()))
}

fn refused_tampered(w: &World, a: &AnchorStatement, what: &str, says: &str) {
    let before = records(w).len();
    let e = anchored_open(w, &AnchorLookup::Anchored(a.clone())).unwrap_err();
    assert!(e.starts_with("tampered"), "{}: {what}: {e}", w.engine);
    assert!(e.contains(says), "{}: {what}: {e}", w.engine);
    assert_eq!(
        records(w).len(),
        before,
        "{}: {what}: nothing appended",
        w.engine
    );
}

fn observation(what: &str) -> Record {
    Record::Observation {
        id: hash("battery/forged", &[what.as_bytes()]),
        what: what.to_string(),
        evidence: hash("battery/forged-evidence", &[what.as_bytes()]),
    }
}

#[test]
fn an_honest_journal_is_accepted_against_its_anchor() {
    for engine in engines() {
        let w = World::new(&format!("anchor-honest-{engine}"), engine);
        let a = promoted(&w);
        let latest = AnchorLookup::Anchored(a.clone());

        assert_eq!(
            anchored_open(&w, &latest),
            Ok(AnchorCheck::Matches { count: a.count }),
            "{engine}"
        );
        {
            let (mut c, _) = w.open();
            c.observe("later", b"two").unwrap();
        }
        assert_eq!(
            anchored_open(&w, &latest),
            Ok(AnchorCheck::Extends {
                anchored: a.count,
                local: a.count + 1
            }),
            "{engine}: growth after the anchor keeps the anchored prefix"
        );
        assert_eq!(
            anchored_open(&w, &AnchorLookup::NeverAnchored),
            Ok(AnchorCheck::Unanchored),
            "{engine}: no anchor yet is named, not hidden"
        );
    }
}

#[test]
fn a_rewritten_and_rechained_journal_is_refused_against_the_anchor() {
    for engine in engines() {
        let w = World::new(&format!("anchor-rewrite-{engine}"), engine);
        let a = promoted(&w);
        let honest = records(&w);
        let last = honest.len() - 1;
        assert!(matches!(honest[last], Record::Observation { .. }));

        // the fault after the promotion relabelled, same length, re-chained
        let mut forged = honest.clone();
        forged[last] = observation("nothing happened");
        rechain(&w, &forged);
        plain_open_accepts(&w, "relabelled");
        refused_tampered(&w, &a, "relabelled", "not the anchored ones");

        // the same rewrite, then grown past the anchor
        forged.push(observation("and more since"));
        rechain(&w, &forged);
        plain_open_accepts(&w, "relabelled and regrown");
        refused_tampered(&w, &a, "relabelled and regrown", "not the anchored ones");

        // the honest bytes back: the refusals were about the rewrite
        rechain(&w, &honest);
        assert_eq!(
            anchored_open(&w, &AnchorLookup::Anchored(a.clone())),
            Ok(AnchorCheck::Matches { count: a.count }),
            "{engine}"
        );
    }
}

#[test]
fn a_truncated_journal_is_refused_against_the_anchor() {
    for engine in engines() {
        let w = World::new(&format!("anchor-trunc-{engine}"), engine);
        let a = promoted(&w);
        let honest = records(&w);

        // the last record dropped, the head re-chained to match
        rechain(&w, &honest[..honest.len() - 1]);
        plain_open_accepts(&w, "truncated");
        refused_tampered(&w, &a, "truncated", "truncated");

        // everything from the PROMOTE on dropped: the promotion erased
        let promote_at = honest
            .iter()
            .position(|r| matches!(r, Record::Decision(_)))
            .expect("a decision record");
        rechain(&w, &honest[..promote_at]);
        plain_open_accepts(&w, "promotion erased");
        refused_tampered(&w, &a, "promotion erased", "truncated");

        // truncated, then regrown to the anchored length
        let mut regrown = honest[..honest.len() - 1].to_vec();
        regrown.push(observation("a different last record"));
        rechain(&w, &regrown);
        plain_open_accepts(&w, "truncated and regrown");
        refused_tampered(&w, &a, "truncated and regrown", "not the anchored ones");
    }
}

#[test]
fn an_anchor_that_does_not_describe_its_journal_is_refused() {
    for engine in engines() {
        let w = World::new(&format!("anchor-stmt-{engine}"), engine);
        let a = promoted(&w);

        let mut other_promote = a.clone();
        other_promote.promote = Some(hash("battery/other", &[b"promote"]));
        refused_tampered(&w, &other_promote, "promote digest", "promote or policy");

        let mut no_policy = a.clone();
        no_policy.policy = None;
        refused_tampered(&w, &no_policy, "policy digest", "promote or policy");

        let mut other_subject = a.clone();
        other_subject.subject = "evolve.ctr2".into();
        let e = anchored_open(&w, &AnchorLookup::Anchored(other_subject)).unwrap_err();
        assert!(
            e.starts_with("unknown"),
            "{engine}: another subject's anchor: {e}"
        );
    }
}

#[test]
fn an_unreachable_carrier_fails_closed() {
    for engine in engines() {
        let w = World::new(&format!("anchor-down-{engine}"), engine);
        promoted(&w);
        let before = records(&w).len();
        let e = anchored_open(&w, &AnchorLookup::Unreachable("timeout".into())).unwrap_err();
        assert!(e.starts_with("unknown"), "{engine}: {e}");
        assert!(e.contains("fails closed"), "{engine}: {e}");
        assert_eq!(records(&w).len(), before, "{engine}: nothing appended");
    }
}
