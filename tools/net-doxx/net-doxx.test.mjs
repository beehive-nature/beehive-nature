// The harness must not be able to report success it did not observe. Each
// sabotage below models one way the vendor, the path or the probe can lie;
// the honest fake shows the best verdict the documented product can earn.
import test from "node:test";
import assert from "node:assert/strict";
import { DoxxAdapter, redact } from "./doxx-adapter.mjs";
import { runTungsten } from "./tungsten.mjs";
import { reconcileNetReceipt, computeVerdict, receiptDigest, REQUIRED_CHECKS } from "./net-receipt.mjs";
import { knock, serve } from "./probe.mjs";

const ADMIN = "adminTokenSynthetic_aaaaaaaaaaaaaaaa";
const NET = "netadminTokenSynthetic_bbbbbbbbbbbbbb";

function world(sab = {}) {
  const clock = { t: Date.parse("2026-10-05T12:00:00Z") };
  const s = { tunnels: [], rules: [], effective: [], linkAll: !!sab.linkAll, devices: new Map(), n: 0 };
  const tokens = [
    { token: ADMIN, role: "admin", created_at: "2026-10-01T00:00:00Z" },
    { token: NET, role: sab.role || "net-admin", created_at: "2026-10-05T00:00:00Z", expires_at: sab.noExpiry ? undefined : "2026-10-06T12:00:00Z" },
  ];
  const reply = (status, body) => ({ status, text: async () => JSON.stringify(body) });
  const fetchImpl = async (url, init) => {
    assert.equal(init.redirect, "error");
    const p = new URLSearchParams(init.body);
    const ep = [...p.keys()].find((k) => p.get(k) === "1" && !["enabled"].includes(k));
    const tok = p.get("token");
    const dev = s.devices.get(tok);
    if (ep !== "servers") {
      if (dev) {
        if (clock.t > Date.parse(dev.expires_at) || !s.tunnels.find((x) => x.tunnel_token === dev.tunnel)) return reply(401, { status: "error", error: "invalid_token" });
        const own = ep === "wireguard" && p.get("tunnel_token") === dev.tunnel && !sab.deviceInert;
        if (!own && !sab.deviceCanWrite) return reply(sab.device500 ? 500 : 403, { status: "error", error: "device_restricted" });
      } else if (tok !== NET && tok !== ADMIN) return reply(401, { status: "error" });
    }
    const T = (tt) => s.tunnels.find((x) => x.tunnel_token === tt);
    switch (ep) {
      case "servers": return reply(200, { status: "success", servers: [{ hostname: "wireguard.test.doxx.net", server_name: "wireguard.test.doxx.net", type: "wireguard" }] });
      case "user_list_tokens": return reply(200, { status: "success", tokens: tokens.map((x) => ({ ...x, token: sab.fullTokens ? x.token : "..." + x.token.slice(-8), is_current: x.token === tok })) });
      case "firewall_link_all_status": return reply(200, { status: "success", link_all_tunnels: s.linkAll ? 1 : 0 });
      case "list_tunnels": {
        let list = s.tunnels;
        if (sab.lagOnce && s.n === 3 && !s.lagged) { s.lagged = true; list = list.slice(0, 2); }
        return reply(200, { status: "success", tunnels: list.map((x) => ({ ...x })) });
      }
      case "create_tunnel": {
        s.n++;
        s.tunnels.push({ name: p.get("name"), tunnel_token: `tunnelTok_${s.n}_cccccccccccc`, private_key: `privKey_${s.n}_dddddddddddd`, assigned_ip: `10.1.0.${s.n * 2}/31`, server: p.get("server") });
        return reply(200, { status: "success" });
      }
      case "wireguard": {
        const x = T(p.get("tunnel_token"));
        if (!x) return reply(404, { status: "error" });
        return reply(200, { status: "success", config: { interface: { private_key: x.private_key, address: x.assigned_ip.replace("/31", "/31") + ", fd00::1/128" }, peer: { public_key: "srvpub", endpoint: "wireguard.test.doxx.net:51820" } } });
      }
      case "delete_tunnel": s.tunnels = s.tunnels.filter((x) => x.tunnel_token !== p.get("tunnel_token")); return reply(200, { status: "success" });
      case "firewall_rule_list": return reply(200, { status: "success", rules: s.rules.filter((r) => !p.get("tunnel_token") || r.tunnel_token === p.get("tunnel_token")).map((r) => (sab.leakyRuleList ? { ...r, tunnel: r.tunnel_token } : r)) });
      case "firewall_rule_add": {
        const r = { tunnel_token: p.get("tunnel_token"), protocol: p.get("protocol"), src_ip: p.get("src_ip"), src_port: "ALL", dst_ip: p.get("dst_ip"), dst_port: p.get("dst_port") };
        s.rules.push(r);
        if (!(sab.grantIgnored && String(r.dst_port) === "18080")) s.effective.push(r);
        if (sab.wideGrant) s.effective.push({ ...r, src_ip: "0.0.0.0/0", dst_port: "ALL" });
        return reply(200, { status: "success" });
      }
      case "firewall_rule_delete": {
        const same = (r) => r.tunnel_token === p.get("tunnel_token") && r.dst_ip === p.get("dst_ip") && r.src_ip === p.get("src_ip") && String(r.dst_port) === p.get("dst_port");
        s.rules = s.rules.filter((r) => !same(r));
        s.deleted = (s.deleted || 0) + 1;
        if (!sab.deleteIgnored) s.effective = s.effective.filter((r) => !same(r) && r.src_ip !== "0.0.0.0/0");
        return reply(200, { status: "success" });
      }
      case "create_token": {
        if (sab.noDevice) return reply(403, { status: "error", error: "feature_required" });
        const nt = `deviceTokenSynthetic_${s.devices.size}_eeeeeeee`;
        s.devices.set(nt, { tunnel: p.get("tunnel_token"), expires_at: p.get("expires_at") });
        return reply(200, { status: "success", new_token: nt, expires_at: p.get("expires_at") });
      }
      default: return reply(400, { status: "error" });
    }
  };
  const ipOf = {};
  const dataplane = {
    up: [],
    parse: (c) => ({ ip: c.interface.address.split("/")[0], privateKey: c.interface.private_key }),
    async bringUp(label, wg) { ipOf[wg.ip] = label; this.up.push(label); if (sab.throwOnBringUp && label === "C") throw new Error("boom"); },
    async handshakeAge() { return sab.noHandshake ? null : 3; },
    async serve() {},
    async knock(from, ip, port) {
      const to = ipOf[ip];
      if (sab.listenerDead) return "timeout";
      if (from === to) return "verified";
      if (sab.uniformTimeout) return "timeout";
      if (sab.pathDiesAfterRevoke && s.deleted) return "timeout";
      const fromIp = Object.keys(ipOf).find((k) => ipOf[k] === from);
      if (sab.openByDefault && to === "A") return "verified";
      const hit = s.effective.some((r) => r.dst_ip === ip && (r.dst_port === "ALL" || String(r.dst_port) === String(port)) && (r.src_ip === "0.0.0.0/0" || r.src_ip === `${fromIp}/32`));
      return hit ? "verified" : "timeout";
    },
    async teardown() { this.up = []; },
  };
  const adapter = new DoxxAdapter({ token: NET, fetchImpl, now: () => new Date(clock.t) });
  const run = () => runTungsten({ adapter, dataplane, token: NET, now: () => new Date(clock.t), sleep: async (ms) => { clock.t += ms; } });
  return { s, adapter, dataplane, run };
}

