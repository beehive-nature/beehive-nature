# BT-MESH-DEPENDABILITY-001 — measured evidence (local rig)

Generated 2026-10-13T06:48:50.112Z. All numbers are kernel veth counters and
recipient-side delivery evidence from the netns rig; daemon diagnostics are
recorded alongside as application-level context and are never verdict sources.
Proposed budgets live in the committed budgets artifact; every trial binds its
sha256 (referenced below; the full digest rides the closeout receipts).

budgets sha256 d2e47e2d76ca5c2a31a377accf06bafb579feba4f110b81b36e5a1f7be01b036 PUBLIC-CONSTANT

## Canonical matched cost trials (identical workload shape; interleaved)

| trial | scale | leaf cfg | dm | group | sync | probe | leaf idle egress+ingress B/min | seed phase egress | relay phase egress | unsafe retries | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 3 | {}  | 12/12 | 12/12 | 20/20 | 160/160 | n1:846409 n2:1654560 | 3776604 | - | 0 | yes |
| shed_normal | 3 | {"byte_policy":"shed_normal"}  | 12/12 | 12/12 | 20/20 | 160/160 | n1:1204173 n2:1435585 | 3711813 | - | 0 | yes |
| baseline | 6 | {}  | 12/12 | 12/12 | 20/20 | 320/320 | n1:1577000 n2:1289644 n3:970481 n4:1040011 | 7548277 | 8304279 | 0 | yes |
| shed_normal | 6 | {"byte_policy":"shed_normal"}  | 12/12 | 12/12 | 20/20 | 320/320 | n1:1545113 n2:2030771 n3:825650 n4:1421955 | 6532736 | 7133679 | 0 | yes |
| baseline | 9 | {}  | 12/12 | 12/12 | 20/20 | 560/560 | n1:1259775 n2:1413783 n3:936729 n4:858405 n5:834559 n6:720161 n7:775961 | 10907276 | 11864732 | 0 | yes |
| shed_normal | 9 | {"byte_policy":"shed_normal"}  | 12/12 | 12/12 | 10/20 | 560/560 | n1:1367613 n2:1668333 n3:789713 n4:916786 n5:687189 n6:829839 n7:847480 | 12632797 | 13481212 | 0 | NO |
| shed-sweep180 | 9 | {"byte_policy":"shed_normal"}  | 12/12 | 12/12 | 20/20 | 560/560 | n1:2596319 n2:3725348 n3:1479167 n4:1422334 n5:1488318 n6:1316966 n7:1329796 | 10872207 | 11375907 | 0 | NO |

Delivery cells are delivered/total-intended-recipient-pairs from the
message-identity ledger; lost/unknown/duplicated counts are in verdicts.json.

## Debug lineage (battery bring-up: observation bugs found and fixed — kept for the record, NOT evidence)

| trial | scale | run | dm | group | sync | probe | pass |
|---|---|---|---|---|---|---|---|
| baseline | 3 | p1c-p1 | 0/12 | 12/12 | 0/20 | 0/160 | NO |
| baseline | 3 | p1d-p1 | 12/12 | 12/12 | 0/20 | 160/160 | NO |
| baseline | 3 | p1e-p1 | 12/12 | 12/12 | 0/20 | 160/160 | NO |
| baseline | 3 | p1f-p1 | 12/12 | 12/12 | 20/20 | 160/160 | yes |
| dbg | 6 | dbg2 | 0/12 | 12/24 | 0/20 | 0/320 | NO |
| dbg | 6 | dbg3 | 12/12 | 12/24 | 0/20 | 320/320 | NO |
| baseline | 6 | run01-p2-s6-r0-baseline | 12/12 | 12/24 | 20/20 | 320/320 | NO |
| shed_normal | 6 | run01-p2-s6-r0-shed_normal | 12/12 | 12/24 | 20/20 | 320/320 | NO |
| baseline | 9 | run01-p2-s9-r0-baseline | 12/12 | 12/42 | 20/20 | 560/560 | NO |
| shed_normal | 9 | run01-p2-s9-r0-shed_normal | 12/12 | 12/42 | 20/20 | 560/560 | NO |

