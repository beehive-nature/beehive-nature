//! Milestone 2: Benchmarking the WB001 Canonical Intent Decoder bottleneck.
//! Measures latency distributions, throughput, and hostile-input rejection costs.

use std::time::{Duration, Instant};
use btungsten_wb001::{canonical, decode, IntentIn, Refusal, Text};

fn t(s: &str) -> Text {
    Text::Str(s.to_string())
}

fn b32(seed: &str) -> Vec<u8> {
    let mut v = vec![0u8; 32];
    let s = &seed.as_bytes()[..seed.len().min(24)];
    v[..s.len()].copy_from_slice(s);
    v
}

fn make_intent(payload_len: usize) -> Vec<u8> {
    let mut pld = vec![0u8; payload_len];
    for (i, b) in pld.iter_mut().enumerate() {
        *b = (i % 251) as u8;
    }
    let intent = IntentIn {
        domain: t("skaists.bpay/1"),
        nonce: b32("nonce-wb001"),
        epoch: 1,
        action: b32("action-hash-01"),
        destination: t("vault:0xBEEF"),
        capability: t("pay"),
        amount: 1_000_000,
        expiry: 1_790_000_000,
        payer: t("seat:bFUzZ"),
        payload: pld,
    };
    canonical(&intent.build().expect("valid intent")).expect("canonical")
}

#[derive(Debug, Clone)]
pub struct Stats {
    pub min: Duration,
    pub p50: Duration,
    pub p90: Duration,
    pub p99: Duration,
    pub max: Duration,
    pub mean: Duration,
    pub ops_per_sec: f64,
    pub mb_per_sec: f64,
}

fn measure_fn<F>(bytes_len: usize, iters: usize, mut f: F) -> Stats
where
    F: FnMut(),
{
    // Warmup
    for _ in 0..iters.min(100) {
        f();
    }

    let mut samples = Vec::with_capacity(iters);
    let total_start = Instant::now();
    for _ in 0..iters {
        let t0 = Instant::now();
        f();
        samples.push(t0.elapsed());
    }
    let total_elapsed = total_start.elapsed();

    samples.sort();
    let min = samples[0];
    let max = samples[samples.len() - 1];
    let p50 = samples[samples.len() / 2];
    let p90 = samples[(samples.len() * 90) / 100];
    let p99 = samples[(samples.len() * 99) / 100];
    let sum: Duration = samples.iter().sum();
    let mean = sum / (samples.len() as u32);
    let ops_per_sec = (iters as f64) / total_elapsed.as_secs_f64();
    let mb_per_sec = (iters as f64 * bytes_len as f64) / (total_elapsed.as_secs_f64() * 1_048_576.0);

    Stats {
        min,
        p50,
        p90,
        p99,
        max,
        mean,
        ops_per_sec,
        mb_per_sec,
    }
}

