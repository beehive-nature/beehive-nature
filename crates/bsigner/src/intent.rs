//! The Bitcoin rail of an intent authorization (SPEC-BPQ-1 §5c;
//! SPEC-BTUNGSTEN-PQ-1 PQ12 steps 1 and 4).
//!
//! The owner's bzpq1 key signs a WB001 intent envelope (`bpq::attest_intent`).
//! For a Taproot key-path spend the envelope reads:
//!
//! | WB001 field | value                                                       |
//! |-------------|-------------------------------------------------------------|
//! | domain      | `bitcoin:mainnet` or `bitcoin:testnet`                      |
//! | nonce       | 32 bytes the authorizing wallet chose                       |
//! | epoch       | when it was authorized (Unix seconds)                       |
//! | action      | SHA-256 of [`ACTION_LABEL`]                                 |
//! | destination | the address paid                                            |
//! | capability  | [`CAPABILITY`]: the backend allowed to act on it            |
//! | amount      | the satoshis paid to `destination`, in total                |
//! | expiry      | after this (Unix seconds) it authorizes nothing             |
//! | payer       | the address every input spends; change may return only here |
//! | payload     | the descriptor: "bTc1", hash type, fee, txid, and BIP-341's |
//! |             | hash of the spent amounts and of the spent scriptPubKeys    |
//!
//! [`verify_spend`] is the only way to a [`VerifiedIntent`], and the threshold
//! signer will take nothing else: the authorization must verify under the
//! pinned authority id, the PSBT is read here, every sighash is computed
//! here, and the PSBT must equal the authorization field for field: the
//! txid (so every outpoint, sequence and output), the spent amounts and
//! scriptPubKeys, the fee, the hash type, and the readable fields
//! (destination, amount, payer) against the outputs they describe.

use crate::psbt::{self, SigningView};
use crate::{bpq, taproot};
use btungsten_wb001::Text;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

/// The action a Taproot key-path spend authorization names (its SHA-256 is
/// the WB001 action field).
pub const ACTION_LABEL: &str = "bpq1/intent/bitcoin/taproot-key-spend/1";
/// The backend that may act on it.
pub const CAPABILITY: &str = "bsigner/taproot-key-path";
const TAG: &[u8; 4] = b"bTc1";
const DESCRIPTOR_LEN: usize = 4 + 1 + 8 + 32 * 3;

#[derive(Debug, PartialEq, Eq)]
pub struct IntentError(pub String);

impl std::fmt::Display for IntentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "refused: {}", self.0)
    }
}

fn refuse<T>(why: impl Into<String>) -> Result<T, IntentError> {
    Err(IntentError(why.into()))
}

fn action() -> [u8; 32] {
    Sha256::digest(ACTION_LABEL.as_bytes()).into()
}

fn hrp_of(network: &str) -> Result<&'static str, IntentError> {
    match network {
        "mainnet" => Ok("bc"),
        "testnet" => Ok("tb"),
        other => refuse(format!("network {other:?} is not mainnet or testnet")),
    }
}

/// The spend a PSBT makes, as the envelope states it.
struct Spend {
    view: SigningView,
    hash_type: u8,
    payer: String,
    amount: u64,
    descriptor: Vec<u8>,
}

/// Read a PSBT as a Taproot key-path spend of one key paying `destination`:
/// every input spends the same Taproot output (the payer), every input has
/// the same hash type, every output pays `destination` or returns to the
/// payer, and `destination` is paid something.
fn spend_of(psbt_bytes: &[u8], hrp: &str, destination: &str) -> Result<Spend, IntentError> {
    let view = psbt::signing_view(psbt::parse(psbt_bytes).map_err(|e| IntentError(e.to_string()))?)
        .map_err(|e| IntentError(e.to_string()))?;
    let spk = &view.prevouts[0].script_pubkey;
    if spk.len() != 34 || spk[0] != 0x51 || spk[1] != 0x20 {
        return refuse("the inputs do not spend a Taproot output");
    }
    if view.prevouts.iter().any(|p| &p.script_pubkey != spk) {
        return refuse("the inputs spend more than one key");
    }
    let payer = taproot::address_of(hrp, spk).expect("a Taproot output has an address");
    let hash_type = view.hash_types[0];
    if view.hash_types.iter().any(|&t| t != hash_type) {
        return refuse("the inputs ask for different hash types");
    }
    let mut amount: u64 = 0;
    for (n, o) in view.tx.outputs.iter().enumerate() {
        match taproot::address_of(hrp, &o.script_pubkey) {
            Some(a) if a == destination => amount += o.amount,
            Some(a) if a == payer => {}
            _ => {
                return refuse(format!(
                    "output {n} pays neither the destination nor the payer"
                ))
            }
        }
    }
    if amount == 0 {
        return refuse("the destination is paid nothing");
    }
    let pre =
        taproot::precompute(&view.tx, &view.prevouts).map_err(|e| IntentError(e.to_string()))?;
    let mut descriptor = Vec::with_capacity(DESCRIPTOR_LEN);
    descriptor.extend_from_slice(TAG);
    descriptor.push(hash_type);
    descriptor.extend_from_slice(&view.fee.to_le_bytes());
    descriptor.extend_from_slice(&taproot::txid(&view.tx));
    descriptor.extend_from_slice(&pre.sha_amounts);
    descriptor.extend_from_slice(&pre.sha_script_pubkeys);
    Ok(Spend {
        view,
        hash_type,
        payer,
        amount,
        descriptor,
    })
}

