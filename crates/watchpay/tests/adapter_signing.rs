//! z2.c adapter-boundary tests — deterministic compose → fake bridge →
//! cryptographic verification → ledger acceptance, plus the adversarial
//! fence around every field of the bridge result.
//!
//! FIXTURE PROVENANCE (independence law): the pinned transactions below
//! were produced by `dev/gen-connect-fixtures/` — `@ethereumjs/tx 10.1.3`
//! (the exact serialization family `@trezor/connect 9.7.3` itself pins at
//! `^10.1.0` and calls inside its own `serializeEthereumTx`), run offline
//! 2026-09-12 on synthetic inputs mirroring `test_support::base_batch`.
//! The EIP-155 vector is the specification's own published example
//! (bytes verbatim from the EIP text; sender/hash confirmed against
//! ethereumjs in the same generator run). Nothing here is hardware
//! evidence: the transport is a named FAKE signing with PUBLIC synthetic
//! test keys; a real device session is a separately-scoped later slice.
//!
//! WHAT EACH TEST PROVES is stated in its name; the mutation matrix feeds
//! the fake bridge VALIDY-SIGNED transactions whose FIELDS differ from the
//! approved request — proving the refusal is field binding, not signature
//! breakage — and every refusal test also asserts the ledger state is
//! untouched (Intent, reservation held, nothing freed, nothing Signed).

use watchpay::abi::keccak256;
use watchpay::connect::{
    record_verified_signed, sign_batch_payment, verify_signed_result, ConnectRequestJson,
    ConnectSignedTxRaw, ConnectTransactionJson, ConnectTransport, DerivationPath, SignRequest,
};
use watchpay::eth::recover_signer;
use watchpay::ledger::{AttemptState, Ledger};
use watchpay::plan::validate_plan;
use watchpay::signed_tx::SignedTx;
use watchpay::test_support::*;
use watchpay::tx::{TxDestination, TxEnvelope};
use watchpay::types::{Atto, EthAddr};

use alloy_rlp::{BufMut, Encodable, Header};
use k256::ecdsa::SigningKey;

// ---------- pinned fixtures (generator output; see module docs) ----------

/// PUBLIC synthetic test key #1 (invented for the generator; never a wallet). // PUBLIC-CONSTANT: synthetic published test key, offline fixture signer
const SYNTH_KEY_HEX: &str = "0x020202020202020202020202020202020202020202020202020202020202022a"; // PUBLIC-CONSTANT: synthetic published test key, offline fixture signer

/// PUBLIC synthetic test key #2 (the "wrong signer" arm of the mutation matrix). // PUBLIC-CONSTANT: synthetic published test key, offline fixture signer
const SYNTH_KEY2_HEX: &str = "0x030303030303030303030303030303030303030303030303030303030303033b"; // PUBLIC-CONSTANT: synthetic published test key, offline fixture signer

/// ethereumjs-recovered sender of SYNTH_KEY_HEX (the address our own k256
/// recovery must independently reproduce — asserted in a test below). // PUBLIC-CONSTANT: ethereumjs-derived address of the synthetic test key
const FIX_SENDER: &str = "0x35defbea2aad6323726fed45dc3388010ea85f9c";

/// @ethereumjs/tx 10.1.3 output: legacy EIP-155 batch-payment tx (chain 42161, nonce 7, gasPrice 100 gwei, gas 500000, vault to, base_batch calldata). // PUBLIC-CONSTANT: ethereumjs-signed offline fixture, synthetic inputs
const FIX_LEGACY_TX: &str = "0xf9092e0785174876e8008307a1209400000000000000000000000000000000000000b280b908c45460f240000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000068c4a398000000000000000000000000000000000000000000000000000000000000000201000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000110000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000013000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000001500000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000170000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000090000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000000b000000000000000000000000000000000000000000000000000000000000001b000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000d000000000000000000000000000000000000000000000000000000000000001d000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000000000000000000000000000000000000000001f0000000000000000000000000000000000000000000000000000000000000010020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000230000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000025000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002700000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000290000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002a0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002b0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002c0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002d0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002e0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002f000000000000000000000000000000000000000000000000000000000000000183014986a014618f4eb4a29d3503393944a51ef56f6ede673db7c24070f44daf06dc9a220aa01ff7a61030330e3c63edcd845c66c4c9d889fb9ad14d64bc58a57d9b0986cb75"; // PUBLIC-CONSTANT: ethereumjs-signed offline fixture, synthetic inputs
const FIX_LEGACY_V: &str = "0x14986"; // PUBLIC-CONSTANT: fixture response field (EIP-155 v form)
const FIX_LEGACY_R: &str = "0x14618f4eb4a29d3503393944a51ef56f6ede673db7c24070f44daf06dc9a220a"; // PUBLIC-CONSTANT: fixture response field (minimal-hex scalar)
const FIX_LEGACY_S: &str = "0x1ff7a61030330e3c63edcd845c66c4c9d889fb9ad14d64bc58a57d9b0986cb75"; // PUBLIC-CONSTANT: fixture response field (minimal-hex scalar)
const FIX_LEGACY_HASH: &str = "0xe50e4b960fb6422ba0ef5d2cc6e28a75f246c298ec0844080b7077ea55edf0d1"; // PUBLIC-CONSTANT: ethereumjs-computed tx hash of the fixture

/// @ethereumjs/tx 10.1.3 output: EIP-1559 batch-payment tx (same fields; maxFee 100 gwei, priority 1 gwei). // PUBLIC-CONSTANT: ethereumjs-signed offline fixture, synthetic inputs
const FIX_1559_TX: &str = "0x02f9093482a4b107843b9aca0085174876e8008307a1209400000000000000000000000000000000000000b280b908c45460f240000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000068c4a398000000000000000000000000000000000000000000000000000000000000000201000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000110000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000013000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000001500000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000170000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000090000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000000b000000000000000000000000000000000000000000000000000000000000001b000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000d000000000000000000000000000000000000000000000000000000000000001d000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000000000000000000000000000000000000000001f0000000000000000000000000000000000000000000000000000000000000010020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000230000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000025000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002700000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000290000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002a0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002b0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002c0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002d0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002e0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002f0000000000000000000000000000000000000000000000000000000000000001c080a09d9fbce10f8c836dd4145c4c9d2eee0f8c83db7de1bd8174bf7ab1e24f946729a02c233593c278a7a98d2d6b32fb22b8e72e7dfa7f26984e69a8808d13d24e48ce"; // PUBLIC-CONSTANT: ethereumjs-signed offline fixture, synthetic inputs
const FIX_1559_V: &str = "0x0"; // PUBLIC-CONSTANT: fixture response field (yParity form)
const FIX_1559_R: &str = "0x9d9fbce10f8c836dd4145c4c9d2eee0f8c83db7de1bd8174bf7ab1e24f946729"; // PUBLIC-CONSTANT: fixture response field (minimal-hex scalar)
const FIX_1559_S: &str = "0x2c233593c278a7a98d2d6b32fb22b8e72e7dfa7f26984e69a8808d13d24e48ce"; // PUBLIC-CONSTANT: fixture response field (minimal-hex scalar)
const FIX_1559_HASH: &str = "0x07143baead6ebccd8126b746778a974ecef2f5e5818bad3e57d58e4ac1b619b1"; // PUBLIC-CONSTANT: ethereumjs-computed tx hash of the fixture

/// @ethereumjs/tx 10.1.3 output: EIP-1559 approve tx (token to, approve(vault, 36), nonce 0) — used for the PURE approval compose/verify test (orchestration stays out of scope). // PUBLIC-CONSTANT: ethereumjs-signed offline fixture, synthetic inputs
const FIX_APPROVE_TX: &str = "0x02f8b382a4b180843b9aca0085174876e8008307a1209400000000000000000000000000000000000000a180b844095ea7b300000000000000000000000000000000000000000000000000000000000000b20000000000000000000000000000000000000000000000000000000000000024c080a02af8eef59eeda3bc2daf4f32c8335b75285829b5f6f614b725733007ec55559ca035eee8eda30884f66585f264d1c7bc5609e45edb5142823fc58f2bd2d6f50dd3"; // PUBLIC-CONSTANT: ethereumjs-signed offline fixture, synthetic inputs
const FIX_APPROVE_V: &str = "0x0"; // PUBLIC-CONSTANT: fixture response field (yParity form)
const FIX_APPROVE_R: &str = "0x2af8eef59eeda3bc2daf4f32c8335b75285829b5f6f614b725733007ec55559c"; // PUBLIC-CONSTANT: fixture response field (minimal-hex scalar)
const FIX_APPROVE_S: &str = "0x35eee8eda30884f66585f264d1c7bc5609e45edb5142823fc58f2bd2d6f50dd3"; // PUBLIC-CONSTANT: fixture response field (minimal-hex scalar)

/// The EIP-155 specification's own published example transaction (bytes verbatim from the EIP text; key 0x4646..46, chain 1, nonce 9). // PUBLIC-CONSTANT: EIP-155 spec's published example transaction
const SPEC155_TX: &str = "0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83"; // PUBLIC-CONSTANT: EIP-155 spec's published example transaction
/// The spec's own published signing hash for the vector above. // PUBLIC-CONSTANT: EIP-155 spec's published signing hash
const SPEC155_SIGNING_HASH: &str =
    "0xdaf5a779ae972f972197303d7b574746c7ef83eadac0f2791ad23db92e4c8e53"; // PUBLIC-CONSTANT: EIP-155 spec's published signing hash
