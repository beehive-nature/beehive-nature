//! `authority_checker` (`authority_checker.hpp:34-255`) as a Rust walk that
//! records every step it takes, so a vector can assert not only the verdict
//! but WHICH permission was looked up at WHICH depth with WHICH outcome.

use crate::authority::{Authority, Key};
use crate::faults::Faults;
use crate::name::PermissionLevel;
use crate::world::World;
use crate::Refusal;
use std::collections::{BTreeMap, BTreeSet};

/// A hard ceiling on account follows per top-level check. The faithful walk
/// stays far below it (every level is cached after its first evaluation
/// below the depth bound; follows at or past the bound do no lookup); it
/// exists so that a planted unbounded walk ends in a NAMED refusal instead
/// of a hang or a stack overflow.
pub const STEP_BUDGET: usize = 4096;

/// What the checker was handed (`authority_checker.hpp:46-62`).
#[derive(Clone, Debug, Default)]
pub struct Provided {
    /// The signing keys recovered from the signatures of the transaction
    /// (`flat_set<public_key_type>`; order is the model key order).
    pub keys: BTreeSet<Key>,
    /// Permissions deemed already satisfied (`flat_set<permission_level>`);
    /// `{actor, ""}` means any permission of that actor.
    pub permissions: BTreeSet<PermissionLevel>,
    /// `provided_delay`, in seconds.
    pub delay_secs: u64,
}

impl Provided {
    pub fn keys(keys: &[&str]) -> Provided {
        Provided {
            keys: keys.iter().map(|k| Key::new(k)).collect(),
            ..Provided::default()
        }
    }
    pub fn with_permission(mut self, p: PermissionLevel) -> Provided {
        self.permissions.insert(p);
        self
    }
    pub fn with_delay(mut self, secs: u64) -> Provided {
        self.delay_secs = secs;
        self
    }
}

/// `permission_cache_status` (`authority_checker.hpp:64-68`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    BeingEvaluated,
    Unsatisfied,
    Satisfied,
}

/// One recorded step of the walk. `depth` is the `recursion_depth` of the
/// visitor at the moment of the step.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Step {
    /// a referenced level was looked up in the permission table
    Lookup { level: PermissionLevel, depth: u16 },
    /// the lookup found nothing: contributes zero (`:234-235`)
    NotFound { level: PermissionLevel, depth: u16 },
    /// `recursion_depth >= limit`: not followed, not cached (`:224`)
    DepthLimit { level: PermissionLevel, depth: u16 },
    /// the cache answered (`:222,248`); `BeingEvaluated` here IS the cycle guard
    CacheHit {
        level: PermissionLevel,
        depth: u16,
        status: Status,
    },
    /// the own authority of the level was evaluated to this status (`:241-246`)
    Resolved {
        level: PermissionLevel,
        depth: u16,
        status: Status,
    },
    /// a provided key matched a key weight (`:213-216`)
    KeyUsed { key: Key, depth: u16 },
    /// a wait weight counted under the provided delay (`:205-207`)
    WaitCounted { wait_sec: u32, depth: u16 },
    /// an authority failed: the keys it marked are un-marked (`:157-160`)
    KeysReverted { depth: u16 },
}

/// The verdict of one `satisfied(permission_level)` call plus its walk.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Verdict {
    pub level: PermissionLevel,
    pub satisfied: bool,
    pub trace: Vec<Step>,
}

impl Verdict {
    /// Every level the walk looked up, in order: what a tool resolving
    /// delegations must have asked the chain for.
    pub fn lookups(&self) -> Vec<PermissionLevel> {
        self.trace
            .iter()
            .filter_map(|s| match s {
                Step::Lookup { level, .. } => Some(level.clone()),
                _ => None,
            })
            .collect()
    }
    pub fn has(&self, pred: impl Fn(&Step) -> bool) -> bool {
        self.trace.iter().any(pred)
    }
}

type Cache = BTreeMap<PermissionLevel, Status>;

