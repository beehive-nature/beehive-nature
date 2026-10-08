// doxx tungsten test runner. One run: read state, provision three tunnels
// (service A, seat B, outsider C), prove deny-by-default, grant one bounded
// capability, exercise it, probe the edges, revoke, clean up, and emit a
// bnr.net-receipt/1 whose verdict is computed from observations only.
//
// Live:  node tungsten.mjs --token-file <0600 file> [--server <host>] [--seat bFUzZ] [--out <dir>]
// (root on Linux; see live.sh). Tests drive runTungsten() with fakes.
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DoxxAdapter, readTokenFile, redact } from "./doxx-adapter.mjs";
import { adapterRef, assertNoSecrets, buildCapability, buildReceipt, reconcileNetReceipt } from "./net-receipt.mjs";

// The documentation this harness was written against. Findings marked
// source:"docs" come from it, not from a live run.
export const DOCS_PIN = {
  self_description: "https://config.doxx.net/ (GET, JSON, version 1.1.0, fetched 2026-10-05T01:15:07Z)",
  self_description_sha256: "c5f9bcf539c2941f83ca15a141b3c7d35750d7939edaed50981b241fb2fd6465", // PUBLIC-CONSTANT digest of a public page
  reference_repo: "https://github.com/doxxcorp/config.doxx.net @ e57b777547b7b44b440f06dcd96b332d5c0a66d2", // PUBLIC-CONSTANT git commit
};

export const DOC_FINDINGS = [
  { id: "no-rule-ttl", severity: "limitation", source: "docs", text: "Firewall rules carry no expiry. The capability's not_after is enforced by the BNR controller revoking the rule, not by the network; if the controller dies the rule stays." },
  { id: "vendor-held-wireguard-keys", severity: "limitation", source: "docs", text: "create_tunnel generates the keypair server-side and list_tunnels / wireguard return the private key. doxx holds every tunnel key and can impersonate any seat." },
  { id: "hub-terminated-transport", severity: "limitation", source: "docs", text: "WireGuard terminates at doxx servers; seat-to-seat traffic crosses the doxx backbone in the clear at the hop level. BNR must encrypt end to end inside the route." },
  { id: "no-usage-no-audit", severity: "limitation", source: "docs", text: "No usage, metering or audit-log endpoint and no signed responses. bMeter can check the receipt's consistency but not the vendor's provenance; usage cannot be metered per capability." },
  { id: "inbound-only-policy", severity: "limitation", source: "docs", text: "firewall_rule_* governs inbound to a tunnel IP only. Egress per destination (seat may reach github.com:443 only) is not expressible." },
  { id: "capability-unsigned", severity: "limitation", source: "harness", text: "The BNR capability is a hash commitment issued by this harness, not signed by a BNR key. The receipt shows internal consistency and what was observed, not who authorized it." },
  { id: "net-admin-cannot-revoke-tokens", severity: "limitation", source: "docs", text: "revoke_token / delete_token are admin-only. net-admin may mint role=device credentials but cannot revoke them; their expiry is the only bound it controls." },
];

