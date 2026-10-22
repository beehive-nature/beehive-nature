use bzdid::beelog::{verify_consistency, verify_inclusion, BeeLog, Frontier, Head};

#[test]
fn compact_frontier_matches_full_history_on_small_shapes_and_large_carries() {
    let mut full = BeeLog::new();
    let mut compact = Frontier::default();
    for i in 0u64..4096 {
        let bytes = i.to_le_bytes();
        let old = compact.head().unwrap();
        full.append(&bytes);
        let evidence = compact.append(&bytes).unwrap();
        assert_eq!(evidence.previous, old);
        // Every small shape plus large carry boundaries. Rehashing the entire
        // history on every large append would make this test quadratic in CI.
        if i >= 256 && !(i + 1).is_power_of_two() && !i.is_power_of_two() {
            continue;
        }
        assert_eq!(evidence.next, full.head());
        assert_eq!(evidence.inclusion, full.inclusion_proof(i).unwrap());
        verify_inclusion(&bytes, i, &evidence.next, &evidence.inclusion).unwrap();
        if i > 0 {
            assert_eq!(evidence.consistency, full.consistency_proof(i).unwrap());
            verify_consistency(&old, &evidence.next, &evidence.consistency).unwrap();
        }
    }
}

#[test]
fn ten_billion_logical_positions_use_only_the_frontier_and_bounded_paths() {
    // Logical-size stress, NOT ten billion identities or stored leaves. Roots
    // stand for previously trusted complete subtrees; their bytes are not here.
    let size = 10_000_000_000u64;
    let mut compact = Frontier::default();
    compact.size = size;
    for bit in 0..64 {
        if size & (1u64 << bit) != 0 {
            compact.peaks[bit] = Some([bit as u8; 32]);
        }
    }
    let old = compact.head().unwrap();
    let e = compact.append(b"user-owned batch").unwrap();
    assert_eq!(e.previous, old);
    assert_eq!(e.next.size, size + 1);
    assert!(e.inclusion.len() <= 34 && e.consistency.len() <= 35);
    verify_consistency(&old, &e.next, &e.consistency).unwrap();
    let mut wrong = e.next;
    wrong.root[0] ^= 1;
    assert!(verify_consistency(&old, &wrong, &e.consistency).is_err());
}

#[test]
fn malformed_frontiers_and_overflow_refuse_without_mutation() {
    let mut f = Frontier::default();
    f.peaks[0] = Some([1; 32]);
    assert!(f.head().is_err());
    let mut f = Frontier {
        size: u64::MAX,
        peaks: [Some([3; 32]); 64],
    };
    let saved = f.clone();
    assert!(f.append(b"no overflow").is_err());
    assert_eq!(f, saved);
    assert_eq!(Frontier::default().head().unwrap(), Head::empty());
}