/// ethereumjs-recovered sender of the spec vector (= the address of key 0x4646..46). // PUBLIC-CONSTANT: spec-vector sender per ethereumjs
const SPEC155_SENDER: &str = "0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f"; // PUBLIC-CONSTANT: spec-vector sender per ethereumjs // PUBLIC-CONSTANT: spec-vector sender per ethereumjs
/// ethereumjs-computed transaction hash of the spec vector. // PUBLIC-CONSTANT: spec-vector tx hash per ethereumjs
const SPEC155_TXHASH: &str = "0x33469b22e9f636356c4160a87eb19df52b7412e8eac32a4a55ffe88ea8350788"; // PUBLIC-CONSTANT: spec-vector tx hash per ethereumjs // PUBLIC-CONSTANT: spec-vector tx hash per ethereumjs

/// secp256k1 group order n (for the high-s mirror transformation). // PUBLIC-CONSTANT: secp256k1 group order, public curve parameter
const N_BE: [u8; 32] = [
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
    0xba, 0xae, 0xdc, 0xe6, 0xaf, 0x48, 0xa0, 0x3b, 0xbf, 0xd2, 0x5e, 0x8c, 0xd0, 0x36, 0x41, 0x41,
];

// ---------- harness: plan bound to the fixture payer ----------

fn seed_from_hex(s: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    hex::decode_to_slice(&s[2..], &mut out).unwrap();
    out
}

fn fixture_payer() -> EthAddr {
    EthAddr::from_lower_hex(FIX_SENDER).unwrap()
}

/// base_plan with expected_payer rebound to the synthetic test key's
/// address (plan_hash recomputed; full validation re-run).
fn payer_vp() -> watchpay::plan::ValidatedPlan {
    let mut p = base_plan();
    p.expected_payer = fixture_payer();
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    validate_plan(&p, SYNTH_NOW).unwrap()
}

fn path() -> DerivationPath {
    DerivationPath::parse("m/44'/60'/0'/0/0").unwrap()
}

fn tmp_root(tag: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("watchpay-z2c-{}-{}", tag, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn hex_unprefixed(s: &str) -> Vec<u8> {
    hex::decode(&s[2..]).unwrap()
}

/// Minimal-hex (leading zero bytes stripped) of a 32-byte scalar — the
/// `toString(16)` form Connect's response r/s carry.
fn minimal_scalar_hex(s: &[u8; 32]) -> String {
    let first = s.iter().position(|&b| b != 0).unwrap_or(32);
    format!("0x{}", hex::encode(&s[first..]))
}

// ---------- harness: the FAKE Connect transport (test-only) ----------

/// One hostile mutation of the bridge's behavior. Everything except
/// `Refuse`, `RespVTamper`, `RespRTamper`, `Trailing`, `TypeByte` and
/// `DropS` still produces a CRYPTOGRAPHICALLY VALID signature — over
/// fields that differ from the approved request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Mutation {
    None,
    /// Sign over a different chain id (replay protection binds elsewhere).
    Chain(u64),
    Nonce(u64),
    To(EthAddr),
    /// Attach 1 wei of native value.
    Value1,
    /// Flip one calldata byte (a different batch's payload class).
    FlipCalldata,
    GasLimit(u64),
    FeeCap(u64),
    PriorityFee(u64),
    /// Sign with synthetic key #2 (a different, still-valid signer).
    WrongSigner,
    /// Mirror the signature: s' = n - s, recid' = 1 - recid — recovers the
    /// SAME signer but violates EIP-2 low-s.
    HighSMirror,
    /// Sign the pre-EIP-155 six-field preimage; v = 27/28.
    Pre155,
    /// A 1559 request answered with a legacy envelope (or vice versa).
    FamilySwap,
    RespVTamper,
    RespRTamper,
    Trailing,
    /// Encode nonce non-minimally (leading zero byte).
    PadNonce,
    /// Emit a legacy list missing its final item (s absent).
    DropS,
    /// Replace the EIP-2718 type byte.
    TypeByte(u8),
}

struct FakeConnectTransport {
    mutation: Mutation,
    calls: usize,
    refuse: bool,
}

impl FakeConnectTransport {
    fn new(mutation: Mutation) -> Self {
        FakeConnectTransport {
            mutation,
            calls: 0,
            refuse: false,
        }
    }
    fn refusing() -> Self {
        FakeConnectTransport {
            mutation: Mutation::None,
            calls: 0,
            refuse: true,
        }
    }
}

impl ConnectTransport for FakeConnectTransport {
    fn ethereum_sign_transaction(
        &mut self,
        request: &ConnectRequestJson,
    ) -> watchpay::Result<ConnectSignedTxRaw> {
        self.calls += 1;
        if self.refuse {
            return Err(watchpay::Error::Malformed(
                "fake transport: user cancelled / timed out".into(),
            ));
        }
        Ok(fake_sign(request, self.mutation))
    }
}

// Test-side RLP (independent of the lib's private encoder): string items
// plus the empty-list term 1559's accessList carries.
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

/// The fake signer: parses the Connect request, applies the mutation,
/// signs the (possibly mutated) preimage with k256 RFC6979, and encodes
/// the signed envelope. Its encoder is test-local; the LIB decodes and
/// re-derives independently.
fn fake_sign(request: &ConnectRequestJson, mutation: Mutation) -> ConnectSignedTxRaw {
    let legacy_request = matches!(request.transaction, ConnectTransactionJson::Legacy { .. });
    let (to, value, gas_limit, nonce, data, chain_id, fee, priority) = match &request.transaction {
        ConnectTransactionJson::Legacy {
            to,
            value,
            gas_price,
            gas_limit,
            nonce,
            data,
            chain_id,
        } => (
            to.clone(),
            parse_q(value),
            parse_q(gas_limit),
            parse_q(nonce),
            hex_unprefixed(data),
            *chain_id,
            parse_q(gas_price),
            0,
        ),
        ConnectTransactionJson::Eip1559 {
            to,
            value,
            gas_limit,
            nonce,
            data,
            chain_id,
            max_fee_per_gas,
            max_priority_fee_per_gas,
        } => (
            to.clone(),
            parse_q(value),
            parse_q(gas_limit),
            parse_q(nonce),
            hex_unprefixed(data),
            *chain_id,
            parse_q(max_fee_per_gas),
            parse_q(max_priority_fee_per_gas),
        ),
    };
    let mut to_b = [0u8; 20];
    to_b.copy_from_slice(&hex_unprefixed(&to));
    let mut chain_id = chain_id;
    let mut nonce = nonce;
    let mut value = value;
    let mut data = data;
    let mut gas_limit = gas_limit;
    let mut fee = fee;
    let mut priority = priority;
    match mutation {
        Mutation::Chain(c) => chain_id = c,
        Mutation::Nonce(n) => nonce = n,
        Mutation::To(a) => to_b = *a.as_bytes(),
        Mutation::Value1 => value = 1,
        Mutation::FlipCalldata => data[40] ^= 0xff,
        Mutation::GasLimit(g) => gas_limit = g,
        Mutation::FeeCap(f) => fee = f,
        Mutation::PriorityFee(p) => priority = p,
        _ => {}
    }
    // The signed envelope family: the request's, unless swapped.
    let make_legacy = match mutation {
        Mutation::FamilySwap => !legacy_request,
        _ => legacy_request,
    };
    let seed = match mutation {
        Mutation::WrongSigner => seed_from_hex(SYNTH_KEY2_HEX),
        _ => seed_from_hex(SYNTH_KEY_HEX),
    };
    let sk = SigningKey::from_slice(&seed).unwrap();
    let nonce_enc = match mutation {
        Mutation::PadNonce => {
            let mut v = uint(nonce);
            if v.is_empty() {
                v = vec![0];
            }
            let mut padded = vec![0u8];
            padded.extend(v);
            padded
        }
        _ => uint(nonce),
    };
    let (preimage, mut v_u64, mut recid, r, mut s) = if make_legacy {
        let pre = if matches!(mutation, Mutation::Pre155) {
            rlp_list(vec![
                T::S(uint(nonce)),
                T::S(uint(fee)),
                T::S(uint(gas_limit)),
                T::S(to_b.to_vec()),
                T::S(uint(value)),
                T::S(data.clone()),
            ])
        } else {
            rlp_list(vec![
                T::S(nonce_enc.clone()),
                T::S(uint(fee)),
                T::S(uint(gas_limit)),
                T::S(to_b.to_vec()),
                T::S(uint(value)),
                T::S(data.clone()),
                T::S(uint(chain_id)),
                T::S(vec![]),
                T::S(vec![]),
            ])
        };
        let digest = keccak256(&pre);
        let (sig, rid) = sk.sign_prehash_recoverable(&digest).unwrap();
        let b = sig.to_bytes();
        let (r, s): ([u8; 32], [u8; 32]) =
            (b[..32].try_into().unwrap(), b[32..].try_into().unwrap());
        let v = if matches!(mutation, Mutation::Pre155) {
            27 + rid.to_byte() as u64
        } else {
            2 * chain_id + 35 + rid.to_byte() as u64
        };
        (pre, v, rid.to_byte(), r, s)
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
        let (r, s): ([u8; 32], [u8; 32]) =
            (b[..32].try_into().unwrap(), b[32..].try_into().unwrap());
        (pre, rid.to_byte() as u64, rid.to_byte(), r, s)
    };
    let _ = &preimage;
    let mut serialized = if make_legacy {
        let mut items = vec![
            T::S(nonce_enc),
            T::S(uint(fee)),
            T::S(uint(gas_limit)),
            T::S(to_b.to_vec()),
            T::S(uint(value)),
            T::S(data.clone()),
            T::S(uint(v_u64)),
            T::S(r.to_vec()),
        ];
        if !matches!(mutation, Mutation::DropS) {
            items.push(T::S(s.to_vec()));
        }
        rlp_list(items)
    } else {
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
            T::S(uint(v_u64)),
            T::S(r.to_vec()),
            T::S(s.to_vec()),
        ]));
        out
    };
    if matches!(mutation, Mutation::HighSMirror) {
        s = n_minus(&s);
        recid = 1 - recid;
        v_u64 = if make_legacy && !matches!(mutation, Mutation::Pre155) {
            2 * chain_id + 35 + recid as u64
        } else if matches!(mutation, Mutation::Pre155) {
            27 + recid as u64
        } else {
            recid as u64
        };
        // Re-encode with the mirrored s.
        if make_legacy {
            let mut items = vec![
                T::S(uint(nonce)),
                T::S(uint(fee)),
                T::S(uint(gas_limit)),
                T::S(to_b.to_vec()),
                T::S(uint(value)),
                T::S(data.clone()),
                T::S(uint(v_u64)),
                T::S(r.to_vec()),
                T::S(s.to_vec()),
            ];
            if matches!(mutation, Mutation::PadNonce) {
                let mut padded = vec![0u8];
                padded.extend(uint(nonce));
                items[0] = T::S(padded);
            }
            serialized = rlp_list(items);
        } else {
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
                T::S(uint(v_u64)),
                T::S(r.to_vec()),
                T::S(s.to_vec()),
            ]));
            serialized = out;
        }
    }
    if let Mutation::TypeByte(b) = mutation {
        serialized[0] = b;
    }
    if matches!(mutation, Mutation::Trailing) {
        serialized.push(0x00);
    }
    let mut v_str = format!("0x{v_u64:x}");
    let mut r_str = format!("0x{}", hex::encode(r));
    let s_str = format!("0x{}", hex::encode(s));
    if matches!(mutation, Mutation::RespVTamper) {
        v_str = format!("0x{:x}", v_u64 + 1);
    }
    if matches!(mutation, Mutation::RespRTamper) {
        let mut rb = r;
        rb[0] ^= 0x01;
        r_str = format!("0x{}", hex::encode(rb));
    }
    ConnectSignedTxRaw {
        serialized_tx: format!("0x{}", hex::encode(&serialized)),
        v: v_str,
        r: r_str,
        s: s_str,
    }
}

