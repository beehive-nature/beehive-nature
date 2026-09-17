// invoice-from-quote — Phase A builder: the REAL bridge prepare response flows
// MECHANICALLY into a generic INVOICE-1 invoice. Nothing here retypes a figure:
// every identity field is read from the prepare artifact (the bridge hashed the
// file itself), every ANT atom is a carried {quote_hash, amount_atto} pair, and
// the single pinned constant below exists only as a REFUSAL gate — a prepare
// bound to any other artifact fails hard.
//
//   node scripts/bpay-mvp/invoice-from-quote.mjs <prepare-response.json> [--out surfaces/bpay-invoice.json]
//   node scripts/bpay-mvp/invoice-from-quote.mjs --selftest   (synthetic fixture, labelled)
import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGenericInvoice, validateGenericInvoice, contentDigest } from '../lib/bpay-invoice-generic.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// The docket's machine-verified identity tuple (intake 2026-09-17, PR #102):
// refusal pins — a prepare response that does not match BOTH is rejected.
const PIN_SHA256 = "338b486874f6a8f86afe6537143548fb99594038b9ee7de918794db9e744207e"; // PUBLIC-CONSTANT: intake-pinned sha256, Bux community video identity
const PIN_BYTES = 214091829;

// Display attribution carried from the intake card (receipt §3) — metadata,
// never part of the binding identity (which is sha256+bytes above).
const MEDIA = {
  title: "Autonomi — WebRTC Direct in-browser demo",
  creator: "Bux · Autonomi community update, 2026-09-17",
  filename: "try_autonomi.mp4",
};

function fail(msg) { throw new Error("invoice-from-quote: REFUSED — " + msg); }

function attoToAnt(atto) {
  const n = BigInt(atto);
  const whole = n / 10n ** 18n;
  const frac = (n % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function invoiceFromPrepare(prepare, obtainedAt) {
  if (!prepare || typeof prepare !== 'object') fail("prepare response required");
  if (prepare.artifact_sha256 !== PIN_SHA256) fail(`artifact_sha256 ${prepare.artifact_sha256} is not the pinned intake artifact`);
  if (prepare.artifact_bytes !== PIN_BYTES) fail(`artifact_bytes ${prepare.artifact_bytes} ≠ pinned ${PIN_BYTES}`);

  // carried quote set — wave arm (payments[]) today; merkle arm when the
  // network routes a ≥64-chunk upload (merkle_batches[]). Both are contract
  // inputs the invoice must carry verbatim.
  const quotes = [];
  const payments = prepare.payments || [];
  for (const p of payments) {
    if (!/^0x[0-9a-fA-F]+$/.test(p.quote_hash || '')) fail("payment entry without quote_hash");
    if (!/^\d+$/.test(String(p.amount_atto || ''))) fail("payment entry without decimal amount_atto");
    quotes.push({ quote_hash: p.quote_hash, amount_atto: String(p.amount_atto) });
  }
  if (prepare.merkle_batches && prepare.merkle_batches.length) {
    fail("merkle_batches present — extend the builder for the merkle arm before invoicing (do not guess)");
  }
  if (!quotes.length) fail("no carried quotes in the prepare response");
  const totalAtto = quotes.reduce((s, q) => s + BigInt(q.amount_atto), 0n).toString();
  if (prepare.total_amount_atto && prepare.total_amount_atto !== totalAtto) {
    fail(`quote sum ${totalAtto} ≠ prepare total ${prepare.total_amount_atto}`);
  }

  const invoice = buildGenericInvoice({
    jobId: "bux-try-autonomi-2026-09-17",
    issuedAt: obtainedAt,
    lines: [{
      kind: "storage",
      asset: "ANT",
      quotes,
      ceilingAtto: totalAtto, // exact quoted amount — never unlimited (SPEC-AUTONOMI-TREZOR-1 §2)
    }],
    authorization: {
      ceilings: { ANT: totalAtto },
      authorizedBy: "founder — through the product surface only (Founder Gesture UX Law)",
      stopConditions: [
        "quote set superseded or consumed (single-use)",
        "artifact sha256/bytes mismatch at upload time",
        "payment shape change (wave↔merkle re-quote)",
      ],
    },
    expiration: {
      model: "quote-single-use",
      note: "network quotes are single-use and short-lived; this exact set is persisted on the keyless bridge for this upload (crash-recovery law — re-prepare of the same artifact returns the SAME quote hashes)",
    },
    domain: {
      network: "autonomi-mainnet",
      artifact: { name: MEDIA.filename, sha256: prepare.artifact_sha256, bytes: prepare.artifact_bytes },
      media: { title: MEDIA.title, creator: MEDIA.creator },
      payment_type: prepare.payment_type,
      chunks: { total: prepare.total_chunks, already_stored: prepare.already_stored ?? 0 },
      quote: {
        obtained_at: obtainedAt,
        provider: "antd-bridge (keyless prepare; ant-core git HEAD)",
        confidence: "measured-live-network",
        upload_id: prepare.upload_id,
        durable_reload: true,
      },
      gas: {
        asset: "ETH",
        estimated_wei: null,
        source: "wallet-side",
        note: "Arbitrum One native gas for approve + payForQuotes, paid from the founder's wallet at signing — SEPARATE from the ANT storage obligation; never collapsed (assets-separate law)",
      },
      data_map_address: prepare.data_map_address || null,
      policy: {
        // founder rider 2026-09-17: sharing choice is FIRST-CLASS, before quote.
        // This block records the policy the quote ACTUALLY bound (machine fact:
        // the bridge prepared with Visibility::Public) — it is the resolved
        // policy on the receipt, never a button label. The founder's selection
        // gesture belongs to the chooser surface (Phase B); an agent never
        // infers it. Presets (public/private/cypherpunk) are one policy object.
        preset: "public",
        resolved_by: "antd-bridge prepare (Visibility::Public) — quoted plan",
        selector: "founder UI gesture — chooser surface chartered Phase B; not yet exercised",
        access: "anyone who obtains the Autonomi address can retrieve the artifact",
        encryption: "network self-encryption at rest is storage mechanics, not owner-controlled privacy; in public mode the address itself is the capability",
        forgettability: "immutable once stored — deletion cannot honestly be promised",
      },
      trezor_ux: {
        shape: prepare.payment_type,
        expected_confirmations: quotes.length, // wave: one confirmation per quote — printed per SPEC-AUTONOMI-TREZOR-1 §1
        note: "wave mode is hostile to hardware wallets (per-quote confirmations); the surface must print the shape + exact count before any signing",
      },
    },
  });
  return invoice;
}

// ── hex-law serialization ───────────────────────────────────────────────────
// The artifact carries public chain identifiers (quote hashes, content sha256,
// the future data-map address, the digests) that are hex runs of 48+ —
// key-shaped to a scanner though public by construction. The estate's
// sanctioned mechanism is the same-line PUBLIC-CONSTANT marker; canonical
// JSON has no comments, but JSON whitespace is insignificant, so each
// hex-valued key gets a `scan` sibling INSIDE the object (before the content
// digest is computed — the digest covers it) and the serializer keeps the
// pair on ONE physical line. No marker is ever injected at serialization
// time: a hex leaf without its in-object sibling FAILS CLOSED, because a
// file-only marker would change the parsed document and break digest
// re-verification. A dockets-style path exemption may be ruled later; until
// then the marker law is satisfied line-by-line.
const SCAN_HEX = /[0-9a-fA-F]{48,}/;
const SCAN_MARK = 'PUBLIC-CONSTANT';

function markAfter(o, hexKey, why) {
  if (!o || typeof o[hexKey] !== 'string' || !SCAN_HEX.test(o[hexKey])) return;
  const entries = Object.entries(o).filter(([k]) => k !== 'scan');
  const idx = entries.findIndex(([k]) => k === hexKey);
  entries.splice(idx + 1, 0, ['scan', `${SCAN_MARK}: ${why}`]);
  for (const k of Object.keys(o)) delete o[k];
  Object.assign(o, Object.fromEntries(entries));
}

function decorate(doc) {
  for (const line of doc.lines) for (const q of line.quotes) markAfter(q, 'quote_hash', 'public on-chain payment quote id');
  markAfter(doc.domain?.artifact || {}, 'sha256', 'public content sha256 pin');
  markAfter(doc.domain || {}, 'data_map_address', 'public self-encrypted data-map address');
  markAfter(doc.commitment || {}, 'digest', 'public commitment digest over the carried quote set');
  markAfter(doc.identity || {}, 'contentDigest', 'public content-addressed identity digest');
  return doc;
}

function serialize(doc) {
  const val = (v, pad) => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) {
      const items = v.map((x) => val(x, pad));
      return items.some((s) => s.includes('\n')) || items.join(',').length > 96
        ? '[\n' + items.map((s) => pad + ' ' + s).join(',\n') + '\n' + pad + ']'
        : '[' + items.join(', ') + ']';
    }
    const entries = Object.entries(v);
    const out = [];
    for (let i = 0; i < entries.length; i++) {
      const [k, x] = entries[i];
      if (typeof x === 'string' && SCAN_HEX.test(x)) {
        const next = entries[i + 1];
        if (!(next && next[0] === 'scan' && typeof next[1] === 'string' && next[1].startsWith(SCAN_MARK)))
          throw new Error(`hex key "${k}" has no in-object scan marker — refuse to serialize (digest consistency law)`);
        out.push(`"${k}": ${JSON.stringify(x)}, "scan": ${JSON.stringify(next[1])}`); // the marker rides the hex's own line
        i++;
      } else {
        out.push(`"${k}": ${val(x, pad + ' ')}`);
      }
    }
    return out.length ? '{\n' + out.map((s) => pad + ' ' + s).join(',\n') + '\n' + pad + '}' : '{}';
  };
  return val(doc, '') + '\n';
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) { try { return await selftest(); } catch (e) { console.error(e.message); process.exit(1); } }

  const input = argv.find(a => !a.startsWith('--'));
  if (!input) { console.error("usage: invoice-from-quote.mjs <prepare-response.json> [--out <path>]"); process.exit(1); }
  const outIdx = argv.indexOf('--out');
  const out = outIdx >= 0 ? argv[outIdx + 1] : join(HERE, '..', '..', 'surfaces', 'bpay-invoice.json');

  let prepare, obtainedAt, invoice;
  try {
    prepare = JSON.parse(await readFile(input, 'utf8'));
    // machine timestamp: the prepare response file's own mtime — the moment the
    // network answered. Never retyped.
    obtainedAt = (await stat(input)).mtime.toISOString();
    invoice = invoiceFromPrepare(prepare, obtainedAt);
  } catch (e) { console.error(e.message); process.exit(1); }
  // hex-law pass: scan markers join the object BEFORE the digest is recomputed
  // (the digest covers them; a file-only marker would break re-verification)
  invoice = decorate(invoice);
  invoice.identity.contentDigest = contentDigest(invoice);

  const problems = validateGenericInvoice(invoice, { requireCore: true });
  if (problems && problems.length) { console.error("invoice-from-quote: REFUSED — built invoice failed INVOICE-1 validation: " + problems.join('; ')); process.exit(1); }

  await writeFile(out, serialize(invoice));
  const ant = invoice.lines.find(l => l.asset === 'ANT');
  console.log(JSON.stringify({
    ok: true,
    out,
    job: invoice.identity.jobId,
    artifact: invoice.domain.artifact,
    quotes: ant.quotes.length,
    owed_ant: attoToAnt(ant.amountAtto),
    owed_atto: ant.amountAtto,
    commitment: invoice.commitment.digest,
    payment_type: invoice.domain.payment_type,
    data_map_address: invoice.domain.data_map_address,
    obtained_at: invoice.domain.quote.obtained_at,
  }));
}

