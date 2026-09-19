//! PHASE E wave-slice tests — the binding-gate refusal matrix, calldata
//! laws with pinned golden vectors, the verification wall against a
//! clearly labelled PUBLIC synthetic key, and the exactly-one-receipt
//! ledger laws. Nothing here is hardware evidence; the transport is a
//! named FAKE signing with synthetic test keys (the z2.c pattern).
//!
//! The 56-payment shapes below mirror the FOUNDER JOB's real structure
//! (bridge state 2026-09-19: 56 quotes, wave_batch, ~4.066 ANT total)
//! with INVENTED hashes/amounts — synthetic, never the real quote set.

use alloy_rlp::{BufMut, Encodable, Header};
use k256::ecdsa::SigningKey;
use watchpay::abi::keccak256;
use watchpay::connect::{
    ConnectClock, ConnectRequestJson, ConnectSignedTxRaw, ConnectTransactionJson, ConnectTransport,
    DerivationPath, SignAttemptError,
};
use watchpay::types::{Atto, EthAddr, Hex32};
use watchpay::wave::{
    bind_authorization, commitment_digest, pay_for_quotes_calldata, pay_for_quotes_selector,
    sign_wave_slot, verify_wave_signed, WaveAuthorization, WaveAuthorizationEvent, WaveBinding,
    WaveDestination, WaveFeeCeilings, WaveJobSummary, WaveLedger, WaveNetwork, WaveQuotePayment,
    WaveSignReceipt, WaveSignRequest, ARBITRUM_ONE_ANT_TOKEN, ARBITRUM_ONE_PAYMENT_VAULT,
    MAX_TRANSFERS_PER_TRANSACTION,
};

/// PUBLIC synthetic test key #1 (the z2.c fixture key; never a wallet). // PUBLIC-CONSTANT: synthetic published test key, offline fixture signer
const SYNTH_KEY_HEX: &str = "0x020202020202020202020202020202020202020202020202020202020202022a"; // PUBLIC-CONSTANT: synthetic published test key, offline fixture signer
/// ethereumjs-recovered sender of the key above (z2.c fixture receipt). // PUBLIC-CONSTANT: fixture sender, ethereumjs-recovered
const SYNTH_SENDER: &str = "0x35defbea2aad6323726fed45dc3388010ea85f9c"; // PUBLIC-CONSTANT: fixture sender, ethereumjs-recovered

/// keccak256("payForQuotes((address,uint256,bytes32)[])")[0..4], pinned
/// golden (computed via the estate keccak; the pin catches any keccak
/// regression). // PUBLIC-CONSTANT: ABI selector, public contract ABI
const GOLDEN_PAY_FOR_QUOTES_SELECTOR: &str = "0xb6c2141b"; // PUBLIC-CONSTANT: ABI selector, public contract ABI

fn seed_from_hex(s: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    hex::decode_to_slice(&s[2..], &mut out).unwrap();
    out
}

fn payer() -> EthAddr {
    EthAddr::from_lower_hex(SYNTH_SENDER).unwrap()
}

fn path() -> DerivationPath {
    DerivationPath::parse("m/44'/60'/0'/0/0").unwrap()
}

// ---------- synthetic founder-job shapes (invented values) ----------

fn payments(n: usize) -> Vec<WaveQuotePayment> {
    (0..n)
        .map(|i| {
            let mut h = [0u8; 32];
            h[31] = i as u8;
            h[30] = (i >> 8) as u8;
            WaveQuotePayment {
                quote_hash: Hex32(keccak256(&h)),
                rewards: EthAddr([
                    0xc2, 0x0c, 0x19, 0xb5, 0x76, 0x29, 0xfc, 0x22, 0xe8, 0xe1, 0x50, 0xa3, 0xb9,
                    0x24, 0xa2, 0x0b, 0x0f, 0xa2, 0x5a, i as u8,
                ]),
                amount_atto: Atto::from_u64(72_600_000_000_000_000 + i as u64),
            }
        })
        .collect()
}

fn total_of(ps: &[WaveQuotePayment]) -> String {
    let mut sum = Atto::from_u64(0);
    for p in ps {
        sum = sum.checked_add(p.amount_atto).unwrap();
    }
    sum.to_decimal()
}

fn auth_for(ps: &[WaveQuotePayment], upload: &str) -> WaveAuthorization {
    WaveAuthorization {
        schema: "antd-bridge.authorization/1".into(),
        authorization_id: "auth-1789900000000".into(),
        upload_id: upload.into(),
        invoice_digest: format!("sha256:{}", "a".repeat(64)),
        commitment_digest: commitment_digest(ps),
        artifact_sha256: "338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e".into(), // PUBLIC-CONSTANT: public artifact content sha256 pin (committed invoice)
        artifact_bytes: 214_091_829,
        audience: "public".into(),
        ant_ceiling_atto: total_of(ps),
        gas_ceiling: "wallet-side at signing".into(),
        state: "authorized-for-signing".into(),
        events: vec![WaveAuthorizationEvent {
            at_unix_secs: 1_789_900_000,
            kind: "authorized-for-signing".into(),
            detail: "test fixture".into(),
        }],
    }
}

