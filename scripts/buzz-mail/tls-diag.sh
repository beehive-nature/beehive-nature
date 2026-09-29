#!/bin/sh
# tls-diag.sh — READ-ONLY. Answers, from the box itself, the one question an
# outside prober cannot: does the process serving :25 actually offer STARTTLS,
# and does the RUNNING process match the DEPLOYED config?
#
# WHY THIS EXISTS. On 2026-08-31 an external EHLO probe reported that
# agents.skaists.buzz did not advertise STARTTLS, contradicting the
# MAILROOM_DESK receipt. That probe was WRONG — and the way it was wrong is the
# point. Re-run on 2026-09-29 with a control, the SAME canned capability set
#   250-Requested mail action okay, completed / 250-SIZE 20000000 / 250-8BITMIME
# came back from gmail-smtp-in:25 AND smtp.gmail.com:587, both of which require
# STARTTLS and advertise SIZE 157286400. An intercepting SMTP path on the
# prober's line was answering for everyone. Outlook's MX passed through clean,
# which is what proved the probe itself could see STARTTLS when it was real.
#
# The lesson, and the reason this file is a script and not a paragraph: a
# measurement taken through a middlebox is not a measurement of the target.
# Loopback has no middlebox. Run it here.
#
# Usage, on the box:   sh scripts/buzz-mail/tls-diag.sh
# Nothing is changed. Nothing is restarted. No secret is printed.

set -u
PORT=25
# the deployed sink. Overridable only so the staleness check can be exercised
# against a throwaway file; on the box, leave it unset.
SINK_PY=${SINK_PY:-/opt/buzz-mail/sink.py}
say() { printf '%s\n' "$*"; }
rule() { say "------------------------------------------------------------"; }

# verdict on a plain EHLO transcript ($1). Three outcomes, never two: an empty
# or incomplete transcript is no measurement, so it is INCONCLUSIVE, never a
# finding. Complete means the EHLO reply's final line arrived: 250 followed by
# a space or by the end of the line (CRs are stripped first).
plain_verdict() {
  _t=$(printf '%s\n' "$1" | tr -d '\r')
  if [ -z "$_t" ]; then
    echo INCONCLUSIVE
  elif printf '%s\n' "$_t" | grep -qi '^250[- ]STARTTLS'; then
    echo ADVERTISED
  elif printf '%s\n' "$_t" | grep -Eq '^250( |$)'; then
    echo NOT_ADVERTISED
  else
    echo INCONCLUSIVE
  fi
}

# TCP connect probe, host $1 port $2. /dev/tcp is a BASH feature: under dash
# (Ubuntu /bin/sh) it is an ordinary file path and fails for every target, so
# this must run under bash. Exit 0 = connected.
probe_tcp() {
  timeout 8 bash -c 'echo > "/dev/tcp/$1/$2"' probe "$1" "$2" 2>/dev/null
}

# one egress target, host $1 port $2, judged only after the control passed.
# Four outcomes, and only one of them is a positive fact: a timeout is
# consistent with a filter but has other causes, so it is never called BLOCKED.
# getent ahosts is a forward lookup only: an IP literal passes without the
# reverse lookup that `getent hosts` would demand of it.
egress_verdict() {
  if ! getent ahosts "$1" >/dev/null 2>&1; then
    say "  UNKNOWN (DNS)  $1:$2"
    return
  fi
  probe_tcp "$1" "$2"
  _rc=$?
  case $_rc in
    0)   say "  OPEN  $1:$2" ;;
    124) say "  NO ANSWER (timeout — consistent with an egress filter, not proof)  $1:$2" ;;
    *)   say "  REFUSED/ERROR (exit $_rc)  $1:$2" ;;
  esac
}

is_uint() { case $1 in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }

# start of pid $1 in epoch seconds, from /proc/$1/stat field 22 (clock ticks
# after boot) plus btime from /proc/stat. The comm field can hold spaces and
# parens, so everything through the LAST ') ' is cut first; field 22 is then
# the 20th remaining field. Prints nothing when any input is unreadable.
proc_start_epoch() {
  _st=$(sed 's/^.*) //' "/proc/$1/stat" 2>/dev/null | cut -d' ' -f20)
  _bt=$(sed -n 's/^btime //p' /proc/stat 2>/dev/null)
  _hz=$(getconf CLK_TCK 2>/dev/null)
  if is_uint "$_st" && is_uint "$_bt" && is_uint "$_hz" && [ "$_hz" -gt 0 ]; then
    echo $((_bt + _st / _hz))
  fi
}

