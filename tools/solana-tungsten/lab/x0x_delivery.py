#!/usr/bin/env python3
"""Real x0xd delivery rehearsal. Requires upstream's admitted Linux namespace."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import statistics
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request


def require_isolation():
    links = json.loads(subprocess.check_output(['/usr/sbin/ip', '-j', 'link']))
    if [link['ifname'] for link in links] != ['lo'] or os.geteuid() == 0:
        raise RuntimeError('requires unprivileged loopback-only isolation; no host fallback')
    for family in ('-4', '-6'):
        routes = json.loads(subprocess.check_output(['/usr/sbin/ip', family, '-j', 'route', 'show', 'table', 'all']))
        if any(row.get('dev') != 'lo' or row.get('dst') == 'default' or 'gateway' in row for row in routes):
            raise RuntimeError('foreign route in runtime')


class Peer:
    def __init__(self, root, name, port, binary, seed):
        self.root = root / name
        self.root.mkdir(mode=0o700)
        self.port, self.binary = port, binary
        self.process = None
        self.log = (self.root / 'daemon.log').open('w')
        self.config = self.root / 'config.toml'
        self.config.write_text(f'''instance_name = "{name}"
network_id = "bnr.tungsten.local"
data_dir = "{self.root}/data"
identity_dir = "{self.root}/identity"
api_address = "127.0.0.1:{port}"
bind_address = "127.0.0.1:{port + 100}"
bootstrap_peers = {json.dumps(seed)}
mdns_enabled = false
port_mapping_enabled = false
rendezvous_enabled = false
log_level = "warn"
[history]
enabled = true
''')

    def start(self):
        self.process = subprocess.Popen([str(self.binary), '--config', str(self.config),
            '--no-hard-coded-bootstrap', '--disable-peer-cache', '--skip-update-check'],
            stdout=self.log, stderr=subprocess.STDOUT)
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise RuntimeError(f'{self.root.name}: daemon exited; inspect private daemon.log')
            try:
                self.token = (self.root / 'data/api-token').read_text().strip()
                self.request('/health')
                self.agent = self.request('/agent')['agent_id']
                return
            except (OSError, urllib.error.URLError):
                time.sleep(.2)
        raise RuntimeError('daemon readiness timeout')

    def stop(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()

    def request(self, path, body=None, authenticated=True):
        headers = {'Content-Type': 'application/json'}
        if authenticated:
            headers['Authorization'] = 'Bearer ' + self.token
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(f'http://127.0.0.1:{self.port}{path}', data, headers)
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)

    def metrics(self):
        raw = Path(f'/proc/{self.process.pid}/stat').read_text().split(') ', 1)[1].split()
        status = Path(f'/proc/{self.process.pid}/status').read_text().splitlines()
        rss = next(int(line.split()[1]) * 1024 for line in status if line.startswith('VmRSS:'))
        return {'cpu_seconds': (int(raw[11]) + int(raw[12])) / os.sysconf('SC_CLK_TCK'), 'rss_bytes': rss}

    def history(self, sender, limit=500):
        return self.request('/history?' + urllib.parse.urlencode({'scope': 'dm:' + sender, 'limit': limit}))['records']


def loopback_bytes():
    # sysfs can remain mounted from the parent namespace; use netlink instead.
    row = json.loads(subprocess.check_output(['/usr/sbin/ip', '-s', '-j', 'link', 'show', 'lo']))[0]
    return row.get('stats64', row.get('stats'))['tx']['bytes']


def run(args):
    require_isolation()
    root = Path(args.output).resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    bundle = json.loads(Path(args.bundle).read_text())
    peers = [Peer(root, 'alice', 23700, Path(args.binary), []),
             Peer(root, 'bob', 23701, Path(args.binary), ['127.0.0.1:23800'])]
    report = {'schema': 'bnr.tungsten-x0x-delivery/1', 'scope': 'two peers, same-host isolated loopback',
              'version': subprocess.check_output([args.binary, '--version'], text=True).strip(),
              'binary_sha256': hashlib.sha256(Path(args.binary).read_bytes()).hexdigest(),
              'cases': [], 'completed': False,
              'wire_measurement': 'loopback interface tx bytes INCLUDING HTTP control and polling; not public-network egress'}
    try:
        for peer in peers:
            peer.start()
        alice, bob = peers
        for src, dst in ((alice, bob), (bob, alice)):
            card = dst.request('/agent/card?include_local_addresses=true')
            src.request('/agent/card/import', {'card': card['link'], 'trust_level': 'Trusted'})
        time.sleep(3)
        unauthorized = False
        try:
            bob.request('/agent', authenticated=False)
        except urllib.error.HTTPError as error:
            unauthorized = error.code == 401
        assert unauthorized, 'unauthenticated local API must refuse'
        report['unauthenticated_api_refused'] = True
        idle_before = loopback_bytes()
        idle_start = time.monotonic()
        time.sleep(5)
        report['idle'] = {'seconds': time.monotonic() - idle_start, 'loopback_tx_bytes': loopback_bytes() - idle_before}
        first_request = None
        for count in (1, 10, 100):
            before = [p.metrics() for p in peers]
            byte_start, started = loopback_bytes(), time.monotonic()
            latencies, ids, payload_total = [], [], 0
            for i in range(count):
                logical_id = f'tungsten-{count}-{i}'
                payload = json.dumps({'logical_id': logical_id, 'bundle': bundle}, separators=(',', ':')).encode()
                request = {'agent_id': bob.agent, 'payload': base64.b64encode(payload).decode(),
                           'logical_id': logical_id, 'require_durable_app_ack': True}
                t0 = time.monotonic()
                response = alice.request('/direct/send', request)
                if not response.get('ok'):
                    raise RuntimeError(f'durable send refused: {response.get("error")}')
                # Single outstanding send: inspect only the latest row. Reading
                # the whole backlog on each send makes the harness O(n squared).
                records = bob.history(alice.agent, limit=1)
                observed = [r for r in records if base64.b64decode(r['payload']) == payload]
                assert len(observed) == 1, 'sender success must match exactly one receiver payload'
                ids.append(observed[0]['msg_id'])
                latencies.append((time.monotonic() - t0) * 1000)
                payload_total += len(payload)
                if first_request is None:
                    first_request = request
                    (root / 'received-bundle.json').write_text(json.dumps(json.loads(base64.b64decode(observed[0]['payload']))['bundle']))
            seconds = time.monotonic() - started
            after = [p.metrics() for p in peers]
            report['cases'].append({'messages': count, 'receiver_verified': len(ids), 'unique_receiver_ids': len(set(ids)),
                'seconds': seconds, 'messages_per_second': count / seconds,
                'p50_send_to_readback_ms': statistics.median(latencies),
                'p95_send_to_readback_ms': sorted(latencies)[max(0, int(.95 * len(latencies)) - 1)],
                'payload_bytes': payload_total, 'loopback_tx_bytes': loopback_bytes() - byte_start,
                'cpu_seconds': sum(b['cpu_seconds'] - a['cpu_seconds'] for a, b in zip(before, after)),
                'rss_bytes': [p['rss_bytes'] for p in after]})
            print(json.dumps({'x0x_batch': report['cases'][-1]}), flush=True)
        count_before = len(bob.history(alice.agent))
        bob.stop()
        bob.start()
        time.sleep(3)
        alice.request('/direct/send', first_request)
        assert len(bob.history(alice.agent)) == count_before, 'restart retry duplicated receiver history'
        report['restart_retry_deduplicated'] = True
        changed = dict(first_request, payload=base64.b64encode(b'altered-payload').decode())
        try:
            alice.request('/direct/send', changed)
            raise AssertionError('same logical id accepted changed payload')
        except urllib.error.HTTPError as error:
            assert error.code == 409, f'expected conflict, got {error.code}'
        report['logical_id_payload_conflict_refused'] = True
        report['completed'] = True
    finally:
        for peer in peers:
            peer.stop()
            peer.log.close()
        (root / 'receipt.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'x0x_receipt': str(root / 'receipt.json'), 'completed': report['completed']}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', required=True)
    parser.add_argument('--bundle', required=True)
    parser.add_argument('--output', required=True)
    run(parser.parse_args())
