// doxx NETWORK adapter for the tungsten test. Narrow on purpose: a closed
// list of endpoints, the token read from a file and sent only as the form
// field doxx requires, and a redaction wall in front of every response that
// leaves this module as evidence. Not a production integration.
import { readFileSync, statSync } from "node:fs";
import { evidenceDigest } from "./net-receipt.mjs";

export const DOXX_API = "https://config.doxx.net/v1/";

// Closed enum. Anything else, including every account, token-admin, DNS,
// domain, proxy and Link All mutation, is refused before it leaves the box.
export const ALLOWED_ENDPOINTS = new Set([
  "servers",
  "list_tunnels",
  "firewall_rule_list",
  "firewall_link_all_status",
  "user_list_tokens",
  "create_tunnel",
  "wireguard",
  "delete_tunnel",
  "firewall_rule_add",
  "firewall_rule_delete",
  "create_token", // role=device only, enforced below
]);

// Fields that are credentials or key material. doxx's own list_tunnels doc:
// "Treat tunnel_token values as credentials".
export const SECRET_KEYS = new Set(["token", "new_token", "target_token", "private_key", "tunnel_token", "preshared_key", "auth_key"]);

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.has(k) ? (v ? "[redacted]" : v) : redact(v);
    }
    return out;
  }
  return value;
}

export function readTokenFile(path) {
  const st = statSync(path);
  if (process.platform !== "win32" && (st.mode & 0o077) !== 0) throw new Error("token-file-permissions-too-open");
  const token = readFileSync(path, "utf8").trim();
  if (!/^[A-Za-z0-9_\-.+/=]{16,}$/.test(token)) throw new Error("token-file-malformed");
  return token;
}

export class DoxxAdapter {
  constructor({ token, fetchImpl = globalThis.fetch, api = DOXX_API, timeoutMs = 20000, maxCalls = 200, now = () => new Date() }) {
    if (!/^https:\/\//.test(api) && !/^http:\/\/127\.0\.0\.1[:/]/.test(api)) throw new Error("adapter-endpoint-refused");
    this.token = token;
    this.fetch = fetchImpl;
    this.api = api;
    this.timeoutMs = timeoutMs;
    this.maxCalls = maxCalls;
    this.now = now;
    this.calls = [];
  }

  describe() {
    return { rail: "network", adapter: "doxx", contract_version: "net-0", api: this.api, endpoints: [...ALLOWED_ENDPOINTS] };
  }

  // One call. Returns { status, ok, body } where body is the raw parsed
  // response for the runner's in-memory use; the call log keeps only the
  // endpoint name, HTTP status and a digest of the REDACTED body.
  async call(endpoint, params = {}, { token } = {}) {
    if (!ALLOWED_ENDPOINTS.has(endpoint)) throw new Error(`endpoint-refused:${endpoint}`);
    if (endpoint === "create_token" && params.role !== "device") throw new Error("create-token-refused:only-role-device");
    if (this.calls.length >= this.maxCalls) throw new Error("call-budget-exhausted");
    const form = new URLSearchParams();
    form.set(endpoint, "1");
    const auth = token ?? this.token;
    if (endpoint !== "servers") form.set("token", auth);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) form.set(k, String(v));
    let status = 0;
    let body = null;
    const at = this.now().toISOString();
    try {
      const res = await this.fetch(this.api, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      status = res.status;
      const text = await res.text();
      try { body = JSON.parse(text); } catch { body = { unparsed_bytes: text.length }; }
    } catch {
      // Never echo the request (it carries the token) or the raw error.
      body = { transport_error: true };
    }
    const ok = status >= 200 && status < 300 && body?.status === "success";
    this.calls.push({ seq: this.calls.length + 1, endpoint, as: token ? "device" : "net-admin", http_status: status, ok, at, response_digest: evidenceDigest(redact(body)) });
    return { status, ok, body };
  }
}
