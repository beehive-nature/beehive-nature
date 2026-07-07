// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react'
import fixtures, { FIXTURE_PIN } from './fixture.js'
import logo from './assets/bn-logo.jpg'
import EscrowLifecycle from './views/EscrowLifecycle.jsx'
import Dispute from './views/Dispute.jsx'
import Reputation from './views/Reputation.jsx'
import Listings from './views/Listings.jsx'

const VIEWS = [
  ['escrow', 'Escrow lifecycle', EscrowLifecycle],
  ['dispute', 'Dispute branch', Dispute],
  ['reputation', 'Reputation', Reputation],
  ['listings', 'Listings', Listings],
]

export default function App() {
  const [view, setView] = useState('escrow')
  const Active = VIEWS.find(([id]) => id === view)[2]
  return (
    <div className="app">
      <header className="masthead">
        <img className="logo" src={logo} alt="Beehive Nature Reserve" />
        <div>
          <h1>
            Beehive Nature Reserve <span className="thin">· Scenario Viewer</span>
          </h1>
          <div className="stamps">
            <span className="stamp">fixtures @ {FIXTURE_PIN}</span>
            <span className="stamp" title={fixtures.generated_from}>
              generated_from {fixtures.generated_from.slice(0, 12)}…
            </span>
            <span className="stamp">static · no chain calls · no network</span>
          </div>
        </div>
        <nav className="tabs">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={'tab' + (view === id ? ' active' : '')}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <Active />
      </main>

      <footer className="colophon">
        <div>
          <span className="k2">fixture</span> fixtures/demo-fixtures.json @ {FIXTURE_PIN}
        </div>
        <div>
          <span className="k2">schema</span> {fixtures.schema}
        </div>
        <div>
          <span className="k2">generated_by</span> {fixtures.generated_by}
        </div>
        <div>
          <span className="k2">generated_from</span> {fixtures.generated_from}
        </div>
        <div>
          <span className="k2">serialization_note</span> {fixtures.serialization_note}
        </div>
      </footer>
    </div>
  )
}
