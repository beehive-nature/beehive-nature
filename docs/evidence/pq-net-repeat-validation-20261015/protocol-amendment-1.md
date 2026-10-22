# Protocol amendment 1 — before replacement measurements

The first baseline qva delivered 20/20 and passed the workload gates, but
three of 27 host samples contained rustc activity. Per the predeclared rule,
this trial is retained outside the primary matched comparison. qvb did not
start. This exclusion is based on observed compiler overlap, not delivery
or bandwidth outcomes.

Replace pair 1 with qvi baseline / qvj shedding. Pairs 2–4 remain qvc/qvd,
qve/qvf and qvg/qvh, preserving the original balanced policy order and four
valid pairs. Require six compiler/linker-free samples fifteen seconds apart
before every valid leg (90-second wait instead of 45 seconds). All other
workload, observer, delivery and bandwidth rules remain unchanged. Any
further overlap still stops the runner and is retained, never silently lost.

The original protocol and analysis digest record is retained. Replacement
runner and analysis filenames end in `-clean.py`; their digests are recorded
before qvi starts. Identity uniqueness also includes the excluded qva nodes.
