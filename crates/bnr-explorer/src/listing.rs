//! The listing navigator: bounded batches, stale-result refusal, and the
//! phase marks a listing is measured by.
//!
//! One navigator per view. [`Navigator::begin`] starts a navigation and mints
//! its [`Ticket`]; everything a provider or the page reports afterwards
//! carries that ticket, and anything carrying a ticket that is no longer
//! current is refused with [`ListRefusal::Stale`]. That is the whole
//! mechanism by which a slow answer for a folder the person has already left
//! cannot paint over the one they are in — cancellation that does not depend
//! on the slow provider noticing it was cancelled.
//!
//! The marks separate what a single "loading time" blurs (Strata's
//! `performance-baseline.md` lists the same phases; the numbers here are ours
//! to measure, theirs are not targets):
//!
//! | mark | means |
//! |---|---|
//! | `requested` | the navigation began |
//! | `first_batch` | a provider answered at all |
//! | `first_useful` | the first admitted entry — or a completed empty listing, which is also an answer |
//! | `first_rendered` | the page drew its first admitted entry |
//! | `enumerated` | the provider said it has no more |
//! | `published` | enumerated, and every admitted entry drawn |
//!
//! Times are caller-supplied microseconds from one monotonic clock; the
//! kernel has none of its own.

use alloc::string::String;

use crate::id::ObjectId;
use crate::name::{admit_name, NameRefusal};

/// The most entries one batch may carry.
pub const MAX_BATCH: usize = 128;
/// The most entries (admitted plus refused) one navigation may carry.
pub const MAX_ENTRIES: u32 = 1_000_000;

/// One navigation's identity. Holding a ticket grants nothing: the navigator
/// compares it with its own current generation on every call.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ticket(u32);

impl Ticket {
    pub const fn generation(self) -> u32 {
        self.0
    }

