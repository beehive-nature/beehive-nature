// Data-plane self-test with no vendor: namespaces A and B peer with each
// other over loopback WireGuard. Proves the namespace plumbing, handshake
// detection and the HMAC probe work before any live run spends a trial.
// Root on Linux only:  node selftest-netns.mjs
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { NetnsDataplane } from "./dataplane-netns.mjs";

const key = () => execFileSync("wg", ["genkey"]).toString().trim();
const pub = (k) => execFileSync("wg", ["pubkey"], { input: k + "\n" }).toString().trim();
const [ka, kb] = [key(), key()];
const dp = new NetnsDataplane({ secret: randomBytes(32).toString("hex") });
const out = {};
try {
  await dp.bringUp("A", { address: "10.99.0.1/31", ip: "10.99.0.1", privateKey: ka, peerKey: pub(kb), endpoint: "127.0.0.1:51902", listenPort: 51901 });
  await dp.bringUp("B", { address: "10.99.0.0/31", ip: "10.99.0.0", privateKey: kb, peerKey: pub(ka), endpoint: "127.0.0.1:51901", listenPort: 51902 });
  await dp.serve("A", [18080]);
  out.cross_open_port = await dp.knock("B", "10.99.0.1", 18080, 4000);
  out.cross_closed_port = await dp.knock("B", "10.99.0.1", 18081, 4000);
  out.handshake_age_s = [await dp.handshakeAge("A"), await dp.handshakeAge("B")];
  out.self = await dp.knock("A", "10.99.0.1", 18080, 4000);
} finally {
  await dp.teardown();
}
const pass = out.cross_open_port === "verified" && out.self === "verified" && out.cross_closed_port !== "verified" && out.handshake_age_s.every((a) => a !== null);
console.log(JSON.stringify({ selftest: pass ? "PASS" : "FAIL", ...out }));
process.exit(pass ? 0 : 1);