test("honest documented product: best verdict is PASS_WITH_LIMITATIONS and it reconciles", async () => {
  const w = world();
  const { receipt, reconciliation, text } = await w.run();
  assert.equal(receipt.verdict, "PASS_WITH_LIMITATIONS", JSON.stringify(receipt.verdict_reasons));
  for (const c of REQUIRED_CHECKS) assert.ok(receipt.observations.some((o) => o.check === c && o.ok), c);
  assert.equal(reconciliation.verdict, "reconciled", JSON.stringify(reconciliation.breaches));
  assert.equal(w.s.tunnels.length, 0, "cleanup deleted every tunnel the run made");
  assert.equal(w.s.rules.length, 0);
  for (const secret of [NET, ADMIN, "tunnelTok_1", "privKey_1", "deviceTokenSynthetic"]) assert.ok(!text.includes(secret), secret);
  assert.ok(receipt.authority.capability.route.seat_ref.startsWith("doxx:tunnel:"));
  assert.ok(receipt.observations.some((o) => o.check === "expiry.device-token" && o.ok));
});

test("any role reading tokens in full is authority escape: FAIL", async () => {
  const { receipt } = await world({ fullTokens: true }).run();
  assert.equal(receipt.verdict, "FAIL");
  assert.ok(receipt.verdict_reasons.includes("check failed: authority.no-token-disclosure"));
});