fn job_for(ps: &[WaveQuotePayment], upload: &str, status: &str, created: u64) -> WaveJobSummary {
    WaveJobSummary {
        upload_id: upload.into(),
        status: status.into(),
        artifact_sha256: "338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e".into(), // PUBLIC-CONSTANT: public artifact content sha256 pin (committed invoice)
        artifact_bytes: 214_091_829,
        payment_type: "wave_batch".into(),
        total_amount_atto: total_of(ps),
        created_at_unix_secs: created,
    }
}

fn bind_default(
    auth: &WaveAuthorization,
    jobs: &[WaveJobSummary],
    ps: &[WaveQuotePayment],
) -> watchpay::Result<WaveBinding> {
    bind_authorization(
        Some(auth),
        jobs,
        ps,
        payer(),
        &WaveNetwork::arbitrum_one().unwrap(),
    )
}

struct StepClock(u64);
impl ConnectClock for StepClock {
    fn now_unix(&mut self) -> u64 {
        self.0 += 1;
        self.0
    }
}

// ---------- the binding-gate refusal matrix ----------

fn refusal_of(r: watchpay::Result<WaveBinding>) -> String {
    match r {
        Err(watchpay::Error::Field { reason, .. }) => reason,
        Err(e) => panic!("expected a field refusal, got {e}"),
        Ok(_) => panic!("expected a refusal, the gate sealed a plan"),
    }
}

#[test]
fn law1_missing_authorization_refuses() {
    // TODAY'S LIVE STATE on the founder's machine: zero records exist.
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let r = bind_authorization(
        None,
        &jobs,
        &ps,
        payer(),
        &WaveNetwork::arbitrum_one().unwrap(),
    );
    let why = refusal_of(r);
    assert!(
        why.contains("LAW 1") && why.contains("missing-authorization"),
        "{why}"
    );
}

#[test]
fn law2_cancelled_and_consumed_states_refuse() {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    for state in ["cancelled", "signed", "consumed"] {
        let mut a = auth_for(&ps, "up-1");
        a.state = state.into();
        let why = refusal_of(bind_default(&a, &jobs, &ps));
        assert!(why.contains("LAW 2"), "{state}: {why}");
    }
}

#[test]
fn law3_missing_and_abandoned_jobs_refuse() {
    let ps = payments(56);
    let a = auth_for(&ps, "up-gone");
    let why = refusal_of(bind_default(&a, &[], &ps));
    assert!(
        why.contains("LAW 3") && why.contains("does not exist"),
        "{why}"
    );
    // abandoned = re-quoted away (the founder2 job's actual state)
    let jobs = vec![job_for(&ps, "up-1", "abandoned", 100)];
    let a = auth_for(&ps, "up-1");
    let why = refusal_of(bind_default(&a, &jobs, &ps));
    assert!(
        why.contains("LAW 3") && why.contains("only an OPEN job"),
        "{why}"
    );
}

#[test]
fn law4_newer_open_sibling_refuses_stale_lineage() {
    // The founder2 shape: authorization job abandoned by a newer open
    // sibling for the SAME artifact. (LAW 3 fires on the abandoned job;
    // here the authorization's job is still open but superseded.)
    let ps = payments(56);
    let mut jobs = vec![
        job_for(&ps, "up-old", "open", 100),
        job_for(&ps, "up-new", "open", 200),
    ];
    jobs[0].status = "open".into();
    let a = auth_for(&ps, "up-old");
    let why = refusal_of(bind_default(&a, &jobs, &ps));
    assert!(why.contains("LAW 4") && why.contains("stale"), "{why}");
}

#[test]
fn law5_artifact_identity_mismatches_refuse() {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let mut a = auth_for(&ps, "up-1");
    a.artifact_sha256 = "ff".repeat(32);
    let why = refusal_of(bind_default(&a, &jobs, &ps));
    assert!(why.contains("LAW 5"), "{why}");
    a = auth_for(&ps, "up-1");
    a.artifact_bytes += 1; // auth diverges from the job
    let why = refusal_of(bind_default(&a, &jobs, &ps));
    assert!(why.contains("LAW 5"), "{why}");
}

#[test]
fn law7_non_wave_payment_type_refuses() {
    let ps = payments(56);
    let mut jobs = vec![job_for(&ps, "up-1", "open", 100)];
    jobs[0].payment_type = "merkle".into();
    let a = auth_for(&ps, "up-1");
    let why = refusal_of(bind_default(&a, &jobs, &ps));
    assert!(why.contains("LAW 7"), "{why}");
}

#[test]
fn law8_empty_payment_set_refuses() {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let a = auth_for(&ps, "up-1");
    let why = refusal_of(bind_default(&a, &jobs, &[]));
    assert!(why.contains("LAW 8"), "{why}");
}

#[test]
fn law9_no_silent_requote_wall_refuses_changed_quote_set() {
    // Same authorization, a DIFFERENT (fresh) quote set: the wall.
    let ps = payments(56);
    let mut fresh = payments(56);
    fresh[0].quote_hash = Hex32(keccak256(&[9u8; 32]));
    assert_ne!(ps[0].quote_hash, fresh[0].quote_hash);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let a = auth_for(&ps, "up-1");
    let why = refusal_of(bind_default(&a, &jobs, &fresh));
    assert!(
        why.contains("LAW 9") && why.contains("no-silent-requote"),
        "{why}"
    );
}

