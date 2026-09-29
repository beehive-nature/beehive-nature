# x0x #622 measurement packet — MOVED; this path is now a pointer

> **Status (2026-09-10, correction round):** the executable content that
> lived at this path was RETURNED by backend Astra's review at `b7076f86`
> (six findings; verdict "do not run the packet as written") and has been
> replaced by a tested wrapper + corrected specification:
>
> - **Spec:** [`docs/specs/SPEC-X0X-622-CAPTURE-1.md`](../../docs/specs/SPEC-X0X-622-CAPTURE-1.md)
> - **Runner/sampler/regressions:** [`scripts/x0x-622/`](../../scripts/x0x-622/)
>   (`run-capture.sh`, `sampler.py`, `test_runner.py`)
> - **Builder dispatch with receipts:** [`docs/dispatches/2026-09-10-x0x-622-measurement-packet.md`](../../docs/dispatches/2026-09-10-x0x-622-measurement-packet.md)
> - **Astra review (verdict + six findings):** [`docs/dispatches/2026-09-10-astra-x0x-622-packet-review.md`](../../docs/dispatches/2026-09-10-astra-x0x-622-packet-review.md)
>
> `ops/` carries only what runs on the box verbatim; an uninstalled proposal
> does not belong here (correction order, 2026-09-10). The reviewed original
> remains in git history at `58aa4fc9`/`b7076f86`. The binary provenance
> (§0 of both documents) was accepted by the review and is unchanged.
> Nothing is executed on any host until Astra re-accepts and the founder
> names the host.
