//! RB04: the WB001 intent envelope parsed two ways, compared input by input.
//!
//! - BNR: `btungsten_wb001::decode`, the strict decoder the WB001 battery
//!   drives, compiled from `crates/btungsten-wb001` by path.
//! - Daedalus: the Rust that `daedalus compile-rust` generates from
//!   `WB001.ddl` at the pinned commit (`src/generated/honest.rs`), and from
//!   each TEETH variant of that grammar (`src/generated/t*.rs`). The grammar
//!   has two entries: `Envelope` (the envelope as a prefix of the input) and
//!   `Exact` (the whole input is one envelope).
//!
//! [`compare`] decides four dimensions for one input:
//!
//! - acceptance: `Exact` accepts exactly when BNR's decode does;
//! - values: where both accept, every decoded field is equal;
//! - consumed: the envelope end each parser reaches agrees: the whole input
//!   where BNR accepts; where BNR refuses with `bt-wb01:trailing`, `Envelope`
//!   consumes a shorter prefix that BNR itself accepts with equal values,
//!   and `Exact` fails; under any other refusal no complete envelope
//!   starts the input, so `Envelope` fails too;
//! - reencode: every parser that accepts has decoded values whose canonical
//!   encoding (`btungsten_wb001::canonical`, the SAW-proven encoder) is the
//!   input itself.
//!
//! A panic in either parser is caught and counted as a disagreement.

use std::panic::{AssertUnwindSafe, catch_unwind};

use btungsten_wb001::Refusal;
use btungsten_wb001::core::Intent;
use daedalus_rts_rust as ddl;

pub mod corpus;

pub mod generated {
    pub mod honest;
    pub mod t1_domain_bound;
    pub mod t2_word_endian;
    pub mod t3_cesu8_surrogate;
    pub mod t4_trailing_bytes;
}

/// The envelope's fields in their natural types.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Decoded {
    pub domain: Vec<u8>,
    pub nonce: Vec<u8>,
    pub epoch: u64,
    pub action: Vec<u8>,
    pub destination: Vec<u8>,
    pub capability: Vec<u8>,
    pub amount: u64,
    pub expiry: u64,
    pub payer: Vec<u8>,
    pub payload: Vec<u8>,
}

impl Decoded {
    pub fn from_intent(i: &Intent) -> Decoded {
        Decoded {
            domain: i.domain[..i.domain_len as usize].to_vec(),
            nonce: i.nonce[..i.nonce_len as usize].to_vec(),
            epoch: i.epoch,
            action: i.action[..i.action_len as usize].to_vec(),
            destination: i.destination[..i.destination_len as usize].to_vec(),
            capability: i.capability[..i.capability_len as usize].to_vec(),
            amount: i.amount,
            expiry: i.expiry,
            payer: i.payer[..i.payer_len as usize].to_vec(),
            payload: i.payload[..i.payload_len as usize].to_vec(),
        }
    }

    /// The canonical envelope of these values, through BNR's encoder. A value
    /// that does not fit the formal shape (a field longer than its capacity)
    /// has no encoding.
    pub fn reencode(&self) -> Result<Vec<u8>, String> {
        fn fit<const CAP: usize>(v: &[u8], what: &str) -> Result<(u32, [u8; CAP]), String> {
            if v.len() > CAP {
                return Err(format!("{what}: {} bytes do not fit {CAP}", v.len()));
            }
            let mut a = [0u8; CAP];
            a[..v.len()].copy_from_slice(v);
            Ok((v.len() as u32, a))
        }
        let (domain_len, domain) = fit::<64>(&self.domain, "domain")?;
        let (nonce_len, nonce) = fit::<32>(&self.nonce, "nonce")?;
        let (action_len, action) = fit::<32>(&self.action, "action")?;
        let (destination_len, destination) = fit::<128>(&self.destination, "destination")?;
        let (capability_len, capability) = fit::<64>(&self.capability, "capability")?;
        let (payer_len, payer) = fit::<128>(&self.payer, "payer")?;
        let (payload_len, payload) = fit::<4096>(&self.payload, "payload")?;
        let i = Box::new(Intent {
            domain_len,
            domain,
            nonce_len,
            nonce,
            epoch: self.epoch,
            action_len,
            action,
            destination_len,
            destination,
            capability_len,
            capability,
            amount: self.amount,
            expiry: self.expiry,
            payer_len,
            payer,
            payload_len,
            payload,
        });
        btungsten_wb001::canonical(&i).map_err(|r: Refusal| r.code().to_string())
    }
}

