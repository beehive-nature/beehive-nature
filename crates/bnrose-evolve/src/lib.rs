//! # bnrose-evolve — the bounded evolution controller (BNRoSe L2)
//!
//! Serves **L2 (eternal runtime)** of SPEC-BNROSE-0 §0.1: a runtime that can
//! always be rebuilt must also be repairable without the repairer becoming
//! its own authority. This crate is the controller for that repair loop:
//!
//! ```text
//! observe → reproduce → propose → verify → canary → promote | roll back | hold
//! ```
//!
//! It is a Rust reimplementation of four mechanisms studied in an external
//! self-modifying agent runtime (Ouroboros v7.6.0, read as design input only;
//! no code, runtime or dependency of it is used here), and it deliberately
//! does NOT take that runtime's mode in which an agent may make its own
//! permissions and review rules advisory.
//!
//! ## Four authorities, separated
//!
//! | authority | who | what it can produce |
//! |---|---|---|
//! | proposal | an agent, by signed envelope | a candidate tree + a claim |
//! | execution | [`executor`], in this process | execution records |
//! | verification | [`evidence::judge`] | a verdict, from records only |
//! | promotion | [`controller::Controller::decide`] | a decision, from policy + verdict + canary |
//!
//! The policy that binds all four is written by the **sovereign** (a key in
//! the [`attest::TrustRoot`]), never by an agent: a candidate that touches a
//! protected path (the verifier, required tests, the policy, CI) is refused
//! at admission, and the verifier's commands are pinned by the digest of
//! their program bytes and arguments. An agent improves an implementation; it
//! cannot thereby widen its permissions, raise its ceiling, or redefine
//! success. That boundary is enforced in code outside the candidate's
//! writable tree, not by recurring human approval.
//!
//! ## What is borrowed, as law
//!
//! 1. **Evidence apart from conclusions** ([`evidence`]): claims, execution
//!    records, verdicts and decisions are different types with crate-private
//!    constructors. Missing or partial evidence stays NOT_RUN or DEGRADED.
//! 2. **Attempts, not successes, are accounted** ([`controller`] meter):
//!    authority is reserved before an attempt runs, actual usage is
//!    reconciled after, and unknown usage is charged at the reservation —
//!    never at zero. Spending decisions read the journal, never a snapshot.
//! 3. **Recovery that keeps responsibility**: dispatch and cancellation
//!    intents are durable before the act; a result is never recorded before
//!    its worker is observed dead; at open, unresolved attempts are written
//!    into a rescue record BEFORE anything new, and are never re-run.
//! 4. **Failure classes, closed by evidence** ([`lessons`]): a class closes
//!    only when a policy-required check reproduced it on the baseline and the
//!    same check passes on a promoted repair. A reflection cannot close it.
//!
//! ## Boundaries, named
//!
//! - Storage is the embedded `adapter-store` seam (SQLite reference,
//!   SurrealKV candidate; NO-SERVER-DB). The journal is an unkeyed SHA3 chain:
//!   it convicts unchained edits and truncation; a writer with store access
//!   can rewrite it consistently, which only an external anchor of
//!   [`journal::Journal::head`] would catch (not built here).
//! - The executor bounds a worker by wall time and reaps it; it does not
//!   sandbox it (no namespace, no syscall filter), and a worker's own
//!   children are not tracked. Native workers are bounded by the OS only.
//! - Nothing here signs, holds a key, opens a socket, or spends. Anchoring a
//!   decision on Vaulta, persisting evidence on Autonomi, and carrying
//!   decisions between peers over x0x are later beats with their own gates.

pub mod attest;
pub mod canon;
pub mod controller;
pub mod digest;
pub mod evidence;
pub mod executor;
pub mod journal;
pub mod lessons;
pub mod policy;
pub mod tree;

pub use attest::{Role, RoleKey, SigAlg, TrustRoot};
pub use controller::{Controller, Decision, DecisionKind, RecoveryReport};
pub use digest::Digest32;
pub use evidence::{ExecStatus, Outcome, Usage, Verdict};
pub use lessons::{Lesson, LessonState};

/// Every way the controller says no. Each refusal is named; none is a panic.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refusal {
    /// Bytes that do not decode as a record.
    Corrupt(String),
    /// The journal or a blob disagrees with its own links or digests.
    Tampered(String),
    /// The storage engine refused.
    Store(String),
    /// An envelope did not verify.
    Attest(String),
    /// A valid signature by a key that does not hold the needed role.
    Role {
        needed: &'static str,
        signed_by: &'static str,
    },
    Policy(String),
    NoPolicy,
    ProtectedPath {
        path: String,
        rule: String,
    },
    OutsideWritable {
        path: String,
    },
    /// The agent's declared change set is not the one the controller computed.
    UndeclaredChange {
        declared: Vec<String>,
        computed: Vec<String>,
    },
    /// The proposal is based on something other than the current implementation.
    StaleBase,
    Artifact(String),
    /// A command that is not the policy's pinned verifier command.
    Verifier(String),
    /// Reserving this attempt would exceed a ceiling.
    Budget {
        exposure: u64,
        amount: u64,
        ceiling: u64,
    },
    /// Another controller holds this state directory.
    Claimed,
    Unknown(String),
    Lesson(String),
    Canary(String),
}

impl Refusal {
    pub(crate) fn store(e: adapter_store::StoreError) -> Refusal {
        Refusal::Store(e.to_string())
    }

    /// A stable short code for receipts and exit messages.
    pub fn code(&self) -> &'static str {
        match self {
            Refusal::Corrupt(_) => "corrupt",
            Refusal::Tampered(_) => "tampered",
            Refusal::Store(_) => "store",
            Refusal::Attest(_) => "attest",
            Refusal::Role { .. } => "attest:role",
            Refusal::Policy(_) => "policy",
            Refusal::NoPolicy => "policy:none",
            Refusal::ProtectedPath { .. } => "proposal:protected-path",
            Refusal::OutsideWritable { .. } => "proposal:outside-writable",
            Refusal::UndeclaredChange { .. } => "proposal:undeclared-change",
            Refusal::StaleBase => "proposal:stale-base",
            Refusal::Artifact(_) => "artifact",
            Refusal::Verifier(_) => "verifier:unpinned",
            Refusal::Budget { .. } => "meter:ceiling",
            Refusal::Claimed => "state:already-claimed",
            Refusal::Unknown(_) => "unknown",
            Refusal::Lesson(_) => "lesson",
            Refusal::Canary(_) => "canary",
        }
    }
}

impl std::fmt::Display for Refusal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {:?}", self.code(), self)
    }
}

impl std::error::Error for Refusal {}
