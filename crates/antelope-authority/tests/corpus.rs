//! The conformance corpus: every row a named vector, every claim an
//! assertion the model can lose. Rows are grouped as the review grouped
//! the requirements: name and authority rules first (the inputs), then the
//! walk (keys, thresholds, delegation, caching, depth, cycles, order), then
//! the transaction gate (minimum permission, irrelevant authority, native
//! refusals, irrelevant signatures), then the three convictions.
//!
//! Vectors are literals. A vector that fails to build (an unsorted
//! authority, a bad name) panics with the named rule, so a corpus typo is a
//! red run, never a silently normalized input.

use antelope_authority::world::{active_name, owner_name};
use antelope_authority::*;

// ---- builders ---------------------------------------------------------------

fn kw(k: &str, w: u16) -> KeyWeight {
    KeyWeight {
        key: Key::new(k),
        weight: w,
    }
}
fn aw(actor: &str, perm: &str, w: u16) -> PermissionLevelWeight {
    PermissionLevelWeight {
        permission: PermissionLevel::of(actor, perm),
        weight: w,
    }
}
fn ww(sec: u32, w: u16) -> WaitWeight {
    WaitWeight {
        wait_sec: sec,
        weight: w,
    }
}
fn auth(
    threshold: u32,
    keys: Vec<KeyWeight>,
    accounts: Vec<PermissionLevelWeight>,
    waits: Vec<WaitWeight>,
) -> Authority {
    let a = Authority::new(threshold, keys, accounts, waits);
    if let Err(e) = a.validate() {
        panic!("corpus vector builds an invalid authority: {e}");
    }
    a
}
fn pl(actor: &str, perm: &str) -> PermissionLevel {
    PermissionLevel::of(actor, perm)
}
/// An account whose owner and active are each one key.
fn account(w: &mut World, name: &str, owner_key: &str, active_key: &str) {
    w.add_account(
        &n(name),
        Authority::key(Key::new(owner_key)),
        Authority::key(Key::new(active_key)),
    )
    .unwrap_or_else(|e| panic!("account {name}: {e}"));
}
/// An account whose active is the given authority (owner one key).
fn account_with_active(w: &mut World, name: &str, owner_key: &str, active: Authority) {
    w.add_account(&n(name), Authority::key(Key::new(owner_key)), active)
        .unwrap_or_else(|e| panic!("account {name}: {e}"));
}
fn custom(w: &mut World, owner: &str, name: &str, parent: &str, a: Authority) {
    w.add_permission(&n(owner), &n(name), &n(parent), a)
        .unwrap_or_else(|e| panic!("permission {owner}@{name}: {e}"));
}
fn check(w: &World, level: &PermissionLevel, p: &Provided, f: Faults) -> Verdict {
    let mut c = Checker::new(w, p, f);
    c.satisfied(level, None).expect("the walk refused")
}
fn depth_of_lookup(v: &Verdict, level: &PermissionLevel) -> Option<u16> {
    v.trace.iter().find_map(|s| match s {
        Step::Lookup { level: l, depth } if l == level => Some(*depth),
        _ => None,
    })
}

// ---- names (name.cpp:9-33, name.hpp:16-40) ----------------------------------

#[test]
fn name_rules_accept_what_the_chain_accepts() {
    for ok in ["eosio", "alice", "a.b", "12345abcdefgj", "eosio.token", "a"] {
        assert!(Name::parse(ok).is_ok(), "{ok} must parse");
    }
    assert!(Name::empty().is_empty());
    assert_eq!(Name::empty().value(), 0);
}

#[test]
fn name_rules_refuse_by_the_named_rule() {
    assert_eq!(Name::parse("abcdefghijklmn"), Err(NameError::TooLong));
    assert_eq!(Name::parse("Alice"), Err(NameError::BadChar));
    assert_eq!(Name::parse("alice6"), Err(NameError::BadChar));
    assert_eq!(Name::parse("alice0"), Err(NameError::BadChar));
    assert_eq!(Name::parse("al-ce"), Err(NameError::BadChar));
    assert_eq!(Name::parse("abcdefghijklk"), Err(NameError::ThirteenthChar));
    assert_eq!(Name::parse("alice."), Err(NameError::TrailingDot));
}

#[test]
fn name_value_is_the_chain_u64_and_orders_names() {
    // PUBLIC-CONSTANT: the well-known encodings of "eosio" and "eosio.token"
    assert_eq!(n("eosio").value(), 0x5530_ea00_0000_0000);
    assert_eq!(n("eosio.token").value(), 0x5530_ea03_3482_a600);
    assert!(n("a") < n("b"));
    assert!(n("1") < n("a"));
    assert!(n("alice") < n("alice1"));
    assert!(n("a.b") < n("ab"));
    assert!(n("aaaaaaaaaaaa") < n("z"));
    assert!(pl("alice", "owner") < pl("bob", "active"));
    assert!(pl("bob", "active") < pl("bob", "owner"));
}

