"""The local owner's manifest is a trusted fixture, never learned from x0x."""
import hashlib
import json
from pathlib import Path


def validate(received_file, owner_file):
    received = json.loads(Path(received_file).read_text())
    owner = json.loads(Path(owner_file).read_text())
    expected = dict(domain='bnr:tungsten:local:v1',job_id='square-7',authorization_id='fixture-grant-1',
                    nonce=1,recipient='fixture-worker',asset='TEST-UNIT',amount=7,fee_asset='TEST-FEE',fee=1,input=7)
    assert received['schema'] == 'bnr.tungsten-proof-bundle/2'
    assert received['packet']['job'] == expected
    assert received['packet']['output'] == 49
    digest = hashlib.sha256(b'bnr-solana-tungsten/job/v1\0'+json.dumps(expected,separators=(',',':')).encode()).digest()
    fields = [7,49,int.from_bytes(digest[:16],'big'),int.from_bytes(digest[16:],'big'),1]
    assert received['public_inputs'] == [list(v.to_bytes(32,'big')) for v in fields]
    body = bytes(received['verifying_key_body'])
    assert received['verifying_key_hash'] == list(hashlib.sha256(body).digest())
    assert received['verifying_key_hash'] == owner['verifying_key_hash'], 'key must match out-of-band owner pin'
    assert received['verifying_key_body'] == owner['verifying_key_body']
    return received
