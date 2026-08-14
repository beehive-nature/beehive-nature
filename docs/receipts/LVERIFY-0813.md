# LVERIFY-0813 — L-VERIFY batch receipts (4 repos, raw LICENSE bytes at pinned refs)

**Dispatch:** CCODE DISPATCH — L-VERIFY-BATCH-0813, received via chat relay 2026-08-14.
Not present in `docs/dispatches/` at execution time (checked first per §2a; latest mailbox
entry was DISPATCH-2026-08-11-TEN-TARGET, whose own L-VERIFY line this batch executes).
**Seat:** 3 (Claude Code). **Verify-only — no code, no integration.**

**Method.** Each repo cloned locally (`git clone --no-checkout`, schannel TLS), LICENSE
bytes read straight from the object store with `git cat-file blob <ref>:<file>` — never a
checkout, so no CRLF smudge can touch the bytes; never a badge, sidebar, or README claim.
Digests via Git Bash `sha256sum` on raw stdin (law §12; no PowerShell pipes). Canonical
license texts fetched from their home oracles (gnu.org, apache.org) and hashed the same
way for byte-identity comparison. Every sha256 line below carries a trailing
`PUBLIC-CONSTANT` marker required by `scripts/secret-scan.sh`; the marker is an
annotation for the scanner — the digest bytes themselves are unedited output.

## Receipts table

| # | Repo @ ref | Commit (pin) | License | Copyright line (verbatim) | Nonstandard clauses / notes | sha256 of LICENSE (raw stdin) |
|---|---|---|---|---|---|---|
| 1a | bashalarmistalt/decimen-optical-transfer @ **v0.3.0** | `29cba8fa25dd160c8b6aa18fe3b48fbc5bde2e36` | **MIT** (standard text, 1,085 B) | `Copyright (c) 2026 Evan Crawley (Bash Alarmist)` | None — unmodified MIT template, copyright line filled | `b4c142c56e708391eed86e70d4083012b2184b16ec38bacca3b7d5c3657b4771` <!-- PUBLIC-CONSTANT: LICENSE digest --> |
| 1b | bashalarmistalt/decimen-optical-transfer @ **HEAD** (main) | `3c4c864fb139dd2222fc1fada604fccbf0fe620b` | **AGPL-3.0** (LICENSE byte-identical to gnu.org canonical, 34,523 B; NOTICE elects **AGPL-3.0-or-later**) | LICENSE carries only the FSF document line; project line is in NOTICE: `Copyright (c) 2026 Evan Crawley (Bash Alarmist)` | None in LICENSE. NOTICE records: releases ≤ v0.3.0 remain MIT; Steve Dakh's MIT-licensed portions incorporated under MIT terms; vendored `vendor/decimen-codec` (AGPL) incorporates zxing-cpp (Apache-2.0) | `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0` <!-- PUBLIC-CONSTANT: LICENSE digest = gnu.org canonical --> |
| 2 | bluesky-social/jetstream @ HEAD | `9a30defd224e9058814a7d6ce8d9e4fc48d5493c` | **MIT OR Apache-2.0** (dual, downstream's choice — LICENSE-DUAL, LICENSE-MIT, LICENSE-APACHE) | `Copyright (c) 2022-2026 Bluesky Social PBC, and Contributors` (in LICENSE-DUAL; LICENSE-MIT itself carries no copyright line) | None. LICENSE-APACHE (11,358 B) is byte-identical to apache.org canonical. Dual-choice motivated by Apache-2.0 patent assurance (LICENSE-DUAL's own words) | DUAL `f10b687a9d63462cabec80c5ce4889e6372a855e77ead75b02ad318003b12cbe` <!-- PUBLIC-CONSTANT: LICENSE-DUAL digest --> MIT `508a77d2e7b51d98adeed32648ad124b7b30241a8e70b2e72c99f92d8e5874d1` <!-- PUBLIC-CONSTANT: LICENSE-MIT digest --> APACHE `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` <!-- PUBLIC-CONSTANT: LICENSE-APACHE digest = apache.org canonical --> |
| 3 | livekit/rust-sdks @ HEAD | `9e3b4f8c30f7cc65ce76b3894ce106c882615b83` | **Apache-2.0** (11,357 B — differs from apache.org canonical by exactly one leading blank line; appendix `[yyyy]` placeholder left unfilled, standard GitHub-template form) | `Copyright 2023 LiveKit, Inc.` (in NOTICE) | None in LICENSE. Tree carries vendored `soxr-sys/src/LICENCE` = **LGPL-2.1-or-later** (SoX Resampler) and `webrtc-sys/NOTICE.md` (Apache-2.0 patch attributions). The ledger's separate "LiveKit Model License" fence (turn-detection models) is NOT in this repo — that fence stays armed for the model repos | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` <!-- PUBLIC-CONSTANT: LICENSE digest --> |
| 4 | block/buzz @ HEAD | `1f4c69eccf012dc58737e9265498397215c706c5` | **Apache-2.0** (11,338 B — terms byte-identical to canonical; appendix modified, see notes) | `Copyright 2026 Block, Inc.` (line 195, inside the how-to-apply appendix) | Terms (§1–§9) unmodified. Appendix deltas only, receipted by diff below: the `Copyright [yyyy] [name of copyright owner]` placeholder is removed and `Copyright 2026 Block, Inc.` is inserted after the license-URL line. No added clauses. Sub-licenses in tree: `desktop/public/pow/LICENSE.txt` = MIT © 2023 Emerge Tools, Inc.; `desktop/src-tauri/resources/pocket-voices/NOTICE.md` = Kyutai VCTK preset provenance with per-file sha256 pins | `108cb15997e51b75a8d18b0c1e2c52bd3879d051ab02118973387df1e4aab584` <!-- PUBLIC-CONSTANT: LICENSE digest --> |