#[test]
fn test_benchmark_baseline_decode() {
    let env_min = make_intent(20);
    let env_med = make_intent(1024);
    let env_full = make_intent(4096);

    println!("\n=======================================================");
    println!("  WB001 DECODER BENCHMARK: WORKLOAD PROFILING");
    println!("=======================================================");
    println!("Envelope sizes: min={} B, med={} B, full={} B", env_min.len(), env_med.len(), env_full.len());

    // 1. Valid minimal
    let s_min = measure_fn(env_min.len(), 5_000, || {
        let res = decode(&env_min);
        assert!(res.is_ok());
    });
    println!("\n[1] Valid Minimal (len = {} B):", env_min.len());
    println!("    Throughput: {:.1} ops/sec ({:.2} MB/s)", s_min.ops_per_sec, s_min.mb_per_sec);
    println!("    Latency: p50={:?}, p90={:?}, p99={:?}, mean={:?}, min={:?}, max={:?}",
             s_min.p50, s_min.p90, s_min.p99, s_min.mean, s_min.min, s_min.max);

    // 2. Valid medium
    let s_med = measure_fn(env_med.len(), 5_000, || {
        let res = decode(&env_med);
        assert!(res.is_ok());
    });
    println!("\n[2] Valid Medium (len = {} B):", env_med.len());
    println!("    Throughput: {:.1} ops/sec ({:.2} MB/s)", s_med.ops_per_sec, s_med.mb_per_sec);
    println!("    Latency: p50={:?}, p90={:?}, p99={:?}, mean={:?}, min={:?}, max={:?}",
             s_med.p50, s_med.p90, s_med.p99, s_med.mean, s_med.min, s_med.max);

    // 3. Valid full
    let s_full = measure_fn(env_full.len(), 5_000, || {
        let res = decode(&env_full);
        assert!(res.is_ok());
    });
    println!("\n[3] Valid Full 4KB (len = {} B):", env_full.len());
    println!("    Throughput: {:.1} ops/sec ({:.2} MB/s)", s_full.ops_per_sec, s_full.mb_per_sec);
    println!("    Latency: p50={:?}, p90={:?}, p99={:?}, mean={:?}, min={:?}, max={:?}",
             s_full.p50, s_full.p90, s_full.p99, s_full.mean, s_full.min, s_full.max);

    // Hostile / Rejection Battery
    println!("\n--- Hostile Input Rejection Suite ---");

    // H1: Truncated
    let h_short = &env_min[..6];
    let s_short = measure_fn(h_short.len(), 5_000, || {
        assert_eq!(decode(h_short).err(), Some(Refusal::Short));
    });
    println!("  [H1: Short]      Throughput: {:.1} ops/sec | p50={:?}, mean={:?}", s_short.ops_per_sec, s_short.p50, s_short.mean);

    // H2: Bad Magic
    let mut h_magic = env_min.clone();
    h_magic[0] ^= 0x01;
    let s_magic = measure_fn(h_magic.len(), 5_000, || {
        assert_eq!(decode(&h_magic).err(), Some(Refusal::Magic));
    });
    println!("  [H2: Bad Magic]  Throughput: {:.1} ops/sec | p50={:?}, mean={:?}", s_magic.ops_per_sec, s_magic.p50, s_magic.mean);

    // H3: Bad Version
    let mut h_ver = env_min.clone();
    h_ver[7] = 0x99;
    let s_ver = measure_fn(h_ver.len(), 5_000, || {
        assert_eq!(decode(&h_ver).err(), Some(Refusal::Version));
    });
    println!("  [H3: Bad Version] Throughput: {:.1} ops/sec | p50={:?}, mean={:?}", s_ver.ops_per_sec, s_ver.p50, s_ver.mean);

    // H4: Bad Tag Order
    let mut h_tag = env_min.clone();
    h_tag[8] = 0x02; // Expected 0x01
    let s_tag = measure_fn(h_tag.len(), 5_000, || {
        assert_eq!(decode(&h_tag).err(), Some(Refusal::TagOrder));
    });
    println!("  [H4: Tag Order]  Throughput: {:.1} ops/sec | p50={:?}, mean={:?}", s_tag.ops_per_sec, s_tag.p50, s_tag.mean);

    // H5: Length bounds violation (domain len = 70 > 64)
    let mut h_len = env_min.clone();
    h_len[12] = 70;
    let s_len = measure_fn(h_len.len(), 5_000, || {
        assert_eq!(decode(&h_len).err(), Some(Refusal::Length));
    });
    println!("  [H5: Bad Length] Throughput: {:.1} ops/sec | p50={:?}, mean={:?}", s_len.ops_per_sec, s_len.p50, s_len.mean);

    // H6: Invalid UTF-8 (CESU-8 surrogate 0xED 0xA0 0x80)
    let mut h_utf8 = env_min.clone();
    h_utf8[13] = 0xed;
    h_utf8[14] = 0xa0;
    h_utf8[15] = 0x80;
    let s_utf8 = measure_fn(h_utf8.len(), 5_000, || {
        assert_eq!(decode(&h_utf8).err(), Some(Refusal::Utf8));
    });
    println!("  [H6: CESU-8 Utf8] Throughput: {:.1} ops/sec | p50={:?}, mean={:?}", s_utf8.ops_per_sec, s_utf8.p50, s_utf8.mean);

    // H7: Trailing bytes
    let mut h_trail = env_min.clone();
    h_trail.push(0x42);
    let s_trail = measure_fn(h_trail.len(), 5_000, || {
        assert_eq!(decode(&h_trail).err(), Some(Refusal::Trailing));
    });
    println!("  [H7: Trailing]   Throughput: {:.1} ops/sec | p50={:?}, mean={:?}", s_trail.ops_per_sec, s_trail.p50, s_trail.mean);
}

