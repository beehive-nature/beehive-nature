//! Read the founder's Turbo delegated-payment APPROVAL RECEIPT and wire it into
//! the epoch pipeline's real-upload path as per-claimant `x-paid-by` funding (8s).
//!
//! Custody (funded-upload directive, 2026-08-09): the funded wallet and the
//! approvals are **founder-only**. This seat holds only the zero-value uploader
//! signer and the zero-value claimant identities; the *delegate* — the funded
//! approver — is the founder's, and reaches this code ONLY as a public address in
//! the receipt. Nothing here holds, requests, or transmits a funded key.
//!
//! What the receipt carries at the wire level is fixed by the Turbo mechanism,
//! which goose is verifying at source (approval id vs bare address, native caps,
//! expiry). The invariant this module enforces does NOT depend on those optional
//! fields: **per-claimant funding is a property of WHICH DELEGATE pays WHICH
//! item**, and that is `delegate` per `claimant` — present in every receipt shape.
//! The optional fields are carried through as provenance without being trusted.
//!
//! ## The real-upload path this feeds
//!
//! At founder-gate time the runner does, per grant, and only after
//! [`ApprovalReceipt::verify_per_claimant`] passes:
//!
//! ```text
//! ArweaveRail::from_jwk_file(<uploader jwk>, ..).paid_by(grant.delegate).put(item)
//! ```
//!
//! i.e. the zero-value uploader signs each name's DataItem and the grant's funded
//! delegate pays it. The transport is the existing [`crate::arweave`] `put` path;
//! this module supplies the *verified* per-claimant plan it consumes. No upload is
//! performed here — an invariant must not depend on holding a funded key
//! (`epoch_funding.rs:17`).

use crate::epoch_funding::{assert_per_claimant_funding, per_claimant_rails, Registration};
use serde::Deserialize;

/// The founder's approval receipt — what he pastes back after creating the Turbo
/// delegated-payment approvals in the console. Deserialized, never authored here.
#[derive(Debug, Deserialize)]
pub struct ApprovalReceipt {
    /// The uploader address the approvals were granted TO (our disposable signer).
    /// Every grant must approve THIS uploader or the upload cannot spend it.
    pub uploader: String,
    /// One grant per claimant: which funded delegate pays that claimant's DataItem.
    pub grants: Vec<Grant>,
}

/// One claimant's funding grant. `name`/`claimant`/`delegate` are load-bearing; the
/// rest are mechanism-dependent provenance (goose confirms which the uploader needs).
#[derive(Debug, Deserialize)]
pub struct Grant {
    /// The `.b` name being registered (the item this grant funds).
    pub name: String,
    /// The claimant identity registering it (zero-value; pays nothing itself).
    pub claimant: String,
    /// The `x-paid-by` funded delegate that pays for THIS item. Founder-controlled.
    pub delegate: String,
    /// Some Turbo flows key the charge to an approval id, not just the address.
    #[serde(default)]
    pub approval_id: Option<String>,
    /// Approval spend cap (winc), if the mechanism carries one natively.
    #[serde(default)]
    pub cap_winc: Option<String>,
    /// Approval expiry, if any.
    #[serde(default)]
    pub expires: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ReceiptError {
    /// The pasted JSON did not parse.
    Parse(String),
    /// No grants — nothing to fund.
    Empty,
    /// A grant's delegate IS the uploader itself — the signer paying its own item,
    /// which is the leader paying (8s breach), caught before the funding check.
    UploaderIsDelegate(String),
    /// The per-claimant funding invariant failed (delegate is the leader, or missing).
    Funding(String),
    /// A grant carries no proof its approval was actually created (empty
    /// `approval_id`/`cap_winc`). Names the grant. Spend-time gate for the CLI
    /// ceremony — see [`ApprovalReceipt::assert_approvals_present`].
    MissingApproval(String),
}

impl ApprovalReceipt {
    pub fn from_json(raw: &[u8]) -> Result<Self, ReceiptError> {
        serde_json::from_slice(raw).map_err(|e| ReceiptError::Parse(e.to_string()))
    }

