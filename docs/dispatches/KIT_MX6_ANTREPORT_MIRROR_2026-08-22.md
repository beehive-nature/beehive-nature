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

## ADDENDUM (same night): the PERMANENT tier — indelible + antd on Autonomi

The mirror's honest weakness is the box: community iron can die, and a stale mirror
says so loudly but still dies. WithAutonomi's **indelible**
(github.com/WithAutonomi/indelible · indelibletool.com — enterprise storage gateway
for Autonomi: Go + Vue single binary, REST API, admin dashboard, SQLite default /
Postgres for production) closes that: snapshot pages are **written to Autonomi once,
one-time ANT payment, no renewals, no egress fees, self-encrypted and chunked across
thousands of nodes** — the failover mirror becomes *indelible*, outliving any box,
free-to-read distribution forever (the dangling-art doctrine's final form).

- **Stack note, receipt-worthy:** indelible chose the estate's exact polar-strength
  shape (SQLite default / Postgres by function, self-hosted, single process) —
  independent convergence on the founder's ruled pattern, by Autonomi's own org.
- **Kit path (when MX-6 arms):** run antd + indelible on the community box → REST-push
  the page snapshots → serve reads from Autonomi or the local cache → the mirror's
  freshness stamp governs which tier answers (live box first, permanent tier on fail).
- **Economics:** one-time ANT per snapshot batch — the ANT-side treasury's exact lane
  (the bANTfarm reads it live); receipts ride the exchange's storage class, iron first.
- **Honesty:** permanence/quantum-resistance claims are the vendor's own descriptions,
  not independently audited — quoted as claims, receipted as such.
