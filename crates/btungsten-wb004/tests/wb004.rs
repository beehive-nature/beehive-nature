//! The WB004 battery: the 2106 time-extinction boundary, the epochal
//! ladder across it to 3026, and the four laws' teeth. Every row prints
//! its own 0→N count; every refusal is whole-state-checked where the
//! model carries state.

use btungsten_wb004::authority::{Authority, ReceiptLog, Signer};
use btungsten_wb004::epoch::{Engine, PROPOSAL_TTL, SHARD_QUORUM_DEN, SHARD_QUORUM_NUM, T0};
use btungsten_wb004::msig::{Msig, PermissionLevel, MSIG_APPROVALS_CAP};
use btungsten_wb004::time::{
    civil, encode_expiration, encode_expiration_naive, max_ttl, wrapped_target, TimeRep,
    U32_HORIZON,
};
use btungsten_wb004::{sha_hex, Refusal};

fn signers(accounts: &[&str], key: &str, alg: &str) -> Vec<Signer> {
    accounts
        .iter()
        .map(|a| Signer {
            account: a.to_string(),
            key: key.into(),
            alg: alg.into(),
        })
        .collect()
}

fn year_unix(y: i64) -> u64 {
    // good enough for schedule arithmetic (no leap-second claims)
    T0 + (y - 2026) as u64 * 31_556_952
}

/// L4's arithmetic, first-hand: the horizon IS 2106-02-07 06:28:15 UTC,
/// and the naive wire wraps a 2200-era intent into a VALID-LOOKING 2060s
/// expiration — semantic time travel, convicted by name.
#[test]
fn the_2106_boundary_is_exact_and_the_naive_wire_time_travels() {
    assert_eq!(U32_HORIZON, 4_294_967_295);
    let (y, m, d, h, mi, s) = civil(U32_HORIZON);
    assert_eq!((y, m, d, h, mi, s), (2106, 2, 7, 6, 28, 15));
    // a 2200-era target, far beyond the u32 wire
    let t2200 = year_unix(2200);
    assert!(t2200 > U32_HORIZON);
    assert!(
        encode_expiration(TimeRep::U32, t2200).is_err(),
        "fail-closed encoder accepted 2200"
    );
    // the naive truncating encoder would have accepted it — as this:
    let wrapped = wrapped_target(t2200);
    let (wy, _, _, _, _, _) = civil(wrapped);
    assert!(
        (2060..=2070).contains(&wy),
        "the naive wire turned a 2200 intent into a {wy} expiration — valid-looking time travel"
    );
    assert_eq!(encode_expiration_naive(t2200) as u64, wrapped);
    // the successor representation carries the millennium easily
    assert_eq!(
        encode_expiration(TimeRep::U64, year_unix(3026)).unwrap(),
        year_unix(3026)
    );
}

/// As `now` approaches the horizon every representable TTL compresses to
/// zero; migration is not optional. A proposal whose TTL crosses the
/// boundary refuses to exist.
#[test]
fn ttl_compression_toward_the_horizon() {
    assert_eq!(max_ttl(TimeRep::U32, T0), U32_HORIZON - T0);
    let t30d = U32_HORIZON - 30 * 86_400;
    assert_eq!(max_ttl(TimeRep::U32, t30d), 30 * 86_400);
    let mut m = Msig::default();
    let err = m
        .propose(
            "governance",
            "too-late",
            vec![PermissionLevel::new("aggregate", "epoch-1")],
            "d",
            30 * 86_400, // from 29 days out, a 30-day TTL crosses the boundary
            t30d + 86_400,
        )
        .unwrap_err();
    assert_eq!(err.code, "bt-wb004:unrepresentable");
    // 29 days out still fits — the window narrows to nothing
    m.propose(
        "governance",
        "last-days",
        vec![PermissionLevel::new("aggregate", "epoch-1")],
        "d",
        29 * 86_400,
        t30d + 86_400,
    )
    .unwrap();
}

