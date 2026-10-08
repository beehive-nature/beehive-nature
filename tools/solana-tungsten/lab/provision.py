#!/usr/bin/env python3
"""Fetch pinned public tool artifacts into a dedicated lab; no daemons start."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

X0X = '427c411c035474ab4fb06102f19815ba4490e6ac'
GROTH16 = '8bd06b4fb07f636c1872993a99f1a296b23b69fa'
ASSETS = [
    ('x0x-v0.46.5.tar.gz','https://github.com/saorsa-labs/x0x/releases/download/v0.46.5/x0x-linux-x64-gnu.tar.gz',
     '929ce41ef0c2cf13d6f1ac38bf42821cac3c707ea749c9eb2d27783a9520a176','bin'), # PUBLIC-CONSTANT release checksum
    ('solana-v4.2.2.tar.bz2','https://github.com/anza-xyz/agave/releases/download/v4.2.2/solana-release-x86_64-unknown-linux-gnu.tar.bz2',
     '5fc8684f7430038105fde953d4308ed56addf627f658daa61709f345448247ee','bin'), # PUBLIC-CONSTANT release checksum
    (f'x0x-source-{X0X}.tar.gz',f'https://codeload.github.com/saorsa-labs/x0x/tar.gz/{X0X}',None,'source'),
    ('groth16-source.tar.gz',f'https://codeload.github.com/solana-program/groth16-verifier-program/tar.gz/{GROTH16}',None,'source'),
]

def main(root):
    root = Path(root).resolve()
    root.mkdir(mode=0o700,parents=True,exist_ok=True)
    for name in ('downloads','bin','source','node'):
        (root/name).mkdir(mode=0o700,exist_ok=True)
    for name,url,checksum,destination in ASSETS:
        archive = root/'downloads'/name
        if not archive.exists():
            temporary = archive.with_suffix('.partial')
            with urllib.request.urlopen(url,timeout=60) as response, temporary.open('xb') as out:
                shutil.copyfileobj(response,out)
            temporary.rename(archive)
        if checksum and hashlib.sha256(archive.read_bytes()).hexdigest() != checksum:
            raise RuntimeError(f'checksum mismatch: {name}')
        with tarfile.open(archive) as tar:
            tar.extractall(root/destination,filter='data')
    here = Path(__file__).resolve().parent
    for name in ('package.json','package-lock.json'):
        shutil.copyfile(here/name,root/'node'/name)
    subprocess.run(['npm','ci','--ignore-scripts','--prefix',str(root/'node')],check=True)
    cargo = Path.home()/'.cargo/bin'
    env = dict(os.environ,PATH=f'{root}/bin/solana-release/bin:{cargo}:/usr/local/bin:/usr/bin:/bin',
               CARGO_TARGET_DIR=str(root/'solana-target'))
    subprocess.run([str(root/'bin/solana-release/bin/cargo-build-sbf'),'--manifest-path',
        str(root/f'source/groth16-verifier-program-{GROTH16}/program/Cargo.toml'),
        '--sbf-out-dir',str(root/'bin/sbf'),'--arch','v3'],env=env,check=True)
    print(f'Provisioned public tools in {root}; no network daemon started')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--lab',required=True)
    main(parser.parse_args().lab)
