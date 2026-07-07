// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react'
import fixtures, { FIXTURE_PIN } from '../fixture.js'
import listingsFx, { LISTINGS_PIN } from '../fixture-listings.js'
import HashChip from '../components/HashChip.jsx'
import { iso, show, sum } from '../format.js'

// ── Composition law (T-3 dispatch) ─────────────────────────────────
// Profile subjects = DIDs of scenario_3's final reputation state ∪
// distinct seller_did over the listings fixture's SUCCESSFUL cases.
// Join = exact string equality on the DID — no normalization, no fuzz.
// Q-D10 extension: refused inputs attach to no identity surface —
// composition reads `listed` only; refusals render in the Listings
// view's guard panel and nowhere else.
// Ordering: reputation-state order first, then first-appearance of
// listings-only DIDs (none in this data).
const repEntries = Object.values(fixtures.scenario_3_reputation)
const listed = listingsFx.listings.filter((c) => c.outcome.event)

const subjects = []
for (const r of repEntries) if (!subjects.includes(r.did)) subjects.push(r.did)
for (const c of listed) {
  const d = c.outcome.event.payload.data.seller_did
  if (!subjects.includes(d)) subjects.push(d)
}

const profiles = subjects.map((did) => ({
  did,
  rep: repEntries.find((r) => r.did === did) || null,
  listings: listed.filter((c) => c.outcome.event.payload.data.seller_did === did),
}))

// Q-D8 (founder-ruled, carried from the Listings view): timestamp 0
// renders as labeled absence — never the 1970 epoch. Local copy; the
// T-2 file is landed and is not touched by this task.
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

export default function Profiles() {
  return (
    <section data-screen-label="Profiles">
      <div className="view-head">
        <h2>DID profiles — cross-fixture composition</h2>
        <p className="path">
          scenario_3_reputation DIDs ∪ seller_did over successful listings · {profiles.length} profiles · join: exact
          string equality
        </p>
        <span className="stamp">fixtures @ {FIXTURE_PIN}</span>
        <span className="stamp">listings fixtures @ {LISTINGS_PIN}</span>
      </div>

      <div className="profile-grid">
        {profiles.map((p) => (
          <article className="card profile" key={p.did} data-screen-label={'Profile · ' + p.did}>
            <div className="profile-head">
              <HashChip hash={p.did} />
            </div>

            <div className="profile-section">
              <div className="profile-section-head">
                <h3>Reputation</h3>
                <span className="path">scenario_3_reputation</span>
              </div>
              {p.rep === null ? (
                <div className="empty-note">no reputation recorded for this DID — absent from scenario_3_reputation.</div>
              ) : (
                <>
                  <div>
                    <div
                      className="score score-sm"
                      style={{ color: p.rep.score > 0 ? 'var(--green)' : 'var(--muted)' }}
                    >
                      {p.rep.score}
                    </div>
                    <div className="score-label">
                      score · computed_at {p.rep.computed_at} · {iso(p.rep.computed_at)}
                    </div>
                  </div>
                  {p.rep.components.length === 0 ? (
                    <div className="empty-note">
                      components: [] — no history recorded for this DID. The zero is honest.
                    </div>
                  ) : (
                    <>
                      <table>
                        <thead>
                          <tr>
                            <th>source</th>
                            <th>contrib.</th>
                            <th>weight</th>
                            <th>evidence_hash</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.rep.components.map((c, i) => (
                            <tr key={i}>
                              <td>{c.source}</td>
                              <td style={{ color: c.contribution >= 0 ? 'var(--green)' : 'var(--violet)' }}>
                                {c.contribution > 0 ? '+' : ''}
                                {c.contribution}
                              </td>
                              <td>{show(c.weight)}</td>
                              <td>
                                <HashChip hash={c.evidence_hash} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="path">
                        Σ contributions (computed) = {sum(p.rep.components.map((c) => c.contribution))} · score
                        (fixture) = {p.rep.score}
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="profile-section">
              <div className="profile-section-head">
                <h3>Listings · {p.listings.length}</h3>
                <span className="path">successful ProductListed · payload.data</span>
              </div>
              {p.listings.length === 0 ? (
                <div className="empty-note">
                  no listings from this DID — no successful ProductListed carries this seller_did.
                </div>
              ) : (
                p.listings.map((c) => {
                  const e = c.outcome.event
                  const d = e.payload.data
                  return (
                    <div className="mini-listing" key={c.case}>
                      <div className="mini-listing-top">
                        {d.title === null ? (
                          <span className="mini-title absent" title="payload.title: null">
                            untitled listing
                          </span>
                        ) : (
                          <span className="mini-title">{d.title}</span>
                        )}
                        {d.amount === null ? (
                          <span className="absent" title="payload.amount: null · payload.asset_id: null">
                            unpriced
                          </span>
                        ) : (
                          <span>
                            <span className="mini-price">{d.amount}</span>{' '}
                            <span className="unit">{show(d.asset_id)} · raw atomic units</span>
                          </span>
                        )}
                      </div>
                      <div className="mini-meta">
                        <span>listing_id: {d.listing_id}</span>
                        {d.category === null ? (
                          <span className="absent" title="payload.category: null">
                            uncategorized
                          </span>
                        ) : (
                          <span>category: {d.category}</span>
                        )}
                        <span>
                          timestamp: <Timestamp ts={e.timestamp} />
                        </span>
                        <span>event_id: {e.event_id}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="path" style={{ marginTop: 14 }}>
        Refused inputs attach to no identity surface (Q-D10) — guards render in the Listings view only.
      </p>

      <div className="colophon" style={{ marginTop: 28 }}>
        <div>
          <span className="k2">fixture</span> fixtures/demo-fixtures.json @ {FIXTURE_PIN} · reputation source:
          scenario_3_reputation (final state)
        </div>
        <div>
          <span className="k2">fixture</span> fixtures/listings-fixtures.json @ {LISTINGS_PIN} · listings source:
          successful ProductListed events
        </div>
        <div>
          <span className="k2">generated_from</span> (demo) {fixtures.generated_from} · (listings){' '}
          {listingsFx.generated_from}
        </div>
        <div>
          <span className="k2">composition</span> profiles = reputation DIDs ∪ distinct seller_did over successful
          listings · join: exact string equality on the DID
        </div>
      </div>
    </section>
  )
}
