#!/usr/bin/env python3
r"""THP pairing receipt - stock Safe 7 (T3W1, fw 2.12.4), NO debuglink.

goose device lane. Closes THP_TRANSPORT_MATRIX.md receipts #2 (+ half of #1:
the v1-vs-THP probe prints which protocol stock firmware answers on WebUSB).
Stack: trezor==0.20.2 (== repo python/ main @ 9330ef0607; PyPI 2026-07-31),
venv at C:\Users\travi\safe7-host (uv, python 3.12).

Usage (Safe 7 plugged in):
  python thp_pair_receipt.py status              # enumerate, probe protocol, report.
                                                 # Unpaired -> device shows the code
                                                 # screen; exits 3.
  python thp_pair_receipt.py pair --code NNNNNN  # CodeEntry pairing with the code
                                                 # read off the Safe 7 screen, then
                                                 # GetFeatures printed as the receipt.

Exit codes: 0 paired+features or v1-answered · 2 no device · 3 unpaired, needs
code · 4 error. Credential is NOT persisted here (use trezorctl for that);
the on-device code is the MITM anchor - no debuglink anywhere.
"""
import sys


def die(code: int, msg: str) -> None:
    print(f"[thp-receipt] {msg}", flush=True)
    sys.exit(code)


def print_features(client) -> None:
    f = client.features
    fields = (
        "vendor", "internal_model", "model", "major_version", "minor_version",
        "patch_version", "fw_variant", "bootloader_mode", "language_version",
        "unit_packaging",
    )
    print("[thp-receipt] FEATURES RECEIPT:")
    for name in fields:
        v = getattr(f, name, None)
        if v is not None:
            print(f"  {name} = {v}")
    caps = getattr(f, "capabilities", None)
    if caps:
        print(f"  capabilities = {[str(c) for c in caps]}")


def main() -> int:
    from trezorlib.client import get_default_client
    from trezorlib.exceptions import TrezorException
    from trezorlib.transport import get_transport, TransportException

    args = sys.argv[1:]
    cmd = args[0] if args else "status"
    code = args[args.index("--code") + 1] if "--code" in args else None

    try:
        from trezorlib.transport import enumerate_devices
        devs = enumerate_devices()
        paths = [str(getattr(d, "path", d)) for d in devs]
        print(f"[thp-receipt] transports visible: {paths or 'NONE'}", flush=True)
    except Exception as e:  # enumeration is best-effort reporting
        print(f"[thp-receipt] enumeration note: {e}", flush=True)

    try:
        transport = get_transport(None, prefix_search=True)
    except (TransportException, Exception) as e:
        die(2, f"No Trezor device found ({e}). Plug the Safe 7 in, retry.")

    if cmd == "pair":
        if not code:
            die(4, "pair needs --code NNNNNN (the code on the Safe 7 screen)")
        client = get_default_client(
            app_name="goose-thp-receipt", code_entry_callback=lambda: code
        )
    else:
        try:
            client = get_default_client(app_name="goose-thp-receipt")
        except TrezorException as e:
            if "code_entry_callback is required" in str(e):
                die(
                    3,
                    "UNPAIRED. The Safe 7 screen should now show the pairing "
                    "code; re-run: pair --code NNNNNN",
                )
            raise

    kind = type(client).__name__
    print(f"[thp-receipt] client class: {kind}")
    if kind == "TrezorClientV1":
        # stock firmware answered the v1 probe - receipt for MATRIX §1
        print(
            "[thp-receipt] VERDICT: stock answered PROTOCOL V1 on WebUSB "
            "(CodecV1 compat confirmed on-device)."
        )
    if hasattr(client, "refresh_features"):
        client.refresh_features()
    print_features(client)
    print("[thp-receipt] THP/PROTOCOL RECEIPT COMPLETE")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as e:
        die(4, f"error: {type(e).__name__}: {e}")
