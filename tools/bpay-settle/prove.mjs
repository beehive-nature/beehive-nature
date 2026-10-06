// prove.mjs — a gate that has never gone red has not been proven
// (SPEC-ADAPTER-CONTRACT-1 §9). Each mutation disables one guard; the suite
// must fail with it in place. The file is restored after every mutation, also
// on error. Run: `npm run prove` (CI step "bPay SETTLE adapters").
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const K = join(here, "../../scripts/lib/bpay-settle.mjs");
const A = join(here, "adapters/smart-account-usdc.mjs");
const E = join(here, "evm.mjs");
const T = join(here, "tungsten.mjs");

const MUTATIONS = [
  [K, `need(a.owner_privilege === false,`, `need(true,`, "authority may carry owner privilege"],
  [K, `!d.authority_models.includes("owner"),`, `true,`, "descriptor may offer owner authority"],
  [K, `need(authority.adapter_manifest_hash === mHash,`, `need(true,`, "authority not bound to the adapter manifest"],
  [K, `need(descriptor.privacy_satisfies.includes(p),`, `need(true,`, "privacy requirement not enforced"],
  [K, `need(BigInt(pl.spend.asset_atto) === BigInt(intent.invoice.owed_atto),`, `need(true,`, "payload amount not checked"],
  [K, `if (k === "adapter_local") continue;`, `continue;`, "vendor-leak scan skips everything"],
  [K, `need(!vendorOracles.includes(observation.oracle),`, `need(true,`, "vendor endpoint accepted as value witness"],
  [A, `if (lc(t.to) !== lc(recipient)) refuse(`, `if (false) refuse(`, "transfer recipient not guarded"],
  [A, `if (REFUSED_SELECTORS[sel] && `, `if (false && `, "owner/upgrade/approve selectors not refused"],
  [A, `refuse("REFUSED_7702",`, `void (`, "7702 delegation not refused"],
  [A, `for (const k of Object.keys(want)) if (want[k] !== have[k])`, `for (const k of []) if (want[k] !== have[k])`, "granted permission not compared to the request"],
  [E, `const cls = obs.quorum >= 2 && !obs.disagree ? "event-log+readback" : "tx-receipt";`, `const cls = "event-log+readback";`, "single operator rounded up to the top class"],
  [E, `const finality = obs.finalized && obs.quorum >= 2 && !obs.disagree ? "terminal" : "as-reported";`, `const finality = "terminal";`, "finality assumed"],
  [T, `ob("control.oracle-quorum", cc.alive.length >= 2,`, `ob("control.oracle-quorum", true,`, "one operator passes the quorum control"],
  [T, `ob("kill.4-receipt-recreatable", a === b && again.records.length > 0,`, `ob("kill.4-receipt-recreatable", true,`, "recreation not compared"],
  [T, `probe.answered > 0 && probe.succeeded === 0 && probe.reverted > 0`, `true`, "over-cap simulation ignored"],
];

let killed = 0;
const survivors = [];
for (const [file, from, to, what] of MUTATIONS) {
  const orig = readFileSync(file, "utf8");
  if (orig.split(from).length !== 2) { console.error(`prove: anchor not found once in ${file}: ${from}`); process.exit(2); }
  try {
    writeFileSync(file, orig.split(from).join(to));
    const r = spawnSync(process.execPath, ["--test", "bpay-settle.test.mjs"], { cwd: here, encoding: "utf8" });
    if (r.status !== 0) { killed++; console.log(`killed   ${what}`); } else { survivors.push(what); console.log(`SURVIVED ${what}`); }
  } finally { writeFileSync(file, orig); }
}
console.log(`prove: ${killed}/${MUTATIONS.length} mutations killed`);
process.exit(survivors.length ? 1 : 0);
