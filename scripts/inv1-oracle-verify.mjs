// inv1-oracle-verify.mjs — the INVOICE-1 oracle's INDEPENDENT verifier
// (economic/POS/wallet seat). v2 (re-verification pass, 2026-09-17): the
// independent canonicalization is RE-DERIVED from the semantic law the
// builder documented at the A2q ruling —
//
//   QUOTES ARE AN UNORDERED COLLECTION OF UNIQUE QUOTE IDENTITIES.
//
// — sorting raw quote values by quote_hash BEFORE any representation step
// that would make the collection opaque (the v1 lesson: a sort guarded
// AFTER stringification never fires). Nothing from the builder's module is
// imported for canonicalization; the module under test is imported only
// for its public API. Run:
//   node scripts/inv1-oracle-verify.mjs [modulePath] [tmpDir]
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const MOD = process.argv[2] || new URL("../lib/bpay-invoice-generic.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TMP = process.argv[3] || "./tmp-inv1-oracle";
const {
  buildGenericInvoice, validateGenericInvoice, voidGenericInvoice,
  settleGenericInvoice, canonicalBytes, contentDigest, commitmentDigest,
} = await import(pathToFileURL(MOD).href);

const sha = (b) => "sha256:" + createHash("sha256").update(b).digest("hex");

// ── INDEPENDENT canonicalization (re-derived from the documented law) ──────
// lexicographic keys, recursive; arrays order-preserving EXCEPT quote
// collections — a `quotes` array of {quote_hash,…} entries is an UNORDERED
// SET sorted by quote_hash on RAW values before serialization.
const canon = (v, key = null) => {
  if (Array.isArray(v)) {
    let items = v;
    if (key === "quotes" && items.length
      && items.every((x) => x && typeof x === "object" && typeof x.quote_hash === "string"))
      items = [...items].sort((x, y) => (x.quote_hash < y.quote_hash ? -1 : x.quote_hash > y.quote_hash ? 1 : 0));
    return "[" + items.map((x) => canon(x)).join(",") + "]";
  }
  if (v !== null && typeof v === "object")
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k], k)).join(",") + "}";
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
const attempt = (fn) => { try { return { ok: !!fn() }; } catch (e) { return { ok: false, err: String(e.message).slice(0, 110) }; } };

// oracle fixture
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

// A1: independent digest + canonical bytes recomputation
attack("A1 independent digest/bytes", oracleDigest(doc) === doc.identity.contentDigest
  && canonicalBytes(stripSelf(doc)).toString("utf8") === canon(stripSelf(doc)),
  `oracle canonicalization reproduces the module digest and bytes exactly (${doc.identity.contentDigest.slice(0, 20)}…)`);

// A2: key-order stability
const reserialized = JSON.parse(JSON.stringify(doc), (k, v) => (typeof v === "object" && v !== null && !Array.isArray(v))
  ? Object.fromEntries(Object.keys(v).reverse().map((kk) => [kk, v[kk]])) : v);
attack("A2 key-order stability", contentDigest(reserialized) === doc.identity.contentDigest,
  "reversed key order at every level: same content identity");

// A2q-P: EXHAUSTIVE permutations of an unordered unique quote set → identical
// canonical bytes and contentDigest (founder check #1, oracle's own perms)
const pbase = () => ({ ...base(), authorization: { ceilings: { ANT: "20000000000000000", ETH: "90000000000000" }, authorizedBy: "oracle fixture", stopConditions: ["x"] } });
const permLines = () => ([
  { kind: "storage", asset: "ANT", quotes: [
    { quote_hash: "qh-d", amount_atto: "4000000000000001" },
    { quote_hash: "qh-a", amount_atto: "1000000000000001" },
    { quote_hash: "qh-c", amount_atto: "3000000000000001" },
    { quote_hash: "qh-b", amount_atto: "2000000000000001" } ] },
  base().lines[1],
]);
const perms = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
const allPerms = perms(permLines()[0].quotes); // 4! = 24 exhaustive
const permDigests = new Set(); const permBytes = new Set(); let permAllValid = true; let permFail = "";
for (const q of allPerms) {
  const d = buildGenericInvoice({ ...pbase(), lines: [{ ...permLines()[0], quotes: q }, permLines()[1]] });
  permDigests.add(d.identity.contentDigest);
  permBytes.add(canonicalBytes(stripSelf(d)).toString("utf8"));
  const v = attempt(() => validateGenericInvoice(d) && true);
  if (!v.ok) { permAllValid = false; permFail = v.err || ""; break; }
}
attack("A2q-P permutation stability", permDigests.size === 1 && permBytes.size === 1 && permAllValid,
  permAllValid && permDigests.size === 1
    ? `all 24 exhaustive permutations of the unique quote set → ONE canonical byte string and ONE contentDigest (${[...permDigests][0].slice(0, 17)}…), every permutation validates`
    : `permutation instability: digests=${permDigests.size} bytes=${permBytes.size} ${permFail}`);

