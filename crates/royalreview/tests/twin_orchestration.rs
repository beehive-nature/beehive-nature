//! Two-rail publication semantics: partial success, retry without
//! duplication, duplicate prevention, conflicts, lost acknowledgements
//! (unconfirmed ≠ unpublished — Astra review 2026-09-12, comment
//! 5647664844), identity gates, state persistence — and the never-both-ok
//! law (a run where one rail failed or is unconfirmed can never be
//! reported as both-successful).

use atmirror::receipt::StrongRef;
use royalreview::fixtures::{MemAtprotoSink, MemNostrSink};
use royalreview::orchestrator::{
    publish, RailOutcome, ReviewEntry, SinkError, TwinReport, TwinState,
};
use royalreview::record::{Review, StorageRef, REVIEW_NSID};

const RKEY: &str = "3jzfcijpj2z2a";

fn review() -> Review {
    Review {
        record_type: REVIEW_NSID.into(),
        author: "did:plc:reviewer".into(),
        subject: StrongRef {
            uri: "at://did:plc:reviewer/app.bsky.feed.post/3jzfcijpj2z2a".into(),
            cid: "bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku".into(),
        },
        verdict: "sound".into(),
        storage_refs: vec![StorageRef {
            scheme: "ar".into(),
            address: "A".repeat(43),
            sha256: "cd".repeat(32),
            byte_length: Some(42),
            label: None,
        }],
        receipt: None,
        comment: None,
        created_at: "2026-09-12T10:20:30Z".into(),
    }
}

fn pubkey() -> String {
    format!("{:0>64}", "22")
}

fn other_pubkey() -> String {
    format!("{:0>64}", "33")
}

#[test]
fn fresh_publish_lands_both_rails_once() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();
    let report = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(matches!(report.nostr, RailOutcome::Published { .. }));
    assert!(matches!(report.atproto, RailOutcome::Published { .. }));
    assert!(report.both_published());
    assert!(report.summary().starts_with("BOTH RAILS OK"));
    assert_eq!(nostr.publish_calls, 1);
    assert_eq!(atproto.create_calls, 1);
    // State ledgered both rails.
    let entry = state.reviews.get(RKEY).unwrap();
    assert!(entry.nostr_event_id.is_some() && entry.atproto_cid.is_some());
}

#[test]
fn re_publish_after_success_is_already_on_both_rails_no_new_writes() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();
    publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    let report = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(matches!(report.nostr, RailOutcome::Already { .. }));
    assert!(matches!(report.atproto, RailOutcome::Already { .. }));
    assert!(
        report.both_published(),
        "Already counts as landed — no duplicate, same truth"
    );
    assert_eq!(nostr.publish_calls, 1, "no second nostr write");
    assert_eq!(atproto.create_calls, 1, "no second atproto write");
}

#[test]
fn partial_success_nostr_lands_atproto_unconfirmed_then_retry_completes_without_duplicating() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    // Transport error on the write, nothing stored, and the reconcile
    // read finds nothing — the honest first report is UNCONFIRMED, not
    // "definitely not published".
    atproto.fail_next(SinkError::Transport("pds briefly down".into()));
    let mut state = TwinState::default();

    // Run 1: owned rail lands, mirror outcome unknown — PARTIAL, honestly.
    let r1 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(matches!(r1.nostr, RailOutcome::Published { .. }));
    match &r1.atproto {
        RailOutcome::Unconfirmed { detail } => {
            assert!(detail.contains("reconcile"), "got: {detail}")
        }
        other => panic!("expected Unconfirmed, got {other:?}"),
    }
    assert!(
        !r1.both_published(),
        "ONE rail down can never read as both-ok"
    );
    assert!(
        r1.summary().starts_with("PARTIAL"),
        "summary: {}",
        r1.summary()
    );
    assert!(
        r1.summary().contains("UNCONFIRMED"),
        "summary: {}",
        r1.summary()
    );
    assert_eq!(nostr.publish_calls, 1);
    assert_eq!(atproto.create_calls, 1);

    // Run 2 (the retry): nostr is Already (ONE total nostr write ever),
    // the probe settles the mirror as absent → publishes. Now both-ok.
    let r2 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(
        matches!(r2.nostr, RailOutcome::Already { .. }),
        "retry must not re-write the landed rail"
    );
    assert!(matches!(r2.atproto, RailOutcome::Published { .. }));
    assert!(r2.both_published());
    assert_eq!(
        nostr.publish_calls, 1,
        "nostr written exactly once across both runs"
    );
    assert_eq!(
        atproto.create_calls, 2,
        "one lost-acknowledgement attempt + one successful"
    );
}

