// inv1-oracle-verify.mjs — the INVOICE-1 oracle's INDEPENDENT verifier (economic/POS/wallet seat, 2026-09-17).
// Written from the CHARTERS + the founder's attack list, not from the
// builder's test file. Independent canonicalization implementation below;
// the module under test is imported only for its public API.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const MOD = process.argv[2]; // path to scripts/lib/bpay-invoice-generic.mjs
const {
  buildGenericInvoice, validateGenericInvoice, voidGenericInvoice,
  settleGenericInvoice, canonicalBytes, contentDigest,
} = await import(pathToFileURL(MOD).href);

const sha = (b) => "sha256:" + createHash("sha256").update(b).digest("hex");

// ── independent canonicalization (from the spec: lexicographic keys,
//    recursive; arrays order-preserving; no whitespace) ─────────────────────
const canon = (v) => {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v !== null && typeof v === "object")
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
};
const oracleDigest = (doc) => {
  const bare = JSON.parse(JSON.stringify(doc));
  if (bare.identity) delete bare.identity.contentDigest;
  return sha(Buffer.from(canon(bare), "utf8"));
};
const stripSelf = (doc) => { const c = JSON.parse(JSON.stringify(doc)); if (c.identity) delete c.identity.contentDigest; return c; };

const R = [];
const attack = (id, ok, why) => { R.push({ id, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${why}`); };
const attempt = (fn) => { try { return { ok: !!fn() }; } catch (e) { return { ok: false, err: String(e.message).slice(0, 100) }; } };

// fixture input (oracle's own construction)
const quotes = (n, atto) => Array.from({ length: n }, (_, i) => ({ quote_hash: "qh-" + (i + 1), amount_atto: atto }));
const base = () => ({
  jobId: "up-oracle-1",
  issuedAt: "2026-09-17T00:00:00.000Z",
  lines: [
    { kind: "storage", asset: "ANT", quotes: quotes(6, "1000000000000001") },
    { kind: "gas ceiling", asset: "ETH", quotes: quotes(1, "50000000000000") },
  ],
  authorization: { ceilings: { ANT: "9000000000000000", ETH: "90000000000000" }, authorizedBy: "oracle fixture", stopConditions: ["x"] },
  domain: { anyOpaque: { nested: true } },
});
const doc = buildGenericInvoice(base());

// A1: recompute canonical bytes/digests INDEPENDENTLY
const d1 = oracleDigest(doc);
attack("A1 independent digest recomputation", d1 === doc.identity.contentDigest,
  `oracle canonicalization reproduces the module digest exactly (${d1.slice(0, 20)}…)`);
const cb = canonicalBytes(stripSelf(doc)).toString("utf8");
attack("A1b independent canonical bytes", cb === canon(stripSelf(doc)),
  "module canonical bytes equal the oracle's independent serialization");

// A2: key ordering / irrelevant serialization order → identity stable
const reserialized = JSON.parse(JSON.stringify(doc), (k, v) => (typeof v === "object" && v !== null && !Array.isArray(v))
  ? Object.fromEntries(Object.keys(v).reverse().map((kk) => [kk, v[kk]])) : v);
attack("A2 key-order stability", contentDigest(reserialized) === doc.identity.contentDigest,
  "reversed key order at every level: same content identity");

// A2q: QUOTE ordering inside a line — set-semantics probe (founder attack #2).
// HONEST form: re-derive identity over the reordered content (as any
// independent serializer would) and ask whether the artifact still validates.
const reQ = JSON.parse(JSON.stringify(doc));
reQ.lines[0].quotes = [...reQ.lines[0].quotes].reverse();
const reQRecomputed = oracleDigest(reQ); // digest over reordered canonical bytes
const reQValid = attempt(() => validateGenericInvoice(reQ) && true);
const reQStable = reQRecomputed === doc.identity.contentDigest;
attack("A2q quote-order semantics", reQStable,
  reQStable ? "quote order does not change identity (set semantics)" : `SET-SENSITIVITY: re-derived identity over the reordered quote array differs (${reQRecomputed.slice(0, 17)} vs ${doc.identity.contentDigest.slice(0, 17)}); the reordered artifact then FAILS validation (${reQValid.ok ? "accepted" : (reQValid.err || "").slice(0, 60)}) — same economics, different identity: array order is identity-relevant while commitmentDigest treats quotes as a SET (sorted) — an internal inconsistency between the two digests' order semantics`);

// A3: economically meaningful mutation → identity changes
const m1 = buildGenericInvoice({ ...base(), lines: [{ ...base().lines[0], quotes: quotes(5, "1000000000000001") }, base().lines[1]] });
const m2 = buildGenericInvoice({ ...base(), issuedAt: "2026-09-18T00:00:00.000Z" });
attack("A3 mutation sensitivity", m1.identity.contentDigest !== doc.identity.contentDigest && m2.identity.contentDigest !== doc.identity.contentDigest,
  "dropped quote and new issuedAt both change identity");

// A4: forged digest after tamper → economic derivation still rejects
const t = JSON.parse(JSON.stringify(doc));
t.lines[0].amountAtto = "2000000000000002"; // within ceiling
t.identity = { ...t.identity, contentDigest: oracleDigest(t) }; // re-forge
const forged = attempt(() => validateGenericInvoice(t) && true);
attack("A4 committed-attacker Σ-law", !forged.ok, forged.ok ? "ACCEPTED — DEFECT" : "refused: " + (forged.err || "").slice(0, 80));
const t2 = JSON.parse(JSON.stringify(doc));
t2.lines[0].quotes[0].amount_atto = "9999999999999999";
t2.identity = { ...t2.identity, contentDigest: oracleDigest(t2) };
const forged2 = attempt(() => validateGenericInvoice(t2) && true);
attack("A4b quote-amount substitution", !forged2.ok, !forged2.ok ? "refused: " + (forged2.err || "").slice(0, 80) : "ACCEPTED — DEFECT (quote amounts are content; Σ and digest must both shift)");

// A5: fresh-process restart with pricing deleted/mutated
const TMP = process.argv[3];
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const art = TMP + "/invoice.json";
writeFileSync(art, JSON.stringify(doc));
const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
  import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
  import { pathToFileURL } from "node:url";
  const { validateGenericInvoice } = await import(pathToFileURL(process.argv[1]).href);
  // today's pricing: created, then DELETED — the validator must never need it
  const rates = process.argv[3] + "/rates.json";
  writeFileSync(rates, JSON.stringify({ ant: "9.9" })); unlinkSync(rates);
  const doc = JSON.parse(readFileSync(process.argv[2], "utf8"));
  validateGenericInvoice(doc, { expectedDigest: doc.identity.contentDigest });
  console.log("ORACLE-CHILD-OK " + doc.lines.map((l) => l.asset + ":" + l.amountAtto).join(","));
`, "--", MOD, art, TMP], { encoding: "utf8" });
attack("A5 restart, pricing deleted", child.status === 0 && /ORACLE-CHILD-OK ANT:6000000000000006,ETH:50000000000000/.test(child.stdout),
  (child.stdout || child.stderr || "").trim().split("\n").pop() || "child silent");

// A6: void→settled, stripped reforge, lawful supersession
const voided = voidGenericInvoice(doc, { kind: "abandon", ref: "ui abandon", at: "t1" });
const flip = JSON.parse(JSON.stringify(voided));
flip.state = "settled"; flip.settlement = { receiptId: "rc-x", receiptDigest: "sha256:y", at: "t2" };
flip.states = { invoice: "settled", settlement: "settled" };
const flipR = attempt(() => validateGenericInvoice(flip) && true);
const strip = JSON.parse(JSON.stringify(voided));
delete strip.voidEvidence; strip.state = "settled";
strip.settlement = { receiptId: "rc-x", receiptDigest: "sha256:y", at: "t2" };
strip.states = { invoice: "settled", settlement: "settled" };
strip.identity = { ...strip.identity, contentDigest: oracleDigest(strip) };
const stripUn = attempt(() => validateGenericInvoice(strip) && true);
const stripAn = attempt(() => validateGenericInvoice(strip, { expectedDigest: voided.identity.contentDigest }) && true);
const sup = voidGenericInvoice(doc, { kind: "superseded", ref: "corr", at: "t3", successorJobId: "up-oracle-2" });
const succ = buildGenericInvoice({ ...base(), jobId: "up-oracle-2", priorDigest: sup.identity.contentDigest });
const supOk = attempt(() => validateGenericInvoice(sup) && validateGenericInvoice(succ) && true);
attack("A6 terminality & supersession", !flipR.ok && stripUn.ok && !stripAn.ok && supOk.ok,
  `state-flip refused; stripped reforge unanchored=${stripUn.ok} anchored=refused; lawful supersession valid`);

// A7: receiptDigest is reference-binding, not authorization — no use of the
// field may gate a permission (only presence-recording for the settled state)
const src = readFileSync(MOD, "utf8");
const receiptDigestUses = [...src.matchAll(/receiptDigest/g)].length;
const gatesPermission = /receiptDigest[^;\n]{0,60}(authoriz|permit|approv|spend|unlock|grant)/i.test(src)
  || /(authoriz|permit|approv|spend|unlock|grant)[^\n]{0,60}receiptDigest/i.test(src);
attack("A7 receiptDigest non-authority", receiptDigestUses > 0 && !gatesPermission,
  `receiptDigest appears ${receiptDigestUses}× — presence-checks and recorded evidence only; no permission gate reads it (behaviorally confirmed by A6: settlement never bypasses the void/evidence laws)`);

// A8: no signing/key/authority machinery
attack("A8 no signing machinery", !/createSign|privateKey|generateKey|bip340|schnorr|ecdsa|secp256/i.test(src),
  "no signing/key primitives in the module");

// A9: genealogy/Autonomi specificity stays domain
const genericLawsText = src;
const domainLeak = /data_map|autonomi|trezor|erc-?7730|payForQuotes|archive|chunk/i.test(genericLawsText.replace(/\/\/.*$/gm, ""));
attack("A9 domain separation", !domainLeak, domainLeak ? "genealogy vocabulary leaked into law text" : "no genealogy/Autonomi vocabulary in the module's law (comments excluded, domain block opaque)");

// A10: job vs content identity separately useful
attack("A10 identity duality", doc.invoiceId === m1.invoiceId && doc.identity.jobId === m1.identity.jobId && doc.identity.contentDigest !== m1.identity.contentDigest,
  "job id routes (constant across versions); content identity distinguishes versions");

console.log("");
const fails = R.filter((r) => !r.ok);
console.log(fails.length ? `ORACLE: ${fails.length} FAILED — ${fails.map((f) => f.id).join(", ")}` : "ORACLE: all attacks passed");
process.exit(fails.length ? 1 : 0);