// ---- authority validation (authority.hpp:309-353) ---------------------------

#[test]
fn validate_refuses_each_rule_by_name() {
    let k = Key::new("K1");
    let bad = |a: Authority| a.validate().unwrap_err();
    assert_eq!(
        bad(Authority::new(0, vec![kw("K1", 1)], vec![], vec![])),
        AuthorityError::ZeroThreshold
    );
    assert_eq!(
        bad(Authority::new(
            1,
            vec![kw("K2", 1), kw("K1", 1)],
            vec![],
            vec![]
        )),
        AuthorityError::KeysUnsorted
    );
    assert_eq!(
        bad(Authority::new(
            1,
            vec![kw("K1", 1), kw("K1", 1)],
            vec![],
            vec![]
        )),
        AuthorityError::KeysUnsorted
    );
    assert_eq!(
        bad(Authority::new(
            1,
            vec![],
            vec![aw("bob", "active", 1), aw("alice", "active", 1)],
            vec![]
        )),
        AuthorityError::AccountsUnsorted
    );
    assert_eq!(
        bad(Authority::new(
            1,
            vec![],
            vec![aw("bob", "active", 1), aw("bob", "active", 1)],
            vec![]
        )),
        AuthorityError::AccountsUnsorted
    );
    assert_eq!(
        bad(Authority::new(1, vec![], vec![], vec![ww(0, 1)])),
        AuthorityError::ZeroWait
    );
    assert_eq!(
        bad(Authority::new(1, vec![], vec![], vec![ww(10, 1), ww(5, 1)])),
        AuthorityError::WaitsUnsorted
    );
    assert_eq!(
        bad(Authority::new(
            3,
            vec![kw("K1", 1)],
            vec![],
            vec![ww(10, 1)]
        )),
        AuthorityError::Unreachable
    );
    assert_eq!(Authority::key(k).validate(), Ok(()));
    let many: Vec<KeyWeight> = (0..=(1 << 16))
        .map(|i| kw(&format!("K{i:06}"), 1))
        .collect();
    assert_eq!(
        bad(Authority::new(1, many, vec![], vec![])),
        AuthorityError::TooManyEntries
    );
}

// ---- the walk: keys, thresholds -------------------------------------------

#[test]
fn one_key_satisfies_active_and_the_trace_says_where() {
    let mut w = World::new();
    account(&mut w, "alice", "KO", "KA");
    let v = check(
        &w,
        &pl("alice", "active"),
        &Provided::keys(&["KA"]),
        Faults::NONE,
    );
    assert!(v.satisfied);
    assert_eq!(v.lookups(), vec![pl("alice", "active")]);
    assert!(v.has(|s| matches!(s, Step::KeyUsed { key, depth: 1 } if key.0 == "KA")));
    assert!(v.has(|s| matches!(
        s,
        Step::Resolved { level, depth: 0, status: Status::Satisfied } if *level == pl("alice", "active")
    )));

    let v = check(
        &w,
        &pl("alice", "active"),
        &Provided::keys(&["KO"]),
        Faults::NONE,
    );
    assert!(
        !v.satisfied,
        "the owner key does not satisfy active by itself"
    );
    assert!(v.has(|s| matches!(s, Step::KeysReverted { depth: 1 })));

    let v = check(
        &w,
        &pl("alice", "owner"),
        &Provided::keys(&["KO"]),
        Faults::NONE,
    );
    assert!(v.satisfied);
}

#[test]
fn threshold_sums_weights() {
    let mut w = World::new();
    account_with_active(
        &mut w,
        "alice",
        "KO",
        auth(
            3,
            vec![kw("K1", 1), kw("K2", 2), kw("K3", 2)],
            vec![],
            vec![],
        ),
    );
    let a = pl("alice", "active");
    assert!(check(&w, &a, &Provided::keys(&["K2", "K3"]), Faults::NONE).satisfied);
    assert!(check(&w, &a, &Provided::keys(&["K1", "K2"]), Faults::NONE).satisfied);
    assert!(!check(&w, &a, &Provided::keys(&["K1"]), Faults::NONE).satisfied);
    assert!(!check(&w, &a, &Provided::keys(&["K2"]), Faults::NONE).satisfied);
    assert!(!check(&w, &a, &Provided::keys(&[]), Faults::NONE).satisfied);
}

#[test]
fn an_unknown_level_is_unsatisfied_not_an_error() {
    let w = World::new();
    let v = check(
        &w,
        &pl("nobody", "active"),
        &Provided::keys(&["K"]),
        Faults::NONE,
    );
    assert!(!v.satisfied);
    assert!(v.has(
        |s| matches!(s, Step::NotFound { level, depth: 0 } if *level == pl("nobody", "active"))
    ));
}

// ---- delegation: the referenced permission, by its own name ----------------

