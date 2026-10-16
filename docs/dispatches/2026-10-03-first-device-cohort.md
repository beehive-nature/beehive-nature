# First device cohort: Dell, A16, Pixel 10a, Google Streamer

Date: 2026-10-03. Founder confirmed the Dell is the Windows laptop running this session. Founder will connect the Samsung A16, Pixel 10a and Google Streamer to the same `peter pan 5G` Wi-Fi. These are selected targets, not enrolled or tested devices.

Hostinger x0x v0.46.0 remains healthy: 20 peers / 20 send-ready peers, uptime 26,107 seconds in this observation. The Windows x0x CLI is v0.41.3. The existing ten-minute WSL tunnel points at Oracle and includes an Oracle-specific antd address; it was not retargeted. Hostinger has no active tailscaled service in the read-only check.

Proposed first access was one native Windows SSH transport, using the already-installed laptop key and strict host-key verification, forwarding only Dell loopback 18080 to Hostinger loopback 12700. A ten-minute expiry would close only that process, with no local P2P daemon, LAN listener, new firewall door or credential display. Automatic approval rejected starting that transport with the sole reason `blocked by policy`. The command did not execute; no tunnel or expiry process started. No alternative transport was attempted to bypass the rejection.

Remaining acceptance: establish an approved Dell access path; reconcile client/server versions before using CLI commands; select authenticated mobile access without exposing the daemon admin API or distributing its durable token; enroll devices with their intended identities; verify actual send/read receipt pairs and room media. The Google Streamer starts as a viewing target via supported Chrome casting, not an assumed native x0x peer. Same Wi-Fi alone does not enroll any device.

PR #340 current head has passing scan, test, static, node, eternal and meter results. Wallet passed in the branch run but failed in the merge-preview run at `e2e/wallet-arweave.mjs:285` with a Playwright TimeoutError. Do not call the merge gate green. Oracle TLS remains UNVERIFIED.

Google's casting instructions: https://support.google.com/googlecast/answer/3228332?hl=en