// selftest — a SYNTHETIC (labelled, never-measured) minimal prepare shape,
// exercising the mechanical binding + refusal gates without the network.
async function selftest() {
  const mk = (sha, bytes, quotes) => ({
    upload_id: 'up-selftest', artifact_sha256: sha, artifact_bytes: bytes,
    total_chunks: quotes, already_stored: 0, payment_type: 'wave_batch',
    total_amount_atto: null, payments: Array.from({ length: quotes }, (_, i) => ({
      quote_hash: '0x' + (i + 1).toString().padStart(4, '0') + 'ab'.repeat(14),
      rewards_address: '0x0000000000000000000000000000000000000001',
      amount_atto: '1000000000000000000',
    })), note: 'SELFTEST-SYNTHETIC',
  });
  let passed = 0, failed = 0;
  const t = (name, fn) => { try { fn(); passed++; console.log('✓ ' + name); } catch (e) { failed++; console.log('✗ ' + name + ' — ' + e.message); } };

  const good = invoiceFromPrepare(mk(PIN_SHA256, PIN_BYTES, 3), '2026-09-17T00:00:00.000Z');
  t('builds a valid invoice from a matching prepare', () => {
    const ant = good.lines.find(l => l.asset === 'ANT');
    if (ant.amountAtto !== '3000000000000000000') throw new Error('sum wrong: ' + ant.amountAtto);
    if (good.domain.artifact.sha256 !== PIN_SHA256) throw new Error('identity not carried');
  });
  t('REFUSES a prepare for a different artifact (sha)', () => {
    let threw = false;
    try { invoiceFromPrepare(mk('0x' + 'deadbeef'.repeat(8), PIN_BYTES, 2), 'x'); } catch { threw = true; }
    if (!threw) throw new Error('accepted');
  });
  t('REFUSES a prepare with wrong byte count', () => {
    let threw = false;
    try { invoiceFromPrepare(mk(PIN_SHA256, PIN_BYTES - 1, 2), 'x'); } catch { threw = true; }
    if (!threw) throw new Error('accepted');
  });
  t('REFUSES a quote-sum mismatch vs prepare total', () => {
    const m = mk(PIN_SHA256, PIN_BYTES, 2);
    m.total_amount_atto = '999';
    let threw = false;
    try { invoiceFromPrepare(m, 'x'); } catch { threw = true; }
    if (!threw) throw new Error('accepted');
  });
  t('carries exact ceiling (never unlimited)', () => {
    if (good.authorization.ceilings.ANT !== '3000000000000000000') throw new Error('ceiling drifted');
  });
  console.log(failed ? `SELFTEST: ${failed} FAILED of ${passed + failed}` : `SELFTEST: GREEN ${passed}/${passed}`);
  process.exit(failed ? 1 : 0);
}

await main();