/// alice@active delegates to bob@custom. bob has active (KBA) and custom
/// (KBC). The chain looks up bob@custom (`authority_checker.hpp:230`).
fn world_delegating_to_custom() -> World {
    let mut w = World::new();
    account_with_active(
        &mut w,
        "alice",
        "KAO",
        Authority::account(pl("bob", "custom")),
    );
    account(&mut w, "bob", "KBO", "KBA");
    custom(
        &mut w,
        "bob",
        "custom",
        "active",
        Authority::key(Key::new("KBC")),
    );
    w
}

#[test]
fn delegation_follows_the_referenced_permission_name() {
    let w = world_delegating_to_custom();
    let a = pl("alice", "active");
    let v = check(&w, &a, &Provided::keys(&["KBC"]), Faults::NONE);
    assert!(v.satisfied);
    assert_eq!(
        v.lookups(),
        vec![pl("alice", "active"), pl("bob", "custom")]
    );
    assert_eq!(depth_of_lookup(&v, &pl("bob", "custom")), Some(1));

    let v = check(&w, &a, &Provided::keys(&["KBA"]), Faults::NONE);
    assert!(!v.satisfied, "bob@active is not bob@custom");
    assert!(
        !v.lookups().contains(&pl("bob", "active")),
        "the chain never asks for bob@active here"
    );
}

#[test]
fn convict_class_1_following_under_the_enclosing_permission_name() {
    let w = world_delegating_to_custom();
    let a = pl("alice", "active");
    // over-approval: bob's ACTIVE key is accepted where custom was required
    let faithful = check(&w, &a, &Provided::keys(&["KBA"]), Faults::NONE);
    let faulty = check(
        &w,
        &a,
        &Provided::keys(&["KBA"]),
        Faults::CLASS_1_PARENT_NAME,
    );
    assert!(!faithful.satisfied);
    assert!(faulty.satisfied, "class 1 approves what the chain refuses");
    assert_eq!(
        faulty.lookups(),
        vec![pl("alice", "active"), pl("bob", "active")]
    );
    // under-approval: the key that DOES satisfy custom is refused
    let faithful = check(&w, &a, &Provided::keys(&["KBC"]), Faults::NONE);
    let faulty = check(
        &w,
        &a,
        &Provided::keys(&["KBC"]),
        Faults::CLASS_1_PARENT_NAME,
    );
    assert!(faithful.satisfied);
    assert!(!faulty.satisfied, "class 1 refuses what the chain approves");
}

// ---- the cache is keyed by actor@permission ---------------------------------

#[test]
fn cache_is_keyed_by_actor_at_permission_not_by_actor() {
    // alice@active needs 2: bob@active (KBA) AND bob@custom (KBC)
    let mut w = World::new();
    account_with_active(
        &mut w,
        "alice",
        "KAO",
        auth(
            2,
            vec![],
            vec![aw("bob", "active", 1), aw("bob", "custom", 1)],
            vec![],
        ),
    );
    account(&mut w, "bob", "KBO", "KBA");
    custom(
        &mut w,
        "bob",
        "custom",
        "active",
        Authority::key(Key::new("KBC")),
    );
    let a = pl("alice", "active");
    assert!(check(&w, &a, &Provided::keys(&["KBA", "KBC"]), Faults::NONE).satisfied);
    let v = check(&w, &a, &Provided::keys(&["KBA"]), Faults::NONE);
    assert!(!v.satisfied, "one of the two bob permissions is not both");
    assert_eq!(
        v.lookups(),
        vec![
            pl("alice", "active"),
            pl("bob", "active"),
            pl("bob", "custom")
        ],
        "both bob levels are looked up: a different level is a different question"
    );
}

#[test]
fn convict_class_2_deduplicating_by_account() {
    // over-approval: the second bob level inherits the first verdict
    let mut w = World::new();
    account_with_active(
        &mut w,
        "alice",
        "KAO",
        auth(
            2,
            vec![],
            vec![aw("bob", "active", 1), aw("bob", "custom", 1)],
            vec![],
        ),
    );
    account(&mut w, "bob", "KBO", "KBA");
    custom(
        &mut w,
        "bob",
        "custom",
        "active",
        Authority::key(Key::new("KBC")),
    );
    let a = pl("alice", "active");
    let faithful = check(&w, &a, &Provided::keys(&["KBA"]), Faults::NONE);
    let faulty = check(
        &w,
        &a,
        &Provided::keys(&["KBA"]),
        Faults::CLASS_2_ACTOR_DEDUPE,
    );
    assert!(!faithful.satisfied);
    assert!(
        faulty.satisfied,
        "class 2 counts bob@custom on the strength of bob@active"
    );
    assert!(faulty.has(|s| matches!(
        s,
        Step::CacheHit { level, status: Status::Satisfied, .. } if *level == pl("bob", "custom")
    )));

    // under-approval: an unsatisfied first level poisons a satisfied second
    let mut w = World::new();
    account_with_active(
        &mut w,
        "alice",
        "KAO",
        auth(
            1,
            vec![],
            vec![aw("bob", "aaa", 1), aw("bob", "bbb", 1)],
            vec![],
        ),
    );
    account(&mut w, "bob", "KBO", "KBA");
    custom(
        &mut w,
        "bob",
        "aaa",
        "active",
        Authority::key(Key::new("KA")),
    );
    custom(
        &mut w,
        "bob",
        "bbb",
        "active",
        Authority::key(Key::new("KB")),
    );
    let faithful = check(&w, &a, &Provided::keys(&["KB"]), Faults::NONE);
    let faulty = check(
        &w,
        &a,
        &Provided::keys(&["KB"]),
        Faults::CLASS_2_ACTOR_DEDUPE,
    );
    assert!(faithful.satisfied);
    assert!(
        !faulty.satisfied,
        "class 2 refuses bob@bbb because bob@aaa failed"
    );
}

