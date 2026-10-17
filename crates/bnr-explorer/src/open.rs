//! A listing is not permission. What a row said when it was drawn is a claim
//! about the past; opening acts on the present. So opening re-reads the
//! source and compares, and refuses on any difference rather than acting on
//! the row it was handed (Strata's provider rule, "a menu is not
//! authorization", taken as pattern).
//!
//! The kernel mints no grants. A [`Grant`] is whatever the consumer's own
//! authority issued for reading one object — an adapter attachment, a
//! delegation — reduced to the three things this check needs: which bytes,
//! which issuance, until when.

use crate::id::ObjectId;

/// The read grant one object was listed (or is now held) under.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Grant {
    /// The content the grant is for.
    pub id: ObjectId,
    /// Which issuance of the source's authority produced it. A source that
    /// was re-attached, re-keyed or re-scoped since the listing has a new
    /// epoch, and the listing's grant is stale even if the bytes are not.
    pub epoch: u32,
    /// Caller-clock microseconds after which the grant is spent, if it ends.
    pub expires_at: Option<u64>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OpenRefusal {
    /// The source no longer has the object.
    Gone,
    /// The source has an object under that name, but not those bytes.
    IdentityChanged,
    /// The authority the row was listed under has been reissued.
    StaleGrant,
    /// The current grant has run out.
    Expired,
}

impl OpenRefusal {
    pub const fn wire(self) -> u8 {
        match self {
            OpenRefusal::Gone => 1,
            OpenRefusal::IdentityChanged => 2,
            OpenRefusal::StaleGrant => 3,
            OpenRefusal::Expired => 4,
        }
    }
}

/// Compare what was listed with what the source says now. `current` is the
/// re-read, never a cached copy of `listed`.
pub fn revalidate(listed: &Grant, current: Option<&Grant>, now: u64) -> Result<(), OpenRefusal> {
    let current = current.ok_or(OpenRefusal::Gone)?;
    if current.id != listed.id {
        return Err(OpenRefusal::IdentityChanged);
    }
    if current.epoch != listed.epoch {
        return Err(OpenRefusal::StaleGrant);
    }
    if current.expires_at.is_some_and(|end| now >= end) {
        return Err(OpenRefusal::Expired);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::id::HashAlg;

    fn g(bytes: &[u8], epoch: u32, expires_at: Option<u64>) -> Grant {
        Grant {
            id: ObjectId::of(HashAlg::Sha256, bytes),
            epoch,
            expires_at,
        }
    }

    #[test]
    fn the_unchanged_object_opens() {
        let listed = g(b"x", 3, None);
        assert_eq!(revalidate(&listed, Some(&listed), 0), Ok(()));
        // a renewed expiry is the source's word now, and it is in force
        assert_eq!(
            revalidate(&g(b"x", 3, Some(5)), Some(&g(b"x", 3, Some(50))), 10),
            Ok(())
        );
    }

    #[test]
    fn every_kind_of_drift_is_refused_by_name() {
        let listed = g(b"x", 3, None);
        assert_eq!(revalidate(&listed, None, 0), Err(OpenRefusal::Gone));
        assert_eq!(
            revalidate(&listed, Some(&g(b"y", 3, None)), 0),
            Err(OpenRefusal::IdentityChanged)
        );
        assert_eq!(
            revalidate(&listed, Some(&g(b"x", 4, None)), 0),
            Err(OpenRefusal::StaleGrant)
        );
        assert_eq!(
            revalidate(&listed, Some(&g(b"x", 3, Some(10))), 10),
            Err(OpenRefusal::Expired)
        );
        assert_eq!(revalidate(&listed, Some(&g(b"x", 3, Some(10))), 9), Ok(()));
    }

    #[test]
    fn identity_is_judged_before_the_grant() {
        // changed bytes under a reissued grant: the person is told the bytes
        // changed, which is the fact that matters more
        let listed = g(b"x", 3, None);
        assert_eq!(
            revalidate(&listed, Some(&g(b"y", 9, Some(0))), 1),
            Err(OpenRefusal::IdentityChanged)
        );
    }
}
