//! The external anchor of the journal: the statement a carrier holds where a
//! writer with store access cannot reach, and the check that compares a
//! journal against the latest one at open.
//!
//! Why it exists: the journal is an unkeyed SHA3 chain. It convicts edits
//! that were not re-chained, but a writer with access to the store can
//! rewrite the records and recompute every link and the head consistently;
//! [`crate::Controller::open`] then accepts the rewritten journal, because
//! nothing inside the store can tell. An anchor taken earlier and held
//! elsewhere can: the first `count` records of an honest journal still end
//! at the anchored link, however far the journal has grown since.
//!
//! The statement ([`AnchorStatement`]) binds three things:
//! - the journal head `(count, link of the last record)`;
//! - the digest of the latest PROMOTE [`crate::Decision::statement`];
//! - the digest of the sovereign policy in force.
//!
//! The check ([`check`], run by [`crate::Controller::open_anchored`] after
//! replay and before recovery writes anything) refuses as `Tampered` when the
//! local journal holds fewer records than the anchor (truncation), when its
//! first `count` records do not end at the anchored link (a rewrite, re-chained
//! or not, with or without regrowth), and when the head matches but the
//! statement's promote or policy digest does not (an anchor that does not
//! describe the journal it names). An unreachable carrier is refused, not
//! treated as "never anchored": the open fails closed.
//!
//! Named, not claimed: an anchor convicts a rewrite of the anchored prefix
//! only. Records appended after the latest anchor are as strong as the
//! unkeyed chain until the next anchor is published. The check trusts the
//! lookup it is handed; reading the carrier (a Vaulta table, a peer) and
//! publishing to it live outside this crate, which opens no socket.

use crate::canon::{Dec, Enc};
use crate::controller::Controller;
use crate::digest::{hash, Digest32};
use crate::journal::{dec_opt_digest, enc_opt_digest, Journal};
use crate::Refusal;

/// Kind byte of the statement form, apart from every journal record kind.
const KIND: u8 = 0xA0;

/// The canonical anchor statement.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AnchorStatement {
    /// The journal this anchor speaks for: an Antelope name (1-12 of
    /// `a-z1-5.`), so a carrier can key its row by it.
    pub subject: String,
    /// Records in the journal when the anchor was taken.
    pub count: u64,
    /// The link after record `count - 1` (all zero when `count == 0`).
    pub head: Digest32,
    /// [`crate::Decision::digest`] of the latest PROMOTE, if any.
    pub promote: Option<Digest32>,
    /// The digest of the sovereign policy in force, if any.
    pub policy: Option<Digest32>,
}

/// A subject a Vaulta table can key by: 1 to 12 characters of `a-z`, `1-5`
/// and `.`, not ending in `.`.
pub fn valid_subject(s: &str) -> bool {
    (1..=12).contains(&s.len())
        && !s.ends_with('.')
        && s.bytes()
            .all(|b| b.is_ascii_lowercase() || (b'1'..=b'5').contains(&b) || b == b'.')
}

impl AnchorStatement {
    /// The statement of `c`'s journal as it stands.
    pub fn of(c: &Controller, subject: &str) -> Result<AnchorStatement, Refusal> {
        if !valid_subject(subject) {
            return Err(Refusal::Unknown(format!(
                "anchor: subject {subject:?} is not an Antelope name"
            )));
        }
        let v = c.local_view();
        let (count, head) = v.journal.head();
        Ok(AnchorStatement {
            subject: subject.to_string(),
            count,
            head,
            promote: v.promote,
            policy: v.policy,
        })
    }

    /// The canonical bytes a carrier holds.
    pub fn encode(&self) -> Vec<u8> {
        let e = Enc::new(KIND)
            .str(&self.subject)
            .u64(self.count)
            .digest(&self.head);
        enc_opt_digest(enc_opt_digest(e, &self.promote), &self.policy).done()
    }

    /// Strict decode: wrong version or kind, an invalid subject, a short read
    /// or trailing bytes are `Corrupt`.
    pub fn decode(bytes: &[u8]) -> Result<AnchorStatement, Refusal> {
        let (kind, mut r) = Dec::open(bytes)?;
        if kind != KIND {
            return Err(Refusal::Corrupt("anchor: not an anchor statement".into()));
        }
        let s = AnchorStatement {
            subject: r.str()?,
            count: r.u64()?,
            head: r.digest()?,
            promote: dec_opt_digest(&mut r)?,
            policy: dec_opt_digest(&mut r)?,
        };
        r.end()?;
        if !valid_subject(&s.subject) {
            return Err(Refusal::Corrupt(
                "anchor: subject is not an Antelope name".into(),
            ));
        }
        Ok(s)
    }

