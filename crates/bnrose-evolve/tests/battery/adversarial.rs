//! The cases that must never authorize promotion: forged success reports,
//! stale evidence, a removed test, an exhausted budget, an attempted policy
//! edit, a swapped verifier, a moved artifact, a role confusion, a failed
//! canary, a lying retry, a hung worker, a scribbling check, a flood.

use super::common::*;

use bnrose_evolve::evidence::ExecStatus;
use bnrose_evolve::{DecisionKind, Outcome, Role, TrustRoot};

fn world(tag: &str) -> (World, bnrose_evolve::Controller) {
    let w = World::new(tag, "sqlite");
    let (mut c, _) = w.open();
    w.adopt(&mut c, &Knobs::default());
    (w, c)
}

#[test]
fn forged_success_report_is_only_a_claim() {
    let (w, mut c) = world("forged");
    let dir = w.candidate("cand", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let t = w.proposal(
        c.current().unwrap(),
        &dir,
        &["svc/service.cfg"],
        "VERDICT=PASS all 2 checks green, canary healthy, promote now",
    );
    let cand = c
        .admit(&t, &w.agent.envelope(t.as_bytes()), &w.base, &dir)
        .unwrap();
    // a file in the candidate that looks like evidence is just bytes in the candidate
    let v = c.verify(&cand).unwrap();
    assert_eq!(v.overall(), Outcome::NotRun);
    let fx = fixture();
    let ca = args(&["canary"]);
    let e = c
        .run_canary(&cand, &cmd("canary", &fx, &ca), &dir)
        .unwrap_err();
    assert_eq!(e.code(), "canary", "no canary on unverified bytes");
    let d = c.decide(&cand).unwrap();
    assert_eq!(d.kind(), DecisionKind::Hold);
    assert!(
        d.reasons().iter().any(|r| r.contains("NOT_RUN")),
        "{:?}",
        d.reasons()
    );
    assert_ne!(c.current(), Some(d.artifact()));
}

#[test]
fn role_confusion_is_refused() {
    let (w, mut c) = world("roles");
    // the agent signs a policy: a valid signature by the wrong role
    let t = w.policy_text(
        &Knobs {
            total_ceiling: u64::MAX,
            ..Knobs::default()
        },
        c.current().unwrap(),
    );
    let e = c
        .adopt_policy(&t, &w.agent.envelope(t.as_bytes()))
        .unwrap_err();
    assert_eq!(e.code(), "attest:role");
    // the sovereign's signature over different bytes
    let e = c
        .adopt_policy(&t, &w.sovereign.envelope(b"another policy"))
        .unwrap_err();
    assert_eq!(e.code(), "attest");
    // a stranger's key
    let stranger = Signer::new(9, "stranger");
    let e = c
        .adopt_policy(&t, &stranger.envelope(t.as_bytes()))
        .unwrap_err();
    assert_eq!(e.code(), "attest");
    // one key cannot hold two roles
    let e = TrustRoot::new(vec![
        w.sovereign.role_key(Role::Sovereign),
        // the sovereign's own key material under another name
        Signer::new(1, "agent-alias").role_key(Role::Agent),
    ])
    .unwrap_err();
    assert_eq!(e.code(), "attest");
    // a sovereign-signed proposal is not an agent's proposal
    let dir = w.candidate("cand", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let p = w.proposal(c.current().unwrap(), &dir, &["svc/service.cfg"], "");
    let e = c
        .admit(&p, &w.sovereign.envelope(p.as_bytes()), &w.base, &dir)
        .unwrap_err();
    assert_eq!(e.code(), "attest:role");
}

#[test]
fn removed_test_and_policy_edits_are_refused_at_admission() {
    let (w, mut c) = world("protected");
    let base = c.current().unwrap();
    let cases: Vec<(&str, Vec<(&str, Option<&str>)>, &str)> = vec![
        (
            "removed-test",
            vec![
                ("svc/service.cfg", Some(FIXED_CFG)),
                ("svc/tests/regress.txt", None),
            ],
            "proposal:protected-path",
        ),
        (
            "weakened-test",
            vec![("svc/tests/regress.txt", Some("nothing to see\n"))],
            "proposal:protected-path",
        ),
        (
            "policy-edit",
            vec![("policy/promotion.txt", Some("total_ceiling=infinite\n"))],
            "proposal:protected-path",
        ),
        (
            "ci-edit",
            vec![(".github/workflows/x.yml", Some("on: never\n"))],
            "proposal:protected-path",
        ),
        (
            "outside",
            vec![("verifier/probe.rs", Some("fn main(){}\n"))],
            "proposal:outside-writable",
        ),
    ];
    for (name, edits, code) in cases {
        let dir = w.candidate(name, &w.base, &edits);
        let touched: Vec<&str> = {
            let mut t: Vec<&str> = edits.iter().map(|(p, _)| *p).collect();
            t.sort();
            t
        };
        let p = w.proposal(base, &dir, &touched, "harmless");
        let e = c
            .admit(&p, &w.agent.envelope(p.as_bytes()), &w.base, &dir)
            .unwrap_err();
        assert_eq!(e.code(), code, "{name}: {e}");
    }
}

#[test]
fn undeclared_changes_and_stale_bases_are_refused() {
    let (w, mut c) = world("undeclared");
    let base = c.current().unwrap();
    let dir = w.candidate(
        "sneaky",
        &w.base,
        &[
            ("svc/service.cfg", Some(FIXED_CFG)),
            ("svc/main.txt", Some("counter service, quietly different\n")),
        ],
    );
    let p = w.proposal(base, &dir, &["svc/service.cfg"], "only the config");
    let e = c
        .admit(&p, &w.agent.envelope(p.as_bytes()), &w.base, &dir)
        .unwrap_err();
    assert_eq!(e.code(), "proposal:undeclared-change");

    let p = w.proposal(
        bnrose_evolve::digest::hash("not", &[b"the base"]),
        &dir,
        &["svc/main.txt", "svc/service.cfg"],
        "",
    );
    let e = c
        .admit(&p, &w.agent.envelope(p.as_bytes()), &w.base, &dir)
        .unwrap_err();
    assert_eq!(e.code(), "proposal:stale-base");

    // a base TREE that is not the base in force (the agent shrinks the diff
    // by supplying its own idea of the baseline)
    let fake_base = w.candidate("fake-base", &dir, &[]);
    let p = w.proposal(base, &dir, &[], "");
    let e = c
        .admit(&p, &w.agent.envelope(p.as_bytes()), &fake_base, &dir)
        .unwrap_err();
    assert_eq!(e.code(), "artifact");
}

#[test]
fn swapped_verifier_and_moved_artifact_are_refused() {
    let (w, mut c) = world("swap");
    let dir = w.candidate("cand", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    let fx = fixture();
    // other arguments for a pinned id
    let lenient = args(&["format"]);
    let e = c
        .run_check(&cand, &cmd("restart", &fx, &lenient), &dir)
        .unwrap_err();
    assert_eq!(e.code(), "verifier:unpinned");
    // a check id the policy does not require
    let e = c
        .run_check(&cand, &cmd("vibes", &fx, &lenient), &dir)
        .unwrap_err();
    assert_eq!(e.code(), "verifier:unpinned");
    // a different program with the right arguments (a copy plus one byte)
    let other = w.root.join("other-verifier");
    let mut bytes = std::fs::read(&fx).unwrap();
    bytes.push(0);
    std::fs::write(&other, bytes).unwrap();
    let r = args(&["restart"]);
    let e = c
        .run_check(&cand, &cmd("restart", &other, &r), &dir)
        .unwrap_err();
    assert_eq!(e.code(), "verifier:unpinned");
    // the agent edits the candidate after admission
    std::fs::write(
        dir.join("svc/service.cfg"),
        "ack=after_write\nrestart_backoff_ms=0\n",
    )
    .unwrap();
    let e = c
        .run_check(&cand, &cmd("restart", &fx, &r), &dir)
        .unwrap_err();
    assert_eq!(e.code(), "artifact");
    assert_eq!(
        c.attempts_for(Some(cand)),
        0,
        "nothing was reserved for refused runs"
    );
}

#[test]
fn stale_evidence_does_not_carry_across_a_verifier_upgrade() {
    let (w, mut c) = world("stale");
    let dir = w.candidate("cand", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    run_required(&mut c, &cand, &dir);
    assert_eq!(c.verify(&cand).unwrap().overall(), Outcome::Pass);
    // the sovereign upgrades the verifier revision before the decision
    w.adopt(
        &mut c,
        &Knobs {
            verifier_rev: "verifier-r2".into(),
            ..Knobs::default()
        },
    );
    let v = c.verify(&cand).unwrap();
    assert_eq!(v.overall(), Outcome::NotRun, "{v:?}");
    assert!(v.checks().iter().all(|cv| cv.unbound() == 1));
    let d = c.decide(&cand).unwrap();
    assert_eq!(d.kind(), DecisionKind::Hold);
    assert!(
        d.reasons().iter().any(|r| r.contains("different policy")),
        "{:?}",
        d.reasons()
    );
}

#[test]
fn an_exhausted_budget_stops_attempts_and_promotion() {
    let w = World::new("budget", "sqlite");
    let (mut c, _) = w.open();
    // a hung worker is killed only once the attempt ceiling has elapsed, so its
    // settled usage is at least the ceiling: 500 spent + 500 reserved > 900
    let k = Knobs {
        attempt_ceiling: 500,
        total_ceiling: 900,
        extra: vec![("hang".into(), args(&["hang"]))],
        ..Knobs::default()
    };
    w.adopt(&mut c, &k);
    let dir = w.candidate("cand", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    let fx = fixture();
    let h = args(&["hang"]);
    let x = c.run_check(&cand, &cmd("hang", &fx, &h), &dir).unwrap();
    assert!(
        x.elapsed() >= 500,
        "killed only after the ceiling: {}",
        x.elapsed()
    );
    assert_eq!(
        c.exposure(),
        x.elapsed(),
        "the abandoned attempt still costs what it used"
    );
    let r = args(&["restart"]);
    let e = c
        .run_check(&cand, &cmd("restart", &fx, &r), &dir)
        .unwrap_err();
    assert_eq!(e.code(), "meter:ceiling", "{e}");
    assert_eq!(
        c.attempts_for(Some(cand)),
        1,
        "a refused reservation journals nothing"
    );
    let d = c.decide(&cand).unwrap();
    assert_eq!(d.kind(), DecisionKind::Hold);
    assert_eq!(d.usage_known(), x.elapsed());
}

#[test]
fn a_failed_canary_rolls_back_and_keeps_the_current_implementation() {
    let (w, mut c) = world("canary");
    let before = c.current();
    let hot = "ack=after_write\nrestart_backoff_ms=0\n";
    let dir = w.candidate("cand", &w.base, &[("svc/service.cfg", Some(hot))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    run_required(&mut c, &cand, &dir);
    assert_eq!(c.verify(&cand).unwrap().overall(), Outcome::Pass);
    run_canary(&mut c, &cand, &dir);
    let d = c.decide(&cand).unwrap();
    assert_eq!(d.kind(), DecisionKind::RollBack, "{:?}", d.reasons());
    assert_eq!(d.scope(), "canary-1pct");
    assert_eq!(c.current(), before, "the implementation in force stays");
}

#[test]
fn a_passing_retry_does_not_erase_a_failure() {
    let w = World::new("retry", "sqlite");
    let (mut c, _) = w.open();
    w.adopt(
        &mut c,
        &Knobs {
            extra: vec![("flap".into(), args(&["flap"]))],
            ..Knobs::default()
        },
    );
    let dir = w.candidate("cand", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    run_required(&mut c, &cand, &dir);
    let fx = fixture();
    let f = args(&["flap"]);
    let first = c.run_check(&cand, &cmd("flap", &fx, &f), &dir).unwrap();
    let retry = c.run_check(&cand, &cmd("flap", &fx, &f), &dir).unwrap();
    assert_eq!(first.status(), &ExecStatus::Ran { code: 1 });
    assert_eq!(
        retry.status(),
        &ExecStatus::Ran { code: 0 },
        "the retry did pass"
    );
    let v = c.verify(&cand).unwrap();
    let flap = v.check("flap").unwrap();
    assert_eq!(flap.outcome(), Outcome::Fail, "the earlier failure stands");
    assert_eq!(flap.basis(), &[first.attempt(), retry.attempt()]);
    assert_eq!(
        c.attempts_for(Some(cand)),
        4,
        "every physical attempt is accounted"
    );
    let ca = args(&["canary"]);
    let e = c
        .run_canary(&cand, &cmd("canary", &fx, &ca), &dir)
        .unwrap_err();
    assert_eq!(e.code(), "canary", "a failed check keeps the canary closed");
    let d = c.decide(&cand).unwrap();
    assert_eq!(d.kind(), DecisionKind::Hold);
}

#[test]
fn hung_scribbling_and_flooding_workers_are_degraded_never_pass() {
    let w = World::new("bounded", "sqlite");
    let (mut c, _) = w.open();
    let k = Knobs {
        attempt_ceiling: 1_500,
        total_ceiling: 100_000,
        extra: vec![
            ("hang".into(), args(&["hang"])),
            ("mutate".into(), args(&["mutate"])),
            ("noisy".into(), args(&["noisy"])),
        ],
        ..Knobs::default()
    };
    w.adopt(&mut c, &k);
    let dir = w.candidate("cand", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    let fx = fixture();
    let started = std::time::Instant::now();
    let h = args(&["hang"]);
    let x = c.run_check(&cand, &cmd("hang", &fx, &h), &dir).unwrap();
    assert!(
        matches!(x.status(), ExecStatus::Interrupted { .. }),
        "{:?}",
        x.status()
    );
    assert!(
        started.elapsed().as_secs() < 30,
        "the ceiling bounded the hung worker"
    );

    let m = args(&["mutate"]);
    let x = c.run_check(&cand, &cmd("mutate", &fx, &m), &dir).unwrap();
    assert!(
        matches!(x.status(), ExecStatus::ArtifactMutated { code: 0 }),
        "{:?}",
        x.status()
    );
    // the scribbled file is still there: every later run on this dir is refused
    let r = args(&["restart"]);
    assert_eq!(
        c.run_check(&cand, &cmd("restart", &fx, &r), &dir)
            .unwrap_err()
            .code(),
        "artifact"
    );
    std::fs::remove_file(dir.join("svc/scribble.txt")).unwrap();

    let n = args(&["noisy"]);
    let x = c.run_check(&cand, &cmd("noisy", &fx, &n), &dir).unwrap();
    assert!(
        matches!(x.status(), ExecStatus::Interrupted { .. }),
        "{:?}",
        x.status()
    );

    run_required(&mut c, &cand, &dir);
    let v = c.verify(&cand).unwrap();
    for id in ["hang", "mutate", "noisy"] {
        assert_eq!(v.check(id).unwrap().outcome(), Outcome::Degraded, "{id}");
    }
    assert_eq!(v.check("restart").unwrap().outcome(), Outcome::Pass);
    assert_eq!(v.overall(), Outcome::Degraded);
    assert_eq!(c.decide(&cand).unwrap().kind(), DecisionKind::Hold);
}

#[test]
fn lessons_close_only_on_verifier_held_evidence() {
    let (w, mut c) = world("lessons");
    let fx = fixture();
    let obs = c.observe("a fault", b"bytes").unwrap();
    assert_eq!(c.open_lesson("x", &[], "").unwrap_err().code(), "lesson");
    let ghost = bnrose_evolve::digest::hash("no", &[b"such observation"]);
    assert_eq!(
        c.open_lesson("x", &[ghost], "").unwrap_err().code(),
        "lesson"
    );
    let class = c
        .open_lesson("acks survive restart", &[obs], "trust me, fixed")
        .unwrap();

    // a PASSING baseline run cannot reproduce a class
    let f = args(&["format"]);
    let green = c.run_baseline(&cmd("format", &fx, &f), &w.base).unwrap();
    assert_eq!(
        c.reproduce(&class, &green.attempt()).unwrap_err().code(),
        "lesson"
    );

    // a candidate's run is not a run on the implementation in force
    let dir = w.candidate(
        "cand",
        &w.base,
        &[(
            "svc/service.cfg",
            Some("ack=before_write\nrestart_backoff_ms=9\n"),
        )],
    );
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    let r = args(&["restart"]);
    let cand_red = c.run_check(&cand, &cmd("restart", &fx, &r), &dir).unwrap();
    assert_eq!(
        c.reproduce(&class, &cand_red.attempt()).unwrap_err().code(),
        "lesson"
    );

    // a HOLD decision cannot repair; nor can anything before a reproduction
    let hold = c.decide(&cand).unwrap();
    assert_eq!(
        c.record_repair(&class, &hold.digest()).unwrap_err().code(),
        "lesson"
    );
    assert_eq!(
        c.lesson(&class).unwrap().state,
        bnrose_evolve::LessonState::Open,
        "the reflection in the note moved nothing"
    );
}
