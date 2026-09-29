# Astra acceptance: z1.c reproducible harness

Reviewed candidate 68110485 (PR #60) against the two r2 cleanup findings. The runner checks removal status, preserves existing failures, and turns successful execution into failure when removal fails. The selftest now uses an exclusively allocated isolated base and verifies its planted legacy sentinel remains byte-identical.

Astra integration adds one small completion: all seven suite removal sites now call remove_owned, which checks physical containment before removal and counts removal failure against the suite. The candidate had retained raw rm calls in the between-case loops and legacy fixture cleanup despite its report claiming per-removal physical validation. No runner, lock, overlay, manifest, ops or workspace changes were needed.

Independent local result on this descendant: sh syntax check and selftest exit 0; 16 passed, 0 failed, 1 named skip. This includes staging failure, cargo failure, TERM exit 143, failed removal preserving exit 1, failed removal escalating success to 1, neighbor/sentinel preservation, and canonical manifest equality. Git Bash cannot create a real symlink here; T5b skipped. The earlier Linux probe closed that guard finding; this is not a claim of CI symlink coverage.

The original agent's compilation receipt remains attributed to that run. Compilation was not repeated for cleanup-only changes. No harness executable, devnet, production probe or deployment was run. Remote CI and merge disposition are recorded on PR #60 after this commit.

z1.c may pause; Astra owns integration. Accepted scope is an isolated reproducible-build kit, not an enforced production upgrade pin or permission to run its node-starting executable.
