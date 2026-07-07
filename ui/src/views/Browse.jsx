// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react'
import browseFx, { BROWSE_PIN } from '../fixture-browse.js'
import HashChip from '../components/HashChip.jsx'
import { iso, show } from '../format.js'

// ── Browse (T-5): the storefront ────────────────────────────────────
// Render-time computation is lawful; invention is not. Everything on
// this surface is either a fixture datum rendered verbatim or a
// visible, labeled view transformation computed at render over fixture
// truth (filter / text match / sort — Q-D5-class computation). No
// persistence, no network, no derived data presented as fixture data.
// Ordering law: default order = fixture order, stated on-surface; any
// user-applied transformation is labeled while active.
// Q-D10 (listings-surface rule): the 4 refusals render in the violet
// guards panel, never as cards.
const cases = browseFx.browse
const listed = cases.filter((c) => c.outcome.event)
const refused = cases.filter((c) => c.outcome.refused)

// Computed censuses (never transcribed from the brief or the fixture's
// own `variety` block) — first-appearance order, a fixture-order fact.
const categories = []
const sellers = []
let unpricedCount = 0
for (const c of listed) {
  const d = c.outcome.event.payload.data
  if (d.category !== null && !categories.includes(d.category)) categories.push(d.category)
  if (!sellers.includes(d.seller_did)) sellers.push(d.seller_did)
  if (d.amount === null) unpricedCount += 1
}
const hasUncategorized = listed.some((c) => c.outcome.event.payload.data.category === null)

const UNCAT = '__uncategorized__'

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

