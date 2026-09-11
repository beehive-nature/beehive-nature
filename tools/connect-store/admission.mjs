import { LIMITS } from './core.mjs';
import { requireThat } from './core.mjs';

// Synthetic payment/admission boundary. This module NEVER pays, signs, or
// uploads: it quotes the complete cost of a proposed mutation, enforces a
// hard operator ceiling against a cumulative ledger, and refuses the
// mutation before any store write when the budget does not fit. Real
// Autonomi writes stay disabled (AutonomiReadStore.put refuses) and Trezor
// approval stays downstream: an admitted receipt records
// approval: 'pending-trezor-downstream' and signed: false.

// antd 0.12.0 REST: POST /v1/data/cost {data: base64, payment_mode} ->
// {cost: string, file_size, chunk_count, estimated_gas_cost_wei, payment_mode}.
// Source: WithAutonomi/ant-sdk v0.12.0 antd-js/src/rest-client.ts dataCost.
// The endpoint is a sampled extrapolation; a quote is an estimate, and this
// source therefore only FEEDS the enforcing gate below — it is never
// admission by itself.
export class AntdQuoteSource {
  constructor(http) { requireThat(http && typeof http.request === 'function', 'invalid-quote-http'); this.http = http; }
  async quote(label, bytes) {
    requireThat(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= LIMITS.snapshot + 64, 'invalid-quote-input');
    const result = await this.http.request('POST', '/v1/data/cost',
      { data: bytes.toString('base64'), payment_mode: 'Auto' }, LIMITS.checkpoint);
    requireThat(result && typeof result === 'object' && !Array.isArray(result)
      && typeof result.cost === 'string' && typeof result.estimated_gas_cost_wei === 'string'
      && Number.isSafeInteger(result.chunk_count) && result.chunk_count >= 0
      && Number.isSafeInteger(result.file_size) && result.file_size === bytes.length,
    'invalid-quote-response');
    // Non-negative decimal strings only: a malformed amount fails closed
    // with the validation code instead of a raw BigInt SyntaxError.
    requireThat(/^[0-9]+$/.test(result.cost) && /^[0-9]+$/.test(result.estimated_gas_cost_wei),
      'invalid-quote-response');
    const cost = BigInt(result.cost);
    const gas = BigInt(result.estimated_gas_cost_wei);
    requireThat(cost >= 0n && gas >= 0n, 'invalid-quote-response');
    return { label, bytes: bytes.length, cost, gas, chunks: result.chunk_count };
  }
}

// Deterministic offline quote: content-independent linear rate plus a
// per-chunk overhead, mirroring chunked storage economics without any
// network. Same units as AntdQuoteSource (cost/gas as BigInt "nano" units).
export class SyntheticQuoteSource {
  constructor({ byteRate = 1n, chunkSize = 4096, chunkOverhead = 16n, recordOverhead = 64n } = {}) {
    requireThat(typeof byteRate === 'bigint' && byteRate >= 0n && typeof chunkOverhead === 'bigint' && chunkOverhead >= 0n
      && typeof recordOverhead === 'bigint' && recordOverhead >= 0n
      && Number.isSafeInteger(chunkSize) && chunkSize >= 1 && chunkSize <= LIMITS.snapshot, 'invalid-synthetic-quote');
    Object.assign(this, { byteRate, chunkSize, chunkOverhead, recordOverhead });
  }
  quote(label, bytes) {
    requireThat(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= LIMITS.snapshot + 64, 'invalid-quote-input');
    const chunks = Math.ceil(bytes.length / this.chunkSize);
    return { label, bytes: bytes.length, chunks,
      cost: BigInt(bytes.length) * this.byteRate + BigInt(chunks) * this.chunkOverhead + this.recordOverhead,
      gas: 0n };
  }
}

const MAX_CEILING = 10n ** 15n;   // a ceiling, not a wallet; bounds BigInt math

