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
`smtp.gmail.com:587`. The 08-31 finding is withdrawn because the probe
returned an identical, atypical capability set (no STARTTLS, SIZE 20000000)
from two different Google endpoints, so it cannot be trusted as a measurement
of the box. (Gmail's servers are expected to advertise STARTTLS and SIZE
157286400 — UNVERIFIED baseline: not re-measured from a clean path in this
lane. Round 5 corrected an earlier wording that said both "require" STARTTLS,
which Gmail's inbound MX does not of senders.)

Interception of SMTP on this seat's own line is the leading explanation, but
it is UNVERIFIED: no clean-path or authenticated measurement confirms it.
`outlook-com.olc.protection.outlook.com:25` did show STARTTLS through the same
line, which only shows the prober was not uniformly blind. The inconsistent
probes invalidate the original finding; they do not prove interception was
the cause. (Round 8 withdrew earlier wording here that stated interception,
and "the 08-31 probe measured that path, not the box", as fact.)

The box's actual STARTTLS state is UNVERIFIED until the on-host run; the
withdrawal does not prove STARTTLS works on the box. `docs/agents/WALLET-LEDGER.md:46` carried
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
  `UNKNOWN (DNS)`, `OPEN` (relabelled `TCP CONNECTED ... (unauthenticated)`
  in round 6), `NO ANSWER (timeout — consistent with an egress
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
  disagrees, both are printed and the handshake is named conclusive. (That
  NOTE was removed in round 7, Z1: a handshake does not prove advertisement.)
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

Not exercised by this seat in Git Bash (the reviewer's round-3/4 recheck
later ran M against a real STARTTLS listener; see status below): the
served-cert SAME and DIFFERENT branches (Git Bash
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

Script sha256 at round 4 (`2587d8b13`): `76197e76…2b426da9`, superseded by
round 5 below.

## review, round 5: N to R, and this section's status

Five Codex items on `d69925711`, triaged valid by the reviewer.

- **N** §2: the process on :25 is identified only by `comm`, so the verdicts
  are conditional: "the process on :25 (§1 names it) offers STARTTLS; if it is
  the sink, the desk receipt stands ..." and, for NOT advertised, "if it is
  the sink, this is a real gap ...". The served-cert DIFFERENT line already
  reads conditionally (round 4).
- **O** §4: the negative control is now PER TARGET PORT. Before a target on
  port P is judged, `192.0.2.1 P` must not connect; if it does, that target
  reads `UNKNOWN (port P intercepted)`. A port-587 interceptor can no longer
  yield a connect verdict for smtp.gmail.com:587. (This replaces the single
  192.0.2.1:25 gate from round 3.)
- **P** the "both require STARTTLS" claim is withdrawn from the script header,
  this dispatch, and the PR body: Gmail's inbound MX offers STARTTLS but does
  not require it of senders. The evidence is the SIZE and missing STARTTLS in
  the canned set, not re-measured from a clean path in this lane.
- **Q** §1: if neither ss nor lsof ran, "INCONCLUSIVE: no listener tool
  available (ss/lsof missing)" and exit 3. Only a tool that ran and found
  nothing gets the needs-root-or-down text (exit 2). lsof exit 1 counts as
  "ran, nothing matched".
- **R** §1: the full sink.py sha256 line ends ` PUBLIC-CONSTANT` (sink.py is
  in this public repo), so an operator can paste it past the hex hook.
- **T** §3 (Codex item on `2587d8b13`, second round-5 commit): `-checkend 0`
  tests only the upper bound. After a good parse, notBefore is read with
  `-startdate`, converted with `date -d`, and compared with now: a future
  notBefore prints "THE CERT IS NOT YET VALID (notBefore in the future)"; an
  unparseable date prints "notBefore not checked (date unparseable)".

### round-5 receipts (Git Bash, NOT dash)

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

Slices cut unchanged with sed; STUB shell functions stand in for ss, lsof,
probe_tcp and getent where named (branching only, not a network test):

```
Q  no ss, no lsof (Git Bash has neither)         -> INCONCLUSIVE ... [exit 3]
   STUB ss exits 1, no lsof                      -> INCONCLUSIVE ... [exit 3]
   STUB ss exits 0, reports nothing              -> REFUSING TO GUESS: ss ran ... [exit 2]
   STUB lsof exits 1 (ran, no match)             -> REFUSING TO GUESS: lsof ran ... [exit 2]
   STUB lsof exits 2                             -> INCONCLUSIVE ... [exit 3]
O  192.0.2.1 connects only on 587                -> gmail-smtp-in:25 judged (OPEN);
                                                    UNKNOWN (port 587 intercepted) smtp.gmail.com:587
   192.0.2.1 connects on every port              -> both targets UNKNOWN (port P intercepted)
   clean path                                    -> NO ANSWER gmail-smtp-in:25 · OPEN smtp.gmail.com:587
   positive control fails                        -> CONTROL FAILED, both UNKNOWN
R  sink_file_report on the repo's own sink.py    -> the sha256 line ends " PUBLIC-CONSTANT"
T  cert valid now                                -> no notBefore line
   cert with -not_before 20300101000000Z         -> THE CERT IS NOT YET VALID (notBefore in the future)
   cert valid 2020-01-01..02                     -> THE CERT HAS EXPIRED, no NOT YET VALID line
   STUB date() that fails                        -> notBefore not checked (date unparseable)
```

These round-5 receipts show the labels as they were then: the target outcome
OPEN is `TCP CONNECTED ... (unauthenticated)` since round 6, and the Q message
gained "or failed".

Script sha256 after the first round-5 commit (`2989db565`): `ccf2fef2…9a87f2ca77`,
superseded by the T commit: `3398de8b…1d0fca26`, superseded by round 6 below.

## review, round 6: U to X

Round 5 passed the reviewer's dash recheck:
<https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5883041109>.
Three Codex items on `94bad057d`, triaged valid, plus the reviewer's Q nit.

- **U** §4: a successful probe is only an unauthenticated TCP connect; a
  destination-selective proxy could answer for Google while 192.0.2.1 stays
  closed. The target outcome now reads "TCP CONNECTED  host:port
  (unauthenticated — not proof the named host answered)" instead of OPEN, and
  the trailing OCI-shape note says the same. The positive control keeps its
  wording: it only proves the probe works.
- **V** the Gmail baseline (STARTTLS and SIZE 157286400) has no source in this
  lane and is labelled UNVERIFIED in the script header, this dispatch and the
  PR body. The withdrawal does not rest on it: the same canned set came back
  from both Google destinations, while Outlook's MX passed through showing
  STARTTLS. (Round 7 corrected this bullet's earlier "every tested
  destination".)
- **W** §3: `openssl x509 -noout` reads only the first cert in the PEM, while
  sink.py's `load_cert_chain` reads the whole file. The sink's own call is now
  run through python3 (timeout 15) as the authority: "load_cert_chain (the
  sink's own call): OK", or "FAILS — the next restart will fail at
  load_cert_chain (<exception class name>)"; only the class name is printed.
  No python3, a missing file, an unreadable file, or no usable result each
  say "not checked" and why. The openssl checks stay as finer detail.
- **X** §1: the Q message reads "(ss/lsof missing or failed)".

### round-6 receipts (Git Bash, NOT dash)

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

Slices cut unchanged; stubs as in round 5 (branching only):

```
U  192.0.2.1 connects only on 587   -> TCP CONNECTED  gmail-smtp-in.l.google.com:25  (unauthenticated — ...)
                                       UNKNOWN (port 587 intercepted)  smtp.gmail.com:587
   clean path                       -> NO ANSWER gmail-smtp-in:25 · TCP CONNECTED smtp.gmail.com:587 (unauthenticated — ...)
X  no ss, no lsof                   -> INCONCLUSIVE: no listener tool available (ss/lsof missing or failed) ... [exit 3]
W  no python3 on PATH               -> load_cert_chain (the sink's own call): not checked — python3 not installed
   key missing                      -> ... not checked — cert or key missing (see above)
   python3 = Microsoft Store alias  -> ... not checked — python3 gave no usable result (timeout or error)
```

This box has no real python3 (the `python3` on PATH is the Microsoft Store
alias, which exits 49), so W's OK and FAILS branches were not run here; they
are left for the reviewer.

Script sha256 at round 6 (`ebea480a5`): `d6f95a0d…15000825`, superseded by
round 7 below.

## review, round 7: Y (blocking), Z1 to Z3

The reviewer ran round 6 under dash in WSL with a real python3. Everything
passed except W with an encrypted key: W caught a valid leaf plus a malformed
trailing cert (FAILS, SSLError), a mismatched key (FAILS), a valid chain (OK)
and the unreadable branch; U read TCP CONNECTED on a real loopback listener
and the per-port negative control fired on the real path; X was fine.

- **Y** §3: with no controlling tty, `load_cert_chain(cert, key)` with no
  password on an encrypted key printed `OSError` and the process never exited;
  `timeout 15` did not bound it (still hanging after more than 60 s), so the
  whole diagnostic hung. The call now passes `password=b""`: an unencrypted key
  ignores it, and an encrypted key fails at once, which matches the sink under
  systemd, where there is no tty to prompt on either. The timeout is now
  `timeout -k 2 15`, so a child that ignores TERM gets KILL 2 s later.

Reviewer's isolated receipt (WSL, python 3.14), as relayed:

```
password=b"" key=kenc.pem -> 'SSLError' exit=0 in 0s
password=b"" key=k1.pem   -> 'OK'       exit=0 in 1s
```

Three Codex items on `ebea480a5`, triaged valid, folded into the same commit:

- **Z1** §2: negotiation and advertisement are separate facts. `openssl
  s_client -starttls smtp` sends STARTTLS even when EHLO does not advertise it,
  so a completed handshake does not prove the advertisement. The verdict is
  now a two-way table: handshake + advertised reads "advertised AND
  negotiated" (with N's conditional sink wording); handshake + not advertised
  reads "STARTTLS NEGOTIATES but is NOT ADVERTISED in EHLO — senders that
  follow the advertisement will send plaintext; if the process on :25 is the
  sink, this is a real gap"; handshake + incomplete EHLO reads "negotiated;
  advertisement not measured". Without a handshake the three earlier branches
  stand. The openssl success line now says "STARTTLS handshake completed", not
  "the sink does offer it", and round 3's J NOTE ("the completed handshake is
  the conclusive measurement") is removed as false in general.
- **Z2** §3: a cert or key mtime in the same second as the listener's start
  reads "same second as pid N's start — order cannot be determined", as
  sink_vs_pid already does.
- **Z3** the quantifiers "every tested destination" and "answering for every
  destination / everyone" are replaced in the script header, this dispatch and
  the PR body with what was observed: the same canned set from BOTH Google
  destinations, Outlook passing through with STARTTLS, so the interceptor was
  answering for (at least) those destinations. (Round 8: interception is the
  leading hypothesis only, UNVERIFIED; see "what was withdrawn, and why".)

### round-7 receipts (Git Bash, NOT dash)

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
$ timeout -k 2 3 sleep 1; echo "timeout -k accepted, exit=$?"
timeout -k accepted, exit=0
```

Slices cut unchanged; Z1 fed synthetic TLS_OK / PLAIN, Z2 with a STUB
proc_start_epoch against the files' real mtimes (1790000000):

```
Z1 TLS_OK + complete, STARTTLS     -> STARTTLS advertised AND negotiated on loopback.
   TLS_OK + complete, no STARTTLS  -> STARTTLS NEGOTIATES but is NOT ADVERTISED in EHLO — ...
   TLS_OK + truncated              -> STARTTLS negotiated; advertisement not measured (no complete EHLO reply).
   no TLS  + complete, STARTTLS    -> STARTTLS IS advertised on loopback.
   no TLS  + complete, no STARTTLS -> STARTTLS is NOT advertised on loopback.
   no TLS  + truncated             -> INCONCLUSIVE — no complete EHLO reply, so no finding either way.
Z2 start == mtime                  -> same second as pid 4242's start — order cannot be determined
   start <  mtime                  -> modified after pid 4242 started — the loaded copy may differ
   start >  mtime                  -> not modified after pid 4242 started
```

No real python3 on this box, so Y itself was not re-run here.

Script sha256 at round 7 (`e3f3cf254`): `7d9403b7…fbdebcd30`, superseded by
round 8 below.

## review, round 8: AA, AB (text only)

Round 7 passed the reviewer's dash recheck:
<https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5883368931>.
Two Codex items on `e3f3cf254`, triaged valid.

- **AA** interception is no longer stated as established, in the script
  header, this dispatch's "what was withdrawn, and why", the PR body and the
  ledger note (`docs/agents/WALLET-LEDGER.md:46`, which said this seat's SMTP
  path "is intercepted"). The founder's standing qualification for this lane:
  the inconsistent probes invalidate the original finding, but they do not
  prove interception was the cause. The finding is withdrawn because the probe
  returned an identical, atypical set from two different Google endpoints;
  interception is the leading explanation, UNVERIFIED; the Outlook result only
  shows the prober was not uniformly blind; the box's STARTTLS state is
  UNVERIFIED until the on-host run. The §2 "the external report was the
  artifact" lines stay, as conditional consequences of a loopback ADVERTISED
  result ("if it is the sink, ...").
- **AB** §3 expiry: "expiry by itself does not stop load_cert_chain (see the
  load_cert_chain line below for whether it loads); the risk is validating
  senders rejecting the handshake." The old "the sink still loads it and still
  offers STARTTLS" could contradict the authoritative load_cert_chain line
  when the key or chain is bad.

### round-8 receipts (Git Bash, NOT dash)

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
$ grep -n -i 'intercepting SMTP path\|was answering\|measured that path' \
    <script> <dispatch> <ledger> <new PR body>
docs/dispatches/2026-09-29-mail-verify-inbound-tls.md:30:and "the 08-31 probe measured that path, not the box", as fact.)
```

The one remaining hit is the sentence recording that round 8 withdrew that
wording. The round-7 Z3 bullet below the round-7 heading still quotes "the
interceptor was answering" as what round 7 wrote, with a round-8 note that it
is a hypothesis only.

Script sha256 at round 8: `569afa04…fa40051e`.

## status: reviewer rechecks and what is pending

- Round 1 fix (`c8e22e05f`) rechecked under dash:
  <https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5882389501>
- Round 2 (`c412905f8`), items A to I, rechecked under dash:
  <https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5882748673>
- Rounds 3 and 4 (`d69925711`, `2587d8b13`) rechecked by the reviewer
  in-session under dash, with a real STARTTLS listener and on the real network
  path, where the negative control fired.
- Round 5 (`2989db565`, `94bad057d`), items N to T, rechecked under dash:
  <https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5883041109>
- Round 6 (`ebea480a5`), items U to X, rechecked by the reviewer under dash in
  WSL with a real python3, all passing except W with an encrypted key, which
  became round 7's Y.
- Round 7 (`e3f3cf254`), items Y and Z1 to Z3, rechecked under dash:
  <https://github.com/beehive-nature/beehive-nature/pull/260#issuecomment-5883368931>
- **Pending:** the reviewer's recheck of round 8 (AA, AB), and the on-host run
  by an authorized operator. **Current TLS state on the box: UNVERIFIED.** The
  cause of the 08-31 result is UNVERIFIED too (interception suspected, not
  shown). No CI claim is made here.