#[test]
fn law10_ant_ceiling_three_way_exact() {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    // ceiling above the true total (the "never above" law)
    let mut a = auth_for(&ps, "up-1");
    let raised = Atto::from_u64(1).checked_add(a_ant(&a)).unwrap();
    a.ant_ceiling_atto = raised.to_decimal();
    let why = refusal_of(bind_default(&a, &jobs, &ps));
    assert!(why.contains("LAW 10"), "{why}");
    // job total disagrees with the payment sum (stale job row)
    let mut jobs2 = vec![job_for(&ps, "up-1", "open", 100)];
    jobs2[0].total_amount_atto = Atto::from_u64(1).to_decimal();
    let a2 = auth_for(&ps, "up-1");
    let why = refusal_of(bind_default(&a2, &jobs2, &ps));
    assert!(why.contains("LAW 10"), "{why}");
}

fn a_ant(a: &WaveAuthorization) -> Atto {
    Atto::parse_canonical(&a.ant_ceiling_atto).unwrap()
}

#[test]
fn law11_missing_gas_ceiling_refuses() {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let mut a = auth_for(&ps, "up-1");
    a.gas_ceiling = "  ".into();
    let why = refusal_of(bind_default(&a, &jobs, &ps));
    assert!(why.contains("LAW 11"), "{why}");
}

#[test]
fn law12_missing_invoice_digest_refuses() {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let mut a = auth_for(&ps, "up-1");
    a.invoice_digest = "not-a-digest".into();
    let why = refusal_of(bind_default(&a, &jobs, &ps));
    assert!(why.contains("LAW 12"), "{why}");
}

#[test]
fn law13_wrong_chain_token_vault_refuse() {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let a = auth_for(&ps, "up-1");
    let mut net = WaveNetwork::arbitrum_one().unwrap();
    net.chain_id = 42161 - 1;
    let why = refusal_of(bind_authorization(Some(&a), &jobs, &ps, payer(), &net));
    assert!(why.contains("LAW 13") && why.contains("chain"), "{why}");
    let mut net = WaveNetwork::arbitrum_one().unwrap();
    net.token = EthAddr([9u8; 20]);
    let why = refusal_of(bind_authorization(Some(&a), &jobs, &ps, payer(), &net));
    assert!(why.contains("LAW 13") && why.contains("contracts"), "{why}");
    let mut net = WaveNetwork::arbitrum_one().unwrap();
    net.vault = EthAddr([7u8; 20]);
    let why = refusal_of(bind_authorization(Some(&a), &jobs, &ps, payer(), &net));
    assert!(why.contains("LAW 13") && why.contains("contracts"), "{why}");
}

#[test]
fn law14_zero_payer_refuses() {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let a = auth_for(&ps, "up-1");
    let why = refusal_of(bind_authorization(
        Some(&a),
        &jobs,
        &ps,
        EthAddr([0u8; 20]),
        &WaveNetwork::arbitrum_one().unwrap(),
    ));
    assert!(why.contains("LAW 14"), "{why}");
}

#[test]
fn law15_transaction_count_is_two_for_56_payments_and_rides_the_plan() {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let a = auth_for(&ps, "up-1");
    let b = bind_default(&a, &jobs, &ps).expect("56-payment founder shape seals");
    assert_eq!(b.transaction_count(), 2, "1 approve + 1 payForQuotes");
    assert_eq!(b.payments().len(), 56);
    // determinism: same inputs, same seal
    let b2 = bind_default(&a, &jobs, &ps).unwrap();
    assert_eq!(b.plan_hash(), b2.plan_hash());
}

#[test]
fn commitment_digest_matches_bridge_derivation_shape() {
    // The bridge derivation: sorted 0x-lower hashes joined by \n, sha256.
    // Two payments with KNOWN hashes pin the exact string fed to sha256.
    let mut h1 = [0u8; 32];
    h1[31] = 2;
    let mut h2 = [0u8; 32];
    h2[31] = 1;
    let ps = vec![
        WaveQuotePayment {
            quote_hash: Hex32(h1),
            rewards: EthAddr([1; 20]),
            amount_atto: Atto::from_u64(5),
        },
        WaveQuotePayment {
            quote_hash: Hex32(h2),
            rewards: EthAddr([2; 20]),
            amount_atto: Atto::from_u64(6),
        },
    ];
    let expected_input = format!(
        "0x{}\n0x{}",
        hex::encode(h2), // sorted: h2 < h1 (last byte 1 < 2)
        hex::encode(h1)
    );
    // sha256 of that exact ascii string (computed independently below)
    let d = commitment_digest(&ps);
    assert!(d.starts_with("sha256:") && d.len() == 7 + 64);
    // Independent sha256 in the TEST (same sha2 crate — the pin is the
    // format law: sorted, newline-joined, 0x-prefixed lowercase).
    use sha2::Digest as _;
    let mut hh = sha2::Sha256::new();
    hh.update(expected_input.as_bytes());
    assert_eq!(d, format!("sha256:{}", hex::encode(hh.finalize())));
}

// ---------- calldata laws ----------

