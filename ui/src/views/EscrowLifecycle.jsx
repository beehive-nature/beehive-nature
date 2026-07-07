// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react'
import fixtures from '../fixture.js'
import { iso, show, sum } from '../format.js'

const s1 = fixtures.scenario_1_happy_path
const order = s1.steps[0].event.payload.data

// escrow-core state-enum names — schema vocabulary, not fixture data.
// Terminal success reads green; in-flight transitions read blue;
// refusals read violet (a feature, not an error state).
const TONE = { Completed: 'green' }

const ORDER_KEYS = [
  'order_id',
  'buyer_did',
  'seller_did',
  'amount',
  'asset_id',
  'escrow_wallet_id',
  'carrier',
  'tracking',
]

function RefusalBlock({ refusal, escrowState }) {
  const rows = [
    { lbl: 'asset', provided: refusal.asset_provided, required: refusal.asset_required },
    { lbl: 'zano', provided: refusal.zano_provided, required: refusal.zano_required },
  ]
  return (
    <div className="refusal">
      <p className="refusal-title">Guard refusal · InsufficientFunding</p>
      {rows.map((r) => {
        const met = r.provided >= r.required
        return (
          <div className="refusal-row" key={r.lbl}>
            <span className="lbl">{r.lbl}</span>
            <span>
              {r.lbl}_provided {r.provided} · {r.lbl}_required {r.required}
            </span>
            <span className={'chip ' + (met ? 'chip-green' : 'chip-violet')}>
              {met ? '✓ met' : '✗ short'}
            </span>
          </div>
        )
      })}
      <p className="refusal-note">
        escrow_state remains {escrowState} — the dual-balance funding check held.
      </p>
    </div>
  )
}

export default function EscrowLifecycle() {
  const payoutAmounts = s1.settlement.payouts.map((p) => p.amount)
  const payoutTotal = sum(payoutAmounts)
  const reconciles = payoutTotal === order.amount

  return (
    <section data-screen-label="Escrow lifecycle">
      <div className="view-head">
        <h2>Scenario 1 — happy path</h2>
        <p className="path">
          scenario_1_happy_path · {s1.steps.length} steps · {s1.settlement.payouts.length}{' '}
          settlement leg{s1.settlement.payouts.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="card">
        <h3>Order</h3>
        <p className="path">scenario_1_happy_path.steps[0].event.payload.data</p>
        <div className="kv">
          {ORDER_KEYS.map((k) => (
            <div key={k}>
              <div className="k">{k}</div>
              <div className="v">{show(order[k])}</div>
            </div>
          ))}
        </div>
      </div>

      <ol className="timeline">
        {s1.steps.map((step) => {
          const e = step.event
          const o = step.outcome
          const refusal = o.refused ? o.refused.InsufficientFunding : null
          const tone = refusal
            ? 'violet'
            : o.transition
              ? (TONE[o.transition] ?? 'blue')
              : 'gray'
          const rows = [
            ['event_id', e.event_id],
            ['timestamp', e.timestamp + ' · ' + iso(e.timestamp)],
            ['source_chain', e.source_chain],
            ['source_ref', e.source_ref],
            ['canonicalized_by', e.canonicalized_by],
            ['payload.amount', show(e.payload.data.amount)],
            ['payload.fee_buffer_zano', show(e.payload.data.fee_buffer_zano)],
          ]
          return (
            <li key={e.event_id} className={'step tone-' + tone}>
              <span className="dot" aria-hidden="true"></span>
              <div className="card">
                <div className="step-head">
                  <span className="etype">{e.event_type.type}</span>
                  {refusal ? (
                    <span className="chip chip-violet">refused · InsufficientFunding</span>
                  ) : o.transition ? (
                    <span className={'chip chip-' + tone}>→ {o.transition}</span>
                  ) : (
                    <span className="chip chip-gray">escrow_state: {o.escrow_state}</span>
                  )}
                  {o.ignored_by_engine && (
                    <span className="chip chip-outline">ignored_by_engine: true</span>
                  )}
                </div>
                <div className="kv">
                  {rows.map(([k, v]) => (
                    <div key={k}>
                      <div className="k">{k}</div>
                      <div className="v">{v}</div>
                    </div>
                  ))}
                </div>
                {refusal && <RefusalBlock refusal={refusal} escrowState={o.escrow_state} />}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Settlement</h3>
        <p className="path">scenario_1_happy_path.settlement</p>
        <div className="recon" style={{ marginTop: 10 }}>
          {s1.settlement.payouts.map((p) => (
            <div className="recon-line" key={p.to}>
              <span className="chip chip-green">→ {p.to}</span>
              <span>{p.amount}</span>
            </div>
          ))}
          <div className="recon-line">
            <span className="op">sum(payouts.amount)</span>
            <span>{payoutAmounts.join(' + ')} = {payoutTotal}</span>
            <span className="op">· escrowed payload.amount = {order.amount}</span>
            <span className={'chip ' + (reconciles ? 'chip-green' : 'chip-magenta')}>
              {reconciles ? '✓ reconciles' : '✗ does not reconcile'}
            </span>
          </div>
          <div className="recon-line">
            <span className="op">signed_by</span>
            <span>{s1.settlement.signed_by}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
