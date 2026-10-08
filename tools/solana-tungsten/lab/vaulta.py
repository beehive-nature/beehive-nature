#!/usr/bin/env python3
"""Same square statement through existing Vaulta PLONK arithmetic on Spring."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request
from x0x_delivery import require_isolation


def rpc(port, method, data):
    req = urllib.request.Request(f'http://127.0.0.1:{port}/v1/{method}', json.dumps(data).encode(),
                                 {'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)


def main(a):
    require_isolation()
    root, build = Path(a.output).resolve(), Path(a.build).resolve()
    root.mkdir(mode=0o700, exist_ok=False)
    for directory in ('wallet','data','config'):
        (root/directory).mkdir(mode=0o700)
    logs, processes = [], []
    def start(command, name):
        log = (root/(name+'.log')).open('w'); logs.append(log)
        process = subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT)
        processes.append(process)
        return process
    def ready(port, method, data):
        for _ in range(100):
            if any(p.poll() is not None for p in processes):
                raise RuntimeError('owned daemon exited; inspect private logs')
            try:
                return rpc(port,method,data)
            except OSError:
                time.sleep(.2)
        raise RuntimeError('daemon readiness timeout')
    def wait_feature(digest):
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            activated = rpc(18888,'chain/get_activated_protocol_features',{'limit':100})
            if any(f['feature_digest'] == digest for f in activated['activated_protocol_features']):
                return
            if any(p.poll() is not None for p in processes):
                raise RuntimeError('owned daemon exited during protocol activation')
            time.sleep(.25)
        raise RuntimeError('protocol feature activation timeout')
    def cleos(*args, expected=None):
        result = subprocess.run(['/usr/bin/cleos','--no-auto-keosd','-u','http://127.0.0.1:18888',
                                 '--wallet-url','http://127.0.0.1:18902',*map(str,args)],capture_output=True,text=True)
        if expected:
            combined = result.stdout + result.stderr
            assert result.returncode != 0 and expected in combined, f'expected refusal: {expected}; exit={result.returncode}; {combined[-1800:]}'
            return
        if result.returncode:
            raise RuntimeError(f'cleos exit={result.returncode}: {result.stderr[-2000:]}')
        return json.loads(result.stdout) if result.stdout.strip().startswith('{') else result.stdout
    def action(account, name, data, auth, expected=None):
        return cleos('push','action',account,name,json.dumps(data),'-p',auth,'-j',expected=expected)
    try:
        # Ephemeral fixture key only; never print or pass a private key on argv.
        generated = subprocess.check_output(['/usr/bin/cleos','create','key','--to-console'],text=True)
        private = re.search(r'Private key: (\S+)',generated).group(1)
        public = re.search(r'Public key: (\S+)',generated).group(1)
        start(['/usr/bin/keosd','--wallet-dir',str(root/'wallet'),'--http-server-address','127.0.0.1:18902',
               '--unix-socket-path',str(root/'wallet/keosd.sock')],'keosd')
        ready(18902,'wallet/list_wallets',{})
        rpc(18902,'wallet/create','tungsten')
        rpc(18902,'wallet/import_key',['tungsten',private])
        del private, generated
        genesis = {'initial_timestamp':datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000'),
                   'initial_key':public}
        (root/'genesis.json').write_text(json.dumps(genesis))
        (root/'config/config.ini').write_text(f'''plugin = eosio::chain_api_plugin
plugin = eosio::producer_plugin
plugin = eosio::producer_api_plugin
http-server-address = 127.0.0.1:18888
p2p-listen-endpoint = 127.0.0.1:18987
producer-name = eosio
enable-stale-production = true
signature-provider = {public}=KEOSD:http://127.0.0.1:18902/v1/wallet/sign_digest
# A contended local host can exceed Spring's default 5 ms wallet RPC budget.
keosd-provider-timeout = 100
# ABI table readback also needs headroom on the shared development machine.
abi-serializer-max-time-ms = 150
max-transaction-time = 200
chain-state-db-size-mb = 256
chain-state-db-guard-size-mb = 16
''')
        start(['/usr/bin/nodeos','--data-dir',str(root/'data'),'--config-dir',str(root/'config'),
               '--genesis-json',str(root/'genesis.json')],'nodeos')
        info = ready(18888,'chain/get_info',{})
        features = rpc(18888,'producer/get_supported_protocol_features',{'exclude_disabled':False,'exclude_unactivatable':False})
        feature = {next(x['value'] for x in f['specification'] if x['name']=='builtin_feature_codename'):f['feature_digest'] for f in features}
        rpc(18888,'producer/schedule_protocol_feature_activations',{'protocol_features_to_activate':[feature['PREACTIVATE_FEATURE']]})
        wait_feature(feature['PREACTIVATE_FEATURE'])
        cleos('set','contract','eosio',build,'boot.wasm','boot.abi','-j')
        action('eosio','activate',[feature['CRYPTO_PRIMITIVES']],'eosio')
        wait_feature(feature['CRYPTO_PRIMITIVES'])
        cleos('create','account','eosio','tungsten',public,'-j')
        cleos('create','account','eosio','worker',public,'-j')
        cleos('set','contract','tungsten',build,'tungsten.wasm','tungsten.abi','-j')
        data = json.loads((build/'calldata.json').read_text())
        action('tungsten','grant',['worker',7,7,int(time.time())+180,data['pubs_hex']],'tungsten')
        def balances():
            return {r['owner']:r['units'] for r in cleos('get','table','tungsten','tungsten','balances')['rows']}
        assert balances() == {'tungsten':7,'worker':0}
        action('tungsten','settle',['eosio',7,data['proof_hex']],'worker',expected='authority mismatch')
        action('tungsten','settle',['worker',8,data['proof_hex']],'worker',expected='authority mismatch')
        action('tungsten','settle',['worker',7,'00'*768],'worker',expected='PLONK rejected')
        rows = cleos('get','table','tungsten','tungsten','grants')['rows']
        assert rows[0]['credited'] == 0 and not rows[0]['spent']
        assert balances() == {'tungsten':7,'worker':0}
        result = action('tungsten','settle',['worker',7,data['proof_hex']],'worker')
        block = result['processed']['block_num']
        for _ in range(100):
            info = rpc(18888,'chain/get_info',{})
            if info['last_irreversible_block_num'] >= block:
                break
            time.sleep(.5)
        assert info['last_irreversible_block_num'] >= block, 'not irreversible'
        rows = cleos('get','table','tungsten','tungsten','grants')['rows']
        assert rows[0]['spent'] and rows[0]['credited'] == 7
        assert balances() == {'tungsten':0,'worker':7}
        # Stop and restart the owned chain against the same durable state.
        old = processes.pop()
        old.terminate(); old.wait(timeout=10)
        start(['/usr/bin/nodeos','--data-dir',str(root/'data'),'--config-dir',str(root/'config')],'nodeos-restart')
        ready(18888,'chain/get_info',{})
        time.sleep(1)
        action('tungsten','settle',['worker',7,data['proof_hex']],'worker',expected='authorization consumed')
        assert balances() == {'tungsten':0,'worker':7}
        receipt = {'schema':'bnr.tungsten-vaulta-local/1','scope':'private Spring; fixture-unit ledger, not native token transfer',
                   'chain_id':info['chain_id'],'transaction_id':result['transaction_id'],'block_num':block,
                   'last_irreversible_block_num':info['last_irreversible_block_num'],
                   'cpu_usage_us':result['processed']['receipt']['cpu_usage_us'],
                   'net_usage_words':result['processed']['receipt']['net_usage_words'],
                   'amount':7,'finality':'irreversible','same_public_inputs':True,
                   'forged_proof_refused':True,'wrong_recipient_refused':True,'overpayment_refused':True,
                   'on_chain_authorization_replay_refused':True,'production_bpay_authority':False}
        receipt.update(chain_restart_replay_refused=True,escrow_balance=0,recipient_balance=7,
                       balances_conserved=True,recipient='worker')
        (root/'vaulta-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
        print(json.dumps(receipt),flush=True)
    finally:
        for p in reversed(processes):
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    p.kill(); p.wait()
        for log in logs:
            log.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--output',required=True)
    p.add_argument('--build',required=True)
    main(p.parse_args())