## Target 1 — the claimed MIT→AGPL-3.0 flip: CONFIRMED

- MIT through tag **v0.3.0** (commit `29cba8fa25dd160c8b6aa18fe3b48fbc5bde2e36`, 2026-08-03).
- Flip lands at commit `dd827314741613b983e4a9662979d0bf137dccf2` (2026-08-09), released as
  **v0.4.0**; HEAD of main (`3c4c864fb139dd2222fc1fada604fccbf0fe620b`) is AGPL.
- Same flip commit introduces **CLA.md + CLA-ENTITY.md** (contributor license agreement)
  and NOTICE. Raid-doctrine note: a CLA concentrates future relicensing power in the
  author — the MIT→AGPL move was exercised once and is now structurally repeatable.
- NOTICE states releases ≤ v0.3.0 "remain available under those terms" (MIT), so the
  v0.3.0 snapshot is a usable MIT pin; anything ≥ v0.4.0 is AGPL-3.0-or-later with §13
  network-source obligations (same fence class as listmonk/RustDesk/Documenso in
  DISPATCH-2026-08-11-TEN-TARGET: run as service-behind-API, never merged into the core).

```
$ git log --format='%H %ad %s' --date=short --follow -- LICENSE
dd827314741613b983e4a9662979d0bf137dccf2 2026-08-09 v0.4.0: relicensed to AGPL-3.0-or-later, contributor CLA, decimen-codec tracked-decode engine, diagnostics rig, published benchmark records
b68f54062c3c0da1ab34e673d357bfe92ab25ce7 2026-08-03 v0.3.0: Android capability probing, inline media playback, share dialogs, UX overhaul, added legal name to license
13e86c26a187882637015b9267bb0361d67f1033 2026-07-30 Initial commit
```

## Command receipts (unedited output; digest lines carry the scanner marker only)

