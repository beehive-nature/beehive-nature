//! The mechanism, mirrored in the source's own order.
//! Citations are to the pinned commit (see crate docs): exchange_state.cpp (es),
//! delegate_bandwidth.cpp (db), eosio.system.cpp (sys).

/// A completed trade. Field names follow the source's own vocabulary.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Trade {
    /// core-token raw units the trader paid (buy) or received net (sell)
    pub amount_in: i64,
    /// the 0.5% fee, in raw units — it leaves the curve, never re-prices
    pub fee: i64,
    /// fee-net input that actually entered the relay (buy), or gross proceeds before fee (sell)
    pub after_fee: i64,
    /// bytes received (buy) or bytes sold (sell)
    pub bytes: i64,
}

pub const MIN_BYTES: i64 = 1;      // db:85  check( bytes_out > 0, "must reserve a positive amount" )
pub const MIN_CORE_UNITS: i64 = 2; // db:128 check( tokens_out.amount > 1, "…selling ram is too low" )

/// es:81-94 `get_bancor_output` — int64 promoted to double, quotient in double,
/// cast truncates toward zero. Mirrored exactly (promotions and order included).
#[inline]
pub fn bancor_output(inp_reserve: i64, out_reserve: i64, inp: i64) -> i64 {
    let ib = inp_reserve as f64;
    let ob = out_reserve as f64;
    let input = inp as f64;
    let out = ((input * ob) / (ib + input)) as i64; // C++ int64_t(double) truncates
    if out < 0 { 0 } else { out }                   // es:91 guard
}

/// es:96-108 `get_bancor_input` — the inverse, same double-truncation discipline.
/// Call-site argument order at db:28 is `get_bancor_input(ram_reserve, eos_reserve, bytes)`.
#[inline]
pub fn bancor_input(out_reserve: i64, inp_reserve: i64, out: i64) -> i64 {
    let ob = out_reserve as f64;
    let ib = inp_reserve as f64;
    let output = out as f64;
    let inp = ((ib * output) / (ob - output)) as i64;
    if inp < 0 { 0 } else { inp }                   // es:105 guard
}

/// db:60,140 `(x + 199) / 200` — 0.5%, rounded UP, in integer arithmetic.
/// Generalized as ceil-div so no priced literal rides in `src/`.
#[inline]
fn fee_ceil(amount: i64) -> i64 {
    (amount + 199) / 200
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RamError {
    /// db:57 check( quant.amount > 0, "must purchase a positive amount" )
    NonPositivePayment,
    /// db:85 check( bytes_out > 0, "must reserve a positive amount" )
    BuyBelowMinimum,
    /// db:128 check( tokens_out.amount > 1, "token amount received from selling ram is too low" )
    SellBelowMinimum,
}

/// The relay state: base = unallocated RAM bytes, quote = core-token raw units
/// (4-dp precision on the live chain). `total_ram_stake` rides along because
/// buys and sells move it in lockstep with quote — the virtual-seed invariant
/// (`quote − stake` constant) falls out of that pairing (sys:583, db:88, db:134).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RamMarket {
    pub base_bytes: i64,
    pub quote_units: i64,
    pub total_ram_stake: i64,
}

impl RamMarket {
    pub fn new(base_bytes: i64, quote_units: i64, total_ram_stake: i64) -> Self {
        Self { base_bytes, quote_units, total_ram_stake }
    }

    /// The live chain's state satisfies `base == max_ram_size − reserved` exactly;
    /// callers capture it that way. No constructor asserts it here — the chain,
    /// not the model, owns that law (see tests for the live cross-check).

    /// `buyram` (db:49-100): ceil'd 0.5% fee leaves the curve; the fee-net amount
    /// is converted quote→base by `direct_convert` (es:71-74: out first, then
    /// `quote += from`, `base -= out`); `total_ram_stake += after_fee` (db:88).
    pub fn buy(&mut self, quant_units: i64) -> Result<Trade, RamError> {
        if quant_units <= 0 {
            return Err(RamError::NonPositivePayment);          // db:57
        }
        let fee = fee_ceil(quant_units);                        // db:59-60
        let after_fee = quant_units - fee;                      // db:64-65
        let bytes_out = bancor_output(self.quote_units, self.base_bytes, after_fee); // es:72
        if bytes_out < MIN_BYTES {
            return Err(RamError::BuyBelowMinimum);              // db:85
        }
        self.quote_units += after_fee;                          // es:73 quote.balance += from
        self.base_bytes -= bytes_out;                           // es:74 base.balance  -= out
        self.total_ram_stake += after_fee;                      // db:88
        Ok(Trade { amount_in: quant_units, fee, after_fee, bytes: bytes_out })
    }

    /// `sellram` (db:115-146): base→quote conversion (es:67-70), the `> 1` guard,
    /// then the ceil'd 0.5% fee on the GROSS proceeds (db:140) — fee leaves the
    /// curve again; `total_ram_stake -= tokens_out` (db:134 vicinity).
    /// On-chain a failing check reverts the whole transaction, so an `Err` here
    /// must leave the market untouched — guard first, mutate after.
    pub fn sell(&mut self, bytes: i64) -> Result<Trade, RamError> {
        let tokens_out = bancor_output(self.base_bytes, self.quote_units, bytes); // es:68
        if tokens_out < MIN_CORE_UNITS {
            return Err(RamError::SellBelowMinimum);             // db:128 (chain reverts)
        }
        self.base_bytes += bytes;                               // es:69
        self.quote_units -= tokens_out;                         // es:70
        let fee = fee_ceil(tokens_out);                         // db:140
        self.total_ram_stake -= tokens_out;
        Ok(Trade { amount_in: tokens_out - fee, fee, after_fee: tokens_out, bytes })
    }

    /// `buyrambytes` (db:25-31): inverse-conversion cost, then the `/0.995`
    /// double gross-up truncated to int64, then handed to [`RamMarket::buy`]
    /// which takes its own ceil'd fee on top. Returns the pre-buy figures so
    /// tests can pin the measured one-byte undershoot.
    pub fn cost_for_bytes(&self, bytes: i64) -> (i64, i64) {
        let cost = bancor_input(self.base_bytes, self.quote_units, bytes); // db:28 call-site order
        let cost_plus_fee = (cost as f64 / 0.995f64) as i64;    // db:30 int64 <- double trunc
        (cost, cost_plus_fee)
    }

    /// Derived spot (the chain exposes no price function; R8 convention):
    /// core raw units per byte. Display-only — never used by the mechanism.
    pub fn spot_units_per_byte(&self) -> f64 {
        self.quote_units as f64 / self.base_bytes as f64
    }
}