/// The WB001 envelope authorizing `psbt_bytes` as a payment to
/// `destination`. The caller supplies the nonce and the times.
pub fn envelope_for(
    psbt_bytes: &[u8],
    network: &str,
    destination: &str,
    nonce: [u8; 32],
    epoch: u64,
    expiry: u64,
) -> Result<Vec<u8>, IntentError> {
    let hrp = hrp_of(network)?;
    let s = spend_of(psbt_bytes, hrp, destination)?;
    if expiry < epoch {
        return refuse("it would expire before it was made");
    }
    let i = btungsten_wb001::IntentIn {
        domain: Text::Str(format!("bitcoin:{network}")),
        nonce: nonce.to_vec(),
        epoch,
        action: action().to_vec(),
        destination: Text::Str(destination.to_string()),
        capability: Text::Str(CAPABILITY.to_string()),
        amount: s.amount,
        expiry,
        payer: Text::Str(s.payer),
        payload: s.descriptor,
    }
    .build()
    .map_err(|r| IntentError(format!("WB001 {}", r.code())))?;
    btungsten_wb001::canonical(&i).map_err(|r| IntentError(format!("WB001 {}", r.code())))
}

/// What the threshold signer may sign: built only by [`verify_spend`].
pub struct VerifiedIntent {
    sighashes: Vec<[u8; 32]>,
    output_key: [u8; 32],
    hash_type: u8,
    destination: String,
    amount: u64,
    fee: u64,
}

impl VerifiedIntent {
    /// What was verified and what may be signed: one BIP-341 sighash per
    /// input, in input order, under the output key every input spends.
    pub fn summary(&self) -> Value {
        json!({
            "destination": self.destination,
            "amountSats": self.amount,
            "feeSats": self.fee,
            "hashType": self.hash_type,
            "outputKey": taproot::hex(&self.output_key),
            "sighashes": self.sighashes.iter().map(|h| taproot::hex(h)).collect::<Vec<_>>(),
        })
    }
}

fn text(len: u32, bytes: &[u8]) -> String {
    String::from_utf8_lossy(&bytes[..len as usize]).into_owned()
}

