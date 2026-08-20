//! Process-boundary interface (C1c) — **interface only, no implementation.**
//!
//! SPEC_KEYRING-1 §8 boundary law: the dashboard UI renders and routes, the
//! signer signs, and neither ever exports a secret. The UI process is
//! secret-free by construction — it cannot hold key material because it never
//! runs in the same process as the device session.
//!
//! This module fixes the *shape* of that boundary so the UI can be written
//! against it. It deliberately contains no transport, no authentication
//! implementation, and no signing:
//!
//! - Choosing the local transport (UDS / named pipe / loopback+token) is its
//!   own order; each has a different threat model on Windows vs BNRoS.
//! - Authentication is named in the type (`AuthenticatedRequest`) but not
//!   implemented — an unauthenticated placeholder that looked real would be
//!   worse than an obvious hole.
//! - [`SignRequest`] exists so the UI can be typed against the eventual API,
//!   and every implementation of [`SignerChannel`] in C1 **must refuse it**.
//!   The refusal is the honest state: no rail has passed its honesty gate yet.

use crate::chain_registry::VerifiedEvmChain;

/// A caller identity established by the channel's authentication step.
///
/// Opaque on purpose: what proves it (OS peer credentials, a session token,
/// a passkey assertion) is the transport order's decision, not this one's.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CallerId(pub String);

/// Any request crossing the boundary carries its authenticated caller.
#[derive(Debug, Clone)]
pub struct AuthenticatedRequest<T> {
    pub caller: CallerId,
    pub payload: T,
}

/// Read-only queries. These are the only operations C1 can actually serve.
#[derive(Debug, Clone)]
pub enum Query {
    /// List attached devices.
    ListDevices,
    /// Read a public address at a derivation path.
    EthereumAddress { path: Vec<u32> },
}

/// A signing request.
///
/// Note the type of `chain`: a [`VerifiedEvmChain`] can only be produced by
/// checking a live `eth_chainId` against the pinned value, so a request for an
/// unverified chain cannot even be *constructed*. The wrong-network loss class
/// is closed at the type level rather than by a runtime check someone might
/// skip.
#[derive(Debug, Clone)]
pub struct SignRequest {
    pub chain: VerifiedEvmChain,
    pub path: Vec<u32>,
    /// Opaque payload. Deliberately untyped here: the consent surface must
    /// render a human-meaningful quote of what is being signed, and designing
    /// that rendering is part of the signing order, not this scaffold.
    pub payload: Vec<u8>,
}

#[derive(Debug, thiserror::Error)]
pub enum ChannelError {
    #[error("not implemented in the C1 scaffold: {0}")]
    NotImplemented(&'static str),

    #[error("signing is refused: no rail has passed its honesty gate, and C1 holds no signing capability")]
    SigningRefused,

    #[error("caller is not authenticated")]
    Unauthenticated,

    #[error("device error: {0}")]
    Device(#[from] crate::device::DeviceError),
}

/// The interface the dashboard UI calls. One implementation exists in C1
/// ([`RefusingSigner`]) and it answers queries while refusing every signature.
pub trait SignerChannel {
    fn query(&self, req: AuthenticatedRequest<Query>) -> Result<QueryResponse, ChannelError>;

    /// Always fails in C1. Present so the UI can be written and so the refusal
    /// is explicit in the type, rather than a function that silently appears
    /// later without a consent surface.
    fn sign(&self, req: AuthenticatedRequest<SignRequest>) -> Result<Vec<u8>, ChannelError>;
}

#[derive(Debug, Clone)]
pub enum QueryResponse {
    Devices(Vec<crate::device::DeviceSummary>),
    Address(String),
}

/// The C1 implementation: serves read-only queries, refuses all signing.
#[derive(Debug, Default, Clone, Copy)]
pub struct RefusingSigner;

impl SignerChannel for RefusingSigner {
    fn query(&self, req: AuthenticatedRequest<Query>) -> Result<QueryResponse, ChannelError> {
        match req.payload {
            Query::ListDevices => Ok(QueryResponse::Devices(crate::device::enumerate())),
            Query::EthereumAddress { path } => Ok(QueryResponse::Address(
                crate::device::ethereum_address(&path)?,
            )),
        }
    }

    fn sign(&self, _req: AuthenticatedRequest<SignRequest>) -> Result<Vec<u8>, ChannelError> {
        Err(ChannelError::SigningRefused)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chain_registry::EXSAT_MAINNET;

    #[test]
    fn the_scaffold_refuses_to_sign() {
        let chain = EXSAT_MAINNET.verify_chain_id(7200).unwrap();
        let req = AuthenticatedRequest {
            caller: CallerId("dashboard".into()),
            payload: SignRequest {
                chain,
                path: vec![],
                payload: vec![0xde, 0xad],
            },
        };
        assert!(matches!(
            RefusingSigner.sign(req),
            Err(ChannelError::SigningRefused)
        ));
    }

    #[test]
    fn device_listing_is_served() {
        let req = AuthenticatedRequest {
            caller: CallerId("dashboard".into()),
            payload: Query::ListDevices,
        };
        assert!(matches!(
            RefusingSigner.query(req),
            Ok(QueryResponse::Devices(_))
        ));
    }
}
