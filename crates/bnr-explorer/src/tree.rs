//! Folders from paths. The estate's stored collections are flat lists of
//! `/`-separated names in canonical byte order (`bnr-archive`'s manifest is
//! the model); a folder view is a projection of that list, not a second
//! structure that could disagree with it.
//!
//! Every path under a prefix forms one contiguous run of a sorted list, so
//! the children of a folder are found by binary search plus one pass over
//! that folder's own descendants — never over the whole collection.

use alloc::vec::Vec;

use crate::listing::Kind;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Child<'a> {
    /// The child's single-segment name.
    pub name: &'a str,
    pub kind: Kind,
    /// For a file: its index in the path list.
    pub index: Option<usize>,
    /// For a folder: how many files lie anywhere beneath it.
    pub files_beneath: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TreeRefusal {
    /// The list is not strictly ascending by bytes (unsorted or duplicated).
    NonCanonical,
    /// A path has an empty, `.` or `..` segment, or the prefix does.
    BadPath,
}

fn bad_segment(s: &str) -> bool {
    s.is_empty() || s == "." || s == ".."
}

/// The children of folder `prefix` (`""` is the root; no trailing `/`).
pub fn children<'a>(paths: &[&'a str], prefix: &str) -> Result<Vec<Child<'a>>, TreeRefusal> {
    if !prefix.is_empty() && prefix.split('/').any(bad_segment) {
        return Err(TreeRefusal::BadPath);
    }
    if paths.windows(2).any(|w| w[0] >= w[1]) {
        return Err(TreeRefusal::NonCanonical);
    }
    let (lo, hi, skip) = if prefix.is_empty() {
        (0, paths.len(), 0)
    } else {
        // every descendant starts with "prefix/"; '/' + 1 is '0', so the run
        // ends before the first path >= "prefix0"
        let lo = paths.partition_point(|p| {
            p.as_bytes() < prefix.as_bytes()
                || (p.starts_with(prefix) && p.as_bytes().get(prefix.len()) < Some(&b'/'))
        });
        let hi = lo + paths[lo..].partition_point(|p| is_under(p, prefix));
        (lo, hi, prefix.len() + 1)
    };
    let mut out: Vec<Child<'a>> = Vec::new();
    for (i, p) in paths.iter().enumerate().take(hi).skip(lo) {
        let rest = &p[skip..];
        let (name, is_file) = match rest.find('/') {
            None => (rest, true),
            Some(k) => (&rest[..k], false),
        };
        if bad_segment(name) || (is_file && rest.is_empty()) {
            return Err(TreeRefusal::BadPath);
        }
        if !is_file && rest[name.len() + 1..].split('/').any(bad_segment) {
            return Err(TreeRefusal::BadPath);
        }
        if is_file {
            out.push(Child {
                name,
                kind: Kind::File,
                index: Some(i),
                files_beneath: 0,
            });
        } else {
            match out.last_mut() {
                Some(last) if last.kind == Kind::Folder && last.name == name => {
                    last.files_beneath += 1;
                }
                _ => out.push(Child {
                    name,
                    kind: Kind::Folder,
                    index: None,
                    files_beneath: 1,
                }),
            }
        }
    }
    Ok(out)
}

fn is_under(p: &str, prefix: &str) -> bool {
    p.len() > prefix.len() + 1 && p.starts_with(prefix) && p.as_bytes()[prefix.len()] == b'/'
}

#[cfg(test)]
mod tests {
    use super::*;

    const PATHS: [&str; 8] = [
        "a.txt",
        "docs/2026/report.pdf",
        "docs/2026/x/deep.txt",
        "docs/notes.md",
        "docs0.txt",
        "photos/bee.png",
        "photos/hive.jpg",
        "z",
    ];

    fn names<'a>(c: &[Child<'a>]) -> Vec<(&'a str, Kind, u32)> {
        c.iter()
            .map(|c| (c.name, c.kind, c.files_beneath))
            .collect()
    }

    #[test]
    fn the_root_shows_files_and_folders_once_each() {
        let c = children(&PATHS, "").unwrap();
        assert_eq!(
            names(&c),
            [
                ("a.txt", Kind::File, 0),
                ("docs", Kind::Folder, 3),
                ("docs0.txt", Kind::File, 0),
                ("photos", Kind::Folder, 2),
                ("z", Kind::File, 0),
            ]
        );
        assert_eq!(c[0].index, Some(0));
        assert_eq!(c[4].index, Some(7));
    }

    #[test]
    fn a_folder_sees_only_its_own_run() {
        let c = children(&PATHS, "docs").unwrap();
        assert_eq!(
            names(&c),
            [("2026", Kind::Folder, 2), ("notes.md", Kind::File, 0)]
        );
        // "docs0.txt" shares the letters but is not beneath "docs"
        assert!(c.iter().all(|c| c.name != "docs0.txt" && c.name != "0.txt"));
        let c = children(&PATHS, "docs/2026").unwrap();
        assert_eq!(
            names(&c),
            [("report.pdf", Kind::File, 0), ("x", Kind::Folder, 1)]
        );
        assert_eq!(c[0].index, Some(1));
        assert!(children(&PATHS, "nowhere").unwrap().is_empty());
        assert!(children(&PATHS, "a.txt").unwrap().is_empty());
    }

    #[test]
    fn a_list_that_is_not_canonical_is_refused() {
        assert_eq!(children(&["b", "a"], ""), Err(TreeRefusal::NonCanonical));
        assert_eq!(children(&["a", "a"], ""), Err(TreeRefusal::NonCanonical));
    }

    #[test]
    fn empty_and_dot_segments_are_refused_wherever_they_sit() {
        assert_eq!(children(&["a//b"], ""), Err(TreeRefusal::BadPath));
        assert_eq!(children(&["/a"], ""), Err(TreeRefusal::BadPath));
        assert_eq!(children(&["a/../b"], ""), Err(TreeRefusal::BadPath));
        assert_eq!(children(&["a/./b"], "a"), Err(TreeRefusal::BadPath));
        assert_eq!(children(&["a/b/"], "a"), Err(TreeRefusal::BadPath));
        assert_eq!(children(&["a/b"], "a/"), Err(TreeRefusal::BadPath));
        assert_eq!(children(&["a/b"], "../a"), Err(TreeRefusal::BadPath));
    }
}
