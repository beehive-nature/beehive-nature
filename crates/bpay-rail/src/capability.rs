//! Capability manifests + authorization-time binding (MP/RB/AB specs).
//!
//! THE FOUNDER LAW: "authorization-time manifest binding — a plan binds,
//! per leg, the capability-manifest hash AT AUTHORIZATION TIME, riding
//! the signed authorization material. Later capability drift can never
//! silently change an obligation."
//!
//! THE JOURNAL LAW: "the journal may preserve an authorization binding,
//! but it may never create or strengthen one."
//!
//! Design (from CD→MP→RB→AB reconciliation):
//! - [`CapabilityManifest`] = the capability object: schema version,
//!   rail identity, implementation identity, payment semantics
//!   (exact/upto, hold/MPP, replacement), evidence semantics
//!   (response-read, finality, failure-fees), send gate, and any other
//!   ratified CD axis. Its CONTENT HASH is the authority boundary —
//!   the version string is metadata.
//! - [`LegBinding`] = the per-leg binding of a manifest's content hash
//!   into the signed authorization bytes. The binding is INSIDE the
//!   signature; stripping it breaks the signature.
//! - [`SignedAuthorization`] = the authorization object with per-leg
//!   bindings, signed through the estate's existing k256 BIP-340 path
//!   (the same signing machinery the NWC adapter uses — NOT a bespoke
//!   test verifier).
//! - The journal (the rail ledger) PRESERVES the binding but never
//!   CREATES, UPGRADES, HOMOGENIZES, or SUBSTITUTES it.

use watchpay::abi::keccak256;
use watchpay::types::Hex32;

use crate::ledger::LedgerError;
use k256::schnorr::{Signature, SigningKey, VerifyingKey};

// ── CapabilityManifest ─────────────────────────────────────────────────

/// Payment semantics: how amounts are specified and charged.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PaymentSemantics {
    /// The exact amount is charged (watchpay's declared==derived law).
    Exact,
    /// The amount is an upper bound (LN's fee-limit shape).
    Upto,
}

/// Settlement assurance / finality semantics.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FinalitySemantics {
    /// LN-style: preimage knowledge = settled.
    InstantPreimage,
    /// EVM-style: N-deep reorg resistance.
    ReorgDepth(u64),
}

/// Failure-fee semantics: does a failed attempt still cost?
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FailureFeeSemantics {
    /// LN: failed parts owe nothing.
    NothingOnFail,
    /// EVM: reverts pay gas.
    GasOnRevert,
}

/// Response-read capability (CD-7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ResponseRead {
    PostReq,
    WsRequired,
    None,
}

/// The capability manifest — a pure data object whose content hash is
/// the authority boundary. The version string is metadata; the hash is
/// what gets signed.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CapabilityManifest {
    pub schema_version: u32,
    /// LN / EVM / etc.
    pub rail: String,
    /// Implementation identity (crate name + semantic version digest).
    pub implementation_id: String,
    /// Payment semantics.
    pub payment: PaymentSemantics,
    /// Hold/MPP support.
    pub hold_mpp: bool,
    /// Replacement support (same obligation, new attempt).
    pub replacement: bool,
    /// Response-read capability.
    pub response_read: ResponseRead,
    /// Finality semantics.
    pub finality: FinalitySemantics,
    /// Failure-fee semantics.
    pub failure_fees: FailureFeeSemantics,
    /// Send gate (CD-8: off by default).
    pub send_enabled: bool,
    /// The version string (metadata; the hash is the authority).
    pub version: String,
}

impl CapabilityManifest {
    /// Canonical serialization for hashing (deterministic field order).
    pub fn canonical_bytes(&self) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(&self.schema_version.to_be_bytes());
        out.extend_from_slice(self.rail.as_bytes());
        out.push(0); // separator
        out.extend_from_slice(self.implementation_id.as_bytes());
        out.push(0);
        // payment semantics as a discriminant byte
        out.push(match self.payment {
            PaymentSemantics::Exact => 0x01,
            PaymentSemantics::Upto => 0x02,
        });
        out.push(self.hold_mpp as u8);
        out.push(self.replacement as u8);
        out.push(match self.response_read {
            ResponseRead::PostReq => 0x01,
            ResponseRead::WsRequired => 0x02,
            ResponseRead::None => 0x00,
        });
        // finality
        match self.finality {
            FinalitySemantics::InstantPreimage => {
                out.push(0x01);
                out.extend_from_slice(&0u64.to_be_bytes());
            }
            FinalitySemantics::ReorgDepth(d) => {
                out.push(0x02);
                out.extend_from_slice(&d.to_be_bytes());
            }
        }
        // failure fees
        out.push(match self.failure_fees {
            FailureFeeSemantics::NothingOnFail => 0x01,
            FailureFeeSemantics::GasOnRevert => 0x02,
        });
        out.push(self.send_enabled as u8);
        // version string is NOT in the hash input — the hash IS the identity
        out
    }

    /// The content hash — THE authority boundary (keccak256 of the
    /// canonical bytes). Two manifests with the same version string but
    /// different content produce different hashes.
    pub fn content_hash(&self) -> Hex32 {
        Hex32(keccak256(&self.canonical_bytes()))
    }
}

