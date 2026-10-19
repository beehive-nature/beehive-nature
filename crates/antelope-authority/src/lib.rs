//! antelope-authority: a keyless Rust model of how an Antelope chain decides
//! whether a set of signing keys, pre-satisfied permissions and a delay
//! satisfy a declared `actor@permission`, read line by line from
//! `AntelopeIO/spring` at tag `v1.2.2`, with the conformance corpus that
//! convicts the three multisig-tool fault classes named in the 2026-10-15
//! architecture review (lane SOVEXEC-001, dispatch
//! `docs/dispatches/2026-10-15-sovexec-001-architecture-reconciliation.md`).
//!
//! ## Why this crate exists
//!
//! SPEC-RUSTEOSVM-1 names the off-chain Rust worker (`bnrose-exec-core`) and
//! a future Vaulta-deployed contract as the two sides of one execution and
//! settlement interface. The worker admits a WB001 intent under a flat
//! policy (domains, capabilities, an amount ceiling). The chain side will
//! not be flat: a Vaulta transaction is authorized by a permission
//! hierarchy with thresholds, weighted delegation to other accounts, waits,
//! a recursion bound and linked minimum permissions. Any adapter that
//! prepares, inspects or replays a Vaulta transaction (the multisig and
//! operator flows the review ranked first) has to resolve that hierarchy
//! EXACTLY as the chain does, or it will approve what the chain refuses or
//! refuse what the chain approves. This crate is the executable statement
//! of "exactly as the chain does", and the corpus is what any such adapter
//! must pass before it may call itself conformant.
//!
//! ## What it is NOT
//!
//! - Not a wallet, not a signer, not a client: no key parsing, no
//!   signature recovery, no RPC. Keys are opaque tokens compared for
//!   equality (keyless by construction, as `bindexer` is).
//! - Not the chain: this is a model read from source. Sampled agreement
//!   with a running node is a named next beat (see the dispatch), not a
//!   claim made here. Where the model fixes an order the chain leaves to a
//!   binary comparison (key ordering), the doc says MODEL ORDER.
//! - Not a universal authority model. Antelope permissions, account nonces,
//!   UTXOs and channel state are different authority models; flattening
//!   them into one is exactly the error the review warned against. Other
//!   rails get their own corpus.
//! - Not a replacement for, or a change to, `bnrose-exec-core`: the policy
//!   wire of that crate is untouched. The seam between a flat policy and a
//!   chain permission hierarchy is a proposal in the dispatch, for the
//!   owner of that crate.
//!
//! ## Source correspondence (Spring v1.2.2)
//!
//! Every function below names the lines it was read from; the files were
//! fetched from `raw.githubusercontent.com/AntelopeIO/spring/v1.2.2/` on
//! 2026-10-15 and their sha256 prefixes are in the dispatch.
//!
//! | Rust | Spring v1.2.2 |
//! |---|---|
//! | [`name::Name::parse`], [`name::string_to_u64`] | `libraries/chain/name.cpp:9-33`, `include/eosio/chain/name.hpp:16-40` |
//! | [`authority::Authority::validate`] | `include/eosio/chain/authority.hpp:308-353` |
//! | [`world::World::satisfies`] | `include/eosio/chain/permission_object.hpp:47-67` |
//! | [`world::World::lookup_linked_permission`] | `libraries/chain/authorization_manager.cpp:278-299` |
//! | [`world::World::lookup_minimum_permission`] | `authorization_manager.cpp:301-327` |
//! | [`world::World::find_permission`], [`world::World::get_permission`] | `authorization_manager.cpp:266-276` |
//! | [`world::ChainConfig`] defaults | `include/eosio/chain/config.hpp:77,80` |
//! | [`checker::Checker::satisfied`] | `include/eosio/chain/authority_checker.hpp:72-94,148-153` |
//! | `Checker::satisfied_authority` (private) | `authority_checker.hpp:155-188` (ordering `:20,163-178`) |
//! | `Checker::tally_account` (private) | `authority_checker.hpp:221-252` |
//! | `Checker::status_in_cache` (private) | `authority_checker.hpp:132-145` |
//! | [`transaction::check_authorization`] | `authorization_manager.cpp:479-585` |
//!
//! ## The fault classes ([`faults::Faults`])
//!
//! The review attributed three defects to the inspected multisig tooling:
//! following referenced accounts under the parent permission name,
//! deduplicating by account rather than `actor@permission`, and lacking a
//! bound for indirect cycles. Each is a switch on the faithful walk, OFF in
//! every product path, and each has a corpus vector on which the chain and
//! the fault give different verdicts (`tests/corpus.rs`,
//! `convict_class_*`). The attribution is the review's and is not
//! re-verified here; the convictions are this crate's and are.

