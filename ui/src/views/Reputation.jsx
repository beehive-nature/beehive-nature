// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react'
import fixtures from '../fixture.js'
import HashChip from '../components/HashChip.jsx'
import { iso, show, sum } from '../format.js'

const s3 = fixtures.scenario_3_reputation
const entries = Object.entries(s3)

export default function Reputation() {
  return (
    <section data-screen-label="Reputation">
      <div className="view-head">
        <h2>Scenario 3 — reputation</h2>
        <p className="path">scenario_3_reputation · {entries.length} DIDs</p>
      </div>

      <div className="rep-grid">
        {entries.map(([key, r]) => {
          const contribSum = sum(r.components.map((c) => c.contribution))
          return (
            <div className="card rep" key={key} data-screen-label={'Reputation · ' + key}>
              <h3>{key}</h3>
              <div className="rep-did">{r.did}</div>
              <div>
                <div className="score" style={{ color: r.score > 0 ? 'var(--green)' : 'var(--muted)' }}>
                  {r.score}
                </div>
                <div className="score-label">score · computed_at {r.computed_at} · {iso(r.computed_at)}</div>
              </div>

              {r.components.length === 0 ? (
                <div className="empty-note">
                  components: [] — no history recorded for this DID. The zero is honest.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>source</th>
                      <th>contrib.</th>
                      <th>weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* T-3.1 v2 (founder law): the hash takes its own
                        full-width row — the collapsed form renders in
                        full; mid-string wrap and clipping both forbidden. */}
                    {r.components.map((c, i) => (
                      <React.Fragment key={i}>
                        <tr className="comp-main">
                          <td>{c.source}</td>
                          <td style={{ color: c.contribution >= 0 ? 'var(--green)' : 'var(--violet)' }}>
                            {c.contribution > 0 ? '+' : ''}
                            {c.contribution}
                          </td>
                          <td>{show(c.weight)}</td>
                        </tr>
                        <tr className="comp-hash">
                          <td colSpan={3}>
                            <div className="hash-row">
                              <span className="k">evidence_hash</span>
                              <HashChip hash={c.evidence_hash} />
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}

              {r.components.length > 0 && (
                <p className="path">
                  Σ contributions (computed) = {contribSum} · score (fixture) = {r.score}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