# the deployed file: mtime (epoch s) and sha256, or an explicit reason why not.
# Sets SINK_MTIME for sink_vs_pid.
SINK_MTIME=""
sink_file_report() {
  say "  deployed file $SINK_PY"
  if [ ! -e "$SINK_PY" ]; then
    say "    MISSING — no mtime or sha256, so no running process can be compared with it"
    return
  fi
  SINK_MTIME=$(stat -c %Y "$SINK_PY" 2>/dev/null)
  if is_uint "$SINK_MTIME"; then
    say "    mtime  $SINK_MTIME  ($(date -u -d "@$SINK_MTIME" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null))"
  else
    SINK_MTIME=""
    say "    mtime  not readable — no comparison can be made"
  fi
  if [ -r "$SINK_PY" ]; then
    say "    sha256 $(sha256sum "$SINK_PY" 2>/dev/null | cut -d' ' -f1)"
  else
    say "    sha256 not readable by $(id -un) — rerun with sudo"
  fi
}

# pid $1: its executable name and start, then the start compared with the
# deployed file's mtime. Never prints the command line (args can carry secrets).
sink_vs_pid() {
  say "    pid $1  comm $(ps -o comm= -p "$1" 2>/dev/null)  started $(ps -o lstart= -p "$1" 2>/dev/null | tr -s ' ')"
  _ps=$(proc_start_epoch "$1")
  if [ -z "$_ps" ]; then
    say "    process start not readable from /proc/$1/stat — no comparison made"
  elif [ -z "$SINK_MTIME" ]; then
    say "    process start $_ps (epoch s) — no deployed-file mtime, no comparison made"
  else
    say "    process start $_ps (epoch s)  vs  file mtime $SINK_MTIME"
    if [ "$SINK_MTIME" -gt "$_ps" ]; then
      say "    *** STALE: $SINK_PY was modified after pid $1 started — the running code may not match it ***"
    elif [ "$SINK_MTIME" -eq "$_ps" ]; then
      say "    same second — the order cannot be determined"
    else
      say "    file is older than the process (consistent with it being loaded; not proof)"
    fi
  fi
}

say "tls-diag — $(date -u '+%Y-%m-%dT%H:%M:%SZ') on $(hostname)"
rule

# 1 · WHO IS ACTUALLY ON :25 ------------------------------------------------
say "1 · the process serving :${PORT}"
FOUND=""
PIDS=""
if command -v ss >/dev/null 2>&1; then
  OUT=$(ss -lptn "sport = :${PORT}" 2>/dev/null | sed 1d)
  if [ -n "$OUT" ]; then
    say "$OUT"
    FOUND=ss
    PIDS=$(printf '%s\n' "$OUT" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
  fi
fi
if [ -z "$FOUND" ] && command -v lsof >/dev/null 2>&1; then
  OUT=$(lsof -nP -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null)
  if [ -n "$OUT" ]; then
    say "$OUT"
    FOUND=lsof
    PIDS=$(lsof -t -nP -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null | sort -u)
  fi
fi
if [ -z "$FOUND" ]; then
  say "REFUSING TO GUESS: nothing reported a listener on :${PORT}."
  say "Either this needs root (try with sudo) or the service is down."
  say "Both are findings — record which, do not assume."
  exit 2
fi

# the binary and start time behind it — a config edited after this timestamp
# has NOT been loaded, which is the single most common cause of
# 'the config says X but the wire says Y'
say ""
say "  start time of the listener (config edited AFTER this is NOT loaded):"
sink_file_report
for p in $PIDS; do
  sink_vs_pid "$p"
done
if [ -z "$PIDS" ]; then
  say "    start time not visible — rerun with sudo"
  say "    ($FOUND found the listener but showed no pid; without root it hides"
  say "     other users' processes. No comparison with $SINK_PY was made.)"
fi
rule

# 2 · WHAT THE WIRE SAYS, FROM HERE ----------------------------------------
say "2 · EHLO over loopback (no middlebox can touch this)"
TLS_OK=""
if command -v openssl >/dev/null 2>&1; then
  RESP=$(printf 'EHLO diag.localhost\r\nQUIT\r\n' | timeout 15 openssl s_client -quiet -starttls smtp -connect 127.0.0.1:${PORT} 2>/dev/null | head -20)
  if [ -n "$RESP" ]; then
    TLS_OK=1
    say "  STARTTLS NEGOTIATED — the sink does offer it. Capabilities after upgrade:"
    say "$RESP" | sed 's/^/    /'
  else
    say "  openssl could not complete STARTTLS. Falling back to a plain EHLO:"
  fi
fi
PLAIN=""
if command -v nc >/dev/null 2>&1; then
  PLAIN=$( (printf 'EHLO diag.localhost\r\n'; sleep 2; printf 'QUIT\r\n'; sleep 1) | timeout 15 nc 127.0.0.1 ${PORT} 2>/dev/null )
  NOPLAIN="(no response from 127.0.0.1:${PORT})"
else
  NOPLAIN="(nc is not installed — no plain EHLO was sent)"
fi
say ""
say "  plain EHLO transcript:"
say "${PLAIN:-$NOPLAIN}" | sed 's/^/    /'
say ""
PV=$(plain_verdict "$PLAIN")
if [ -n "$TLS_OK" ]; then
  # a completed handshake outranks any plain transcript
  say "  VERDICT: STARTTLS advertised AND negotiated on loopback."
  say "  => the deployment receipt stands; the external report was the artifact."
  if [ "$PV" != ADVERTISED ]; then
    say "  NOTE: the plain transcript reads $PV, which disagrees with the negotiation"
    say "  above. The completed handshake is the conclusive measurement."
  fi
else
  case $PV in
    ADVERTISED)
      say "  VERDICT: STARTTLS IS advertised on loopback."
      say "  => the deployment receipt stands; the external report was the artifact." ;;
    NOT_ADVERTISED)
      say "  VERDICT: STARTTLS is NOT advertised on loopback."
      say "  => this is a REAL gap, not a network artifact." ;;
    *)
      say "  VERDICT: INCONCLUSIVE — no complete EHLO reply, so no finding either way." ;;
  esac
