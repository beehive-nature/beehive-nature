//! bpay-rail — OFFLINE SKELETON of the unified bPay rail trait.
//!
//! Built per the R11 order after both preconditions resolved at
//! source: (1) Base/OP-stack L1 data fee = SURCHARGE outside the
//! EIP-1559 bid (docs.optimism.io, "not possible to limit" — their own
//! words) → the `L1Surcharge` fee class and the Base gate; (2) NIP-47
//! notification fields pinned (nwc/02.md — transaction-object payload,
//! kind 23197 NIP-44). Members: EVM = composition of the proven
//! watchpay engine (65 tests, two adversarial rounds); LN = the R8
//! adapter contract over a MOCK NWC-shaped client. No network, no
//! node, no deployment. The x402 first-line door (bsigner's
//! pre-signature offer gate) stays at the design level — not built.

pub mod capabilities;
pub mod capability;
pub mod evm;
pub mod fee;
pub mod ledger;
pub mod ln;
pub mod nwc;
pub mod nwc_crypto;
#[cfg(feature = "live-nwc")]
pub mod nwc_live;
pub mod nwc_mock;
pub mod nwc_reader;
pub mod units;
pub mod x402;

pub use evm::{EvmPaymentId, EvmRailAdapter};
pub use fee::{FeeClass, FeeReservation};
pub use ledger::{LedgerError, LifecycleState, RailLedger};
pub use ln::{LnMockClient, LnRailAdapter, LnSettlement, NwcState, PaymentHash};
pub use nwc::{NwcError, NwcRail, NwcTransport};
#[cfg(feature = "live-nwc")]
pub use nwc_live::{LiveNwcTransport, NwcConnection};
pub use nwc_mock::MockNwcTransport;
pub use units::{FeeEvidence, MilliSatoshi};
pub use x402::{compose_from_offer, gate, offer_id, AllowEntry, OfferPolicy, PinnedOffer};
