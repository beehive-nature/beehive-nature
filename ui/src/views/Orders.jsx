// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react'
import fixtures, { FIXTURE_PIN } from '../fixture.js'
import HashChip from '../components/HashChip.jsx'
import { iso, pct, show, sum } from '../format.js'

// ── Composition law (T-4 dispatch) ──────────────────────────────────
// Subjects = distinct order_id values across ALL scenarios' steps; each
// order detail composes exclusively from its own order's events. In
// this fixture only scenario_1_happy_path carries steps; scenario_2's
// dispute cases carry no steps and no order_id, so they join to no
// order — attaching them to one would be mechanism invention.
//
// Q-D10 distinction (founder-ruled, stated per dispatch): the refusal
// exclusion governs IDENTITY surfaces — refused inputs attach to no
// DID profile. Refusals BELONG on this ORDER surface, in-timeline: a
// refusal is an order event, rendered exactly as T-1 renders it
// (violet, first-class, all four balance fields).

const scenarios = Object.entries(fixtures).filter(
  ([, v]) => v && typeof v === 'object' && Array.isArray(v.steps)
)

const orders = []
for (const [scenarioKey, sc] of scenarios) {
  sc.steps.forEach((step, index) => {
    const oid = step.event.payload.data.order_id
    let o = orders.find((x) => x.orderId === oid)
    if (!o) {
      o = { orderId: oid, scenarioKey, scenario: sc, firstIndex: index, steps: [] }
      orders.push(o)
    }
    o.steps.push(step)
  })
}

// escrow-core state-enum names — schema vocabulary, not fixture data
// (T-1 tone law: terminal success green, transitions blue, refusals
// violet — a feature, not an error state).
const TONE = { Completed: 'green' }

// Q-D8 (founder-ruled): timestamp 0 renders as labeled absence — never
// the 1970 epoch. Local copy of the standing treatment.
function Timestamp({ ts }) {
  if (ts === 0) {
    return (
      <span className="absent" title="no timestamp observed">
        —
      </span>
    )
  }
  return (
    <>
      {ts} · {iso(ts)}
    </>
  )
}

// T-1 refusal pattern, reused verbatim (local copy; the landed T-1
// file is not touched by this task).
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

