//! x402 — the PRE-SIGNATURE OFFER GATE + the `exact-multi` instruction
//! (x402-RAID-Z31; the z3.1 rows of docs/raids/X402-SORT-2026-09-01.md —
//! RULE shapes only, never Hedera code; the estate rail is Vaulta).
//!
//! THE LAW OF THIS MODULE: the deciding organ refuses any offer it does
//! not like BEFORE it signs, never after (pinout `client.mjs:pay` —
//! per-call + cumulative caps checked before signing; Tally `mcp/guard.ts`
//! — hard per-signature ceiling + destination allowlist, checked before
//! any signing). The caps live in the member's hand — a policy file this
//! organ reads and never writes — not on someone's server.
//!
//! THE ONE-SIGNATURE SPLIT (qisma `exact-multi` shape): after the gate
//! passes, this organ emits ONE instruction whose `outputs` pay the seller
//! and the tithe together. The split is validated as SCHEMA INVARIANTS on
//! the instruction itself — sum(outputs) == amount, payTo ∈ outputs,
//! feePayer ∉ outputs, unique destinations, the tithe output exactly
//! amount × tithe_bp / 10000 — and a single ML-DSA signature covers the
//! whole body. The rail's atomicity enforces the split, not a server.
//! The buyer signs and never submits: submission is the rail adapter's
//! job (qisma `signCascade` — one signed body, many credits, atomic).
//!
//! OFFERS ARE PINNED (pinout `receipt.mjs` JWS shape): an offer is only
//! gateable when it arrives inside a signed document — a `seller_sig`
//! envelope over the canonical offer bytes, verified OFFLINE against the
//! seller key the member pinned in the allowlist entry for that
//! destination. A destination is never separable from the seller key that
//! was pinned with it.

use serde_json::{json, Map, Value};

use crate::b64::b64u_decode;
use crate::envelope;

/// Canonical bytes of a JSON document for signing/verification. serde_json
/// without `preserve_order` maps keys through BTreeMap, so `to_string` is
/// key-sorted and build-stable: the verifier recomputes the same bytes.
pub fn canonical(v: &Value) -> Vec<u8> {
    serde_json::to_string(v).unwrap_or_default().into_bytes()
}

/// The hard DEFAULT per-signature ceiling, atomic units at 4 dp = 1.0000 A
/// (Tally `guard.ts` shape: a default ≈ $1-class hard cap per signature,
/// raised only by the member's own policy — never by an offer).
pub const DEFAULT_PER_SIGNATURE_CAP_ATOMIC: u64 = 10_000;

/// One pinned destination: the account the member allows, the rail it is
/// allowed on, and the seller key whose signature the offer must carry.
/// Pinning destination + seller key in the same row is the point — an
/// allowlisted account can never be paid under a stranger's signature.
pub struct AllowEntry {
    pub pay_to: String,
    pub rail: Option<String>,
    pub seller_key_id: String,
    pub seller_vk_b64u: String,
}

/// The member's hand: caps, budget, expected asset, and the allowlist.
/// Built by `parse_policy` from a policy file; this organ never writes it.
pub struct Policy {
    pub payer: String,
    pub per_signature_cap_atomic: u64,
    pub remaining_budget_atomic: u64,
    pub asset_symbol: String,
    pub asset_precision: u32,
    pub now_ms: u64,
    pub allowlist: Vec<AllowEntry>,
}

fn u64_of(v: &Value, field: &str) -> Result<u64, String> {
    v.get(field)
        .and_then(Value::as_u64)
        .ok_or_else(|| format!("malformed offer: {field} missing or not a u64"))
}

fn str_of<'a>(v: &'a Value, field: &str) -> Result<&'a str, String> {
    v.get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("malformed offer: {field} missing or not a string"))
}

/// Vaulta account name: 1..=12 chars of a-z / 1-5 (the rail's name code).
/// Validated BEFORE anything is signed — junk never reaches the pen.
fn valid_rail_account(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 12
        && s.chars()
            .all(|c| c.is_ascii_lowercase() && c.is_ascii_alphabetic() || ('1'..='5').contains(&c))
}