export default function Browse() {
  const [cat, setCat] = useState('all')
  const [seller, setSeller] = useState('all')
  const [unpricedOnly, setUnpricedOnly] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('fixture')

  // ── view transformation, computed at render ──
  let shown = listed.filter((c) => {
    const d = c.outcome.event.payload.data
    if (cat !== 'all') {
      if (cat === UNCAT) {
        if (d.category !== null) return false
      } else if (d.category !== cat) {
        return false
      }
    }
    if (seller !== 'all' && d.seller_did !== seller) return false
    if (unpricedOnly && d.amount !== null) return false
    const needle = q.trim().toLowerCase()
    if (needle !== '') {
      if (d.title === null) return false
      if (!d.title.toLowerCase().includes(needle)) return false
    }
    return true
  })
  if (sort !== 'fixture') {
    const priced = shown.filter((c) => c.outcome.event.payload.data.amount !== null)
    const unpriced = shown.filter((c) => c.outcome.event.payload.data.amount === null)
    priced.sort((a, b) => {
      const av = a.outcome.event.payload.data.amount
      const bv = b.outcome.event.payload.data.amount
      return sort === 'amountAsc' ? av - bv : bv - av
    })
    shown = priced.concat(unpriced)
  }

  const xforms = []
  if (cat !== 'all') xforms.push('category = ' + (cat === UNCAT ? 'uncategorized (null)' : cat))
  if (seller !== 'all') xforms.push('seller_did = ' + seller)
  if (unpricedOnly) xforms.push('unpriced only')
  if (q.trim() !== '') xforms.push("title contains '" + q.trim() + "'")
  if (sort !== 'fixture')
    xforms.push('sort: amount ' + (sort === 'amountAsc' ? '↑' : '↓') + ' — raw atomic units, cross-asset; unpriced last')

  const catOptions = [{ id: 'all', label: 'all' }]
    .concat(categories.map((c) => ({ id: c, label: c })))
    .concat(hasUncategorized ? [{ id: UNCAT, label: 'uncategorized' }] : [])

  return (
    <section data-screen-label="Browse">
      <div className="view-head">
        <h2>Browse — the storefront</h2>
        <p className="path">
          browse · {listed.length} listings · {categories.length} categories · {sellers.length} sellers ·{' '}
          {refused.length} refused · order: fixture order (default)
        </p>
        <span className="stamp">browse fixtures @ {BROWSE_PIN}</span>
        <span className="stamp" title={browseFx.generated_from}>
          generated_from {browseFx.generated_from.slice(0, 12)}…
        </span>
      </div>

      <div className="browse-bar" data-screen-label="Browse filters">
        <input
          className="browse-input"
          type="text"
          value={q}
          placeholder="match title text…"
          onChange={(e) => setQ(e.target.value)}
        />
        {catOptions.map((o) => (
          <button
            key={o.id}
            type="button"
            className={'chip chip-outline chip-btn' + (cat === o.id ? ' on' : '')}
            onClick={() => setCat(o.id)}
          >
            {o.label}
          </button>
        ))}
        <select className="browse-select" value={seller} onChange={(e) => setSeller(e.target.value)}>
          <option value="all">all sellers</option>
          {sellers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={'chip chip-outline chip-btn' + (unpricedOnly ? ' on' : '')}
          onClick={() => setUnpricedOnly(!unpricedOnly)}
        >
          unpriced only · {unpricedCount}
        </button>
        <select className="browse-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="fixture">order: fixture (default)</option>
          <option value="amountAsc">order: amount ↑</option>
          <option value="amountDesc">order: amount ↓</option>
        </select>
      </div>

      {xforms.length > 0 && (
        <div className="xform">
          view transformation active: {xforms.join(' · ')} — showing {shown.length} of {listed.length} ·
          default = fixture order
        </div>
      )}

      <div className="store-grid">
        {shown.map((c) => {
          const e = c.outcome.event
          const d = e.payload.data
          return (
            <article className="store-card" key={e.event_id} data-screen-label={'Browse · ' + d.listing_id}>
              <div>
                {d.category === null ? (
                  <span className="chip chip-outline absent" title="payload.category: null">
                    uncategorized
                  </span>
                ) : (
                  <span className="chip chip-outline" title="payload.category">
                    {d.category}
                  </span>
                )}
              </div>
              {d.title === null ? (
                <h3 className="store-title absent" title="payload.title: null">
                  untitled listing
                </h3>
              ) : (
                <h3 className="store-title">{d.title}</h3>
              )}
              <div className="price-row">
                {d.amount === null ? (
                  <span className="absent" title="payload.amount: null · payload.asset_id: null">
                    unpriced
                  </span>
                ) : (
                  <>
                    <span className="price">{d.amount}</span>
                    <span className="unit">{show(d.asset_id)} · raw atomic units</span>
                  </>
                )}
              </div>
              <div>
                <HashChip hash={d.seller_did} />
              </div>
              <div className="store-foot">
                <span>listing_id: {d.listing_id}</span>
                <span>
                  timestamp: <Timestamp ts={e.timestamp} />
                </span>
              </div>
              <div className="store-foot">
                <span>event_id: {e.event_id}</span>
                <span>source_ref: {e.source_ref}</span>
              </div>
            </article>
          )
        })}
      </div>

      {shown.length === 0 && (
        <div className="empty-note" style={{ marginTop: 14 }}>
          no listings match the active view transformation — the fixture still holds all {listed.length};
          clear the filters to see them.
        </div>
      )}

      <div className="guards" data-screen-label="Browse guards">
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
          <span className="k2">fixture</span> fixtures/browse-fixtures.json @ {BROWSE_PIN}
        </div>
        <div>
          <span className="k2">ordering</span> default = fixture order; any user sort/filter renders as a
          labeled view transformation, never a silent reorder
        </div>
        <div>
          <span className="k2">doctrine</span> titles and seller DIDs are fixture-authored demo data; every
          outcome is computed through the real normalizer with payload-equals-input asserted per listing —
          this surface renders fixture truth and asserts nothing about authorship
        </div>
        <div>
          <span className="k2">schema</span> {browseFx.schema}
        </div>
        <div>
          <span className="k2">source_of_truth</span> {browseFx.source_of_truth}
        </div>
        <div>
          <span className="k2">serialization_note</span> {browseFx.serialization_note}
        </div>
        <div>
          <span className="k2">generated_by</span> {browseFx.generated_by}
        </div>
        <div>
          <span className="k2">generated_from</span> {browseFx.generated_from}
        </div>
      </div>
    </section>
  )
}