#![forbid(unsafe_code)]

pub mod authority;
pub mod checker;
pub mod faults;
pub mod name;
pub mod transaction;
pub mod world;

pub use authority::{
    Authority, AuthorityError, Key, KeyWeight, PermissionLevelWeight, WaitWeight, Weight,
};
pub use checker::{Checker, Provided, Status, Step, Verdict, STEP_BUDGET};
pub use faults::Faults;
pub use name::{n, Name, NameError, PermissionLevel};
pub use transaction::{check_authorization, Action, Outcome, TxVerdict};
pub use world::{ChainConfig, Permission, World};

use std::fmt;

/// Every refusal the crate can name. A refusal is a structural answer
/// ("this question cannot be asked of this world"), distinct from an
/// unsatisfied verdict ("asked, and the answer is no").
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Refusal {
    /// an empty actor or permission (`authorization_manager.cpp:268,274`)
    InvalidPermissionLevel,
    /// `get_permission` found nothing (`:272-276`)
    UnknownPermission(PermissionLevel),
    /// `add_permission` named a parent the owner does not have
    UnknownParent { owner: Name, parent: Name },
    /// the permission already exists
    DuplicatePermission(PermissionLevel),
    /// `validate` refused the authority (`authority.hpp:309-353`)
    AuthorityInvalid(PermissionLevel, AuthorityError),
    /// `add_account` for an account that already has permissions
    AccountExists(Name),
    /// `link` to a permission the account does not have
    LinkTargetUnknown(PermissionLevel),
    /// a parent chain that loops (impossible on the chain; refused here)
    ParentCycle(PermissionLevel),
    /// `eosio::{updateauth,deleteauth,linkauth,unlinkauth,canceldelay}`:
    /// their check reads action data this model does not carry
    /// (`authorization_manager.cpp:307-315,514-530`)
    NativeAuthorityActionNotModeled(Name),
    /// `irrelevant_auth_exception` (`:540-544`): the declared permission
    /// neither equals nor sits above the minimum for the action
    IrrelevantAuthority {
        declared: PermissionLevel,
        minimum: PermissionLevel,
    },
    /// the walk exceeded [`STEP_BUDGET`] account follows: only reachable
    /// with fault class 3 planted
    StepBudgetExhausted { steps: usize },
}

impl Refusal {
    /// The short word a receipt uses for this refusal.
    pub fn word(&self) -> &'static str {
        match self {
            Refusal::InvalidPermissionLevel => "permission:invalid-level",
            Refusal::UnknownPermission(_) => "permission:unknown",
            Refusal::UnknownParent { .. } => "permission:unknown-parent",
            Refusal::DuplicatePermission(_) => "permission:duplicate",
            Refusal::AuthorityInvalid(..) => "authority:invalid",
            Refusal::AccountExists(_) => "account:exists",
            Refusal::LinkTargetUnknown(_) => "link:target-unknown",
            Refusal::ParentCycle(_) => "permission:parent-cycle",
            Refusal::NativeAuthorityActionNotModeled(_) => "action:native-authority-not-modeled",
            Refusal::IrrelevantAuthority { .. } => "authorization:irrelevant",
            Refusal::StepBudgetExhausted { .. } => "walk:step-budget-exhausted",
        }
    }
}

impl fmt::Display for Refusal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Refusal::InvalidPermissionLevel => write!(f, "{}", self.word()),
            Refusal::UnknownPermission(l) => write!(f, "{}: {l}", self.word()),
            Refusal::UnknownParent { owner, parent } => {
                write!(f, "{}: {owner} has no permission {parent}", self.word())
            }
            Refusal::DuplicatePermission(l) => write!(f, "{}: {l}", self.word()),
            Refusal::AuthorityInvalid(l, e) => write!(f, "{}: {l}: {e}", self.word()),
            Refusal::AccountExists(a) => write!(f, "{}: {a}", self.word()),
            Refusal::LinkTargetUnknown(l) => write!(f, "{}: {l}", self.word()),
            Refusal::ParentCycle(l) => write!(f, "{}: {l}", self.word()),
            Refusal::NativeAuthorityActionNotModeled(a) => {
                write!(f, "{}: eosio::{a}", self.word())
            }
            Refusal::IrrelevantAuthority { declared, minimum } => write!(
                f,
                "{}: declared {declared}; minimum authority is {minimum}",
                self.word()
            ),
            Refusal::StepBudgetExhausted { steps } => {
                write!(f, "{}: {steps} follows", self.word())
            }
        }
    }
}
