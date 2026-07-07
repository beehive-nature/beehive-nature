// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react'
import { truncHash } from '../format.js'

// Full 64-hex hash lives in props/state; truncation is display-only
// (seat law, rule 4). Click toggles the full value.
export default function HashChip({ hash }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      className={'hash' + (open ? ' hash-open' : '')}
      title={open ? 'click to truncate' : hash}
      onClick={() => setOpen(!open)}
    >
      {open ? hash : truncHash(hash)}
    </button>
  )
}
