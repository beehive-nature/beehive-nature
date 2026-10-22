//! The truth lattice: consensus = log fold; faults convict the specimen
//! UI; the adapter UI disputes instead of lying. Plus the battery's teeth.

use crate::common::{assert_fold_equals_chain, run_history, world, Collector, T0};
use btungsten_wb002::chain::{Chain, Profile};
use btungsten_wb002::lattice::{reconstruct, AdapterUI, Indexer, Scope, SpecimenUI, DISPUTED};
use btungsten_wb002::log::{sha, Event, Val};

fn upto(c: &Chain, seq: u64) -> Vec<Event> {
    c.log.iter().filter(|e| e.seq <= seq).cloned().collect()
}

#[test]
fn the_truth_lattice() {
    let mut c = world(Profile::Specimen, T0);
    let mut col = Collector::default();
    run_history(&mut c, 260, 777, &mut col);
    assert_fold_equals_chain(&mut c, "lattice setup");
    let anchor = c.checkpoint_anchor().expect("history crossed a checkpoint");
    let tip = c.tip_anchor();
    let cp_seq = anchor.seq;
    // a DECISIVE move inside the checkpoint-to-tip window, not the tail
    let n = c.log.len() as u64;
    let victim = c
        .log
        .iter()
        .rev()
        .find(|e| e.ty() == "move" && e.seq > cp_seq && e.seq < n - 1)
        .cloned()
        .expect("a move after the checkpoint");
    let vid = victim.id("assetid").unwrap();
    let truth = c.sovereign_of(vid);
    assert!(truth.is_some(), "victim asset must still exist");

    let mut lies = 0;
    type Fault<'a> = (&'a str, Box<dyn Fn(&mut Indexer) + 'a>);
    let faults: Vec<Fault> = vec![
        ("dropped move", Box::new(|ix| ix.drop_seq(victim.seq))),
        (
            "corrupted move",
            Box::new(|ix| ix.corrupt(victim.seq, "to", Val::from("mallory"))),
        ),
        ("replayed tail", Box::new(move |ix| ix.replay(n - 1))),
    ];
    for (name, fault) in &faults {
        let mut ix = Indexer::default();
        ix.feed(&c.log);
        fault(&mut ix);
        let specimen = SpecimenUI(&ix).display_owner(vid);
        if specimen != truth && specimen.as_deref() != Some(DISPUTED) {
            lies += 1;
        }
        let adapter = AdapterUI {
            indexer: &ix,
            checkpoint: Some(anchor.clone()),
            tip: tip.clone(),
        }
        .display_owner(vid);
        assert_eq!(
            adapter.as_deref(),
            Some(DISPUTED),
            "{name}: the adapter UI answered {adapter:?}"
        );
    }
    assert!(
        lies >= 1,
        "no fault misled the specimen UI: the injections lost their teeth"
    );

    // lag: an honest-but-behind indexer answers at its authenticated height
    let truth_at_cp = reconstruct(&upto(&c, cp_seq)).sovereign(vid);
    let k = ((cp_seq + 1 + n) / 2) as usize;
    let mut ix = Indexer::default();
    ix.feed(&c.log[..k]);
    let r = AdapterUI {
        indexer: &ix,
        checkpoint: Some(anchor.clone()),
        tip: None,
    }
    .display(vid);
    assert_eq!(r.scope, Scope::CheckpointScoped);
    assert_eq!(r.owner, Some(truth_at_cp.clone()));
    let mut short = Indexer::default();
    short.feed(&c.log[..cp_seq as usize]);
    assert_eq!(
        AdapterUI {
            indexer: &short,
            checkpoint: Some(anchor.clone()),
            tip: None
        }
        .display_owner(vid)
        .as_deref(),
        Some(DISPUTED)
    );

    // clean feed: both tell the truth; the adapter checkpoint-scoped without
    // a tip bracket, current with one
    let mut ix = Indexer::default();
    ix.feed(&c.log);
    assert_eq!(SpecimenUI(&ix).display_owner(vid), truth);
    let no_tip = AdapterUI {
        indexer: &ix,
        checkpoint: Some(anchor.clone()),
        tip: None,
    }
    .display(vid);
    assert_eq!(
        (no_tip.scope, no_tip.owner),
        (Scope::CheckpointScoped, Some(truth_at_cp))
    );
    let with_tip = AdapterUI {
        indexer: &ix,
        checkpoint: Some(anchor),
        tip,
    }
    .display(vid);
    assert_eq!(
        (with_tip.scope, with_tip.owner),
        (Scope::AuthenticatedTip, Some(truth))
    );
}

#[test]
fn teeth_the_battery_convicts_its_own_naive_postures() {
    let mut c = world(Profile::Specimen, T0);
    let mut col = Collector::default();
    run_history(&mut c, 120, 999, &mut col);
    // 1: the trust-the-indexer UI must lie under a dropped event
    let victim = c
        .log
        .iter()
        .rev()
        .find(|e| e.ty() == "move")
        .cloned()
        .unwrap();
    let vid = victim.id("assetid").unwrap();
    let truth = c.sovereign_of(vid);
    let mut ix = Indexer::default();
    ix.feed(&c.log);
    ix.drop_seq(victim.seq);
    assert_ne!(
        SpecimenUI(&ix).display_owner(vid),
        truth,
        "teeth stale: dropping the last move no longer misleads the specimen UI"
    );
    // 2: a flipped sovereign changes the commitment
    let bundle = c.export_state();
    let mut tampered = bundle.clone();
    tampered.assets[0].sovereign = Some("mallory".into());
    assert_ne!(
        Chain::state_commitment(&tampered),
        Chain::state_commitment(&bundle)
    );
    // 3: a forged root fails chain verification
    let mut forged = c.log.clone();
    forged.last_mut().unwrap().root = sha("forged");
    let mut ix2 = Indexer::default();
    ix2.feed(&forged);
    assert!(
        !ix2.chain_consistent(),
        "teeth stale: a forged root passes verification"
    );
    let mut ix3 = Indexer::default();
    ix3.feed(&c.log);
    assert!(ix3.chain_consistent(), "control: the honest log verifies");
}
