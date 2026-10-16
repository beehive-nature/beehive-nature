#!/usr/bin/env python3
"""BNROSE-NETPART-001 courier: the delivery network between sovereign
nodes and the destination, inside an isolated rootless network
namespace. Real TCP on per-link ports (7001 link-A, 7002 link-B, 7003
link-D); partitions are real iptables DROPs on those ports, applied by
the schedule in netpart-demo.sh — the courier itself only models the
DELIVERY-SERVICE faults the schedule asks for (per-link delay, GET
duplicate), each named in the receipt.

Protocol (one request per connection):
  PUT <name> <len>\\n<bytes>   -> OK
  GET <name>\\n                -> DATA <len>\\n<bytes> | MISS
  STATS\\n                     -> one-line JSON counters
"""
import json
import os
import socket
import sys
import threading
import time

PORTS = [7001, 7002, 7003]  # link-A, link-B, link-D
FAULTS = os.environ.get("NETPART_FAULTS", "/tmp-netpart-none")
artifacts = {}
lock = threading.Lock()
stats = {"bytes_in": 0, "bytes_out": 0, "puts": 0, "gets": 0, "hits": 0, "misses": 0}


def faults():
    try:
        with open(FAULTS) as f:
            return json.load(f)
    except Exception:
        return {}


def handle(conn, port):
    f = conn.makefile("rb")
    try:
        line = f.readline().decode().strip().split()
        if not line:
            return
        fl = faults().get(str(port), {})
        delay = float(fl.get("delay_ms", 0)) / 1000.0
        if delay:
            time.sleep(delay)
        if line[0] == "PUT" and len(line) == 3:
            n = int(line[2])
            body = f.read(n)
            with lock:
                artifacts[line[1]] = body
                stats["puts"] += 1
                stats["bytes_in"] += n
            conn.sendall(b"OK\n")
        elif line[0] == "GET" and len(line) == 2:
            with lock:
                body = artifacts.get(line[1])
                stats["gets"] += 1
                if body is None:
                    stats["misses"] += 1
                else:
                    stats["hits"] += 1
            if body is None:
                conn.sendall(b"MISS\n")
            else:
                # duplicate delivery: the whole response twice on one
                # connection — a delivery fault the receiver must tolerate
                msg = b"DATA %d\n%s" % (len(body), body)
                if fl.get("dup"):
                    msg = msg + msg
                conn.sendall(msg)
                with lock:
                    stats["bytes_out"] += len(msg)
        elif line[0] == "STATS":
            with lock:
                conn.sendall(json.dumps(stats).encode() + b"\n")
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass


def serve(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("127.0.0.1", port))
    s.listen(16)
    while True:
        c, _ = s.accept()
        threading.Thread(target=handle, args=(c, port), daemon=True).start()


if __name__ == "__main__":
    for p in PORTS:
        threading.Thread(target=serve, args=(p,), daemon=True).start()
    print("courier up", flush=True)
    while True:
        time.sleep(3600)