    pub fn digest(&self) -> Digest32 {
        hash("bnrose-evolve/anchor/v1", &[&self.encode()])
    }
}

/// What the carrier said when asked for the latest anchor of a subject.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AnchorLookup {
    Anchored(AnchorStatement),
    /// The carrier answered, and holds no anchor for this subject.
    NeverAnchored,
    /// The carrier did not answer. Never read as `NeverAnchored`.
    Unreachable(String),
}

/// What an accepted open established.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AnchorCheck {
    /// No anchor exists yet: the journal is only as strong as its chain.
    Unanchored,
    /// The journal is exactly the anchored one.
    Matches { count: u64 },
    /// The anchored prefix is intact; `local - anchored` records are newer
    /// than the anchor and not yet covered by it.
    Extends { anchored: u64, local: u64 },
}

/// The local side of the comparison, read from a verified, replayed journal.
pub struct LocalView<'a> {
    pub(crate) journal: &'a Journal,
    pub(crate) promote: Option<Digest32>,
    pub(crate) policy: Option<Digest32>,
}

fn truncated(local: u64, anchored: u64) -> Refusal {
    Refusal::Tampered(format!(
        "anchor: journal truncated: {local} records local, {anchored} anchored"
    ))
}

/// Compare a journal against the latest anchor of `subject`.
pub fn check(
    view: &LocalView,
    subject: &str,
    latest: &AnchorLookup,
) -> Result<AnchorCheck, Refusal> {
    let a = match latest {
        AnchorLookup::NeverAnchored => return Ok(AnchorCheck::Unanchored),
        AnchorLookup::Unreachable(e) => {
            return Err(Refusal::Unknown(format!(
                "anchor: carrier unreachable, open fails closed: {e}"
            )))
        }
        AnchorLookup::Anchored(a) => a,
    };
    if a.subject != subject {
        return Err(Refusal::Unknown(format!(
            "anchor: handed the anchor of {:?}, opening {subject:?}",
            a.subject
        )));
    }
    let (local, _) = view.journal.head();
    let anchored_prefix = match view.journal.head_at(a.count) {
        Some((_, h)) => h,
        None => return Err(truncated(local, a.count)),
    };
    if anchored_prefix != a.head {
        return Err(Refusal::Tampered(format!(
            "anchor: the journal's first {} records are not the anchored ones",
            a.count
        )));
    }
    if local == a.count && (view.promote != a.promote || view.policy != a.policy) {
        return Err(Refusal::Tampered(
            "anchor: head matches but the anchored promote or policy digest does not".into(),
        ));
    }
    Ok(if local == a.count {
        AnchorCheck::Matches { count: local }
    } else {
        AnchorCheck::Extends {
            anchored: a.count,
            local,
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> AnchorStatement {
        AnchorStatement {
            subject: "evolve.ctr1".into(),
            count: 7,
            head: hash("t", &[b"h"]),
            promote: Some(hash("t", &[b"p"])),
            policy: None,
        }
    }

    #[test]
    fn statement_roundtrips_strictly() {
        let s = sample();
        let b = s.encode();
        assert_eq!(AnchorStatement::decode(&b).unwrap(), s);
        let mut extra = b.clone();
        extra.push(0);
        assert!(AnchorStatement::decode(&extra).is_err(), "trailing byte");
        for cut in 0..b.len() {
            assert!(AnchorStatement::decode(&b[..cut]).is_err(), "cut at {cut}");
        }
        let mut kind = b.clone();
        kind[1] = 0;
        assert!(
            AnchorStatement::decode(&kind).is_err(),
            "a journal record kind"
        );
        let mut bad = s.clone();
        bad.subject = "Evolve".into();
        assert!(
            AnchorStatement::decode(&bad.encode()).is_err(),
            "not a name"
        );
        assert_ne!(s.digest(), bad.digest());
    }

    #[test]
    fn subjects_are_antelope_names() {
        for ok in ["a", "evolve.ctr1", "abcdefghij12"] {
            assert!(valid_subject(ok), "{ok}");
        }
        for no in ["", "abcdefghij123", "Up", "a6", "a.", "a-b", "a b"] {
            assert!(!valid_subject(no), "{no}");
        }
    }
}
