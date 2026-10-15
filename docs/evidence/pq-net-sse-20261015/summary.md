# PQ-NET SSE matched comparison

Pinned x0x v0.47.1; isolated WSL netns/veth rig. One matched pair per
scale per stage; no statistical significance or public-mesh extrapolation.
Every row has an empty collector failure list and zero matching server SSE
lag warnings. The latter is log evidence, not an upstream gap-sequence proof.
DM cells include durable API ACKs; group/store cells use recipient reads;
probe cells use SSE envelope observations. Counts are on-time/intended pairs.

## Final driver

| Scale | Policy | DM | Group | Store | Probe | Late store | Mean leaf idle B/min | Seed idle B/min | Relay idle B/min | Gates |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 | baseline | 12/12 | 12/12 | 20/20 | 160/160 | 0 | 1,222,695 | 1,386,060 | - | PASS |
| 3 | shed_normal | 12/12 | 12/12 | 20/20 | 160/160 | 0 | 1,210,093 | 1,683,309 | - | PASS |
| 6 | baseline | 12/12 | 12/12 | 20/20 | 320/320 | 0 | 1,270,170 | 1,533,747 | 1,502,977 | PASS |
| 6 | shed_normal | 12/12 | 12/12 | 20/20 | 320/320 | 0 | 983,582 | 1,345,791 | 1,017,070 | PASS |
| 9 | baseline | 12/12 | 12/12 | 20/20 | 560/560 | 0 | 1,135,096 | 1,589,763 | 1,526,442 | PASS |
| 9 | shed_normal | 12/12 | 12/12 | 6/20 | 560/560 | 0 | 1,340,226 | 1,947,053 | 1,081,271 | FAIL |

## Preliminary driver

| Scale | Policy | DM | Group | Store | Probe | Late store | Mean leaf idle B/min | Seed idle B/min | Relay idle B/min | Gates |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 | baseline | 12/12 | 12/12 | 20/20 | 160/160 | 0 | 1,263,425 | 1,700,463 | - | PASS |
| 3 | shed_normal | 12/12 | 12/12 | 20/20 | 160/160 | 0 | 1,192,655 | 1,523,260 | - | PASS |
| 6 | baseline | 12/12 | 12/12 | 20/20 | 320/320 | 0 | 1,277,058 | 1,386,883 | 1,327,373 | PASS |
| 6 | shed_normal | 12/12 | 12/12 | 17/20 | 320/320 | 3 | 999,221 | 1,239,634 | 733,172 | FAIL |
| 9 | baseline | 12/12 | 12/12 | 20/20 | 560/560 | 0 | 953,450 | 1,355,642 | 1,183,008 | PASS |
| 9 | shed_normal | 12/12 | 12/12 | 18/20 | 560/560 | 0 | 918,942 | 1,264,578 | 1,221,297 | FAIL |

Mean leaf values average nodes within one trial, never different runs or
policies. Per-node ingress/egress, workload-phase totals, all failed gates,
and topic-level published/observed counts remain in comparison.json.
Workload-phase totals include the settlement sweep and are not per-message
wire costs. Preliminary rows predate final error-path/protocol hardening;
they are retained separately and never pooled with the final build.

The first final scale-nine setup failed before workload with an existing
virtual-interface error. Its setup-failure receipt is retained separately;
the complete scale-nine pair uses fresh qnb/qnc namespaces on subnet 84.
