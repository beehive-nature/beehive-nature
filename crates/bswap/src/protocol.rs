//! The protocol: phase guards, the refund-before-lock invariant, and the
//! timelock law. Pattern source: BasicSwap's XMR path per SWAP-SORT §5
//! (z2.1 row) — the SEQUENCE is the mechanism that travels:
//!
//! 1. **Setup** — both derive shares; the leader publishes the adaptor
//!    point `T = t·G` (secp256k1).
//! 2. **RefundArmed** — BOTH refund paths exist as artifacts in the
//!    parties' hands BEFORE anyone locks: the follower hands the leader a
//!    signature on the Zano refund (spending the combined lock back to
//!    the leader, valid after the Zano refund time), and the leader holds
//!    the BTC refund shape (its own key, CSV-encumbered, unilateral).
//! 3. **ZanoLocked** — the leader locks to the combined-key point.
//! 4. **BtcLocked** — the follower locks the P2WSH 2-of-2 + CSV output.
//! 5. **AdaptorDelivered** — the follower hands the pre-signature on the
//!    BTC claim; the leader VERIFIES it (adaptor::verify_adaptor) before
//!    treating the swap as live.
//! 6. **Claimed** — the leader completes and publishes; `t` is now public
//!    by construction.
//! 7. **Swept** — the follower extracts `t`, derives the sweep key,
//!    verifies it against the combined lock, and signs the Zano sweep
//!    (the frozen proto's job).
//!
//! Abort/refund exits exist at every phase (see [`Swap`]).

use crate::{adaptor::PreSignature, Error, Result, SwapSecret};
use k256::ecdsa::{SigningKey, VerifyingKey};

/// Timelock parameters, all in seconds (callers convert block counts with
/// their own consensus view; BTC ≈ 10 min/block is the assembler's
/// assumption to make, not this crate's).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Timelocks {
    /// When the leader's Zano refund becomes enforceable (seconds from the
    /// swap start).
    pub zano_refund_at: u64,
    /// When the follower's BTC CSV refund becomes spendable, in the same
    /// clock.
    pub btc_refund_at: u64,
    /// The follower's extraction+sweep window (claim-seen → Zano sweep
    /// confirmed).
    pub sweep_window: u64,
    /// Safety margin on top of the sweep window.
    pub margin: u64,
}

/// **The timelock law.** The dangerous race is the leader's Zano-refund
/// escape vs the follower's post-claim sweep: after the leader claims BTC
/// (revealing `t`), the follower must get the Zano sweep through BEFORE
/// the leader's refund path opens (else the leader could claim the BTC
/// AND claw the Zano back). So:
///
/// `zano_refund_at ≥ btc_refund_at + sweep_window + margin`
///
/// and every deadline must be in the future at validation time (`now`).
/// (The exact constants BasicSwap uses are UNVERIFIED at this seat; the
/// law itself is stated and enforced here.)
pub fn validate_timelocks(t: &Timelocks, now: u64) -> Result<()> {
    if t.zano_refund_at <= t.btc_refund_at {
        return Err(Error::Timelock(
            "zano refund must open after the btc refund",
        ));
    }
    let required = t
        .btc_refund_at
        .checked_add(t.sweep_window)
        .and_then(|v| v.checked_add(t.margin))
        .ok_or(Error::Timelock("overflow"))?;
    if t.zano_refund_at < required {
        return Err(Error::Timelock(
            "zano refund must outlive btc refund + sweep window + margin",
        ));
    }
    if t.btc_refund_at <= now || t.zano_refund_at <= now {
        return Err(Error::Timelock("deadline already passed"));
    }
    Ok(())
}

