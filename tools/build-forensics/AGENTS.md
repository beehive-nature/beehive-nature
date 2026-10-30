# Build forensics lane

- Implement active collection, measurement and analysis in Rust. Keep the crate standalone and dependencies pinned. Do not add Python/Node controllers.
- Historical interpreters may execute only the preserved implementations being compared. Keep their bytes, source references and hashes. A historical comparator is not a new production dependency.
- Never change the signer, SDK, H01, B9 fixtures, wallet consumers or shared workflows from this lane.
- No live keys, payment, provider calls, production rollout or merge is part of this audit.
- Keep raw samples and failed attempts. Separate elapsed time, summed job time, human time and billing. Do not convert one into another.
- A language policy does not establish a performance or security effect size. Label the workload, host, uncertainty, implementation differences and missing evidence.
- Assertions about malicious intent, discrimination or policy blocking need attributable evidence. Empty or unavailable data are not zero harm.
- Preserve the original recovery snapshots and PR #496 candidate. Follow-ups belong in this separate branch.
