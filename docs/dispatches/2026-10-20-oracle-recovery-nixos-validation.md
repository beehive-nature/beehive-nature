# Oracle recovery and native NixOS validation

Work began October 19 and continued October 20, America/Denver.

This continues the BNRoSe shadow validation at x0x PR #4 revision
`85633f6a6dfea44e62a0cad778aa429275fc4604`. PR #4 remains open and unmerged.
The shadow remains opt-in and observational; VPS capacity does not acquire
authority over other peers, their resources, or participation.

## Oracle evidence

The signed-in OCI console showed tenancy `travisremington`, Phoenix as the
only listed subscribed region, and no compute instances in the root compartment.
Resource Explorer with all compartments showed the original 47 GB boot volume
`instance-20260811-1804 (Boot Volume)`, available and unattached in AD-1.
Its source image metadata identifies Ubuntu 24.04 aarch64. This is image
provenance, not a live OS measurement. No NixOS replacement was established.

Native Windows SSH to the historical address timed out during banner exchange.
No current Oracle OS, SSH authentication, node health, or live mesh was verified.

After user authorization, attempted recovery from that preserved volume as
`bnr-recovery`, using Always Free-eligible A1, one OCPU and 6 GB RAM,
an existing VCN/subnet and a public IPv4 address. No new SSH keys were supplied.
In-transit volume encryption remained enabled.

OCI rejected the launch with:

> Out of capacity for shape VM.Standard.A1.Flex in availability domain AD-1.

This attempt created no working compute instance. A direct boot-volume launch
must use the volume's availability domain; cloning also stays within that
domain. Backup-and-restore provides the supported cross-domain recovery path.
See [Oracle instance creation](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)
and [boot volume restore](https://docs.oracle.com/en-us/iaas/Content/Block/Tasks/create-restore-bv-boot-volume-backup.htm).

Created a full recovery backup, `bnr-recovery-preserved-2026-10-19`.
OCI confirmed Available, 45 GB backup / 47 GB volume. The original disk
remains intact. The account is Free Tier; Oracle documents five included
volume backups and 200 GB volume storage in its
[Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

Restored two 47 GB recovery copies, `bnr-recovery-ad2-2026-10-19` and
`bnr-recovery-ad3-2026-10-19`. Both were confirmed Available and Always Free.
Attempts to launch the same one-OCPU / 6 GB A1 configuration in AD-2 and AD-3
also returned the explicit out-of-capacity API error for their respective
domains. No working replacement instance was created in any of the three
domains. The final inventory from this recovery is the original 47 GB disk,
two 47 GB copies (141 GB total), and one full backup (45 GB actual data).
These are retained for recovery; none was deleted or overwritten.
Only one recovery copy should be booted if capacity becomes available, since
the copies preserve the same disk state and may contain the same node identity.

No firewall, SSH alias, DNS, keys, account upgrade, or paid shape was changed.
The historical SSH alias is not a verified route to a running node. Restoring
Oracle still requires available ARM capacity; no live OS or node-health claim
can be made from a detached volume's image metadata.

## Native NixOS source validation

Hostinger again reported NixOS 26.05, build 26.05.20260829.c5c4a43, and an
active x0x service. The native source build uses the unchanged PR revision,
Rust 1.95.0, the tracked Cargo.lock, and the existing flake lock's nixpkgs
revision `09063bd1f2b36fd9fd793c36dfade7bd40a93dfc`.

Its loopback health endpoint reported healthy, x0x 0.46.0, 22 peers and
22 send-ready peers, with zero systemd restarts. This is existing production
node health, not deployment of PR #4 or an end-to-end delivery receipt.

The build runs in a temporary systemd unit with a dynamic unprivileged user,
protected home directories and system files, no new privileges, two CPU
equivalents, 8 GB memory maximum, and low scheduler priority. Network access
is used to retrieve public toolchains and dependencies. Selected tests are
the eight inert shadow controls, not daemon or live-network tests.

Initial setup failed before compilation because the dynamic user's state
mount was noexec. The final launcher explicitly permits execution within
that unit's own build directory; it does not alter production mounts or
service settings. The full journal retains these failed setup attempts.

The native release build passed in 12m 21s. All six release example controls
passed, none filtered or ignored, in 0.02s. Compiling the full library test
executable then exhausted the unit's 8 GB memory limit before its two selected
encoder tests ran. This was a compile-time resource failure, not a passing
test run. The unfinished selector was retried separately with one compile
job, a 16 GB limit and networking disabled; the host reported about 30 GB
available before this bounded retry.

The retry retained its two-CPU quota. Inspection showed the compiler using
one CPU and negligible quota throttling; increasing the quota would not
address the long optimized library-test compilation.

The retry completed successfully after 23m 17s compilation. Both encoder
tests passed in 0.23s: zero failed or ignored, 3,962 unrelated tests filtered
out. The unit exited successfully with an 8.4 GB recorded memory peak.
Together with the six example controls, all eight focused tests passed
from native NixOS source builds. No full native daemon suite was executed.
The final health check at 06:25:59 UTC still reported an active, healthy
production node, 21 send-ready peers, and zero restarts.

The source-built release binary also completed a separate PrivateNetwork
smoke run: 32 paired rounds, 2,048 observations per arm, release assertions
disabled, 7,415-byte wire, 136-byte observer, no network bytes or journal
fsyncs. The sample was taken while compilation was active and is a functional
smoke receipt, not a new comparative performance result. A first launch
could not resolve the namespace-only executable path; running a shell that
executes the bound binary corrected this without relaxing network isolation.

Native binary SHA-256: `092ba2c4c2e4441de8530bf4d37f66e776dc5bfd1fee46af6279483c18222778` (PUBLIC-CONSTANT).

Native cargo-audit 0.22.2 scanned 582 dependencies against advisory database
`999ec89d5d3f10f20be14750ec8c2d8b44e0ac9b` (1,338 advisories) and exited zero:
zero vulnerabilities, seven informational warnings, no ignored advisories.
Warnings: atomic-polyfill, audiopus_sys, bincode, paste, rustls-pemfile and
unsafe-libyaml unmaintained; lru unsound. This differs from the previous
hosted CI warning set and does not supersede its historical receipt.
An initial audit invocation could not refresh the registry; repeating with
the build's populated Cargo home completed without stderr. JSON is retained.

## Separate unresolved invitation failure

`non_creator_admin_invite_e2e_converges_through_real_daemons` failed in
run 39223803733 because the invitation lacked the base-member snapshot needed
to derive creator provenance. Neither the shadow work nor this infrastructure
recovery repairs or re-earns that result. No claim of all x0x CI green is made.

The previously measured 21.76% to 9.09% reduction concerns additional shadow
overhead only. It is not evidence of a production throughput improvement.

The security boundary is unchanged: `src/bnrose_shadow.rs::verify_baseline`
calls the existing announcement verifier before accepting locally selected
peer identity and signed freshness, and `ShadowObserver::observe` calls that
baseline even for duplicates. The adapter remains off by default and has no
production ingress connection. These source properties and focused tests
do not establish live post-quantum negotiation across the mesh.

PR #4's head remains unchanged, with 32 successful checks and two scheduled
skips. The native pass does not replace the earlier comparative benchmark.
Oracle ARM execution and live-mesh validation remain unexecuted because
Oracle has no running replacement instance.

Scripts, complete build/test journals, audit JSON, smoke samples and health
receipts are retained in
[`../receipts/bnrose-x0x-shadow-003/`](../receipts/bnrose-x0x-shadow-003/).
