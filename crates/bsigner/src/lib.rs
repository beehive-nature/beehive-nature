//! `bsigner` — the BNR signer scaffold (dispatch order C1).
//!
//! SPEC_KEYRING-1 §8 ruled that the dashboard UI plus this signer together
//! *are* the BNR wallet. This crate is the scaffold for the signer half: the
//! device rail, the chain registry, and the process boundary. It is
//! deliberately incapable of signing.
//!
//! # Why this exists
//!
//! The week's friction defined the product. Trezor Suite ships a closed EVM
//! network list, so exSat could not be added and the founder was pushed
//! through MetaMask as a forced intermediary. The answer is not a vendor
//! feature request: it is talking to the device directly and bringing our own
//! chain registry ([`chain_registry`]).
//!
//! # Boundary law (§8)
//!
//! The UI process never holds private key material — not in state, not in
//! logs, not in storage. It routes requests over [`channel`] and renders
//! receipts. Isolated by design, and checkable: a grep of the dashboard's
//! config, state, and logs must find no secret material (§6 acceptance 4).
//!
//! # What C1 cannot do, on purpose
//!
//! | Fence | How it is held |
//! |---|---|
//! | No signing | No `sign_*` on the device layer; [`channel::RefusingSigner`] returns [`channel::ChannelError::SigningRefused`] |
//! | No key storage | Nothing derives, reads, or holds secret material |
//! | No Suite, no WalletConnect | Not in the dependency tree — check `cargo tree` |
//! | Chain id always verified | [`chain_registry::VerifiedEvmChain`] is unforgeable outside [`chain_registry::EvmChain::verify_chain_id`] |
//! | Hardware only with the founder | Enumeration is safe unattended; a real-device run is founder-present, emulator otherwise |
//!
//! The signing rail, its CONSENT-1 surface, and each rail's honesty gate are
//! later orders. A rail may be called working only with a logged
//! request → on-device confirm → broadcast → chain receipt.

pub mod chain_registry;
pub mod channel;
pub mod device;

pub use chain_registry::{
    AntelopeChain, ChainError, ChainKey, EvmChain, Provenance, VerifiedEvmChain, ANTELOPE_CHAINS,
    ARBITRUM_ONE, EVM_CHAINS, EXSAT_MAINNET, EXSAT_TESTNET, VAULTA_MAINNET,
};
pub use channel::{
    AuthenticatedRequest, CallerId, ChannelError, Query, QueryResponse, RefusingSigner,
    SignRequest, SignerChannel,
};
pub use device::{enumerate, ethereum_address, DeviceError, DeviceSummary, ETH_PATH_ACCOUNT_0};

#[cfg(test)]
mod fence_tests {
    //! Tests that assert the *fences*, not the features.

    use super::*;

    #[test]
    fn signing_is_refused_through_the_public_api() {
        let chain = EXSAT_MAINNET.verify_chain_id(7200).unwrap();
        let req = AuthenticatedRequest {
            caller: CallerId("test".into()),
            payload: SignRequest {
                chain,
                path: vec![],
                payload: vec![],
            },
        };
        assert!(matches!(
            RefusingSigner.sign(req),
            Err(ChannelError::SigningRefused)
        ));
    }

    #[test]
    fn an_unverified_chain_cannot_reach_a_sign_request() {
        // There is no way to build a SignRequest for exSat testnet, because
        // VerifiedEvmChain cannot be produced for an Unverified entry. This is
        // the wrong-network loss class closed at the type level.
        assert!(EXSAT_TESTNET.verify_chain_id(7200).is_err());
        assert!(EXSAT_TESTNET.verify_chain_id(0).is_err());
    }
}
