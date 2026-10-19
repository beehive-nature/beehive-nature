//! The whole loop, on both embedded engines, in real processes:
//! observe → reproduce → propose → verify → canary → promote → close the
//! failure class → recurrence check → restart rebuilds every fact.

use super::common::*;

use bnrose_evolve::evidence::ExecStatus;
use bnrose_evolve::{DecisionKind, LessonState, Outcome};

const INVARIANT: &str = "an acknowledged write survives a crash and restart";

#[test]
fn full_loop_both_engines() {
    for engine in engines() {
        full_loop(engine);
    }
}

fn full_loop(engine: &'static str) {
    let w = World::new(&format!("life-{engine}"), engine);
    let fx = fixture();
    let (mut c, rep) = w.open();
    assert_eq!(rep.records, 0, "{engine}: fresh state");
    w.adopt(&mut c, &Knobs::default());
    let baseline = c.current().unwrap();

    // observe + reproduce: the verifier's own required check fails on the baseline
    let a = args(&["restart"]);
    let red = c.run_baseline(&cmd("restart", &fx, &a), &w.base).unwrap();
    assert_eq!(
        red.status(),
        &ExecStatus::Ran { code: 1 },
        "{engine}: defect reproduces"
    );
    let raw = c
        .blob(&red.stdout_digest())
        .unwrap()
        .expect("raw stdout kept");
    assert!(String::from_utf8_lossy(&raw).contains("lost across restart"));
    let obs = c
        .observe("restart lost an acknowledged write", &raw)
        .unwrap();
    let class = c
        .open_lesson(
            INVARIANT,
            &[obs],
            "the agent's reflection: ack ordering, probably",
        )
        .unwrap();
    c.reproduce(&class, &red.attempt()).unwrap();
    assert_eq!(c.lesson(&class).unwrap().state, LessonState::Reproduced);

    // propose: the agent repairs the writable config only
    let dir = w.candidate("cand-fix", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);

    // verify
    run_required(&mut c, &cand, &dir);
    let v = c.verify(&cand).unwrap();
    assert_eq!(v.overall(), Outcome::Pass, "{engine}: {v:?}");

    // canary, then promote
    run_canary(&mut c, &cand, &dir);
    let d = c.decide(&cand).unwrap();
    assert_eq!(
        d.kind(),
        DecisionKind::Promote,
        "{engine}: {:?}",
        d.reasons()
    );
    assert_eq!(d.replaces(), baseline);
    assert_eq!(d.scope(), "all-peers");
    assert_eq!(c.current(), Some(d.artifact()));
    assert!(d.usage_known() > 0, "the attempts' measured usage is bound");

    // the class closes on the promoted verdict, then a recurrence check on
    // the implementation now in force stays green
    c.record_repair(&class, &d.digest()).unwrap();
    assert_eq!(c.lesson(&class).unwrap().state, LessonState::Closed);
    let again = c.run_baseline(&cmd("restart", &fx, &a), &dir).unwrap();
    assert_eq!(
        c.recurrence(&class, &again.attempt()).unwrap(),
        Outcome::Pass
    );
    assert_eq!(c.lesson(&class).unwrap().state, LessonState::Closed);

    let head = c.head();
    let exposure = c.exposure();
    let decisions = c.decisions().len();
    drop(c);

    // a restart rebuilds the same facts from the journal alone
    let (c2, rep2) = w.open();
    assert_eq!(rep2.head, head.1, "{engine}: same head");
    assert!(rep2.unresolved.is_empty() && rep2.never_dispatched.is_empty());
    assert_eq!(c2.current(), Some(d.artifact()));
    assert_eq!(c2.exposure(), exposure);
    assert_eq!(c2.decisions().len(), decisions);
    let l = c2.lesson(&class).unwrap();
    assert_eq!(l.state, LessonState::Closed);
    assert_eq!(l.reproductions, vec![red.attempt()]);
    assert_eq!(l.recurrence_checks, vec![(again.attempt(), Outcome::Pass)]);
    assert_eq!(c2.head(), head, "{engine}: opening wrote nothing new");
    eprintln!(
        "LIFECYCLE {engine}: records={} head={} exposure={} decision={}",
        head.0,
        head.1,
        exposure,
        d.digest()
    );
}