/// Parse a policy document (the member's hand). `per_signature_cap_atomic`
/// may be omitted — the hard default applies and the caller reports it.
/// Everything else is required: a budget or allowlist nobody stated is a
/// refusal, not a guess.
pub fn parse_policy(doc: &Value) -> Result<(Policy, bool), String> {
    let payer = str_of(doc, "payer")?.to_string();
    if !valid_rail_account(&payer) {
        return Err(format!(
            "malformed policy: payer {payer:?} is not a rail account"
        ));
    }
    let per_signature_cap_atomic = match doc.get("per_signature_cap_atomic") {
        None => DEFAULT_PER_SIGNATURE_CAP_ATOMIC,
        Some(v) => v
            .as_u64()
            .ok_or("malformed policy: per_signature_cap_atomic not a u64")?,
    };
    let remaining_budget_atomic = doc
        .get("remaining_budget_atomic")
        .and_then(Value::as_u64)
        .ok_or("malformed policy: remaining_budget_atomic missing (state your budget — it is never guessed)")?;
    let asset = doc.get("asset").ok_or("malformed policy: asset missing")?;
    let asset_symbol = str_of(asset, "symbol")?.to_string();
    let asset_precision = asset
        .get("precision")
        .and_then(Value::as_u64)
        .ok_or("malformed policy: asset precision missing")? as u32;
    let now_ms = doc.get("now_ms").and_then(Value::as_u64).ok_or(
        "malformed policy: now_ms missing (the clock is injected, never trusted from the offer)",
    )?;
    let mut allowlist = Vec::new();
    for row in doc.get("allowlist").and_then(Value::as_array).ok_or(
        "malformed policy: allowlist missing (empty is legal — it refuses all destinations)",
    )? {
        let pay_to = str_of(row, "pay_to")?.to_string();
        if !valid_rail_account(&pay_to) {
            return Err(format!(
                "malformed policy: allowlist pay_to {pay_to:?} is not a rail account"
            ));
        }
        allowlist.push(AllowEntry {
            pay_to,
            rail: row.get("rail").and_then(Value::as_str).map(str::to_string),
            seller_key_id: str_of(row, "seller_key_id")?.to_string(),
            seller_vk_b64u: str_of(row, "seller_vk_b64u")?.to_string(),
        });
    }
    let used_default_cap = doc.get("per_signature_cap_atomic").is_none();
    Ok((
        Policy {
            payer,
            per_signature_cap_atomic,
            remaining_budget_atomic,
            asset_symbol,
            asset_precision,
            now_ms,
            allowlist,
        },
        used_default_cap,
    ))
}