// ---- cycles and the depth bound -------------------------------------------

#[test]
fn an_indirect_cycle_terminates_through_the_being_evaluated_status() {
    let mut w = World::new();
    account_with_active(
        &mut w,
        "aaa",
        "KAO",
        Authority::account(pl("bbb", "active")),
    );
    account_with_active(
        &mut w,
        "bbb",
        "KBO",
        Authority::account(pl("aaa", "active")),
    );
    let v = check(&w, &pl("aaa", "active"), &Provided::keys(&[]), Faults::NONE);
    assert!(!v.satisfied);
    assert!(v.has(|s| matches!(
        s,
        Step::CacheHit { level, depth: 2, status: Status::BeingEvaluated } if *level == pl("aaa", "active")
    )));
    assert_eq!(v.lookups().len(), 2, "each level is looked up once");
}

#[test]
fn convict_class_3_unbounded_walk_on_a_cycle_exhausts_the_budget() {
    // a deep recursion needs its own stack; the point is that it ENDS in a
    // named refusal, never in a hang
    let t = std::thread::Builder::new()
        .stack_size(64 << 20)
        .spawn(|| {
            let mut w = World::new();
            account_with_active(
                &mut w,
                "aaa",
                "KAO",
                Authority::account(pl("bbb", "active")),
            );
            account_with_active(
                &mut w,
                "bbb",
                "KBO",
                Authority::account(pl("aaa", "active")),
            );
            let mut c = Checker::new(&w, &Provided::keys(&[]), Faults::CLASS_3_UNBOUNDED);
            c.satisfied(&pl("aaa", "active"), None)
        })
        .unwrap();
    let r = t.join().unwrap();
    assert_eq!(
        r,
        Err(Refusal::StepBudgetExhausted {
            steps: STEP_BUDGET + 1
        }),
        "class 3 never reaches a verdict on a cycle"
    );
}

/// `hops` account edges from the top permission to the one holding the key.
fn chain(hops: usize, depth_limit: u16) -> World {
    let mut w = World::with_config(ChainConfig {
        max_authority_depth: depth_limit,
        ..ChainConfig::default()
    });
    let names: Vec<String> = (0..=hops)
        .map(|i| format!("link{}", (b'a' + i as u8) as char))
        .collect();
    for i in 0..=hops {
        let active = if i == hops {
            Authority::key(Key::new("KEND"))
        } else {
            Authority::account(PermissionLevel::new(n(&names[i + 1]), active_name()))
        };
        account_with_active(&mut w, &names[i], "KO", active);
    }
    w
}

/// `max_authority_depth = 6` (`config.hpp:80`) is a bound on the visitor
/// depth, and the declared permission itself is visited at depth 0 with its
/// authority evaluated at depth 1 (`authority_checker.hpp:92-93,239`). So
/// FIVE delegation edges beyond the declared permission are followed (the
/// fifth lands an authority at depth 6, whose keys count) and a sixth edge,
/// referenced at depth 6, is not (`:224`). A tool that reads "depth 6" as
/// "six hops" approves one hop the chain refuses.
#[test]
fn depth_bound_six_from_config_follows_five_edges_and_refuses_the_sixth() {
    assert_eq!(ChainConfig::default().max_authority_depth, 6);
    let top = pl("linka", "active");
    let v = check(&chain(5, 6), &top, &Provided::keys(&["KEND"]), Faults::NONE);
    assert!(
        v.satisfied,
        "five edges: the key in the authority at depth 6 counts"
    );
    assert!(v.has(|s| matches!(s, Step::KeyUsed { depth: 6, .. })));
    assert_eq!(depth_of_lookup(&v, &pl("linkf", "active")), Some(5));

    let v = check(&chain(6, 6), &top, &Provided::keys(&["KEND"]), Faults::NONE);
    assert!(
        !v.satisfied,
        "six edges: the sixth is referenced at depth 6 and not followed"
    );
    assert!(v.has(|s| matches!(
        s,
        Step::DepthLimit { level, depth: 6 } if *level == pl("linkg", "active")
    )));
    assert!(!v.lookups().contains(&pl("linkg", "active")));
}

