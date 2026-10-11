// Live data plane: one Linux network namespace per tunnel, each holding a
// WireGuard interface created in the root namespace and then moved in, so
// its encrypted UDP leaves through the host while everything inside the
// namespace can only route through doxx. The host's own routes are never
// touched (no wg-quick). Needs root, iproute2, wireguard-tools and the
// wireguard kernel module. Every argument goes through execFile, never a shell.
import { execFile, spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const PROBE = join(dirname(fileURLToPath(import.meta.url)), "probe.mjs");
const KEYDIR = "/run/bnr-tt";

export function nsName(label) {
  if (!/^[A-C]$/.test(label)) throw new Error("ns-label-invalid");
  return `bnrtt-${label}`;
}

export function parseWgConfig(config) {
  const iface = config?.interface || {};
  const peer = config?.peer || {};
  const v4 = String(iface.address || "").split(",").map((s) => s.trim()).find((s) => /^\d+\.\d+\.\d+\.\d+\/\d+$/.test(s));
  if (!v4 || !iface.private_key || !peer.public_key || !peer.endpoint) throw new Error("wg-config-incomplete");
  return { address: v4, ip: v4.split("/")[0], privateKey: iface.private_key, peerKey: peer.public_key, endpoint: peer.endpoint };
}

export class NetnsDataplane {
  constructor({ secret, nodeBin = process.execPath }) {
    this.secret = secret;
    this.node = nodeBin;
    this.servers = [];
    this.up = new Set();
  }

  parse(config) {
    return parseWgConfig(config);
  }

  async bringUp(label, wg) {
    const ns = nsName(label);
    mkdirSync(KEYDIR, { recursive: true, mode: 0o700 });
    const keyFile = join(KEYDIR, `${ns}.key`);
    await run("ip", ["netns", "add", ns]);
    this.up.add(ns);
    await run("ip", ["link", "add", ns, "type", "wireguard"]);
    try {
      writeFileSync(keyFile, wg.privateKey + "\n", { mode: 0o600 });
      const listen = wg.listenPort ? ["listen-port", String(wg.listenPort)] : []; // self-test only; doxx clients dial out
      await run("wg", ["set", ns, ...listen, "private-key", keyFile, "peer", wg.peerKey, "endpoint", wg.endpoint, "allowed-ips", "0.0.0.0/0", "persistent-keepalive", "25"]);
    } finally {
      rmSync(keyFile, { force: true });
    }
    await run("ip", ["link", "set", ns, "netns", ns]);
    await run("ip", ["-n", ns, "addr", "add", wg.address, "dev", ns]);
    await run("ip", ["-n", ns, "link", "set", "lo", "up"]);
    await run("ip", ["-n", ns, "link", "set", ns, "up"]);
    await run("ip", ["-n", ns, "route", "add", "default", "dev", ns]);
  }

  // Seconds since the latest handshake, or null if there has been none.
  async handshakeAge(label) {
    const ns = nsName(label);
    const { stdout } = await run("ip", ["netns", "exec", ns, "wg", "show", ns, "latest-handshakes"]);
    const ts = Number(stdout.trim().split(/\s+/)[1] || 0);
    return ts > 0 ? Math.floor(Date.now() / 1000) - ts : null;
  }

  serve(label, ports) {
    const child = spawn("ip", ["netns", "exec", nsName(label), this.node, PROBE, "serve", ports.join(",")], {
      env: { PATH: process.env.PATH, BNR_TT_SECRET: this.secret },
      stdio: ["ignore", "ignore", "ignore"],
    });
    this.servers.push(child);
    return new Promise((r) => setTimeout(r, 1000));
  }

  async knock(label, ip, port, timeoutMs) {
    try {
      const { stdout } = await run("ip", ["netns", "exec", nsName(label), this.node, PROBE, "knock", ip, String(port), String(timeoutMs)], {
        env: { PATH: process.env.PATH, BNR_TT_SECRET: this.secret },
        timeout: timeoutMs + 5000,
      });
      return JSON.parse(stdout.trim()).result;
    } catch {
      return "error";
    }
  }

  async teardown() {
    for (const c of this.servers) c.kill("SIGTERM");
    for (const ns of this.up) {
      await run("ip", ["link", "del", ns]).catch(() => {}); // only exists if the move into the namespace failed
      await run("ip", ["netns", "del", ns]).catch(() => {});
    }
    this.up.clear();
    rmSync(KEYDIR, { recursive: true, force: true });
  }
}