/// THE PRE-SIGNATURE OFFER GATE. Every refusal is named and happens BEFORE
/// any key is touched. On success, returns the unsigned `exact-multi/1`
/// instruction — the caller (this organ's CLI, or a test) signs it with
/// `envelope::sign_envelope`; nothing else ever signs.
pub fn gate(offer_doc: &Value, policy: &Policy) -> Result<Value, String> {
    if offer_doc.get("kind").and_then(Value::as_str) != Some("x402.offer/1") {
        return Err("refused: not an x402.offer/1 document".into());
    }
    let offer = offer_doc
        .get("offer")
        .ok_or("refused: offer document carries no offer body")?;

    // ── destination allowlist (Tally guard: checked before any signing) ──
    let pay_to = str_of(offer, "pay_to")?;
    let entry = policy
        .allowlist
        .iter()
        .find(|e| e.pay_to == pay_to)
        .ok_or_else(|| {
            format!(
                "refused: destination {pay_to:?} not allowlisted — the allowlist lives in the member's hand"
            )
        })?;
    let rail = str_of(offer, "rail")?;
    if let Some(pinned) = &entry.rail {
        if pinned != rail {
            return Err(format!(
                "refused: rail {rail:?} is not the rail pinned for {pay_to:?} ({pinned:?})"
            ));
        }
    }

    // ── pinned-seller signature, verified OFFLINE (pinout receipt.mjs) ──
    let seller_sig = offer_doc
        .get("seller_sig")
        .ok_or("refused: offer carries no seller signature — an unsigned offer is not pinned")?;
    let sig_kid = seller_sig
        .get("key_id")
        .and_then(Value::as_str)
        .ok_or("refused: seller signature carries no key id")?;
    if sig_kid != entry.seller_key_id {
        return Err(format!(
            "refused: offer signed by key {sig_kid:?}, the member pinned {pinned:?} for this destination",
            pinned = entry.seller_key_id
        ));
    }
    let seller_vk = b64u_decode(&entry.seller_vk_b64u)
        .ok_or("refused: pinned seller key undecodable — the policy row is broken")?;
    envelope::verify_envelope(seller_sig, &seller_vk, &canonical(offer))
        .map_err(|e| format!("refused: seller signature invalid — {e}"))?;

    // ── expiry (xorv createQuote: pinned, single-use, self-expiring) ────
    let expires_at_ms = u64_of(offer, "expires_at_ms")?;
    if policy.now_ms >= expires_at_ms {
        return Err(format!(
            "refused: offer expired at {expires_at_ms} — never pay for an offer that cannot be served"
        ));
    }

    // ── terms: the asset must be the one the member expects ─────────────
    let asset = offer.get("asset").ok_or("refused: offer names no asset")?;
    let symbol = str_of(asset, "symbol")?;
    let precision = asset
        .get("precision")
        .and_then(Value::as_u64)
        .ok_or("refused: offer asset carries no precision")? as u32;
    if symbol != policy.asset_symbol || precision != policy.asset_precision {
        return Err(format!(
            "refused: asset {symbol}/{precision} is not the member's {}/{policy_precision}",
            policy.asset_symbol,
            policy_precision = policy.asset_precision
        ));
    }

    // ── the caps, BEFORE signing (pinout pay + Tally guard) ─────────────
    let amount_atomic = u64_of(offer, "amount_atomic")?;
    if amount_atomic == 0 {
        return Err("refused: zero-amount offer".into());
    }
    if amount_atomic > policy.per_signature_cap_atomic {
        return Err(format!(
            "refused: {amount_atomic} atomic over per-signature cap {cap} — refused BEFORE signing (Tally guard: hard ceiling per signature)",
            cap = policy.per_signature_cap_atomic
        ));
    }
    if amount_atomic > policy.remaining_budget_atomic {
        return Err(format!(
            "refused: {amount_atomic} atomic over remaining budget {budget} — refused BEFORE signing (pinout pay: cumulative cap)",
            budget = policy.remaining_budget_atomic
        ));
    }

    // ── the split, as schema invariants (qisma superRefine shape) ───────
    // The instruction is emitted from the offer's advertised outputs, but
    // only after every invariant holds — a lying split never reaches the pen.
    let nonce = u64_of(offer, "nonce")?;
    let tithe_bp = offer.get("tithe_bp").and_then(Value::as_u64).unwrap_or(0);
    if tithe_bp > 10_000 {
        return Err("refused: tithe_bp over 10000".into());
    }
    let outputs = offer
        .get("outputs")
        .and_then(Value::as_array)
        .ok_or("refused: offer carries no outputs")?;
    if outputs.is_empty() {
        return Err("split invariant: outputs empty".into());
    }
    let mut sum: u64 = 0;
    let mut seen: Vec<&str> = Vec::new();
    let mut seller_seen = false;
    let mut tithe_seen = false;
    // amount × bp / 10000, floor — multiplication FIRST: the truncation
    // order is the law (6000×1000/10000 = 600, while 6000/10000×1000 = 0
    // silently zeroes the tithe on sub-10k atomic amounts)
    let expected_tithe = amount_atomic
        .checked_mul(tithe_bp)
        .and_then(|p| p.checked_div(10_000))
        .ok_or("split invariant: tithe arithmetic overflow")?;
    for out in outputs {
        let to = str_of(out, "to")?;
        let amt = u64_of(out, "amount_atomic")?;
        let role = str_of(out, "role")?;
        if !valid_rail_account(to) {
            return Err(format!(
                "split invariant: output account {to:?} is not a rail account"
            ));
        }
        if seen.contains(&to) {
            return Err(format!("split invariant: duplicate output {to:?}"));
        }
        seen.push(to);
        if to == policy.payer {
            return Err("split invariant: feePayer must not be an output".into());
        }
        if to != pay_to && role != "tithe" {
            return Err(format!(
                "split invariant: output {to:?} is neither payTo nor the tithe"
            ));
        }
        match role {
            "seller" => {
                if to != pay_to {
                    return Err("split invariant: role seller on a non-payTo output".into());
                }
                if seller_seen {
                    return Err("split invariant: more than one seller output".into());
                }
                seller_seen = true;
            }
            "tithe" => {
                if tithe_seen {
                    return Err("split invariant: more than one tithe output".into());
                }
                tithe_seen = true;
                if tithe_bp == 0 {
                    return Err("split invariant: tithe output on a tithe_bp=0 offer".into());
                }
                if amt != expected_tithe {
                    return Err(format!(
                        "split invariant: tithe output {amt} != amount×bp/10000 = {expected_tithe}"
                    ));
                }
            }
            other => return Err(format!("split invariant: unknown output role {other:?}")),
        }
        sum = sum
            .checked_add(amt)
            .ok_or("split invariant: outputs overflow u64")?;
    }
    if !seller_seen {
        return Err("split invariant: payTo missing from outputs".into());
    }
    if sum != amount_atomic {
        return Err(format!(
            "split invariant: outputs sum {sum} != amount {amount_atomic}"
        ));
    }

    // ── emit the instruction (qisma signCascade: signed, never submitted) ──
    let mut body = Map::new();
    body.insert("kind".into(), json!("exact-multi/1"));
    body.insert("rail".into(), json!(rail));
    body.insert("payer".into(), json!(policy.payer));
    body.insert(
        "asset".into(),
        json!({"symbol": policy.asset_symbol, "precision": policy.asset_precision}),
    );
    body.insert("amount_atomic".into(), json!(amount_atomic));
    body.insert("tithe_bp".into(), json!(tithe_bp));
    body.insert("outputs".into(), Value::Array(outputs.to_vec()));
    body.insert("nonce".into(), json!(nonce));
    // qisma memo rule: the memo binds the instruction to its single-use nonce
    body.insert("memo".into(), json!(format!("x402:{nonce}")));
    body.insert("expires_at_ms".into(), json!(expires_at_ms));
    body.insert(
        "laws".into(),
        json!("one signature pays seller+tithe together; sum(outputs)==amount; payTo∈outputs; feePayer∉outputs; the rail's atomicity enforces the split, not a server"),
    );
    Ok(Value::Object(body))
}

