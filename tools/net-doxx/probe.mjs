// Application-level reachability probe. A bare TCP connect is not evidence on
// this box: a local middlebox completes the handshake for every destination.
// So the service proves itself: it answers a fresh nonce with
// HMAC-SHA256(run secret, port || nonce). Only a verified proof counts as reach.
//
//   node probe.mjs serve <port,port,...>          (secret in BNR_TT_SECRET)
//   node probe.mjs knock <ip> <port> <timeoutMs>  (secret in BNR_TT_SECRET)
import net from "node:net";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function proof(secret, port, nonce) {
  return createHmac("sha256", secret).update(`${port}\0${nonce}`).digest("hex");
}

export function serve(ports, secret) {
  return ports.map((port) => net.createServer((sock) => {
    sock.setTimeout(5000, () => sock.destroy());
    let buf = "";
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl < 0) { if (buf.length > 256) sock.destroy(); return; }
      const nonce = buf.slice(0, nl).trim();
      if (!/^[0-9a-f]{32}$/.test(nonce)) return sock.destroy();
      sock.end(proof(secret, port, nonce) + "\n");
    });
    sock.on("error", () => {});
  }).listen(port, "0.0.0.0"));
}

// Resolves to one of: verified | bad-proof | refused | timeout | error.
export function knock(ip, port, timeoutMs, secret) {
  return new Promise((resolve) => {
    const nonce = randomBytes(16).toString("hex");
    const want = Buffer.from(proof(secret, port, nonce), "utf8");
    let done = false;
    let buf = "";
    const finish = (r) => { if (!done) { done = true; clearTimeout(t); sock.destroy(); resolve(r); } };
    const t = setTimeout(() => finish("timeout"), timeoutMs);
    const sock = net.connect({ host: ip, port }, () => sock.write(nonce + "\n"));
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl < 0) return;
      const got = Buffer.from(buf.slice(0, nl).trim(), "utf8");
      finish(got.length === want.length && timingSafeEqual(got, want) ? "verified" : "bad-proof");
    });
    sock.on("error", (e) => finish(e.code === "ECONNREFUSED" ? "refused" : "error"));
    sock.on("end", () => finish("bad-proof"));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const secret = process.env.BNR_TT_SECRET;
  if (!secret || secret.length < 32) { console.error("probe: BNR_TT_SECRET missing"); process.exit(2); }
  const [mode, a, b, c] = process.argv.slice(2);
  if (mode === "serve") {
    serve(a.split(",").map(Number), secret);
    console.log(JSON.stringify({ serving: a }));
  } else if (mode === "knock") {
    knock(a, Number(b), Number(c), secret).then((r) => console.log(JSON.stringify({ result: r })));
  } else {
    console.error("probe: usage serve|knock"); process.exit(2);
  }
}