test("open before the grant: deny-by-default is false, FAIL", async () => {
  const { receipt } = await world({ openByDefault: true }).run();
  assert.equal(receipt.verdict, "FAIL");
  assert.ok(receipt.verdict_reasons.includes("check failed: baseline.deny"));
});

test("a grant wider than the capability is caught on both edges", async () => {
  const { receipt, reconciliation } = await world({ wideGrant: true }).run();
  assert.equal(receipt.verdict, "FAIL");
  assert.ok(receipt.verdict_reasons.includes("check failed: negative.other-port"));
  assert.ok(receipt.verdict_reasons.includes("check failed: negative.other-source"));
  assert.ok(reconciliation.breaches.includes("exercise-within-capability"));
});

test("a delete that reports success but keeps forwarding: FAIL on revoke", async () => {
  const { receipt } = await world({ deleteIgnored: true }).run();
  assert.equal(receipt.verdict, "FAIL");
  assert.ok(receipt.verdict_reasons.includes("check failed: revoke.deny"));
  const rows = receipt.observations.filter((o) => o.check === "revoke.deny");
  assert.equal(rows.length, 2);
  assert.ok(rows.every((o) => !o.ok), "both the immediate and the path-proven revoke checks see the leak");
});

test("a grant the vendor accepts but never enforces, on proven-alive paths: FAIL", async () => {
  const { receipt } = await world({ grantIgnored: true }).run();
  assert.equal(receipt.verdict, "FAIL");
  assert.deepEqual(receipt.verdict_reasons, ["check failed: grant.exercise"]);
});

test("a forger who recomputes the digest is still caught by the verdict", async () => {
  const { receipt } = await world({ openByDefault: true }).run();
  const { receipt_digest, ...body } = structuredClone(receipt);
  body.verdict = "PASS";
  body.verdict_reasons = [];
  const r = reconcileNetReceipt({ ...body, receipt_digest: receiptDigest(body) });
  assert.ok(!r.breaches.includes("receipt-digest"));
  assert.ok(r.breaches.includes("verdict-recomputes"));
});

test("dead listener or uniform timeouts are a broken probe, never a pass or a fail", async () => {
  assert.equal((await world({ listenerDead: true }).run()).receipt.verdict, "INCONCLUSIVE");
  assert.equal((await world({ noHandshake: true }).run()).receipt.verdict, "INCONCLUSIVE");
  const u = (await world({ uniformTimeout: true }).run()).receipt;
  assert.equal(u.verdict, "INCONCLUSIVE");
});

test("a path that dies at revoke time cannot pass for a revocation", async () => {
  const { receipt } = await world({ pathDiesAfterRevoke: true }).run();
  assert.equal(receipt.verdict, "INCONCLUSIVE");
  assert.ok(receipt.verdict_reasons.includes("control failed: control.paths-alive-after-revoke"));
});

test("a 5xx is neither a wall nor an escape: INCONCLUSIVE", async () => {
  const { receipt } = await world({ device500: true }).run();
  assert.equal(receipt.verdict, "INCONCLUSIVE");
  assert.ok(receipt.verdict_reasons.includes("control failed: control.device-refusals-explicit"));
});

test("a tunnel that does not list in time is still deleted (orphan sweep)", async () => {
  const w = world({ lagOnce: true });
  const { receipt } = await w.run();
  assert.equal(receipt.verdict, "INCONCLUSIVE");
  assert.equal(w.s.tunnels.length, 0);
  assert.ok(receipt.observations.some((o) => o.check === "cleanup.tunnels-gone" && o.ok));
});

test("device credential that can write, or does not exist, fails least privilege", async () => {
  assert.equal((await world({ deviceCanWrite: true }).run()).receipt.verdict, "FAIL");
  assert.equal((await world({ noDevice: true }).run()).receipt.verdict, "FAIL");
  assert.equal((await world({ deviceInert: true }).run()).receipt.verdict, "INCONCLUSIVE");
});

