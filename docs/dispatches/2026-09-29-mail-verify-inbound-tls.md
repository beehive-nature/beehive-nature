# MAIL LANE: the 08-31 STARTTLS finding withdrawn, and the on-box instrument (PR #260)

date 2026-09-29 · seat Claude Code (author) · PR
[#260](https://github.com/beehive-nature/beehive-nature/pull/260), branch
`mail/verify-inbound-tls`.

**Current TLS state on the box: UNVERIFIED until an authorized operator runs
the pinned script on the host.**

## what was withdrawn, and why

On 2026-08-31 this seat reported that `agents.skaists.buzz` did not advertise
STARTTLS. Re-run on 2026-09-29 with a control, the same canned capability set
(`250-Requested mail action okay, completed` / `250-SIZE 20000000` /
`250-8BITMIME`) came back from `gmail-smtp-in.l.google.com:25` and from
`smtp.gmail.com:587`. Both of those require STARTTLS and advertise a different
SIZE. `outlook-com.olc.protection.outlook.com:25` passed through and did show
STARTTLS. So an intercepting SMTP path on this seat's own line was answering
for every destination, and the 08-31 probe measured that path, not the box.
The finding is void. That does not prove STARTTLS works on the box; it means
that probe cannot say either way. `docs/agents/WALLET-LEDGER.md:46` carried
the same gap and now has a dated withdrawal note after it (history kept).

## review, round 1

- Independent review of head `03d83225a`:
  <https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5882251537>
  (the §4 `/dev/tcp` probe failed under dash and read every target BLOCKED;
  false plaintext-fallback and expiry claims in §3; an empty EHLO transcript
  read as a real gap; start time silently dropped).
- Fixed in `c8e22e05f`.
- Reviewer recheck under dash, all four resolved:
  <https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5882389501>

## review, round 2 (this commit): items A to H

- **A** §3: a MISSING cert or key now says the next restart will fail
  (load_cert_chain raises) and that a running process may still hold a context
  loaded before the file went missing.
- **B** §1: the pid comes from whichever tool found the listener (`pid=` from
  `ss`, or `lsof -t`). "start time not visible — rerun with sudo" stays.
- **C** §1: `ps -o args=` removed; only `comm`, pid and start time are printed.
- **D** §1: the process start (from `/proc/<pid>/stat` field 22 plus `btime`)
  is compared in epoch seconds with the mtime of the deployed sink.py (path
  in `SINK_PY`, default `/opt/buzz-mail/sink.py`). A newer file prints a STALE
  warning. The file's sha256 is printed. A missing file or an unreadable start
  says so.
- **E** §3: the cert must parse (`openssl x509 -noout`) first; otherwise
  CERT DOES NOT PARSE and no expiry check.
- **F** §3: the key must parse, and the sha256 of its public key is compared
  with the cert's. Only MATCH or MISMATCH is printed. `-passin pass:` makes an
  encrypted key fail rather than wait on a prompt.
- **G** §4: after the control passes, each target is resolved with
  `getent ahosts` (forward only, accepts IP literals) and then probed:
  `UNKNOWN (DNS)`, `OPEN`, `NO ANSWER (timeout — consistent with an egress
  filter, not proof)` on exit 124, or `REFUSED/ERROR (exit N)`. BLOCKED is gone.
- **H** the WALLET-LEDGER note above.

## receipts (Git for Windows, Git Bash)

Git Bash `sh` is bash in POSIX mode. It is **not dash**. None of the lines
below is a dash result.

```
$ sh -n scripts/buzz-mail/tls-diag.sh; echo "sh -n exit=$?"
sh -n exit=0
$ bash -n scripts/buzz-mail/tls-diag.sh; echo "bash -n exit=$?"
bash -n exit=0
$ sh scripts/lint-shell-chains.sh
scanned 41 shell file(s)
SHELL-CHAIN LINT ok — no grep -c short-circuit in tracked shell.
$ sh scripts/secret-scan.sh tree
secret-scan: clean - tree mode, 24974 tracked files scanned
$ sh e2e/hooks-installed.test.sh      (CRLF warnings and git chatter trimmed)
PASS absent-state detected: unwired repo let the vector commit (the defect SS-2 kills)
PASS installer wires the pre-commit hook delegating to the scanner
PASS hooked commit refuses the vector
PASS same-line PUBLIC-CONSTANT marker commits clean
PASS clean content commits clean
```

§3 E and F, Git Bash with OpenSSL 3.5.7 (`/mingw64/bin/openssl`). The harness
sliced the preamble helpers and the §3 body out of the file unchanged,
supplied only `CERT=` and `KEY=`, and used throwaway EC P-256 keys and certs
in a scratch directory outside the repo, deleted afterwards. The expired cert
was made with `-not_before 20200101000000Z -not_after 20200102000000Z`.
Output, cut to the verdict lines of each case:

```
CASE 1-matching-pair   key/cert pair: MATCH
CASE 2-second-key      key/cert pair: MISMATCH — the next restart will fail at load_cert_chain.
CASE 3-garbage-cert    *** CERT DOES NOT PARSE (not a readable X.509 PEM) *** — expiry not checked;
                       the next restart will fail at load_cert_chain.
                       key/cert pair: not compared — no parseable cert to compare against.
                       (no EXPIRED line)
CASE 4-expired-cert    *** THE CERT HAS EXPIRED ***   ...   key/cert pair: MATCH
CASE 5-garbage-key     *** KEY DOES NOT PARSE *** — the next restart will fail at load_cert_chain.
CASE 6-missing-cert    MISSING  <-- the next restart will fail (sink.py load_cert_chain
                       raises). A running process may still hold a context loaded before
                       the file went missing.
```

Script sha256 at round 2 (`c412905f8`): `f8000a4a…79921dc2`, superseded by
round 3 below.

## review, round 3: the negative control, and J to M

Reviewer recheck of `c412905f8`:
<https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5882748673>.
A to I verified under dash there. From the reviewer's line, `probe_tcp` read
OPEN for the unroutable 10.255.255.1 on :25, :9 and :443: something on that
path completes every handshake, and the 1.1.1.1:443 control cannot catch it.

- **Negative control (blocking)** §4: after the positive control reads OPEN,
  `probe_tcp 192.0.2.1 25` (TEST-NET-1, RFC 5737, no DNS step) must NOT read
  OPEN. If it does, the script prints NEGATIVE CONTROL OPEN and every target
  is UNKNOWN. Targets reach `egress_verdict` only when both controls pass.
- **F guard** §3: the public-key PEMs are captured raw and tested non-empty
  before comparing ("not compared — public key extraction failed"), since a
  digest of empty input is still a digest.
- **STALE wording** §1: "was modified after pid N started — the running code
  may not match it". A newer mtime shows a change, not a difference.
- **J** §2: a completed openssl STARTTLS negotiation decides the verdict
  ("STARTTLS advertised AND negotiated on loopback"); if the plain transcript
  disagrees, both are printed and the handshake is named conclusive.
- **K** `plain_verdict`: a transcript without the EHLO reply's final `250 `
  line is INCONCLUSIVE, never NOT_ADVERTISED.
- **L** §3: a readable cert or key with no openssl says "not validated —
  openssl not installed"; only an unreadable key gets the sudo line.
- **M** §3: the cert the listener serves over loopback STARTTLS is compared
  with the deployed file inside the script (both re-encoded by `openssl x509`,
  tested non-empty). Only SAME / DIFFERENT / not compared is printed, never a
  digest. The cert and key mtimes are compared with the first listener pid's
  start, or "no pid, not compared".

### round-3 receipts (Git Bash, NOT dash)

```
$ sh -n scripts/buzz-mail/tls-diag.sh; echo "sh -n exit=$?"
sh -n exit=0
$ bash -n scripts/buzz-mail/tls-diag.sh; echo "bash -n exit=$?"
bash -n exit=0
$ sh scripts/lint-shell-chains.sh
scanned 41 shell file(s)
SHELL-CHAIN LINT ok — no grep -c short-circuit in tracked shell.
$ sh scripts/secret-scan.sh tree
secret-scan: clean - tree mode, 24975 tracked files scanned
```

Slices cut unchanged with sed; the harness supplies only the inputs a section
reads from earlier sections. Verdict lines:

```
K plain_verdict   empty -> INCONCLUSIVE · greeting only (220 x) -> INCONCLUSIVE
                  truncated (220 x / 250-a) -> INCONCLUSIVE
                  complete, no STARTTLS (the 08-31 set) -> NOT_ADVERTISED
                  complete, 250-STARTTLS -> ADVERTISED · final 250 STARTTLS -> ADVERTISED
                  complete, bare final 250 -> NOT_ADVERTISED
J §2 verdict      TLS_OK + empty or truncated plain -> "advertised AND negotiated"
                    + NOTE "plain transcript reads INCONCLUSIVE ... handshake is conclusive"
                  TLS_OK + plain with STARTTLS -> "advertised AND negotiated", no NOTE
                  no TLS_OK + empty -> INCONCLUSIVE · + complete, no STARTTLS -> NOT advertised
F §3              matching pair -> MATCH · second key -> MISMATCH · garbage key -> KEY DOES NOT PARSE
L §3 (PATH with no openssl, built from copies of the needed /usr/bin tools)
                  cert not validated — openssl not installed
                  key/cert pair: cert/key not validated — openssl not installed
                  served cert: not compared — openssl not installed
M §3 (PORT=1, nothing listening)
                  served cert: not compared — no cert served over loopback (...)
                  PIDS empty -> "no pid, not compared"
                  PIDS = the harness's own pid, files made after it ->
                  "modified after pid N started — the loaded copy may differ"
§4 controls, probe_tcp STUBBED (logic only, not a network test)
                  every connect succeeds -> NEGATIVE CONTROL OPEN, both targets UNKNOWN
                  only 1.1.1.1 connects -> both controls pass, targets judged
                    (Git Bash has no getent, so they read UNKNOWN (DNS))
                  nothing connects -> CONTROL FAILED, both targets UNKNOWN
```

Not exercised here: the served-cert SAME and DIFFERENT branches (Git Bash
openssl `s_server` has no `-starttls`, and this box has no Python to stand in
a STARTTLS listener); "public key extraction failed"; the cert/key "not
modified after" branch.

Script sha256 at round 3 (`d69925711`): `ca95ef28…ae89a86c`, superseded by
round 4 below.

## review, round 4: M wording

The reviewer rechecked `d69925711` under dash, with a real STARTTLS listener
and on the real network path. The canonical-PEM compare in M was accepted.

- **M wording** §3: a comparison shows a difference, not its cause. The
  reviewer's own test read DIFFERENT because a different cert was on disk,
  with no reload involved. The line now reads "served cert: DIFFERENT from the
  deployed file — the listener on :25 is not serving it (for example, a cert
  loaded before the file changed; §1 names the process)".

Receipts (Git Bash, NOT dash): `sh -n` exit 0, `bash -n` exit 0, shell-chain
lint ok (41 files), secret-scan tree clean.

Script sha256 at round 4: `76197e76…2b426da9`.

## pending: reviewer recheck

Not run by this seat, because WSL is refused to this worktree: the `sh -n`
under **dash**, the §4 functional cases (OPEN against 1.1.1.1:443, REFUSED/ERROR
on 127.0.0.1:1, UNKNOWN (DNS) on `nonexistent.invalid`, NO ANSWER on
10.255.255.1:25), the §1 functional cases (ss `pid=` parse, the lsof fallback,
the STALE comparison against a fake `SINK_PY` older and newer than a running
process), and the full script under dash. Round 2's §1 and §4 cases were
rechecked by the reviewer (link above); round 3's negative control on a real
network path, J to M under dash, and M against a real STARTTLS listener are
**reviewer recheck pending.** No CI claim is made here.
