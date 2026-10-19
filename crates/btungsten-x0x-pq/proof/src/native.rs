//! Native regression evidence is reported separately from the symbolic proof.
use fips204::{
    ml_dsa_65,
    traits::{KeyGen, SerDes, Signer},
};
use pq_prepare_proof::{candidate::PreparedMlDsa65PublicKey as Prepared, legacy, modern};
use serde_json::{json, Value};
use std::collections::BTreeMap;

const LENGTHS: [usize; 12] = [0, 1, 63, 64, 65, 135, 136, 137, 255, 256, 257, 4096];
const ROWS: [(&str, usize); 21] = [
    ("valid", 48),
    ("message-tail", 48),
    ("context-tail", 48),
    ("challenge", 48),
    ("wrong-key", 48),
    ("empty-signature", 48),
    ("short-signature", 48),
    ("long-signature", 48),
    ("context-256", 48),
    ("hint-overflow", 48),
    ("hint-decrease", 48),
    ("hint-duplicate", 48),
    ("hint-padding", 48),
    ("z-norm", 48),
    ("every-short-length", 3309),
    ("every-legal-context-length", 256),
    ("key-length", 4),
    ("ignored-message-suffix", 1),
    ("ignored-context", 1),
    ("ignored-signature-suffix", 1),
    ("owned-key-bytes", 1),
];

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Control {
    Honest,
    Accept,
    Reject,
    Message,
    Context,
    Signature,
    Empty,
}

impl Control {
    pub fn name(self) -> &'static str {
        match self {
            Self::Honest => "honest",
            Self::Accept => "accept",
            Self::Reject => "reject",
            Self::Message => "message",
            Self::Context => "context",
            Self::Signature => "signature",
            Self::Empty => "empty",
        }
    }
}

fn verify(p: &Prepared, m: &[u8], s: &[u8], c: &[u8], control: Control) -> bool {
    match control {
        Control::Accept => true,
        Control::Reject => false,
        Control::Message => p.verify(&m[..m.len().min(256)], s, c),
        Control::Context => p.verify(m, s, b""),
        Control::Signature => p.verify(m, &s[..s.len().min(3309)], c),
        Control::Honest | Control::Empty => p.verify(m, s, c),
    }
}

#[derive(Default)]
struct Report {
    rows: BTreeMap<String, (usize, usize)>,
    failures: Vec<Value>,
    legacy_checks: usize,
}