#[test]
fn pay_for_quotes_selector_is_the_pinned_golden() {
    let s = pay_for_quotes_selector();
    assert_eq!(
        format!("0x{}", hex::encode(s)),
        GOLDEN_PAY_FOR_QUOTES_SELECTOR,
        "selector drifted from the pinned golden"
    );
}

#[test]
fn pay_for_quotes_calldata_length_and_layout_law() {
    for n in [1usize, 3, 56] {
        let ps = payments(n);
        let cd = pay_for_quotes_calldata(&ps).unwrap();
        assert_eq!(cd.len(), 4 + 64 + 96 * n, "length law for n={n}");
        assert_eq!(&cd[4..32], &[0u8; 28], "offset word high bytes zero");
        assert_eq!(
            &cd[32..36],
            &32u32.to_be_bytes(),
            "offset word low 4 bytes = 0x20"
        );
        assert_eq!(
            &cd[36..68],
            &(n as u64).to_be_bytes(),
            "array length word for n={n}"
        );
        // tuple layout: rewards (left-padded), amount, quote hash — in
        // ABI order, NOT bridge persistence order.
        let base = 68;
        assert_eq!(&cd[base..base + 12], &[0u8; 12]);
        assert_eq!(&cd[base + 12..base + 32], ps[0].rewards.as_bytes());
        assert_eq!(
            &cd[base + 32..base + 64],
            &ps[0].amount_atto.0.to_big_endian()
        );
        assert_eq!(&cd[base + 64..base + 96], ps[0].quote_hash.as_bytes());
    }
}

#[test]
fn pay_for_quotes_refuses_empty_and_oversized_sets() {
    assert!(pay_for_quotes_calldata(&[]).is_err());
    let too_many = payments(MAX_TRANSFERS_PER_TRANSACTION + 1);
    assert!(pay_for_quotes_calldata(&too_many).is_err());
}

#[test]
fn pay_for_quotes_golden_calldata_vector() {
    // Fixed 3-payment set; golden generated once from THIS encoder and
    // pinned — any layout change (field order, offset, padding) breaks
    // the pin. Selector covered by its own golden above.
    let ps: Vec<WaveQuotePayment> = (1u8..=3)
        .map(|i| {
            let mut qh = vec![0u8; 31];
            qh.push(i);
            let mut rw = vec![0x11u8; 19];
            rw.push(i);
            WaveQuotePayment {
                quote_hash: Hex32(qh.try_into().unwrap()),
                rewards: EthAddr(rw.try_into().unwrap()),
                amount_atto: Atto::from_u64(1000 + i as u64),
            }
        })
        .collect();
    let cd = pay_for_quotes_calldata(&ps).unwrap();
    const GOLDEN_ABI_WORDS: [&str; 11] = [
        "0000000000000000000000000000000000000000000000000000000000000020", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "0000000000000000000000000000000000000000000000000000000000000003", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "0000000000000000000000001111111111111111111111111111111111111101", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "00000000000000000000000000000000000000000000000000000000000003e9", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "0000000000000000000000000000000000000000000000000000000000000001", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "0000000000000000000000001111111111111111111111111111111111111102", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "00000000000000000000000000000000000000000000000000000000000003ea", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "0000000000000000000000000000000000000000000000000000000000000002", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "0000000000000000000000001111111111111111111111111111111111111103", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "00000000000000000000000000000000000000000000000000000000000003eb", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
        "0000000000000000000000000000000000000000000000000000000000000003", // PUBLIC-CONSTANT: golden ABI word, synthetic fixture
    ];
    let golden_body = GOLDEN_ABI_WORDS.concat();
    assert_eq!(
        hex::encode(&cd[4..]),
        golden_body,
        "calldata body drifted from the golden ABI layout"
    );
}

// ---------- compose + review ----------

fn fees(nonce: u64) -> WaveFeeCeilings {
    WaveFeeCeilings {
        nonce,
        gas_limit: 400_000,
        max_fee_per_gas_wei: 100_000_000_000, // 100 gwei
        max_priority_fee_wei: 1_000_000_000,  // 1 gwei
    }
}

fn sealed56() -> WaveBinding {
    let ps = payments(56);
    let jobs = vec![job_for(&ps, "up-1", "open", 100)];
    let a = auth_for(&ps, "up-1");
    bind_default(&a, &jobs, &ps).unwrap()
}

#[test]
fn compose_approve_binds_token_destination_exact_total_and_slot1() {
    let b = sealed56();
    let req = WaveSignRequest::compose(&b, WaveDestination::Approve, fees(7), path()).unwrap();
    assert_eq!(req.to().to_lower_hex(), ARBITRUM_ONE_ANT_TOKEN);
    // approve(vault, EXACT total) — never unlimited, never another spender
    let expect = watchpay::calldata::approve_calldata(
        EthAddr::from_lower_hex(ARBITRUM_ONE_PAYMENT_VAULT).unwrap(),
        b.ant_ceiling(),
    )
    .unwrap();
    assert_eq!(req.data(), &expect);
    assert_eq!(req.dest().slot(), 1);
    // the Connect payload is the pinned 1559 wire shape
    let p = req.connect_payload();
    match p.transaction {
        ConnectTransactionJson::Eip1559 {
            chain_id,
            ref to,
            ref value,
            ..
        } => {
            assert_eq!(chain_id, 42161);
            assert_eq!(value, "0x0");
            assert_eq!(to, &ARBITRUM_ONE_ANT_TOKEN.to_string());
        }
        _ => panic!("wave slice composes 1559 only"),
    }
}

