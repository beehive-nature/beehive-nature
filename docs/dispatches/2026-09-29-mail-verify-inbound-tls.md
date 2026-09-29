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

Script sha256 at this commit: `f8000a4a…79921dc2`.

## pending: reviewer recheck

Not run by this seat, because WSL is refused to this worktree: the `sh -n`
under **dash**, the §4 functional cases (OPEN against 1.1.1.1:443, REFUSED/ERROR
on 127.0.0.1:1, UNKNOWN (DNS) on `nonexistent.invalid`, NO ANSWER on
10.255.255.1:25), the §1 functional cases (ss `pid=` parse, the lsof fallback,
the STALE comparison against a fake `SINK_PY` older and newer than a running
process), and the full script under dash. **Reviewer recheck pending.** No CI
claim is made here.