/// The founder's ladder, executed: 65,536 unique active sovereigns, 13
/// epochal cycles 2026 → 3026, signer/key/algorithm rotations, the
/// anchored chain+contract migration AT the 2106 boundary (after proving
/// the u32 wire is already dead there), and the final audit — the 3026
/// verifier rebuilds the whole provenance chain from the receipt log and
/// it equals the live authority.
#[test]
fn the_epochal_ladder_crosses_2106_and_reaches_3026() {
    let mut e = Engine::genesis();
    for id in 0..65_536u64 {
        e.register(id).unwrap();
    }
    // E1 2026 — the u32 era works
    e.now = year_unix(2026);
    let r1 = e
        .epoch_cycle("governance:intent:constitution:v1", &[])
        .unwrap();
    assert_eq!((r1.population, r1.shards_total), (65_536, 256));
    // rotate humans/agents: two founding signers retire, two agents join
    e.rotate(
        &["gov1", "gov2", "gov3"],
        signers(
            &["gov3", "gov4", "gov5", "agent1", "agent2"],
            "K1",
            "ed25519",
        ),
        3,
    )
    .unwrap();
    // E2 2103 — still u32, seven days fit under the horizon
    e.now = year_unix(2103);
    e.epoch_cycle("governance:intent:2103-budget", &[]).unwrap();
    // rotate keys: the ed25519 era ends
    e.rotate(
        &["gov3", "gov4", "agent1"],
        signers(
            &["gov3", "gov4", "gov5", "agent1", "agent2"],
            "K2",
            "dilithium2",
        ),
        3,
    )
    .unwrap();
    // THE BOUNDARY: at 2180 the u32 wire cannot even schedule tomorrow
    e.now = year_unix(2180);
    let err = e
        .msig
        .propose(
            "governance",
            "u32-dead",
            vec![PermissionLevel::new("aggregate", "epoch-3")],
            "d",
            86_400,
            e.now,
        )
        .unwrap_err();
    assert_eq!(err.code, "bt-wb004:unrepresentable");
    // so the era migrates: contract replacement (u64 wire) + chain
    // replacement (anchored authority), quorum-authorized
    e.migrate_representation(&["gov3", "gov4", "gov5"]).unwrap();
    assert_eq!(e.msig.rep, TimeRep::U64);
    // E3 2180 — governance continues on the successor representation
    e.epoch_cycle("governance:intent:post-2106", &[]).unwrap();
    // the long tail: epochs with cryptography migrations interleaved
    e.now = year_unix(2373);
    e.rotate(
        &["gov4", "gov5", "agent1"],
        signers(
            &["gov4", "gov5", "agent1", "agent2", "agent3"],
            "K3",
            "sphincs-imp",
        ),
        3,
    )
    .unwrap();
    e.epoch_cycle("governance:intent:2373", &[]).unwrap();
    e.now = year_unix(2596);
    e.rotate(
        &["gov5", "agent1", "agent2"],
        signers(
            &["gov5", "agent1", "agent2", "agent3", "agent4"],
            "K4",
            "ml-dsa-3019",
        ),
        3,
    )
    .unwrap();
    e.epoch_cycle("governance:intent:2596", &[]).unwrap();
    for (i, y) in [2700, 2800, 2900, 2950, 3000, 3026].iter().enumerate() {
        e.now = year_unix(*y);
        e.epoch_cycle(&format!("governance:intent:tail-{i}"), &[])
            .unwrap();
    }
    // the final audit: the provenance chain verifies and reconstructs
    e.log.verify().unwrap();
    let genesis_authority = {
        let g = Engine::genesis();
        g.authority
    };
    let folded = e.log.fold_authority(&genesis_authority).unwrap();
    assert_eq!(
        folded.signers, e.authority.signers,
        "the 3026 auditor's fold disagrees with the live signer set"
    );
    assert_eq!(folded.threshold, e.authority.threshold);
    assert_eq!(folded.epoch, e.authority.epoch);
    assert!(
        e.unexplained.is_empty(),
        "continuity ledger: {:?}",
        e.unexplained
    );
    // every epoch executed inside a bounded execution layer
    assert!(e.receipts.iter().all(|r| r.msig_levels <= 3));
    let last = e.receipts.last().unwrap();
    assert_eq!(last.year, 3026);
    println!(
        "epochs={} final_head={}",
        e.receipts.len(),
        &last.log_head_after[..12]
    );
}

/// L1's teeth: authority moves only through the CURRENT quorum. An
/// insufficient acting set refuses whole; a STALE full set (valid names
/// from an earlier era, no longer seated) refuses whole; the provenance
/// chain records nothing for either.
#[test]
fn no_transfer_without_the_current_quorum() {
    let mut e = Engine::genesis();
    for id in 0..256u64 {
        e.register(id).unwrap();
    }
    let before = e.authority.snapshot();
    let head = e.log.head();
    // 2-of-5 is below threshold
    let err = e
        .rotate(&["gov1", "gov2"], signers(&["gov1", "gov2"], "K9", "x"), 2)
        .unwrap_err();
    assert_eq!(err.code, "bt-wb004:continuity");
    assert_eq!(e.authority.snapshot(), before);
    assert_eq!(e.log.head(), head, "the refused rotation left a receipt");
    // rotate the seat away, then the OLD full set is stale
    e.rotate(
        &["gov1", "gov2", "gov3"],
        signers(
            &["gov3", "gov4", "gov5", "agent1", "agent2"],
            "K2",
            "dilithium2",
        ),
        3,
    )
    .unwrap();
    let err = e
        .rotate(&["gov1", "gov2", "gov3"], signers(&["gov1"], "K9", "x"), 1)
        .unwrap_err();
    assert_eq!(err.code, "bt-wb004:continuity");
    // the same gate holds for the representation migration
    let err = e.migrate_representation(&["gov4", "agent1"]).unwrap_err();
    assert_eq!(err.code, "bt-wb004:continuity");
    assert_eq!(
        e.msig.rep,
        TimeRep::U32,
        "a refused migration changed the wire"
    );
}