    /// Map each grant to a per-name [`Registration`] — the name funded by ITS
    /// claimant's delegate. This is the shape the pipeline's funding check reads.
    pub fn registrations(&self) -> Vec<Registration> {
        self.grants
            .iter()
            .map(|g| Registration {
                name: g.name.clone(),
                claimant_delegate: g.delegate.clone(),
            })
            .collect()
    }

    /// Distinct funded delegates across all grants. A genuine PER-CLAIMANT proof
    /// needs **>= 2**: one delegate paying every item is provable-as-delegated but
    /// indistinguishable from leader-pays with real receipts, because a single payer
    /// makes "each claimant funds its own" and "one party funds all" identical on the
    /// wire. Exposed so the harness — and the founder-card recommendation — can assert
    /// the *differentiation*, not merely the *delegation*.
    pub fn distinct_delegates(&self) -> usize {
        let mut ds: Vec<&str> = self.grants.iter().map(|g| g.delegate.as_str()).collect();
        ds.sort_unstable();
        ds.dedup();
        ds.len()
    }

    /// Verify the receipt yields PER-CLAIMANT funding (8s), reusing the
    /// `epoch_funding` invariant so this path and the pipeline check are the SAME
    /// law, not two drifting copies:
    ///   * no grant's delegate is the uploader itself (signer-pays is leader-pays),
    ///   * no grant routes through the leader's funding delegate,
    ///   * every item is funded by its own claimant's delegate, none by the leader.
    ///
    /// `leader_delegate` is the leader's own funding delegate for the on-chain
    /// commit — a per-name item paid by it is the breach. This checks the invariant
    /// *holds*; it does not check the proof is *strong* — see [`Self::distinct_delegates`].
    pub fn verify_per_claimant(&self, leader_delegate: &str) -> Result<(), ReceiptError> {
        if self.grants.is_empty() {
            return Err(ReceiptError::Empty);
        }
        for g in &self.grants {
            if g.delegate == self.uploader {
                return Err(ReceiptError::UploaderIsDelegate(g.name.clone()));
            }
        }
        let regs = self.registrations();
        let rails = per_claimant_rails(&regs);
        assert_per_claimant_funding(&rails, &regs, leader_delegate).map_err(ReceiptError::Funding)
    }

