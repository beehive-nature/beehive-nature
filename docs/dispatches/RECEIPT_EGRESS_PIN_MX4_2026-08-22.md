# RECEIPT — MX-4 EGRESS PIN ATTEMPT · the obscuration pinned, the path named (zCode)

**Gate:** MX-4 — "egress/bandwidth rates: UNVERIFIED across every provider; must be
pinned before any rate is quoted to anyone." **Seat:** zCode. **Founder order:** *"get
everything you can done; clear the deck."* **What this changes:** the gate's premise —
"UNVERIFIED across every provider" — is now itself PINNED, with evidence, and the
pinning PATH is named. **No rate is quoted anywhere by this receipt** (the gate stands).

## 1 · The finding: egress pricing is systematically obscured at the marketing layer

Sampled 2026-08-22, keyless, every attempt logged:

| provider | page | what the page actually gives |
|---|---|---|
| Hetzner | hetzner.com/cloud/pricing + docs FAQ | **qualitative only** — "generous included traffic", "very low prices for additional data transfer"; the numeric table renders as placeholders; Hetzner itself defers comparisons to **sparecores.com** |
| RunPod | runpod.io/pricing | **omits transfer entirely** — GPU $/hr and storage $/GB, zero bandwidth rows (mirrors the supply research's Verda finding: "egress published nowhere found") |
| Oracle | oracle.com/cloud/free + costestimator | **403 to keyless fetch / JS shell** — no pricing content served to a non-browser |
| Vultr | vultr.com/pricing | **403** |
| OVH (via sparecores p.1) | sparecores.com/traffic-prices | base rows read **0 USD/GB/month** with the caveat *"pricing tiers usually apply at the account level"* — i.e., the number is real and the billing basis is not |

## 2 · Why this is the expected shape, not a failure

Egress is the margin line hyperscalers built their lock-in on; the low-cost providers
compete on it *without publishing it* (Hetzner's own copy: expensive egress "can quickly
drive up total costs" — their words about rivals, with no number for themselves). A
gate that says "must be pinned before quoted" was written for exactly this terrain.

## 3 · The pinning path (in order of authority)

1. **The invoice** — for OUR iron (the founder's Oracle free-tier box first), the
   monthly statement is ground truth; Always Free egress allowance per Oracle's own
   docs is the one number worth pinning from the account, not the marketing page.
2. **The independent aggregator** — sparecores.com/traffic-prices (260 rows, 26 pages,
   tier caveats stated); a deep pull or browser-filtered export pins the comparison set.
3. **Measurement** — once the ant.report mirror is live (MX-6), its own byte counts
   against the box's allowance are the only numbers that ever mattered operationally.

## 4 · Gate state after this receipt

MX-4 **remains closed** — no rate quoted, on any surface, to anyone. Its text may
honestly upgrade from "UNVERIFIED across every provider" to: **"the obscuration is
pinned with evidence; numbers defer to invoice → aggregator-depth → measurement, in
that order; nothing is quoted until then."**