/// The migration anchor's teeth: a tampered bundle refuses; without the
/// anchor check the same tampering would have seated the forger (the
/// teeth are not stale).
#[test]
fn tampered_migration_refused() {
    let e = Engine::genesis();
    let bundle = e.authority.export(&e.log.head());
    let anchor = Authority::commitment(&bundle);
    let mut tampered = bundle.clone();
    tampered.authority.signers[0] = Signer {
        account: "mallory".into(),
        key: "K9".into(),
        alg: "forged".into(),
    };
    let err = Authority::import(&tampered, &anchor).unwrap_err();
    assert_eq!(err.code, "bt-wb004:migration-anchor");
    // teeth: the tampered bundle, if it HAD imported, seats mallory
    let honest = Authority::import(&bundle, &anchor).unwrap();
    assert!(honest.signers.iter().all(|s| s.account != "mallory"));
    assert!(tampered
        .authority
        .signers
        .iter()
        .any(|s| s.account == "mallory"));
}

/// L3, executable: the execution layer's storage is a constant of the
/// EPOCH, never of the population — and the 10B-rows anti-pattern is
/// refused at the door.
#[test]
fn execution_layer_stays_bounded_at_any_population() {
    let mut levels_at_exec = Vec::new();
    for n in [256usize, 4096, 65_536] {
        let mut e = Engine::genesis();
        for id in 0..n as u64 {
            e.register(id).unwrap();
        }
        let r = e.epoch_cycle("governance:intent:scale", &[]).unwrap();
        assert_eq!(r.population, n);
        levels_at_exec.push(r.msig_levels);
        assert_eq!(
            e.msig.stored_levels(),
            0,
            "a settled epoch leaves msig residue"
        );
    }
    assert!(
        levels_at_exec.windows(2).all(|w| w[0] == w[1]),
        "execution-layer size varied with population: {levels_at_exec:?}"
    );
    // the anti-pattern: ten billion permission levels in one proposal
    let mut m = Msig::default();
    let requested: Vec<PermissionLevel> = (0..10_000_000_000usize)
        .take(MSIG_APPROVALS_CAP + 1)
        .map(|i| PermissionLevel::new("human", &format!("seat-{i}")))
        .collect();
    let err = m
        .propose("governance", "planetary", requested, "d", PROPOSAL_TTL, T0)
        .unwrap_err();
    assert_eq!(err.code, "bt-wb004:approvals-cap");
}

/// Axis 1 applied to the governance stack: no indispensable shard, and
/// no indispensable aggregator (the aggregate is order-independent by
/// construction). Kill a shard: quorum holds. Kill a third of them:
/// governance REFUSES rather than proceeding degraded.
#[test]
fn no_indispensable_party() {
    let mut e = Engine::genesis();
    for id in 0..2048u64 {
        e.register(id).unwrap();
    }
    e.epoch_cycle("governance:intent:full", &[]).unwrap();
    // one shard down of eight: quorum holds (2/3 of 8 = 5 needed, 7 prove)
    let r = e.epoch_cycle("governance:intent:minus-one", &[3]).unwrap();
    assert_eq!(r.shards_proving, 7);
    // three shards down (5 proving of 8, needed 5): still holds
    e.epoch_cycle("governance:intent:minus-three", &[0, 1, 2])
        .unwrap();
    // four down (4 proving < 5 needed): REFUSED — no governance without quorum
    let err = e
        .epoch_cycle("governance:intent:minus-four", &[0, 1, 2, 3])
        .unwrap_err();
    assert_eq!(err.code, "bt-wb004:shard-quorum");
    // aggregator determinism: any traversal of the same proofs folds identically
    let mut proofs = e.aggregate("determinism", &[]).shard_proofs.clone();
    let root_a = btungsten_wb004::epoch::Aggregate::fold(1, "determinism", &proofs);
    proofs.reverse();
    let root_b = btungsten_wb004::epoch::Aggregate::fold(1, "determinism", &proofs);
    assert_eq!(root_a, root_b, "the aggregate depended on who folded it");
}

