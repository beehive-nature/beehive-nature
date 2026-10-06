// NETWORK capability + receipt for the doxx tungsten test. Pure: no clock,
// no network, no filesystem. BNR owns the capability; the adapter's own
// identifiers appear only as adapter-local references (hashes), never as
// identity. Canonical bytes reuse the bPay generic-invoice canonicaliser.
import { createHash } from "node:crypto";
import { canonicalBytes } from "../../scripts/lib/bpay-invoice-generic.mjs";

export const CAPABILITY_SCHEMA = "bnr.net-capability/1";
export const RECEIPT_SCHEMA = "bnr.net-receipt/1";
export const CAPABILITY_DOMAIN = "bnr/net-capability/v1";
export const RECEIPT_DOMAIN = "bnr/net-receipt/v1";
export const VERDICTS = ["PASS", "PASS_WITH_LIMITATIONS", "FAIL", "INCONCLUSIVE"];
export const PROTOCOLS = ["TCP", "UDP"];

// Every check the verdict depends on. A receipt missing any of them is
// INCONCLUSIVE, never PASS: absence of evidence is not a pass.
export const REQUIRED_CHECKS = [
  "control.tunnels-up",        // every netns saw a WireGuard handshake
  "control.listener-alive",    // service answers its own probe on BOTH ports
  "baseline.deny",             // seat -> service:port denied before any grant
  "grant.exercise",            // seat -> service:port verified after the grant
  "negative.other-port",       // seat -> service:other-port denied while granted
  "negative.other-source",     // outsider -> service:port denied while granted
  "negative.device-cannot-write", // the seat's device credential cannot add rules
  "revoke.deny",               // seat -> service:port denied after revoke
  "authority.no-token-disclosure", // the net-admin credential cannot read other tokens in full
];

// Controls prove the probe works. A failed control means the test is broken,
// not that the target is (uniform-failure law), so it can only yield INCONCLUSIVE.
const CONTROL_CHECKS = new Set(["control.tunnels-up", "control.listener-alive", "control.paths-alive-after-revoke"]);

export function receiptDigest(bodyWithoutDigest) {
  return digest(RECEIPT_DOMAIN, bodyWithoutDigest);
}

function digest(domain, value) {
  const h = createHash("sha256");
  h.update(domain, "utf8");
  h.update(Buffer.from([0]));
  h.update(canonicalBytes(value));
  return "sha256:" + h.digest("hex");
}

// Adapter-local reference for a vendor identifier that is also a credential
// (doxx says tunnel_token authenticates the tunnel). One-way, run-salted so
// two runs cannot be joined on it.
export function adapterRef(kind, secretId, runSalt) {
  if (!secretId || !runSalt) throw new Error("adapter-ref-input-missing");
  const h = createHash("sha256").update(`${runSalt}\0${kind}\0${secretId}`).digest("hex");
  return `doxx:${kind}:${h.slice(0, 16)}`;
}

export function buildCapability({ principal, issuer, adapter, seatRef, serviceRef, dstIp, protocol, port, notBefore, notAfter }) {
  if (!principal || !issuer) throw new Error("capability-principal-missing");
  if (adapter !== "doxx") throw new Error("capability-adapter-unknown");
  if (!PROTOCOLS.includes(protocol)) throw new Error("capability-protocol-invalid");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("capability-port-invalid");
  if (!(Date.parse(notAfter) > Date.parse(notBefore))) throw new Error("capability-window-invalid");
  const capability = {
    schema: CAPABILITY_SCHEMA,
    principal,
    issuer,
    adapter,
    route: { seat_ref: seatRef, service_ref: serviceRef, dst_ip: dstIp, protocol, port },
    window: { not_before: notBefore, not_after: notAfter },
    actions: ["provision", "exercise", "revoke"],
  };
  return { capability, capability_hash: digest(CAPABILITY_DOMAIN, capability) };
}

export function capabilityHash(capability) {
  return digest(CAPABILITY_DOMAIN, capability);
}

export function evidenceDigest(redactedResponse) {
  return "sha256:" + createHash("sha256").update(canonicalBytes(redactedResponse ?? null)).digest("hex");
}

