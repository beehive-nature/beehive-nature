#!/usr/bin/env python3
"""Prepare the upstream runtime, leaving privileged entry to the WSL launcher.

Only its caller function is replaced; config filtering, setup, privilege drop,
and admission execute from the pinned upstream file without source edits.
"""
import importlib.util
from pathlib import Path
import sys

runtime = Path(sys.argv[1]).resolve()
spec = importlib.util.spec_from_file_location('x0x_isolation', runtime)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
def prepared(config):
    print('BNR_CONFIG='+str(config),flush=True)
    return 0
module.caller = prepared
sys.argv = [str(runtime), *sys.argv[2:]]
raise SystemExit(module.main())
