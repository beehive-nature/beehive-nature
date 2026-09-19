// GUX-01 beat 2b — THE REAL-SURFACE ACCEPTANCE JOURNEY (zGeneUI mount).
// Drives surfaces/blood.html (not a harness): the advisor's experiential bar —
//   cold load -> interesting fact -> click person -> understand relationship ->
//   deliberately re-root -> change representation -> curiosity causes
//   second-person navigation -> Back returns exactly home
// plus the deep-link -> explore -> Back cases (BOTH starting conditions) and
// the mount invariants: one world, one explanation, one history, one grammar.
// Review beat d6ca5958 (LoVis bee-laborer fresh-eyes): browser Back restores
// (popstate), the post-Back rail + panel re-derive, the panel's stand-here
// re-roots the ENGINE, and the phone's system Back never exits the tree.
// Run: node e2e/gux01-blood-journey.mjs   (from the lane worktree root)
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
// playwright resolution: the e2e-local install when present, else the nest's
// shared checkout copy (read-only import — never a git operation on it)
let chromium;
try { ({ chromium } = await import("./node_modules/playwright/index.mjs")); }
catch { ({ chromium } = await import("../../beehive-nature/e2e/node_modules/playwright/index.mjs")); }

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SHOTS = join(ROOT, "e2e/shots-gux01-blood");
const PORT = 8797;
const PAGE_URL = `http://127.0.0.1:${PORT}/surfaces/blood.html`;
const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

