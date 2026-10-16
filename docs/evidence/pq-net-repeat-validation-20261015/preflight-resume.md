# Preflight rig interruption and resume

After qvc completed at 19:09:03 UTC, qvd's preflight at approximately
19:10:33 UTC detected a btmd namespace and stopped before starting the
trial. A follow-up inventory contained only the preexisting wa/wb
namespaces. The conflicting namespace was already gone, so its owner and
start time were not established. No overlap with a completed measurement
was demonstrated; do not infer a start time from this check.

The resume runner starts at plan index 3 (qvd). It leaves qvi, qvj and qvc
unchanged, checks their successful receipt/host records before launch, and
waits for btmd namespaces as well as compilers to clear. The same final
preflight still refuses a race. No namespace is removed by this guard.
The four-pair order, acceptance criteria and analysis are unchanged.
