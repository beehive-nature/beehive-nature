//! The kernel over the estate's existing Rust storage trait, `atmirror::rail::Rail`
//! (its in-memory test rail), end to end: a stored collection is browsed as
//! folders in bounded batches, a navigation away refuses the old folder's late
//! answer, a listed row is revalidated before it is opened, and the bytes the
//! rail returns are judged against the content address the index recorded.
//! The kernel adds no storage trait: the rail is the rail, and its word is
//! never the verification.

use atmirror::rail::{testrail::MemRail, Rail, RailError};
use bnr_explorer::listing::MAX_BATCH;
use bnr_explorer::preview::{Preview, Unavailable, BUDGET};
use bnr_explorer::tree::children;
use bnr_explorer::{
    preview, revalidate, Entry, Grant, HashAlg, Kind, ListRefusal, Navigator, ObjectId, OpenRefusal,
};

/// One row of the collection's index: where the bytes are, and what they are.
struct Row {
    path: String,
    id: ObjectId,
    address: String,
    epoch: u32,
}

fn store(rail: &mut MemRail, files: &[(&str, &[u8])]) -> Vec<Row> {
    let mut rows: Vec<Row> = files
        .iter()
        .map(|(path, bytes)| Row {
            path: path.to_string(),
            id: ObjectId::of(HashAlg::Sha256, bytes),
            address: rail.put(bytes, &[]).unwrap(),
            epoch: 1,
        })
        .collect();
    rows.sort_by(|a, b| a.path.cmp(&b.path));
    rows
}

fn entries(rows: &[Row], folder: &str) -> Vec<Entry> {
    let paths: Vec<&str> = rows.iter().map(|r| r.path.as_str()).collect();
    children(&paths, folder)
        .unwrap()
        .into_iter()
        .map(|c| Entry {
            id: c.index.map(|i| rows[i].id),
            name: c.name.to_string(),
            size: 0,
            kind: c.kind,
        })
        .collect()
}

#[test]
fn a_collection_on_a_rail_is_browsed_opened_and_checked_through_the_kernel() {
    let mut rail = MemRail::default();
    let rows = store(
        &mut rail,
        &[
            ("notes/a.txt", b"first note\n"),
            ("notes/b.txt", b"second note\n"),
            ("photos/readme.txt", b"pictures live here\n"),
        ],
    );

    // the root, as folders
    let mut nav = Navigator::new();
    let root = nav.begin(0).unwrap();
    let top = entries(&rows, "");
    assert_eq!(
        top.iter()
            .map(|e| (e.name.as_str(), e.kind))
            .collect::<Vec<_>>(),
        [("notes", Kind::Folder), ("photos", Kind::Folder)]
    );
    assert_eq!(nav.admit(root, &top, 1).unwrap().accepted, 2);

    // into "notes": the root's late answer is refused, the folder's is drawn
    let notes = nav.begin(2).unwrap();
    assert_eq!(nav.admit(root, &top, 3), Err(ListRefusal::Stale));
    let inside = entries(&rows, "notes");
    let v = nav.admit(notes, &inside, 4).unwrap();
    assert_eq!((v.accepted, v.first_useful), (2, true));
    nav.finish(notes, 5).unwrap();

    // open a.txt: re-read its row, then read the rail, then judge the bytes
    let listed = Grant {
        id: rows[0].id,
        epoch: rows[0].epoch,
        expires_at: None,
    };
    let now = Grant {
        id: rows[0].id,
        epoch: rows[0].epoch,
        expires_at: None,
    };
    assert_eq!(revalidate(&listed, Some(&now), 6), Ok(()));
    let bytes = rail.get(&rows[0].address).unwrap();
    match preview(&rows[0].id, &bytes, &BUDGET) {
        Preview::Text(t) => assert_eq!(t.text, "first note\n"),
        other => panic!("{other:?}"),
    }

    // the rail swaps the bytes under the same address: refused before parsing
    rail.stored
        .insert(rows[0].address.clone(), b"not what was stored".to_vec());
    let swapped = rail.get(&rows[0].address).unwrap();
    assert_eq!(
        preview(&rows[0].id, &swapped, &BUDGET),
        Preview::Unavailable(Unavailable::IdentityChanged)
    );

    // the source was re-attached since the listing: the listing's grant is stale
    let reissued = Grant { epoch: 2, ..now };
    assert_eq!(
        revalidate(&listed, Some(&reissued), 7),
        Err(OpenRefusal::StaleGrant)
    );

    // the rail no longer has it: the rail says so, by name, and nothing is judged
    assert!(matches!(
        rail.get(&"0".repeat(64)),
        Err(RailError::Missing(_))
    ));
}

#[test]
fn a_large_collection_arrives_in_bounded_batches_whatever_the_rail() {
    let mut rail = MemRail::default();
    let names: Vec<String> = (0..1_000).map(|i| format!("bulk/{i:04}.txt")).collect();
    let files: Vec<(&str, Vec<u8>)> = names
        .iter()
        .map(|n| (n.as_str(), n.as_bytes().to_vec()))
        .collect();
    let refs: Vec<(&str, &[u8])> = files.iter().map(|(n, b)| (*n, b.as_slice())).collect();
    let rows = store(&mut rail, &refs);
    let all = entries(&rows, "bulk");
    assert_eq!(all.len(), 1_000);

    let mut nav = Navigator::new();
    let t = nav.begin(0).unwrap();
    let mut batches = 0;
    for chunk in all.chunks(MAX_BATCH) {
        nav.admit(t, chunk, batches).unwrap();
        batches += 1;
    }
    nav.finish(t, batches).unwrap();
    assert_eq!(batches, 1_000_u64.div_ceil(MAX_BATCH as u64));
    assert_eq!(nav.counts(t).unwrap().0, 1_000);
    // every row on the rail still answers to its own address
    assert!(rows
        .iter()
        .all(|r| r.id.matches(&rail.get(&r.address).unwrap())));
}