fi
rule

# 3 · DOES THE CERT THE CONFIG NAMES ACTUALLY EXIST AND PARSE? -------------
say "3 · the cert the sink is configured to use"
CERT=/opt/buzz-mail/agents-cert.pem
KEY=/opt/buzz-mail/agents-key.pem
for f in "$CERT" "$KEY"; do
  if [ -r "$f" ]; then
    say "  $f  present ($(stat -c '%a %U:%G' "$f" 2>/dev/null))"
  elif [ -e "$f" ]; then
    say "  $f  EXISTS BUT NOT READABLE BY $(id -un) — run with sudo to judge this"
  else
    say "  $f  MISSING  <-- the next restart will fail (sink.py load_cert_chain"
    say "      raises). A running process may still hold a context loaded before"
    say "      the file went missing."
  fi
done
HAVE_OPENSSL=""
if command -v openssl >/dev/null 2>&1; then HAVE_OPENSSL=1; fi
CERT_OK=""
if [ -r "$CERT" ] && [ -z "$HAVE_OPENSSL" ]; then
  say "  cert not validated — openssl not installed"
elif [ -r "$CERT" ]; then
  if openssl x509 -in "$CERT" -noout >/dev/null 2>&1; then
    CERT_OK=1
    say "  subject : $(openssl x509 -in "$CERT" -noout -subject 2>/dev/null)"
    say "  validity: $(openssl x509 -in "$CERT" -noout -dates 2>/dev/null | tr '\n' ' ')"
    if ! openssl x509 -in "$CERT" -noout -checkend 0 >/dev/null 2>&1; then
      say "  *** THE CERT HAS EXPIRED ***"
      say "  load_cert_chain does not check expiry: the sink still loads it and still"
      say "  offers STARTTLS. The risk is sending servers rejecting the handshake."
    fi
  else
    say "  *** CERT DOES NOT PARSE (not a readable X.509 PEM) *** — expiry not checked;"
    say "  the next restart will fail at load_cert_chain."
  fi
fi
# the key, judged as a pair with the cert. Only MATCH / MISMATCH is printed —
# never key material, and never the public-key PEM either: it is captured raw
# and tested non-empty FIRST, because a digest of empty input is still a digest
# and two failed extractions must not compare equal. -passin pass: makes an
# encrypted key fail instead of waiting on a passphrase prompt (sink.py passes
# no password either).
if [ -r "$KEY" ] && [ -z "$HAVE_OPENSSL" ]; then
  say "  key/cert pair: cert/key not validated — openssl not installed"
elif [ -r "$KEY" ]; then
  if ! openssl pkey -in "$KEY" -passin pass: -noout >/dev/null 2>&1; then
    say "  *** KEY DOES NOT PARSE *** — the next restart will fail at load_cert_chain."
  elif [ -z "$CERT_OK" ]; then
    say "  key/cert pair: not compared — no parseable cert to compare against."
  else
    KPEM=$(openssl pkey -in "$KEY" -passin pass: -pubout 2>/dev/null)
    CPEM=$(openssl x509 -in "$CERT" -noout -pubkey 2>/dev/null)
    if [ -z "$KPEM" ] || [ -z "$CPEM" ]; then
      say "  key/cert pair: not compared — public key extraction failed"
    elif [ "$KPEM" = "$CPEM" ]; then
      say "  key/cert pair: MATCH"
    else
      say "  key/cert pair: MISMATCH — the next restart will fail at load_cert_chain."
    fi
  fi