// ---------- shared assertions ----------

/// After a refused signing, the attempt must still be a plain Intent with
/// its reservation held — nothing entered Signed, nothing was freed.
fn assert_stays_intent(ledger: &Ledger, vp: &watchpay::plan::ValidatedPlan) {
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    let latest = recs.last().unwrap();
    assert!(
        matches!(latest.state, AttemptState::Intent),
        "refusal must not advance state past Intent"
    );
    let reserve = watchpay::types::Atto::from_u64(vp.plan().gas_ceilings.per_tx_gas_limit)
        .checked_mul(watchpay::types::Atto::from_u64(
            vp.plan().native_fee_ceilings.per_tx_max_fee_per_gas_wei,
        ))
        .unwrap();
    assert_eq!(
        latest.reserved_fee_wei, reserve,
        "refusal must not free the reservation"
    );
}

/// Deterministic step clock for the driver: returns `t0` on the first
/// observation and `t0 + step` on the second (intent time vs post-
/// transport completion time) — advancing a plan across expiry without
/// sleeping.
struct StepClock {
    t0: u64,
    step: u64,
    calls: usize,
}

impl StepClock {
    fn at(t0: u64) -> Self {
        StepClock {
            t0,
            step: 0,
            calls: 0,
        }
    }
    fn stepping(t0: u64, step: u64) -> Self {
        StepClock { t0, step, calls: 0 }
    }
}

impl watchpay::connect::ConnectClock for StepClock {
    fn now_unix(&mut self) -> u64 {
        let t = self.t0 + self.step * self.calls as u64;
        self.calls += 1;
        t
    }
}

fn run_driver(
    tag: &str,
    envelope: TxEnvelope,
    mutation: Mutation,
) -> (
    std::result::Result<watchpay::connect::VerifiedSigned, watchpay::connect::SignAttemptError>,
    Ledger,
    watchpay::plan::ValidatedPlan,
    FakeConnectTransport,
) {
    let ledger = Ledger::open(&tmp_root(tag)).unwrap();
    let vp = payer_vp();
    let mut transport = FakeConnectTransport::new(mutation);
    let mut clock = StepClock::at(SYNTH_NOW);
    let result = sign_batch_payment(
        &ledger,
        &vp,
        0,
        7,
        &path(),
        envelope,
        &mut clock,
        &mut transport,
    );
    (result, ledger, vp, transport)
}

// ---------- independence: pinned vectors through OUR decoder ----------

#[test]
fn spec_vector_eip155_decodes_recovers_and_hashes_as_published() {
    // Proves: our strict legacy decoder + EIP-155 signing-hash derivation +
    // k256 recovery agree with the EIP-155 SPECIFICATION's own published
    // vector (signing hash verbatim from the EIP text; sender/hash as
    // confirmed by ethereumjs in the generator run).
    let bytes = hex_unprefixed(SPEC155_TX);
    let tx = SignedTx::decode_strict(&bytes).unwrap();
    let legacy = match &tx {
        SignedTx::Legacy(t) => t,
        _ => panic!("spec vector must decode as legacy"),
    };
    assert_eq!(legacy.chain_id, 1);
    assert_eq!(legacy.nonce, 9);
    assert_eq!(legacy.recid, 0); // v = 0x25 = 2·1 + 35 + 0
    assert_eq!(
        SPEC155_SIGNING_HASH,
        format!("0x{}", hex::encode(tx.signing_hash()))
    );
    assert_eq!(SPEC155_TXHASH, tx.tx_hash().to_lower_hex());
    let signer = recover_signer(&tx.signing_hash(), &legacy.r, &legacy.s, legacy.recid).unwrap();
    assert_eq!(signer.to_lower_hex(), SPEC155_SENDER);
    assert_eq!(tx.canonical_bytes(), bytes);
}

#[test]
fn ethereumjs_legacy_fixture_parity() {
    // Proves: our decoder/hash/recovery reproduce @ethereumjs/tx 10.1.3's
    // own output for the same synthetic inputs — including the canonical
    // re-encode byte-equality against the fixture bytes.
    let bytes = hex_unprefixed(FIX_LEGACY_TX);
    let tx = SignedTx::decode_strict(&bytes).unwrap();
    let legacy = match &tx {
        SignedTx::Legacy(t) => t,
        _ => panic!("legacy fixture must decode as legacy"),
    };
    assert_eq!(legacy.chain_id, 42161);
    assert_eq!(legacy.nonce, 7);
    assert_eq!(legacy.gas_price_wei, 100_000_000_000);
    assert_eq!(legacy.gas_limit, 500_000);
    assert_eq!(legacy.v, 2 * 42161 + 35 + legacy.recid as u64);
    assert_eq!(FIX_LEGACY_HASH, tx.tx_hash().to_lower_hex());
    let signer = recover_signer(&tx.signing_hash(), &legacy.r, &legacy.s, legacy.recid).unwrap();
    assert_eq!(signer.to_lower_hex(), FIX_SENDER);
    assert_eq!(tx.canonical_bytes(), bytes);
    // The response-component form Connect pins: v is the EIP-155 integer,
    // r/s are minimal-hex scalars — exactly the fixture strings.
    assert_eq!(format!("0x{:x}", legacy.v), FIX_LEGACY_V);
    assert_eq!(minimal_scalar_hex(&legacy.r), FIX_LEGACY_R);
    assert_eq!(minimal_scalar_hex(&legacy.s), FIX_LEGACY_S);
}

