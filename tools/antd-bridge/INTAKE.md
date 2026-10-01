# Local intake for bData

The deployed bData picker sends the file to `http://127.0.0.1:8807/v1/intake`. This is a local copy, not an Autonomi upload. The previous Rust bridge had no intake route, and no service was listening on 8807.

On Windows with Node installed:

```powershell
& tools/antd-bridge/intake.ps1 -Action Start
& tools/antd-bridge/intake.ps1 -Action Status
```

Default state: `%USERPROFILE%\bridge-state-bpay-ui`, preserving its existing `artifacts.json` and jobs. `-StateDir` can explicitly select another shelf. The helper leaves an existing port owner alone and launches its process hidden. The service remains running after the shell exits; run Start again after a Windows restart. It does not install a scheduled task or startup entry.

The edge binds only loopback, checks the Host and Origin, limits files to 263,983,104 bytes, refuses unsafe names and independently streams SHA-256. A mismatch is refused before registration. Successful bytes live under `intake/<sha256>/<name>` and the registry keeps the Rust-compatible `{sha256, bytes, path, note}` tuple. Registry writes are serialized and replaced atomically. Duplicates rehash the existing disk bytes; malformed registries are never overwritten. Interrupted request temporary files are cleaned up.

Other API routes proxy to the existing keyless Rust bridge on **8817**, using the same state directory when that bridge is launched. This service does not start or replace that binary, add contracts, obtain keys, sign, pay, quote a fake price, or claim anything is stored on Autonomi. `/health` separately reports `intake.ready` and the quote bridge's connection state. When that backend is unavailable, intake works and other operations return 503 with an explicit explanation.

CORS allows the estate origin and HTTP localhost development origins, including the browser's private-network preflight. It does not override browser local-network permissions: allow the site's local connection if the browser asks. A browser that refuses the local connection cannot reach the shelf.

Verification: `node --test tools/antd-bridge/intake-server.test.mjs`. The acceptance writes real bytes, checks hash mismatch, unsafe path, origin and size refusal, concurrent registry writes, persistence after restart, corrupt disk duplicate and corrupt registry refusal. No wallet, remote storage or mock intake is involved.