/// The verifier gets stronger (storage fault injection at a new verifier
/// revision, adopted by the sovereign over the promoted implementation). The
/// same required check, run on the implementation in force, now FAILS: the
/// class reopens, and a fresh repair is needed.
#[test]
fn a_stronger_verifier_reopens_a_closed_class() {
    let w = World::new("recur", "sqlite");
    let fx = fixture();
    let (mut c, _) = w.open();
    w.adopt(&mut c, &Knobs::default());
    let a = args(&["restart"]);
    let red = c.run_baseline(&cmd("restart", &fx, &a), &w.base).unwrap();
    let obs = c.observe("lost ack", b"evidence").unwrap();
    let class = c.open_lesson(INVARIANT, &[obs], "").unwrap();
    c.reproduce(&class, &red.attempt()).unwrap();
    let dir = w.candidate("fix", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    run_required(&mut c, &cand, &dir);
    run_canary(&mut c, &cand, &dir);
    let d = c.decide(&cand).unwrap();
    assert_eq!(d.kind(), DecisionKind::Promote);
    c.record_repair(&class, &d.digest()).unwrap();
    assert_eq!(c.lesson(&class).unwrap().state, LessonState::Closed);

    let v2 = Knobs {
        verifier_rev: "verifier-r2-fault-injection".into(),
        restart_args: args(&["restart", "--fault-injection"]),
        ..Knobs::default()
    };
    w.adopt(&mut c, &v2);
    // the old pinned command is no longer the restart check
    let old = c.run_baseline(&cmd("restart", &fx, &a), &dir).unwrap_err();
    assert_eq!(old.code(), "verifier:unpinned");
    let strong = args(&["restart", "--fault-injection"]);
    let rerun = c.run_baseline(&cmd("restart", &fx, &strong), &dir).unwrap();
    assert_eq!(rerun.status(), &ExecStatus::Ran { code: 1 });
    assert_eq!(
        c.recurrence(&class, &rerun.attempt()).unwrap(),
        Outcome::Fail
    );
    let l = c.lesson(&class).unwrap();
    assert_eq!(l.state, LessonState::Recurred);
    assert_eq!(l.repairs.len(), 1, "the old repair stays on the record");

    // the old repair cannot reclose it: its verdict was judged under the
    // verifier that has since been strengthened
    let err = c.record_repair(&class, &d.digest()).unwrap_err();
    assert_eq!(err.code(), "lesson", "{err}");
    assert_eq!(c.lesson(&class).unwrap().state, LessonState::Recurred);
}

/// The implementation in force is what the latest SOVEREIGN act or promotion
/// says it is: a policy that declares an older baseline puts it back in force,
/// and a proposal cut from the superseded promotion is stale.
#[test]
fn the_sovereign_declares_what_is_in_force() {
    let w = World::new("in-force", "sqlite");
    let (mut c, _) = w.open();
    w.adopt(&mut c, &Knobs::default());
    let original = c.current().unwrap();
    let dir = w.candidate("fix", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    run_required(&mut c, &cand, &dir);
    run_canary(&mut c, &cand, &dir);
    let promoted = c.decide(&cand).unwrap().artifact();
    assert_eq!(c.current(), Some(promoted));

    let t = w.policy_text(
        &Knobs {
            verifier_rev: "verifier-r1-reset".into(),
            ..Knobs::default()
        },
        original,
    );
    c.adopt_policy(&t, &w.sovereign.envelope(t.as_bytes()))
        .unwrap();
    assert_eq!(c.current(), Some(original));

    let next = w.candidate(
        "next",
        &dir,
        &[("svc/main.txt", Some("counter service v2\n"))],
    );
    let p = w.proposal(promoted, &next, &["svc/main.txt"], "built on the promotion");
    let e = c
        .admit(&p, &w.agent.envelope(p.as_bytes()), &dir, &next)
        .unwrap_err();
    assert_eq!(e.code(), "proposal:stale-base");
    drop(c);
    let (c, _) = w.open();
    assert_eq!(c.current(), Some(original), "replay agrees");
}

/// Isolates the policy guard on repairs: a promotion judged under the old,
/// weaker verifier — one that never repaired this class — cannot close a class
/// the stronger verifier in force reproduced.
#[test]
fn an_old_promotion_cannot_close_what_a_stronger_verifier_reproduced() {
    let w = World::new("old-promo", "sqlite");
    let fx = fixture();
    let (mut c, _) = w.open();
    w.adopt(&mut c, &Knobs::default());
    let dir = w.candidate("fix", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    run_required(&mut c, &cand, &dir);
    run_canary(&mut c, &cand, &dir);
    let old = c.decide(&cand).unwrap();
    assert_eq!(old.kind(), DecisionKind::Promote);

    w.adopt(
        &mut c,
        &Knobs {
            verifier_rev: "verifier-r2-fault-injection".into(),
            restart_args: args(&["restart", "--fault-injection"]),
            ..Knobs::default()
        },
    );
    let strong = args(&["restart", "--fault-injection"]);
    let red = c.run_baseline(&cmd("restart", &fx, &strong), &dir).unwrap();
    let obs = c.observe("lying fsync loses acked writes", b"run").unwrap();
    let class = c.open_lesson(INVARIANT, &[obs], "").unwrap();
    c.reproduce(&class, &red.attempt()).unwrap();
    let err = c.record_repair(&class, &old.digest()).unwrap_err();
    assert_eq!(err.code(), "lesson", "{err}");
    assert_eq!(c.lesson(&class).unwrap().state, LessonState::Reproduced);
}

/// Isolates the replay guard: under ONE policy, a class closes, the
/// environment drifts, the same check fails on the implementation in force,
/// the class recurs — and the decision that closed it once cannot close it
/// again.
#[test]
fn a_recurrence_under_the_same_policy_needs_a_new_repair() {
    let w = World::new("drift", "sqlite");
    let fx = fixture();
    let marker = w.root.join("environment-drift.marker");
    let drift_args = args(&["drift", marker.to_str().unwrap()]);
    let (mut c, _) = w.open();
    w.adopt(
        &mut c,
        &Knobs {
            extra: vec![("drift".into(), drift_args.clone())],
            ..Knobs::default()
        },
    );
    std::fs::write(&marker, b"drifted").unwrap();
    let red = c
        .run_baseline(&cmd("drift", &fx, &drift_args), &w.base)
        .unwrap();
    let obs = c.observe("environment drift", b"run").unwrap();
    let class = c
        .open_lesson("the service tolerates its environment", &[obs], "")
        .unwrap();
    c.reproduce(&class, &red.attempt()).unwrap();
    std::fs::remove_file(&marker).unwrap();

    let dir = w.candidate("fix", &w.base, &[("svc/service.cfg", Some(FIXED_CFG))]);
    let cand = w.admit(&mut c, &w.base, &dir, &["svc/service.cfg"]);
    run_required(&mut c, &cand, &dir);
    c.run_check(&cand, &cmd("drift", &fx, &drift_args), &dir)
        .unwrap();
    run_canary(&mut c, &cand, &dir);
    let d = c.decide(&cand).unwrap();
    assert_eq!(d.kind(), DecisionKind::Promote, "{:?}", d.reasons());
    c.record_repair(&class, &d.digest()).unwrap();
    assert_eq!(c.lesson(&class).unwrap().state, LessonState::Closed);

    std::fs::write(&marker, b"drifted again").unwrap();
    let again = c
        .run_baseline(&cmd("drift", &fx, &drift_args), &dir)
        .unwrap();
    assert_eq!(
        c.recurrence(&class, &again.attempt()).unwrap(),
        Outcome::Fail
    );
    assert_eq!(c.lesson(&class).unwrap().state, LessonState::Recurred);
    let err = c.record_repair(&class, &d.digest()).unwrap_err();
    assert_eq!(err.code(), "lesson", "{err}");
    assert_eq!(c.lesson(&class).unwrap().state, LessonState::Recurred);
}