#[test]
fn nostr_write_failing_unconfirmed_blocks_the_mirror_and_never_reads_not_published() {
    let mut nostr = MemNostrSink::new();
    nostr.fail_next(SinkError::Transport("relay unreachable".into()));
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();

    let report = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    // Transport error + reconcile probe finds nothing: UNKNOWN, and the
    // summary must not claim "NOT PUBLISHED" — nobody observed an absence.
    assert!(matches!(report.nostr, RailOutcome::Unconfirmed { .. }));
    assert!(matches!(report.atproto, RailOutcome::NotAttempted { .. }));
    assert!(!report.both_published());
    assert!(
        report.summary().starts_with("UNRESOLVED"),
        "summary: {}",
        report.summary()
    );
    assert_eq!(
        atproto.create_calls, 0,
        "the mirror never precedes the record of truth, and not while its \
         landing is unknown"
    );
}

#[test]
fn definite_rejection_on_nostr_is_failed_not_unconfirmed() {
    let mut nostr = MemNostrSink::new();
    nostr.fail_next(SinkError::Rejected {
        status: 409,
        body: "duplicate replaceable event with different content".into(),
    });
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();
    let report = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    // An explicit rejection is a DEFINITE non-landing — Failed, summary
    // NOT PUBLISHED (this time the absence really was observed).
    assert!(matches!(report.nostr, RailOutcome::Failed { .. }));
    assert!(matches!(report.atproto, RailOutcome::NotAttempted { .. }));
    assert!(report.summary().starts_with("NOT PUBLISHED"));
}

#[test]
fn lost_nostr_acknowledgement_is_reconciled_immediately_by_probe() {
    // The write LANDED but the response was lost. The immediate reconcile
    // probe confirms the expected id, so run 1 reports Published (with the
    // mirror proceeding) — still exactly one write.
    let mut nostr = MemNostrSink::new();
    nostr.lose_next_response = true;
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();

    let r1 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(
        matches!(r1.nostr, RailOutcome::Published { .. }),
        "reconcile probe confirms the write: {:?}",
        r1.nostr
    );
    assert!(matches!(r1.atproto, RailOutcome::Published { .. }));
    assert!(r1.both_published());
    assert_eq!(
        nostr.publish_calls, 1,
        "exactly one write; the confirmation was a read"
    );
    assert_eq!(atproto.create_calls, 1);

    // A subsequent run stays Already/Already.
    let r2 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(matches!(r2.nostr, RailOutcome::Already { .. }));
    assert!(matches!(r2.atproto, RailOutcome::Already { .. }));
    assert_eq!(nostr.publish_calls, 1);
}

#[test]
fn lost_atproto_acknowledgement_is_reconciled_by_record_equality() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    atproto.lose_next_response = true;
    let mut state = TwinState::default();

    let r1 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    // Store-then-lose + reconcile read finds the IDENTICAL record value:
    // confirmed Published in the same run, one write total.
    assert!(matches!(r1.atproto, RailOutcome::Published { .. }));
    assert!(r1.both_published());
    assert_eq!(
        atproto.create_calls, 1,
        "exactly one write despite the lost response"
    );
}

