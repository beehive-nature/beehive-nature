// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react'
import listingsFx, { LISTINGS_PIN } from '../fixture-listings.js'
import HashChip from '../components/HashChip.jsx'
import { iso, show } from '../format.js'

const cases = listingsFx.listings
const listed = cases.filter((c) => c.outcome.event)
const refused = cases.filter((c) => c.outcome.refused)

// §9.3 payload field names, verbatim — rendered in full on every card.
const PAYLOAD_KEYS = ['listing_id', 'title', 'category', 'amount', 'asset_id', 'seller_did']

// Q-D8 (founder-ruled): timestamp 0 renders as absence — never the 1970 epoch.
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

export default function Listings() {
  return (
    <section data-screen-label="Listings">
      <div className="view-head">
        <h2>Marketplace listings — normalizer output</h2>
        <p className="path">
          listings · {cases.length} cases · {listed.length} listed · {refused.length} refused
        </p>
        <span className="stamp">listings fixtures @ {LISTINGS_PIN}</span>
        <span className="stamp" title={listingsFx.generated_from}>
          generated_from {listingsFx.generated_from.slice(0, 12)}…
        </span>
      </div>

      <div className="listing-grid">
        {listed.map((c) => {
          const e = c.outcome.event
          const p = e.payload.data
          const priced = p.amount !== null
          return (
            <article className="card listing" key={c.case} data-screen-label={'Listing · ' + c.case}>
              <div className="step-head">
                <span className="chip chip-gray">case: {c.case}</span>
                <span className="chip chip-blue">{e.event_type.type}</span>
              </div>
              {/* Q-D9 (founder-ruled): null optionals are labeled, first-class
                  absence — "untitled listing" / "uncategorized" / "unpriced" —
                  never hidden rows. */}
              <h3 className="listing-title">
                {p.title === null ? (
                  <span className="absent" title="payload.title: null">
                    untitled listing
                  </span>
                ) : (
                  p.title
                )}
              </h3>
              <div>
                <span
                  className={'chip chip-outline' + (p.category === null ? ' absent' : '')}
                  title={p.category === null ? 'payload.category: null' : 'payload.category'}
                >
                  {p.category === null ? 'uncategorized' : p.category}
                </span>
              </div>
              <div className="price-row">
                {priced ? (
                  <>
                    <span className="price">{p.amount}</span>
                    <span className="unit">{show(p.asset_id)} · raw atomic units</span>
                  </>
                ) : (
                  <span className="absent" title="payload.amount: null · payload.asset_id: null">
                    unpriced
                  </span>
                )}
              </div>
              <div className="kv">
                <div>
                  <div className="k">seller_did</div>
                  <div className="v">
                    <HashChip hash={p.seller_did} />
                  </div>
                </div>
                <div>
                  <div className="k">listing_id</div>
                  <div className="v">{p.listing_id}</div>
                </div>
                <div>
                  <div className="k">timestamp</div>
                  <div className="v">
                    <Timestamp ts={e.timestamp} />
                  </div>
                </div>
              </div>
              <div className="env">
                <span className="env-label">payload (§9.3, verbatim)</span>
                {PAYLOAD_KEYS.map((k) => (
                  <span key={k}>
                    {k}: {show(p[k])}
                  </span>
                ))}
              </div>
              <div className="env">
                <span>event_id: {e.event_id}</span>
                <span>source_ref: {e.source_ref}</span>
                <span>source_chain: {e.source_chain}</span>
                <span>canonicalized_by: {e.canonicalized_by}</span>
                <span>payload.type: {e.payload.type}</span>
              </div>
            </article>
          )
        })}
      </div>

      {/* Q-D10 (founder-ruled): refusals are the guards working, not
          merchandise — violet panel, never listing cards. */}
      <div className="guards" data-screen-label="Listings guards">
        <p className="refusal-title">
          Guards — refused inputs · typed normalizer errors (first-class outcomes, not merchandise)
        </p>
        {refused.map((c) => {
          const r = c.outcome.refused
          const inp = c.input
          return (
            <div className="guard-item" key={c.case}>
              <div className="step-head">
                <span className="chip chip-gray">case: {c.case}</span>
                <span className="chip chip-violet">{r.error}</span>
                <span className="chip chip-violet">field: {r.field}</span>
                {'expected' in r && <span className="chip chip-violet">expected: {r.expected}</span>}
              </div>
              <div className="guard-display">{r.display}</div>
              <div className="kv">
                <div>
                  <div className="k">action</div>
                  <div className="v">{r.action}</div>
                </div>
                <div>
                  <div className="k">tx_id</div>
                  <div className="v">{inp.tx_id}</div>
                </div>
                <div>
                  <div className="k">source_chain</div>
                  <div className="v">{inp.source_chain}</div>
                </div>
                <div>
                  <div className="k">contract</div>
                  <div className="v">{inp.contract}</div>
                </div>
                <div>
                  <div className="k">action_name</div>
                  <div className="v">{inp.action_name}</div>
                </div>
                <div>
                  <div className="k">block_num</div>
                  <div className="v">{inp.block_num}</div>
                </div>
              </div>
              <div className="env">
                <span className="env-label">input.data (as sent)</span>
                {Object.entries(inp.data).map(([k, v]) => (
                  <span key={k}>
                    {k}: {show(v)}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="colophon" style={{ marginTop: 28 }}>
        <div>
          <span className="k2">fixture</span> fixtures/listings-fixtures.json @ {LISTINGS_PIN}
        </div>
        <div>
          <span className="k2">schema</span> {listingsFx.schema}
        </div>
        <div>
          <span className="k2">source_of_truth</span> {listingsFx.source_of_truth}
        </div>
        <div>
          <span className="k2">serialization_note</span> {listingsFx.serialization_note}
        </div>
        <div>
          <span className="k2">generated_by</span> {listingsFx.generated_by}
        </div>
        <div>
          <span className="k2">generated_from</span> {listingsFx.generated_from}
        </div>
      </div>
    </section>
  )
}
