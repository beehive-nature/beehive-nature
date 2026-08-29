# RAID — AUTONOMI COMMUNITY THREAD (outline-only, founder-ordered 2026-08-29)
**Source:** Discord thread, non-English (ES → RU → ZH tail), pasted by founder. **Method:** outline for Claude — structure and extracted knowledge, NO content reproduction (third-party conversation; facts attributed, unverified community claims marked). **Relevance:** Autonomi operator knowledge + a locale-contribution precedent that mirrors our corpus law.

## 1 · THE THREAD'S SHAPE (three phases, four actors, 6+ months)
- **Jan 3–6 · Spanish node-ops support:** newcomer (henrycr) installs Autonomi nodes on old hardware across a 2-TB HDD; helper (Obelius) walks UPnP/port-forward/router-NAT debugging.
- **Feb 20–21 · Russian economics debate:** de-pin farmer (Matt) asks what nodes actually pay; Obelius gives the honest economics.
- **Jun 3 · locale contribution:** Obelius opens a PR polishing the Russian locale of the official ant-ui.
- **Jul 17 · Chinese tail:** one line from a new actor asking whether Chinese speakers exist — left unanswered.

## 2 · OPERATOR KNOWLEDGE EXTRACTED (community claims — treat UNVERIFIED until we measure)
- **antctl registry semantics:** `add --count N` ACCUMULATES into the existing registry (re-running tripled one user to 180 nodes); node config is immutable after add — changes require full `reset -f` and re-add.
- **Inbound connectivity:** the standard failure is unreachable-from-internet; fixes = router UPnP on, or `--no-upnp` + explicit `--node-port` range + manual UDP range-forward to a static local IP.
- **Multi-PC scaling pattern:** disjoint port ranges per PC (e.g. 12501/12601/12701/12801, +60 each), one UDP forward rule per PC, static LAN IPs.
- **The real bottleneck = the router's NAT table,** not the PCs: recommended ~14–15k active connections for 60 nodes; claim: a cheap consumer router was raised 8k→20k via manufacturer request; connection spikes happen at node START.
- **Scale guardrail:** home-router deployments should stay ≤~50 nodes (Launchpad's design point); static public IP not required.
- **Hardware tolerance:** dying HDDs are fine — network latency is seconds-scale, so disk read speed is irrelevant; monstrous replication traffic is normal and unpaid.
- **Reward economics (the honest part):** nodes are NOT meaningful income; foundation micro-payments to early nodes were cancelled; the only paid event is being first to ingest freshly-uploaded data (rare); fuller nodes make new uploads pricier; current network ~2k nodes after an attacker briefly inflated it to 1.5–2M; **a network wipe + feature reset is expected**; no downtime penalties — offline just lowers the chance of catching paid uploads; the design intent is zero-cost idle hardware earning tokens spendable on one's own storage.

## 3 · ESTATE RELEVANCE (why this raid matters to our lanes)
1. **Operator-box + scanner docs (RAIL-FORMULARY R3, Panel D):** the NAT-table limit and per-PC port-range pattern are exactly the failure class our own Autonomi/scanner nodes hit on residential links — candidate content for our operator docs (measured on OUR boxes before citing).
2. **The wipe warning:** community-claimed network reset would touch ANT-side replication/availability assumptions — flag against the ruled AR/ANT doctrine and midivault records (our AR permanence lane is untouched; ANT is the mutable lane by design).
3. **Economics honesty parity:** Obelius's "nodes buy you storage, not a living" matches Panel D's honesty law — our operator pitch must never promise income the network doesn't pay.
4. **Locale precedent (the gem):** a community member maintaining a Russian locale PR against official ant-ui is the exact human shape of our corpus-attestation law — and the unanswered Chinese tail is the same class of request that brought Tatar in. Our zh dock already covers him; the estate answers requests like his by default.
5. **Pattern candidate:** the self-written node-tracking program with graphs (Windows-capable, project-agnostic) — watch-item for our own ops panel.

## 4 · CAUTIONS
All numeric claims (node counts, NAT limits, wipe timing, payment behavior) are third-party community statements — recorded as claims, not estate facts. No content reproduced; structure and findings only, per founder order.
