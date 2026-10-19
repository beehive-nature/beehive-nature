//! RB03 harness: the production gas-budget arithmetic of `ops/ant-extsig`,
//! compiled from its own source file and checked symbolically by Crux-MIR.
//!
//! `budget` below IS `ops/ant-extsig/src/budget.rs`, compiled from that file:
//! the functions under test are the functions `main.rs` calls
//! (`plan_fee_cap` at main.rs:485, :573, :624, which delegates its
//! arithmetic to `fee_cap`; `gas_limit_with_buffer` at :104;
//! `payment_floor_limit` at :496). `rbench rb03` records the digest of that
//! file next to every verdict.
//!
//! The one change made to production code for this harness: `plan_fee_cap`
//! was split into `fee_cap` (the arithmetic) and a message wrapper, because
//! formatting a symbolic `u128` into the refusal message produced solver
//! goals that did not close. `prior` holds the correspondence check against
//! the function as it was.
//!
//! `props` holds the properties, every one over the full input domain;
//! `vectors` the concrete boundary cases; `faulty` (feature `teeth`) two
//! deliberately wrong variants the same properties must convict.

#[path = "../../../../ops/ant-extsig/src/budget.rs"]
pub mod budget;

pub mod spec;

#[cfg(crux)]
mod props;

#[cfg(any(crux, test))]
mod vectors;

#[cfg(test)]
mod prior;

#[cfg(feature = "teeth")]
pub mod faulty;
