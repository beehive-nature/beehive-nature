"""SAFE 7 emulator -> Rust evaluation boundary. Never selects USB/BLE hardware.

Run under the pinned firmware checkout's nix-shell/uv environment. Requires
its T3W1 debug emulator, tests helpers and trezorlib. Uses only the public BIP39
test vector in a fresh temporary profile; there is no seed input parameter.
No RPC or broadcast. A successful result is NOT hardware acceptance.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

PIN = "4524b956222e81d1c1073ce74f0e362bae758bbf"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--firmware", type=Path, required=True)
    parser.add_argument("--rust-bench", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    source = args.firmware.resolve()
    if subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip() != PIN:
        raise ValueError("Firmware source pin differs from this bench")
    if subprocess.check_output(["git", "-C", str(source), "status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"], text=True).strip():
        raise ValueError("Firmware checkout is dirty")
    modules = subprocess.check_output(["git", "-C", str(source), "submodule", "status", "--recursive"], text=True).splitlines()
    if any(not line.startswith(" ") for line in modules):
        raise ValueError("Firmware submodule pin differs or is missing")
    sys.path.insert(0, str(source))
    sys.path.insert(0, str(source / "python" / "src"))
    from trezorlib import debuglink, solana
    from trezorlib._internal.emulator import CoreEmulator, TropicModel
    from trezorlib.tools import parse_path
    from tests.input_flows import InputFlowConfirmAllWarnings

    executable = source / "core/build-xtask/artifacts/T3W1/firmware-emu"
    os.environ["TREZOR_SRC"] = str(source / "core/src")

    def rust(command, data, expect_success=True):
        run = subprocess.run([str(args.rust_bench.resolve()), command], input=json.dumps(data),
                             text=True, capture_output=True, timeout=30)
        if expect_success:
            if run.returncode:
                raise RuntimeError("Rust bench refused: " + run.stderr)
            return json.loads(run.stdout)
        if run.returncode == 0:
            raise AssertionError("Rust bench accepted altered intent")
        return run.stderr.strip()

    runs = []
    # Two fresh profiles demonstrate deterministic public-vector restoration;
    # this is not a recovery ceremony for a real device or real wallet.
    for iteration in range(2):
        with tempfile.TemporaryDirectory(prefix="bsafe-solana-fixture-") as profile:
            emulator = CoreEmulator(executable, profile, headless=True, port=29324,
                                    workdir=source / "core/src", debug=True)
            tropic = None
            try:
                if emulator.properties().get("tropic", False):
                    tropic = TropicModel(profile, source / "tests/tropic_model/config.yml", port=29330)
                    tropic.start()
                emulator.start()
                session = emulator.client.get_seedless_session()
                debuglink.load_device(session, mnemonic=" ".join(["abandon"] * 11 + ["about"]),
                    pin=None, passphrase_protection=False, label="PUBLIC TEST VECTOR ONLY") # TESTNET-ONLY
                session = emulator.client.get_session()
                if session.features.internal_model != "T3W1":
                    raise ValueError("Expected a T3W1 emulator")
                path = "m/44'/501'/0'"
                payer = solana.get_address(session, address_n=parse_path(path), show_display=True)
                data = {"intent": {"job_id": "safe7-emulator-fixture", "authorization_ref": "unverified-fixture-bound",
                    "proof_ref": "unverified-fixture-proof", "payer": payer,
                    "recipient": "9C6hybhQ6Aycep9jaUnP6uL9ZYvDjUp1aSkFWPUFJtpj", # PUBLIC-CONSTANT: fixture only
                    "lamports": 1000, "max_lamports": 1000, "max_fee_lamports": 5000, "path": path},
                    "observation": {"genesis_hash": "EtWTRABZaYq6iMfeYKouRu166VU2xqa1", # PUBLIC-CONSTANT
                        "blockhash": "CktRuQ2mttgRGkXJtyksdKHjUdc2C4TgDzyB98oEzy8", # PUBLIC-CONSTANT: synthetic
                        "last_valid_block_height": 200, "observed_block_height": 100}}
                prepared = rust("prepare", data)
                screens = []
                with session.test_ctx as client:
                    flow = InputFlowConfirmAllWarnings(session, on_page=lambda layout: screens.append(layout.screen_content()))
                    client.set_input_flow(flow.get())
                    signature = solana.sign_tx(session, address_n=parse_path(path),
                        serialized_tx=bytes.fromhex(prepared["connect"]["params"]["serializedTx"]), additional_info=None)
                data.update(signature_hex=signature.hex(), current_genesis=data["observation"]["genesis_hash"],
                            current_block_height=101, fee_lamports=5000)
                verified = rust("verify", data)
                data["intent"]["lamports"] = 999
                rejection = rust("verify", data, expect_success=False)
                runs.append({"model": session.features.internal_model, "public_address": payer,
                    "firmware_version": [session.features.major_version, session.features.minor_version, session.features.patch_version],
                    "transport_protocol": str(emulator.client.protocol_version),
                    "prepared": prepared, "verified": verified, "altered_intent_rejection": rejection,
                    "screens": screens})
            except Exception:
                log = Path(profile) / "trezor.log"
                if log.exists():
                    # This runner has only a fixed public test vector, never
                    # accepts a user's seed or existing profile.
                    print(log.read_text(errors="replace")[-5000:], file=sys.stderr)
                raise
            finally:
                emulator.stop()
                if tropic:
                    tropic.stop()
    if runs[0]["verified"] != runs[1]["verified"]:
        raise AssertionError("Restored fixture produced different signature or message")
    receipt = {"classification": "PUBLIC-CONSTANT", "schema": "bsafe.solana.emulator.v1", "source_revision": PIN,
        "emulator_sha256": hashlib.sha256(executable.read_bytes()).hexdigest(),
        "rust_bench_sha256": hashlib.sha256(args.rust_bench.read_bytes()).hexdigest(),
        "hardware_acceptance": False, "chain_settlement_observed": False,
        "public_vector_restore_matches": True, "runs": runs}
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, sort_keys=True) + "\n", encoding="utf-8")
    print("PASS: two T3W1 emulator signatures verified by Rust; restored fixture matches; changed intent refused. No hardware or network settlement.")


if __name__ == "__main__":
    main()