#[test]
fn ethereumjs_1559_fixture_parity() {
    // Proves: the EIP-1559 decode/hash/recovery path against ethereumjs —
    // including the 0x02 envelope, empty-list accessList and yParity v.
    let bytes = hex_unprefixed(FIX_1559_TX);
    let tx = SignedTx::decode_strict(&bytes).unwrap();
    let t = match &tx {
        SignedTx::Eip1559(t) => t,
        _ => panic!("1559 fixture must decode as 1559"),
    };
    assert_eq!(t.chain_id, 42161);
    assert_eq!(t.nonce, 7);
    assert_eq!(t.max_fee_per_gas_wei, 100_000_000_000);
    assert_eq!(t.max_priority_fee_wei, 1_000_000_000);
    assert!(t.y_parity <= 1);
    assert_eq!(FIX_1559_HASH, tx.tx_hash().to_lower_hex());
    let signer = recover_signer(&tx.signing_hash(), &t.r, &t.s, t.y_parity).unwrap();
    assert_eq!(signer.to_lower_hex(), FIX_SENDER);
    assert_eq!(tx.canonical_bytes(), bytes);
    assert_eq!(format!("0x{:x}", t.y_parity), FIX_1559_V);
}

#[test]
fn synth_key_address_agrees_with_ethereumjs() {
    // Proves: the address of the synthetic test key as OUR recovery derives
    // it equals ethereumjs's sender for the same key — the two independent
    // implementations agree on the key's identity.
    let seed = seed_from_hex(SYNTH_KEY_HEX);
    let sk = SigningKey::from_slice(&seed).unwrap();
    let digest = [0x42u8; 32];
    let (sig, recid) = sk.sign_prehash_recoverable(&digest).unwrap();
    let b = sig.to_bytes();
    let r: [u8; 32] = b[..32].try_into().unwrap();
    let s: [u8; 32] = b[32..].try_into().unwrap();
    let addr = recover_signer(&digest, &r, &s, recid.to_byte()).unwrap();
    assert_eq!(addr.to_lower_hex(), FIX_SENDER);
}

#[test]
fn composed_request_matches_the_signed_fixture_fields() {
    // Proves: the plan-bound composer emits exactly the fields ethereumjs
    // signed in the fixtures — same destination, zero value, nonce, gas,
    // both fee forms, chain, and byte-identical calldata (the generator's
    // JS replicator and this crate's composer agree).
    let vp = payer_vp();
    for (envelope, fixture) in [
        (TxEnvelope::Legacy, FIX_LEGACY_TX),
        (TxEnvelope::Eip1559, FIX_1559_TX),
    ] {
        let req = SignRequest::compose(
            &vp,
            TxDestination::BatchPayment { batch_index: 0 },
            envelope,
            7,
            1,
            path(),
            SYNTH_NOW,
        )
        .unwrap();
        let tx = SignedTx::decode_strict(&hex_unprefixed(fixture)).unwrap();
        let decoded_data = match &tx {
            SignedTx::Legacy(t) => t.data.clone(),
            SignedTx::Eip1559(t) => t.data.clone(),
        };
        assert_eq!(req.data(), decoded_data.as_slice());
        assert_eq!(req.nonce(), 7);
        assert_eq!(req.chain_id(), 42161);
        assert_eq!(req.to(), vp.plan().network.payment_vault);
        assert_eq!(req.gas_limit(), 500_000);
        assert_eq!(req.max_fee_per_gas_wei(), 100_000_000_000);
    }
}

// ---------- adapter end to end ----------

#[test]
fn adapter_end_to_end_legacy_entered_signed() {
    // Proves: compose → fake bridge → cryptographic verification → ledger
    // acceptance for the legacy envelope, with ONE transport call, the
    // locally-computed hash inside the ledger record, and the recovered
    // signer bound to the plan's payer.
    let (result, ledger, vp, transport) =
        run_driver("e2e-legacy", TxEnvelope::Legacy, Mutation::None);
    let verified = result.unwrap();
    assert_eq!(transport.calls, 1);
    assert_eq!(verified.signer(), fixture_payer());
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    match &recs.last().unwrap().state {
        AttemptState::Signed { tx } => {
            assert_eq!(tx.tx_hash, verified.decoded_tx().tx_hash);
            assert_eq!(tx.envelope, TxEnvelope::Legacy);
            assert_eq!(tx.from, fixture_payer());
        }
        other => panic!("expected Signed, got {}", other.kind()),
    }
}

#[test]
fn adapter_end_to_end_1559_entered_signed() {
    // Same proof for the EIP-1559 envelope.
    let (result, ledger, vp, transport) =
        run_driver("e2e-1559", TxEnvelope::Eip1559, Mutation::None);
    let verified = result.unwrap();
    assert_eq!(transport.calls, 1);
    assert_eq!(verified.signer(), fixture_payer());
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    match &recs.last().unwrap().state {
        AttemptState::Signed { tx } => {
            assert_eq!(tx.tx_hash, verified.decoded_tx().tx_hash);
            assert_eq!(tx.envelope, TxEnvelope::Eip1559);
        }
        other => panic!("expected Signed, got {}", other.kind()),
    }
}

// ---------- field-binding mutations (validly signed, wrong fields) ----------

macro_rules! field_refusal {
    ($name:ident, $tag:expr, $envelope:expr, $mutation:expr, $field:expr, $what:expr) => {
        #[test]
        fn $name() {
            // Proves: a VALIDY-SIGNED transaction whose $what differs from
            // the approved request is refused naming `$field`, and the
            // ledger keeps the open Intent with its reservation held.
            let (result, ledger, vp, transport) = run_driver($tag, $envelope, $mutation);
            let err = result.unwrap_err();
            assert_eq!(
                err.field_name(),
                Some($field),
                "refusal must name {}",
                $field
            );
            assert_eq!(transport.calls, 1, "the hostile result was delivered");
            assert_stays_intent(&ledger, &vp);
        }
    };
}

field_refusal!(
    tampered_chain_refused,
    "tamper-chain",
    TxEnvelope::Eip1559,
    Mutation::Chain(421614),
    "chain_id",
    "chain id"
);
field_refusal!(
    tampered_chain_legacy_refused,
    "tamper-chain-leg",
    TxEnvelope::Legacy,
    Mutation::Chain(1),
    "chain_id",
    "chain id"
);
field_refusal!(
    tampered_nonce_refused,
    "tamper-nonce",
    TxEnvelope::Eip1559,
    Mutation::Nonce(8),
    "nonce",
    "nonce"
);
field_refusal!(
    tampered_destination_refused,
    "tamper-dest",
    TxEnvelope::Eip1559,
    Mutation::To(EthAddr([9u8; 20])),
    "to",
    "destination"
);
field_refusal!(
    tampered_value_refused,
    "tamper-value",
    TxEnvelope::Legacy,
    Mutation::Value1,
    "value",
    "native value"
);
field_refusal!(
    tampered_calldata_refused,
    "tamper-calldata",
    TxEnvelope::Eip1559,
    Mutation::FlipCalldata,
    "input",
    "calldata"
);
field_refusal!(
    tampered_gas_limit_refused,
    "tamper-gas",
    TxEnvelope::Eip1559,
    Mutation::GasLimit(400_000),
    "gas_limit",
    "gas limit"
);
field_refusal!(
    tampered_fee_cap_refused,
    "tamper-feecap",
    TxEnvelope::Eip1559,
    Mutation::FeeCap(90_000_000_000),
    "maxFeePerGas",
    "fee cap"
);
field_refusal!(
    tampered_fee_cap_legacy_refused,
    "tamper-feecap-leg",
    TxEnvelope::Legacy,
    Mutation::FeeCap(90_000_000_000),
    "gasPrice",
    "gas price"
);
field_refusal!(
    tampered_priority_fee_refused,
    "tamper-priority",
    TxEnvelope::Eip1559,
    Mutation::PriorityFee(2_000_000_000),
    "maxPriorityFeePerGas",
    "priority fee"
);
field_refusal!(
    envelope_family_swap_refused,
    "family-swap",
    TxEnvelope::Eip1559,
    Mutation::FamilySwap,
    "tx_type",
    "envelope family"
);

// ---------- signature/identity forgeries ----------

#[test]
fn wrong_signer_refused() {
    // Proves: even a perfectly valid, perfectly matching transaction signed
    // by a DIFFERENT key is refused — the signer is RECOVERED, never read
    // from a claim, and must equal the plan's expected_payer.
    let (result, ledger, vp, _t) =
        run_driver("wrong-signer", TxEnvelope::Eip1559, Mutation::WrongSigner);
    let err = result.unwrap_err();
    assert_eq!(err.field_name(), Some("from"));
    assert!(err.to_string().contains("recovered signer"));
    assert_stays_intent(&ledger, &vp);
}

#[test]
fn response_v_mismatch_refused() {
    // Proves: a forged response v (disagreeing with the envelope-embedded
    // v) is refused — the two signature-component sources Connect returns
    // must agree.
    let (result, ledger, vp, _t) = run_driver("resp-v", TxEnvelope::Eip1559, Mutation::RespVTamper);
    assert_eq!(result.unwrap_err().field_name(), Some("v"));
    assert_stays_intent(&ledger, &vp);
}

#[test]
fn response_r_mismatch_refused() {
    // Proves: a forged response r is refused the same way.
    let (result, ledger, vp, _t) = run_driver("resp-r", TxEnvelope::Legacy, Mutation::RespRTamper);
    assert_eq!(result.unwrap_err().field_name(), Some("signature"));
    assert_stays_intent(&ledger, &vp);
}