/// The checker: one per `check_authorization`, with `_used_keys` shared
/// across every declared authorization it checks (`:41,121-130`).
pub struct Checker<'w> {
    world: &'w World,
    keys: Vec<Key>,
    used: Vec<bool>,
    provided_permissions: BTreeSet<PermissionLevel>,
    /// `effective_provided_delay`: `u64::MAX` when at or past the
    /// `max_transaction_delay` of the chain (`authorization_manager.cpp:491-493`)
    delay: u64,
    depth_limit: u16,
    faults: Faults,
    steps: usize,
    trace: Vec<Step>,
}

impl<'w> Checker<'w> {
    pub fn new(world: &'w World, provided: &Provided, faults: Faults) -> Checker<'w> {
        let keys: Vec<Key> = provided.keys.iter().cloned().collect();
        let delay = if provided.delay_secs >= world.config.max_transaction_delay as u64 {
            u64::MAX
        } else {
            provided.delay_secs
        };
        Checker {
            world,
            used: vec![false; keys.len()],
            keys,
            provided_permissions: provided.permissions.clone(),
            delay,
            depth_limit: world.config.max_authority_depth,
            faults,
            steps: 0,
            trace: Vec::new(),
        }
    }

    /// `satisfied(const permission_level&, delay)` (`:72-94`): a fresh cache
    /// seeded with the provided permissions (`:148-153`), a visitor at depth
    /// 0, and the level itself visited as a weight-1 account entry (`:93`).
    pub fn satisfied(
        &mut self,
        level: &PermissionLevel,
        delay_override: Option<u64>,
    ) -> Result<Verdict, Refusal> {
        let saved_delay = self.delay;
        if let Some(d) = delay_override {
            self.delay = d;
        }
        self.trace.clear();
        self.steps = 0;
        let mut cache: Cache = BTreeMap::new();
        for p in &self.provided_permissions {
            cache.insert(p.clone(), Status::Satisfied);
        }
        let mut total: u32 = 0;
        let r = self.tally_account(level, 1, &mut cache, 0, level, &mut total);
        self.delay = saved_delay;
        r?;
        Ok(Verdict {
            level: level.clone(),
            satisfied: total > 0,
            trace: std::mem::take(&mut self.trace),
        })
    }

    pub fn all_keys_used(&self) -> bool {
        self.used.iter().all(|&u| u)
    }

    pub fn used_keys(&self) -> Vec<Key> {
        self.keys
            .iter()
            .zip(&self.used)
            .filter(|(_, &u)| u)
            .map(|(k, _)| k.clone())
            .collect()
    }

    pub fn unused_keys(&self) -> Vec<Key> {
        self.keys
            .iter()
            .zip(&self.used)
            .filter(|(_, &u)| !u)
            .map(|(k, _)| k.clone())
            .collect()
    }

    /// Under fault class 2 the cache is keyed by the actor wildcard ONLY.
    fn cache_key(&self, level: &PermissionLevel) -> PermissionLevel {
        if self.faults.cache_by_actor_only {
            PermissionLevel::any_of(&level.actor)
        } else {
            level.clone()
        }
    }

    /// `permission_status_in_cache` (`:132-145`): the exact level, then the
    /// wildcard entry of the actor.
    fn status_in_cache(&self, cache: &Cache, level: &PermissionLevel) -> Option<Status> {
        if let Some(s) = cache.get(&self.cache_key(level)) {
            return Some(*s);
        }
        cache.get(&PermissionLevel::any_of(&level.actor)).copied()
    }

    /// `satisfied(const AuthorityType&, cache, depth)` (`:155-188`): sort
    /// accounts (priority 1), keys (2) and waits (3) together by weight
    /// descending then priority descending (`:20,163-178`); tally in that
    /// order; stop the moment the running total reaches the threshold; if
    /// it never does, revert the keys marked during this authority (`:157-160`).
    fn satisfied_authority(
        &mut self,
        auth: &Authority,
        cache: &mut Cache,
        depth: u16,
        enclosing: &PermissionLevel,
    ) -> Result<bool, Refusal> {
        let snapshot = self.used.clone();
        // (weight, priority, insertion index, kind, index into its vector)
        let mut order: Vec<(u16, u8, usize, u8, usize)> = Vec::new();
        let mut ins = 0usize;
        for (i, a) in auth.accounts.iter().enumerate() {
            order.push((a.weight, 1, ins, 1, i));
            ins += 1;
        }
        for (i, k) in auth.keys.iter().enumerate() {
            order.push((k.weight, 2, ins, 2, i));
            ins += 1;
        }
        for (i, w) in auth.waits.iter().enumerate() {
            order.push((w.weight, 3, ins, 3, i));
            ins += 1;
        }
        // flat_multimap with std::greater<> over (weight, priority); equal
        // keys keep insertion order
        order.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)).then(a.2.cmp(&b.2)));

        let mut total: u32 = 0;
        for (_, _, _, kind, i) in order {
            match kind {
                1 => {
                    let a = &auth.accounts[i];
                    self.tally_account(
                        &a.permission,
                        a.weight,
                        cache,
                        depth,
                        enclosing,
                        &mut total,
                    )?;
                }
                2 => {
                    let k = &auth.keys[i];
                    if let Some(pos) = self.keys.iter().position(|pk| *pk == k.key) {
                        self.used[pos] = true;
                        total += k.weight as u32;
                        self.trace.push(Step::KeyUsed {
                            key: k.key.clone(),
                            depth,
                        });
                    }
                }
                _ => {
                    let w = &auth.waits[i];
                    if self.delay >= w.wait_sec as u64 {
                        total += w.weight as u32;
                        self.trace.push(Step::WaitCounted {
                            wait_sec: w.wait_sec,
                            depth,
                        });
                    }
                }
            }
            if total >= auth.threshold {
                return Ok(true);
            }
        }
        self.used = snapshot;
        self.trace.push(Step::KeysReverted { depth });
        Ok(false)
    }

    /// `weight_tally_visitor::operator()(const permission_level_weight&)`
    /// (`:221-252`), with the fault classes planted exactly where they
    /// deviate.
    fn tally_account(
        &mut self,
        referenced: &PermissionLevel,
        weight: u16,
        cache: &mut Cache,
        depth: u16,
        enclosing: &PermissionLevel,
        total: &mut u32,
    ) -> Result<(), Refusal> {
        // class 1: resolve the referenced ACCOUNT under the enclosing NAME
        let level = if self.faults.follow_with_enclosing_permission_name && depth > 0 {
            PermissionLevel::new(referenced.actor.clone(), enclosing.permission.clone())
        } else {
            referenced.clone()
        };

        let bounded = !self.faults.no_visited_set_no_depth_bound;
        let status = if bounded {
            self.status_in_cache(cache, &level)
        } else {
            None
        };

        match status {
            None => {
                if !bounded || depth < self.depth_limit {
                    self.steps += 1;
                    if self.steps > STEP_BUDGET {
                        return Err(Refusal::StepBudgetExhausted { steps: self.steps });
                    }
                    self.trace.push(Step::Lookup {
                        level: level.clone(),
                        depth,
                    });
                    // find_permission throws on an empty actor/permission
                    // (`authorization_manager.cpp:268`); the visitor swallows
                    // that exception and treats it as "not found" (`:229-235`)
                    let auth = match self.world.find_permission(&level) {
                        Some(p) if !level.actor.is_empty() && !level.permission.is_empty() => {
                            p.auth.clone()
                        }
                        _ => {
                            self.trace.push(Step::NotFound { level, depth });
                            return Ok(());
                        }
                    };
                    if bounded {
                        cache.insert(self.cache_key(&level), Status::BeingEvaluated);
                    }
                    let r = self.satisfied_authority(&auth, cache, depth + 1, &level)?;
                    let st = if r {
                        Status::Satisfied
                    } else {
                        Status::Unsatisfied
                    };
                    if r {
                        *total += weight as u32;
                    }
                    if bounded {
                        cache.insert(self.cache_key(&level), st);
                    }
                    self.trace.push(Step::Resolved {
                        level,
                        depth,
                        status: st,
                    });
                } else {
                    self.trace.push(Step::DepthLimit { level, depth });
                }
            }
            Some(st) => {
                if st == Status::Satisfied {
                    *total += weight as u32;
                }
                self.trace.push(Step::CacheHit {
                    level,
                    depth,
                    status: st,
                });
            }
        }
        Ok(())
    }

    pub fn depth_limit(&self) -> u16 {
        self.depth_limit
    }

    pub fn effective_delay(&self) -> u64 {
        self.delay
    }

    pub fn world(&self) -> &World {
        self.world
    }
}