// The verdict is a function of the observations alone. The runner never
// writes a verdict by hand.
export function computeVerdict(observations, findings) {
  const byCheck = new Map();
  for (const o of observations) {
    if (!byCheck.has(o.check)) byCheck.set(o.check, []);
    byCheck.get(o.check).push(o);
  }
  const failedRows = (c) => (byCheck.get(c) || []).some((r) => !r.ok);
  const blockers = (findings || []).filter((f) => f.severity === "blocker");
  // A denial that let traffic through, or a disclosed credential, is positive
  // evidence of escape and fails the run whatever else went wrong.
  const escapes = REQUIRED_CHECKS.filter((c) => c !== "grant.exercise" && !CONTROL_CHECKS.has(c) && failedRows(c));
  if (escapes.length || blockers.length) {
    return { verdict: "FAIL", reasons: [...escapes.map((c) => `check failed: ${c}`), ...blockers.map((f) => `blocker: ${f.id}`)] };
  }
  const stopped = (findings || []).filter((f) => f.severity === "harness" || f.severity === "refused");
  if (stopped.length) return { verdict: "INCONCLUSIVE", reasons: stopped.map((f) => `${f.severity}: ${f.id}`) };
  const reasons = [];
  for (const c of CONTROL_CHECKS) if (!byCheck.has(c)) reasons.push(`control missing: ${c}`);
  for (const [c] of byCheck) if (c.startsWith("control.") && failedRows(c)) reasons.push(`control failed: ${c}`);
  if (reasons.length) return { verdict: "INCONCLUSIVE", reasons };
  // Controls passed, so the paths are proven alive: a grant that never let
  // traffic through is the product failing, not the probe.
  if (failedRows("grant.exercise")) return { verdict: "FAIL", reasons: ["check failed: grant.exercise"] };
  const missing = REQUIRED_CHECKS.filter((c) => !byCheck.has(c));
  if (missing.length) return { verdict: "INCONCLUSIVE", reasons: missing.map((c) => `check not run: ${c}`) };
  const informational = [...byCheck.keys()].filter((c) => !REQUIRED_CHECKS.includes(c) && !c.startsWith("control.") && failedRows(c));
  const limits = (findings || []).filter((f) => f.severity === "limitation");
  const lim = [...informational.map((c) => `observation failed: ${c}`), ...limits.map((f) => `limitation: ${f.id}`)];
  if (lim.length) return { verdict: "PASS_WITH_LIMITATIONS", reasons: lim };
  return { verdict: "PASS", reasons: [] };
}

export function buildReceipt({ runId, issuedAt, capability, credential, window, calls, observations, findings, usage, adapterInfo }) {
  const { verdict, reasons } = computeVerdict(observations, findings);
  const body = {
    schema: RECEIPT_SCHEMA,
    run_id: runId,
    issued_at: issuedAt,
    principal: capability.principal,
    adapter: adapterInfo,
    authority: { capability, capability_hash: capabilityHash(capability), credential },
    window,
    lifecycle: {
      quote: { state: "absent", reason: "doxx exposes no per-capability price; the plan is a flat subscription" },
      invoice: { state: "absent", reason: "nothing to invoice without a quote" },
      authorization: { state: "committed", capability_hash: capabilityHash(capability) },
      execution: { state: "observed", calls: calls.length, observations: observations.length },
      receipt: { state: "issued" },
      reconciliation: { state: "pending", by: "reconcileNetReceipt" },
    },
    usage,
    calls,
    observations,
    findings,
    verdict,
    verdict_reasons: reasons,
  };
  return { ...body, receipt_digest: digest(RECEIPT_DOMAIN, body) };
}

// Reconciliation: recompute everything the receipt asserts from what it
// carries. A fabricated verdict, an edited observation, a grant outside the
// capability or a revoke after the window are all breaches.
export function reconcileNetReceipt(receipt, expectedCapabilityHash) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, ...(detail ? { detail } : {}) });
  const { receipt_digest: claimed, ...body } = receipt;
  add("receipt-digest", claimed === digest(RECEIPT_DOMAIN, body));
  const capHash = capabilityHash(receipt.authority.capability);
  add("capability-hash", capHash === receipt.authority.capability_hash);
  add("capability-expected", !expectedCapabilityHash || capHash === expectedCapabilityHash);
  const re = computeVerdict(receipt.observations, receipt.findings);
  add("verdict-recomputes", re.verdict === receipt.verdict, re.verdict);
  const route = receipt.authority.capability.route;
  const verified = receipt.observations.filter((o) => o.observed === "verified" && o.src_ref);
  const outside = verified.filter((o) => !(o.src_ref === route.seat_ref && o.dst_ip === route.dst_ip && o.port === route.port && o.protocol === route.protocol) && !o.check.startsWith("control."));
  add("exercise-within-capability", outside.length === 0, outside.map((o) => o.check).join(",") || undefined);
  const { not_before: nb, not_after: na } = receipt.authority.capability.window;
  const grants = verified.filter((o) => o.check === "grant.exercise");
  add("exercise-within-window", grants.every((o) => Date.parse(o.at) >= Date.parse(nb) && Date.parse(o.at) <= Date.parse(na)));
  const revoked = receipt.window?.revoked_at;
  add("revoked-before-not-after", !!revoked && Date.parse(revoked) <= Date.parse(na));
  const breaches = checks.filter((c) => !c.ok).map((c) => c.name);
  return { schema: "bnr.net-reconciliation/1", run_id: receipt.run_id, verdict: breaches.length ? "breach" : "reconciled", breaches, checks };
}

// The last line of defence: no secret may appear in anything the run emits.
export function assertNoSecrets(text, secrets) {
  for (const s of secrets) {
    if (typeof s === "string" && s.length >= 8 && text.includes(s)) throw new Error("secret-leak-refused");
  }
  return true;
}