const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runTungsten({ adapter, dataplane, token, seat = "bFUzZ", server, port = 18080, otherPort = 18081, ttlSec = 600, deviceTtlSec = 300, now = () => new Date(), sleep = sleepReal, knockMs = 5000 }) {
  const runId = `tt-${now().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
  const salt = randomBytes(16).toString("hex");
  const secrets = new Set([token]);
  const observations = [];
  const findings = [...DOC_FINDINGS];
  const t = {}; // label -> { tunnelToken, ref, ip, wg }
  const window = { not_before: null, not_after: null, granted_at: null, revoked_at: null, deny_observed_at: null };
  let credential = null;
  let rule = null;
  const controlRules = [];
  let deviceToken = null;
  let capability = null;
  const iso = () => now().toISOString();
  const obs = (check, ok, fields = {}) => observations.push({ check, ok: !!ok, at: iso(), ...fields });
  const knock = async (from, to, p) => dataplane.knock(from, t[to].ip, p, knockMs);
  // doxx identifies a rule by all six fields; a rule added without src_port is stored as ALL.
  const delRule = (r) => adapter.call("firewall_rule_delete", { src_port: "ALL", ...r });
  const edge = (from, to, p) => ({ src_ref: t[from].ref, dst_ip: t[to].ip, port: p, protocol: "TCP" });

  const finish = () => {
    const cap = capability || buildCapability({ principal: `seat:${seat}`, issuer: "unsigned:tungsten-harness", adapter: "doxx", seatRef: "none", serviceRef: "none", dstIp: "0.0.0.0", protocol: "TCP", port, notBefore: iso(), notAfter: new Date(now().getTime() + 1000).toISOString() }).capability;
    const receipt = buildReceipt({
      runId, issuedAt: iso(), capability: cap, credential, window, calls: adapter.calls, observations, findings,
      usage: { exposed: false, reason: "config.doxx.net v1.1.0 documents no usage or metering endpoint", api_calls: adapter.calls.length },
      adapterInfo: { name: "doxx", api: adapter.api, server: server ?? null, docs: DOCS_PIN },
    });
    const text = JSON.stringify(receipt);
    assertNoSecrets(text, secrets);
    return { receipt, reconciliation: reconcileNetReceipt(receipt), text };
  };

  // ---- P0 read before write ------------------------------------------------
  const tokens = await adapter.call("user_list_tokens");
  const entries = tokens.body?.tokens || [];
  const current = entries.find((e) => e.is_current);
  for (const e of entries) if (typeof e.token === "string") secrets.add(e.token);
  if (!current) {
    findings.push({ id: "credential-unreadable", severity: "harness", source: "live", text: "user_list_tokens did not identify the calling token." });
    return finish();
  }
  credential = {
    role: current.role, expires_at: current.expires_at ?? null,
    tunnel_scope_entries: (current.tunnel_scope || []).length, ip_fence_entries: (current.ip_fence || []).length, geo_fence_entries: (current.geo_fence || []).length,
  };
  const ownFull = current.token === token;
  const others = entries.filter((e) => !e.is_current);
  // Masked forms seen in the docs look like "...gtGwEnvY". Anything without a
  // mask mark and of credential length is treated as disclosed.
  const othersFull = others.filter((e) => typeof e.token === "string" && !/\.\.\.|…|\*/.test(e.token) && e.token.length >= 24).length;
  obs("authority.no-token-disclosure", othersFull === 0, {
    observed: { own_token_returned_in_full: ownFull, other_tokens: others.length, other_tokens_full_length: othersFull, other_roles: others.map((e) => e.role) },
  });
  if (current.role !== "net-admin") {
    findings.push({ id: "credential-not-net-admin", severity: "refused", source: "live", text: `Refused to mutate: the run credential is role=${current.role}; the test requires net-admin, never admin.` });
    return finish();
  }
  if (!current.expires_at) {
    findings.push({ id: "credential-no-expiry", severity: "refused", source: "live", text: "Refused to mutate: the run credential has no expires_at." });
    return finish();
  }
  const linkAll = await adapter.call("firewall_link_all_status");
  if (linkAll.body?.link_all_tunnels || linkAll.body?.link_all_enabled) {
    findings.push({ id: "link-all-enabled", severity: "refused", source: "live", text: "Link All is on: tunnel-to-tunnel rules are dormant, so no bounded rule can be tested. Not changed by this run." });
    return finish();
  }
  const before = await adapter.call("list_tunnels");
  const existing = before.body?.tunnels || [];
  for (const x of existing) { if (x.private_key) secrets.add(x.private_key); if (x.tunnel_token) secrets.add(x.tunnel_token); }
  const keysVisible = existing.filter((x) => x.private_key).length;
  if (keysVisible) findings.push({ id: "net-admin-reads-all-device-keys", severity: "limitation", source: "live", text: `list_tunnels returned the WireGuard private key of ${keysVisible} pre-existing tunnel(s) to a net-admin credential.` });
  await adapter.call("firewall_rule_list");

  try {
    // ---- P1 provision ------------------------------------------------------
    if (!server) {
      const s = await adapter.call("servers");
      const list = s.body?.servers || [];
      server = (list.find((x) => String(x.type).toLowerCase() === "wireguard" && (x.hostname || x.server_name)) || {}); server = server.hostname || server.server_name || null;
      if (!server) throw new Error("no-wireguard-server");
    }
    for (const label of ["A", "B", "C"]) {
      const name = `bnr-${runId}-${label}`;
      const made = await adapter.call("create_tunnel", { server, name, type: "wireguard" });
      if (made.body?.tunnel_token) secrets.add(made.body.tunnel_token);
      if (made.body?.private_key) secrets.add(made.body.private_key);
      const listed = await adapter.call("list_tunnels");
      const mine = (listed.body?.tunnels || []).find((x) => x.name === name) || (made.body?.tunnel_token ? { tunnel_token: made.body.tunnel_token } : null);
      if (!mine?.tunnel_token) throw new Error(`tunnel-not-listed:${label}`);
      secrets.add(mine.tunnel_token);
      if (mine.private_key) secrets.add(mine.private_key);
      t[label] = { tunnelToken: mine.tunnel_token, ref: adapterRef("tunnel", mine.tunnel_token, salt) };
      const cfg = await adapter.call("wireguard", { tunnel_token: mine.tunnel_token });
      const wg = dataplane.parse(cfg.body?.config);
      secrets.add(wg.privateKey);
      t[label].ip = wg.ip;
      await dataplane.bringUp(label, wg);
    }
    await dataplane.serve("A", [port, otherPort]);
    let ages = [];
    for (let i = 0; i < 15; i++) {
      await knock("B", "A", port).catch(() => {});
      ages = await Promise.all(["A", "B", "C"].map((l) => dataplane.handshakeAge(l)));
      if (ages.every((a) => a !== null)) break;
      await sleep(2000);
    }
    obs("control.tunnels-up", ages.every((a) => a !== null), { observed: { handshake_age_s: ages } });
    const selfA = await knock("A", "A", port);
    const selfOther = await knock("A", "A", otherPort);
    obs("control.listener-alive", selfA === "verified" && selfOther === "verified", { observed: { [port]: selfA, [otherPort]: selfOther } });

    // ---- P2 deny by default ------------------------------------------------
    const base = await knock("B", "A", port);
    obs("baseline.deny", base !== "verified", { observed: base, ...edge("B", "A", port) });

    // ---- P3 authorize one capability --------------------------------------
    const nb = iso();
    const na = new Date(now().getTime() + ttlSec * 1000).toISOString();
    ({ capability } = buildCapability({ principal: `seat:${seat}`, issuer: "unsigned:tungsten-harness", adapter: "doxx", seatRef: t.B.ref, serviceRef: t.A.ref, dstIp: t.A.ip, protocol: "TCP", port, notBefore: nb, notAfter: na }));
    window.not_before = nb;
    window.not_after = na;
    rule = { tunnel_token: t.A.tunnelToken, protocol: "TCP", src_ip: `${t.B.ip}/32`, dst_ip: t.A.ip, dst_port: port };
    const add = await adapter.call("firewall_rule_add", rule);
    if (!add.ok) throw new Error("rule-add-failed");
    window.granted_at = iso();
    const listed = await adapter.call("firewall_rule_list", { tunnel_token: t.A.tunnelToken });
    const stored = (listed.body?.rules || []).find((r) => r.dst_ip === t.A.ip && String(r.dst_port) === String(port) && (r.src_ip === `${t.B.ip}/32` || r.src_ip === t.B.ip));
    if (stored) rule = { tunnel_token: t.A.tunnelToken, protocol: stored.protocol, src_ip: stored.src_ip, src_port: stored.src_port, dst_ip: stored.dst_ip, dst_port: stored.dst_port };
    obs("grant.listed", !!stored, { observed: stored ? redact(stored) : { listed: (listed.body?.rules || []).slice(0, 10).map(redact), http: listed.status } });

    // ---- P4 exercise -------------------------------------------------------
    let got = "timeout";
    for (let i = 0; i < 10 && got !== "verified"; i++) { got = await knock("B", "A", port); if (got !== "verified") await sleep(3000); }
    obs("grant.exercise", got === "verified", { observed: got, ...edge("B", "A", port) });

    // ---- P5 edges ----------------------------------------------------------
    const op = await knock("B", "A", otherPort);
    obs("negative.other-port", op !== "verified", { observed: op, ...edge("B", "A", otherPort) });
    const os = await knock("C", "A", port);
    obs("negative.other-source", os !== "verified", { observed: os, ...edge("C", "A", port) });

    const mint = await adapter.call("create_token", { role: "device", tunnel_token: t.B.tunnelToken, label: `bnr ${runId}`, expires_at: new Date(now().getTime() + deviceTtlSec * 1000).toISOString() });
    deviceToken = mint.ok ? mint.body?.new_token : null;
    if (deviceToken) secrets.add(deviceToken);
    if (!deviceToken) {
      obs("negative.device-cannot-write", false, { observed: "device-credential-unavailable", detail: `create_token role=device http ${mint.status}` });
    } else {
      const own = await adapter.call("wireguard", { tunnel_token: t.B.tunnelToken }, { token: deviceToken });
      const w1 = await adapter.call("firewall_rule_add", { tunnel_token: t.B.tunnelToken, protocol: "TCP", src_ip: `${t.C.ip}/32`, dst_ip: t.B.ip, dst_port: port }, { token: deviceToken });
      const w2 = await adapter.call("list_tunnels", {}, { token: deviceToken });
      const w3 = await adapter.call("wireguard", { tunnel_token: t.A.tunnelToken }, { token: deviceToken });
      // Escape = the vendor did the thing. Listing only its own tunnel is not an
      // escape; seeing any other tunnel is. A transport error or 5xx is neither
      // an escape nor a wall, so it fails the control and the run is INCONCLUSIVE.
      const otherSeen = w2.ok && (w2.body?.tunnels || []).some((x) => x.tunnel_token !== t.B.tunnelToken);
      for (const x of w2.body?.tunnels || []) { if (x.private_key) secrets.add(x.private_key); if (x.tunnel_token) secrets.add(x.tunnel_token); }
      const explicit = (r) => r.ok || (r.status >= 200 && r.status < 500 && r.status !== 0);
      obs("control.device-credential-works", own.ok, { observed: own.status });
      obs("control.device-refusals-explicit", [w1, w2, w3].every(explicit), { observed: [w1.status, w2.status, w3.status] });
      obs("negative.device-cannot-write", !w1.ok && !otherSeen && !w3.ok, { observed: { rule_add: w1.status, list_tunnels: w2.status, list_shows_other_tunnels: otherSeen, other_tunnel_config: w3.status } });
      if (w1.ok) await delRule({ tunnel_token: t.B.tunnelToken, protocol: "TCP", src_ip: `${t.C.ip}/32`, dst_ip: t.B.ip, dst_port: port });
    }

    // ---- P6 revoke ---------------------------------------------------------
    const del = await delRule(rule);
    if (del.ok) { window.revoked_at = iso(); rule = null; }
    let after = "verified";
    for (let i = 0; i < 12 && after === "verified"; i++) { after = await knock("B", "A", port); if (after === "verified") await sleep(5000); }
    if (after !== "verified") window.deny_observed_at = iso();
    if (del.ok) obs("revoke.deny", after !== "verified", { observed: after, ...edge("B", "A", port) });
    else findings.push({ id: "revoke-call-rejected", severity: "harness", source: "live", text: `firewall_rule_delete answered HTTP ${del.status}; nothing was revoked, so revocation is untested.` });
    const ctl = await knock("A", "A", port);
    obs("control.listener-alive", ctl === "verified", { observed: { after_revoke: ctl } });

    // A denial only means something while the path is shown alive at the same
    // time. Open the OTHER port to B and to C, prove both paths carry traffic,
    // and re-check that the capability port stays shut for both.
    for (const from of ["B", "C"]) {
      const r = { tunnel_token: t.A.tunnelToken, protocol: "TCP", src_ip: `${t[from].ip}/32`, dst_ip: t.A.ip, dst_port: otherPort };
      if ((await adapter.call("firewall_rule_add", r)).ok) controlRules.push(r);
    }
    const alive = {};
    for (const from of ["B", "C"]) {
      let r = "timeout";
      for (let i = 0; i < 10 && r !== "verified"; i++) { r = await knock(from, "A", otherPort); if (r !== "verified") await sleep(3000); }
      alive[from] = r;
    }
    obs("control.paths-alive-after-revoke", alive.B === "verified" && alive.C === "verified", { observed: alive });
    const bShut = await knock("B", "A", port);
    if (del.ok) obs("revoke.deny", bShut !== "verified", { observed: bShut, ...edge("B", "A", port), detail: "path proven alive" });
    const cShut = await knock("C", "A", port);
    obs("negative.other-source", cShut !== "verified", { observed: cShut, ...edge("C", "A", port), detail: "path proven alive" });
    while (controlRules.length) {
      if (!(await delRule(controlRules[0])).ok) break; // finally retries
      controlRules.shift();
    }

    // ---- P7 credential expiry (vendor-enforced) ----------------------------
    if (deviceToken) {
      const wait = Date.parse(mint.body?.expires_at || "") || (now().getTime() + deviceTtlSec * 1000);
      const serverExpiry = mint.body?.expires_at ?? null;
      const ms = Math.max(0, wait - now().getTime()) + 30000;
      if (ms <= 20 * 60 * 1000) {
        await sleep(ms);
        const late = await adapter.call("wireguard", { tunnel_token: t.B.tunnelToken }, { token: deviceToken });
        let later = null;
        if (late.ok) { await sleep(120000); later = await adapter.call("wireguard", { tunnel_token: t.B.tunnelToken }, { token: deviceToken }); }
        const refused = (r) => r && !r.ok && r.status > 0 && r.status < 500;
        obs("expiry.device-token", refused(late) || refused(later), { observed: { server_expires_at: serverExpiry, at_plus_30s: late.status, at_plus_150s: later ? later.status : null } });
        if (late.ok && later?.ok) findings.push({ id: "expired-credential-accepted", severity: "blocker", source: "live", text: "A role=device credential still worked 150 s after its expires_at." });
        else if (late.ok) findings.push({ id: "expiry-lag", severity: "limitation", source: "live", text: "A role=device credential worked 30 s past its expires_at and was refused by 150 s: expiry is enforced with a lag." });
      }
    }
  } catch (e) {
    findings.push({ id: "run-aborted", severity: "harness", source: "live", text: `run aborted: ${String(e.message || e).replace(/[^\w:.\- ]/g, "").slice(0, 120)}` });
  } finally {
    // ---- P8 cleanup: everything this run created, nothing else -------------
    for (const r of [rule, ...controlRules]) if (r) await delRule(r).catch(() => {});
    for (const label of Object.keys(t)) await adapter.call("delete_tunnel", { tunnel_token: t[label].tunnelToken }).catch(() => {});
    await dataplane.teardown().catch(() => {});
    if (adapter.calls.some((c) => c.endpoint === "create_tunnel")) {
      // Orphans: created but never tracked (a create that did not list in time).
      const ofRun = (r) => (r.body?.tunnels || []).filter((x) => String(x.name || "").startsWith(`bnr-${runId}-`) && x.tunnel_token);
      const first = await adapter.call("list_tunnels").catch(() => ({ body: {} }));
      for (const x of ofRun(first)) { secrets.add(x.tunnel_token); if (x.private_key) secrets.add(x.private_key); await adapter.call("delete_tunnel", { tunnel_token: x.tunnel_token }).catch(() => {}); }
      const left = await adapter.call("list_tunnels").catch(() => ({ body: {} }));
      const ours = ofRun(left).length;
      obs("cleanup.tunnels-gone", ours === 0, { observed: { remaining: ours } });
      if (ours) findings.push({ id: "cleanup-incomplete", severity: "limitation", source: "live", text: `${ours} tunnel(s) named bnr-${runId}-* remain at doxx; delete them in the portal.` });
    }
    if (deviceToken && t.B) {
      const dead = await adapter.call("wireguard", { tunnel_token: t.B.tunnelToken }, { token: deviceToken }).catch(() => ({ ok: false }));
      obs("cleanup.device-token-dead", !dead.ok, { observed: dead.status ?? null });
    }
  }
  return finish();
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
  if (!args["token-file"]) { console.error("REFUSE: --token-file required"); process.exit(2); }  const { NetnsDataplane } = await import("./dataplane-netns.mjs");
  let token;
  try { token = readTokenFile(args["token-file"]); } catch {
    console.log("That does not look like a doxx token (wrong characters or too short).");
    process.exit(3);
  }
  const adapter = new DoxxAdapter({ token });
  if ("check" in args) {
    // Pre-flight, read only: is this the token the run needs? Says so in plain words.
    const r = await adapter.call("user_list_tokens");
    const cur = (r.body?.tokens || []).find((e) => e.is_current);
    if (!r.ok || !cur) { console.log(`doxx did not accept that code (HTTP ${r.status}). It was ${token.length} characters long.`); process.exit(3); }
    if (cur.role !== "net-admin") { console.log(`doxx accepted it, but it is the ${cur.role} token. Use the NEW Network Admin token instead.`); process.exit(3); }
    if (!cur.expires_at) { console.log("That Network Admin token has no expiry. Make one that expires tomorrow."); process.exit(3); }
    console.log(`Good: Network Admin token, expires ${cur.expires_at}.`);
    process.exit(0);
  }
  const dp = new NetnsDataplane({ secret: randomBytes(32).toString("hex") });
  // Ctrl-C or a closed window must still reach the cleanup: interrupt the
  // current wait, let runTungsten's finally delete what it made, then exit.
  const ac = new AbortController();
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { console.error(`tungsten: ${sig}, cleaning up`); ac.abort(); });
  const sleep = (ms) => new Promise((resolve, reject) => {
    if (ac.signal.aborted) return reject(new Error("interrupted"));
    const timer = setTimeout(resolve, ms);
    ac.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("interrupted")); }, { once: true });
  });
  const { receipt, reconciliation, text } = await runTungsten({ adapter, dataplane: dp, token, sleep, seat: args.seat || "bFUzZ", server: args.server, ttlSec: Number(args.ttl || 600), deviceTtlSec: Number(args["device-ttl"] || 300) });
  if (receipt.observations.some((o) => o.check === "expiry.device-token" && !o.ok) || receipt.findings.some((f) => f.id === "cleanup-incomplete")) {
    console.error(`tungsten: ACTION in the doxx portal: revoke the token labelled "bnr ${receipt.run_id}" and delete any tunnel named bnr-${receipt.run_id}-*`);
  }
  const out = args.out || ".";
  mkdirSync(out, { recursive: true });
  const file = join(out, `net-receipt-${receipt.run_id}.json`);
  writeFileSync(file, text + "\n");
  writeFileSync(join(out, `net-reconciliation-${receipt.run_id}.json`), JSON.stringify(reconciliation) + "\n");
  console.log(JSON.stringify({ receipt: file, verdict: receipt.verdict, reasons: receipt.verdict_reasons, reconciliation: reconciliation.verdict }, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(`tungsten: ${String(e.message || e).slice(0, 200)}`); process.exit(1); });
