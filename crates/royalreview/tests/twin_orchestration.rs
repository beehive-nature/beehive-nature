//! Two-rail publication semantics: partial success, retry without
//! duplication, duplicate prevention, conflicts, lost responses, state
//! persistence — and the never-both-ok law (a run where one rail failed
//! can never be reported as both-successful).

use atmirror::receipt::StrongRef;
use royalreview::fixtures::{MemAtprotoSink, MemNostrSink};
use royalreview::orchestrator::{publish, RailOutcome, SinkError, TwinReport, TwinState};
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
fn partial_success_nostr_lands_atproto_fails_then_retry_completes_without_duplicating() {
    let mut nostr = MemNostrSink::new();
    let mut atproto = MemAtprotoSink::new();
    atproto.fail_next(SinkError::Transport("pds briefly down".into()));
    let mut state = TwinState::default();

    // Run 1: owned rail lands, mirror fails — PARTIAL, honestly reported.
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
    assert!(matches!(r1.atproto, RailOutcome::Failed { .. }));
    assert!(
        !r1.both_published(),
        "ONE rail down can never read as both-ok"
    );
    assert!(
        r1.summary().starts_with("PARTIAL"),
        "summary: {}",
        r1.summary()
    );
    assert_eq!(nostr.publish_calls, 1);
    assert_eq!(atproto.create_calls, 1);

    // Run 2 (the retry): nostr is Already (ONE total nostr write ever),
    // atproto publishes. Now — and only now — both-ok.
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
        "one failed attempt + one successful"
    );
}

#[test]
fn nostr_failure_blocks_the_mirror_not_attempted_and_never_both_ok() {
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
    assert!(matches!(report.nostr, RailOutcome::Failed { .. }));
    assert!(matches!(report.atproto, RailOutcome::NotAttempted { .. }));
    assert!(!report.both_published());
    assert!(report.summary().starts_with("NOT PUBLISHED"));
    assert_eq!(
        atproto.create_calls, 0,
        "the mirror never precedes the record of truth"
    );
}

#[test]
fn lost_nostr_response_is_recovered_by_probe_without_duplicate() {
    // The write LANDED but the response was lost — the classic partial
    // state that tempts a duplicate on retry.
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
    assert!(matches!(r1.nostr, RailOutcome::Failed { .. }));
    assert!(matches!(r1.atproto, RailOutcome::NotAttempted { .. }));
    assert!(!r1.both_published());

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
        "probe finds the landed event id"
    );
    assert!(matches!(r2.atproto, RailOutcome::Published { .. }));
    assert!(r2.both_published());
    assert_eq!(
        nostr.publish_calls, 1,
        "exactly one write despite the lost response"
    );
}

#[test]
fn lost_atproto_response_is_recovered_by_record_equality() {
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
    assert!(matches!(r1.atproto, RailOutcome::Failed { .. }));
    assert!(!r1.both_published());

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
        matches!(r2.atproto, RailOutcome::Already { .. }),
        "probe finds the identical record"
    );
    assert!(r2.both_published());
    assert_eq!(
        atproto.create_calls, 1,
        "exactly one write despite the lost response"
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
    // First run: atproto fails transiently so we can retry with an expired
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
/// per-rail outcome pair and check the summary/flag agree with the truth.
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