/// The artifacts each phase hands over — every transition VERIFIES what it
/// is given; nothing is trusted on word.
#[derive(Clone, Debug)]
pub struct Swap {
    /// The follower's BTC claim key (pre-signature signer).
    pub btc_claim_key: SigningKey,
    /// The adaptor point T = t·G (leader's secret on the BTC curve).
    pub adaptor: VerifyingKey,
    /// The digest the BTC claim signature commits to (sighash fixture —
    /// the tx assembler's digest; this crate verifies over it).
    pub claim_digest: [u8; 32],
    state: Phase,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Phase {
    /// Shares derived, adaptor point published.
    Setup,
    /// Refund artifacts verified in both directions.
    RefundArmed,
    /// Zano combined-key lock confirmed.
    ZanoLocked,
    /// BTC P2WSH lock confirmed.
    BtcLocked,
    /// Pre-signature delivered AND verified by the leader.
    AdaptorDelivered,
    /// Leader's completed signature published (t now public).
    Claimed,
    /// Follower's sweep key derived and checked against the lock.
    Swept,
    /// An abort exit was taken (refund shape chosen).
    Refunded(&'static str),
}

impl Swap {
    pub fn new(btc_claim_key: SigningKey, adaptor: VerifyingKey, claim_digest: [u8; 32]) -> Self {
        Swap {
            btc_claim_key,
            adaptor,
            claim_digest,
            state: Phase::Setup,
        }
    }

    pub fn phase(&self) -> Phase {
        self.state
    }

    /// Phase 2: refunds armed — the caller attests the refund artifacts
    /// were exchanged; the gate refuses to open if the timelock law does
    /// not hold for the swap's own deadlines.
    pub fn arm_refunds(&mut self, t: &Timelocks, now: u64) -> Result<()> {
        if self.state != Phase::Setup {
            return Err(Error::Phase("refunds arm once, from setup"));
        }
        validate_timelocks(t, now)?;
        self.state = Phase::RefundArmed;
        Ok(())
    }

    /// Phase 3-4: locks. Refuse to lock before refunds are armed — the
    /// invariant that makes the swap strand-proof.
    pub fn lock_zano(&mut self) -> Result<()> {
        if self.state != Phase::RefundArmed {
            return Err(Error::Phase("REFUSE to lock Zano before refunds are armed"));
        }
        self.state = Phase::ZanoLocked;
        Ok(())
    }

    pub fn lock_btc(&mut self) -> Result<()> {
        if self.state != Phase::ZanoLocked {
            return Err(Error::Phase("REFUSE to lock BTC before Zano is locked"));
        }
        self.state = Phase::BtcLocked;
        Ok(())
    }

    /// Phase 5: the follower's pre-signature — VERIFIED on receipt (a bad
    /// pre-signature is indistinguishable from theft intent). With the
    /// leader's secret `t` in hand (the real path) the COMPLETER'S gate
    /// runs: the equation AND `R_f == t·R` — a pre-signature encrypted to
    /// any other point is refused. Without `t` only the public equation
    /// runs (adaptor-blind — see adaptor::verify_adaptor).
    pub fn deliver_adaptor(
        &mut self,
        pre: &PreSignature,
        leader_t: Option<&SwapSecret>,
    ) -> Result<()> {
        if self.state != Phase::BtcLocked {
            return Err(Error::Phase("adaptor delivers after the btc lock"));
        }
        let vk = VerifyingKey::from(&self.btc_claim_key);
        let ok = match leader_t {
            Some(t) => crate::adaptor::verify_adaptor_as_completer(&vk, t, &self.claim_digest, pre),
            None => crate::adaptor::verify_adaptor(&vk, &self.adaptor, &self.claim_digest, pre),
        };
        if !ok {
            return Err(Error::VerifyFailed("pre-signature rejected"));
        }
        self.state = Phase::AdaptorDelivered;
        Ok(())
    }

    /// Phase 6: the leader completes and publishes (publication is the
    /// wallet lane's; here the completion artifact is produced and the
    /// phase advances only for a valid one).
    pub fn claim(&mut self, pre: &PreSignature, t: &SwapSecret) -> Result<[u8; 64]> {
        if self.state != Phase::AdaptorDelivered {
            return Err(Error::Phase("claim after a verified adaptor"));
        }
        let fin = crate::adaptor::complete(pre, t)?;
        self.state = Phase::Claimed;
        Ok(fin)
    }

    /// Phase 7: the follower extracts, derives, and CHECKS the sweep key
    /// against the expected combined-lock point.
    pub fn sweep(
        &mut self,
        pre: &PreSignature,
        published_sig: &[u8; 64],
        follower_share: &crate::zano::LockShare,
        combined_lock: &curve25519_dalek::edwards::EdwardsPoint,
    ) -> Result<crate::zano::LockShare> {
        if self.state != Phase::Claimed {
            return Err(Error::Phase("sweep after the claim is live"));
        }
        let t = crate::adaptor::extract(pre, published_sig, &self.adaptor)?;
        let sweep = crate::zano::sweep_secret(&t, follower_share);
        if !crate::zano::sweep_matches(&sweep, combined_lock) {
            return Err(Error::VerifyFailed(
                "sweep key does not open the combined lock",
            ));
        }
        self.state = Phase::Swept;
        Ok(sweep)
    }

    /// Abort exit — refund paths, from any pre-claim phase.
    pub fn abort(&mut self, why: &'static str) -> Result<()> {
        if matches!(self.state, Phase::Claimed | Phase::Swept) {
            return Err(Error::Phase("too late to abort — the claim is live"));
        }
        self.state = Phase::Refunded(why);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::zano::LockShare;
    use k256::FieldBytes;

    fn setup() -> (
        Swap,
        SwapSecret,
        LockShare,
        curve25519_dalek::edwards::EdwardsPoint,
    ) {
        let follower_sk = SigningKey::from_bytes(&FieldBytes::from([7u8; 32])).unwrap();
        let t: SwapSecret = [0x6B; 32];
        let adaptor = crate::adaptor::adaptor_point(&t).unwrap();
        let digest = [3u8; 32];
        let follower_share = LockShare::from_bytes32(&[8u8; 32]);
        let leader_share = LockShare::from_bytes32(&t);
        let lock = crate::zano::combined_lock(&leader_share, &follower_share);
        (
            Swap::new(follower_sk, adaptor, digest),
            t,
            follower_share,
            lock,
        )
    }

    fn locks() -> Timelocks {
        Timelocks {
            zano_refund_at: 10_000,
            btc_refund_at: 6_000,
            sweep_window: 600,
            margin: 600,
        }
    }

    #[test]
    fn happy_path_full_machine() {
        let (mut sw, t, follower_share, lock) = setup();
        assert!(matches!(sw.phase(), Phase::Setup));
        sw.arm_refunds(&locks(), 1_000).unwrap();
        sw.lock_zano().unwrap();
        sw.lock_btc().unwrap();
        let pre =
            crate::adaptor::sign_adaptor(&sw.btc_claim_key, &sw.adaptor, &sw.claim_digest).unwrap();
        sw.deliver_adaptor(&pre, Some(&t)).unwrap();
        let fin = sw.claim(&pre, &t).unwrap();
        let sweep = sw.sweep(&pre, &fin, &follower_share, &lock).unwrap();
        assert!(crate::zano::sweep_matches(&sweep, &lock));
        assert!(matches!(sw.phase(), Phase::Swept));
    }

    #[test]
    fn no_lock_before_refunds_armed() {
        let (mut sw, ..) = setup();
        assert_eq!(
            sw.lock_zano().unwrap_err(),
            Error::Phase("REFUSE to lock Zano before refunds are armed")
        );
    }

    #[test]
    fn btc_never_locks_before_zano() {
        let (mut sw, ..) = setup();
        sw.arm_refunds(&locks(), 1_000).unwrap();
        assert_eq!(
            sw.lock_btc().unwrap_err(),
            Error::Phase("REFUSE to lock BTC before Zano is locked")
        );
    }

    #[test]
    fn bad_presignature_refused() {
        let (mut sw, t, ..) = setup();
        sw.arm_refunds(&locks(), 1_000).unwrap();
        sw.lock_zano().unwrap();
        sw.lock_btc().unwrap();
        // a pre-signature for a DIFFERENT digest must not open the gate
        let other =
            crate::adaptor::sign_adaptor(&sw.btc_claim_key, &sw.adaptor, &[9u8; 32]).unwrap();
        assert_eq!(
            sw.deliver_adaptor(&other, Some(&t)).unwrap_err(),
            Error::VerifyFailed("pre-signature rejected")
        );
        // and a pre-signature encrypted to ANOTHER adaptor point must fail
        // the completer's gate (adaptor-blindness closed here)
        let foreign = crate::adaptor::adaptor_point(&[0xEE; 32]).unwrap();
        let alien =
            crate::adaptor::sign_adaptor(&sw.btc_claim_key, &foreign, &sw.claim_digest).unwrap();
        assert_eq!(
            sw.deliver_adaptor(&alien, Some(&t)).unwrap_err(),
            Error::VerifyFailed("pre-signature rejected")
        );
    }

    #[test]
    fn timelock_law_enforced() {
        // zano refund not far enough past the sweep window
        let mut t = locks();
        t.zano_refund_at = 6_500;
        assert!(validate_timelocks(&t, 0).is_err());
        // deadlines in the past
        let mut t2 = locks();
        t2.btc_refund_at = 1;
        assert!(validate_timelocks(&t2, 2).is_err());
        assert!(validate_timelocks(&locks(), 0).is_ok());
    }

    #[test]
    fn abort_before_claim_is_allowed_after_is_not() {
        let (mut sw, ..) = setup();
        sw.arm_refunds(&locks(), 1_000).unwrap();
        sw.lock_zano().unwrap();
        sw.abort("counterparty stalled before the btc lock")
            .unwrap();
        assert!(matches!(sw.phase(), Phase::Refunded(_)));
        let (mut sw2, t2, ..) = setup();
        sw2.arm_refunds(&locks(), 1_000).unwrap();
        sw2.lock_zano().unwrap();
        sw2.lock_btc().unwrap();
        let pre = crate::adaptor::sign_adaptor(&sw2.btc_claim_key, &sw2.adaptor, &sw2.claim_digest)
            .unwrap();
        sw2.deliver_adaptor(&pre, Some(&t2)).unwrap();
        sw2.claim(&pre, &t2).unwrap();
        assert!(sw2.abort("too late").is_err());
    }
}