#[test]
fn depth_bound_one_counts_only_the_own_keys_of_the_level() {
    let top = pl("linka", "active");
    assert!(check(&chain(0, 1), &top, &Provided::keys(&["KEND"]), Faults::NONE).satisfied);
    let v = check(&chain(1, 1), &top, &Provided::keys(&["KEND"]), Faults::NONE);
    assert!(!v.satisfied);
    assert!(v.has(|s| matches!(s, Step::DepthLimit { depth: 1, .. })));
}

#[test]
fn convict_class_3_unbounded_walk_approves_past_the_depth_bound() {
    let top = pl("linka", "active");
    let faithful = check(&chain(6, 6), &top, &Provided::keys(&["KEND"]), Faults::NONE);
    let faulty = check(
        &chain(6, 6),
        &top,
        &Provided::keys(&["KEND"]),
        Faults::CLASS_3_UNBOUNDED,
    );
    assert!(!faithful.satisfied);
    assert!(
        faulty.satisfied,
        "class 3 approves a delegation the chain will not follow"
    );
}

#[test]
fn depth_artifact_an_unsatisfied_verdict_cached_deep_is_reused_shallow() {
    // T -> aaaa -> bbbb -> cccc -> dddd -> pppp -> qqqq(KEY), and T -> pppp.
    // pppp is reached first through the long path at depth 5, where its own
    // edge to qqqq sits at depth 6 and is not followed; pppp is cached
    // UNSATISFIED; the direct T -> pppp edge then reads the cache. The chain
    // answers NO although a direct walk would say yes. (`authority_checker.hpp:
    // 224,237-246,248-250`)
    let mut w = World::new();
    account_with_active(
        &mut w,
        "tttt",
        "KO",
        auth(
            1,
            vec![],
            vec![aw("aaaa", "active", 1), aw("pppp", "active", 1)],
            vec![],
        ),
    );
    account_with_active(
        &mut w,
        "aaaa",
        "KO",
        Authority::account(pl("bbbb", "active")),
    );
    account_with_active(
        &mut w,
        "bbbb",
        "KO",
        Authority::account(pl("cccc", "active")),
    );
    account_with_active(
        &mut w,
        "cccc",
        "KO",
        Authority::account(pl("dddd", "active")),
    );
    account_with_active(
        &mut w,
        "dddd",
        "KO",
        Authority::account(pl("pppp", "active")),
    );
    account_with_active(
        &mut w,
        "pppp",
        "KO",
        Authority::account(pl("qqqq", "active")),
    );
    account(&mut w, "qqqq", "KO", "KEY");
    let v = check(
        &w,
        &pl("tttt", "active"),
        &Provided::keys(&["KEY"]),
        Faults::NONE,
    );
    assert!(!v.satisfied, "the order-dependent artifact, reproduced");
    assert_eq!(depth_of_lookup(&v, &pl("pppp", "active")), Some(5));
    assert!(v.has(|s| matches!(
        s,
        Step::CacheHit { level, depth: 1, status: Status::Unsatisfied } if *level == pl("pppp", "active")
    )));

    // the same structure with the direct edge sorted FIRST is satisfied and
    // never walks the long path
    let mut w = World::new();
    account_with_active(
        &mut w,
        "tttt",
        "KO",
        auth(
            1,
            vec![],
            vec![aw("pppp", "active", 1), aw("zzzz", "active", 1)],
            vec![],
        ),
    );
    account_with_active(
        &mut w,
        "zzzz",
        "KO",
        Authority::account(pl("bbbb", "active")),
    );
    account_with_active(
        &mut w,
        "bbbb",
        "KO",
        Authority::account(pl("cccc", "active")),
    );
    account_with_active(
        &mut w,
        "cccc",
        "KO",
        Authority::account(pl("dddd", "active")),
    );
    account_with_active(
        &mut w,
        "dddd",
        "KO",
        Authority::account(pl("pppp", "active")),
    );
    account_with_active(
        &mut w,
        "pppp",
        "KO",
        Authority::account(pl("qqqq", "active")),
    );
    account(&mut w, "qqqq", "KO", "KEY");
    let v = check(
        &w,
        &pl("tttt", "active"),
        &Provided::keys(&["KEY"]),
        Faults::NONE,
    );
    assert!(v.satisfied);
    assert!(!v.lookups().contains(&pl("zzzz", "active")));
}

// ---- provided permissions, waits, used keys, order ---------------------------