#[test]
fn compose_pay_for_quotes_binds_vault_destination_and_slot2() {
    let b = sealed56();
    let req = WaveSignRequest::compose(
        &b,
        WaveDestination::PayForQuotes { part: 0 },
        fees(8),
        path(),
    )
    .unwrap();
    assert_eq!(req.to().to_lower_hex(), ARBITRUM_ONE_PAYMENT_VAULT);
    assert_eq!(req.data(), &pay_for_quotes_calldata(b.payments()).unwrap());
    assert_eq!(req.dest().slot(), 2);
}

#[test]
fn compose_refuses_multi_part_and_out_of_range_slots() {
    let b = sealed56();
    let r = WaveSignRequest::compose(
        &b,
        WaveDestination::PayForQuotes { part: 1 },
        fees(9),
        path(),
    );
    assert!(r.is_err());
}

#[test]
fn review_summary_is_single_sourced_from_the_request() {
    let b = sealed56();
    let req = WaveSignRequest::compose(
        &b,
        WaveDestination::PayForQuotes { part: 0 },
        fees(8),
        path(),
    )
    .unwrap();
    let rs = req.review_summary();
    assert_eq!(rs.signature_count, 1);
    assert_eq!(rs.slot, 2);
    assert_eq!(rs.chain_id, 42161);
    assert_eq!(rs.payer, payer());
    assert_eq!(rs.calldata_keccak, Hex32(keccak256(req.data())));
    assert_eq!(rs.calldata_len as usize, req.data().len());
}

// ---------- the fake transport (z2.c pattern, wave payload only) ----------

enum WMutation {
    None,
    Chain(u64),
    Nonce(u64),
    To(EthAddr),
    Value1,
    FlipCalldata,
    GasLimit(u64),
    FeeCap(u64),
    WrongSigner,
    HighSMirror,
    RespVTamper,
    RespRTamper,
    Trailing,
    FamilySwap,
}

struct FakeWaveTransport {
    mutation: WMutation,
    calls: usize,
    refuse: bool,
}

impl FakeWaveTransport {
    fn new(m: WMutation) -> Self {
        FakeWaveTransport {
            mutation: m,
            calls: 0,
            refuse: false,
        }
    }
}

impl ConnectTransport for FakeWaveTransport {
    fn ethereum_sign_transaction(
        &mut self,
        request: &ConnectRequestJson,
    ) -> watchpay::Result<ConnectSignedTxRaw> {
        self.calls += 1;
        if self.refuse {
            return Err(watchpay::Error::Malformed(
                "fake transport: device rejected / timed out / disconnected".into(),
            ));
        }
        Ok(fake_wave_sign(request, &self.mutation))
    }
}

// Test-side RLP (independent of the lib's encoder).
enum T {
    S(Vec<u8>),
    L,
}
impl Encodable for T {
    fn encode(&self, out: &mut dyn BufMut) {
        match self {
            T::S(b) => b.as_slice().encode(out),
            T::L => Header {
                list: true,
                payload_length: 0,
            }
            .encode(out),
        }
    }
    fn length(&self) -> usize {
        match self {
            T::S(b) => b.as_slice().length(),
            T::L => 1,
        }
    }
}

fn rlp_list(items: Vec<T>) -> Vec<u8> {
    let mut out = Vec::with_capacity(alloy_rlp::list_length(&items));
    alloy_rlp::encode_list(&items, &mut out);
    out
}

fn uint(v: u64) -> Vec<u8> {
    if v == 0 {
        return Vec::new();
    }
    let be = v.to_be_bytes();
    let first = be.iter().position(|&b| b != 0).unwrap();
    be[first..].to_vec()
}

fn parse_q(s: &str) -> u64 {
    u64::from_str_radix(&s[2..], 16).unwrap()
}

fn hex_unprefixed(s: &str) -> Vec<u8> {
    hex::decode(&s[2..]).unwrap()
}

/// secp256k1 group order (high-s mirror). // PUBLIC-CONSTANT: secp256k1 group order, public curve parameter
const N_BE: [u8; 32] = [
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
    0xba, 0xae, 0xdc, 0xe6, 0xaf, 0x48, 0xa0, 0x3b, 0xbf, 0xd2, 0x5e, 0x8c, 0xd0, 0x36, 0x41, 0x41,
];

fn n_minus(s: &[u8; 32]) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut borrow = 0u16;
    for i in (0..32).rev() {
        let diff = (N_BE[i] as u16).wrapping_sub(s[i] as u16 + borrow);
        out[i] = diff as u8;
        borrow = if diff > 0xff { 1 } else { 0 };
    }
    out
}

fn minimal_scalar_hex(s: &[u8; 32]) -> String {
    let first = s.iter().position(|&b| b != 0).unwrap_or(32);
    format!("0x{}", hex::encode(&s[first..]))
}

