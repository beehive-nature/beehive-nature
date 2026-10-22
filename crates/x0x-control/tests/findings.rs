//! Regression tests for the independent safety review (2026-10-22).
//! Each test names the finding it pins.

use std::collections::HashSet;
use x0x_control::envelope::{open_order, seal_order, KemIdentity};
use x0x_control::exec::execute_order;
use x0x_control::order::{CommandRule, Order, Policy, Probe, Verdict};

fn order(scope: &str, argv: Vec<String>) -> Order {
    Order {
        id: "t-1".to_string(),
        scope: scope.to_string(),
        argv,
        stdin: None,
        issued_by: "test".to_string(),
        nonce: "n-1".to_string(),
        timeout_secs: 5,
        expires_at: u64::MAX,
        pre: vec![],
        post: vec![],
    }
}

fn policy() -> Policy {
    let mut p = Policy::default();
    p.scopes.insert(
        "diag.readonly".to_string(),
        vec![CommandRule {
            argv0: "/bin/true".to_string(),
            max_args: 0,
            arg_prefixes: vec![],
        }],
    );
    p
}

fn sealed(o: &Order, id: &KemIdentity) -> x0x_control::SealedEnvelope {
    seal_order(o, &id.public).unwrap()
}

/// Finding 1: probe argv must pass the same scope gate as order argv.
#[test]
fn finding1_probe_outside_scope_is_refused() {
    let id = KemIdentity::generate().unwrap();
    let mut o = order("diag.readonly", vec!["/bin/true".to_string()]);
    o.pre = vec![Probe {
        argv: vec!["/bin/evil".to_string()],
        expect_exit: 0,
        stdout_contains: None,
    }];
    let env = sealed(&o, &id);
    let opened = open_order(&env, &id).unwrap();
    let mut seen = HashSet::new();
    let out = execute_order(&opened, &policy(), &env, &mut seen);
    assert_eq!(out.receipt.verdict, Verdict::RefusedScope);
    assert!(out.receipt.exec.is_none(), "nothing may execute");
}

/// Finding 7: replay refusal carries the honest verdict name.
#[test]
fn finding7_replay_verdict_is_refused_replay() {
    let id = KemIdentity::generate().unwrap();
    let o = order("diag.readonly", vec!["/bin/true".to_string()]);
    let env = sealed(&o, &id);
    let opened = open_order(&env, &id).unwrap();
    let mut seen = HashSet::new();
    seen.insert("n-1".to_string());
    let out = execute_order(&opened, &policy(), &env, &mut seen);
    assert_eq!(out.receipt.verdict, Verdict::RefusedReplay);
    assert_eq!(out.exit_code, 2);
}

/// Scope gate on the order argv itself (the original boundary).
#[test]
fn order_outside_scope_is_refused() {
    let id = KemIdentity::generate().unwrap();
    let o = order("diag.readonly", vec!["/bin/rm".to_string()]);
    let env = sealed(&o, &id);
    let opened = open_order(&env, &id).unwrap();
    let mut seen = HashSet::new();
    let out = execute_order(&opened, &policy(), &env, &mut seen);
    assert_eq!(out.receipt.verdict, Verdict::RefusedScope);
}

/// Finding 2 (partial): sealing is public-key only — a wrong-key
/// open fails, and tampering fails; sender auth is documented as
/// transport/policy responsibility in the README threat model.
#[test]
fn wrong_key_and_tamper_fail_closed() {
    let id = KemIdentity::generate().unwrap();
    let other = KemIdentity::generate().unwrap();
    let o = order("diag.readonly", vec!["/bin/true".to_string()]);
    let env = sealed(&o, &id);
    assert!(open_order(&env, &other).is_err());
    let mut bad = env.clone();
    bad.cipher_b64 = format!("A{}", &bad.cipher_b64[1..]);
    assert!(open_order(&bad, &id).is_err());
}

/// Finding 8 documentation companion: prefix matching is literal —
/// policy authors must terminate path prefixes (README states it).
#[test]
fn prefix_matching_is_literal() {
    let rule = CommandRule {
        argv0: "/bin/cat".to_string(),
        max_args: 1,
        arg_prefixes: vec!["/etc/nixos".to_string()],
    };
    assert!(rule.allows(&["/bin/cat".into(), "/etc/nixos-evil".into()]));
    let safe = CommandRule {
        arg_prefixes: vec!["/etc/nixos/".to_string()],
        ..rule
    };
    assert!(!safe.allows(&["/bin/cat".into(), "/etc/nixos-evil".into()]));
}