    /// Spend-time gate for the CLI ceremony (defense-in-depth behind the ceremony
    /// script's own refusal). Before the pipeline uploads against a grant, that
    /// grant must carry PROOF the delegated approval exists — a non-empty
    /// `approval_id` AND `cap_winc`. A partially-failed ceremony that emitted a
    /// grant with the payer stamped on but no approval id must NOT be spent against;
    /// reject it here rather than upload into a non-existent approval and 402.
    ///
    /// Distinct from [`Self::verify_per_claimant`], which is the funding INVARIANT
    /// (who pays) and deliberately treats these fields as untrusted provenance. This
    /// is the spend-readiness check; the pipeline calls both before uploading.
    pub fn assert_approvals_present(&self) -> Result<(), ReceiptError> {
        for g in &self.grants {
            let present = |o: &Option<String>| o.as_deref().is_some_and(|s| !s.is_empty());
            if !present(&g.approval_id) || !present(&g.cap_winc) {
                return Err(ReceiptError::MissingApproval(g.name.clone()));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Synthetic fixtures. The REAL uploader/claimant addresses are the disposable
    // zero-value identities generated for the test (kept out of the repo); nothing
    // here bakes a live address into committed code.
    const UPLOADER: &str = "UPLOADER-addr";
    const LEADER_DELEGATE: &str = "LEADER-delegate";

    fn grant(name: &str, claimant: &str, delegate: &str) -> Grant {
        Grant {
            name: name.into(),
            claimant: claimant.into(),
            delegate: delegate.into(),
            approval_id: None,
            cap_winc: None,
            expires: None,
        }
    }

    fn two_distinct() -> ApprovalReceipt {
        ApprovalReceipt {
            uploader: UPLOADER.into(),
            grants: vec![
                grant("alice.b", "alice", "delegate-A"),
                grant("bob.b", "bob", "delegate-B"),
            ],
        }
    }

    #[test]
    fn two_distinct_delegates_prove_per_claimant() {
        let r = two_distinct();
        assert_eq!(r.verify_per_claimant(LEADER_DELEGATE), Ok(()));
        assert_eq!(
            r.distinct_delegates(),
            2,
            "two claimants, two funded delegates — the differentiation is real"
        );
    }

    /// The distinction the card recommendation rests on: ONE delegate paying every
    /// item still satisfies not-leader / not-none, so `verify_per_claimant` PASSES —
    /// but `distinct_delegates() == 1` flags it as single-payer, which is
    /// provable-as-delegated and NOT provable-as-per-claimant. This is why the
    /// recommendation is >= 2 funded delegates, stated as a test rather than prose.
    #[test]
    fn one_shared_delegate_is_delegated_but_not_per_claimant() {
        let mut r = two_distinct();
        r.grants[1].delegate = r.grants[0].delegate.clone(); // both on delegate-A
        assert_eq!(
            r.verify_per_claimant(LEADER_DELEGATE),
            Ok(()),
            "single non-leader payer still satisfies the not-leader invariant"
        );
        assert_eq!(
            r.distinct_delegates(),
            1,
            "one payer — cannot prove per-claimant differentiation with receipts"
        );
    }

    #[test]
    fn leader_delegate_in_a_grant_is_the_breach() {
        let mut r = two_distinct();
        r.grants[1].delegate = LEADER_DELEGATE.into();
        assert!(matches!(
            r.verify_per_claimant(LEADER_DELEGATE),
            Err(ReceiptError::Funding(_))
        ));
    }

    #[test]
    fn uploader_as_its_own_delegate_is_signer_pays() {
        let mut r = two_distinct();
        r.grants[0].delegate = UPLOADER.into();
        assert_eq!(
            r.verify_per_claimant(LEADER_DELEGATE),
            Err(ReceiptError::UploaderIsDelegate("alice.b".into()))
        );
    }

    #[test]
    fn empty_receipt_rejected() {
        let r = ApprovalReceipt {
            uploader: UPLOADER.into(),
            grants: vec![],
        };
        assert_eq!(
            r.verify_per_claimant(LEADER_DELEGATE),
            Err(ReceiptError::Empty)
        );
    }

    /// The founder-paste shape parses: optional mechanism fields present on one grant,
    /// absent on the other, and both default cleanly — so the wiring does not depend
    /// on goose's not-yet-final answer about which optional fields the flow emits.
    #[test]
    fn parses_founder_paste_shape() {
        let raw = br#"{
          "uploader": "UPLOADER-addr",
          "grants": [
            {"name":"alice.b","claimant":"alice","delegate":"delegate-A",
             "approval_id":"appr_1","cap_winc":"1000000000","expires":"2026-09-01T00:00:00Z"},
            {"name":"bob.b","claimant":"bob","delegate":"delegate-B"}
          ]
        }"#;
        let r = ApprovalReceipt::from_json(raw).expect("valid receipt parses");
        assert_eq!(r.grants.len(), 2);
        assert_eq!(r.grants[0].approval_id.as_deref(), Some("appr_1"));
        assert_eq!(r.grants[0].cap_winc.as_deref(), Some("1000000000"));
        assert_eq!(
            r.grants[1].approval_id, None,
            "optional fields default when absent"
        );
        assert_eq!(r.verify_per_claimant(LEADER_DELEGATE), Ok(()));
        assert_eq!(r.distinct_delegates(), 2);
    }

    #[test]
    fn malformed_json_is_a_parse_error() {
        assert!(matches!(
            ApprovalReceipt::from_json(b"{not json"),
            Err(ReceiptError::Parse(_))
        ));
    }

    /// The CLI ceremony (`bnr-turbo-2-approve.sh`) emits a SUPERSET receipt —
    /// `uploader`/`grants` plus provenance fields (`payer`, `uploader_approval`,
    /// `raw_approvals`) straight from the turbo `share-credits` output. This is the
    /// real shape the founder pastes back; it MUST parse (serde ignores the extra
    /// fields) and consume cleanly. With one funded founder wallet, every grant's
    /// delegate is the founder's `payingAddress`, so it is honestly SINGLE-PAYER:
    /// `verify_per_claimant` passes (the founder is not the leader/uploader) but
    /// `distinct_delegates() == 1` — delegated-payment proven, NOT per-claimant
    /// differentiated. That distinction is the point, not a defect.
    #[test]
    fn parses_ceremony_superset_receipt_single_payer() {
        let raw = br#"{
          "uploader": "wmpqC4DnTEuYbZiyj7PAmKNub80REgQ1rwHj0R9__kA",
          "payer": "FOUNDERpayingAddr",
          "grants": [
            {"name":"test-a.b","claimant":"K3p3rOMnClaimant1",
             "delegate":"FOUNDERpayingAddr","approval_id":"appr_c1_id",
             "cap_winc":"1000000000","expires":"2026-08-16T00:00:00Z"},
            {"name":"test-b.b","claimant":"oSRU71itClaimant2",
             "delegate":"FOUNDERpayingAddr","approval_id":"appr_c2_id",
             "cap_winc":"1000000000","expires":"2026-08-16T00:00:00Z"}
          ],
          "uploader_approval": {"approval_id":"appr_up_id","cap_winc":"1000000000","expires":"2026-08-16T00:00:00Z"},
          "raw_approvals": [{"approvalDataItemId":"appr_up_id","payingAddress":"FOUNDERpayingAddr"}]
        }"#;
        let r = ApprovalReceipt::from_json(raw).expect("ceremony superset receipt parses");
        assert_eq!(r.grants.len(), 2);
        assert_eq!(r.grants[0].approval_id.as_deref(), Some("appr_c1_id"));
        // the founder pays, and the founder is neither the leader nor the uploader:
        assert_eq!(r.verify_per_claimant("LEADER-delegate"), Ok(()));
        // ...but it is one funded payer, so this is delegated-not-per-claimant:
        assert_eq!(
            r.distinct_delegates(),
            1,
            "single founder wallet: delegated-payment proven, per-claimant is not"
        );
        // every grant carries its approval id + cap, so it is spend-ready:
        assert_eq!(r.assert_approvals_present(), Ok(()));
    }

    /// The consumer half of the k001 fix: a grant with the delegate stamped on but
    /// NO approval id (what a partially-failed ceremony used to emit) must be
    /// rejected at spend time — even though `verify_per_claimant` passes it, because
    /// the funding invariant deliberately ignores the provenance fields.
    #[test]
    fn grant_without_approval_id_is_rejected_at_spend_time() {
        let mut r = two_distinct(); // grants have delegate set but approval_id: None
        assert_eq!(
            r.verify_per_claimant(LEADER_DELEGATE),
            Ok(()),
            "funding invariant passes — it does not look at approval_id"
        );
        assert_eq!(
            r.assert_approvals_present(),
            Err(ReceiptError::MissingApproval("alice.b".into())),
            "but the spend gate rejects a grant with no approval proof"
        );
        // fill one but leave cap empty -> still rejected on cap_winc
        r.grants[0].approval_id = Some("appr_x".into());
        r.grants[0].cap_winc = Some(String::new());
        assert_eq!(
            r.assert_approvals_present(),
            Err(ReceiptError::MissingApproval("alice.b".into()))
        );
    }
}
