//! `check_authorization` over a list of actions
//! (`authorization_manager.cpp:479-585`): the minimum-permission gate per
//! declared authorization, then every declared authorization satisfied in
//! ascending `(actor, permission)` order, then the irrelevant-signature gate.

use crate::authority::Key;
use crate::checker::{Checker, Provided, Verdict};
use crate::faults::Faults;
use crate::name::{Name, PermissionLevel};
use crate::world::{native_authority_actions, system_account, World};
use crate::Refusal;
use std::collections::BTreeMap;

/// The part of an `action` the authorization path reads: contract account,
/// action name, declared authorizations (`:510,514,532`). Action DATA is not
/// modeled, which is why the five native authority actions refuse.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Action {
    pub account: Name,
    pub name: Name,
    pub authorization: Vec<PermissionLevel>,
}

impl Action {
    pub fn new(account: Name, name: Name, authorization: Vec<PermissionLevel>) -> Action {
        Action {
            account,
            name,
            authorization,
        }
    }
}

/// How the transaction fared once every structural check passed.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Outcome {
    /// every declared authorization satisfied and (unless allowed) every
    /// provided key used
    Satisfied,
    /// `unsatisfied_authorization` (`:566-576`): the first declared
    /// authorization, in traversal order, that the provided keys,
    /// permissions and delay do not satisfy
    Unsatisfied { level: PermissionLevel },
    /// `tx_irrelevant_sig` (`:580-584`): everything satisfied, but these
    /// provided keys were never needed
    IrrelevantSignatures { keys: Vec<Key> },
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct TxVerdict {
    pub outcome: Outcome,
    /// the walk of every declared authorization checked, in traversal order
    /// (stops at the first unsatisfied one, as the chain does)
    pub checks: Vec<Verdict>,
    /// per declared authorization: the minimum permission resolved for it
    /// (None = linked to `eosio.any`)
    pub minimums: Vec<(PermissionLevel, Option<Name>)>,
    pub used_keys: Vec<Key>,
    pub unused_keys: Vec<Key>,
}

impl TxVerdict {
    pub fn satisfied(&self) -> bool {
        self.outcome == Outcome::Satisfied
    }
}

/// `check_authorization` (`:479-585`). Structural refusals (an unknown
/// permission, an irrelevant declared authority, a native authority action,
/// an exhausted step budget) are `Err`; the authorization outcome is `Ok`.
pub fn check_authorization(
    world: &World,
    actions: &[Action],
    provided: &Provided,
    allow_unused_keys: bool,
    faults: Faults,
) -> Result<TxVerdict, Refusal> {
    let mut checker = Checker::new(world, provided, faults);
    let effective_delay = checker.effective_delay();

    let mut to_satisfy: BTreeMap<PermissionLevel, u64> = BTreeMap::new();
    let mut minimums: Vec<(PermissionLevel, Option<Name>)> = Vec::new();

    for act in actions {
        let delay = effective_delay;
        if act.account == system_account() && native_authority_actions().contains(&act.name) {
            // `:514-526` branches on the action data; this model has none
            return Err(Refusal::NativeAuthorityActionNotModeled(act.name.clone()));
        }
        for declared in &act.authorization {
            // `:537-545`
            let min = world.lookup_minimum_permission(&declared.actor, &act.account, &act.name)?;
            if let Some(min_name) = &min {
                let min_level = PermissionLevel::new(declared.actor.clone(), min_name.clone());
                world.get_permission(&min_level)?; // `:539`
                if !world.satisfies(declared, &min_level)? {
                    // `:540-544`
                    return Err(Refusal::IrrelevantAuthority {
                        declared: declared.clone(),
                        minimum: min_level,
                    });
                }
            }
            minimums.push((declared.clone(), min));
            // `:548-553`: keep the smallest delay seen for a repeated level
            let e = to_satisfy.entry(declared.clone()).or_insert(delay);
            if *e > delay {
                *e = delay;
            }
        }
    }

    // `:562-578`: ascending (actor, permission); the first failure ends it
    let mut checks = Vec::new();
    for (level, delay) in &to_satisfy {
        let v = checker.satisfied(level, Some(*delay))?;
        let ok = v.satisfied;
        checks.push(v);
        if !ok {
            return Ok(TxVerdict {
                outcome: Outcome::Unsatisfied {
                    level: level.clone(),
                },
                checks,
                minimums,
                used_keys: checker.used_keys(),
                unused_keys: checker.unused_keys(),
            });
        }
    }

    // `:580-584`
    let unused = checker.unused_keys();
    let outcome = if !allow_unused_keys && !unused.is_empty() {
        Outcome::IrrelevantSignatures {
            keys: unused.clone(),
        }
    } else {
        Outcome::Satisfied
    };
    Ok(TxVerdict {
        outcome,
        checks,
        minimums,
        used_keys: checker.used_keys(),
        unused_keys: unused,
    })
}