/// The Sybil axis' interface: one human, one seat — duplicates refuse;
/// every epoch's receipt counts the whole registered population as
/// ACTIVE (the L1 requirement is about active sovereigns, not rows).
#[test]
fn uniqueness_one_seat_per_sovereign() {
    let mut e = Engine::genesis();
    for id in 0..512u64 {
        e.register(id).unwrap();
    }
    let err = e.register(7u64).unwrap_err();
    assert_eq!(err.code, "bt-wb004:duplicate");
    let r = e.epoch_cycle("governance:intent:uniqueness", &[]).unwrap();
    assert_eq!(r.population, 512);
}

/// L2's teeth: proposals are short-lived. Past their TTL they refuse to
/// execute; before expiry only the proposer may cancel; after expiry
/// anyone may clean up (specimen-faithful, eosio.msig.cpp:191).
#[test]
fn proposals_never_outlive_their_ttl() {
    let mut m = Msig::default();
    let digest = sha_hex(b"payload");
    m.propose(
        "governance",
        "ephemeral",
        vec![PermissionLevel::new("aggregate", "epoch-1")],
        &digest,
        PROPOSAL_TTL,
        T0,
    )
    .unwrap();
    m.approve("aggregate", "epoch-1", "ephemeral").unwrap();
    // inside the TTL it executes — settling exactly the digested payload
    let d = m.exec(T0 + PROPOSAL_TTL - 1, "ephemeral").unwrap();
    assert_eq!(d, digest);
    // a second proposal left to rot
    m.propose(
        "governance",
        "rotting",
        vec![PermissionLevel::new("aggregate", "epoch-2")],
        "payload2",
        PROPOSAL_TTL,
        T0,
    )
    .unwrap();
    m.approve("aggregate", "epoch-2", "rotting").unwrap();
    // a stranger cannot cancel before expiry; the proposer can
    let err = m.cancel(T0 + 100, "mallory", "rotting").unwrap_err();
    assert_eq!(err.code, "bt-wb004:not-expired");
    m.cancel(T0 + 100, "governance", "rotting").unwrap();
    // and one that truly expires: exec refuses, then anyone may cancel
    m.propose(
        "governance",
        "expired",
        vec![PermissionLevel::new("aggregate", "epoch-3")],
        "payload3",
        PROPOSAL_TTL,
        T0,
    )
    .unwrap();
    m.approve("aggregate", "epoch-3", "expired").unwrap();
    let past = T0 + PROPOSAL_TTL + 1;
    let err = m.exec(past, "expired").unwrap_err();
    assert_eq!(err.code, "bt-wb004:expired");
    m.cancel(past, "mallory", "expired").unwrap();
    assert_eq!(m.proposals.len(), 0);
}

/// The log's own spine: every entry chains, and a single flipped byte
/// anywhere in the provenance chain is caught by the verifier (the
/// receipt the 3026 auditor actually runs).
#[test]
fn the_provenance_chain_detects_tampering() {
    let mut e = Engine::genesis();
    for id in 0..256u64 {
        e.register(id).unwrap();
    }
    e.epoch_cycle("governance:intent:a", &[]).unwrap();
    e.epoch_cycle("governance:intent:b", &[]).unwrap();
    e.log.verify().unwrap();
    // flip one body byte in the middle entry
    let mut tampered = e.log.clone();
    let mid = tampered.entries.len() / 2;
    if tampered.entries[mid].body.starts_with('g') {
        tampered.entries[mid].body.replace_range(0..1, "h");
    } else {
        tampered.entries[mid].body.replace_range(0..1, "g");
    }
    let Refusal { code, .. } = tampered.verify().unwrap_err();
    assert_eq!(code, "bt-wb004:log");
    // and the continuity fold refuses an evidence-free authority change
    let mut forged = ReceiptLog::default();
    forged.append(
        "rotate",
        &[
            ("acting", "mallory".into()),
            ("signers", "mallory".into()),
            ("threshold", "1".into()),
            ("key", "K9".into()),
            ("alg", "forged".into()),
            ("digest", "x".into()),
        ],
    );
    let genesis_authority = Engine::genesis().authority;
    let Refusal { code, .. } = forged.fold_authority(&genesis_authority).unwrap_err();
    assert_eq!(code, "bt-wb004:continuity");
}

/// The shard-quorum arithmetic itself, so the battery's skips above are
/// known-exact rather than trusted.
#[test]
fn shard_quorum_arithmetic() {
    let mut e = Engine::genesis();
    for id in 0..2048u64 {
        e.register(id).unwrap();
    }
    let agg = e.aggregate("x", &[]);
    let needed = agg.shard_proofs.len() * SHARD_QUORUM_NUM / SHARD_QUORUM_DEN;
    assert_eq!(needed, 5, "2/3 of 8 shards");
    agg.verify(8).unwrap();
}