export default function Orders() {
  return (
    <section data-screen-label="Orders">
      <div className="view-head">
        <h2>Orders — order detail</h2>
        <p className="path">
          subjects: distinct order_id over all scenarios' steps · {orders.length} order
          {orders.length === 1 ? '' : 's'}
        </p>
        <span className="stamp">fixtures @ {FIXTURE_PIN}</span>
      </div>

      {orders.map((o) => {
        const head = o.steps[0].event.payload.data
        const sc = o.scenario
        const payoutAmounts = sc.settlement ? sc.settlement.payouts.map((p) => p.amount) : []
        const payoutTotal = sum(payoutAmounts)
        const reconciles = payoutTotal === head.amount
        const hasDispute = Array.isArray(sc.evidence) && !!sc.verdict
        return (
          <article className="order" key={o.orderId} data-screen-label={'Order · ' + o.orderId}>
            <div className="case-head">
              <h3>{o.orderId}</h3>
              <span className="chip chip-gray">scenario: {o.scenarioKey}</span>
              <span className="chip chip-gray">{o.steps.length} events</span>
            </div>

            <div className="card">
              <h3>Order</h3>
              <p className="path">
                {o.scenarioKey}.steps[{o.firstIndex}].event.payload.data
              </p>
              <div className="kv">
                <div>
                  <div className="k">order_id</div>
                  <div className="v">{o.orderId}</div>
                </div>
                <div>
                  <div className="k">buyer_did</div>
                  <div className="v">
                    <HashChip hash={head.buyer_did} />
                  </div>
                </div>
                <div>
                  <div className="k">seller_did</div>
                  <div className="v">
                    <HashChip hash={head.seller_did} />
                  </div>
                </div>
                <div>
                  <div className="k">amount</div>
                  <div className="v">
                    {show(head.amount)} <span className="unit">{show(head.asset_id)} · raw atomic units</span>
                  </div>
                </div>
                <div>
                  <div className="k">escrow_wallet_id</div>
                  <div className="v">{show(head.escrow_wallet_id)}</div>
                </div>
                {'carrier' in head && (
                  <div>
                    <div className="k">carrier</div>
                    <div className="v">{show(head.carrier)}</div>
                  </div>
                )}
                {'tracking' in head && (
                  <div>
                    <div className="k">tracking</div>
                    <div className="v">{show(head.tracking)}</div>
                  </div>
                )}
              </div>
            </div>

            <ol className="timeline">
              {o.steps.map((step) => {
                const e = step.event
                const out = step.outcome
                const refusal = out.refused ? out.refused.InsufficientFunding : null
                const tone = refusal ? 'violet' : out.transition ? (TONE[out.transition] ?? 'blue') : 'gray'
                const rows = [
                  ['event_id', e.event_id],
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
                        ) : out.transition ? (
                          <span className={'chip chip-' + tone}>→ {out.transition}</span>
                        ) : (
                          <span className="chip chip-gray">escrow_state: {out.escrow_state}</span>
                        )}
                        {out.ignored_by_engine && (
                          <span className="chip chip-outline">ignored_by_engine: true</span>
                        )}
                      </div>
                      <div className="kv">
                        <div>
                          <div className="k">timestamp</div>
                          <div className="v">
                            <Timestamp ts={e.timestamp} />
                          </div>
                        </div>
                        {rows.map(([k, v]) => (
                          <div key={k}>
                            <div className="k">{k}</div>
                            <div className="v">{v}</div>
                          </div>
                        ))}
                      </div>
                      {refusal && <RefusalBlock refusal={refusal} escrowState={out.escrow_state} />}
                    </div>
                  </li>
                )
              })}
            </ol>

            {sc.settlement && (
              <div className="card">
                <h3>Settlement</h3>
                <p className="path">{o.scenarioKey}.settlement</p>
                <div className="recon" style={{ marginTop: 10 }}>
                  {sc.settlement.payouts.map((p) => (
                    <div className="recon-line" key={p.to}>
                      <span className="chip chip-green">→ {p.to}</span>
                      <span>{p.amount}</span>
                    </div>
                  ))}
                  <div className="recon-line">
                    <span className="op">sum(payouts.amount)</span>
                    <span>
                      {payoutAmounts.join(' + ')} = {payoutTotal}
                    </span>
                    <span className="op">· escrowed payload.amount = {head.amount}</span>
                    <span className={'chip ' + (reconciles ? 'chip-green' : 'chip-magenta')}>
                      {reconciles ? '✓ reconciles' : '✗ does not reconcile'}
                    </span>
                  </div>
                  {hasDispute &&
                    Array.isArray(sc.verdict.split_ratio) &&
                    sc.verdict.split_ratio.map((r, i) => {
                      const ok = r === sc.settlement.payouts[i].amount
                      return (
                        <div className="recon-line" key={i}>
                          <span className="op">split_ratio[{i}]</span>
                          <span>
                            {r} · payouts[{i}].amount = {sc.settlement.payouts[i].amount}
                          </span>
                          <span className={'chip ' + (ok ? 'chip-green' : 'chip-magenta')}>
                            {ok ? '✓ equal' : '✗ unequal'}
                          </span>
                        </div>
                      )
                    })}
                  <div className="recon-line">
                    <span className="op">signed_by</span>
                    <span>{sc.settlement.signed_by}</span>
                  </div>
                </div>
              </div>
            )}

            {hasDispute ? (
              <div className="card">
                <h3>Dispute</h3>
                <div className="verdict-word">{sc.verdict.verdict}</div>
                <div className="kv">
                  <div>
                    <div className="k">confidence</div>
                    <div className="v">
                      {show(sc.verdict.confidence)}{' '}
                      <span className="chip chip-gray">≈ {pct(sc.verdict.confidence)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="k">auto_enforce</div>
                    <div className="v">
                      <span className={'chip ' + (sc.verdict.auto_enforce ? 'chip-magenta' : 'chip-outline')}>
                        auto_enforce: {show(sc.verdict.auto_enforce)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="k">split_ratio</div>
                    <div className="v">{show(sc.verdict.split_ratio)}</div>
                  </div>
                  {sc.escrow_state && (
                    <div>
                      <div className="k">escrow_state</div>
                      <div className="v">{sc.escrow_state}</div>
                    </div>
                  )}
                </div>
                <table style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>provenance</th>
                      <th>favors</th>
                      <th>conf.</th>
                      <th>badges</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* T-3.1 v2 (founder law): the hash takes its own
                        full-width row — the collapsed form renders in
                        full; mid-string wrap and clipping both forbidden. */}
                    {sc.evidence.map((ev, i) => (
                      <React.Fragment key={i}>
                        <tr className="comp-main">
                          <td>{ev.provenance}</td>
                          <td>
                            <span className="chip chip-outline">{ev.favors}</span>
                          </td>
                          <td>{show(ev.confidence)}</td>
                          <td>
                            <span className={'chip ' + (ev.signed ? 'chip-blue' : 'chip-outline')}>
                              {ev.signed ? 'signed' : 'unsigned'}
                            </span>{' '}
                            <span className={'chip ' + (ev.verified ? 'chip-green' : 'chip-outline')}>
                              {ev.verified ? 'verified' : 'unverified'}
                            </span>
                          </td>
                        </tr>
                        <tr className="comp-hash">
                          <td colSpan={4}>
                            <div className="hash-row">
                              <span className="k">payload_hash</span>
                              <HashChip hash={ev.payload_hash} />
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-note">
                no dispute recorded in this order's scenario — {o.scenarioKey} carries no evidence or
                verdict.
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