#[test]
fn nostr_lost_ack_with_unavailable_reconcile_is_unconfirmed_then_retry_settles_by_probe() {
    let mut nostr = MemNostrSink::new();
    nostr.lose_next_response = true;
    // Probe #1 (pre-write) must succeed; probe #2 (reconcile) fails —
    // the acknowledgement is lost AND cannot be settled this run.
    nostr.fail_probe_on_nth = Some((2, SinkError::Transport("probe down".into())));
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();

    // First report: UNKNOWN — never "not published" — and the mirror
    // stays blocked while the owned rail's landing is unknown.
    let r1 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    match &r1.nostr {
        RailOutcome::Unconfirmed { detail } => {
            assert!(
                detail.contains("reconcile probe unavailable"),
                "got: {detail}"
            )
        }
        other => panic!("expected Unconfirmed, got {other:?}"),
    }
    assert!(matches!(r1.atproto, RailOutcome::NotAttempted { .. }));
    assert!(!r1.both_published());
    assert!(
        r1.summary().starts_with("UNRESOLVED"),
        "summary: {}",
        r1.summary()
    );

    // Retry with healthy probes: the pre-write probe finds the landed
    // event → Already (NO second nostr write), mirror completes.
    let r2 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(matches!(r2.nostr, RailOutcome::Already { .. }));
    assert!(matches!(r2.atproto, RailOutcome::Published { .. }));
    assert!(r2.both_published());
    assert_eq!(
        nostr.publish_calls, 1,
        "settled by probe, never re-published blindly"
    );
    assert_eq!(atproto.create_calls, 1);
}

#[test]
fn atproto_lost_ack_with_unavailable_reconcile_is_unconfirmed_then_retry_settles() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    atproto.lose_next_response = true;
    // get #1 (pre-write) must succeed; get #2 (reconcile) fails.
    atproto.fail_get_on_nth = Some((2, SinkError::Transport("read down".into())));
    let mut state = TwinState::default();

    let r1 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(matches!(r1.nostr, RailOutcome::Published { .. }));
    match &r1.atproto {
        RailOutcome::Unconfirmed { detail } => {
            assert!(
                detail.contains("reconcile probe unavailable"),
                "got: {detail}"
            )
        }
        other => panic!("expected Unconfirmed, got {other:?}"),
    }
    assert!(!r1.both_published());
    assert!(
        r1.summary().starts_with("PARTIAL") && r1.summary().contains("UNCONFIRMED"),
        "summary: {}",
        r1.summary()
    );

    // Retry: probe finds the identical stored record → Already (no second
    // write), both-ok.
    let r2 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(matches!(r2.nostr, RailOutcome::Already { .. }));
    assert!(matches!(r2.atproto, RailOutcome::Already { .. }));
    assert!(r2.both_published());
    assert_eq!(atproto.create_calls, 1);
}

#[test]
fn unavailable_probes_never_assert_absence() {
    // (a) Pre-write probe unavailable on a fresh entry: no write happens,
    //     outcome UNCONFIRMED (not Failed, which would claim a non-landing
    //     nobody observed).
    let mut nostr = MemNostrSink::new();
    nostr.fail_probe_on_nth = Some((1, SinkError::Transport("probe down".into())));
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();
    let r = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(matches!(r.nostr, RailOutcome::Unconfirmed { .. }));
    assert_eq!(
        nostr.publish_calls, 0,
        "no write past an unknown rail state"
    );
    assert!(matches!(r.atproto, RailOutcome::NotAttempted { .. }));

    // (b) LEDGERED entry + probe unavailable: still UNCONFIRMED — the
    //     ledger's past success is not re-asserted as present, and a dead
    //     probe is not turned into "it's gone". (Fresh rails: land once —
    //     consuming the first probe — then kill the next probe.)
    let mut nostr_b = MemNostrSink::new();
    let mut atproto_b = MemAtprotoSink::new();
    let mut state_b = TwinState::default();
    publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr_b,
        &mut atproto_b,
        &mut state_b,
    )
    .unwrap();
    nostr_b.fail_probe_on_nth = Some((2, SinkError::Transport("probe down again".into())));
    let r2 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr_b,
        &mut atproto_b,
        &mut state_b,
    )
    .unwrap();
    match &r2.nostr {
        RailOutcome::Unconfirmed { detail } => {
            assert!(detail.contains("ledgered"), "got: {detail}")
        }
        other => panic!("expected Unconfirmed, got {other:?}"),
    }
    assert_eq!(nostr_b.publish_calls, 1, "still no re-write while unknown");

    // (c) atproto probe unavailable: same law on the mirror.
    let mut nostr3 = MemNostrSink::new();
    let mut atproto3 = MemAtprotoSink::new();
    atproto3.fail_get_on_nth = Some((1, SinkError::Transport("read down".into())));
    let mut state3 = TwinState::default();
    let r3 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr3,
        &mut atproto3,
        &mut state3,
    )
    .unwrap();
    assert!(matches!(r3.atproto, RailOutcome::Unconfirmed { .. }));
    assert_eq!(atproto3.create_calls, 0);
}

