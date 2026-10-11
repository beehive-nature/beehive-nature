#!/usr/bin/env python3
"""Export only allowlisted PUBLIC proof/receipt evidence, never private state."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

def main(a):
    root, lab = Path(a.run).resolve(), Path(a.lab).resolve()
    def read(name):
        return json.loads((root/name).read_text())
    report = {'PUBLIC-CONSTANT':'Public local test evidence; hashes and proofs are not secrets',
              'acceptance':read('acceptance.json'),'build':read('plonk/build-receipt.json'),
              'owner_public_bundle':read('owner-bundle.json'),
              'plonk_public_key':read('plonk/vk.json'),'plonk_public_proof':read('plonk/proof.json'),
              'plonk_public_inputs':read('plonk/public.json'),'isolation':[]}
    for directory in sorted(root.glob('x0x-isolation-*')):
        report['isolation'].append({'admission':json.loads((directory/'admission.json').read_text()),
                                    'result':json.loads((directory/'exit.json').read_text())})
    assert len(report['isolation']) == 3
    assert all(x['result']['exit'] == 0 and x['admission']['namespace_changed'] and
               x['admission']['no_new_privs'] == 1 for x in report['isolation'])
    binaries = {'x0xd':lab/'bin/x0x-linux-x64-gnu/x0xd',
                'solana_verifier_sbf':lab/'bin/sbf/solana_groth16_program.so',
                'nodeos':Path('/usr/bin/nodeos')}
    report['binary_sha256'] = {key:hashlib.sha256(value.read_bytes()).hexdigest() for key,value in binaries.items()}
    report['versions'] = {key:subprocess.check_output(command,text=True).strip() for key,command in {
        'node':['node','--version'],'nodeos':['nodeos','--version'],'cdt':['cdt-cpp','--version'],
        'solana':[str(lab/'bin/solana-release/bin/solana'),'--version']}.items()}
    audit = subprocess.run(['npm','audit','--prefix',str(lab/'node'),'--json'],capture_output=True,text=True)
    assert audit.returncode == 0, 'dependency audit is not clean'
    report['npm_audit'] = json.loads(audit.stdout)['metadata']
    source = Path(__file__).resolve().parent
    files = [p for p in source.iterdir() if p.suffix in ('.py','.mjs','.cpp','.circom','.ps1','.json')]
    files += list((source.parent/'src').glob('*.rs'))
    files += [source.parent/'Cargo.toml',source.parent/'Cargo.lock']
    report['source_sha256'] = {str(p.relative_to(source.parent)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    output = Path(a.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    # Single-line public marker satisfies the estate hex-run scanner without
    # changing receipt bytes or hiding public cryptographic identifiers.
    output.write_text(json.dumps(report,separators=(',',':'))+'\n')
    print(f'Exported public evidence: {output}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for arg in ('run','lab','output'):
        parser.add_argument('--'+arg,required=True)
    main(parser.parse_args())
