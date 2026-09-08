# Faceplugin / upstream face detector — raid, 2026-09-07

**Disposition: TAKE the upstream detector source only; LEAVE Faceplugin's distribution.**
This carries forward the founder's ruling supplied in chat. Face recognition remains
part of the intended Sybil/MiM resistance stack and the long-horizon 420 b maximum per
unique person. This raid evaluates components; it does not implement enrollment or
claim that uniqueness has been demonstrated.

## Evidence and scope

Read on 2026-09-07, without installing dependencies, loading weights, executing vendor
binaries, or collecting faces. Canonical facts: [A95–A97](../VERIFIED-FACTS.md).
Pins are public Git commits:

| Source | Revision | Examination |
|---|---|---|
| [Faceplugin SDK](https://github.com/Faceplugin-ltd/Open-Source-Face-Recognition-SDK/tree/621718e7d3c6c708631e15bbaaedbd88ac1b439c) | `621718e7d3c6c708631e15bbaaedbd88ac1b439c` | Complete recursive tree: 38 blobs, not truncated; README, run.py, detector, feature extraction and native-library wrapper |
| [Linzaer Ultra-Light](https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/tree/dffdddda9794a50607cba8f318507a28c1c27cab) | `dffdddda9794a50607cba8f318507a28c1c27cab` | Complete recursive tree: 229 blobs, not truncated; LICENSE, README, ONNX example and detector architecture |
| [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/47534e27c9851bb1128ccc0102f1145e27f23f98) | `47534e27c9851bb1128ccc0102f1145e27f23f98` | YuNet and SFace directory licenses and READMEs, to check the attached shortlist |

The two supplied Markdown documents are background research, not execution orders or
independently verified findings. Their embedded recommendations, quoted founder
statements, timings, legal conclusions and performance claims do not become new policy
through this import. Source fingerprints (PUBLIC-CONSTANT, document digests):

- `privacey preserving face uniqueness.md`: `f754f364ba2cf50a08e7ab3ce698a5ed2163035c2c5854a3a735617b807e980d` — PUBLIC-CONSTANT
- `OMNIVOICE-PICTURE-2026-09-05.md`: `8d2363d9c1b6fde1c11151cee7555b6233e7836ec594f6fc180c8480ca23df4e` — PUBLIC-CONSTANT

The OmniVoice document is context for separating runtime, code, weights and codecs.
This is not a new OmniVoice license audit, recovery of commit 9bcbeb3, or a speech-model
adoption. The other document's claimed 402-source research set was not supplied as a
traceable bibliography; its full survey has not been independently reproduced here.

## Four axes

| Axis | Faceplugin distribution | Linzaer upstream detector |
|---|---|---|
| Code | Python recognition pipeline invokes binary alignment/pose functions; no accompanying native source or license file found in the pinned tree | Source for a compact face detector and multiple inference paths; MIT text verified |
| Community / maintenance | Public repository and vendor contact; latest pinned commit dated 2026-09-04. No automated test harness found in this small tree; `test/` contains two images. Popularity is not validation | Public issues/PRs and documented benchmarks; latest default-branch commit dated 2022-02-10. Not archived, but maintenance risk is real |
| Compatibility | PyTorch/Python plus Windows/Linux native binaries; no demonstrated Rust, Tauri, WASM or mesh adapter | ONNX and C++ paths offer an integration route. Browser support and performance on BNR hardware remain unmeasured |
| Synergy / dependency | Vendor activation and expiry in the separate commercial SDKs are dependencies to account for; no need for them in the selected detector path | Useful local capture preprocessing. Does not supply recognition, liveness, private matching, personhood or settlement |

## What the current source actually establishes

1. **No verified distribution license.** No LICENSE/COPYING/NOTICE file was present
   in Faceplugin's complete pinned tree. Its README calls the package free and open
   source; the badge links to the repository, not to license terms. That does not
   establish redistribution rights for BNR. Correct the earlier absolute wording:
   neither a fee nor a prohibition on merely inspecting public source was established.
   The outcome is **no licensed take of this distribution**, not a claim about every
   possible legal right.
2. **Binary dependency confirmed.** [faceutil.py](https://github.com/Faceplugin-ltd/Open-Source-Face-Recognition-SDK/blob/621718e7d3c6c708631e15bbaaedbd88ac1b439c/face_util/faceutil.py)
   loads `libFaceUtil.so` (84,088 bytes) or `FaceUtil.dll` (70,656 bytes) and binds
   `align_vertical`, `getPose`, and `getPose68`. Their C/C++ source is absent from
   the tree. This prevents rebuilding/auditing those functions from this distribution;
   it is not evidence that the binaries are malicious.
3. **Example drift confirmed.** The README imports `face_recognition_sdk.FaceRecognition`;
   no such module is in the tree. [run.py](https://github.com/Faceplugin-ltd/Open-Source-Face-Recognition-SDK/blob/621718e7d3c6c708631e15bbaaedbd88ac1b439c/run.py)
   instead exposes functions and returns a tuple. Its comparison is a rescaled dot
   product with a hard-coded threshold. That number is not a calibrated probability
   of person-level uniqueness.
4. **No PAD acceptance claim.** The inspected pipeline detects, aligns, estimates pose
   and compares features; it has no observed presentation-attack decision. A successful
   photo attack was **not tested**. Replace the earlier categorical "a printed photo
   passes" with "this pipeline has no demonstrated photo/replay defense."
5. **Commercial claims stay scoped.** The [vendor site](https://faceplugin.com/)
   advertises on-premises deployment, no per-call fees, NIST ranking and iBeta Level 2.
   [Its iOS liveness API](https://doc.faceplugin.com/liveness-detection-sdk/liveness-detection-ios-sdk)
   documents license activation and expiry failures. A remote kill switch was not
   demonstrated. No independently matched report identifying this exact free SDK,
   algorithm version and evaluation scope was established in this raid. Certification
   claims remain UNVERIFIED for the target artifact; absence of a found report is not
   proof that no vendor certificate exists.

## The upstream take, precisely

Linzaer's [LICENSE](https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/blob/dffdddda9794a50607cba8f318507a28c1c27cab/LICENSE)
is MIT, copyright 2019 linzai, 1,063 raw bytes. SHA-256:
`21f0df2b54c9fef1b4f4061dd0b153bc72f071b5ce9fc04234f13ebfd093b44c` — PUBLIC-CONSTANT.

The [README](https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/blob/dffdddda9794a50607cba8f318507a28c1c27cab/README.md)
reports approximately 1 MB FP32 / 300 KB quantized models and 90–109 MFLOPs at
320×240, with WIDER FACE training provenance. These are upstream measurements,
not BNR measurements. File size excludes activation memory and runtime cost; it does
not establish XIAO-class feasibility. The old ONNX demo also imports Caffe2, so its
environment cannot be assumed to work unchanged on a current runtime.

Provenance spot-check: Faceplugin's `face_detect/vision/nn/mb_tiny.py` and Linzaer's
`vision/nn/mb_tiny.py` at these pins are byte-identical. Their SHA-256 is
`f2b99930b63f732c15353296971416fde7612a992ca362d3a6b7dc1cbe6206ef` — PUBLIC-CONSTANT.
This proves that file's correspondence, not authorship of every file in the SDK.

**Code license verified; pretrained-weight clearance incomplete.** The root MIT
license is evidence, but no independent weight-specific grant/data-rights review was
established. The WIDER FACE project page could not be retrieved during this pass;
its training-data terms are not asserted here. A dataset restriction does not
automatically settle the legal status of every derived model, either. Do not label
these weights commercially cleared or prohibited without the artifact-specific terms.

The authorized next take is detector source directly from this pin with its notice.
Before integration, select and hash the exact source subset and eligible weights,
mirror them on BNR-controlled storage, and verify the re-read bytes. **No source/weight
mirror or production integration is claimed by this reading raid.** Re-audit on a
pin, model, runtime, training-provenance or deployment-target change.

## How this fits the existing stack

The placement is a **sense adapter** under [Constitution Article III](../CONSTITUTION.md),
feeding evidence with provenance into the existing event boundary. The kernel should
not acquire a dependency on Faceplugin, a particular neural network, or its threshold.

There are four separate statements to preserve:

- Detection: a region of this frame resembles a face.
- Recognition/dedup: a measured comparison suggests two captures may represent the same person.
- Capture integrity/liveness: evidence about freshness and how the sample entered the pipeline.
- Economic eligibility: the existing root-level policy decides whether an unlock is earned.

Only the first comes from the selected detector. [capability's EvidenceClass and
BioPresence](../../crates/capability/src/lib.rs) already separate key custody from
liveness. FIDO2 or a Trezor demonstrates a property of a credential/key, not that its
holder owns no second credential. A face result likewise does not authenticate a
message's origin or stop replay/MiM; signed, session-bound capture evidence is a
separate integration requirement.

The 420 cap belongs to the human root, not each face template, model version, device,
passport or persona ([onboarding](../../crates/onboarding/src/lib.rs)). A new template
or account cannot be treated as a new entitlement. Slowing each account independently
does not itself enforce a per-person cap: one attacker may maintain many slow accounts.

Proposed first detector evaluation: locally produce bounds, confidence, model revision
and processing status (`no_face`, `multiple_faces`, `detected`, `unavailable`). Emit no
`unique_person=true`, no b credit, and no durable raw frame or public embedding.
Demonstrate ordinary capture, no face, multiple faces, model absence and actual resource
use before connecting it to enrollment. This is a proposed evaluation boundary, not a
new implemented event schema.

A potential-duplicate flag is evidence, not a conviction. It should explain uncertainty
and the available recovery/review path. Unrelated room use can continue; allowing a
flagged user to continue does not imply issuing a second economic entitlement. Exact
unlock consequences remain with the existing policy, not this detector's score.

## Corrections to the attached architecture assessment

| Claim needing a narrower statement | Evidence / consequence |
|---|---|
| YuNet and SFace share an MIT model-directory license | At the OpenCV pin above, YuNet's README licenses all directory files under MIT; SFace's licenses all directory files under **Apache-2.0**. Both are candidates, not substitutes automatically adopted over the founder's Linzaer ruling |
| All third-party weights are either commercially clean or inherit a dataset prohibition | Check each distributed artifact's grant and provenance. A permissive code license alone does not clear weights; a dataset label alone does not prove the legal conclusion about weights |
| FIDO2 / hardware custody supplies human uniqueness | Existing capability types explicitly distinguish custody and live presence. Multiple authentic devices can belong to one human |
| No template leaves a device, yet global 1:N dedup is available | A cross-person comparison needs a specified information path and trust model. Local extraction alone supplies no shared comparison; protected shares are still information leaving the device |
| Public hashes solve noisy-face dedup | An ordinary hash establishes equality of bytes. A changed capture/embedding changes those bytes; any fuzzy protected comparison needs its own reproducible security and accuracy evidence |
| PartialFace is a complete protected-gallery solution | The [authors' implementation](https://github.com/Tencent/TFace/tree/master/recognition/tasks/partialface) uses selected DCT frequency components and requires model training. Its reported image-recovery experiments do not establish an MPC gallery, unlinkability or a one-person cap |
| Fusion is sound simply because several scores are combined | Define dependence, calibration, capture threats and actual false-positive/false-negative behavior. Do not multiply nominal independence assumptions or claim immunity from a component list |
| Iris-MPC success, NIST headline rates and staged dates prove readiness for BNR face dedup | These are separate systems, datasets, thresholds and workloads. No BNR population-scale face benchmark, protected-gallery deployment or 0–30 month delivery estimate was established here |

The survey's legal section and its full biometric benchmark claims have not been
revalidated in this bounded raid and are not deployment clearance. The imported
documents remain intact in the founder's Downloads; this correction does not rewrite
their contents or promote draft proposals over existing rulings.

## Receipt / remaining boundary

Completed: source-tree inspection, license-byte hashes, four-axis sort, stack placement,
attachment corrections and a source-pinned handoff. Remaining before a production take:
exact artifact mirror, weight provenance, hardware measurements and an independent
evaluation of the recognition/liveness/private-dedup components. Nothing was installed,
no biometric data was collected, and no identity or token rule was changed.
