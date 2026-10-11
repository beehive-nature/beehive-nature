#!/usr/bin/env python3
"""Build the matching circuit using existing verifier arithmetic unchanged."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
from bundle import validate


def main(a):
    source = Path(__file__).resolve().parent
    privacy = source.parents[2] / 'contracts/privacy'
    out = Path(a.output).resolve()
    out.mkdir(mode=0o700, exist_ok=False)
    bundle = validate(a.bundle, a.owner)
    values = [str(int.from_bytes(bytes(v), 'big')) for v in bundle['public_inputs']]
    inputs = dict(zip(['x','y','contextHi','contextLo','nonce'], values))
    inputs.update(copyHi=values[2], copyLo=values[3], copyNonce=values[4])
    (out / 'input.json').write_text(json.dumps(inputs))
    def run(command):
        subprocess.run([str(x) for x in command], cwd=out, check=True)
    snark = Path(a.node) / 'node_modules/snarkjs/build/cli.cjs'
    run([a.circom, source / 'square.circom', '--r1cs', '--wasm', '--O0', '-o', out])
    run(['node', snark, 'plonk','setup',out/'square.r1cs',a.ptau,out/'square.zkey'])
    run(['node',out/'square_js/generate_witness.js',out/'square_js/square.wasm',out/'input.json',out/'witness.wtns'])
    run(['node',snark,'plonk','prove',out/'square.zkey',out/'witness.wtns',out/'proof.json',out/'public.json'])
    assert json.loads((out/'public.json').read_text()) == values, 'PLONK/Groth16 public order mismatch'
    run(['node',snark,'zkey','export','verificationkey',out/'square.zkey',out/'vk.json'])
    run(['node',snark,'plonk','verify',out/'vk.json',out/'public.json',out/'proof.json'])
    for filename in ('plonk_verify.hpp','field256.hpp'):
        shutil.copyfile(privacy/filename,out/filename)
    # Arithmetic is byte-for-byte copied. Only its existing compile-time VK
    # include resolves to this generated test circuit's constants in out/.
    run(['node',privacy/'gen_vk_cpp.js',out/'vk.json',out/'vk_constants.hpp'])
    lines = (out/'vk_constants.hpp').read_text().splitlines()
    lines[1:4] = ['// Tungsten square.circom; local test-only setup.',
                  '// Supplied PTAU provenance is NOT a production ceremony assurance.']
    (out/'vk_constants.hpp').write_text('\n'.join(lines)+'\n')
    flat = subprocess.check_output(['node',str(privacy/'flatten.js'),str(out/'proof.json'),str(out/'public.json')])
    (out/'calldata.json').write_bytes(flat)
    for contract in ('tungsten','boot'):
        run(['cdt-cpp','-O2','-abigen','-contract',contract,'-I',out,'-o',out/(contract+'.wasm'),source/(contract+'.cpp')])
    hashes = {name:hashlib.sha256((out/name).read_bytes()).hexdigest() for name in
              ('plonk_verify.hpp','field256.hpp','vk_constants.hpp','tungsten.wasm','boot.wasm','square.r1cs')}
    hashes['ptau'] = hashlib.sha256(Path(a.ptau).read_bytes()).hexdigest()
    (out/'build-receipt.json').write_text(json.dumps({'hashes':hashes,'same_public_inputs':True,
        'host_verified':True,'ceremony':'local test-only; external supplied PTAU'},indent=2)+'\n')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    for arg in ('output','bundle','owner','node','circom','ptau'):
        p.add_argument('--'+arg,required=True)
    main(p.parse_args())