impl Report {
    fn record(&mut self, row: &str, ok: bool, details: Value) {
        let entry = self.rows.entry(row.into()).or_default();
        entry.0 += 1;
        entry.1 += usize::from(ok);
        if !ok {
            self.failures
                .push(json!({"row":row, "index":entry.0, "details":details}));
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn case(
        &mut self,
        row: &str,
        pk: &[u8],
        p: &Prepared,
        m: &[u8],
        s: &[u8],
        c: &[u8],
        expected: bool,
        control: Control,
    ) {
        let candidate = verify(p, m, s, c, control);
        let stock = modern(pk, m, s, c);
        let old = if c.is_empty() {
            self.legacy_checks += 1;
            Some(legacy(pk, m, s))
        } else {
            None
        };
        self.record(
            row,
            candidate == expected && stock == expected && old.is_none_or(|v| v == expected),
            json!({"candidate":candidate,"modern":stock,"legacy":old,"expected":expected,
                "message_bytes":m.len(),"signature_bytes":s.len(),"context_bytes":c.len()}),
        );
    }
}

fn changed(bytes: &[u8]) -> Vec<u8> {
    let mut out = bytes.to_vec();
    if let Some(last) = out.last_mut() {
        *last ^= 1;
    } else {
        out.push(1);
    }
    out
}

pub fn run(control: Control) -> Result<Value, String> {
    let mut r = Report::default();
    if control != Control::Empty {
        // Public, deterministic test seeds. These are not production identities.
        let (pk, sk) = ml_dsa_65::KG::keygen_from_seed(&[0x42; 32]);
        let (other, _) = ml_dsa_65::KG::keygen_from_seed(&[0x43; 32]);
        let pk = pk.into_bytes();
        let other = other.into_bytes();
        let p = Prepared::from_bytes(&pk)?;
        let q = Prepared::from_bytes(&other)?;
        for len in LENGTHS {
            let m: Vec<u8> = (0..len).map(|i| (i % 251) as u8).collect();
            for clen in [0, 1, 254, 255] {
                let c = vec![0x43; clen];
                let s = sk.try_sign_with_seed(&[0x44; 32], &m, &c)?;
                r.case("valid", &pk, &p, &m, &s, &c, true, control);
                r.case(
                    "message-tail",
                    &pk,
                    &p,
                    &changed(&m),
                    &s,
                    &c,
                    false,
                    control,
                );
                r.case(
                    "context-tail",
                    &pk,
                    &p,
                    &m,
                    &s,
                    &changed(&c),
                    false,
                    control,
                );
                let mut bad = s;
                bad[0] ^= 1;
                r.case("challenge", &pk, &p, &m, &bad, &c, false, control);
                r.case("wrong-key", &other, &q, &m, &s, &c, false, control);
                r.case("empty-signature", &pk, &p, &m, &[], &c, false, control);
                r.case(
                    "short-signature",
                    &pk,
                    &p,
                    &m,
                    &s[..3308],
                    &c,
                    false,
                    control,
                );
                let mut long = s.to_vec();
                long.push(0);
                r.case("long-signature", &pk, &p, &m, &long, &c, false, control);
                r.case("context-256", &pk, &p, &m, &s, &[0x43; 256], false, control);
                // FIPS 204 ML-DSA-65: c_tilde=48, z=5*640, hint=55+6.
                for row in [
                    "hint-overflow",
                    "hint-decrease",
                    "hint-duplicate",
                    "hint-padding",
                    "z-norm",
                ] {
                    let mut bad = s;
                    match row {
                        "hint-overflow" => bad[3303] = 56,
                        "hint-decrease" => {
                            bad[3303] = 1;
                            bad[3304] = 0;
                        }
                        "hint-duplicate" => {
                            bad[3248..].fill(0);
                            bad[3248] = 9;
                            bad[3249] = 9;
                            bad[3303..].fill(2);
                        }
                        "hint-padding" => {
                            bad[3248..].fill(0);
                            bad[3248] = 1;
                        }
                        "z-norm" => bad[48..3248].fill(0),
                        _ => unreachable!(),
                    }
                    r.case(row, &pk, &p, &m, &bad, &c, false, control);
                }
            }
        }
        let m = vec![0x42; 257];
        let s = sk.try_sign_with_seed(&[0x44; 32], &m, b"")?;
        for len in 0..3309 {
            r.case(
                "every-short-length",
                &pk,
                &p,
                &m,
                &s[..len],
                b"",
                false,
                control,
            );
        }
        for len in 0..256 {
            let c = vec![0x43; len];
            let s = sk.try_sign_with_seed(&[0x44; 32], &m, &c)?;
            r.case(
                "every-legal-context-length",
                &pk,
                &p,
                &m,
                &s,
                &c,
                true,
                control,
            );
        }
        for len in [0, 1, 1951, 1953] {
            let bytes = vec![0; len];
            r.record(
                "key-length",
                Prepared::from_bytes(&bytes).is_err()
                    && !modern(&bytes, &m, &s, b"")
                    && !legacy(&bytes, &m, &s),
                json!({"bytes":len}),
            );
        }
        // Purpose-built counterexamples expose ignored inputs without relying on
        // random forgeries. The stock verifier must reject each full input.
        let prefix = sk.try_sign_with_seed(&[0x44; 32], &m[..256], b"")?;
        r.case(
            "ignored-message-suffix",
            &pk,
            &p,
            &m,
            &prefix,
            b"",
            false,
            control,
        );
        r.case("ignored-context", &pk, &p, &m, &s, b"x", false, control);
        let mut long = s.to_vec();
        long.push(0);
        r.case(
            "ignored-signature-suffix",
            &pk,
            &p,
            &m,
            &long,
            b"",
            false,
            control,
        );
        let mut bytes = pk;
        let retained = Prepared::from_bytes(&bytes)?;
        bytes.copy_from_slice(&other);
        r.record(
            "owned-key-bytes",
            retained.verify(&m, &s, b"") && !modern(&bytes, &m, &s, b""),
            json!({"immutable_owned_key":true}),
        );
    }
    let missing: Vec<_> = ROWS
        .iter()
        .filter_map(|(row, expected)| {
            let got = r.rows.get(*row).copied().unwrap_or_default().0;
            (got != *expected).then(|| json!({"row":row,"expected":expected,"executed":got}))
        })
        .collect();
    let unexpected: Vec<_> = r
        .rows
        .keys()
        .filter(|k| !ROWS.iter().any(|(n, _)| n == k))
        .collect();
    let executed: usize = r.rows.values().map(|r| r.0).sum();
    let passed: usize = r.rows.values().map(|r| r.1).sum();
    Ok(
        json!({"schema":"btungsten.prepared-native/1", "control":control.name(),
        "result":if missing.is_empty() && unexpected.is_empty() && r.failures.is_empty() {"PASS"} else {"FAIL"},
        "class":"NATIVE DIFFERENTIAL/TEETH; not a universal proof or official KAT",
        "executed":executed,"passed":passed,"required_rows":ROWS.len(),"rows":r.rows,
        "missing":missing,"unexpected":unexpected,"failures":r.failures,"legacy_checks":r.legacy_checks}),
    )
}