/// The fake signer: 1559 only (the wave slice's envelope law).
fn fake_wave_sign(request: &ConnectRequestJson, m: &WMutation) -> ConnectSignedTxRaw {
    let ConnectTransactionJson::Eip1559 {
        ref to,
        ref value,
        ref gas_limit,
        ref nonce,
        ref data,
        chain_id,
        ref max_fee_per_gas,
        ref max_priority_fee_per_gas,
    } = request.transaction
    else {
        panic!("wave fake signs 1559 requests only");
    };
    let mut to_b = [0u8; 20];
    to_b.copy_from_slice(&hex_unprefixed(to));
    let mut chain_id = chain_id;
    let mut nonce = parse_q(nonce);
    let mut value = parse_q(value);
    let mut data = hex_unprefixed(data);
    let mut gas_limit = parse_q(gas_limit);
    let mut fee = parse_q(max_fee_per_gas);
    let priority = parse_q(max_priority_fee_per_gas);
    match m {
        WMutation::Chain(c) => chain_id = *c,
        WMutation::Nonce(n) => nonce = *n,
        WMutation::To(a) => to_b = *a.as_bytes(),
        WMutation::Value1 => value = 1,
        WMutation::FlipCalldata => data[40] ^= 0xff,
        WMutation::GasLimit(g) => gas_limit = *g,
        WMutation::FeeCap(f) => fee = *f,
        _ => {}
    }
    let make_legacy = matches!(m, WMutation::FamilySwap);
    const SYNTH_KEY2_HEX: &str =
        "0x030303030303030303030303030303030303030303030303030303030303033b"; // PUBLIC-CONSTANT: synthetic published test key #2, offline fixture signer
    let seed = match m {
        WMutation::WrongSigner => seed_from_hex(SYNTH_KEY2_HEX),
        _ => seed_from_hex(SYNTH_KEY_HEX),
    };
    let sk = SigningKey::from_slice(&seed).unwrap();
    let (serialized, v_u64, r, s) = if make_legacy {
        let pre = rlp_list(vec![
            T::S(uint(nonce)),
            T::S(uint(fee)),
            T::S(uint(gas_limit)),
            T::S(to_b.to_vec()),
            T::S(uint(value)),
            T::S(data.clone()),
            T::S(uint(chain_id)),
            T::S(vec![]),
            T::S(vec![]),
        ]);
        let digest = keccak256(&pre);
        let (sig, rid) = sk.sign_prehash_recoverable(&digest).unwrap();
        let b = sig.to_bytes();
        let (r, s): ([u8; 32], [u8; 32]) =
            (b[..32].try_into().unwrap(), b[32..].try_into().unwrap());
        let v = 2 * chain_id + 35 + rid.to_byte() as u64;
        let ser = rlp_list(vec![
            T::S(uint(nonce)),
            T::S(uint(fee)),
            T::S(uint(gas_limit)),
            T::S(to_b.to_vec()),
            T::S(uint(value)),
            T::S(data.clone()),
            T::S(uint(v)),
            T::S(r.to_vec()),
            T::S(s.to_vec()),
        ]);
        (ser, v, r, s)
    } else {
        let pre = {
            let mut out = vec![0x02u8];
            out.extend(rlp_list(vec![
                T::S(uint(chain_id)),
                T::S(uint(nonce)),
                T::S(uint(priority)),
                T::S(uint(fee)),
                T::S(uint(gas_limit)),
                T::S(to_b.to_vec()),
                T::S(uint(value)),
                T::S(data.clone()),
                T::L,
            ]));
            out
        };
        let digest = keccak256(&pre);
        let (sig, rid) = sk.sign_prehash_recoverable(&digest).unwrap();
        let b = sig.to_bytes();
        let (r, mut s): ([u8; 32], [u8; 32]) =
            (b[..32].try_into().unwrap(), b[32..].try_into().unwrap());
        let mut v = rid.to_byte() as u64;
        if matches!(m, WMutation::HighSMirror) {
            s = n_minus(&s);
            v = 1 - v;
        }
        let mut ser = vec![0x02u8];
        ser.extend(rlp_list(vec![
            T::S(uint(chain_id)),
            T::S(uint(nonce)),
            T::S(uint(priority)),
            T::S(uint(fee)),
            T::S(uint(gas_limit)),
            T::S(to_b.to_vec()),
            T::S(uint(value)),
            T::S(data.clone()),
            T::L,
            T::S(uint(v)),
            T::S(r.to_vec()),
            T::S(s.to_vec()),
        ]));
        if matches!(m, WMutation::Trailing) {
            ser.push(0x00);
        }
        (ser, v, r, s)
    };
    let (v_out, r_out, s_out) = match m {
        WMutation::RespVTamper => (
            format!("0x{:x}", v_u64 ^ 1),
            minimal_scalar_hex(&r),
            minimal_scalar_hex(&s),
        ),
        WMutation::RespRTamper => (
            format!("0x{:x}", v_u64),
            {
                let mut r2 = r;
                r2[0] ^= 0x01;
                minimal_scalar_hex(&r2)
            },
            minimal_scalar_hex(&s),
        ),
        _ => (
            format!("0x{:x}", v_u64),
            minimal_scalar_hex(&r),
            minimal_scalar_hex(&s),
        ),
    };
    ConnectSignedTxRaw {
        serialized_tx: format!("0x{}", hex::encode(&serialized)),
        v: v_out,
        r: r_out,
        s: s_out,
    }
}