// A2q-G: the two digests agree on quote collection semantics (founder #2)
const agreeBase = buildGenericInvoice({ ...pbase(), lines: permLines() });
const agreeRe = JSON.parse(JSON.stringify(agreeBase));
agreeRe.lines[0].quotes = [...agreeRe.lines[0].quotes].reverse();
attack("A2q-G digest agreement", contentDigest(agreeRe) === agreeBase.identity.contentDigest
  && commitmentDigest(agreeRe.lines) === agreeBase.commitment.digest,
  "reordered enumeration re-derives the SAME contentDigest AND the same commitmentDigest — one collection semantics");

// A3: economically meaningful mutation → identity change (founder #3)
const m1 = buildGenericInvoice({ ...base(), lines: [{ ...base().lines[0], quotes: quotes(5, "1000000000000001") }, base().lines[1]] });
const m2 = buildGenericInvoice({ ...base(), issuedAt: "2026-09-18T00:00:00.000Z" });
attack("A3 mutation sensitivity", m1.identity.contentDigest !== doc.identity.contentDigest && m2.identity.contentDigest !== doc.identity.contentDigest,
  "dropped quote and new issuedAt both change identity");

// A3v: same quote hashes, one amount changed (set semantics stays sensitive)
const valChanged = buildGenericInvoice({ ...base(), lines: [
  { ...base().lines[0], quotes: base().lines[0].quotes.map((q) => q.quote_hash === "qh-3" ? { ...q, amount_atto: "7777777777777" } : q) },
  base().lines[1],
] });
attack("A3v quote-value sensitivity", valChanged.identity.contentDigest !== doc.identity.contentDigest,
  "same quote hashes with one amount changed → DIFFERENT identity");

// A2q-D: duplicate quote_hash rejected in all three shapes (founder #4)
const dupDoc = (dupAmount) => {
  const d = JSON.parse(JSON.stringify(buildGenericInvoice({ ...pbase(), lines: permLines() })));
  d.lines[0].quotes.push({ quote_hash: "qh-a", amount_atto: dupAmount });
  d.identity = { ...d.identity, contentDigest: oracleDigest(d) }; // attacker recomputes
  return d;
};
const dupSame = attempt(() => validateGenericInvoice(dupDoc("1000000000000001")) && true);
const dupDiff = attempt(() => validateGenericInvoice(dupDoc("1")) && true);
const dupBuild = attempt(() => buildGenericInvoice({ ...base(), lines: [
  { ...permLines()[0], quotes: [...permLines()[0].quotes, { quote_hash: "qh-a", amount_atto: "1000000000000001" }] }, permLines()[1],
] }) && true);
attack("A2q-D duplicate law", !dupSame.ok && !dupDiff.ok && !dupBuild.ok,
  `same-hash+same-amount refused (${!dupSame.ok}); same-hash+different-amount refused (${!dupDiff.ok}); build-side refused (${!dupBuild.ok}); validation refusals hold WITH the attacker's recomputed contentDigest (${!dupSame.ok ? (dupSame.err || "").slice(0, 60) : "DEFECT"})`);

