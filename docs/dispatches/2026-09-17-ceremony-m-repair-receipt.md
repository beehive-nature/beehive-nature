# Ceremony M repair receipt — AV-2 + AV-3 promoted to D

**AV-2 — D** (4/4): rate freshness enforced as shared admission precondition (same rate_set.json, same TTL=300s, same inclusive boundary; non-generation requests bypass). Boundary: fresh admitted, ~299s admitted (exclusive), ~300s typed refusal (phase=rate-stale), refreshed admitted.

**AV-3 — D** (8/8): X-Drill-ID observability proven through gate log. Healthy=1 charge, gate-down=0+refused, recovery=1+NO backfill.

**Ceremony M: CLOSED** — AV-1 D + AV-2 D + AV-3 D. Gesture D UNLOCKED.

Technical note: serve-based admission (architecturally right) fails under systemd unit env; preserved as .serve-based.bak. File-based version deployed and green.
