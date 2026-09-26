"""Negative probes of 9b5df485. Run only in an empty PID/network namespace."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import threading
import time

assert [i['ifname'] for i in json.loads(subprocess.check_output(
    ['ip', '-j', 'link'], text=True))] == ['lo']
assert Path('/proc/net/route').read_text().count('\n') == 1
root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('builder_tests', root / 'scripts/x0x-622/test_runner.py')
t = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t)
server = t.ThreadingHTTPServer(('127.0.0.1', 12710), t.StubAPI)
threading.Thread(target=server.serve_forever, daemon=True).start()
results = []
try:
    with tempfile.TemporaryDirectory(prefix='astra-622-rereview-') as temp:
        base = Path(temp)
        bindir, cli_hash, daemon_hash = t.make_stub_binaries(temp)
        collector = t.py_coll(str(base / 'collector.py'), 'time.sleep(1.2)\n')
        for case in ('healthy-control', 'sampler-exit22', 'sampler-exit21',
                     'logger-exit9', 'receipt-write-failure', 'node-stop-failure'):
            evidence = base / case
            evidence.mkdir()
            node_env, _, _, stopped = t.node_stub(temp, case)
            env = t.base_env(bindir, cli_hash, daemon_hash, str(evidence), collector,
                X0X_WINDOW_SECS=300, X0X_LEASE_SECS=700, X0X_ATTEMPTS_MAX=1, **node_env)
            if case.startswith('sampler-exit'):
                code = int(case.removeprefix('sampler-exit'))
                fake = base / (case + '.py')
                fake.write_text("import sys,json,time\n"
                    "out=sys.argv[sys.argv.index('--out')+1]\n"
                    "with open(out,'w') as f:\n"
                    " f.write(json.dumps({'ts':time.time(),'mono':time.monotonic(),'health':{'peers':1}})+'\\n')\n"
                    + (" for i in range(3): f.write(json.dumps({'ts':time.time(),'error':'request timeout'})+'\\n')\n" if code == 21 else '')
                    + f'raise SystemExit({code})\n')
                env['X0X_SAMPLER'] = str(fake)
            if case == 'logger-exit9':
                env['X0X_LOG_FOLLOW'] = 'exit 9'
            if case == 'receipt-write-failure':
                env['X0X_COLLECTOR'] = t.py_coll(str(base / 'receipt_fail.py'),
                    "import os\nos.symlink('/dev/full',a.out_dir+'/ATTEMPT.json')\ntime.sleep(1.2)\n")
            if case == 'node-stop-failure':
                env['X0X_NODE_STOP'] = 'false'
            proc = subprocess.run(['bash', t.RUNNER], env=env, capture_output=True,
                                  text=True, timeout=12, start_new_session=True)
            attempt = next(evidence.glob('*/ATTEMPT.json'), None)
            status = ('unwritable-receipt' if attempt and attempt.is_symlink()
                      else json.loads(attempt.read_text())['status'] if attempt else 'missing')
            results.append({'case':case, 'runner_exit':proc.returncode,
                            'attempt_status':status, 'node_stop_marker':Path(stopped).exists()})
        evidence = base / 'blocked-start'
        evidence.mkdir()
        marker = base / 'start-entered'
        env = t.base_env(bindir, cli_hash, daemon_hash, str(evidence), collector,
            X0X_WINDOW_SECS=300, X0X_LEASE_SECS=700, X0X_ATTEMPTS_MAX=1,
            X0X_NODE_START=f'touch {marker}; exec sleep 30', X0X_NODE_STOP='true')
        with (base / 'blocked.log').open('w') as log:
            proc = subprocess.Popen(['bash', t.RUNNER], env=env, stdout=log,
                                    stderr=log, start_new_session=True)
            try:
                until = time.monotonic() + 5
                while not marker.exists() and time.monotonic() < until:
                    time.sleep(.05)
                assert marker.exists()
                proc.send_signal(signal.SIGTERM)
                try:
                    proc.wait(timeout=2)
                    still_running = False
                except subprocess.TimeoutExpired:
                    still_running = True
                results.append({'case':'term-during-blocked-start',
                                'still_running_after_2s':still_running})
            finally:
                if proc.poll() is None:
                    os.killpg(proc.pid, signal.SIGKILL)
                    proc.wait(timeout=3)
finally:
    server.shutdown()
    server.server_close()
print(json.dumps({'pin':'9b5df485','public_mesh':False,'results':results}, indent=2))
