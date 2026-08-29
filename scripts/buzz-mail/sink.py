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
KNOWN = {f"{a}@{DOMAIN}" for a in ("claude-code", "zc1", "bzcode", "bclaude", "bfuzz", "honeybee", "bqueenbee")}   # provisioned roster (Lane Mail rider)
CERT = "/opt/buzz-mail/agents-cert.pem"
KEY = "/opt/buzz-mail/agents-key.pem"

class Sink:
    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):
        if address.lower() not in KNOWN:
            return "550 no such agent here"          # unknown addresses refused, not dropped silently
        if not envelope.rcpt_tos:
            envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server, session, envelope):
        for rcpt in envelope.rcpt_tos:
            local = rcpt.split("@")[0].lower()
            md = MAILROOT / local
            (md / "cur").mkdir(parents=True, exist_ok=True)
            (md / "new").mkdir(parents=True, exist_ok=True)
            (md / "tmp").mkdir(parents=True, exist_ok=True)
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

if __name__ == "__main__":
    MAILROOT.mkdir(parents=True, exist_ok=True)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, KEY)
    controller = Controller(Sink(), hostname="0.0.0.0", port=25,
                            tls_context=ctx, require_starttls=False,   # opportunistic: accept plaintext too, OTP content is one-time codes
                            decode_data=False)
    controller.start()
    print("sink: receive-only SMTP on :25 for", DOMAIN, "— known addresses:", sorted(KNOWN), flush=True)
    import signal
    signal.pause()