#[test]
fn a_provided_permission_short_circuits_without_a_lookup() {
    let w = world_delegating_to_custom();
    let a = pl("alice", "active");
    let p = Provided::keys(&[]).with_permission(pl("bob", "custom"));
    let v = check(&w, &a, &p, Faults::NONE);
    assert!(v.satisfied);
    assert_eq!(v.lookups(), vec![pl("alice", "active")]);
    assert!(v.has(|s| matches!(
        s,
        Step::CacheHit { level, depth: 1, status: Status::Satisfied } if *level == pl("bob", "custom")
    )));
    // the wildcard form {actor, ""} covers every permission of the actor
    let p = Provided::keys(&[]).with_permission(PermissionLevel::any_of(&n("bob")));
    assert!(check(&w, &a, &p, Faults::NONE).satisfied);
    // a provided permission for the top level itself answers at depth 0
    let p = Provided::keys(&[]).with_permission(pl("alice", "active"));
    let v = check(&w, &a, &p, Faults::NONE);
    assert!(v.satisfied);
    assert!(v.lookups().is_empty());
}

#[test]
fn waits_count_only_under_a_sufficient_delay_and_the_ceiling_is_unlimited() {
    let mut w = World::new();
    account_with_active(
        &mut w,
        "alice",
        "KO",
        auth(2, vec![kw("K", 1)], vec![], vec![ww(3600, 1)]),
    );
    let a = pl("alice", "active");
    assert!(
        check(
            &w,
            &a,
            &Provided::keys(&["K"]).with_delay(3600),
            Faults::NONE
        )
        .satisfied
    );
    assert!(
        !check(
            &w,
            &a,
            &Provided::keys(&["K"]).with_delay(3599),
            Faults::NONE
        )
        .satisfied
    );
    assert!(!check(&w, &a, &Provided::keys(&["K"]), Faults::NONE).satisfied);
    let ceiling = ChainConfig::default().max_transaction_delay as u64;
    assert_eq!(ceiling, 45 * 24 * 3600);
    let c = Checker::new(
        &w,
        &Provided::keys(&["K"]).with_delay(ceiling),
        Faults::NONE,
    );
    assert_eq!(c.effective_delay(), u64::MAX);
    let c = Checker::new(
        &w,
        &Provided::keys(&["K"]).with_delay(ceiling - 1),
        Faults::NONE,
    );
    assert_eq!(c.effective_delay(), ceiling - 1);
}

#[test]
fn keys_marked_inside_a_failed_authority_are_reverted() {
    // alice@active: bob@active (weight 2, evaluated first) needs K1+K2;
    // alice's own key K (weight 1) suffices. Only K1 is provided for bob.
    let mut w = World::new();
    account_with_active(
        &mut w,
        "alice",
        "KAO",
        auth(1, vec![kw("K", 1)], vec![aw("bob", "active", 2)], vec![]),
    );
    account_with_active(
        &mut w,
        "bob",
        "KBO",
        auth(2, vec![kw("K1", 1), kw("K2", 1)], vec![], vec![]),
    );
    let p = Provided::keys(&["K", "K1"]);
    let mut c = Checker::new(&w, &p, Faults::NONE);
    let v = c.satisfied(&pl("alice", "active"), None).unwrap();
    assert!(v.satisfied);
    assert!(v.has(|s| matches!(s, Step::KeyUsed { key, depth: 2 } if key.0 == "K1")));
    assert!(v.has(|s| matches!(s, Step::KeysReverted { depth: 2 })));
    assert_eq!(c.used_keys(), vec![Key::new("K")]);
    assert_eq!(c.unused_keys(), vec![Key::new("K1")]);
}

#[test]
fn evaluation_order_is_weight_then_waits_keys_accounts() {
    // higher weight first: K2 (2) is used, K1 (1) is never needed
    let mut w = World::new();
    account_with_active(
        &mut w,
        "alice",
        "KO",
        auth(1, vec![kw("K1", 1), kw("K2", 2)], vec![], vec![]),
    );
    let mut c = Checker::new(&w, &Provided::keys(&["K1", "K2"]), Faults::NONE);
    let v = c.satisfied(&pl("alice", "active"), None).unwrap();
    assert!(v.satisfied);
    assert!(matches!(&v.trace[1], Step::KeyUsed { key, .. } if key.0 == "K2"));
    assert_eq!(c.unused_keys(), vec![Key::new("K1")]);

    // equal weight: a wait outranks a key outranks an account
    let mut w = World::new();
    account_with_active(
        &mut w,
        "alice",
        "KO",
        auth(
            1,
            vec![kw("K", 1)],
            vec![aw("bob", "active", 1)],
            vec![ww(10, 1)],
        ),
    );
    account(&mut w, "bob", "KBO", "KB");
    let mut c = Checker::new(&w, &Provided::keys(&["K"]).with_delay(10), Faults::NONE);
    let v = c.satisfied(&pl("alice", "active"), None).unwrap();
    assert!(v.satisfied);
    assert!(matches!(
        &v.trace[1],
        Step::WaitCounted { wait_sec: 10, .. }
    ));
    assert_eq!(c.unused_keys(), vec![Key::new("K")]);
    assert!(!v.lookups().contains(&pl("bob", "active")));
}

// ---- the transaction gate ---------------------------------------------------

