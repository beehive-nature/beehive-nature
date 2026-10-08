//! bTunGsTeN Workbench 002 — the Rust twin of `sovereign` / `step` from
//! `scripts/btungsten/wb002-cryptol/BTungstenWB002.cry`.
//!
//! Written as ordinary Rust, not a transliteration: raw bytes are decoded
//! into a phase and a head, and the seam table is one guarded `match`. SAW
//! (`../wb002-saw/sovereign.saw`) proves this function equal to the Cryptol
//! `step` for every well-formed state and every action; the Cryptol file
//! proves `sovereignContinuity` of that `step`. Neither proof says anything
//! about the JS port or the 2021 wasm.
//!
//! Domain: a status byte with a tag the machine never constructs (5..=255)
//! is malformed. Sovereignty still reads the holder there (matching the
//! spec), but `step` refuses every action on it; SAW's equivalence is
//! stated over well-formed tags only, and says so.

/// One account, as the spec abstracts it.
pub type Actor = u8;

/// Sovereignty state of one asset: the raw record the spec calls `Status`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Status {
    pub tag: u8,
    pub holder: Actor,
    pub lender: Actor,
    pub offeree: Actor,
}

/// An action head with the actor whose signature accompanies it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Action {
    pub head: u8,
    pub signer: Actor,
    pub to: Actor,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Phase {
    Free,
    Delegated,
    Offered,
    Contained,
    Gone,
}

