/* swap-adapter.mjs — THE SWAP SEAM (RAIL-FORMULARY-1 LIGHTNING column, ruled 2026-08-29).
   A pluggable adapter interface with NO live default wired. Boltz is
   CONTRAINDICATED at the label: its service died 2026-08-03 to AI-assisted
   attacks (boltz.exchange banner + press; refunds live). Blockstream Swaps
   is the noted beta candidate. The hub's OWN built-in swaps are Boltz-based
   (routes /api/swaps/in|out in getAlby/hub) — same contraindication applies.
   Nothing in this rail gates on any adapter. Money stays dormant until the
   founder wires one by name. */

export const SWAP_CANDIDATES = [
  { id: 'blockstream-swaps', status: 'BETA — verify at source before any wiring', note: 'successor candidate per the dossier' },
  { id: 'operator-submarine', status: 'UNBUILT — estate operator box; inherits the AI-attack class knowingly' },
  { id: 'boltz', status: 'CONTRAINDICATED — service dead 2026-08-03; refund-only API remains' },
];

/* the seam: every adapter implements this shape. wiring an adapter =
   registering it in REGISTERED_ADAPTERS — an explicit, reviewable act. */
export const REGISTERED_ADAPTERS = {}; // EMPTY BY LAW — no live default

export function getSwapAdapter(id) {
  const a = REGISTERED_ADAPTERS[id];
  if (!a) throw new Error(`no swap adapter wired: '${id ?? '(none)'}' — the seam ships with NO live default (Boltz contraindicated; see RAIL-FORMULARY-1 LIGHTNING)`);
  return a;
}

/* a reference implementation SHAPE (unused until wired):
   { id, quoteIn({amountSat}) -> {feeSat, eta}, swapIn({amountSat, onchainAddr}) -> {contractAddr|lockup},
     refund({swapId}) -> {txid}, status({swapId}) -> 'pending'|'locked'|'claimed'|'refunded' } */
