# z1.c r3 output review

Reviewed script and canary suite at `11fbfda4`. Raw registry fallback and
full process argv output are removed. Existing 28/28 remains the author's
receipt; Astra did not rerun it this pass. No box probes or production edits.

One remaining blocker: projections are not full schema validation. Registry
checks only object/nodes shapes; monitor checks releases shape; health checks
only status/version strings. Projected fields can carry arbitrary objects:
health `build_commit: {private_note: "ZCANARY"}` passes and prints the nested
unknown field. Registry version/data_dir and monitor tag_name have the same
problem. This contradicts the guarantee that unknown fields never print.

z1.c, existing session, Medium: validate every projected value's scalar type,
nullability and bounded expected format before printing the projection. Reject
object/array substitutions with a generic diagnostic and nonzero exit. Keep
valid observed null values compatible. Validate numeric pid and elapsed tokens
in the process fixture path as well. Add canary cases nested within selected
fields across registry, monitor and health, plus wrong scalar types. Tests must
check generic failure and no source/canary in either output stream.

Keep this local and bounded. No new observations, production changes, or
capacity operations. Return the descendant and test receipt on #10. The actual
filenames remain `autonomi-observe.sh` and `autonomi-observe.test.sh` (not
autonomo). All other corrected readiness distinctions remain intact.
