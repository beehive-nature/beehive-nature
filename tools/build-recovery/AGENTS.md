# Recovery lane: native implementation and attributable evidence

- Implement new recovery logic and refusal controls in Rust. Do not introduce
  Python, JavaScript/TypeScript or shell controllers. Vaulta-native C++ belongs
  at the Vaulta contract boundary; HTML is presentation. Do not conceal runtime
  logic inside HTML or name a wrapper Rust while requiring another interpreter.
- A language exception requires a concrete task-specific reason and objective
  comparative evidence before implementation. Performance claims require an
  appropriate experimental design, independent trials, effect sizes and
  uncertainty; passing functional tests is not an exception rationale.
- Retain the signer contract, cryptography, public fixtures and source lockfile.
  Call existing Rust verification entry points instead of inventing new crypto.
- Local retained bytes, explicit pins and public verification must suffice for
  offline acceptance. No indispensable hosted service, credential or provider.
- Preserve historical source archives, runner binaries, raw logs and independent
  digest anchors. Never relabel old execution as evidence for new source.
- Qualify the executable actually delivered. Keep source/binary hashes, commands,
  exits, refusals, resource ceilings, unmeasured quantities and skipped gates
  explicit. Reconstruction, reproducibility, scalability and durability are
  different claims. Never manufacture statistical significance or intent.
- Keep H01, B9, SDK and consumer implementation with their owners; preserve their
  worktrees and timings. A whole-repository language census is an inventory,
  not proof that all remaining ports are complete.
