"""Review only. Run inside an empty user+network namespace; never a mesh capture."""
import hashlib
import json
import os
from pathlib import Path
import resource
import signal
import sys
import subprocess
import tempfile
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

links = json.loads(subprocess.check_output(['ip', '-j', 'link'], text=True))
assert [link['ifname'] for link in links] == ['lo'], 'isolated loopback required'
assert Path('/proc/net/route').read_text().count('\n') == 1, 'no route may exist'
assert len(sys.argv) == 2, 'usage: probe.py /path/to/pinned/linux-x64-gnu'
binroot = Path(sys.argv[1]).resolve()
out = {'kind': 'packet-review-loopback-only', 'public_mesh': False}

class Trap(BaseHTTPRequestHandler):
    hits = []
    def do_GET(self):
        self.hits.append(self.path)
        body = json.dumps({'ok': True, 'version': 'DECOY-DEFAULT', 'peers': 9}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *args):
        pass

def limits():
    resource.setrlimit(resource.RLIMIT_CPU, (40, 40))
    resource.setrlimit(resource.RLIMIT_AS, (3 * 1024**3, 3 * 1024**3))
    resource.setrlimit(resource.RLIMIT_FSIZE, (32 * 1024**2, 32 * 1024**2))

with tempfile.TemporaryDirectory(prefix='bnr-622-packet-review-') as name:
    root = Path(name)
    home = root / 'home'
    home.mkdir()
    env = {'PATH': str(binroot) + ':/usr/bin:/bin', 'HOME': str(home),
           'XDG_DATA_HOME': str(home / 'data'), 'XDG_CONFIG_HOME': str(home / 'config'),
           'RUST_LOG': 'warn', 'NO_PROXY': '*'}
    config = root / 'daemon.toml'
    config.write_text(f'''api_address = "127.0.0.1:12710"
bind_address = "127.0.0.1:0"
data_dir = "{root}/state"
identity_dir = "{root}/identity"
mdns_enabled = false
port_mapping_enabled = false
zero_peer_restart_secs = 0
[update]
enabled = false
''')
    trap = HTTPServer(('127.0.0.1', 12700), Trap)
    threading.Thread(target=trap.serve_forever, daemon=True).start()
    with (root / 'daemon.log').open('w') as log:
        process = subprocess.Popen([str(binroot / 'x0xd'), '--config', str(config),
            '--no-hard-coded-bootstrap', '--disable-peer-cache', '--skip-update-check'],
            cwd=root, env=env, stdout=log, stderr=log, start_new_session=True, preexec_fn=limits)
        try:
            deadline = time.monotonic() + 40
            health = None
            while time.monotonic() < deadline:
                try:
                    with urllib.request.urlopen('http://127.0.0.1:12710/health', timeout=1) as res:
                        health = json.load(res)
                    break
                except Exception:
                    if process.poll() is not None:
                        raise RuntimeError(f'daemon exited {process.returncode}')
                    time.sleep(.25)
            assert health is not None, 'daemon did not expose health within review deadline'
            token = (root / 'state/api-token').read_text().strip()
            req = urllib.request.Request('http://127.0.0.1:12710/diagnostics/gossip',
                headers={'Authorization': 'Bearer ' + token})
            with urllib.request.urlopen(req, timeout=3) as res:
                gossip = json.load(res)
            out['binary_sha256'] = hashlib.sha256((binroot / 'x0xd').read_bytes()).hexdigest()
            out['health'] = {k: health.get(k) for k in ('version', 'peers', 'status')}
            out['has_participation'] = 'participation' in gossip
            out['message_kinds'] = gossip.get('pubsub_stages', {}).get('message_kinds', 'ABSENT')
            out['stage_keys'] = list(gossip.get('pubsub_stages', {}))
            env['X0X_API_TOKEN'] = token
            bare = subprocess.run(['x0x', 'health', '--json'], env=env, capture_output=True,
                text=True, timeout=8)
            explicit = subprocess.run(['x0x', '--api', '127.0.0.1:12710', 'health', '--json'],
                env=env, capture_output=True, text=True, timeout=8)
            out['collector_style_cli'] = {'exit': bare.returncode, 'default_port_hits': Trap.hits,
                'read_decoy': 'DECOY-DEFAULT' in bare.stdout}
            out['explicit_cli'] = {'exit': explicit.returncode, 'read_instrumented': '0.41.4' in explicit.stdout}
            mangled = b'{"ts":123,' + explicit.stdout.encode()[5:][:400]
            try:
                json.loads(mangled)
                out['packet_sampler_valid_json'] = True
            except json.JSONDecodeError:
                out['packet_sampler_valid_json'] = False
            out['packet_sampler_redirects_to_health_file'] = False
            failpipe = subprocess.run(['bash', '-c', '(exit 7) 2>&1 | tee "$1"', 'probe', str(root/'console')], capture_output=True)
            checkedpipe = subprocess.run(['bash', '-o', 'pipefail', '-c', '(exit 7) 2>&1 | tee "$1"', 'probe', str(root/'console2')], capture_output=True)
            out['packet_pipeline_exit_after_collector_exit_7'] = failpipe.returncode
            out['pipefail_control_exit'] = checkedpipe.returncode
            evidence = root / 'repeat'
            evidence.mkdir()
            (evidence / 't0.json').write_text('ORIGINAL')
            subprocess.run(['mkdir', '-p', str(evidence)], check=True)
            (evidence / 't0.json').write_text('REPLACED')
            out['packet_mkdir_allows_evidence_overwrite'] = (evidence / 't0.json').read_text() == 'REPLACED'
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
            trap.shutdown()
            trap.server_close()
    out['own_child_stopped'] = process.poll() is not None
print(json.dumps(out, indent=2))