#[test]
fn test_differential_equivalence_against_saw_core() {
    use btungsten_wb001::decode_reference;

    // 1. Valid intents across various sizes
    for pld_len in [0, 1, 15, 64, 128, 512, 1024, 2048, 4096] {
        let env = make_intent(pld_len);
        let fast_res = decode(&env);
        let ref_res = decode_reference(&env);
        assert!(fast_res.is_ok(), "fast decode failed on valid intent pld_len={pld_len}");
        assert!(ref_res.is_ok(), "ref decode failed on valid intent pld_len={pld_len}");
        assert_eq!(*fast_res.unwrap(), *ref_res.unwrap(), "fast and ref decoded intent mismatch at pld_len={pld_len}");
    }

    // 2. All 7 refusal categories
    let base_env = make_intent(16);

    // Truncated (every length from 0 to 7)
    for k in 0..8 {
        assert_eq!(decode(&base_env[..k]).err(), decode_reference(&base_env[..k]).err());
    }

    // Corrupted magic
    for b in 0..7 {
        let mut m = base_env.clone();
        m[b] ^= 0xff;
        assert_eq!(decode(&m).err(), decode_reference(&m).err(), "magic corrupt mismatch at byte {b}");
    }

    // Corrupted version
    let mut v = base_env.clone();
    v[7] ^= 0x42;
    assert_eq!(decode(&v).err(), decode_reference(&v).err());

    // Corrupted tags
    for tag_idx in [8, 8 + 5 + 13, 8 + 5 + 13 + 5 + 32] {
        if tag_idx < base_env.len() {
            let mut t = base_env.clone();
            t[tag_idx] ^= 0x55;
            assert_eq!(decode(&t).err(), decode_reference(&t).err(), "tag corrupt mismatch at {tag_idx}");
        }
    }

    // Corrupted lengths (out of bounds)
    let mut l = base_env.clone();
    l[12] = 200; // domain len > 64
    assert_eq!(decode(&l).err(), decode_reference(&l).err());

    // UTF-8 corruptions (surrogates, overlongs, tails)
    for sub in [&[0xed, 0xa0, 0x80][..], &[0xc0, 0x80][..], &[0xff][..]] {
        let mut u = base_env.clone();
        u[13..13 + sub.len()].copy_from_slice(sub);
        assert_eq!(decode(&u).err(), decode_reference(&u).err());
    }

    // Trailing bytes
    let mut tr = base_env.clone();
    tr.push(0x99);
    assert_eq!(decode(&tr).err(), decode_reference(&tr).err());

    // 3. Bit-flip matrix over entire envelope (1640 mutants)
    let mut count = 0;
    for i in 0..base_env.len() {
        for bit in 0..8 {
            let mut m = base_env.clone();
            m[i] ^= 1 << bit;
            let fast_err = decode(&m).err();
            let ref_err = decode_reference(&m).err();
            assert_eq!(fast_err, ref_err, "bit flip mismatch at byte {i} bit {bit}: fast={fast_err:?}, ref={ref_err:?}");
            count += 1;
        }
    }
    println!("Differential verification complete: {count} mutants verified byte-for-byte against SAW decode_core reference.");
}