impl Phase {
    fn of(tag: u8) -> Option<Phase> {
        match tag {
            0 => Some(Phase::Free),
            1 => Some(Phase::Delegated),
            2 => Some(Phase::Offered),
            3 => Some(Phase::Contained),
            4 => Some(Phase::Gone),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Head {
    Transfer,
    Offer,
    Claim,
    Cancel,
    Delegate,
    Return,
    Undelegate,
    Redelegate,
    Attach,
    Detach,
    Burn,
}

impl Head {
    fn of(head: u8) -> Option<Head> {
        match head {
            0 => Some(Head::Transfer),
            1 => Some(Head::Offer),
            2 => Some(Head::Claim),
            3 => Some(Head::Cancel),
            4 => Some(Head::Delegate),
            5 => Some(Head::Return),
            6 => Some(Head::Undelegate),
            7 => Some(Head::Redelegate),
            8 => Some(Head::Attach),
            9 => Some(Head::Detach),
            10 => Some(Head::Burn),
            _ => None,
        }
    }
}

fn free(a: Actor) -> Status {
    Status {
        tag: 0,
        holder: a,
        lender: a,
        offeree: a,
    }
}

fn delegated(lender: Actor, borrower: Actor) -> Status {
    Status {
        tag: 1,
        holder: borrower,
        lender,
        offeree: lender,
    }
}

fn offered(offerer: Actor, offeree: Actor) -> Status {
    Status {
        tag: 2,
        holder: offerer,
        lender: offerer,
        offeree,
    }
}

fn contained(holder: Actor) -> Status {
    Status {
        tag: 3,
        holder,
        lender: holder,
        offeree: holder,
    }
}

const GONE: Status = Status {
    tag: 4,
    holder: 0,
    lender: 0,
    offeree: 0,
};

/// Who holds sovereign authority: the lender while delegated, nobody once
/// burned, otherwise the holder.
pub fn sovereign(s: Status) -> Actor {
    match Phase::of(s.tag) {
        Some(Phase::Delegated) => s.lender,
        Some(Phase::Gone) => 0,
        _ => s.holder,
    }
}

/// One transition. Unauthorized or inapplicable actions return the state
/// unchanged: the implementation refuses, and refusal is a no-op to a
/// sovereignty oracle.
pub fn step(s: Status, a: Action) -> Status {
    let (Some(phase), Some(head)) = (Phase::of(s.tag), Head::of(a.head)) else {
        return s;
    };
    let by_sovereign = a.signer == sovereign(s);
    let by_holder = a.signer == s.holder;
    match (head, phase) {
        // the sovereign moves a free, delegated or contained asset
        (Head::Transfer, Phase::Free | Phase::Delegated | Phase::Contained) if by_sovereign => {
            free(a.to)
        }
        // the borrower hands the asset back to its lender
        (Head::Transfer, Phase::Delegated) if by_holder && a.to == s.lender => free(a.to),
        (Head::Offer, Phase::Free) if by_sovereign => offered(a.signer, a.to),
        // standing consent, cashed by the offeree
        (Head::Claim, Phase::Offered) if a.signer == s.offeree => free(a.signer),
        (Head::Cancel, Phase::Offered) if by_sovereign => free(a.signer),
        (Head::Delegate, Phase::Free) if by_sovereign => delegated(a.signer, a.to),
        // the borrower returns at any time
        (Head::Return, Phase::Delegated) if by_holder => free(s.lender),
        // the lender reclaims (the period is outside this abstraction)
        (Head::Undelegate, Phase::Delegated) if a.signer == s.lender => free(s.lender),
        // possession moves onward; sovereignty never does
        (Head::Redelegate, Phase::Delegated) if by_holder => delegated(s.lender, a.to),
        (Head::Attach, Phase::Free) if by_sovereign => contained(a.to),
        (Head::Detach, Phase::Contained) if by_sovereign => free(a.signer),
        (Head::Burn, phase) if by_sovereign && phase != Phase::Gone => GONE,
        _ => s,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALICE: Actor = 1;
    const BOB: Actor = 2;
    const CAROL: Actor = 3;

    fn act(head: u8, signer: Actor, to: Actor) -> Action {
        Action { head, signer, to }
    }

    /// The spec's invariant, restated in Rust for the sampled leg.
    fn continuity(s: Status, a: Action) -> bool {
        sovereign(step(s, a)) == sovereign(s)
            || sovereign(s) == a.signer
            || (s.tag == 2 && s.offeree == a.signer)
    }

    #[test]
    fn named_seams() {
        // a stranger cannot move what the sovereign holds
        assert_eq!(step(free(ALICE), act(0, BOB, BOB)), free(ALICE));
        assert_eq!(step(free(ALICE), act(0, ALICE, BOB)), free(BOB));
        // offer -> claim is consent; the wrong offeree is refused
        let o = step(free(ALICE), act(1, ALICE, BOB));
        assert_eq!(o, offered(ALICE, BOB));
        assert_eq!(step(o, act(2, CAROL, CAROL)), o);
        assert_eq!(step(o, act(2, BOB, BOB)), free(BOB));
        // redelegation moves possession, never sovereignty
        let d = step(free(ALICE), act(4, ALICE, BOB));
        assert_eq!(sovereign(d), ALICE);
        let r = step(d, act(7, BOB, CAROL));
        assert_eq!((r.holder, sovereign(r)), (CAROL, ALICE));
        // the borrower can only hand back to the lender
        assert_eq!(step(d, act(0, BOB, CAROL)), d);
        assert_eq!(step(d, act(0, BOB, ALICE)), free(ALICE));
        // burn ends sovereignty; a burned asset stays burned
        assert_eq!(sovereign(step(free(ALICE), act(10, ALICE, 0))), 0);
        assert_eq!(step(GONE, act(10, 0, 0)), GONE);
        // a malformed status is refused whole
        let bad = Status {
            tag: 9,
            holder: ALICE,
            lender: ALICE,
            offeree: ALICE,
        };
        assert_eq!(step(bad, act(0, ALICE, BOB)), bad);
    }

    /// Exhaustive over a four-actor universe: every tag byte 0..=7, every
    /// head 0..=15, every holder/lender/offeree/signer/to in {0,1,2,3} —
    /// 8 * 16 * 4^5 = 131072 transitions. Sampled evidence for the
    /// invariant (the universal result is the Cryptol :prove, and the
    /// Rust-to-spec link is SAW's).
    #[test]
    fn continuity_small_universe() {
        let mut n = 0u32;
        for tag in 0..8u8 {
            for head in 0..16u8 {
                for holder in 0..4 {
                    for lender in 0..4 {
                        for offeree in 0..4 {
                            for signer in 0..4 {
                                for to in 0..4 {
                                    let s = Status {
                                        tag,
                                        holder,
                                        lender,
                                        offeree,
                                    };
                                    let a = act(head, signer, to);
                                    assert!(continuity(s, a), "{s:?} {a:?}");
                                    n += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
        assert_eq!(n, 131_072);
    }
}