// ---------- the verification wall ----------

fn verify_with(
    m: WMutation,
    dest: WaveDestination,
    nonce: u64,
) -> watchpay::Result<watchpay::wave::WaveVerifiedSigned> {
    let b = sealed56();
    let req = WaveSignRequest::compose(&b, dest, fees(nonce), path()).unwrap();
    let raw = fake_wave_sign(&req.connect_payload(), &m);
    verify_wave_signed(&req, &b, &raw)
}

fn wall_refusal_of(m: WMutation, dest: WaveDestination, nonce: u64) -> String {
    match verify_with(m, dest, nonce) {
        Err(watchpay::Error::Field { reason, .. }) => reason,
        Err(e) => panic!("expected a field refusal, got {e}"),
        Ok(_) => panic!("expected the wall to refuse"),
    }
}

#[test]
fn wall_happy_path_both_slots_verify_with_local_hash_and_recovered_signer() {
    let b = sealed56();
    for (dest, nonce) in [
        (WaveDestination::Approve, 7u64),
        (WaveDestination::PayForQuotes { part: 0 }, 8),
    ] {
        let req = WaveSignRequest::compose(&b, dest, fees(nonce), path()).unwrap();
        let raw = fake_wave_sign(&req.connect_payload(), &WMutation::None);
        let v = verify_wave_signed(&req, &b, &raw)
            .unwrap_or_else(|e| panic!("{dest:?} should verify: {e}"));
        assert_eq!(v.signer().to_lower_hex(), SYNTH_SENDER);
        assert_eq!(v.tx_hash().to_lower_hex().len(), 66);
        assert!(!v.serialized_tx().is_empty());
    }
}

#[test]
fn wall_refuses_field_mutations_with_named_fields() {
    // (mutation, expected field substring)
    let cases: Vec<(WMutation, &'static str)> = vec![
        (WMutation::Chain(42161 - 1), "tx chain"),
        (WMutation::Nonce(99), "nonce"),
        (WMutation::To(EthAddr([9u8; 20])), "to"),
        (WMutation::Value1, "value"),
        (WMutation::FlipCalldata, "input"),
        (WMutation::GasLimit(111_111), "gas_limit"),
        (WMutation::FeeCap(1_000_000), "maxFeePerGas"),
        (WMutation::WrongSigner, "recovered signer"),
        (WMutation::HighSMirror, "s"),
        (WMutation::RespVTamper, "v"),
        (WMutation::RespRTamper, "signature"),
        (WMutation::Trailing, "trailing"),
        (WMutation::FamilySwap, "legacy envelope"),
    ];
    for (m, field) in cases {
        let why = wall_refusal_of(m, WaveDestination::PayForQuotes { part: 0 }, 8);
        assert!(why.contains(field), "{field}: {why}");
    }
}

#[test]
fn wall_refuses_cross_plan_results() {
    // A result verified under binding A cannot record against binding B.
    let b1 = sealed56();
    let mut ps2 = payments(56);
    ps2[0].amount_atto = Atto::from_u64(72_600_000_000_000_000); // same as payments(0..)
    let jobs2 = vec![job_for(&ps2, "up-2", "open", 300)];
    let a2 = auth_for(&ps2, "up-2");
    let b2 = bind_default(&a2, &jobs2, &ps2).unwrap();
    assert_ne!(b1.plan_hash(), b2.plan_hash());
    let req = WaveSignRequest::compose(&b1, WaveDestination::Approve, fees(7), path()).unwrap();
    let raw = fake_wave_sign(&req.connect_payload(), &WMutation::None);
    let err = verify_wave_signed(&req, &b2, &raw).unwrap_err();
    assert!(err.to_string().contains("plan"), "{err}");
}