// ── LegBinding ─────────────────────────────────────────────────────────

/// Per-leg binding of a manifest's content hash into the authorization.
/// This is what rides the SIGNED material — strip it and the signature
/// breaks.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct LegBinding {
    /// The leg's identity within the plan (index or hash).
    pub leg_id: String,
    /// The BOUND manifest content hash (the authority).
    pub manifest_hash: Hex32,
    /// The manifest version (metadata — informational only).
    pub manifest_version: String,
    /// The implementation identity (also inside the signed scope).
    pub implementation_id: String,
}

impl LegBinding {
    pub fn canonical_bytes(&self) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(self.leg_id.as_bytes());
        out.push(0);
        out.extend_from_slice(self.manifest_hash.as_bytes());
        out.push(0);
        out.extend_from_slice(self.manifest_version.as_bytes());
        out.push(0);
        out.extend_from_slice(self.implementation_id.as_bytes());
        out
    }
}

// ── SignedAuthorization ────────────────────────────────────────────────

/// The authorization object with per-leg manifest bindings, signed
/// through the estate's k256 BIP-340 path (the same machinery as the
/// NWC adapter's nostr event signing — NOT a bespoke verifier).
#[derive(Debug, Clone)]
pub struct SignedAuthorization {
    /// The authorization's identity.
    pub auth_id: Hex32,
    /// Per-leg bindings (each leg binds ITS OWN manifest).
    pub leg_bindings: Vec<LegBinding>,
    /// The BIP-340 signature over the canonical serialization of
    /// (auth_id + all leg_bindings, in order).
    pub signature: [u8; 64],
    /// The signer's x-only public key (for verification).
    pub signer_pubkey: [u8; 32],
}

impl SignedAuthorization {
    /// The canonical bytes that are signed: auth_id + all leg bindings.
    pub fn canonical_bytes(auth_id: &Hex32, bindings: &[LegBinding]) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(auth_id.as_bytes());
        for b in bindings {
            out.extend_from_slice(&b.canonical_bytes());
        }
        out
    }

    /// Sign through the estate's k256 BIP-340 path.
    pub fn sign(
        auth_id: Hex32,
        bindings: Vec<LegBinding>,
        signing_key: &SigningKey,
    ) -> Result<Self, LedgerError> {
        let bytes = Self::canonical_bytes(&auth_id, &bindings);
        let msg: [u8; 32] = {
            use sha2::Digest;
            sha2::Sha256::digest(&bytes).into()
        };
        let sig = signing_key
            .sign_raw(&msg, &[0u8; 32])
            .map_err(|e| LedgerError::Refusal {
                field: "signature",
                reason: format!("signing failed: {e}"),
            })?;
        Ok(SignedAuthorization {
            auth_id,
            leg_bindings: bindings,
            signature: sig.to_bytes(),
            signer_pubkey: {
                let b = signing_key.verifying_key().to_bytes();
                let mut a = [0u8; 32];
                a.copy_from_slice(&b);
                a
            },
        })
    }

    /// Verify through the estate's k256 BIP-340 path: re-derive the
    /// canonical bytes from the bindings and check the signature.
    /// If the bindings have been stripped or tampered with, the
    /// signature FAILS (this is the AB-0 proof).
    pub fn verify(&self) -> Result<(), LedgerError> {
        let bytes = Self::canonical_bytes(&self.auth_id, &self.leg_bindings);
        let msg: [u8; 32] = {
            use sha2::Digest;
            sha2::Sha256::digest(&bytes).into()
        };
        let sig = <Signature as TryFrom<&[u8]>>::try_from(&self.signature).map_err(|_| {
            LedgerError::Refusal {
                field: "signature",
                reason: "malformed signature bytes".into(),
            }
        })?;
        let vk =
            VerifyingKey::from_bytes(&self.signer_pubkey).map_err(|_| LedgerError::Refusal {
                field: "signer_pubkey",
                reason: "malformed signer pubkey".into(),
            })?;
        vk.verify_raw(&msg, &sig).map_err(|_| LedgerError::Refusal {
            field: "signature",
            reason: "VERIFICATION FAILED — the binding was tampered with or \
                     does not match the signed material"
                .into(),
        })
    }

    /// Verify a SPECIFIC leg's binding against a manifest's content hash.
    /// This is the per-leg check (AB-3/AB-6): each leg verifies against
    /// ITS OWN bound manifest, not the "current" one.
    pub fn verify_leg_binding(
        &self,
        leg_id: &str,
        manifest_hash: &Hex32,
    ) -> Result<(), LedgerError> {
        // First: the overall signature must verify (the bindings are inside)
        self.verify()?;
        // Then: the specific leg's binding must match the given hash
        let binding = self
            .leg_bindings
            .iter()
            .find(|b| b.leg_id == leg_id)
            .ok_or_else(|| LedgerError::Refusal {
                field: "leg_binding",
                reason: format!("no binding found for leg {leg_id:?}"),
            })?;
        if &binding.manifest_hash != manifest_hash {
            return Err(LedgerError::Refusal {
                field: "manifest_hash",
                reason: format!(
                    "leg {leg_id:?}: bound hash {} does not match the given \
                     manifest hash {} — the binding is SUBSTITUTED or DRIFTED",
                    binding.manifest_hash, manifest_hash
                ),
            });
        }
        Ok(())
    }
}