fn token_world() -> World {
    let mut w = World::new();
    account(&mut w, "alice", "KAO", "KAA");
    custom(
        &mut w,
        "alice",
        "custom",
        "active",
        Authority::key(Key::new("KAC")),
    );
    custom(
        &mut w,
        "alice",
        "deeper",
        "custom",
        Authority::key(Key::new("KAD")),
    );
    account(&mut w, "carol", "KCO", "KCA");
    w
}
fn transfer(auths: Vec<PermissionLevel>) -> Action {
    Action::new(n("eosio.token"), n("transfer"), auths)
}

#[test]
fn minimum_permission_is_active_without_a_link_and_owner_satisfies_it() {
    let w = token_world();
    let v = check_authorization(
        &w,
        &[transfer(vec![pl("alice", "active")])],
        &Provided::keys(&["KAA"]),
        false,
        Faults::NONE,
    )
    .unwrap();
    assert!(v.satisfied());
    assert_eq!(
        v.minimums,
        vec![(pl("alice", "active"), Some(active_name()))]
    );

    let v = check_authorization(
        &w,
        &[transfer(vec![pl("alice", "owner")])],
        &Provided::keys(&["KAO"]),
        false,
        Faults::NONE,
    )
    .unwrap();
    assert!(v.satisfied(), "owner sits above active");
    assert_eq!(owner_name(), n("owner"));
}

#[test]
fn a_child_permission_is_irrelevant_for_an_unlinked_action() {
    let w = token_world();
    let r = check_authorization(
        &w,
        &[transfer(vec![pl("alice", "custom")])],
        &Provided::keys(&["KAC"]),
        false,
        Faults::NONE,
    );
    assert_eq!(
        r,
        Err(Refusal::IrrelevantAuthority {
            declared: pl("alice", "custom"),
            minimum: pl("alice", "active"),
        })
    );
}

#[test]
fn a_link_lowers_the_minimum_and_ancestors_still_satisfy_it() {
    let mut w = token_world();
    w.link(
        &n("alice"),
        &n("eosio.token"),
        Some(&n("transfer")),
        &n("custom"),
    )
    .unwrap();
    for (declared, key) in [("custom", "KAC"), ("active", "KAA"), ("owner", "KAO")] {
        let v = check_authorization(
            &w,
            &[transfer(vec![pl("alice", declared)])],
            &Provided::keys(&[key]),
            false,
            Faults::NONE,
        )
        .unwrap();
        assert!(
            v.satisfied(),
            "alice@{declared} satisfies the linked minimum"
        );
        assert_eq!(v.minimums[0].1, Some(n("custom")));
    }
    // a permission BELOW the linked one is still irrelevant
    let r = check_authorization(
        &w,
        &[transfer(vec![pl("alice", "deeper")])],
        &Provided::keys(&["KAD"]),
        false,
        Faults::NONE,
    );
    assert!(matches!(r, Err(Refusal::IrrelevantAuthority { .. })));
    // the specific link does not cover another action; the contract-wide link does
    let issue = Action::new(n("eosio.token"), n("issue"), vec![pl("alice", "custom")]);
    assert!(matches!(
        check_authorization(
            &w,
            std::slice::from_ref(&issue),
            &Provided::keys(&["KAC"]),
            false,
            Faults::NONE
        ),
        Err(Refusal::IrrelevantAuthority { .. })
    ));
    w.link(&n("alice"), &n("eosio.token"), None, &n("custom"))
        .unwrap();
    assert!(
        check_authorization(&w, &[issue], &Provided::keys(&["KAC"]), false, Faults::NONE)
            .unwrap()
            .satisfied()
    );
}

#[test]
fn eosio_any_link_means_no_minimum_and_an_unknown_level_is_then_merely_unsatisfied() {
    let mut w = token_world();
    w.link(
        &n("alice"),
        &n("eosio.token"),
        Some(&n("transfer")),
        &n("eosio.any"),
    )
    .unwrap();
    let v = check_authorization(
        &w,
        &[transfer(vec![pl("alice", "deeper")])],
        &Provided::keys(&["KAD"]),
        false,
        Faults::NONE,
    )
    .unwrap();
    assert!(v.satisfied());
    assert_eq!(v.minimums, vec![(pl("alice", "deeper"), None)]);
    // no minimum means the declared level is not looked up until the walk,
    // where an absent level is unsatisfied rather than a structural error
    let v = check_authorization(
        &w,
        &[transfer(vec![pl("alice", "ghost")])],
        &Provided::keys(&["KAD"]),
        true,
        Faults::NONE,
    )
    .unwrap();
    assert_eq!(
        v.outcome,
        Outcome::Unsatisfied {
            level: pl("alice", "ghost")
        }
    );
    // without the eosio.any link the same ghost is a structural refusal
    let w = token_world();
    assert_eq!(
        check_authorization(
            &w,
            &[transfer(vec![pl("alice", "ghost")])],
            &Provided::keys(&["KAD"]),
            true,
            Faults::NONE
        ),
        Err(Refusal::UnknownPermission(pl("alice", "ghost")))
    );
}

