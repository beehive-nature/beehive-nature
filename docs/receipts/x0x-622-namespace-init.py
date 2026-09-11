"""Minimal PID-namespace init for isolated review tests; reaps orphan children."""
import os
import subprocess
import sys

assert os.getpid() == 1, 'must run as PID 1 inside a fresh PID namespace'
child = subprocess.Popen(sys.argv[1:])
while True:
    pid, status = os.wait()
    if pid == child.pid:
        sys.exit(os.waitstatus_to_exitcode(status))
