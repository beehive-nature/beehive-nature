// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react'
import fixtures from '../fixture.js'
import HashChip from '../components/HashChip.jsx'
import { pct, show, sum } from '../format.js'

const d2 = fixtures.scenario_2_dispute
const cases = Object.entries(d2)

// Q-D5 invariant, as named by the founder: sum(settlement.payouts[].amount)
// equals the escrowed amount in BOTH cases; in 2b additionally
// split_ratio[i] equals payouts[i].amount. All comparisons computed here at
// render — never asserted in copy.
const ESCROWED = fixtures.scenario_1_happy_path.steps[0].event.payload.data.amount
const ESCROWED_PATH = 'scenario_1_happy_path.steps[0].event.payload.data.amount'

const label = (key) => key.replace(/^case_/, '').replace(/_/g, ' ')

export default function Dispute() {
  return (
    <section data-screen-label="Dispute branch">
      <div className="view-head">
        <h2>Scenario 2 — dispute branch</h2>
        <p className="path">scenario_2_dispute · {cases.length} cases</p>
      </div>

      <div className="dispute-grid">
        {cases.map(([key, c]) => {
          const amounts = c.settlement.payouts.map((p) => p.amount)
          const total = sum(amounts)
          const reconciles = total === ESCROWED
          return (
            <div className="case" key={key} data-screen-label={label(key)}>
              <div className="case-head">
                <h3>{label(key)}</h3>
                <span className="chip chip-gray">escrow_state: {c.escrow_state}</span>
              </div>

              <div className="card">
                <h3>Evidence</h3>
                <table>
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
                    {c.evidence.map((ev, i) => (
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

              <div className="card">
                <h3>Verdict</h3>
                <div className="verdict-word">{c.verdict.verdict}</div>
                <div className="kv">
                  <div>
                    <div className="k">confidence</div>
                    <div className="v">
                      {show(c.verdict.confidence)} <span className="chip chip-gray">≈ {pct(c.verdict.confidence)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="k">auto_enforce</div>
                    <div className="v">
                      <span className={'chip ' + (c.verdict.auto_enforce ? 'chip-magenta' : 'chip-outline')}>
                        auto_enforce: {show(c.verdict.auto_enforce)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="k">split_ratio</div>
                    <div className="v">{show(c.verdict.split_ratio)}</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Payouts — reconciliation (computed at render)</h3>
                <div className="recon">
                  {c.settlement.payouts.map((p) => (
                    <div className="recon-line" key={p.to}>
                      <span className="chip chip-green">→ {p.to}</span>
                      <span>{p.amount}</span>
                    </div>
                  ))}
                  <div className="recon-line">
                    <span className="op">sum</span>
                    <span>{amounts.join(' + ')} = {total}</span>
                    <span className={'chip ' + (reconciles ? 'chip-green' : 'chip-magenta')}>
                      {reconciles ? '✓' : '✗'} escrowed = {ESCROWED}
                    </span>
                  </div>
                  <p className="path">escrowed ← {ESCROWED_PATH}</p>
                  {Array.isArray(c.verdict.split_ratio) &&
                    c.verdict.split_ratio.map((r, i) => {
                      const ok = r === c.settlement.payouts[i].amount
                      return (
                        <div className="recon-line" key={i}>
                          <span className="op">split_ratio[{i}]</span>
                          <span>
                            {r} · payouts[{i}].amount = {c.settlement.payouts[i].amount}
                          </span>
                          <span className={'chip ' + (ok ? 'chip-green' : 'chip-magenta')}>
                            {ok ? '✓ equal' : '✗ unequal'}
                          </span>
                        </div>
                      )
                    })}
                  <div className="recon-line">
                    <span className="op">signed_by</span>
                    <span>{c.settlement.signed_by}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