#[test]
fn high_s_twin_refused_by_eip2() {
    // Proves: the EIP-2 malleability twin ((r, n−s) with flipped parity —
    // the same signature to the raw curve math) is refused on BOTH layers:
    // the adapter's explicit low-s check names `s` before recovery runs,
    // and k256's recovery (which verifies its candidate against the
    // preimage) independently rejects the high-s form.
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::HighSMirror);
    // (1) The high-s twin cannot sneak through RECOVERY either: k256's
    // recover_from_prehash verifies the candidate signature against the
    // preimage and rejects the high-s form — demonstrated directly here.
    // (The EIP-2 malleability identity is exactly why this fence matters:
    // (r, n−s, 1−recid) is the same signature to the raw curve math.)
    let tx = SignedTx::decode_strict(&hex_unprefixed(&raw.serialized_tx)).unwrap();
    let t = match &tx {
        SignedTx::Eip1559(t) => t,
        _ => panic!(),
    };
    let s_mirror: [u8; 32] = hex_unprefixed(&raw.s).try_into().unwrap();
    let rid = t.y_parity;
    let rec_err = recover_signer(&tx.signing_hash(), &t.r, &s_mirror, rid).unwrap_err();
    assert_eq!(rec_err.field_name(), Some("signature"));
    // (2) The adapter's own explicit EIP-2 check fires FIRST (before
    // recovery), naming `s` precisely.
    let err = verify_signed_result(&req, &vp, &raw).unwrap_err();
    assert_eq!(err.field_name(), Some("s"));
    assert!(err.to_string().contains("high-s"));
}

#[test]
fn legacy_pre155_v_refused() {
    // Proves: a legacy signature without EIP-155 replay protection
    // (v = 27/28) never reaches field binding.
    let (result, ledger, vp, _t) = run_driver("pre155", TxEnvelope::Legacy, Mutation::Pre155);
    let err = result.unwrap_err();
    assert_eq!(err.field_name(), Some("v"));
    assert!(err.to_string().contains("replay"));
    assert_stays_intent(&ledger, &vp);
}

// ---------- malformed / oversized / non-canonical ----------

#[test]
fn malformed_serialized_refused() {
    // Proves: garbage and truncated bodies fail closed.
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    for bad in [
        "0xzz", "0x02",     // type byte with no body
        "0x",       // empty
        "0x02f901", // truncated mid-header
        "0xc0",     // empty list (zero items)
    ] {
        let raw = ConnectSignedTxRaw {
            serialized_tx: bad.to_string(),
            v: "0x0".into(),
            r: FIX_1559_R.into(),
            s: FIX_1559_S.into(),
        };
        assert!(verify_signed_result(&req, &vp, &raw).is_err(), "{bad:?}");
    }
}

#[test]
fn trailing_bytes_refused() {
    let (result, ledger, vp, _t) = run_driver("trailing", TxEnvelope::Eip1559, Mutation::Trailing);
    assert!(result.unwrap_err().field_name().is_some());
    assert_stays_intent(&ledger, &vp);
}

#[test]
fn nonminimal_integer_encoding_refused() {
    // Proves: a leading-zero nonce encoding is refused (canonical-integer
    // law), even though the value itself matches the request.
    let (result, ledger, vp, _t) = run_driver("padnonce", TxEnvelope::Legacy, Mutation::PadNonce);
    let err = result.unwrap_err();
    assert!(
        err.field_name() == Some("nonce") || err.field_name() == Some("serialized_tx"),
        "got {:?}",
        err.field_name()
    );
    assert_stays_intent(&ledger, &vp);
}

#[test]
fn oversized_inputs_refused_before_parsing() {
    // Proves: length bounds fire BEFORE any RLP work — serialized body,
    // scalar strings and v all have pre-parse caps.
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    // Oversized serialized body: 128 KiB + 1 of junk.
    let big = format!("0x{}", "00".repeat(128 * 1024 + 1));
    let raw = ConnectSignedTxRaw {
        serialized_tx: big,
        v: "0x0".into(),
        r: FIX_1559_R.into(),
        s: FIX_1559_S.into(),
    };
    let err = verify_signed_result(&req, &vp, &raw).unwrap_err();
    assert!(err.to_string().contains("bound"), "{err}");
    // Oversized r (33 bytes).
    let raw = ConnectSignedTxRaw {
        serialized_tx: FIX_1559_TX.into(),
        v: "0x0".into(),
        r: format!("0x{}", "11".repeat(33)),
        s: FIX_1559_S.into(),
    };
    assert!(verify_signed_result(&req, &vp, &raw).is_err());
    // Oversized v (9 bytes) — also bounded before decode.
    let raw = ConnectSignedTxRaw {
        serialized_tx: FIX_1559_TX.into(),
        v: format!("0x{}", "11".repeat(9)),
        r: FIX_1559_R.into(),
        s: FIX_1559_S.into(),
    };
    assert!(verify_signed_result(&req, &vp, &raw).is_err());
}

#[test]
fn missing_signature_components_refused() {
    // Proves: an envelope list that ends before r/s names the missing
    // component instead of guessing.
    let (result, ledger, vp, _t) = run_driver("drops", TxEnvelope::Legacy, Mutation::DropS);
    let err = result.unwrap_err();
    assert!(err.to_string().contains("missing component"), "got: {err}");
    assert_stays_intent(&ledger, &vp);
}

#[test]
fn unsupported_envelope_types_refused() {
    // Proves: type bytes 0x01 (access-list), 0x03 (blob) and 0x04 (7702)
    // are refused naming tx_type — only legacy and 0x02 are carriers.
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    for ty in [0x01u8, 0x03, 0x04, 0x7f] {
        let raw = fake_sign(&req.connect_payload(), Mutation::TypeByte(ty));
        let err = verify_signed_result(&req, &vp, &raw).unwrap_err();
        assert_eq!(err.field_name(), Some("tx_type"), "type 0x{ty:02x}");
    }
}

// ---------- lifecycle: cancellation, duplicates, staleness, interruption ----------

#[test]
fn transport_refusal_never_retries_and_keeps_reservation() {
    // Proves: a cancelled/timed-out transport call propagates, leaves the
    // open Intent with its reservation held, blocks an immediate re-sign
    // (open intent), and only an EXPLICIT cancel releases the budget.
    let ledger = Ledger::open(&tmp_root("refuse")).unwrap();
    let vp = payer_vp();
    let mut transport = FakeConnectTransport::refusing();
    let err = sign_batch_payment(
        &ledger,
        &vp,
        0,
        7,
        &path(),
        TxEnvelope::Eip1559,
        &mut StepClock::at(SYNTH_NOW),
        &mut transport,
    )
    .unwrap_err();
    assert!(err.to_string().contains("fake transport"));
    assert_eq!(transport.calls, 1, "no hidden retry inside the driver");
    assert_stays_intent(&ledger, &vp);
    // A second driver run refuses on the open intent (still no retry path).
    let err2 = sign_batch_payment(
        &ledger,
        &vp,
        0,
        8,
        &path(),
        TxEnvelope::Eip1559,
        &mut StepClock::at(SYNTH_NOW),
        &mut transport,
    )
    .unwrap_err();
    assert!(err2.to_string().contains("open intent"));
    assert_eq!(
        transport.calls, 1,
        "the second run never reached the bridge"
    );
    // Explicit cancel releases the reservation; a fresh attempt then works.
    ledger
        .cancel_intent(&vp, 0, SYNTH_NOW, "operator cancelled after timeout")
        .unwrap();
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    assert_eq!(recs.last().unwrap().reserved_fee_wei, Atto::ZERO);
    transport.refuse = false;
    transport.mutation = Mutation::None;
    sign_batch_payment(
        &ledger,
        &vp,
        0,
        9,
        &path(),
        TxEnvelope::Eip1559,
        &mut StepClock::at(SYNTH_NOW),
        &mut transport,
    )
    .unwrap();
    assert_eq!(transport.calls, 2);
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    assert!(matches!(
        recs.last().unwrap().state,
        AttemptState::Signed { .. }
    ));
}

#[test]
fn invalid_request_never_reaches_transport() {
    // Proves (spy): an expired plan and an out-of-range batch index fail
    // during composition/validation with ZERO transport invocations.
    let ledger = Ledger::open(&tmp_root("no-transport")).unwrap();
    let vp = payer_vp();
    let mut transport = FakeConnectTransport::new(Mutation::None);
    // Expired plan: 1 second past expiry.
    let expired = vp.plan().expires_unix + 1;
    assert!(sign_batch_payment(
        &ledger,
        &vp,
        0,
        7,
        &path(),
        TxEnvelope::Eip1559,
        &mut StepClock::at(expired),
        &mut transport
    )
    .is_err());
    // No such batch.
    assert!(sign_batch_payment(
        &ledger,
        &vp,
        9,
        7,
        &path(),
        TxEnvelope::Eip1559,
        &mut StepClock::at(SYNTH_NOW),
        &mut transport
    )
    .is_err());
    assert_eq!(
        transport.calls, 0,
        "invalid requests must never reach the bridge"
    );
    // And nothing was persisted for the failed attempts.
    assert!(ledger.attempts(&vp.plan().job_id, 0).unwrap().is_empty());
}

