// prove.mjs — a gate that has never gone red has not been proven
// (SPEC-ADAPTER-CONTRACT-1 §9). Each mutation disables one guard; the suite
// must fail with it in place. The file is restored after every mutation, also
// on error. Run: `node prove.mjs` (CI step "bPay SETTLE adapters").
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
  // kernel
  [K, `need(a.owner_privilege === false,`, `need(true,`, "authority may carry owner privilege"],
  [K, `!d.authority_models.includes("owner"),`, `true,`, "descriptor may offer owner authority"],
  [K, `need(authority.adapter_manifest_hash === mHash,`, `need(true,`, "authority not bound to the adapter manifest"],
  [K, `need(descriptor.privacy_satisfies.includes(p),`, `need(true,`, "privacy requirement not enforced"],
  [K, `need(BigInt(pl.spend.asset_atto) === BigInt(intent.invoice.owed_atto),`, `need(true,`, "payload amount not checked"],
  [K, `if (k === "adapter_local" && path === "$") continue;`, `if (k === "adapter_local") continue;`, "vendor-leak scan skips nested adapter_local"],
  [K, `need(!vendor.some(`, `need(true || !vendor.some(`, "vendor endpoint accepted as value witness"],
  [K, `checkIntent(intent, { invoice, descriptor, now });`, ``, "intent not re-checked at settle time"],
  [K, `if (await outbox.get(key)) throw replay();`, ``, "single-use replay not refused before preparing"],
  [K, `need(intent.authority_hash === authorityHash,`, `need(true,`, "signed authority hash not compared"],
  [K, `need(r.asset === intent.invoice.asset,`, `need(true,`, "a record of another asset accepted"],
  [K, `export const outboxKey = (intent) => "authority:" + intent.authority_hash;`, `export const outboxKey = (intent) => "authority:" + intent.intent_digest;`, "single-use keyed on the intent, not the authority"],
  [K, `payloads: pl.items })) !== true) throw replay();`, `payloads: pl.items })) !== true) void 0;`, "put-if-absent claim ignored"],
  // adapter
  [A, `if (lc(t.to) !== lc(recipient)) refuse(`, `if (false) refuse(`, "transfer recipient not guarded"],
  [A, `if (REFUSED_SELECTORS[sel])`, `if (false)`, "owner/upgrade/approve selectors not named"],
  [A, `refuse("REFUSED_7702",`, `void (`, "7702 delegation not refused"],
  [A, `for (const k of Object.keys(want)) if (want[k] !== have[k])`, `for (const k of []) if (want[k] !== have[k])`, "granted permission not compared to the request"],
  [A, `if (have.period < have.end - have.start)`, `if (false)`, "a refilling period accepted"],
  [A, `if (s !== "approve,spend,transfer" && s !== "spend,transfer")`, `if (false)`, "call shape not enforced"],
  [A, `if (!samePermission(d.permission, permission.permission))`, `if (false)`, "calls may name another permission"],
  [A, `if (!known && bound !== true`, `if (false`, "unattributed payment counted"],
  [A, `const feeIncomplete = otherObs.some((o) => !agreed(o));`, `const feeIncomplete = otherObs.some((o) => !o.found);`, "a related transaction counted on one witness"],
  // reader
  [E, `const cls = obs.quorum >= 2 && !obs.disagree ? "event-log+readback" : "tx-receipt";`, `const cls = "event-log+readback";`, "single operator rounded up to the top class"],
  [E, `const finalized = finAnswers.length === agreeing.size`, `const finalized = true || finAnswers.length === agreeing.size`, "finality assumed"],
  [E, `lc(rc.from || ""), String(rc.gasUsed)`, `""`, "quorum key ignores sender and gas"],
  [E, `String(rc.blockNumber), lc(rc.blockHash)`, `lc(rc.blockHash)`, "quorum key ignores the block number"],
  [E, `? obs.userOps.some((u) => lc(u.sender) === lc(from) && u.success)`, `? true`, "a reverted op's bundle counted as its payment"],
  [E, `if (senders.size > 1)`, `if (false)`, "two senders in one transaction both counted"],
  // harness
  [T, `ob("control.oracle-quorum", cc.alive.length >= 2,`, `ob("control.oracle-quorum", true,`, "one operator passes the quorum control"],
  [T, `ob("kill.4-receipt-recreatable", a === b && again.records.length > 0,`, `ob("kill.4-receipt-recreatable", true,`, "recreation not compared"],
  [T, `probe.succeeded === 0 && probe.cap_reverts === probe.hosts && probe.other_reverts === 0`, `true`, "over-cap simulation ignored"],
  [T, `r.selector === ERR.ExceededSpendPermission`, `true`, "any revert counted as the cap"],
  [T, `else if (/^REFUSED_/.test(code) || code === "SETTLE_OVER_AUTHORITY")`, `else if (/^REFUSED_/.test(code) || /^SETTLE_/.test(code))`, "a caller mistake charged to the vendor"],
  [T, `ob("control.reader-is-ours", adapter.reader === reader,`, `ob("control.reader-is-ours", true,`, "an uncontrolled reader accepted"],
  [T, `if (observations.some((o) => o.check.startsWith("control.") && !o.ok)) stop(`, `if (false) stop(`, "money moves after a failed control"],
  [T, `else ob("kill.1-no-owner-authority", ownerBefore === after,`, `else ob("kill.1-no-owner-authority", true,`, "owner change on pay not compared"],
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