```
$ git cat-file blob 'v0.3.0^{commit}:LICENSE' | sha256sum        # decimen-optical-transfer
b4c142c56e708391eed86e70d4083012b2184b16ec38bacca3b7d5c3657b4771 *-   PUBLIC-CONSTANT
$ git cat-file blob HEAD:LICENSE | sha256sum                     # decimen-optical-transfer
0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0 *-   PUBLIC-CONSTANT
$ git cat-file blob HEAD:LICENSE-DUAL | sha256sum                # jetstream
f10b687a9d63462cabec80c5ce4889e6372a855e77ead75b02ad318003b12cbe *-   PUBLIC-CONSTANT
$ git cat-file blob HEAD:LICENSE-MIT | sha256sum                 # jetstream
508a77d2e7b51d98adeed32648ad124b7b30241a8e70b2e72c99f92d8e5874d1 *-   PUBLIC-CONSTANT
$ git cat-file blob HEAD:LICENSE-APACHE | sha256sum              # jetstream
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30 *-   PUBLIC-CONSTANT
$ git cat-file blob HEAD:LICENSE | sha256sum                     # rust-sdks
c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4 *-   PUBLIC-CONSTANT
$ git cat-file blob HEAD:LICENSE | sha256sum                     # buzz
108cb15997e51b75a8d18b0c1e2c52bd3879d051ab02118973387df1e4aab584 *-   PUBLIC-CONSTANT
```

Foreign-oracle canonical texts, fetched and hashed on the same raw-stdin lane:

```
$ curl -s https://www.gnu.org/licenses/agpl-3.0.txt | sha256sum
0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0 *-   PUBLIC-CONSTANT
$ curl -s https://www.apache.org/licenses/LICENSE-2.0.txt | sha256sum
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30 *-   PUBLIC-CONSTANT
```

decimen HEAD LICENSE = gnu.org byte-identical; jetstream LICENSE-APACHE = apache.org
byte-identical. rust-sdks vs apache.org — one leading blank line, nothing else:

```
$ diff /tmp/apache-oracle.txt /tmp/apache-canonical.txt
1d0
<
$ wc -c /tmp/apache-oracle.txt /tmp/apache-canonical.txt
11358 /tmp/apache-oracle.txt
11357 /tmp/apache-canonical.txt
```

buzz vs canonical Apache-2.0 (base = rust-sdks text) — appendix-only deltas:

```
$ diff /tmp/apache-canonical.txt /tmp/buzz-license.txt
189,190d188
<    Copyright [yyyy] [name of copyright owner]
<
195a194,195
>
> Copyright 2026 Block, Inc.
```

## S-7 BNRiV3PermaLock — STOP-REPORT (cannot execute on this tree)

The dispatch's second lane orders: hardcode 100% ARTIST collect() routing for BNRi, add
the do-not-generalize spec note to S-7, update the CONSENT-1 presale disclosure to match.

**Searched before acting (law §11):** `S-7`, `BNRiV3`, `PermaLock`, `CONSENT-1` across
beehive-nature, LOVErnment-DAO, bnri-cosmic, b-accord, b-domain, bn-fleet, bnr-mirror,
bnr-probe, b-onboard, lobster, wh, loviswaternakamoto, code, autonomi, source, Documents,
dist-windows.

- **No S-7 spec exists on this tree.** No file, no section, no contract source names
  BNRiV3PermaLock or any S-numbered spec series.
- **No CONSENT-1 document exists on this tree** — in particular no presale disclosure.
  CONSENT-1 appears only as a pattern name in code comments
  (`crates/bsigner/src/{lib.rs,device.rs}`, `bnri-cosmic/src/{main.rs,wallet.rs}`:
  "disclose-and-confirm"), which reference it as a spec that is "a later order."
- **The 80/20 tripwire does not fire:** no document on this tree states an 80/20 (or any
  other) collect() split for BNRi. The blocker is absence, not contradiction.

**Report:** the S-7 spec and CONSENT-1 presale disclosure this order amends have not
landed on this box — they presumably live on another seat's tree. Executing here would
mean authoring both documents from a one-paragraph relay, i.e. inventing governed text
(the confirmed routing constant, the token pair, burn posture, and permissionless-collect
posture would all be first written here, unreviewed). Escalating instead of resolving.
**Needed to unblock:** the S-7 spec file and the CONSENT-1 document (or their repo/path),
dispatched to this box; the routing edit itself is then mechanical.

---

*Seat 3, 2026-08-14. Clones live in the session scratchpad only; nothing from the four
repos was vendored, copied, or integrated. Both tokens of the S-7 lane remain untouched.*
