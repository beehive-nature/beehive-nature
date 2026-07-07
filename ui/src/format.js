// SPDX-License-Identifier: AGPL-3.0-only
//
// Display-only transforms. Data fidelity is the fixture's; these never
// change a value, only how it is shown (truncation, time rendering) or
// combine fixture values arithmetically at render time (sum checks).

export const iso = (ts) => new Date(ts * 1000).toISOString().replace('.000Z', 'Z')

// Truncation is display-only; the full value stays in state. Values short
// enough to show whole (e.g. DIDs under the hash-chip treatment) pass
// through untruncated.
export const truncHash = (h) => (h.length <= 20 ? h : h.slice(0, 10) + '…' + h.slice(-8))

export const sum = (xs) => xs.reduce((a, b) => a + b, 0)

// Verbatim-ish rendering of JSON values React would otherwise swallow
// (null, booleans, arrays).
export const show = (v) => {
  if (v === null) return 'null'
  if (Array.isArray(v)) return '[' + v.join(', ') + ']'
  return String(v)
}

export const pct = (c) => (Math.round(c * 1000) / 10) + '%'
