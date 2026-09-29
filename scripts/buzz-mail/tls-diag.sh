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
say() { printf '%s\n' "$*"; }
rule() { say "------------------------------------------------------------"; }

# verdict on a plain EHLO transcript ($1). Three outcomes, never two: an empty
# transcript is no measurement, so it is INCONCLUSIVE, never a finding.
plain_verdict() {
  if [ -z "$1" ]; then
    echo INCONCLUSIVE
  elif printf '%s\n' "$1" | grep -qi '^250[- ]STARTTLS'; then
    echo ADVERTISED
  else
    echo NOT_ADVERTISED
  fi
}

# TCP connect probe, host $1 port $2. /dev/tcp is a BASH feature: under dash
# (Ubuntu /bin/sh) it is an ordinary file path and fails for every target, so
# this must run under bash. Exit 0 = connected.
probe_tcp() {
  timeout 8 bash -c 'echo > "/dev/tcp/$1/$2"' probe "$1" "$2" 2>/dev/null
}

say "tls-diag — $(date -u '+%Y-%m-%dT%H:%M:%SZ') on $(hostname)"
rule

# 1 · WHO IS ACTUALLY ON :25 ------------------------------------------------
say "1 · the process serving :${PORT}"
FOUND=""
if command -v ss >/dev/null 2>&1; then
  OUT=$(ss -lptn "sport = :${PORT}" 2>/dev/null | sed 1d)
  [ -n "$OUT" ] && { say "$OUT"; FOUND=1; }
fi
if [ -z "$FOUND" ] && command -v lsof >/dev/null 2>&1; then
  OUT=$(lsof -nP -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null)
  [ -n "$OUT" ] && { say "$OUT"; FOUND=1; }
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
PIDS=$(ss -lptn "sport = :${PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
for p in $PIDS; do
  say "    pid $p  started $(ps -o lstart= -p "$p" 2>/dev/null | tr -s ' ')"
  say "    cmd   $(ps -o args= -p "$p" 2>/dev/null | cut -c1-100)"
done
if [ -z "$PIDS" ]; then
  say "    start time not visible — rerun with sudo"
  say "    (ss without root prints no users: field, or the listener was found via lsof)"
fi
rule

# 2 · WHAT THE WIRE SAYS, FROM HERE ----------------------------------------
say "2 · EHLO over loopback (no middlebox can touch this)"
if command -v openssl >/dev/null 2>&1; then
  RESP=$(printf 'EHLO diag.localhost\r\nQUIT\r\n' | timeout 15 openssl s_client -quiet -starttls smtp -connect 127.0.0.1:${PORT} 2>/dev/null | head -20)
  if [ -n "$RESP" ]; then
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
case $(plain_verdict "$PLAIN") in
  ADVERTISED)
    say "  VERDICT: STARTTLS IS advertised on loopback."
    say "  => the deployment receipt stands; the external report was the artifact." ;;
  NOT_ADVERTISED)
    say "  VERDICT: STARTTLS is NOT advertised on loopback."
    say "  => this is a REAL gap, not a network artifact." ;;
  *)
    say "  VERDICT: INCONCLUSIVE — no transcript, so no finding either way." ;;
esac
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
    say "  $f  MISSING  <-- sink.py load_cert_chain raises on a missing file,"
    say "      so the service cannot have started with it"
  fi
done
if [ -r "$CERT" ] && command -v openssl >/dev/null 2>&1; then
  say "  subject : $(openssl x509 -in "$CERT" -noout -subject 2>/dev/null)"
  say "  validity: $(openssl x509 -in "$CERT" -noout -dates 2>/dev/null | tr '\n' ' ')"
  if ! openssl x509 -in "$CERT" -noout -checkend 0 >/dev/null 2>&1; then
    say "  *** THE CERT HAS EXPIRED ***"
    say "  load_cert_chain does not check expiry: the sink still loads it and still"
    say "  offers STARTTLS. The risk is sending servers rejecting the handshake."
  fi
fi
rule

# 4 · IS 587 EGRESS OPEN? (the relay question, MEASURED not assumed) -------
say "4 · outbound reachability — measured, not assumed"
PROBE_OK=""
if ! command -v bash >/dev/null 2>&1; then
  say "  bash not found — the /dev/tcp probe cannot run; targets are UNKNOWN."
elif probe_tcp 1.1.1.1 443; then
  say "  OPEN    1.1.1.1:443  (control — must read OPEN)"
  PROBE_OK=1
else
  say "  CONTROL FAILED: 1.1.1.1:443 did not read OPEN."
  say "  The probe itself is broken; targets are UNKNOWN, not BLOCKED."
fi
for hp in "gmail-smtp-in.l.google.com 25" "smtp.gmail.com 587"; do
  h=$(echo "$hp" | cut -d' ' -f1); p=$(echo "$hp" | cut -d' ' -f2)
  if [ -z "$PROBE_OK" ]; then
    say "  UNKNOWN $h:$p"
  elif probe_tcp "$h" "$p"; then
    say "  OPEN    $h:$p"
  else
    say "  BLOCKED $h:$p"
  fi
done
say ""
say "  (:25 blocked + :587 open is the documented OCI shape. Either result is a"
say "   fact for the relay decision — it does not decide it.)"
rule
say "done. Nothing was changed."