/// BNR's answer for one input.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Bnr {
    Accept(Decoded),
    Refuse(&'static str),
    Panic,
}

pub fn bnr(input: &[u8]) -> Bnr {
    match catch_unwind(|| btungsten_wb001::decode(input)) {
        Ok(Ok(i)) => Bnr::Accept(Decoded::from_intent(&i)),
        Ok(Err(r)) => Bnr::Refuse(r.code()),
        Err(_) => Bnr::Panic,
    }
}

/// A generated parser's answer for one input.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Ddl {
    Accept {
        value: Decoded,
        consumed: usize,
    },
    /// The parser failed; the runtime's error report, first line.
    Fail(String),
    /// The parser raised a Daedalus exception.
    Exception(String),
    Panic,
}

impl Ddl {
    pub fn accepted(&self) -> Option<(&Decoded, usize)> {
        match self {
            Ddl::Accept { value, consumed } => Some((value, *consumed)),
            _ => None,
        }
    }
}

fn bytes(a: ddl::Array<ddl::U<8>>) -> Vec<u8> {
    ddl::array_to_byte_vec::<ddl::U<8>>(a)
}

/// Adapters from one generated module's types to [`Decoded`] and [`Ddl`].
macro_rules! adapter {
    ($m:ident) => {
        pub mod $m {
            use super::*;
            // the generated module holds one Rust module per Daedalus module
            use crate::generated::$m::WB001 as g;

            fn decoded(e: g::Envelope) -> Decoded {
                Decoded {
                    domain: bytes(e.domain),
                    nonce: bytes(e.nonce),
                    epoch: u64::from(e.epoch),
                    action: bytes(e.action),
                    destination: bytes(e.destination),
                    capability: bytes(e.capability),
                    amount: u64::from(e.amount),
                    expiry: u64::from(e.expiry),
                    payer: bytes(e.payer),
                    payload: bytes(e.payload),
                }
            }

            fn run(
                input: &[u8],
                entry: fn(&mut ddl::ParserState, ddl::Input) -> ddl::ParserResult<g::Envelope>,
            ) -> Ddl {
                let r = catch_unwind(AssertUnwindSafe(|| {
                    let mut st = ddl::new_parser_state();
                    let inp =
                        ddl::new_input(ddl::new_byte_array(b"rb04"), ddl::new_byte_array(input));
                    match entry(&mut st, inp) {
                        ddl::ParserResult::Ok(e, rest) => Ddl::Accept {
                            value: decoded(e),
                            consumed: rest.offset(),
                        },
                        ddl::ParserResult::Failure => Ddl::Fail(
                            st.error
                                .to_string()
                                .lines()
                                .next()
                                .unwrap_or("")
                                .to_string(),
                        ),
                        ddl::ParserResult::Exception => Ddl::Exception(
                            st.error
                                .to_string()
                                .lines()
                                .next()
                                .unwrap_or("")
                                .to_string(),
                        ),
                    }
                }));
                r.unwrap_or(Ddl::Panic)
            }

            pub fn exact(input: &[u8]) -> Ddl {
                run(input, g::Exact)
            }

            pub fn prefix(input: &[u8]) -> Ddl {
                run(input, g::Envelope)
            }
        }
    };
}