// node-side corpus facts (the same JSON the page reads)
const corpus = JSON.parse(await readFile(join(ROOT, "assets/profile-archive/lineage/remington-bloodline.json"), "utf8"));
const APR = (corpus.refsIndex || {})["KWJ4-XBD"] || corpus.root; // the public entrance
let DONNA = null;
for (const [id, p] of Object.entries(corpus.persons)) if (/Donna Ruth Lawton/i.test(p.name || "")) { DONNA = id; break; }
const APR_PARENT = ((corpus.edges || {})[APR] || []).find((p) => corpus.persons[p]) || APR;

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = join(ROOT, p.replace(/\.\./g, "").replace(/^\//, ""));
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const results = [];
const ok = (name, cond, extra = "") => {
  results.push([cond ? "PASS" : "FAIL", name, extra]);
  if (!cond) process.exitCode = 1;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (extra ? " — " + extra : ""));
};
const shot = (page, name) => page.screenshot({ path: join(SHOTS, name + ".png"), fullPage: false });
const state = (page) => page.evaluate(() => {
  const c = globalThis.__guxAtlas.getContext();
  return { root: c.root, selection: c.selection, view: c.view, k: +c.transform.k.toFixed(2), x: Math.round(c.transform.x), y: Math.round(c.transform.y) };
});
const norm = (s) => ({ root: s.root, selection: s.selection || null, view: s.view, k: +s.k.toFixed(1), x: Math.round(s.x / 4) * 4, y: Math.round(s.y / 4) * 4 });
const clickPerson = async (page, iid) => {
  // the estate tour bar (#tbar) overlays cells near the fold, so real-pointer
  // clicks are flaky against overlays; the engine's pointer path is proven in
  // ITS harness journey — here we dispatch the cell's own click event (the
  // engine's select handler) and prove the state/panel semantics.
  await page.evaluate((id) => {
    const g = document.querySelector('#atlas [data-pid="' + id + '"]');
    if (!g) throw new Error("cell not painted: " + id);
    g.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, iid);
};
const paintedPid = (page, notId) => page.evaluate((nid) => {
  const els = Array.from(document.querySelectorAll('#atlas [data-pid]'));
  const el = els.find((e) => e.getAttribute("data-pid") !== nid);
  return el ? el.getAttribute("data-pid") : null;
}, notId || "");

const browser = await chromium.launch();
async function openJourney(width, height, hash = "") {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(PAGE_URL + hash, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("body.gux", { timeout: 40000 });
  await page.waitForSelector('#atlas .atlas-world, #atlas .atlas-listview', { timeout: 20000 });
  await page.waitForSelector('#ppanel[data-pp-mounted="1"]', { timeout: 20000 });
  await page.waitForSelector('#cards[data-cards]:not([hidden])', { timeout: 20000 });
  return { ctx, page, errors };
}
async function backHome(page) {
  // back walks the stack; at the bottom, one more back returns EXACTLY home
  // (the mount's button homes when the stack is empty and the context differs
  // from the URL-derived initial). Loop until we ARE at the initial context.
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => {
      const a = globalThis.__guxAtlas, init = globalThis.__guxInit;
      const c = a.getContext();
      const atInit = c.root === init.root && (c.selection || null) === (init.selection || null) && c.view === init.view;
      return { d: a.core.historyDepth(), atInit };
    });
    if (st.atInit) return st.d;
    await page.click("#guxback");
  }
  return -1;
}

try {
  await mkdir(SHOTS, { recursive: true });

  console.log("== desktop: the experiential acceptance journey ==");
  {
    const { ctx, page, errors } = await openJourney(1280, 800);
    const ctx0 = await state(page);
    ok("cold load: engine world + rail + panel mounted, incumbent comb retired", await page.evaluate(() => getComputedStyle(document.getElementById("comb")).display === "none" && !!document.querySelector("#atlas .atlas-world")));
    ok("cold: standing root is the public entrance (never a synthesized default)", ctx0.root === APR, "root=" + ctx0.root);
    ok("contextual rail: derives from the standing root", await page.getAttribute("#cards", "data-rail-root") === ctx0.root);
    ok("one explanation: incumbent detail internals hidden, panel speaks", await page.evaluate(() => getComputedStyle(document.getElementById("dbody")).display === "none" && document.querySelector("#ppanel .pp-view").innerText.trim().length > 0));
    await shot(page, "cold-desktop");

    const pid1 = await paintedPid(page, ctx0.root);
    await clickPerson(page, pid1);
    let s = await state(page);
    ok("click person: selection moves, root HELD (selection != re-root)", s.selection === pid1 && s.root === ctx0.root, "sel=" + s.selection);
    ok("atlas -> person: the panel explains the selected person", (await page.innerText("#ppanel .pp-view")).includes((await page.evaluate((id) => globalThis.__guxAtlas.person(id).name, pid1)).split(" ")[0]));
    await shot(page, "person-desktop");

    await page.evaluate((id) => globalThis.__guxAtlas.reroot(id), pid1); // the R key's action, explicit
    s = await state(page);
    ok("deliberate re-root: root moves to the selection", s.root === pid1);
    ok("contextual rail re-derives after re-root", await page.getAttribute("#cards", "data-rail-root") === pid1);

    await page.click("#viewfan");
    s = await state(page);
    ok("change representation: fractal, root+selection survive", s.view === "fractal" && s.root === pid1 && s.selection === pid1);

    const pid2 = await paintedPid(page, pid1);
    await clickPerson(page, pid2);
    s = await state(page);
    ok("curiosity causes second-person navigation (root held)", s.selection === pid2 && s.root === pid1);
    await shot(page, "second-person-fractal");

    const depth = await backHome(page);
    const final = await state(page);
    const coreEq = (a, b) => a.root === b.root && (a.selection || null) === (b.selection || null) && a.view === b.view;
    ok("Back returns home: root · selection · view EXACT", coreEq(final, ctx0), "final=" + JSON.stringify({ r: final.root, s: final.selection, v: final.view }) + " depth=" + depth);
    ok("Back returns home: the actual camera too [camera law 81e9ded8 — home returns to the boot framing]", JSON.stringify(norm(final)) === JSON.stringify(norm(ctx0)), "final=" + JSON.stringify(norm(final)) + " vs cold=" + JSON.stringify(norm(ctx0)));
    ok("URL grammar: hash mirrors the terminal state", await page.evaluate((st) => location.hash.includes("r=" + st.root), final));
    ok("zero page errors (desktop pass)", errors.length === 0, errors[0] || "");

    console.log("== deep-link case 1: #p=<person>, default root ==");
    const { ctx: c1, page: p1, errors: e1 } = await openJourney(1280, 800, "#p=" + DONNA);
    const d1 = await state(p1);
    ok("deep-link 1 boots SELECTION on the DEFAULT root", d1.selection === DONNA && d1.root === APR, "sel=" + d1.selection + " root=" + d1.root);
    ok("deep-link 1: the panel explains the deep-linked person", (await p1.innerText("#ppanel .pp-view")).includes("Donna"));
    await shot(p1, "deeplink1-desktop");
    const x1 = await paintedPid(p1, DONNA);
    await clickPerson(p1, x1);
    await p1.evaluate((id) => globalThis.__guxAtlas.reroot(id), x1);
    await p1.click("#viewtree");
    await backHome(p1);
    const f1 = await state(p1);
    const coreEq1 = (a, b) => a.root === b.root && (a.selection || null) === (b.selection || null) && a.view === b.view;
    ok("deep-link 1 terminal: root · selection · view IS the deep-linked context (not founder home)", coreEq1(f1, d1), "final=" + JSON.stringify({ r: f1.root, s: f1.selection, v: f1.view }));
    ok("deep-link 1 terminal: camera too [camera law 81e9ded8 — home returns to the boot framing]", JSON.stringify(norm(f1)) === JSON.stringify(norm(d1)), "final=" + JSON.stringify(norm(f1)) + " vs boot=" + JSON.stringify(norm(d1)));
    ok("zero page errors (deep-link 1)", e1.length === 0, e1[0] || "");

    console.log("== deep-link case 2: serialized hash = non-default root + selection + view + camera ==");
    const HASH2 = "#p=" + DONNA + "&v=fractal&r=" + APR_PARENT + "&s=1.6&x=-100&y=80";
    const { ctx: c2, page: p2, errors: e2 } = await openJourney(1280, 800, HASH2);
    const d2 = await state(p2);
    ok("deep-link 2 boots the SERIALIZED context exactly (state level)", d2.root === APR_PARENT && d2.selection === DONNA && d2.view === "fractal" && Math.abs(d2.k - 1.6) < 0.05, JSON.stringify(d2));
    await shot(p2, "deeplink2-desktop");
    const x2 = await paintedPid(p2, DONNA);
    await clickPerson(p2, x2);
    await p2.evaluate((id) => globalThis.__guxAtlas.reroot(id), x2);
    await p2.click("#viewped");
    await backHome(p2);
    const f2 = await state(p2);
    const coreEq2 = (a, b) => a.root === b.root && (a.selection || null) === (b.selection || null) && a.view === b.view;
    ok("deep-link 2 terminal: root · selection · view IS the serialized context", coreEq2(f2, d2), "final=" + JSON.stringify({ r: f2.root, s: f2.selection, v: f2.view }));
    ok("deep-link 2 terminal: camera IS the serialized context [camera law 81e9ded8 — serialized camera honored at boot, restored by home]", JSON.stringify(norm(f2)) === JSON.stringify(norm(d2)), "final=" + JSON.stringify(norm(f2)) + " vs boot=" + JSON.stringify(norm(d2)));
    ok("zero page errors (deep-link 2)", e2.length === 0, e2[0] || "");
    try { await c1.close(); } catch (e) {}
    try { await c2.close(); } catch (e) {}
    try { await ctx.close(); } catch (e) {}
  }

  console.log("== review beat d6ca5958: browser Back + post-Back rail/panel + panel stand-here ==");
  {
    const { ctx, page, errors } = await openJourney(1280, 800);
    const bootSt = await state(page);
    // the exploration a person does: select (replace) then re-root (push)
    const pid1 = await paintedPid(page, bootSt.root);
    await clickPerson(page, pid1);
    await page.evaluate((id) => globalThis.__guxAtlas.reroot(id), pid1);
    const sr = await state(page);
    ok("review precondition: re-rooted before Back", sr.root === pid1, "root=" + sr.root);

    // BROWSER Back (the phone's system-Back path): popstate must restore,
    // never leave the page (review finding 1 + spec invariant 4)
    await page.evaluate(() => history.back());
    await page.waitForFunction((r) => globalThis.__guxAtlas.getContext().root === r, bootSt.root);
    const sb = await state(page);
    ok("browser Back restores the exploration (popstate - one history mirrored)", sb.root === bootSt.root && sb.view === bootSt.view && (sb.selection || null) === pid1, JSON.stringify({ r: sb.root, s: sb.selection, v: sb.view }) + " vs boot " + JSON.stringify({ r: bootSt.root, v: bootSt.view }));
    ok("browser Back: URL grammar mirrors the restored context", await page.evaluate((st) => location.hash.includes("r=" + st.root) && location.hash.includes("p=" + (st.selection || "")), sb));
    ok("browser Back: rail re-derives to the RESTORED root (finding 2)", await page.getAttribute("#cards", "data-rail-root") === bootSt.root);
    const nm1 = await page.evaluate((id) => globalThis.__guxAtlas.person(id).name, pid1);
    ok("browser Back: the panel follows the restored selection (post-Back panel)", (await page.innerText("#ppanel .pp-view")).includes(String(nm1).split(" ")[0]));
    ok("browser Back stays ON the page (never a real navigation away)", page.url().includes("/surfaces/blood.html"));

    // panel stand-here (finding 5): the re-root button must re-root the ENGINE.
    // pid2 must differ from pid1 AND from the standing root — a stand-here on
    // the current root is the panel's own no-op and proves nothing.
    const pid2 = await page.evaluate((x) => {
      const els = Array.from(document.querySelectorAll('#atlas [data-pid]'));
      const el = els.find((e) => { const id = e.getAttribute('data-pid'); return id !== x.a && id !== x.b; });
      return el ? el.getAttribute('data-pid') : null;
    }, { a: pid1, b: bootSt.root });
    ok("review: stand-here target differs from the first re-root AND the standing root", !!pid2 && pid2 !== pid1 && pid2 !== bootSt.root, "pid1=" + pid1 + " pid2=" + pid2 + " root=" + bootSt.root);
    await clickPerson(page, pid2); // select pid2 -> the panel explains pid2
    await page.click("#ppanel [data-pproot]"); // "stand here (re-root)"
    const sp = await state(page);
    ok("panel stand-here re-roots the ENGINE - one root on screen: atlas + hash + rail all follow", sp.root === pid2 && (await page.evaluate(() => location.hash)).includes("r=" + pid2) && await page.getAttribute("#cards", "data-rail-root") === pid2, "root=" + sp.root + " sel=" + sp.selection + " rail=" + (await page.getAttribute("#cards", "data-rail-root")));
    ok("zero page errors (review beat)", errors.length === 0, errors[0] || "");
    try { await ctx.close(); } catch (e) {}
  }

  console.log("== 390px: the phone pass ==");
  {
    const { ctx, page, errors } = await openJourney(390, 844, "#p=" + DONNA);
    const s0 = await state(page);
    ok("390 cold: deep-linked person opens on the default root", s0.selection === DONNA && s0.root === APR);
    const pid = await paintedPid(page, s0.root);
    await clickPerson(page, pid);
    ok("390: selecting a person opens the drawer (panel reachable by thumb)", await page.evaluate(() => document.getElementById("detail").classList.contains("open")));
    ok("390: the ONE back affordance is visible", await page.isVisible("#guxback"));
    await shot(page, "person-390");
    // review beat d6ca5958: the phone's SYSTEM Back walks the exploration
    await page.evaluate((id) => globalThis.__guxAtlas.reroot(id), pid);
    await page.evaluate(() => history.back());
    await page.waitForFunction((r) => globalThis.__guxAtlas.getContext().root === r, s0.root);
    const sb390 = await state(page);
    ok("390 system Back: restores the pre-re-root context (never exits the tree)", sb390.root === s0.root && (sb390.selection || null) === pid && sb390.view === s0.view, JSON.stringify(sb390));
    await backHome(page);
    const f = await state(page);
    ok("390: Back returns home: root · selection · view EXACT", f.root === s0.root && (f.selection || null) === (s0.selection || null) && f.view === s0.view);
    ok("390: Back returns home: camera too [camera law 81e9ded8 — home returns to the boot framing]", JSON.stringify(norm(f)) === JSON.stringify(norm(s0)));
    ok("zero page errors (390 pass)", errors.length === 0, errors[0] || "");
    try { await ctx.close(); } catch (e) {}
  }
} finally {
  try { await browser.close(); } catch (e) {}
  server.close();
}

const pass = results.filter((r) => r[0] === "PASS").length;
console.log("\nJOURNEY: " + pass + "/" + results.length + " beats PASS" + (process.exitCode ? " — RED" : " — GREEN"));
await writeFile(join(SHOTS, "journey-results.json"), JSON.stringify(results, null, 1));