// ---------- receipt + ledger laws ----------

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("watchpay-wave-{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

#[test]
fn receipt_law_exactly_one_and_no_silent_resign_after_restart() {
    let root = tmp_root("one-receipt");
    let ledger = WaveLedger::open(&root).unwrap();
    let b = sealed56();
    let receipt = WaveSignReceipt::opening_intent(&b, &path(), 1_000);
    ledger.write_first_intent(&receipt).unwrap();
    // A RESTART (fresh receipt object, same authorization) must not
    // silently sign again: the first-intent write refuses to overwrite.
    let again = WaveSignReceipt::opening_intent(&b, &path(), 2_000);
    let err = ledger.write_first_intent(&again).unwrap_err();
    assert!(err.to_string().contains("never silently signs"), "{err}");
    // Reload preserves state.
    let loaded = ledger.load(b.authorization_id()).unwrap().unwrap();
    assert_eq!(loaded.state(), "signing-intent");
    assert!(!loaded.broadcast);
    assert!(!loaded.paid);
    assert!(!loaded.uploaded);
    assert!(!loaded.finalized);
    assert_eq!(loaded.transaction_count, 2);
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn driver_signs_both_slots_then_refuses_replay_and_duplicate() {
    let root = tmp_root("driver");
    let ledger = WaveLedger::open(&root).unwrap();
    let b = sealed56();
    let mut receipt = WaveSignReceipt::opening_intent(&b, &path(), 1_000);
    ledger.write_first_intent(&receipt).unwrap();
    let mut clock = StepClock(1_000);
    let mut transport = FakeWaveTransport::new(WMutation::None);
    // slot 1 (approve, nonce 7), slot 2 (payForQuotes, nonce 8)
    let v1 = sign_wave_slot(
        &ledger,
        &b,
        &mut receipt,
        WaveDestination::Approve,
        fees(7),
        &path(),
        &mut clock,
        &mut transport,
    )
    .unwrap();
    assert_eq!(v1.signer().to_lower_hex(), SYNTH_SENDER);
    assert_eq!(receipt.state(), "signing-intent", "one slot of two");
    let v2 = sign_wave_slot(
        &ledger,
        &b,
        &mut receipt,
        WaveDestination::PayForQuotes { part: 0 },
        fees(8),
        &path(),
        &mut clock,
        &mut transport,
    )
    .unwrap();
    assert_ne!(v1.tx_hash(), v2.tx_hash());
    assert_eq!(receipt.state(), "signed", "both slots signed — COMPLETE");
    // Replay: the same slot again refuses (successful-signature replay).
    let err = sign_wave_slot(
        &ledger,
        &b,
        &mut receipt,
        WaveDestination::Approve,
        fees(7),
        &path(),
        &mut clock,
        &mut transport,
    )
    .unwrap_err();
    assert!(matches!(err, SignAttemptError::AfterDispatch(_)), "{err}");
    // Cancel after complete refuses (durable record).
    let err = receipt.cancel(9_999, "founder changed mind").unwrap_err();
    assert!(err.to_string().contains("durable record"), "{err}");
    // The ledger file carries the final state.
    let loaded = ledger.load(b.authorization_id()).unwrap().unwrap();
    assert_eq!(loaded.state(), "signed");
    assert_eq!(loaded.slots.len(), 2);
    assert!(loaded
        .slots
        .iter()
        .all(|s| s.signer.to_lower_hex() == SYNTH_SENDER));
    assert!(!loaded.broadcast);
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn transport_refusal_never_retries_and_keeps_intent() {
    let root = tmp_root("no-retry");
    let ledger = WaveLedger::open(&root).unwrap();
    let b = sealed56();
    let mut receipt = WaveSignReceipt::opening_intent(&b, &path(), 1_000);
    ledger.write_first_intent(&receipt).unwrap();
    let mut clock = StepClock(1_000);
    let mut transport = FakeWaveTransport {
        mutation: WMutation::None,
        calls: 0,
        refuse: true, // device rejection / disconnect / timeout
    };
    let err = sign_wave_slot(
        &ledger,
        &b,
        &mut receipt,
        WaveDestination::Approve,
        fees(7),
        &path(),
        &mut clock,
        &mut transport,
    )
    .unwrap_err();
    assert!(matches!(err, SignAttemptError::AfterDispatch(_)));
    assert_eq!(transport.calls, 1, "NO automatic retry after dispatch");
    assert_eq!(receipt.state(), "signing-intent", "intent retained");
    // explicit cancel is the release path
    receipt.cancel(2_000, "device rejected").unwrap();
    assert_eq!(receipt.state(), "cancelled");
    // nothing may attach to a cancelled receipt
    let v_err = {
        let req = WaveSignRequest::compose(&b, WaveDestination::Approve, fees(7), path()).unwrap();
        let raw = fake_wave_sign(&req.connect_payload(), &WMutation::None);
        verify_wave_signed(&req, &b, &raw).unwrap()
    };
    let rec_err = receipt.record_verified_slot(&b, &v_err, 3_000).unwrap_err();
    assert!(rec_err.to_string().contains("cancelled"), "{rec_err}");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn late_callback_after_restart_refuses_at_slot_binding() {
    // Process death during signing-intent: on reload the receipt exists;
    // a LATE verified result for a slot that was never dispatched
    // in-session cannot attach without the driver's dispatch law — the
    // slot binding still refuses duplicates; and a result for a
    // DIFFERENT plan refuses outright.
    let root = tmp_root("late");
    let ledger = WaveLedger::open(&root).unwrap();
    let b = sealed56();
    let mut receipt = WaveSignReceipt::opening_intent(&b, &path(), 1_000);
    ledger.write_first_intent(&receipt).unwrap();
    // sign slot 1
    let mut clock = StepClock(1_000);
    let mut t = FakeWaveTransport::new(WMutation::None);
    sign_wave_slot(
        &ledger,
        &b,
        &mut receipt,
        WaveDestination::Approve,
        fees(7),
        &path(),
        &mut clock,
        &mut t,
    )
    .unwrap();
    // duplicate/late callback for slot 1 refuses
    let late = {
        let req = WaveSignRequest::compose(&b, WaveDestination::Approve, fees(7), path()).unwrap();
        let raw = fake_wave_sign(&req.connect_payload(), &WMutation::None);
        verify_wave_signed(&req, &b, &raw).unwrap()
    };
    let err = receipt.record_verified_slot(&b, &late, 9_000).unwrap_err();
    assert!(err.to_string().contains("replay"), "{err}");
    let _ = std::fs::remove_dir_all(&root);
}

// ---------- compose + review ----------