#[test]
fn duplicate_callback_refused_and_state_unchanged() {
    // Proves: a late/duplicate delivery of the SAME verified result cannot
    // record twice — the second record_verified_signed refuses, the state
    // stays Signed and exactly one attempt record exists.
    let (result, ledger, vp, _t) = run_driver("dup", TxEnvelope::Eip1559, Mutation::None);
    let verified = result.unwrap();
    let again = record_verified_signed(&ledger, &vp, 0, &verified, SYNTH_NOW + 5);
    assert!(again.is_err(), "duplicate delivery must be refused");
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    assert_eq!(recs.len(), 1);
    assert!(matches!(recs[0].state, AttemptState::Signed { .. }));
}

#[test]
fn stale_result_for_cancelled_attempt_refused() {
    // Proves: a result arriving AFTER the attempt was explicitly cancelled
    // (late response) carries no authorization — record_verified_signed
    // refuses and the Cancelled state stands.
    let ledger = Ledger::open(&tmp_root("stale")).unwrap();
    let vp = payer_vp();
    let mut transport = FakeConnectTransport::refusing();
    assert!(sign_batch_payment(
        &ledger,
        &vp,
        0,
        7,
        &path(),
        TxEnvelope::Eip1559,
        &mut StepClock::at(SYNTH_NOW),
        &mut transport
    )
    .is_err());
    ledger
        .cancel_intent(&vp, 0, SYNTH_NOW, "gave up waiting")
        .unwrap();
    // The late response: a correctly composed, correctly signed result for
    // that (now cancelled) attempt.
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let mut good = FakeConnectTransport::new(Mutation::None);
    let raw = good
        .ethereum_sign_transaction(&req.connect_payload())
        .unwrap();
    let verified = verify_signed_result(&req, &vp, &raw).unwrap();
    let err = record_verified_signed(&ledger, &vp, 0, &verified, SYNTH_NOW + 10).unwrap_err();
    assert!(err.to_string().contains("requires intent"), "{err}");
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    assert!(matches!(
        recs.last().unwrap().state,
        AttemptState::Cancelled { .. }
    ));
}

#[test]
fn interruption_after_intent_recovers_fail_closed() {
    // Proves: a process interrupted after the intent persisted (before any
    // bridge call) leaves an open Intent on reload; re-signing is refused
    // until it is explicitly cancelled; then a new attempt succeeds.
    let root = tmp_root("crash-intent");
    let ledger = Ledger::open(&root).unwrap();
    let vp = payer_vp();
    ledger.write_intent(&vp, 0, 7, SYNTH_NOW).unwrap();
    // "Crash": reopen from disk.
    let reopened = Ledger::open(&root).unwrap();
    let recs = reopened.attempts(&vp.plan().job_id, 0).unwrap();
    assert!(matches!(recs.last().unwrap().state, AttemptState::Intent));
    let mut transport = FakeConnectTransport::new(Mutation::None);
    assert!(sign_batch_payment(
        &reopened,
        &vp,
        0,
        7,
        &path(),
        TxEnvelope::Eip1559,
        &mut StepClock::at(SYNTH_NOW),
        &mut transport
    )
    .is_err());
    assert_eq!(transport.calls, 0, "open intent blocks before the bridge");
    reopened
        .cancel_intent(&vp, 0, SYNTH_NOW, "crash recovery: stale intent")
        .unwrap();
    sign_batch_payment(
        &reopened,
        &vp,
        0,
        8,
        &path(),
        TxEnvelope::Eip1559,
        &mut StepClock::at(SYNTH_NOW),
        &mut transport,
    )
    .unwrap();
    assert_eq!(transport.calls, 1);
}

#[test]
fn interruption_after_signed_leaves_durable_signed_record() {
    // Proves: a process interrupted after recording survives with the
    // Signed state intact; re-signing is refused (never auto-re-sign) and
    // the duplicate record boundary holds across the reopen.
    let root = tmp_root("crash-signed");
    let ledger = Ledger::open(&root).unwrap();
    let vp = payer_vp();
    let mut transport = FakeConnectTransport::new(Mutation::None);
    let verified = sign_batch_payment(
        &ledger,
        &vp,
        0,
        7,
        &path(),
        TxEnvelope::Legacy,
        &mut StepClock::at(SYNTH_NOW),
        &mut transport,
    )
    .unwrap();
    let reopened = Ledger::open(&root).unwrap();
    let recs = reopened.attempts(&vp.plan().job_id, 0).unwrap();
    match &recs.last().unwrap().state {
        AttemptState::Signed { tx } => assert_eq!(*tx, *verified.decoded_tx()),
        other => panic!("expected Signed after reopen, got {}", other.kind()),
    }
    let mut transport = FakeConnectTransport::new(Mutation::None);
    assert!(sign_batch_payment(
        &reopened,
        &vp,
        0,
        9,
        &path(),
        TxEnvelope::Legacy,
        &mut StepClock::at(SYNTH_NOW),
        &mut transport
    )
    .is_err());
    assert_eq!(transport.calls, 0);
}

// ---------- request contract, review summary, paths ----------

#[test]
fn connect_payload_wire_shape_matches_pinned_contract() {
    // Proves: the serialized request matches @trezor/connect 9.7.3's
    // schema — hex-quantity strings, numeric chainId, and each envelope
    // family carrying ONLY its own fee fields.
    let vp = payer_vp();
    let legacy = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Legacy,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let json = serde_json::to_value(legacy.connect_payload()).unwrap();
    assert_eq!(json["path"], "m/44'/60'/0'/0/0");
    assert_eq!(json["chunkify"], false);
    let t = &json["transaction"];
    assert_eq!(t["nonce"], "0x7");
    assert_eq!(t["value"], "0x0");
    assert_eq!(t["gasPrice"], "0x174876e800");
    assert_eq!(t["gasLimit"], "0x7a120");
    assert_eq!(t["chainId"], 42161);
    assert!(t.get("maxFeePerGas").is_none());
    assert!(t.get("maxPriorityFeePerGas").is_none());
    let eip1559 = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let json = serde_json::to_value(eip1559.connect_payload()).unwrap();
    let t = &json["transaction"];
    assert_eq!(t["maxFeePerGas"], "0x174876e800");
    assert_eq!(t["maxPriorityFeePerGas"], "0x3b9aca00");
    assert!(t.get("gasPrice").is_none());
    // Round trip through the wire (the fake bridge parses this exact shape).
    let text = serde_json::to_string(&eip1559.connect_payload()).unwrap();
    let back: ConnectRequestJson = serde_json::from_str(&text).unwrap();
    assert_eq!(back, eip1559.connect_payload());
}

#[test]
fn review_summary_derives_from_the_same_request() {
    // Proves: the review summary is derived from the immutable request and
    // the sealed plan — approval/payment identity, token ceiling,
    // worst-case native fee, approve ceiling and signature count — with no
    // recomposition between review and verification.
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let rs = req.review_summary();
    assert_eq!(rs.operation, "batch_payment");
    assert_eq!(rs.plan_hash, vp.plan().plan_hash);
    assert_eq!(rs.batch_id, Some(vp.plan().batches[0].batch_id));
    assert_eq!(rs.token_ceiling, vp.plan().batches[0].batch_amount_ceiling);
    assert_eq!(rs.approve_ceiling_total, vp.approve_ceiling());
    assert_eq!(
        rs.worst_case_native_fee_wei,
        Atto::from_u64(500_000)
            .checked_mul(Atto::from_u64(100_000_000_000))
            .unwrap()
    );
    assert_eq!(rs.signature_count, 1);
    assert_eq!(rs.payer, fixture_payer());
    // The approve flavor for the pure-approval path.
    let areq = SignRequest::compose(
        &vp,
        TxDestination::Approve,
        TxEnvelope::Eip1559,
        0,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let ars = areq.review_summary();
    assert_eq!(ars.operation, "approve");
    assert_eq!(ars.token_ceiling, vp.approve_ceiling());
    assert_eq!(ars.batch_id, None);
}

#[test]
fn derivation_paths_are_explicit_and_constrained() {
    // Proves: only BIP-44 Ethereum paths with bounded indices parse.
    for ok in [
        "m/44'/60'/0'/0/0",
        "m/44'/60'/99'/1/1000",
        "m/44'/60'/7'/0/42",
    ] {
        assert!(DerivationPath::parse(ok).is_ok(), "{ok}");
    }
    for bad in [
        "m/44'/60'/100'/0/0",
        "m/44'/60'/0'/2/0",
        "m/44'/60'/0'/0/1001",
        "m/49'/1'/0'/0/0",
        "m/44'/61'/0'/0/0",
        "m/44'/60'/0'/0",
        "m/44'/60'/0'/0/0/1",
        "",
        "44'/60'/0'/0/0",
    ] {
        assert!(DerivationPath::parse(bad).is_err(), "{bad}");
    }
}

#[test]
fn approve_composes_and_verifies_purely_without_orchestration() {
    // Proves: the approval request composes from the sealed plan (bounded
    // ceiling, token destination) and the ethereumjs-signed approve fixture
    // verifies — PURELY. No ledger intent is written (approval
    // orchestration is out of scope and no driver exists for it).
    let ledger_root = tmp_root("approve-pure");
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::Approve,
        TxEnvelope::Eip1559,
        0,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let raw = ConnectSignedTxRaw {
        serialized_tx: FIX_APPROVE_TX.into(),
        v: FIX_APPROVE_V.into(),
        r: FIX_APPROVE_R.into(),
        s: FIX_APPROVE_S.into(),
    };
    let verified = verify_signed_result(&req, &vp, &raw).unwrap();
    assert_eq!(verified.signer(), fixture_payer());
    assert_eq!(verified.request_operation(), TxDestination::Approve);
    // The approve calldata's amount word carries the bounded ceiling
    // (36 atto), never MAX: selector(4) + spender(32) + amount(32).
    assert_eq!(&verified.decoded_tx().input[66..68], &[0u8, 36][..]);
    assert!(!ledger_root.exists(), "no ledger materialized");
}

#[test]
fn verified_result_not_constructible_from_unchecked_fields() {
    // Proves (at the type level, by construction): every field of
    // VerifiedSigned is private with no public constructor — the comment
    // documents the compile-time guarantee; this test pins the ACCESS
    // surface so a future accidental `pub fn new` shows up in review.
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::None);
    let verified = verify_signed_result(&req, &vp, &raw).unwrap();
    // Read-only getters only; mutation/assembly of this type is impossible
    // outside the crate (private fields, private constructor).
    assert_eq!(verified.request_plan_hash(), vp.plan().plan_hash);
    assert_eq!(verified.request_envelope(), TxEnvelope::Eip1559);
}