/// Offline verification of a payment document
/// `{instruction, signature}` against the PAYER's verifying key — the
/// qisma `verifyInclusion` shape's offline half: no keys, no network,
/// just recompute the canonical bytes, check the envelope, and re-run the
/// invariants that need no member context.
pub fn verify_payment(doc: &Value, payer_vk: &[u8]) -> Result<(), String> {
    let instruction = doc
        .get("instruction")
        .ok_or("not a payment document: instruction missing")?;
    let sig = doc
        .get("signature")
        .ok_or("not a payment document: signature missing")?;
    if instruction.get("kind").and_then(Value::as_str) != Some("exact-multi/1") {
        return Err("not an exact-multi/1 instruction".into());
    }
    envelope::verify_envelope(sig, payer_vk, &canonical(instruction))
        .map_err(|e| format!("payer signature invalid — {e}"))?;
    // the invariants that hold without the member's policy
    let amount = u64_of(instruction, "amount_atomic")?;
    let payer = str_of(instruction, "payer")?;
    let tithe_bp = instruction
        .get("tithe_bp")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let outputs = instruction
        .get("outputs")
        .and_then(Value::as_array)
        .ok_or("instruction carries no outputs")?;
    let mut sum: u64 = 0;
    let mut seller_outputs = 0u32;
    let expected_tithe = amount
        .checked_mul(tithe_bp)
        .and_then(|p| p.checked_div(10_000))
        .ok_or("split invariant: tithe arithmetic overflow")?;
    for out in outputs {
        let to = str_of(out, "to")?;
        let amt = u64_of(out, "amount_atomic")?;
        match str_of(out, "role")? {
            "seller" => seller_outputs += 1,
            "tithe" => {
                if amt != expected_tithe {
                    return Err(format!(
                        "split invariant: tithe output {amt} != {expected_tithe}"
                    ));
                }
            }
            other => return Err(format!("split invariant: unknown role {other:?}")),
        }
        if to == payer {
            return Err("split invariant: feePayer must not be an output".into());
        }
        sum = sum
            .checked_add(amt)
            .ok_or("split invariant: outputs overflow u64")?;
    }
    if seller_outputs != 1 {
        return Err("split invariant: payTo missing from outputs".into());
    }
    if sum != amount {
        return Err(format!(
            "split invariant: outputs sum {sum} != amount {amount}"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::alg::SigAlg;
    use crate::b64::b64u;
    use crate::pq::dsa_generate;
    use zeroize::Zeroizing;

    const NOW_MS: u64 = 1_800_000_000_000;

    struct Fixture {
        seller_seed: Zeroizing<[u8; 32]>,
        seller_vk: Vec<u8>,
        seller_kid: String,
        payer_seed: Zeroizing<[u8; 32]>,
        payer_vk: Vec<u8>,
    }

    fn fixture() -> Fixture {
        let s = dsa_generate(SigAlg::MlDsa44);
        let p = dsa_generate(SigAlg::MlDsa44);
        Fixture {
            seller_seed: Zeroizing::new(s.seed),
            seller_vk: s.verifying_key,
            seller_kid: "seller-key-1".into(),
            payer_seed: Zeroizing::new(p.seed),
            payer_vk: p.verifying_key,
        }
    }

    fn offer_body(amount: u64, tithe_bp: u64) -> Value {
        let tithe = amount * tithe_bp / 10_000;
        let mut outputs = vec![json!({
            "to": "sellertest11", "amount_atomic": amount - tithe, "role": "seller"
        })];
        if tithe_bp > 0 {
            outputs.push(json!({
                "to": "titheacct111", "amount_atomic": tithe, "role": "tithe"
            }));
        }
        json!({
            "pay_to": "sellertest11",
            "rail": "vaulta",
            "asset": { "symbol": "A", "precision": 4 },
            "amount_atomic": amount,
            "expires_at_ms": NOW_MS + 60_000,
            "nonce": 420_001,
            "tithe_bp": tithe_bp,
            "outputs": outputs,
        })
    }

    fn signed_offer(f: &Fixture, body: Value) -> Value {
        let sig = envelope::sign_envelope(
            SigAlg::MlDsa44,
            &f.seller_kid,
            &f.seller_seed,
            &canonical(&body),
        )
        .unwrap();
        json!({ "kind": "x402.offer/1", "offer": body, "seller_sig": sig })
    }

    fn policy_doc(f: &Fixture) -> Value {
        json!({
            "payer": "membertest11",
            "remaining_budget_atomic": 50_000,
            "asset": { "symbol": "A", "precision": 4 },
            "now_ms": NOW_MS,
            "allowlist": [{
                "pay_to": "sellertest11",
                "rail": "vaulta",
                "seller_key_id": "seller-key-1",
                "seller_vk_b64u": b64u(&f.seller_vk),
            }],
        })
    }

    fn policy(f: &Fixture) -> Policy {
        parse_policy(&policy_doc(f)).unwrap().0
    }

    #[test]
    fn happy_path_signs_one_instruction_covering_the_split() {
        let f = fixture();
        let doc = signed_offer(&f, offer_body(6_000, 1_000));
        let instruction = gate(&doc, &policy(&f)).unwrap();
        assert_eq!(instruction["kind"], "exact-multi/1");
        assert_eq!(instruction["memo"], "x402:420001");
        assert_eq!(instruction["payer"], "membertest11");
        let outs = instruction["outputs"].as_array().unwrap();
        assert_eq!(outs.len(), 2, "seller + tithe in ONE instruction");
        assert_eq!(outs[0]["amount_atomic"], 5_400);
        assert_eq!(outs[1]["amount_atomic"], 600);
        // ONE signature over the whole body, verified offline
        let sig = envelope::sign_envelope(
            SigAlg::MlDsa44,
            "member-key",
            &f.payer_seed,
            &canonical(&instruction),
        )
        .unwrap();
        let payment = json!({ "instruction": instruction, "signature": sig });
        assert!(verify_payment(&payment, &f.payer_vk).is_ok());
    }

    #[test]
    fn canonical_bytes_are_deterministic() {
        let a = canonical(&offer_body(6_000, 1_000));
        let b = canonical(&offer_body(6_000, 1_000));
        assert_eq!(
            a, b,
            "same document, same bytes — a verifier recomputes them"
        );
        // key order in the source document must not matter
        let mut shuffled = offer_body(6_000, 1_000);
        let obj = shuffled.as_object_mut().unwrap();
        let rail = obj.remove("rail").unwrap();
        obj.insert("rail".into(), rail);
        assert_eq!(
            canonical(&shuffled),
            a,
            "key insertion order does not change canonical bytes"
        );
    }

    #[test]
    fn destination_not_allowlisted_refused_before_signing() {
        let f = fixture();
        let mut body = offer_body(6_000, 1_000);
        body["pay_to"] = json!("strangerac11");
        // sign with the pinned seller key anyway — destination is the refusal
        let doc = signed_offer(&f, body);
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("not allowlisted"), "{err}");
    }

    #[test]
    fn stranger_seller_key_refused_even_for_allowlisted_destination() {
        let f = fixture();
        let body = offer_body(6_000, 1_000);
        // re-point the payout to the allowlisted seller but sign as someone else
        let other = dsa_generate(SigAlg::MlDsa44);
        let sig = envelope::sign_envelope(
            SigAlg::MlDsa44,
            "impostor-key",
            &Zeroizing::new(other.seed),
            &canonical(&body),
        )
        .unwrap();
        let doc = json!({ "kind": "x402.offer/1", "offer": body, "seller_sig": sig });
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("the member pinned"), "{err}");
    }

    #[test]
    fn tampered_offer_body_fails_the_pinned_signature() {
        let f = fixture();
        let mut doc = signed_offer(&f, offer_body(6_000, 1_000));
        doc["offer"]["amount_atomic"] = json!(1); // price swapped after signing
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("seller signature invalid"), "{err}");
    }

    #[test]
    fn unsigned_offer_refused() {
        let f = fixture();
        let doc = json!({ "kind": "x402.offer/1", "offer": offer_body(6_000, 1_000) });
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("no seller signature"), "{err}");
    }

    #[test]
    fn expired_offer_refused() {
        let f = fixture();
        let mut body = offer_body(6_000, 1_000);
        body["expires_at_ms"] = json!(NOW_MS - 1);
        let doc = signed_offer(&f, body);
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("offer expired"), "{err}");
    }

    #[test]
    fn over_per_signature_cap_refused_before_signing() {
        let f = fixture();
        let doc = signed_offer(&f, offer_body(50_000, 0)); // > default cap 10_000
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("over per-signature cap"), "{err}");
    }

    #[test]
    fn over_remaining_budget_refused_before_signing() {
        let f = fixture();
        let mut pdoc = policy_doc(&f);
        pdoc["per_signature_cap_atomic"] = json!(100_000); // member raised the cap…
        pdoc["remaining_budget_atomic"] = json!(10_000); // …but the budget says no
        let p = parse_policy(&pdoc).unwrap().0;
        let doc = signed_offer(&f, offer_body(50_000, 0));
        let err = gate(&doc, &p).unwrap_err();
        assert!(err.contains("over remaining budget"), "{err}");
    }

    #[test]
    fn asset_mismatch_refused() {
        let f = fixture();
        let mut body = offer_body(6_000, 1_000);
        body["asset"] = json!({"symbol": "USDC", "precision": 6});
        let doc = signed_offer(&f, body);
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("asset"), "{err}");
    }

    #[test]
    fn split_not_summing_to_amount_refused() {
        let f = fixture();
        let mut body = offer_body(6_000, 1_000);
        body["outputs"][0]["amount_atomic"] = json!(5_000); // now sums to 5_600
        let doc = signed_offer(&f, body);
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("outputs sum"), "{err}");
    }

    #[test]
    fn lying_tithe_output_refused() {
        let f = fixture();
        let mut body = offer_body(6_000, 1_000);
        body["outputs"][1]["amount_atomic"] = json!(1_200); // 20% tithe on a 10% offer
                                                            // keep the sum honest so ONLY the tithe invariant can catch it
        body["outputs"][0]["amount_atomic"] = json!(4_800);
        let doc = signed_offer(&f, body);
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("tithe output"), "{err}");
    }

    #[test]
    fn payer_as_output_refused() {
        let f = fixture();
        let mut body = offer_body(6_000, 1_000);
        body["outputs"][1] = json!({
            "to": "membertest11", "amount_atomic": 600, "role": "tithe"
        });
        let doc = signed_offer(&f, body);
        let err = gate(&doc, &policy(&f)).unwrap_err();
        assert!(err.contains("feePayer must not be an output"), "{err}");
    }

    #[test]
    fn unknown_third_destination_refused() {
        let f = fixture();
        let mut body = offer_body(6_000, 0);
        body["outputs"]
            .as_array_mut()
            .unwrap()
            .push(json!({ "to": "quietthirdac", "amount_atomic": 0, "role": "tithe" }));
        let doc = signed_offer(&f, body);
        let err = gate(&doc, &policy(&f)).unwrap_err();
        // 0-amount tithe on tithe_bp=0, or the stranger check — either named refusal is a refusal
        assert!(err.starts_with("split invariant:"), "{err}");
    }

    #[test]
    fn zero_amount_and_zero_budget_refuse() {
        let f = fixture();
        let doc = signed_offer(&f, offer_body(0, 0));
        assert!(gate(&doc, &policy(&f)).unwrap_err().contains("zero-amount"));
        let mut pdoc = policy_doc(&f);
        pdoc["remaining_budget_atomic"] = json!(0);
        let p = parse_policy(&pdoc).unwrap().0;
        let doc = signed_offer(&f, offer_body(6_000, 0));
        assert!(gate(&doc, &p)
            .unwrap_err()
            .contains("over remaining budget"));
    }

    #[test]
    fn default_cap_applies_when_policy_omits_it() {
        let f = fixture();
        let (p, used_default) = parse_policy(&policy_doc(&f)).unwrap();
        assert!(used_default);
        assert_eq!(p.per_signature_cap_atomic, DEFAULT_PER_SIGNATURE_CAP_ATOMIC);
    }

    #[test]
    fn verify_payment_catches_post_signature_tamper() {
        let f = fixture();
        let doc = signed_offer(&f, offer_body(6_000, 1_000));
        let instruction = gate(&doc, &policy(&f)).unwrap();
        let sig = envelope::sign_envelope(
            SigAlg::MlDsa44,
            "member-key",
            &f.payer_seed,
            &canonical(&instruction),
        )
        .unwrap();
        let mut payment = json!({ "instruction": instruction, "signature": sig });
        payment["instruction"]["outputs"][0]["amount_atomic"] = json!(5_999); // shave the seller
        assert!(verify_payment(&payment, &f.payer_vk).is_err());
    }

    #[test]
    fn seed_never_appears_in_gate_output() {
        let f = fixture();
        let doc = signed_offer(&f, offer_body(6_000, 1_000));
        let instruction = gate(&doc, &policy(&f)).unwrap();
        let text = instruction.to_string();
        assert!(
            !text.contains(&b64u(f.seller_seed.as_slice())),
            "seller seed leaked into the instruction"
        );
        assert!(
            !text.contains(&b64u(f.payer_seed.as_slice())),
            "payer seed leaked into the instruction"
        );
    }
}