/// Astra finding 1: a stale/inconsistent ledger whose id MATCHES the rail
/// but is NOT the id this run computes for the review+rkey+pubkey must be
/// refused — the ledger agreeing with the rail is not enough; both must
/// agree with OUR locally computed event.
#[test]
fn stale_ledger_matching_probe_but_not_local_computation_is_refused() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();

    // A different review takes the identity first (verdict flipped) —
    // the rail now holds its (foreign-to-us) event id under our pubkey+d.
    let mut foreign = review();
    foreign.verdict = "unsound".into();
    let mut seed_state = TwinState::default();
    publish(
        &foreign,
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut seed_state,
    )
    .unwrap();
    let foreign_id = seed_state.reviews[RKEY]
        .nostr_event_id
        .clone()
        .expect("foreign event landed");

    // The corrupted/stale ledger: OUR review text (so the content gate
    // passes) but the FOREIGN event id — exactly the shape that used to
    // sail through as Already because ledger == probe answer.
    let mut state = TwinState::default();
    state.reviews.insert(
        RKEY.into(),
        ReviewEntry {
            review: review(),
            nostr_pubkey: pubkey(),
            nostr_event_id: Some(foreign_id),
            atproto_cid: None,
            attempts: 1,
        },
    );

    let r = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    match &r.nostr {
        RailOutcome::Conflict { detail } => {
            assert!(
                detail.contains("locally computed") || detail.contains("stale"),
                "got: {detail}"
            )
        }
        other => panic!("expected Conflict, got {other:?}"),
    }
    assert!(!r.both_published());
    assert!(
        matches!(r.atproto, RailOutcome::NotAttempted { .. }),
        "the mirror must not proceed on a refused owned rail"
    );
    assert_eq!(
        nostr.publish_calls, 1,
        "only the foreign write ever happened — no new one"
    );
    assert_eq!(atproto.create_calls, 1);
}

/// Astra finding 1b: one rkey, one Nostr identity — a retry under a
/// different publishing key is refused BEFORE any write, so the twin
/// binding (one atproto record ↔ one (pubkey, d-tag) event) cannot fork.
#[test]
fn retry_under_a_different_publishing_pubkey_is_refused_before_any_write() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();
    publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert_eq!((nostr.publish_calls, atproto.create_calls), (1, 1));

    let err = publish(
        &review(),
        None,
        RKEY,
        &other_pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .expect_err("a second Nostr identity for one rkey must be refused");
    assert!(err.contains("different publishing pubkey"), "got: {err}");
    assert_eq!(
        (nostr.publish_calls, atproto.create_calls),
        (1, 1),
        "refused before ANY write — no second identity was published"
    );
}

#[test]
fn conflicting_content_under_the_same_identity_is_never_overwritten() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();

    // A DIFFERENT review (verdict flipped) publishes first and lands both
    // rails under our rkey — an adversary, or a past divergent review,
    // took the identity.
    let mut different = review();
    different.verdict = "unsound".into();
    publish(
        &different,
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();

    // The original review under the SAME rkey must be refused — never a
    // silent overwrite of either rail.
    let err = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .expect_err("same rkey with different content must be refused");
    assert!(err.contains("DIFFERENT review content"), "got: {err}");
    assert_eq!(nostr.publish_calls, 1);
    assert_eq!(atproto.create_calls, 1);
}

#[test]
fn invalid_review_never_touches_a_rail() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();
    let mut bad = review();
    bad.verdict = "magnificent".into();
    let err = publish(
        &bad,
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .expect_err("invalid review must be refused before any write");
    assert!(err.contains("verdict"));
    assert_eq!(nostr.publish_calls, 0);
    assert_eq!(atproto.create_calls, 0);
    assert!(
        state.reviews.is_empty(),
        "nothing ledgered for a refused review"
    );
}

#[test]
fn expired_session_is_a_named_failure_on_the_mirror_leg() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();
    // First run: atproto outcome unknown so we can retry with an expired
    // session on the second run (the shape the OAuth slice will produce).
    atproto.fail_next(SinkError::Transport("down".into()));
    publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    atproto.fail_next(SinkError::ExpiredSession);
    let r2 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    // ExpiredSession is a DEFINITE non-landing (no write was attempted
    // past auth): Failed, named as expired — not Unconfirmed.
    match &r2.atproto {
        RailOutcome::Failed { error } => assert!(error.contains("expired"), "got: {error}"),
        other => panic!("expected Failed(expired), got {other:?}"),
    }
    assert!(!r2.both_published());
}

