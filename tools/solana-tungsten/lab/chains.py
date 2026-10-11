#!/usr/bin/env python3
"""Run disposable chain processes inside the admitted namespace, never host."""
import argparse
import json
from pathlib import Path
import subprocess
import time
import urllib.request
from x0x_delivery import require_isolation
from bundle import validate


def main(args):
    require_isolation()
    validate(args.bundle, args.owner)
    root = Path(args.output).resolve()
    root.mkdir(mode=0o700, exist_ok=False)
    lab = Path(args.lab).resolve()
    script = Path(__file__).resolve().parent
    log = (root / 'validator.log').open('w')
    process = subprocess.Popen([str(lab / 'bin/solana-release/bin/solana-test-validator'),
        '--ledger', str(root / 'ledger'), '--rpc-port', '18899', '--faucet-port', '18901',
        '--bind-address', '127.0.0.1', '--dynamic-port-range', '18910-18940',
        '--quiet', '--bpf-program',
        'GrPeAM83MtRfR8NvbW3tMMSBzQ9BsmQrgLjLCQNwZW4P', str(lab / 'bin/sbf/solana_groth16_program.so')],
        stdout=log, stderr=subprocess.STDOUT)
    try:
        for _ in range(120):
            if process.poll() is not None:
                raise RuntimeError('validator exited; inspect private validator.log')
            try:
                request = urllib.request.Request('http://127.0.0.1:18899',
                    json.dumps({'jsonrpc':'2.0','id':1,'method':'getHealth'}).encode(),
                    {'Content-Type':'application/json'})
                if json.load(urllib.request.urlopen(request, timeout=1)).get('result') == 'ok':
                    break
            except OSError:
                pass
            time.sleep(.5)
        else:
            raise RuntimeError('validator readiness timeout')
        result = subprocess.run(['/usr/bin/node', str(script / 'solana.mjs'), str(lab / 'node'), str(root), args.bundle])
        if result.returncode != 75:
            raise RuntimeError(f'expected worker fault-injection exit 75, got {result.returncode}')
        subprocess.run(['/usr/bin/node', str(script / 'solana_recover.mjs'), str(lab / 'node'), str(root)], check=True)
    finally:
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--lab', required=True)
    p.add_argument('--bundle', required=True)
    p.add_argument('--owner', required=True)
    p.add_argument('--output', required=True)
    main(p.parse_args())
