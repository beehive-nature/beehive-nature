"""Runner fault probes: loopback/PID namespace only; no production commands."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
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
    with tempfile.TemporaryDirectory(prefix='astra-622-r3-') as temp:
        base = Path(temp)
        bindir, cli_hash, daemon_hash = t.make_stub_binaries(temp)
        collector = t.py_coll(str(base / 'collector.py'), 'time.sleep(2)\n')
        # Keep sampling deterministic here: these probes fault cleanup, not
        # the real sampler's in-flight subprocess termination race.
        sampler = base / 'steady_sampler.py'
        sampler.write_text("import json,signal,sys,time\n"
            "signal.signal(signal.SIGTERM,lambda *_:sys.exit(0))\n"
            "out=sys.argv[sys.argv.index('--out')+1]\n"
            "with open(out,'a') as f:\n"
            " while True:\n"
            "  f.write(json.dumps({'ts':time.time(),'mono':time.monotonic(),'health':{'peers':1,'uptime_secs':int(time.monotonic())}})+'\\n'); f.flush(); time.sleep(.2)\n")
        for case in ('healthy', 'cleanup-receipt-full', 'stop-ignores-term', 'partial-start-cancel'):
            ev = base / case
            ev.mkdir()
            node_env, _, _, stopped = t.node_stub(temp, case)
            env = t.base_env(bindir, cli_hash, daemon_hash, str(ev), collector,
                X0X_WINDOW_SECS=300, X0X_LEASE_SECS=700, X0X_ATTEMPTS_MAX=1,
                X0X_HELPER_GRACE=1, X0X_STOP_TIMEOUT=1, X0X_STOP_FORCE_TIMEOUT=1,
                **node_env)
            env['X0X_SAMPLER'] = str(sampler)
            env['X0X_NODE_FORCE_STOP'] = f'touch {stopped}'
            if case == 'cleanup-receipt-full':
                env['X0X_COLLECTOR'] = t.py_coll(str(base / 'cleanup_full.py'),
                    "import os\nos.symlink('/dev/full',a.out_dir+'/CLEANUP.json')\ntime.sleep(2)\n")
            if case == 'stop-ignores-term':
                env['X0X_NODE_STOP'] = "trap '' TERM; while :; do sleep 1; done"
            node_pid = None
            if case == 'partial-start-cancel':
                marker = base / 'partial-started'
                node_file = base / 'node.pid'
                env['X0X_NODE_START'] = f'setsid sleep 30 >/dev/null 2>&1 & echo $! > {node_file}; touch {marker}; sleep 30'
                env['X0X_NODE_STOP'] = f'kill -TERM -- -$(cat {node_file}); touch {stopped}'
            with (base / (case + '.log')).open('w+') as log:
                proc = subprocess.Popen(['bash', t.RUNNER], env=env, stdout=log,
                                        stderr=log, start_new_session=True)
                try:
                    if case == 'partial-start-cancel':
                        end = time.monotonic() + 5
                        while not marker.exists() and time.monotonic() < end:
                            time.sleep(.05)
                        assert marker.exists()
                        node_pid = int(node_file.read_text())
                        proc.send_signal(signal.SIGTERM)
                    try:
                        proc.wait(timeout=10)
                        rc = proc.returncode
                    except subprocess.TimeoutExpired:
                        rc = 'still-running-after-10s'
                    log.flush()
                    log.seek(0)
                    output = log.read()
                    result = {'case':case, 'runner_exit':rc, 'node_stop_marker':Path(stopped).exists(),
                              'cleanup_receipt_error_reported':'cleanup receipt write failed' in output}
                    if node_pid:
                        try:
                            os.kill(node_pid, 0)
                            result['detached_test_node_alive'] = True
                        except ProcessLookupError:
                            result['detached_test_node_alive'] = False
                    results.append(result)
                finally:
                    if proc.poll() is None:
                        os.killpg(proc.pid, signal.SIGKILL)
                        proc.wait(timeout=3)
                    if node_pid:
                        try:
                            os.killpg(node_pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
finally:
    server.shutdown()
    server.server_close()
print(json.dumps({'candidate':'1df62813', 'public_mesh':False, 'results':results}, indent=2))