/// The gate. Refused unless `authorization` is an intent statement that
/// verifies, by `authority`, over an envelope naming this rail, this
/// backend and a time no later than its expiry, and `psbt_bytes` is the
/// spend it describes, field for field.
pub fn verify_spend(
    authorization: &Value,
    authority: &str,
    psbt_bytes: &[u8],
    now: u64,
) -> Result<VerifiedIntent, IntentError> {
    let Some((id, env)) = bpq::verify_intent(authorization) else {
        return refuse("the authorization does not verify");
    };
    if id != authority {
        return refuse(format!(
            "the authorization is by {id}, not the pinned authority"
        ));
    }
    let i =
        btungsten_wb001::decode(&env).map_err(|r| IntentError(format!("WB001 {}", r.code())))?;
    let network = match text(i.domain_len, &i.domain).as_str() {
        "bitcoin:mainnet" => "mainnet",
        "bitcoin:testnet" => "testnet",
        other => return refuse(format!("the authorization is for {other:?}, not Bitcoin")),
    };
    if i.action != action() {
        return refuse("the authorization names another action");
    }
    if text(i.capability_len, &i.capability) != CAPABILITY {
        return refuse("the authorization is for another backend");
    }
    if now > i.expiry {
        return refuse("the authorization has expired");
    }
    let destination = text(i.destination_len, &i.destination);
    let s = spend_of(psbt_bytes, hrp_of(network)?, &destination)?;
    let payload = &i.payload[..i.payload_len as usize];
    if payload.len() != DESCRIPTOR_LEN || &payload[..4] != TAG {
        return refuse("the payload is not a Bitcoin spend descriptor");
    }
    // the descriptor rebuilt from the PSBT must be the authorized one, and
    // the readable fields must describe the same outputs
    if payload[4] != s.hash_type {
        return refuse("the PSBT asks for another hash type");
    }
    if payload[5..13] != s.descriptor[5..13] {
        return refuse("the PSBT pays another fee");
    }
    if payload[13..45] != s.descriptor[13..45] {
        return refuse("the PSBT's transaction is not the authorized one");
    }
    if payload[45..] != s.descriptor[45..] {
        return refuse("the PSBT spends other outputs than the authorized ones");
    }
    if text(i.payer_len, &i.payer) != s.payer {
        return refuse("the inputs do not spend the authorized payer");
    }
    if i.amount != s.amount {
        return refuse("the destination is paid another amount");
    }
    let pre = taproot::precompute(&s.view.tx, &s.view.prevouts)
        .map_err(|e| IntentError(e.to_string()))?;
    let mut sighashes = Vec::with_capacity(s.view.tx.inputs.len());
    for n in 0..s.view.tx.inputs.len() {
        let m = taproot::sig_msg(&s.view.tx, &s.view.prevouts, &pre, n, s.hash_type)
            .map_err(|e| IntentError(e.to_string()))?;
        sighashes.push(taproot::sighash_of(&m));
    }
    Ok(VerifiedIntent {
        sighashes,
        output_key: s.view.prevouts[0].script_pubkey[2..].try_into().unwrap(),
        hash_type: s.hash_type,
        destination,
        amount: s.amount,
        fee: s.view.fee,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const PRK: [u8; 32] = [7u8; 32];
    const CTX: &str = "pq:wallet";
    const NOW: u64 = 1_800_000_000;

    fn kv(key_type: u8, value: &[u8]) -> Vec<u8> {
        let mut v = vec![1, key_type, value.len() as u8];
        v.extend_from_slice(value);
        v
    }

    fn out(amount: u64, spk: &[u8]) -> Vec<u8> {
        let mut o = amount.to_le_bytes().to_vec();
        o.push(spk.len() as u8);
        o.extend_from_slice(spk);
        o
    }

    /// The payer's key, a payee's key, and a PSBT spending `inputs` x 5000
    /// sats of the payer's output to `outputs`, every input with hash type
    /// `hash_type` written out unless it is None.
    fn psbt(inputs: u8, outputs: &[(u64, Vec<u8>)], hash_type: Option<u32>, spent: u64) -> Vec<u8> {
        let mut tx = vec![2, 0, 0, 0, inputs];
        for n in 0..inputs {
            tx.extend_from_slice(&[0x11; 32]);
            tx.extend_from_slice(&u32::from(n).to_le_bytes());
            tx.extend_from_slice(&[0, 0xfd, 0xff, 0xff, 0xff]);
        }
        tx.push(outputs.len() as u8);
        for (a, s) in outputs {
            tx.extend(out(*a, s));
        }
        tx.extend_from_slice(&[0; 4]);
        let mut p = b"psbt\xff".to_vec();
        p.extend([vec![1, 0], vec![tx.len() as u8]].concat());
        p.extend(&tx);
        p.push(0);
        for _ in 0..inputs {
            p.extend(kv(0x01, &out(spent, &payer_spk())));
            if let Some(t) = hash_type {
                p.extend(kv(0x03, &t.to_le_bytes()));
            }
            p.push(0);
        }
        for _ in outputs {
            p.push(0);
        }
        p
    }

    fn payer_spk() -> Vec<u8> {
        taproot::script_pubkey(&taproot::output_key(&G_X, None).unwrap().key)
    }
    fn payee_spk() -> Vec<u8> {
        taproot::script_pubkey(&taproot::output_key(&G2_X, None).unwrap().key)
    }
    // the x coordinates of G and 2G: two keys on the curve, no secret anywhere
    const G_X: [u8; 32] = [
        0x79, 0xbe, 0x66, 0x7e, 0xf9, 0xdc, 0xbb, 0xac, 0x55, 0xa0, 0x62, 0x95, 0xce, 0x87, 0x0b,
        0x07, 0x02, 0x9b, 0xfc, 0xdb, 0x2d, 0xce, 0x28, 0xd9, 0x59, 0xf2, 0x81, 0x5b, 0x16, 0xf8,
        0x17, 0x98,
    ];
    const G2_X: [u8; 32] = [
        0xc6, 0x04, 0x7f, 0x94, 0x41, 0xed, 0x7d, 0x6d, 0x30, 0x45, 0x40, 0x6e, 0x95, 0xc0, 0x7c,
        0xd8, 0x5c, 0x77, 0x8e, 0x4b, 0x8c, 0xef, 0x3c, 0xa7, 0xab, 0xac, 0x09, 0xb9, 0x5c, 0x70,
        0x9e, 0xe5,
    ];

    fn dest() -> String {
        taproot::address_of("bc", &payee_spk()).unwrap()
    }

    fn honest() -> Vec<u8> {
        psbt(2, &[(8000, payee_spk()), (1500, payer_spk())], None, 5000)
    }

    fn authorize(env: &[u8]) -> Value {
        bpq::attest_intent(&PRK, CTX, env).unwrap()
    }

    fn authority() -> String {
        authorize(&envelope_for(&honest(), "mainnet", &dest(), [1; 32], NOW, NOW + 600).unwrap())
            ["id"]
            .as_str()
            .unwrap()
            .to_string()
    }

    /// The honest envelope with one WB001 field replaced, re-encoded.
    fn envelope_with(edit: impl FnOnce(&mut btungsten_wb001::IntentIn)) -> Vec<u8> {
        let env = envelope_for(&honest(), "mainnet", &dest(), [1; 32], NOW, NOW + 600).unwrap();
        let i = btungsten_wb001::decode(&env).unwrap();
        let mut x = btungsten_wb001::IntentIn {
            domain: Text::Str(text(i.domain_len, &i.domain)),
            nonce: i.nonce.to_vec(),
            epoch: i.epoch,
            action: i.action.to_vec(),
            destination: Text::Str(text(i.destination_len, &i.destination)),
            capability: Text::Str(text(i.capability_len, &i.capability)),
            amount: i.amount,
            expiry: i.expiry,
            payer: Text::Str(text(i.payer_len, &i.payer)),
            payload: i.payload[..i.payload_len as usize].to_vec(),
        };
        edit(&mut x);
        btungsten_wb001::canonical(&x.build().unwrap()).unwrap()
    }

    #[test]
    fn the_signer_signs_only_the_spend_it_was_authorized() {
        let who = authority();
        let env = envelope_for(&honest(), "mainnet", &dest(), [1; 32], NOW, NOW + 600).unwrap();
        let auth = authorize(&env);
        let ok = verify_spend(&auth, &who, &honest(), NOW).expect("the control");
        assert_eq!(ok.sighashes.len(), 2);
        assert_eq!(ok.summary()["amountSats"], 8000);
        assert_eq!(ok.summary()["feeSats"], 500);
        // the sighashes are BIP-341's for this transaction
        let view = psbt::signing_view(psbt::parse(&honest()).unwrap()).unwrap();
        let pre = taproot::precompute(&view.tx, &view.prevouts).unwrap();
        for (n, h) in ok.sighashes.iter().enumerate() {
            let m = taproot::sig_msg(&view.tx, &view.prevouts, &pre, n, 0).unwrap();
            assert_eq!(h, &taproot::sighash_of(&m));
        }

        // 1. the authorization itself: any byte of the envelope changed
        // without re-signing, another authority, another kind or version
        let (mut bytes, mut fields, mut psbts) = (0, 0, 0);
        for k in 0..env.len() {
            let mut bent = env.clone();
            bent[k] ^= 0x01;
            let mut a = auth.clone();
            a["envelope"] = Value::from(crate::b64::b64u(&bent));
            assert!(
                verify_spend(&a, &who, &honest(), NOW).is_err(),
                "envelope byte {k}"
            );
            bytes += 1;
        }
        let other = bpq::attest_intent(&PRK, "pq:other", &env).unwrap();
        assert!(
            verify_spend(&other, &who, &honest(), NOW).is_err(),
            "another authority"
        );
        for (field, v) in [("kind", Value::from("detached")), ("bpq", Value::from(2))] {
            let mut a = auth.clone();
            a[field] = v;
            assert!(verify_spend(&a, &who, &honest(), NOW).is_err(), "{field}");
        }

        // 2. signed by the authority, but saying something the PSBT does not
        let mut flip = |name: &str, env: Vec<u8>| {
            let r = verify_spend(&authorize(&env), &who, &honest(), NOW);
            assert!(r.is_err(), "{name} was accepted");
            fields += 1;
        };
        flip(
            "domain",
            envelope_with(|x| x.domain = Text::Str("bitcoin:testnet".into())),
        );
        flip(
            "domain (another chain)",
            envelope_with(|x| x.domain = Text::Str("vaulta:mainnet".into())),
        );
        flip("action", envelope_with(|x| x.action[0] ^= 1));
        flip(
            "destination",
            envelope_with(|x| {
                x.destination = Text::Str(taproot::address_of("bc", &payer_spk()).unwrap())
            }),
        );
        flip(
            "capability",
            envelope_with(|x| x.capability = Text::Str("bsigner/other".into())),
        );
        flip("amount", envelope_with(|x| x.amount += 1));
        flip("expiry (passed)", envelope_with(|x| x.expiry = NOW - 1));
        flip("payer", envelope_with(|x| x.payer = Text::Str(dest())));
        for (name, at) in [
            ("hash type", 4),
            ("fee", 5),
            ("txid", 13),
            ("spent amounts", 45),
            ("spent scripts", 77),
        ] {
            flip(name, envelope_with(|x| x.payload[at] ^= 1));
        }
        flip(
            "payload length",
            envelope_with(|x| {
                x.payload.pop();
            }),
        );
        flip("payload tag", envelope_with(|x| x.payload[0] = b'X'));

        // 3. the authorization honest, the PSBT changed
        let wrong_psbts: Vec<(&str, Vec<u8>)> = vec![
            (
                "an output amount",
                psbt(2, &[(8001, payee_spk()), (1499, payer_spk())], None, 5000),
            ),
            (
                "a spent amount",
                psbt(2, &[(8000, payee_spk()), (1500, payer_spk())], None, 5001),
            ),
            (
                "a hash type written out",
                psbt(
                    2,
                    &[(8000, payee_spk()), (1500, payer_spk())],
                    Some(0x01),
                    5000,
                ),
            ),
            (
                "one input fewer",
                psbt(1, &[(3500, payee_spk()), (1000, payer_spk())], None, 5000),
            ),
            ("no outputs", psbt(2, &[], None, 5000)),
            (
                "change to a third key",
                psbt(
                    2,
                    &[
                        (8000, payee_spk()),
                        (1500, taproot::script_pubkey(&[0x11; 32])),
                    ],
                    None,
                    5000,
                ),
            ),
        ];
        for (name, p) in wrong_psbts {
            assert!(
                verify_spend(&auth, &who, &p, NOW).is_err(),
                "{name} was accepted"
            );
            psbts += 1;
        }
        // 4. too late
        assert!(
            verify_spend(&auth, &who, &honest(), NOW + 601).is_err(),
            "after expiry"
        );
        println!("PQ12-INTENT bsigner: the honest spend verifies with BIP-341's sighashes; refused: {bytes} of {bytes} envelope bytes changed without re-signing, {fields} signed fields the PSBT contradicts, {psbts} PSBT changes, another authority, kind, version, and a clock past expiry");
    }

    #[test]
    fn envelopes_are_refused_for_spends_the_rail_does_not_make() {
        let d = dest();
        let cases: Vec<(&str, Vec<u8>, &str)> = vec![
            (
                "the destination paid nothing",
                psbt(1, &[(4000, payer_spk())], None, 5000),
                d.as_str(),
            ),
            (
                "an output to a third key",
                psbt(
                    1,
                    &[(4000, taproot::script_pubkey(&[0x11; 32]))],
                    None,
                    5000,
                ),
                d.as_str(),
            ),
            (
                "a hash type outside BIP-341",
                psbt(1, &[(4000, payee_spk())], Some(0x04), 5000),
                d.as_str(),
            ),
        ];
        for (why, p, dest) in cases {
            assert!(
                envelope_for(&p, "mainnet", dest, [1; 32], NOW, NOW + 1).is_err(),
                "{why}"
            );
        }
        assert!(
            envelope_for(&honest(), "regtest", &d, [1; 32], NOW, NOW + 1).is_err(),
            "network"
        );
        assert!(
            envelope_for(&honest(), "mainnet", &d, [1; 32], NOW, NOW - 1).is_err(),
            "expiry before epoch"
        );
    }
}