## Recovery drills

- **kill9-restart** (rec02-rec): {"identity_preserved":true,"node":"n2","note":"UNKNOWN DM must stay UNKNOWN until evidence; recovery never auto-resends","restart_secs":1.025,"unknown_op":"«hex64…1e0823»"}
- **partition** (rec02-rec): {"node":"n3","note":"ready-but-partitioned must not count as delivery; outcomes resolve only from evidence after heal","parted_ops":["«hex64…887d77»","«hex64…370c0f»","«hex64…370c0f»"],"ready_while_partitioned":true}
- **revocation** (rec02-rec): {"note":"revocation must reach every online observer; never shed","observed_by":3,"observers":3,"op":"«hex64…32201c»","sacrificial_node":"n4"}
- **corrupt-state** (rec02-rec): {"files_flipped":1,"identity_preserved_after":false,"node":"n1","note":"fail-closed or quarantined with identity preserved; never silent partial application","outcome":"refused: node n1 not healthy within 90s (log: /home/travi/btmd/runs/rec02-rec/n1-data)"}
- **bootstrap-removal** (rec02-rec): {"leaf_rejoined":true,"note":"rejoin via peer cache within 120s, or a NAMED degradation receipt","rejoin_secs":0.003,"seed_killed":true}
- **kill9-restart** (rec01-rec): {"identity_preserved":true,"node":"n2","note":"UNKNOWN DM must stay UNKNOWN until evidence; recovery never auto-resends","restart_secs":1.006,"unknown_op":"«hex64…317830»"}
- **partition** (rec01-rec): {"node":"n3","note":"ready-but-partitioned must not count as delivery; outcomes resolve only from evidence after heal","parted_ops":["«hex64…231acf»","«hex64…8932de»","«hex64…d2e44c»"],"ready_while_partitioned":true}

## Continuity

- {"run":"con01-cont","dm_delivery_works_after":true,"from":"v0.46.0","group_visible_after":true,"identity_preserved":true,"note":"same identity+data dirs, fresh processes, replaced binary — the cold-replacement trial","store_value_readable_after":false,"to":"v0.47.1"}
- {"run":"con01-cont","downgrade_probe":"v0.47.1 -> v0.45.0","note":"expected: fail-closed refusal (X0XKVS2), no corruption","outcome":"started (X0XKVS2 accepted?)"}
- {"run":"con02-cont","dm_delivery_works_after":true,"from":"v0.46.0","group_visible_after":true,"identity_preserved":true,"note":"same identity+data dirs, fresh processes, replaced binary — the cold-replacement trial","store_value_readable_after":true,"to":"v0.47.1"}
- {"run":"con02-cont","downgrade_probe":"v0.47.1 -> v0.45.0","note":"upstream-documented law: 0.45 fails closed on X0XKVS2; files kept, access refused — verified, not assumed","store_read_outcome":"refused/absent: value not served (fail-closed or format refused)"}

## Notes

- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"1","run":"p1c-p1"}
- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"2","run":"p1c-p1"}
- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"1","run":"p1d-p1"}
- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"2","run":"p1d-p1"}
- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"1","run":"p1b-p1"}
- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"2","run":"p1b-p1"}
- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"1","run":"dbg2"}
- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"2","run":"dbg2"}
- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"1","run":"dbg3"}
- {"0":"s","1":"t","2":"o","3":"r","4":"e","5":" ","6":"j","7":"o","8":"i","9":"n","10":" ","11":"s","12":"t","13":"i","14":"l","15":"l","16":" ","17":"p","18":"e","19":"n","20":"d","21":"i","22":"n","23":"g","24":" ","25":"a","26":"t","27":" ","28":"n","29":"2","run":"dbg3"}