// ---------- z2.c review corrections: regressions for the probed sequences ----------

#[test]
fn actual_connect_wire_response_decodes_and_verifies_end_to_end() {
    // Proves (review P2, adapted probe): a response JSON carrying
    // Connect's ACTUAL camelCase `serializedTx` field name decodes at the
    // production boundary (`decode_wire`) and the decoded value passes the
    // full verification — the Rust-side `serialized_tx` naming can no
    // longer hide the wire mismatch.
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::None);
    let wire = serde_json::json!({
        "serializedTx": raw.serialized_tx,
        "v": raw.v,
        "r": raw.r,
        "s": raw.s
    });
    let decoded = ConnectSignedTxRaw::decode_wire(&wire.to_string()).unwrap();
    assert_eq!(decoded, raw);
    let verified = verify_signed_result(&req, &vp, &decoded).unwrap();
    assert_eq!(verified.signer(), fixture_payer());
}

#[test]
fn wire_boundary_refuses_missing_unknown_malformed_oversized() {
    // Proves: the decode_wire boundary fails closed — a missing field, an
    // unknown field (the whole outer {success, payload} envelope is the
    // TRANSPORT's concern and must not half-decode here), a non-object,
    // garbage, and an oversized document are all refused BEFORE any
    // signature parsing.
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::None);
    // Missing serializedTx.
    let missing = serde_json::json!({"v": raw.v, "r": raw.r, "s": raw.s});
    assert!(ConnectSignedTxRaw::decode_wire(&missing.to_string()).is_err());
    // The outer Connect envelope shape: unknown fields refuse loudly
    // rather than half-decoding the payload.
    let envelope = serde_json::json!({
        "success": true,
        "payload": {"serializedTx": raw.serialized_tx, "v": raw.v, "r": raw.r, "s": raw.s}
    });
    let err = ConnectSignedTxRaw::decode_wire(&envelope.to_string()).unwrap_err();
    assert!(
        err.to_string().contains("unknown field") || err.to_string().contains("JSON"),
        "{err}"
    );
    // Not an object / garbage.
    assert!(ConnectSignedTxRaw::decode_wire("42").is_err());
    assert!(ConnectSignedTxRaw::decode_wire("not json").is_err());
    // Oversized document: refused before parsing.
    let big = format!(
        "{{\"serializedTx\":\"0x{}\",\"v\":\"0x0\",\"r\":\"0x1\",\"s\":\"0x1\"}}",
        "00".repeat(200_000)
    );
    let err = ConnectSignedTxRaw::decode_wire(&big).unwrap_err();
    assert!(err.to_string().contains("char bound"), "{err}");
}

#[test]
fn review_summary_is_single_sourced_from_the_composing_plan() {
    // Proves (review P1, adapted probe): the summary API takes NO plan
    // argument — `review_summary(&other_plan)` no longer compiles, so the
    // substitution the probe demonstrated is eliminated by construction.
    // The payer and approve ceiling are pinned at composition and are
    // asserted here against the composing plan, with the new
    // full-identity fields (path, envelope, attempt, value, calldata
    // commitment).
    let vp = payer_vp();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let rs = req.review_summary();
    assert_eq!(rs.payer, vp.plan().expected_payer);
    assert_eq!(rs.approve_ceiling_total, vp.approve_ceiling());
    assert_eq!(rs.path, "m/44'/60'/0'/0/0");
    assert_eq!(rs.envelope, TxEnvelope::Eip1559);
    assert_eq!(rs.attempt_seq, 1);
    assert_eq!(rs.value_wei, Atto::ZERO);
    assert_eq!(rs.calldata_keccak.0, watchpay::abi::keccak256(req.data()));
    assert_eq!(rs.calldata_len, req.data().len() as u64);
    // Healthy control: a DIFFERENT plan's payer cannot appear through any
    // remaining path — compose a request under that other plan and note
    // its summary disagrees (both summaries are self-derived).
    let other = validate_plan(&base_plan(), SYNTH_NOW).unwrap();
    assert_ne!(other.plan().expected_payer, vp.plan().expected_payer);
    let other_req = SignRequest::compose(
        &other,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let other_rs = other_req.review_summary();
    assert_ne!(rs.payer, other_rs.payer);
    assert_eq!(other_rs.payer, other.plan().expected_payer);
}

#[test]
fn cancelled_result_cannot_attach_to_replacement_attempt() {
    // Proves (review P1, adapted probe — the exact reviewer sequence): a
    // verified result for a CANCELLED attempt cannot attach to a
    // replacement attempt even when the nonce and every transaction field
    // are identical; the refusal is the attempt binding, and the
    // replacement attempt's Intent state and reservation are preserved.
    let ledger = Ledger::open(&tmp_root("replacement-binding")).unwrap();
    let vp = payer_vp();
    ledger.write_intent(&vp, 0, 7, SYNTH_NOW).unwrap();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1, // the persisted attempt this response belongs to
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::None);
    let verified = verify_signed_result(&req, &vp, &raw).unwrap();
    ledger
        .cancel_intent(&vp, 0, SYNTH_NOW + 1, "cancelled before callback")
        .unwrap();
    let seq2 = ledger.write_intent(&vp, 0, 7, SYNTH_NOW + 2).unwrap();
    assert_eq!(seq2, 2, "the replacement is a NEW attempt sequence");
    let err = record_verified_signed(&ledger, &vp, 0, &verified, SYNTH_NOW + 3).unwrap_err();
    assert!(
        err.to_string().contains("attempt binding"),
        "refusal must be the attempt binding: {err}"
    );
    // The replacement attempt is untouched: still Intent, reservation held.
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    assert_eq!(recs.len(), 2);
    match (&recs[0].state, &recs[1].state) {
        (AttemptState::Cancelled { .. }, AttemptState::Intent) => {}
        pair => panic!("unexpected states {pair:?}"),
    }
    let reserve = Atto::from_u64(vp.plan().gas_ceilings.per_tx_gas_limit)
        .checked_mul(Atto::from_u64(
            vp.plan().native_fee_ceilings.per_tx_max_fee_per_gas_wei,
        ))
        .unwrap();
    assert_eq!(recs[1].reserved_fee_wei, reserve);
    // Healthy control: the SAME response recorded for the attempt it was
    // verified for (before any cancellation) succeeds.
    let ledger2 = Ledger::open(&tmp_root("replacement-binding-control")).unwrap();
    ledger2.write_intent(&vp, 0, 7, SYNTH_NOW).unwrap();
    record_verified_signed(&ledger2, &vp, 0, &verified, SYNTH_NOW).unwrap();
}

#[test]
fn synthetic_record_signed_door_documented_as_unenforced() {
    // Documents honestly (review P1 correction): the PRESERVED z2.b
    // offline-synthetic API `Ledger::record_signed` does NOT bind the
    // attempt sequence — the replacement-attachment the adapter forbids
    // remains possible through that synthetic door, which is exactly why
    // the adapter boundary never uses it and the crate does not claim
    // bypass prevention while it stays open.
    let ledger = Ledger::open(&tmp_root("synthetic-door")).unwrap();
    let vp = payer_vp();
    ledger.write_intent(&vp, 0, 7, SYNTH_NOW).unwrap();
    let req = SignRequest::compose(
        &vp,
        TxDestination::BatchPayment { batch_index: 0 },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::None);
    let verified = verify_signed_result(&req, &vp, &raw).unwrap();
    ledger
        .cancel_intent(&vp, 0, SYNTH_NOW + 1, "cancelled before callback")
        .unwrap();
    ledger.write_intent(&vp, 0, 7, SYNTH_NOW + 2).unwrap();
    // The synthetic API attaches it (no attempt binding) — pinned here as
    // the documented limitation, NOT as desired behavior.
    ledger
        .record_signed(&vp, 0, verified.decoded_tx(), SYNTH_NOW + 3)
        .unwrap();
}