pub mod adapters {
    use super::*;
    adapter!(honest);
    adapter!(t1_domain_bound);
    adapter!(t2_word_endian);
    adapter!(t3_cesu8_surrogate);
    adapter!(t4_trailing_bytes);
}

/// One grammar variant: its two entries.
#[derive(Clone, Copy)]
pub struct Variant {
    pub name: &'static str,
    pub exact: fn(&[u8]) -> Ddl,
    pub prefix: fn(&[u8]) -> Ddl,
}

pub const VARIANTS: &[Variant] = &[
    Variant {
        name: "honest",
        exact: adapters::honest::exact,
        prefix: adapters::honest::prefix,
    },
    Variant {
        name: "t1_domain_bound",
        exact: adapters::t1_domain_bound::exact,
        prefix: adapters::t1_domain_bound::prefix,
    },
    Variant {
        name: "t2_word_endian",
        exact: adapters::t2_word_endian::exact,
        prefix: adapters::t2_word_endian::prefix,
    },
    Variant {
        name: "t3_cesu8_surrogate",
        exact: adapters::t3_cesu8_surrogate::exact,
        prefix: adapters::t3_cesu8_surrogate::prefix,
    },
    Variant {
        name: "t4_trailing_bytes",
        exact: adapters::t4_trailing_bytes::exact,
        prefix: adapters::t4_trailing_bytes::prefix,
    },
];

pub fn variant(name: &str) -> Option<Variant> {
    VARIANTS.iter().copied().find(|v| v.name == name)
}

pub const DIMENSIONS: [&str; 4] = ["acceptance", "values", "consumed", "reencode"];

/// Per dimension: `None` when the dimension does not apply to this input,
/// else whether the parsers agree.
#[derive(Clone, Debug)]
pub struct Comparison {
    pub bnr: Bnr,
    pub exact: Ddl,
    pub prefix: Ddl,
    pub dims: [Option<bool>; 4],
}

impl Comparison {
    pub fn agrees_everywhere(&self) -> bool {
        self.dims.iter().all(|d| *d != Some(false))
    }
}

pub fn compare(v: Variant, input: &[u8]) -> Comparison {
    let b = bnr(input);
    let e = (v.exact)(input);
    let p = (v.prefix)(input);
    let panicked = b == Bnr::Panic || e == Ddl::Panic || p == Ddl::Panic;
    let n = input.len();

    let acceptance = !panicked && matches!(b, Bnr::Accept(_)) == e.accepted().is_some();

    let values = match (&b, e.accepted()) {
        (Bnr::Accept(db), Some((de, _))) => Some(
            db == de
                && match p.accepted() {
                    Some((dp, c)) if c == n => dp == db,
                    _ => true,
                },
        ),
        _ => None,
    };

    let consumed = !panicked
        && match &b {
            Bnr::Accept(_) => {
                e.accepted().map(|(_, c)| c) == Some(n) && p.accepted().map(|(_, c)| c) == Some(n)
            }
            Bnr::Refuse("bt-wb01:trailing") => match p.accepted() {
                Some((dp, c)) if c < n => {
                    e.accepted().is_none() && bnr(&input[..c]) == Bnr::Accept(dp.clone())
                }
                _ => false,
            },
            _ => p.accepted().is_none() && e.accepted().is_none(),
        };

    let reencode = if matches!(b, Bnr::Accept(_)) || e.accepted().is_some() {
        let ok_b = match &b {
            Bnr::Accept(d) => d.reencode().as_deref() == Ok(input),
            _ => true,
        };
        let ok_e = match e.accepted() {
            Some((d, _)) => d.reencode().as_deref() == Ok(input),
            None => true,
        };
        Some(ok_b && ok_e)
    } else {
        None
    };

    Comparison {
        bnr: b,
        exact: e,
        prefix: p,
        dims: [Some(acceptance), values, Some(consumed), reencode],
    }
}
