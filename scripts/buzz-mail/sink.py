#!/usr/bin/env python3
# sink.py — LANE MAIL: the estate's sovereign receive-only OTP sink.
#
# Speaks just enough SMTP to receive mail for agents.skaists.buzz:
# known agent addresses ONLY (RCPT for anything else is refused at the
# protocol level), delivery into per-agent Maildirs (0600, root), STARTTLS
# offered with a self-signed cert for the subdomain (opportunistic TLS is
# what real senders use toward small hosts; upgrade path noted in the lane
# file). THERE IS NO SEND HALF — no relay, no outbound, no submission port;
# the process could not send mail if it wanted to.
#
# Inboxes never leave the box (the fence): Maildirs under /var/mail-agents,
# root-owned, 0600; seats read them with sudo on the box.
import ssl, os, sys, email
from pathlib import Path
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import SMTP, Envelope, Session

DOMAIN = "agents.skaists.buzz"
MAILROOT = Path("/var/mail-agents")
KNOWN = {f"{a}@{DOMAIN}" for a in ("claude-code", "bzcode", "bclaude", "bfuzz", "honeybee", "bqueenbee", "bgrokbot", "bfable", "bee-laborer", "bopus5", "bcodexastra")}   # provisioned roster (Lane Mail rider)
CERT = "/opt/buzz-mail/agents-cert.pem"
KEY = "/opt/buzz-mail/agents-key.pem"

class Sink:
    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):
        if address.lower() not in KNOWN:
            return "550 no such agent here"          # unknown addresses refused, not dropped silently
        if address not in envelope.rcpt_tos:
            envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server, session, envelope):
        for rcpt in envelope.rcpt_tos:
            local = rcpt.split("@")[0].lower()
            md = MAILROOT / local
            # mailbox privacy is enforced, never inherited from the process umask
            # (live defect 2026-09-20: auto-created Maildirs landed 0755 under Umask=0022)
            md.mkdir(parents=True, exist_ok=True, mode=0o700)
            os.chmod(md, 0o700)  # mkdir mode is umask-masked and skipped when existing; chmod is neither
            for sub in ("cur", "new", "tmp"):
                (md / sub).mkdir(parents=True, exist_ok=True, mode=0o700)
                os.chmod(md / sub, 0o700)
            # Maildir write-through-tmp, then 0600, root-owned
            import time, secrets
            uniq = f"{int(time.time())}.M{secrets.token_hex(6)}P{os.getpid()}Q1"
            tmp = md / "tmp" / uniq
            final = md / "new" / uniq
            body = envelope.original_content if isinstance(envelope.original_content, bytes) else envelope.content.encode() if isinstance(envelope.content, str) else envelope.original_content
            with open(tmp, "wb") as f:
                f.write(body)
            os.chmod(tmp, 0o600)
            os.replace(tmp, final)
        return "250 Message accepted for delivery"

def prepare_mailroot():
    # MAILROOT privacy is enforced at the root too, never inherited from the
    # process umask (2026-09-21: the startup mkdir passed no mode, so
    # /var/mail-agents landed 0755 under the deployed Umask=0022 — mailbox
    # names + mtimes readable by traversal; same law as the mailbox dirs
    # above: mkdir mode is umask-capped, chmod heals and is umask-proof).
    # Named and callable so the mode gate exercises the real code path.
    MAILROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(MAILROOT, 0o700)


if __name__ == "__main__":
    prepare_mailroot()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, KEY)
    controller = Controller(Sink(), hostname="0.0.0.0", port=25,
                            tls_context=ctx, require_starttls=False,   # opportunistic: accept plaintext too, OTP content is one-time codes
                            decode_data=False)
    controller.start()
    print("sink: receive-only SMTP on :25 for", DOMAIN, "— known addresses:", sorted(KNOWN), flush=True)
    import signal
    signal.pause()
