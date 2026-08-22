# KIT — MX-6 · the ant.report mirror onboarding runbook (founder-hands, ~5 minutes)

**Gate:** MX-6 — external-customer onboarding is founder-hands only. **This kit makes
the founder's hands a five-minute job.** Trigger: Shu accepts the standing zero-burden
offer (failover mirror of ant.report's public pages on community iron — ledger
addendum 2, the bMeshAsi dock offer).

## What the offer promises (the constraints this kit must honor)

Zero burden on the author: no repo access, no code from him, no obligation, no support
requests to him. Public pages only. His site stays the source of truth; ours is a
failover mirror, honestly labeled, with a visible freshness stamp.

## The runbook

1. **Founder word:** "mirror live" (this kit executes only on it).
2. **Fetch shape (community iron, the Oracle box first):** a periodic pull of
   `www.ant.report` public pages (respectful interval; the site self-reports its
   update cadence — match it, don't exceed it), stored as static files.
3. **Serve shape:** static mirror under a clearly-labeled path (e.g.
   `mirror.ant.report-failover`), banner: "unofficial failover mirror · source of
   truth: www.ant.report · last fresh: <timestamp> · offered by the bMeshAsi community
   iron exchange". No analytics, no telemetry (the estate's own law).
4. **Freshness honesty:** the stamp is the mirror's contract; a stale mirror says so
   on its face. If the box dies, the mirror dies loudly (honest absence), never
   silently stale.
5. **Notify Shu:** one message, founder-hands: the mirror URL, the offer's terms
   restated, and "say the word and it comes down." His site, his call, always.
6. **Meter (when MX-1 arms):** bytes served ride the exchange's bandwidth class —
   IRON FIRST waterfall; the box's costs reimbursed before anything else.

## What this kit deliberately does not do

No scraping of non-public endpoints, no reconstruction of his data pipeline (his
16-section telemetry stays his), no rate quoted (MX-4), no key from anyone (MX-5 stays
gated — the mirror needs no wallet session; only step 6 does, when it exists).