test("refuses to mutate with admin, without expiry, or under Link All", async () => {
  for (const sab of [{ role: "admin" }, { noExpiry: true }, { linkAll: true }]) {
    const w = world(sab);
    const { receipt } = await w.run();
    assert.equal(receipt.verdict, "INCONCLUSIVE", JSON.stringify(sab));
    assert.ok(receipt.verdict_reasons.every((r) => r.startsWith("refused: ")), JSON.stringify(receipt.verdict_reasons));
    const mutations = w.adapter.calls.filter((c) => /create|add|delete/.test(c.endpoint));
    assert.equal(mutations.length, 0, JSON.stringify(sab));
  }
});

test("a mid-run crash still cleans up and is not a pass", async () => {
  const w = world({ throwOnBringUp: true });
  const { receipt } = await w.run();
  assert.equal(receipt.verdict, "INCONCLUSIVE");
  assert.equal(w.s.tunnels.length, 0);
  assert.equal(w.dataplane.up.length, 0);
});

test("an edited receipt does not reconcile", async () => {
  const { receipt } = await world({ openByDefault: true }).run();
  const forged = structuredClone(receipt);
  for (const o of forged.observations) o.ok = true;
  forged.verdict = "PASS";
  const r = reconcileNetReceipt(forged);
  assert.equal(r.verdict, "breach");
  assert.ok(r.breaches.includes("receipt-digest"));
  // Even with a recomputed digest the verdict must match the observations,
  // and the forged 'verified' edges sit outside the capability.
  assert.ok(r.breaches.includes("exercise-within-capability"));
});

test("a vendor echoing a credential under an unknown field: the receipt is refused, not emitted", async () => {
  await assert.rejects(world({ leakyRuleList: true }).run(), /secret-leak-refused/);
});

test("missing evidence is INCONCLUSIVE, never PASS", () => {
  const ctl = [{ check: "control.tunnels-up", ok: true }, { check: "control.listener-alive", ok: true }, { check: "grant.exercise", ok: true }];
  assert.equal(computeVerdict(ctl, []).verdict, "INCONCLUSIVE");
  // Every required check green but the alive-path control absent: still not a pass.
  const noPathControl = REQUIRED_CHECKS.map((check) => ({ check, ok: true }));
  assert.equal(computeVerdict(noPathControl, []).verdict, "INCONCLUSIVE");
  assert.equal(computeVerdict([...noPathControl, { check: "control.paths-alive-after-revoke", ok: true }], []).verdict, "PASS");
});

test("adapter: closed endpoint list, device-only token minting, redaction", async () => {
  const a = new DoxxAdapter({ token: NET, fetchImpl: async () => { throw new Error("must not be called"); } });
  await assert.rejects(a.call("delete_account"), /endpoint-refused/);
  await assert.rejects(a.call("firewall_link_all_toggle", { enabled: 1 }), /endpoint-refused/);
  await assert.rejects(a.call("create_token", { role: "net-admin" }), /only-role-device/);
  assert.throws(() => new DoxxAdapter({ token: NET, api: "http://config.doxx.net/v1/" }), /endpoint-refused/);
  assert.deepEqual(redact({ tunnels: [{ tunnel_token: "x", private_key: "y", name: "n" }] }), { tunnels: [{ tunnel_token: "[redacted]", private_key: "[redacted]", name: "n" }] });
});

test("probe: only the holder of the run secret can produce a verified answer", async () => {
  const secret = "s".repeat(32);
  const [srv] = serve([0], secret);
  await new Promise((r) => srv.on("listening", r));
  const { port } = srv.address();
  // Server proves over the port it was told; with port 0 it signs "0", so knock with the
  // real port must not verify, which also shows a proof cannot be replayed across ports.
  assert.equal(await knock("127.0.0.1", port, 2000, secret), "bad-proof");
  srv.close();
  const [srv2] = serve([port], secret);
  await new Promise((r) => srv2.on("listening", r));
  assert.equal(await knock("127.0.0.1", port, 2000, secret), "verified");
  assert.equal(await knock("127.0.0.1", port, 2000, "w".repeat(32)), "bad-proof");
  srv2.close();
});