#[test]
fn state_persists_and_reloads_across_runs() {
    let dir = std::env::temp_dir().join(format!("rr-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("twin-state.json");

    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    let mut state = TwinState::default();
    atproto.fail_next(SinkError::Transport("down".into()));
    let r1 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state,
    )
    .unwrap();
    assert!(!r1.both_published());
    state.save(&path).unwrap();

    // A fresh process state, reloaded from disk.
    let mut state2 = TwinState::load(&path).unwrap();
    let r2 = publish(
        &review(),
        None,
        RKEY,
        &pubkey(),
        &mut nostr,
        &mut atproto,
        &mut state2,
    )
    .unwrap();
    assert!(matches!(r2.nostr, RailOutcome::Already { .. }));
    assert!(matches!(r2.atproto, RailOutcome::Published { .. }));
    assert!(r2.both_published());
    std::fs::remove_dir_all(&dir).ok();
}

/// The docket's sharpest sentence: "Never report both publications
/// successful when only one succeeded." Enumerate every reachable
/// per-rail outcome pair — Failed AND Unconfirmed shapes — and check the
/// summary/flag agree with the truth.
#[test]
fn never_both_ok_property_over_outcome_pairs() {
    let id = "x".to_string();
    let cases: Vec<(RailOutcome, RailOutcome, bool, &str)> = vec![
        (
            RailOutcome::Published { id: id.clone() },
            RailOutcome::Published { id: id.clone() },
            true,
            "BOTH RAILS OK",
        ),
        (
            RailOutcome::Published { id: id.clone() },
            RailOutcome::Already { id: id.clone() },
            true,
            "BOTH RAILS OK",
        ),
        (
            RailOutcome::Already { id: id.clone() },
            RailOutcome::Published { id: id.clone() },
            true,
            "BOTH RAILS OK",
        ),
        (
            RailOutcome::Already { id: id.clone() },
            RailOutcome::Already { id: id.clone() },
            true,
            "BOTH RAILS OK",
        ),
        // Every single-failure shape: partial, honestly named.
        (
            RailOutcome::Published { id: id.clone() },
            RailOutcome::Failed { error: "x".into() },
            false,
            "PARTIAL",
        ),
        (
            RailOutcome::Published { id: id.clone() },
            RailOutcome::NotAttempted { reason: "x".into() },
            false,
            "PARTIAL",
        ),
        (
            RailOutcome::Published { id: id.clone() },
            RailOutcome::Conflict { detail: "x".into() },
            false,
            "PARTIAL",
        ),
        // An unknown mirror outcome is still not a landing — PARTIAL.
        (
            RailOutcome::Published { id: id.clone() },
            RailOutcome::Unconfirmed { detail: "x".into() },
            false,
            "PARTIAL",
        ),
        // Unknown owned rail → UNRESOLVED, never "NOT PUBLISHED".
        (
            RailOutcome::Unconfirmed { detail: "x".into() },
            RailOutcome::NotAttempted { reason: "x".into() },
            false,
            "UNRESOLVED",
        ),
        (
            RailOutcome::Unconfirmed { detail: "x".into() },
            RailOutcome::Unconfirmed { detail: "x".into() },
            false,
            "UNRESOLVED",
        ),
        (
            RailOutcome::Failed { error: "x".into() },
            RailOutcome::NotAttempted { reason: "x".into() },
            false,
            "NOT PUBLISHED",
        ),
        (
            RailOutcome::Conflict { detail: "x".into() },
            RailOutcome::NotAttempted { reason: "x".into() },
            false,
            "NOT PUBLISHED",
        ),
    ];
    for (nostr, atproto, expect_both, expect_summary) in cases {
        let report = TwinReport {
            rkey: RKEY.into(),
            nostr,
            atproto,
        };
        assert_eq!(report.both_published(), expect_both);
        assert!(
            report.summary().starts_with(expect_summary),
            "summary {:?} should start with {expect_summary}",
            report.summary()
        );
    }
}
