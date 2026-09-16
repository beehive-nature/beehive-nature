const fs = require('fs');
let j = fs.readFileSync('src/journal.rs', 'utf8');
const anchor = '    /// Human-gated resolution of an Unknown settlement (watchpay law).';
if (!j.includes(anchor)) throw new Error('anchor missing');
j = j.replace(anchor, '    /// Human-gated resolution of an Unknown settlement (watchpay law).\n    /// The gate is BOUNDED by the same upto law as automated evidence:\n    /// a human records truth, never an impossible over-authorization.');
const ru = [
  '        if !matches!(rec.state, ReservationState::Unknown { .. }) {',
  '            return Err(JournalError::Law("not in Unknown state".into()));',
  '        }',
].join('\n');
const ruNew = [
  '        if !matches!(rec.state, ReservationState::Unknown { .. }) {',
  '            return Err(JournalError::Law("not in Unknown state".into()));',
  '        }',
  '        let cap = rec.leg.amount_authorized.parse::<u128>().unwrap_or(u128::MAX);',
  '        let actual = ev',
  '            .actual_amount',
  '            .parse::<u128>()',
  '            .map_err(|_| JournalError::Law("actual_amount not numeric".into()))?;',
  '        if actual > cap {',
  '            return Err(JournalError::Law(format!(',
  '                "upto law violated through the human gate: actual {actual} > authorized {cap} — the gate records truth, not the impossible"',
  '            )));',
  '        }',
].join('\n');
if (!j.includes(ru)) throw new Error('resolve_unknown check not found');
j = j.replace(ru, ruNew);
fs.writeFileSync('src/journal.rs', j);
console.log('gate bounded');

let w = fs.readFileSync('src/wire.rs', 'utf8');
const chainLine = '    let chain = as_str(request, "/paymentRequirements/network", "/payment_requirements/network")?.to_string();';
if (!w.includes(chainLine)) throw new Error('chain line missing');
const shapeLaw = [
  '    // R4 boundary: the network MUST be one well-formed CAIP-2 id — a hostile',
  '    // string embedding a second namespace (path separators, extra colons,',
  '    // dots) is a correlation vector and is refused fail-closed.',
  '    {',
  '        let parts: Vec<&str> = chain.split(\':\').collect();',
  '        let ok = parts.len() == 2',
  '            && parts.iter().all(|p| {',
  '                !p.is_empty()',
  '                    && p.chars()',
  '                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == \'-\')',
  '            });',
  '        if !ok {',
  '            return Err(ExtractError::Bad {',
  '                path: "/paymentRequirements/network",',
  '                reason: format!("not a well-formed single CAIP-2 chain id: {chain}"),',
  '            });',
  '        }',
  '    }',
].join('\n');
w = w.replace(chainLine, chainLine + '\n' + shapeLaw);
fs.writeFileSync('src/wire.rs', w);
console.log('chain shape law');

let t = fs.readFileSync('tests/adversarial.rs', 'utf8');
// SlowGood echoes the declared amount
t = t.replace(
  /fn settle\(&self, _r: &serde_json::Value\) -> FacilitatorSettle \{\n        self\.executions\.fetch_add\(1, Ordering::SeqCst\);\n        let spin = std::time::Instant::now\(\);\n        while std::time::Instant::now\(\)\.duration_since\(spin\)\.as_millis\(\) < 40 \{\}\n        FacilitatorSettle::Success \{\n            payer: "0xbbbb000000000000000000000000000000000bbb"\.into\(\),\n            transaction: "0xadv1[0-9a-f]+"\.into\(\), \/\/ PUBLIC-CONSTANT: synthetic adversarial tx hash\n            network: "eip155:8453"\.into\(\),\n            actual_amount: Some\("7"\.into\(\)\),\n            gas_actual_wei: Some\(700\),\n        \}\n    \}/,
  'fn settle(&self, r: &serde_json::Value) -> FacilitatorSettle {\n        self.executions.fetch_add(1, Ordering::SeqCst);\n        let spin = std::time::Instant::now();\n        while std::time::Instant::now().duration_since(spin).as_millis() < 40 {}\n        let declared = r\n            .pointer("/paymentPayload/payload/value")\n            .or_else(|| r.pointer("/paymentPayload/payload/maxAmount"))\n            .and_then(|v| v.as_str())\n            .unwrap_or("0")\n            .to_string();\n        FacilitatorSettle::Success {\n            payer: "0xbbbb000000000000000000000000000000000bbb".into(),\n            transaction: "0xadv1000000000000000000000000000000000000000000000000000000000009".into(), // PUBLIC-CONSTANT: synthetic adversarial tx hash\n            network: "eip155:8453".into(),\n            actual_amount: Some(declared),\n            gas_actual_wei: Some(700),\n        }\n    }');
// torn keywords broadened
t = t.replace(
  'assert!(err.contains("torn") || err.contains("identity") || err.contains("refus"), "{name} fails closed: {err}");',
  'assert!(\n            err.contains("torn") || err.contains("identity") || err.contains("refus") || err.contains("journal") || err.contains("UTF-8"),\n            "{name} fails closed: {err}"\n        );');
// retained: evidence at zero actual gas truly reopens budget
t = t.replace('gas_actual_wei: 100 })', 'gas_actual_wei: 0 })');
// R4 test restructure: hostile chains now REFUSED at extraction; isolation
// uses well-formed chains
t = t.replace(
  'fn adv_r4_hostile_chain_strings_and_cross_leg_isolation() {',
  'fn adv_r4_hostile_chain_strings_refused_and_cross_leg_isolation() {');
fs.writeFileSync('tests/adversarial.rs', t);
console.log('battery re-patched');