    /// Rebuild a ticket from its wire form. A forged or old one is simply
    /// not current.
    pub const fn from_wire(generation: u32) -> Ticket {
        Ticket(generation)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    File,
    Folder,
}

/// One row as a provider reports it. A file must carry the id its bytes
/// will be checked against; a folder may (a manifest-addressed folder has
/// one) or may not (a folder derived from path prefixes does not).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub id: Option<ObjectId>,
    pub name: String,
    pub size: u64,
    pub kind: Kind,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EntryRefusal {
    Name(NameRefusal),
    /// A file with no content address cannot be verified, so it is not shown
    /// as if it could be.
    NoIdentity,
}

/// Admit one entry on its own terms.
pub fn admit_entry(e: &Entry) -> Result<(), EntryRefusal> {
    admit_name(&e.name).map_err(EntryRefusal::Name)?;
    if e.kind == Kind::File && e.id.is_none() {
        return Err(EntryRefusal::NoIdentity);
    }
    Ok(())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ListRefusal {
    /// The ticket is not the current navigation's.
    Stale,
    /// The provider already said it was finished.
    Closed,
    /// More than [`MAX_BATCH`] entries in one batch.
    BatchTooLarge,
    /// More than [`MAX_ENTRIES`] in one navigation.
    OverBudget,
    /// The page reported drawing more entries than were admitted.
    Overcount,
    /// The generation counter is spent; the view must be rebuilt. Reached
    /// after 2^32 − 1 navigations of one navigator, never by wrapping.
    Exhausted,
}

impl ListRefusal {
    pub const fn wire(self) -> u8 {
        match self {
            ListRefusal::Stale => 1,
            ListRefusal::Closed => 2,
            ListRefusal::BatchTooLarge => 3,
            ListRefusal::OverBudget => 4,
            ListRefusal::Overcount => 5,
            ListRefusal::Exhausted => 6,
        }
    }
}

/// What the navigator made of one batch. Bit `i` of `mask` is set when entry
/// `i` was admitted; only those may be drawn.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct BatchVerdict {
    pub accepted: u16,
    pub refused: u16,
    pub mask: [u8; MAX_BATCH / 8],
    /// Entries admitted so far in this navigation, this batch included.
    pub total: u32,
    /// This batch carried the navigation's first admitted entry.
    pub first_useful: bool,
    /// The last refusal in this batch, when there was one (enough for the
    /// page to name a reason; the count says how many).
    pub last_refusal: Option<EntryRefusal>,
}

impl BatchVerdict {
    pub fn admitted(&self, i: usize) -> bool {
        i < MAX_BATCH && self.mask[i / 8] & (1 << (i % 8)) != 0
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Marks {
    pub requested: u64,
    pub first_batch: Option<u64>,
    pub first_useful: Option<u64>,
    pub first_rendered: Option<u64>,
    pub enumerated: Option<u64>,
    pub published: Option<u64>,
}

#[derive(Debug, Default)]
pub struct Navigator {
    generation: u32,
    marks: Marks,
    admitted: u32,
    refused: u32,
    rendered: u32,
    enumerated: bool,
}

impl Navigator {
    pub const fn new() -> Navigator {
        Navigator {
            generation: 0,
            marks: Marks {
                requested: 0,
                first_batch: None,
                first_useful: None,
                first_rendered: None,
                enumerated: None,
                published: None,
            },
            admitted: 0,
            refused: 0,
            rendered: 0,
            enumerated: false,
        }
    }

    /// Start a navigation. Every earlier ticket stops being current.
    pub fn begin(&mut self, now: u64) -> Result<Ticket, ListRefusal> {
        let next = self
            .generation
            .checked_add(1)
            .ok_or(ListRefusal::Exhausted)?;
        *self = Navigator {
            generation: next,
            marks: Marks {
                requested: now,
                ..Marks::default()
            },
            ..Navigator::new()
        };
        Ok(Ticket(next))
    }

    pub fn is_current(&self, t: Ticket) -> bool {
        t.0 != 0 && t.0 == self.generation
    }

    fn check(&self, t: Ticket) -> Result<(), ListRefusal> {
        if self.is_current(t) {
            Ok(())
        } else {
            Err(ListRefusal::Stale)
        }
    }

    /// Admit a provider batch. A refused batch changes nothing.
    pub fn admit(
        &mut self,
        t: Ticket,
        batch: &[Entry],
        now: u64,
    ) -> Result<BatchVerdict, ListRefusal> {
        self.check(t)?;
        if self.enumerated {
            return Err(ListRefusal::Closed);
        }
        if batch.len() > MAX_BATCH {
            return Err(ListRefusal::BatchTooLarge);
        }
        let seen = self.admitted as u64 + self.refused as u64 + batch.len() as u64;
        if seen > MAX_ENTRIES as u64 {
            return Err(ListRefusal::OverBudget);
        }
        let mut v = BatchVerdict::default();
        for (i, e) in batch.iter().enumerate() {
            match admit_entry(e) {
                Ok(()) => {
                    v.mask[i / 8] |= 1 << (i % 8);
                    v.accepted += 1;
                }
                Err(r) => {
                    v.refused += 1;
                    v.last_refusal = Some(r);
                }
            }
        }
        self.admitted += v.accepted as u32;
        self.refused += v.refused as u32;
        if self.marks.first_batch.is_none() {
            self.marks.first_batch = Some(now);
        }
        if v.accepted > 0 && self.marks.first_useful.is_none() {
            self.marks.first_useful = Some(now);
            v.first_useful = true;
        }
        v.total = self.admitted;
        Ok(v)
    }

    /// The provider has no more entries for this navigation.
    pub fn finish(&mut self, t: Ticket, now: u64) -> Result<(), ListRefusal> {
        self.check(t)?;
        if self.enumerated {
            return Err(ListRefusal::Closed);
        }
        self.enumerated = true;
        self.marks.enumerated = Some(now);
        if self.marks.first_useful.is_none() {
            // "this folder is empty" (or "nothing here could be shown"),
            // said for certain, is the first useful thing the person learns
            self.marks.first_useful = Some(now);
        }
        self.settle(now);
        Ok(())
    }

    /// The page drew `count` more admitted entries.
    pub fn rendered(&mut self, t: Ticket, count: u32, now: u64) -> Result<(), ListRefusal> {
        self.check(t)?;
        let total = self
            .rendered
            .checked_add(count)
            .filter(|&r| r <= self.admitted)
            .ok_or(ListRefusal::Overcount)?;
        self.rendered = total;
        if count > 0 && self.marks.first_rendered.is_none() {
            self.marks.first_rendered = Some(now);
        }
        self.settle(now);
        Ok(())
    }

    fn settle(&mut self, now: u64) {
        if self.enumerated && self.rendered == self.admitted && self.marks.published.is_none() {
            self.marks.published = Some(now);
        }
    }

    pub fn marks(&self, t: Ticket) -> Result<Marks, ListRefusal> {
        self.check(t)?;
        Ok(self.marks)
    }

    /// `(admitted, refused, rendered)` for the current navigation.
    pub fn counts(&self, t: Ticket) -> Result<(u32, u32, u32), ListRefusal> {
        self.check(t)?;
        Ok((self.admitted, self.refused, self.rendered))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::id::HashAlg;
    use alloc::format;
    use alloc::vec::Vec;

    fn file(n: &str) -> Entry {
        Entry {
            id: Some(ObjectId::of(HashAlg::Sha256, n.as_bytes())),
            name: n.into(),
            size: n.len() as u64,
            kind: Kind::File,
        }
    }

    fn files(prefix: &str, k: usize) -> Vec<Entry> {
        (0..k).map(|i| file(&format!("{prefix}-{i}"))).collect()
    }

    #[test]
    fn a_slow_answer_for_the_folder_left_behind_is_refused() {
        let mut nav = Navigator::new();
        let a = nav.begin(10).unwrap();
        let b = nav.begin(20).unwrap();
        assert_eq!(nav.admit(a, &files("a", 3), 30), Err(ListRefusal::Stale));
        assert_eq!(nav.finish(a, 31), Err(ListRefusal::Stale));
        assert_eq!(nav.rendered(a, 0, 32), Err(ListRefusal::Stale));
        assert_eq!(nav.marks(a), Err(ListRefusal::Stale));
        let v = nav.admit(b, &files("b", 3), 40).unwrap();
        assert_eq!((v.accepted, v.total, v.first_useful), (3, 3, true));
        // the stale attempt left no trace on the current navigation
        assert_eq!(nav.counts(b), Ok((3, 0, 0)));
        assert_eq!(nav.marks(b).unwrap().first_batch, Some(40));
    }

    #[test]
    fn a_forged_or_zero_ticket_is_never_current() {
        let mut nav = Navigator::new();
        assert!(!nav.is_current(Ticket::from_wire(0)));
        let t = nav.begin(0).unwrap();
        assert!(nav.is_current(Ticket::from_wire(t.generation())));
        assert!(!nav.is_current(Ticket::from_wire(t.generation() + 1)));
        assert!(!nav.is_current(Ticket::from_wire(0)));
    }

    #[test]
    fn an_oversized_batch_is_refused_whole_and_counts_for_nothing() {
        let mut nav = Navigator::new();
        let t = nav.begin(0).unwrap();
        assert_eq!(
            nav.admit(t, &files("x", MAX_BATCH + 1), 1),
            Err(ListRefusal::BatchTooLarge)
        );
        assert_eq!(nav.counts(t), Ok((0, 0, 0)));
        assert_eq!(nav.marks(t).unwrap().first_batch, None);
        assert!(nav.admit(t, &files("x", MAX_BATCH), 2).is_ok());
    }

    #[test]
    fn refused_rows_are_masked_out_and_named() {
        let mut nav = Navigator::new();
        let t = nav.begin(0).unwrap();
        let mut batch = files("ok", 3);
        batch.insert(
            1,
            Entry {
                name: "a\u{202E}b".into(),
                ..file("x")
            },
        );
        batch.push(Entry {
            id: None,
            ..file("no-id")
        });
        let v = nav.admit(t, &batch, 5).unwrap();
        assert_eq!((v.accepted, v.refused), (3, 2));
        let shown: Vec<usize> = (0..batch.len()).filter(|&i| v.admitted(i)).collect();
        assert_eq!(shown, [0, 2, 3]);
        assert_eq!(v.last_refusal, Some(EntryRefusal::NoIdentity));
        // a folder needs no id
        let folder = Entry {
            id: None,
            kind: Kind::Folder,
            ..file("photos")
        };
        assert_eq!(admit_entry(&folder), Ok(()));
    }

    #[test]
    fn the_phases_are_marked_in_order_and_only_once() {
        let mut nav = Navigator::new();
        let t = nav.begin(100).unwrap();
        nav.admit(t, &[], 110).unwrap(); // a provider that answers with nothing yet
        let m = nav.marks(t).unwrap();
        assert_eq!(
            (m.requested, m.first_batch, m.first_useful),
            (100, Some(110), None)
        );
        nav.admit(t, &files("a", 2), 120).unwrap();
        nav.rendered(t, 2, 125).unwrap();
        nav.admit(t, &files("b", 2), 130).unwrap();
        nav.finish(t, 140).unwrap();
        let m = nav.marks(t).unwrap();
        assert_eq!(m.first_useful, Some(120));
        assert_eq!(m.first_rendered, Some(125));
        assert_eq!(m.enumerated, Some(140));
        assert_eq!(m.published, None, "two admitted rows are not drawn yet");
        nav.rendered(t, 2, 150).unwrap();
        assert_eq!(nav.marks(t).unwrap().published, Some(150));
        assert_eq!(nav.admit(t, &files("c", 1), 160), Err(ListRefusal::Closed));
        assert_eq!(nav.finish(t, 161), Err(ListRefusal::Closed));
    }

    #[test]
    fn an_empty_folder_said_for_certain_is_useful_and_published() {
        let mut nav = Navigator::new();
        let t = nav.begin(0).unwrap();
        nav.finish(t, 7).unwrap();
        let m = nav.marks(t).unwrap();
        assert_eq!((m.first_useful, m.published), (Some(7), Some(7)));
    }

    #[test]
    fn the_page_cannot_claim_more_drawn_than_admitted() {
        let mut nav = Navigator::new();
        let t = nav.begin(0).unwrap();
        nav.admit(t, &files("a", 2), 1).unwrap();
        assert_eq!(nav.rendered(t, 3, 2), Err(ListRefusal::Overcount));
        assert_eq!(nav.rendered(t, u32::MAX, 2), Err(ListRefusal::Overcount));
        assert!(nav.rendered(t, 2, 2).is_ok());
        assert_eq!(nav.rendered(t, 1, 3), Err(ListRefusal::Overcount));
    }

    #[test]
    fn a_hundred_thousand_rows_arrive_in_bounded_batches() {
        let mut nav = Navigator::new();
        let t = nav.begin(0).unwrap();
        let all = files("f", 100_000);
        let mut firsts = 0;
        for (k, chunk) in all.chunks(MAX_BATCH).enumerate() {
            let v = nav.admit(t, chunk, k as u64).unwrap();
            firsts += v.first_useful as u32;
            nav.rendered(t, v.accepted as u32, k as u64).unwrap();
        }
        nav.finish(t, 1_000_000).unwrap();
        assert_eq!(firsts, 1);
        assert_eq!(nav.counts(t), Ok((100_000, 0, 100_000)));
        let m = nav.marks(t).unwrap();
        assert_eq!((m.first_useful, m.published), (Some(0), Some(1_000_000)));
    }

    #[test]
    fn the_navigation_budget_is_enforced_before_counting() {
        let mut nav = Navigator::new();
        let t = nav.begin(0).unwrap();
        nav.admitted = MAX_ENTRIES - 1;
        assert_eq!(
            nav.admit(t, &files("a", 2), 1),
            Err(ListRefusal::OverBudget)
        );
        assert_eq!(nav.admitted, MAX_ENTRIES - 1);
        assert!(nav.admit(t, &files("a", 1), 1).is_ok());
    }

    #[test]
    fn the_generation_never_wraps_into_an_old_ticket() {
        let mut nav = Navigator::new();
        nav.generation = u32::MAX - 1;
        let last = nav.begin(0).unwrap();
        assert_eq!(last.generation(), u32::MAX);
        assert_eq!(nav.begin(1), Err(ListRefusal::Exhausted));
        assert!(
            nav.is_current(last),
            "a refused begin does not retire the live view"
        );
    }
}