#[test]
fn the_five_native_authority_actions_refuse_by_name_and_newaccount_does_not() {
    let w = token_world();
    for name in [
        "updateauth",
        "deleteauth",
        "linkauth",
        "unlinkauth",
        "canceldelay",
    ] {
        let act = Action::new(n("eosio"), n(name), vec![pl("alice", "active")]);
        assert_eq!(
            check_authorization(&w, &[act], &Provided::keys(&["KAA"]), false, Faults::NONE),
            Err(Refusal::NativeAuthorityActionNotModeled(n(name)))
        );
    }
    let act = Action::new(n("eosio"), n("newaccount"), vec![pl("alice", "active")]);
    assert!(
        check_authorization(&w, &[act], &Provided::keys(&["KAA"]), false, Faults::NONE)
            .unwrap()
            .satisfied()
    );
}

#[test]
fn irrelevant_signatures_are_refused_unless_allowed() {
    let w = token_world();
    let v = check_authorization(
        &w,
        &[transfer(vec![pl("alice", "active")])],
        &Provided::keys(&["KAA", "KCA"]),
        false,
        Faults::NONE,
    )
    .unwrap();
    assert_eq!(
        v.outcome,
        Outcome::IrrelevantSignatures {
            keys: vec![Key::new("KCA")]
        }
    );
    let v = check_authorization(
        &w,
        &[transfer(vec![pl("alice", "active")])],
        &Provided::keys(&["KAA", "KCA"]),
        true,
        Faults::NONE,
    )
    .unwrap();
    assert!(v.satisfied());
    assert_eq!(v.unused_keys, vec![Key::new("KCA")]);
}

#[test]
fn declared_authorizations_are_checked_in_ascending_order_and_stop_at_the_first_failure() {
    let w = token_world();
    let acts = vec![
        transfer(vec![pl("carol", "active")]),
        transfer(vec![pl("alice", "active")]),
    ];
    let v = check_authorization(&w, &acts, &Provided::keys(&["KAA"]), true, Faults::NONE).unwrap();
    assert_eq!(
        v.outcome,
        Outcome::Unsatisfied {
            level: pl("carol", "active")
        }
    );
    assert_eq!(
        v.checks.len(),
        2,
        "alice first (ascending), then carol fails"
    );
    assert_eq!(v.checks[0].level, pl("alice", "active"));
    assert_eq!(v.checks[1].level, pl("carol", "active"));
    let v = check_authorization(
        &w,
        &acts,
        &Provided::keys(&["KAA", "KCA"]),
        false,
        Faults::NONE,
    )
    .unwrap();
    assert!(v.satisfied());
    assert_eq!(v.used_keys.len(), 2);
}

// ---- world-building refusals -------------------------------------------------

#[test]
fn world_refuses_malformed_structure_by_name() {
    let mut w = World::new();
    account(&mut w, "alice", "KO", "KA");
    assert_eq!(
        w.add_account(
            &n("alice"),
            Authority::key(Key::new("X")),
            Authority::key(Key::new("Y"))
        ),
        Err(Refusal::AccountExists(n("alice")))
    );
    assert_eq!(
        w.add_permission(
            &n("alice"),
            &n("x"),
            &n("nope"),
            Authority::key(Key::new("X"))
        ),
        Err(Refusal::UnknownParent {
            owner: n("alice"),
            parent: n("nope")
        })
    );
    assert_eq!(
        w.add_permission(
            &n("alice"),
            &n("active"),
            &n("owner"),
            Authority::key(Key::new("X"))
        ),
        Err(Refusal::DuplicatePermission(pl("alice", "active")))
    );
    assert_eq!(
        w.add_permission(
            &n("alice"),
            &n("x"),
            &n("active"),
            Authority::new(0, vec![], vec![], vec![])
        ),
        Err(Refusal::AuthorityInvalid(
            pl("alice", "x"),
            AuthorityError::ZeroThreshold
        ))
    );
    assert_eq!(
        w.link(&n("alice"), &n("eosio.token"), None, &n("ghost")),
        Err(Refusal::LinkTargetUnknown(pl("alice", "ghost")))
    );
    assert_eq!(
        w.get_permission(&PermissionLevel::new(n("alice"), Name::empty())),
        Err(Refusal::InvalidPermissionLevel)
    );
    assert_eq!(
        w.satisfies(&pl("alice", "owner"), &pl("alice", "active")),
        Ok(true)
    );
    assert_eq!(
        w.satisfies(&pl("alice", "active"), &pl("alice", "owner")),
        Ok(false)
    );
    assert_eq!(w.permission_count(), 2);
    assert!(!Faults::NONE.any());
    assert_eq!(Faults::default(), Faults::NONE);
    assert!(Faults::CLASS_1_PARENT_NAME.any());
    assert_eq!(
        Refusal::InvalidPermissionLevel.word(),
        "permission:invalid-level"
    );
}