// A4: committed attackers rejected independent of digest integrity (founder #5)
const t = JSON.parse(JSON.stringify(doc));
t.lines[0].amountAtto = "2000000000000002";
t.identity = { ...t.identity, contentDigest: oracleDigest(t) };
const forged = attempt(() => validateGenericInvoice(t) && true);
const t2 = JSON.parse(JSON.stringify(doc));
t2.lines[0].quotes[0].amount_atto = "9999999999999999";
t2.identity = { ...t2.identity, contentDigest: oracleDigest(t2) };
const forged2 = attempt(() => validateGenericInvoice(t2) && true);
attack("A4 committed-attacker Σ-law", !forged.ok && !forged2.ok,
  "amount tamper and quote-amount substitution, both with independently recomputed digests, refused by the Σ-law alone");

// A5: restart with pricing changed AND deleted (founder #6)
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const art = TMP + "/invoice.json";
writeFileSync(art, JSON.stringify(doc));
const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
  import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
  import { pathToFileURL } from "node:url";
  const { validateGenericInvoice } = await import(pathToFileURL(process.argv[1]).href);
  const rates = process.argv[3] + "/rates.json";
  writeFileSync(rates, JSON.stringify({ ant: "9.9", mutated: true }));
  const docA = JSON.parse(readFileSync(process.argv[2], "utf8"));
  validateGenericInvoice(docA, { expectedDigest: docA.identity.contentDigest }); // under MUTATED pricing
  unlinkSync(rates);
  const docB = JSON.parse(readFileSync(process.argv[2], "utf8"));
  validateGenericInvoice(docB, { expectedDigest: docB.identity.contentDigest }); // under DELETED pricing
  console.log("ORACLE-CHILD-OK " + docB.lines.map((l) => l.asset + ":" + l.amountAtto).join(","));
`, "--", MOD, art, TMP], { encoding: "utf8" });
attack("A5 restart, pricing mutated+deleted", child.status === 0 && /ORACLE-CHILD-OK ANT:6000000000000006,ETH:50000000000000/.test(child.stdout),
  (child.stdout || child.stderr || "").trim().split("\n").pop() || "child silent");

// A6: void, evidence conflict, anchor, lawful supersession (founder #7)
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
const settled = settleGenericInvoice(doc, { receiptId: "rc-up-oracle-1", receiptDigest: "sha256:z", at: "t4" });
const setOk = attempt(() => validateGenericInvoice(settled) && true);
attack("A6 terminality & supersession", !flipR.ok && stripUn.ok && !stripAn.ok && supOk.ok && setOk.ok,
  "void→settled flip refused; stripped reforge refused against anchor; lawful supersession and settlement-from-issued valid");

// A7/A8: receiptDigest non-authority + no signing machinery (founder #9)
const src = readFileSync(MOD, "utf8");
const uses = [...src.matchAll(/receiptDigest/g)].length;
const gates = /receiptDigest[^;\n]{0,60}(authoriz|permit|approv|spend|unlock|grant)/i.test(src)
  || /(authoriz|permit|approv|spend|unlock|grant)[^\n]{0,60}receiptDigest/i.test(src);
const noSigning = !/createSign|privateKey|generateKey|bip340|schnorr|ecdsa|secp256/i.test(src);
attack("A7/A8 non-authority + no signing", uses > 0 && !gates && noSigning,
  `receiptDigest = presence-checked evidence only (${uses} uses); no signing/key primitives; no R20 semantics migrated`);

// A9: no genealogy/Autonomi vocabulary in generic law (founder #10)
const lawText = src.replace(/\/\/.*$/gm, "");
attack("A9 domain separation", !/data_map|autonomi|trezor|erc-?7730|payForQuotes|archive|chunk/i.test(lawText),
  "no genealogy/Autonomi vocabulary in the module's law text; domain block opaque");

// A10: job vs content identity distinct (founder #8)
attack("A10 identity duality", doc.invoiceId === m1.invoiceId && doc.identity.jobId === m1.identity.jobId && doc.identity.contentDigest !== m1.identity.contentDigest,
  "job id routes (constant across versions); content identity distinguishes versions");

console.log("");
const fails = R.filter((r) => !r.ok);
console.log(fails.length ? `ORACLE: ${fails.length} FAILED — ${fails.map((f) => f.id).join(", ")}` : "ORACLE: all attacks passed (13 independent probes)");
rmSync(TMP, { recursive: true, force: true });
process.exit(fails.length ? 1 : 0);