// ── The journal-preserves law ──────────────────────────────────────────

/// Journal-recorded authorization: the binding as it was AT AUTHORIZATION.
/// The journal PRESERVES this; it may never create, upgrade, homogenize,
/// or substitute it.
#[derive(Debug, Clone)]
pub struct JournalAuthRecord {
    pub auth: SignedAuthorization,
    /// The bound manifest SNAPSHOTS (indexed by content hash) — these are
    /// preserved so that capability lookups for open legs resolve against
    /// the BOUND manifest, not the live one.
    pub manifest_snapshots: Vec<(Hex32, CapabilityManifest)>,
}

impl JournalAuthRecord {
    /// Look up a leg's BOUND manifest (by the signed binding's hash).
    /// This is how capability checks resolve for already-authorized legs.
    pub fn bound_manifest(&self, leg_id: &str) -> Result<&CapabilityManifest, LedgerError> {
        let binding = self
            .auth
            .leg_bindings
            .iter()
            .find(|b| b.leg_id == leg_id)
            .ok_or_else(|| LedgerError::Refusal {
                field: "leg_binding",
                reason: format!("no binding for leg {leg_id:?}"),
            })?;
        self.manifest_snapshots
            .iter()
            .find(|(hash, _)| hash == &binding.manifest_hash)
            .map(|(_, m)| m)
            .ok_or_else(|| LedgerError::Refusal {
                field: "manifest_snapshot",
                reason: format!(
                    "no manifest snapshot for hash {} — the journal cannot \
                     reconstruct the bound manifest (AB-2: journal must preserve, \
                     never create)",
                    binding.manifest_hash
                ),
            })
    }

    /// Validate evidence under the BOUND manifest's semantics (RB-2).
    /// If the live manifest has drifted, the BOUND one still governs.
    pub fn validate_evidence_under_binding(
        &self,
        leg_id: &str,
        evidence_depth: u64,
    ) -> Result<(), LedgerError> {
        let manifest = self.bound_manifest(leg_id)?;
        match manifest.finality {
            FinalitySemantics::InstantPreimage => Ok(()), // always valid
            FinalitySemantics::ReorgDepth(required) => {
                if evidence_depth >= required {
                    Ok(())
                } else {
                    Err(LedgerError::Refusal {
                        field: "finality",
                        reason: format!(
                            "evidence at depth {evidence_depth} fails the BOUND manifest's \
                             reorg-depth-{required} requirement (the LIVE manifest may have \
                             relaxed this — RB-2: capability inheritance through the evidence \
                             path is REFUSED)"
                        ),
                    })
                }
            }
        }
    }
}
