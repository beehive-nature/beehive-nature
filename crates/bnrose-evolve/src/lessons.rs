//! The failure-class register: learning that is made of records, not prose.
//!
//! A class names the violated INVARIANT and the observations that triggered
//! it. It advances only on journaled evidence:
//!
//! - **Reproduced**: a baseline execution of a check the POLICY requires
//!   ended FAIL. The reproduction must be held by the verifier — a test the
//!   agent wrote and the policy does not require cannot reproduce a class.
//! - **Closed**: a Promote decision exists whose verdict has that same check
//!   PASS on the promoted artifact.
//! - **Recurred**: a later execution of that check against the CURRENT
//!   promoted artifact ended FAIL. The class is open again and needs a new
//!   repair; the old repair stays in the record.
//!
//! The authored `note` is kept as what someone said about the class. No
//! transition reads it: a reflection can never close a class.

use crate::canon::{Dec, Enc};
use crate::digest::{hash, Digest32};
use crate::evidence::Outcome;
use crate::Refusal;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LessonEvent {
    Opened {
        class: Digest32,
        invariant: String,
        triggers: Vec<Digest32>,
        note: String,
    },
    Reproduced {
        class: Digest32,
        check: String,
        attempt: Digest32,
    },
    Repaired {
        class: Digest32,
        decision: Digest32,
    },
    RecurrenceChecked {
        class: Digest32,
        attempt: Digest32,
        outcome: Outcome,
    },
}

/// Where a class stands.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LessonState {
    Open,
    Reproduced,
    Closed,
    Recurred,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Lesson {
    pub class: Digest32,
    pub invariant: String,
    pub triggers: Vec<Digest32>,
    pub state: LessonState,
    /// The required check that reproduces the class, once one does.
    pub check: Option<String>,
    pub reproductions: Vec<Digest32>,
    pub repairs: Vec<Digest32>,
    pub recurrence_checks: Vec<(Digest32, Outcome)>,
}

pub fn class_id(invariant: &str) -> Digest32 {
    hash("bnrose-evolve/lesson/v1", &[invariant.as_bytes()])
}

impl LessonEvent {
    pub fn class(&self) -> Digest32 {
        match self {
            LessonEvent::Opened { class, .. }
            | LessonEvent::Reproduced { class, .. }
            | LessonEvent::Repaired { class, .. }
            | LessonEvent::RecurrenceChecked { class, .. } => *class,
        }
    }

    pub(crate) fn encode_into(&self, e: Enc) -> Enc {
        match self {
            LessonEvent::Opened {
                class,
                invariant,
                triggers,
                note,
            } => {
                let mut e = e
                    .u8(0)
                    .digest(class)
                    .str(invariant)
                    .u64(triggers.len() as u64);
                for t in triggers {
                    e = e.digest(t);
                }
                e.str(note)
            }
            LessonEvent::Reproduced {
                class,
                check,
                attempt,
            } => e.u8(1).digest(class).str(check).digest(attempt),
            LessonEvent::Repaired { class, decision } => e.u8(2).digest(class).digest(decision),
            LessonEvent::RecurrenceChecked {
                class,
                attempt,
                outcome,
            } => e.u8(3).digest(class).digest(attempt).u8(*outcome as u8),
        }
    }

    pub(crate) fn decode_from(r: &mut Dec) -> Result<LessonEvent, Refusal> {
        Ok(match r.u8()? {
            0 => {
                let class = r.digest()?;
                let invariant = r.str()?;
                let n = r.u64()?;
                if n > 1 << 16 {
                    return Err(Refusal::Corrupt("trigger count".into()));
                }
                let triggers = (0..n).map(|_| r.digest()).collect::<Result<_, _>>()?;
                LessonEvent::Opened {
                    class,
                    invariant,
                    triggers,
                    note: r.str()?,
                }
            }
            1 => LessonEvent::Reproduced {
                class: r.digest()?,
                check: r.str()?,
                attempt: r.digest()?,
            },
            2 => LessonEvent::Repaired {
                class: r.digest()?,
                decision: r.digest()?,
            },
            3 => LessonEvent::RecurrenceChecked {
                class: r.digest()?,
                attempt: r.digest()?,
                outcome: match r.u8()? {
                    0 => Outcome::Pass,
                    1 => Outcome::NotRun,
                    2 => Outcome::Degraded,
                    3 => Outcome::Fail,
                    _ => return Err(Refusal::Corrupt("outcome".into())),
                },
            },
            _ => return Err(Refusal::Corrupt("lesson tag".into())),
        })
    }
}

impl Lesson {
    /// Fold one event. The controller has already checked the event's
    /// evidence before journaling it; replay folds without re-deciding.
    pub(crate) fn apply(lessons: &mut Vec<Lesson>, ev: &LessonEvent) {
        if let LessonEvent::Opened {
            class,
            invariant,
            triggers,
            ..
        } = ev
        {
            lessons.push(Lesson {
                class: *class,
                invariant: invariant.clone(),
                triggers: triggers.clone(),
                state: LessonState::Open,
                check: None,
                reproductions: Vec::new(),
                repairs: Vec::new(),
                recurrence_checks: Vec::new(),
            });
            return;
        }
        let Some(l) = lessons.iter_mut().find(|l| l.class == ev.class()) else {
            return;
        };
        match ev {
            LessonEvent::Opened { .. } => {}
            LessonEvent::Reproduced { check, attempt, .. } => {
                l.check = Some(check.clone());
                l.reproductions.push(*attempt);
                if matches!(l.state, LessonState::Open) {
                    l.state = LessonState::Reproduced;
                }
            }
            LessonEvent::Repaired { decision, .. } => {
                l.repairs.push(*decision);
                l.state = LessonState::Closed;
            }
            LessonEvent::RecurrenceChecked {
                attempt, outcome, ..
            } => {
                l.recurrence_checks.push((*attempt, *outcome));
                if *outcome == Outcome::Fail {
                    l.state = LessonState::Recurred;
                }
            }
        }
    }
}
