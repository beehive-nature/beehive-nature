# RECEIPT — goose device lane + FIRSTLIGHT-VENUE state (2026-08-15)
**From:** goose (Seat 1 hands) · closes the two items of the 2026-08-15 lane split
**Lane answer:** goose takes the device lane (task #6). Cowork keeps the docs sweep —
no collision; Cowork's held §3 need not wait on this receipt's empirical half.

## 1) THP pairing vs stock 2.12.4 — STAGED, blocked on device presence only

**Founder citations re-verified in-tree** (`C:/Users/travi/source/trezor-firmware` @ `9330ef0607`):
- `core/src/trezor/wire/thp/__init__.py` L40-46: `_DEFAULT_ENABLED_PAIRING_METHODS = [ThpPairingMethod.CodeEntry]`; `SkipPairing`/`NFC`/`QrCode` appended only under `if __debug__` (L56-63). Production firmware = **CodeEntry only**; SkipPairing is debug-only, so on real hardware the CLI's credential request forces CodeEntry every time (matches THP_TRANSPORT_MATRIX.md §3).
- `core/embed/rust/src/ui/layout_eckhart/ui_firmware.rs` ~L956: `show_address_details` is the stubbed signature (NotImplementedError body below) — confirmed.

**What is ready on this box:**
- venv `C:/Users/travi/safe7-host` (uv, Python 3.12.13): **trezor==0.20.2** installed —
  identical to repo `python/` main and to PyPI 0.20.2 (2026-07-31). `trezorctl --version` → 0.20.2.
- `scripts/thp_pair_receipt.py` (pushed, commit `8666baa`): no debuglink anywhere.
  - `python scripts/thp_pair_receipt.py status` — enumerates, probes **v1 vs THP** (this also
    closes the on-device half of MATRIX receipt #1), and on an unpaired stock device triggers
    the code screen; exits 3 = unpaired-needs-code.
  - `python scripts/thp_pair_receipt.py pair --code NNNNNN` — CodeEntry pairing with the code
    read off the Safe 7 screen, then prints GetFeatures as the receipt; exits 0.
  - Self-tested this session: correct "No Trezor device found" path (device never attached —
    0 VID_1209 devices across repeated checks 16:0x-16:31).

**The moment the Safe 7 is plugged in (any seat, or the founder):**
```
C:\Users\travi\safe7-host\Scripts\python.exe C:\Users\travi\beehive-nature\scripts\thp_pair_receipt.py status
# → read the code on the Safe 7 screen
C:\Users\travi\safe7-host\Scripts\python.exe C:\Users\travi\beehive-nature\scripts\thp_pair_receipt.py pair --code NNNNNN
```
Either result answers the founder's question: **exit 0 = trezorlib completes CodeEntry where
Connect 9.7.3 cannot → the wall is Connect-specific**; a named failure instead = the missing
piece, already localized by THP_TRANSPORT_MATRIX.md §2 (web bundle ships zero THP).

## 2) FIRSTLIGHT-VENUE — already deployed and load-tested; ONE console action from live

Verified by ssh (`-i ~/.ssh/bnr_key ubuntu@129.153.202.144`, aarch64):
- `systemctl`: livekit **active/enabled**; listening `*:7880`, `*:7881` (pid 63739).
- `/etc/livekit/config.yaml` present; `~/firstlight/.venue-secrets` + `.venue-env` present (not printed).
- `curl localhost:7880` → **200**.
- journal: the batch2 load test **already ran 2026-08-14 22:09** — room `dj-firstlight`, six
  `agent-stub_pub_*` video publishers + subscriber, clean close on departure timeout.
- Host firewall OPEN: iptables INPUT accepts tcp 7880/7881, udp 7882/3478.

**The one gap:** `curl http://129.153.202.144:7880` from the venue itself → `000` (and from this
box). With host iptables/nftables accepting, the block is the **OCI security list / NSG ingress**.
Discriminating datapoint (airtight): from the venue, `curl` to its own public IP on **8080 → 200**
while **7880 → 000** on the same interface — same host firewall, different cloud-level rule.
8080 carries the "BNR relay" iptables comment; 7880/7881/7882/3478 were never punched at OCI.
No `oci` CLI on the venue (checked) → the rule must be added in the Oracle console. **Cure
(founder, OCI console, ~2 min):** add ingress rules to the instance's security list —
TCP 7880, TCP 7881, UDP 7882, UDP 3478 (source 0.0.0.0/0). Then:
- `BROOM_LK_URL=wss://129.153.202.144:7880` works from anywhere and broom-agent's
  <500 ms accept can be measured for real (its README marks it "unmeasured until that lands").

## Not touched (per lane split)
Cowork's five-item doc sweep, Design's surfaces, bComb/bcomb (both correct — format bComb,
crate bcomb per Cargo casing).