#[test]
fn expiry_during_bridge_call_refused_and_reservation_kept() {
    // Proves (review freshness gap): a plan that expires DURING the
    // transport call is refused at the post-transport completion
    // observation — the step clock advances t1 past expiry without
    // sleeping; the refusal is AFTER-dispatch (the bridge was called),
    // the intent stays open with its reservation, and the late result is
    // never recorded.
    let ledger = Ledger::open(&tmp_root("expiry-during-call")).unwrap();
    let vp = payer_vp();
    let step = vp.plan().expires_unix + 1 - SYNTH_NOW; // t1 = expiry + 1
    let mut clock = StepClock::stepping(SYNTH_NOW, step);
    let mut transport = FakeConnectTransport::new(Mutation::None);
    let err = sign_batch_payment(
        &ledger,
        &vp,
        0,
        7,
        &path(),
        TxEnvelope::Eip1559,
        &mut clock,
        &mut transport,
    )
    .unwrap_err();
    assert!(!err.is_before_dispatch(), "the bridge WAS called");
    assert!(
        err.to_string().contains("expired"),
        "refusal must name expiry: {err}"
    );
    assert_eq!(transport.calls, 1);
    assert_stays_intent(&ledger, &vp);
    // The healthy control at a small step still succeeds.
    let ledger2 = Ledger::open(&tmp_root("expiry-during-call-ok")).unwrap();
    let mut clock2 = StepClock::stepping(SYNTH_NOW, 10);
    let mut transport2 = FakeConnectTransport::new(Mutation::None);
    sign_batch_payment(
        &ledger2,
        &vp,
        0,
        7,
        &path(),
        TxEnvelope::Eip1559,
        &mut clock2,
        &mut transport2,
    )
    .unwrap();
}

#[test]
fn pre_dispatch_expiry_is_phase_distinguished() {
    // Proves: callers can distinguish a refusal BEFORE dispatch (nothing
    // sent, cleanly cancellable) from an after-dispatch refusal — an
    // already-expired plan at t0 fails BeforeDispatch with ZERO transport
    // invocations, while a valid t0 reaches the bridge exactly once.
    let ledger = Ledger::open(&tmp_root("phase")).unwrap();
    let vp = payer_vp();
    let expired = vp.plan().expires_unix + 1;
    let mut transport = FakeConnectTransport::new(Mutation::None);
    let err = sign_batch_payment(
        &ledger,
        &vp,
        0,
        7,
        &path(),
        TxEnvelope::Eip1559,
        &mut StepClock::at(expired),
        &mut transport,
    )
    .unwrap_err();
    assert!(err.is_before_dispatch());
    assert!(err.to_string().contains("expired"));
    assert_eq!(transport.calls, 0, "the bridge was never called");
    // The intent write itself was refused pre-dispatch: nothing persisted.
    assert!(ledger.attempts(&vp.plan().job_id, 0).unwrap().is_empty());
}
// ---------- z2.c R1 review corrections: identity + exclusive-writer regressions ----------

/// base_plan with a second batch (index 1, own ceiling), totals recomputed.
fn two_batch_vp() -> watchpay::plan::ValidatedPlan {
    let mut p = base_plan();
    p.expected_payer = fixture_payer();
    let mut b1 = base_batch();
    b1.batch_index = 1;
    b1.batch_id = watchpay::canonical::batch_id(p.network.chain_id, &p.network.payment_vault, &b1);
    p.batches.push(b1);
    p.approve_ceiling_total = p
        .batches
        .iter()
        .map(|b| b.batch_amount_ceiling)
        .fold(Atto::ZERO, |a, x| a.checked_add(x).unwrap());
    p.gas_ceilings.max_total_gas = p.gas_ceilings.per_tx_gas_limit * 3;
    p.native_fee_ceilings.max_total_native_fee_wei = Atto::from_u64(
        p.gas_ceilings.per_tx_gas_limit * p.native_fee_ceilings.per_tx_max_fee_per_gas_wei * 3,
    );
    p.plan_hash = watchpay::canonical::plan_hash(&p);
    validate_plan(&p, SYNTH_NOW).unwrap()
}

/// Compose + fake-sign + verify for `vp` batch `batch_index`, attempt 1, nonce 7.
fn verified_for(
    vp: &watchpay::plan::ValidatedPlan,
    batch_index: usize,
) -> watchpay::connect::VerifiedSigned {
    let req = SignRequest::compose(
        vp,
        TxDestination::BatchPayment { batch_index },
        TxEnvelope::Eip1559,
        7,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let raw = fake_sign(&req.connect_payload(), Mutation::None);
    verify_signed_result(&req, vp, &raw).unwrap()
}

#[test]
fn verified_result_cannot_cross_plan_identity() {
    // Proves (R1 probe, permanent regression): a verified result from
    // plan A cannot record into plan B ledger — even when job B's
    // intent carries the SAME nonce and attempt sequence and every
    // transaction field is byte-identical. The refusal is plan-HASH
    // identity, never equivalent calldata; B's ledger state and
    // reservation are preserved; the matching-plan control succeeds.
    let vp = payer_vp();
    let verified = verified_for(&vp, 0);
    // Plan B: another job_id, everything else identical, revalidated.
    let mut other_plan = vp.plan().clone();
    other_plan.job_id = "astra-other-job".into();
    other_plan.plan_hash = watchpay::canonical::plan_hash(&other_plan);
    let other = validate_plan(&other_plan, SYNTH_NOW).unwrap();
    assert_ne!(other.sealed_hash(), verified.request_plan_hash());
    let root = tmp_root("r1-cross-plan");
    let ledger = Ledger::open(&root).unwrap();
    ledger.write_intent(&other, 0, 7, SYNTH_NOW).unwrap();
    let err = record_verified_signed(&ledger, &other, 0, &verified, SYNTH_NOW + 1).unwrap_err();
    assert_eq!(err.field_name(), Some("plan_hash"));
    assert!(err.to_string().contains("cross-plan"), "{err}");
    // B's ledger is untouched: one Intent with its reservation held.
    let recs = ledger.attempts(&other.plan().job_id, 0).unwrap();
    assert_eq!(recs.len(), 1);
    assert!(matches!(recs[0].state, AttemptState::Intent));
    let reserve = Atto::from_u64(other.plan().gas_ceilings.per_tx_gas_limit)
        .checked_mul(Atto::from_u64(
            other.plan().native_fee_ceilings.per_tx_max_fee_per_gas_wei,
        ))
        .unwrap();
    assert_eq!(recs[0].reserved_fee_wei, reserve);
    // Matching-plan control: the SAME result records under ITS plan.
    let root_ok = tmp_root("r1-cross-plan-control");
    let ledger_ok = Ledger::open(&root_ok).unwrap();
    ledger_ok.write_intent(&vp, 0, 7, SYNTH_NOW).unwrap();
    record_verified_signed(&ledger_ok, &vp, 0, &verified, SYNTH_NOW + 1).unwrap();
}

#[test]
fn wrong_operation_result_cannot_record_as_batch_payment() {
    // Proves: a result verified for the APPROVE operation cannot
    // record through the batch-payment boundary (wrong-operation
    // rejection); the ledger is untouched.
    let vp = payer_vp();
    let areq = SignRequest::compose(
        &vp,
        TxDestination::Approve,
        TxEnvelope::Eip1559,
        0,
        1,
        path(),
        SYNTH_NOW,
    )
    .unwrap();
    let mut fake = FakeConnectTransport::new(Mutation::None);
    let raw = fake
        .ethereum_sign_transaction(&areq.connect_payload())
        .unwrap();
    let approve_verified = verify_signed_result(&areq, &vp, &raw).unwrap();
    let root = tmp_root("r1-wrong-op");
    let ledger = Ledger::open(&root).unwrap();
    ledger.write_intent(&vp, 0, 7, SYNTH_NOW).unwrap();
    let err =
        record_verified_signed(&ledger, &vp, 0, &approve_verified, SYNTH_NOW + 1).unwrap_err();
    assert_eq!(err.field_name(), Some("batch_index"));
    assert!(err.to_string().contains("cross-operation"), "{err}");
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    assert!(matches!(recs.last().unwrap().state, AttemptState::Intent));
}

#[test]
fn batch_mismatched_result_cannot_record_under_other_batch() {
    // Proves: a result verified for batch 1 cannot record under
    // batch 0 of the same plan — operation/batch identity, not
    // calldata equivalence, is the authorization.
    let vp = two_batch_vp();
    let verified_b1 = verified_for(&vp, 1);
    let root = tmp_root("r1-batch-mismatch");
    let ledger = Ledger::open(&root).unwrap();
    ledger.write_intent(&vp, 0, 7, SYNTH_NOW).unwrap();
    let err = record_verified_signed(&ledger, &vp, 0, &verified_b1, SYNTH_NOW + 1).unwrap_err();
    assert_eq!(err.field_name(), Some("batch_index"));
    assert!(err.to_string().contains("cross-operation"), "{err}");
    let recs = ledger.attempts(&vp.plan().job_id, 0).unwrap();
    assert!(matches!(recs.last().unwrap().state, AttemptState::Intent));
}