// Enforcing admission gate. Every admitted mutation reserves its COMPLETE
// quoted cost against a cumulative ledger for the gate's lifetime:
// the exact sealed-snapshot bytes plus the checkpoint and x0x notification
// budgeted at their validated caps (never under-budgeted), and an explicit
// admitted-retry factor (default 1: no retries admitted). Reservations are
// not refunded on later failure — a failed write has already spent the
// quote's risk. Nothing here signs or moves funds.
export class PaymentAdmissionGate {
  constructor({ quoteSource, ceiling, retriesAdmitted = 0, smallRecordBudget = LIMITS.checkpoint } = {}) {
    requireThat(quoteSource && typeof quoteSource.quote === 'function', 'invalid-quote-source');
    requireThat(typeof ceiling === 'bigint' && ceiling > 0n && ceiling <= MAX_CEILING, 'invalid-ceiling');
    requireThat(Number.isSafeInteger(retriesAdmitted) && retriesAdmitted >= 0 && retriesAdmitted <= 3, 'invalid-retry-budget');
    requireThat(Number.isSafeInteger(smallRecordBudget) && smallRecordBudget > 0
      && smallRecordBudget <= LIMITS.checkpoint, 'invalid-small-record-budget');
    this.quoteSource = quoteSource; this.ceiling = ceiling; this.retriesAdmitted = retriesAdmitted;
    this.smallRecordBudget = smallRecordBudget;
    this.remaining = ceiling;
    this.sequence = 0;
    this.receipts = [];   // bounded below; synthetic records, never signatures
  }

  // Budget a channel mutation: the exact sealed snapshot plus the two small
  // records (checkpoint, x0x notice) at their cap. Files ride inside the
  // encrypted snapshot, so uploads are covered by the same snapshot record.
  async checkMutation({ sealedSnapshot }) {
    requireThat(Buffer.isBuffer(sealedSnapshot) && sealedSnapshot.length > 0
      && sealedSnapshot.length <= LIMITS.snapshot + 28, 'invalid-mutation-budget');
    this.sequence += 1;
    const attempts = BigInt(1 + this.retriesAdmitted);
    const records = [];
    try {
      records.push(await this.quoteSource.quote('snapshot', sealedSnapshot));
      records.push(await this.quoteSource.quote('checkpoint', Buffer.alloc(this.smallRecordBudget, 1)));
      records.push(await this.quoteSource.quote('notification', Buffer.alloc(this.smallRecordBudget, 1)));
    } catch (err) {
      this.sequence -= 1;
      if (err.code === 'invalid-quote-response' || err.code === 'invalid-quote-input') throw err;
      throw Object.assign(new Error('quote-unavailable'), { code: 'quote-unavailable', status: 502 });
    }
    const perAttempt = records.reduce((sum, r) => sum + r.cost, 0n);
    const total = perAttempt * attempts;
    const deficit = total - this.remaining;
    if (deficit > 0n) {
      throw Object.assign(new Error('payment-admission-refused'), {
        code: 'payment-admission-refused', status: 429,
        admission: { sequence: this.sequence, records, per_attempt: String(perAttempt),
          total: String(total), ceiling: String(this.ceiling), remaining: String(this.remaining),
          deficit: String(deficit), retries_admitted: this.retriesAdmitted } });
    }
    this.remaining -= total;
    const receipt = { admitted: true, sequence: this.sequence,
      payment: 'synthetic-quote', funds_spent: '0', signed: false,
      approval: 'pending-trezor-downstream',
      records: records.map(r => ({ label: r.label, bytes: r.bytes, chunks: r.chunks, cost: String(r.cost) })),
      per_attempt: String(perAttempt), total: String(total), retries_admitted: this.retriesAdmitted,
      remaining: String(this.remaining) };
    this.receipts.push(receipt);
    if (this.receipts.length > 64) this.receipts.shift();   // bounded in-memory record
    return receipt;
  }
}