elif [ -e "$KEY" ]; then
  say "  key/cert pair: not checked — key not readable by $(id -un); rerun with sudo."
fi

# the cert the listener SERVES against the deployed file. Both are re-encoded
# by openssl x509 (same canonical PEM for the same cert), tested non-empty, and
# compared here. Only SAME / DIFFERENT / not compared is printed — no digests.
if [ -z "$HAVE_OPENSSL" ]; then
  say "  served cert: not compared — openssl not installed"
elif [ -z "$CERT_OK" ]; then
  say "  served cert: not compared — no readable, parseable deployed cert"
else
  SERVED=$(timeout 15 openssl s_client -starttls smtp -connect "127.0.0.1:${PORT}" </dev/null 2>/dev/null | openssl x509 2>/dev/null)
  DEPLOYED=$(openssl x509 -in "$CERT" 2>/dev/null)
  if [ -z "$SERVED" ]; then
    say "  served cert: not compared — no cert served over loopback (the STARTTLS handshake did not complete)"
  elif [ -z "$DEPLOYED" ]; then
    say "  served cert: not compared — the deployed cert could not be re-encoded"
  elif [ "$SERVED" = "$DEPLOYED" ]; then
    say "  served cert: SAME as deployed"
  else
    say "  served cert: DIFFERENT — the listener is serving a cert loaded before the file changed; a restart would switch to the deployed one"
  fi
fi

# cert/key files modified after the listener started (first pid from §1)
FIRSTPID=$(printf '%s\n' "$PIDS" | sed -n 1p)
if [ -z "$FIRSTPID" ]; then
  say "  cert/key mtime vs listener start: no pid, not compared"
else
  _ls=$(proc_start_epoch "$FIRSTPID")
  if [ -z "$_ls" ]; then
    say "  cert/key mtime vs listener start: start of pid $FIRSTPID not readable, not compared"
  else
    for f in "$CERT" "$KEY"; do
      _m=$(stat -c %Y "$f" 2>/dev/null)
      if ! is_uint "$_m"; then
        say "  $f: mtime not readable, not compared"
      elif [ "$_m" -gt "$_ls" ]; then
        say "  $f: modified after pid $FIRSTPID started — the loaded copy may differ"
      else
        say "  $f: not modified after pid $FIRSTPID started"
      fi
    done
  fi
fi
rule

# 4 · IS 587 EGRESS OPEN? (the relay question, MEASURED not assumed) -------
say "4 · outbound reachability — measured, not assumed"
PROBE_OK=""
if ! command -v bash >/dev/null 2>&1; then
  say "  bash not found — the /dev/tcp probe cannot run; targets are UNKNOWN."
elif probe_tcp 1.1.1.1 443; then
  say "  OPEN    1.1.1.1:443  (positive control — must read OPEN)"
  # the negative control: TEST-NET-1 (RFC 5737) is never routed, so a connect
  # there means something on the path completes every handshake itself, and
  # then OPEN carries no information about any target.
  if probe_tcp 192.0.2.1 25; then
    say "  NEGATIVE CONTROL OPEN: 192.0.2.1:25 connected — this path accepts every"
    say "  connection, so OPEN means nothing here; targets are UNKNOWN."
  else
    say "  not OPEN 192.0.2.1:25  (negative control, TEST-NET-1 — must not read OPEN)"
    PROBE_OK=1
  fi
else
  say "  CONTROL FAILED: 1.1.1.1:443 did not read OPEN."
  say "  The probe itself is broken; targets are UNKNOWN, not BLOCKED."
fi
for hp in "gmail-smtp-in.l.google.com 25" "smtp.gmail.com 587"; do
  h=$(echo "$hp" | cut -d' ' -f1); p=$(echo "$hp" | cut -d' ' -f2)
  if [ -z "$PROBE_OK" ]; then
    say "  UNKNOWN $h:$p"
  else
    egress_verdict "$h" "$p"
  fi
done
say ""
say "  (:25 blocked + :587 open is the documented OCI shape. A NO ANSWER on :25 is"
say "   consistent with that shape but is not proof of a block: a timeout has other"
say "   causes. Each line is a fact for the relay decision — it does not decide it.)"
rule
say "done. Nothing was changed."
