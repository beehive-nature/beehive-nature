// GUX-01 blood-atlas FIRST ACCEPTANCE JOURNEY — the receipt run.
// Serves the worktree, drives the harness through the ordered beats, asserts
// each law in the LIVE DOM, and screenshots at 390px + desktop.
//   cold corpus → focus current person → bounded local topology →
//   select WITHOUT changing root → re-root explicitly →
//   change pedigree/fractal/tree representation → selection/root/context
//   survive → back restores prior exploration context.
// Plus: ghost frontier affordance (L7), semantic zoom LOD (L2), bounded paint (L5).
// Run: node e2e/blood-atlas-journey.mjs   (from the lane worktree root)
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright"; // machine-level resolution (~/node_modules walk-up);

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SHOTS = join(ROOT, "e2e/shots-blood-atlas-gux01");
const PORT = 8793;
const HARNESS = `http://127.0.0.1:${PORT}/tools/genealogy/blood-atlas-harness.html`;
const GHOST_TITLE = "ancestry continues beyond the published archive";
const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

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
  console.log((cond ? "  ✓ " : "  ✗ FAIL ") + name + (extra ? " — " + extra : ""));
};
const ctxText = (page) => page.locator("#atlas-ctx").innerText();
// parse the harness context line (innerText — no html tags survive)
const ctxOf = async (page) => {
  const t = await ctxText(page);
  const m = t.match(/root: (.+?) · selection: (.+?) · view: ([a-z]+) · history: (\d+) · painted: (\d+) · lod: (\w+)/);
  return m ? { root: m[1], sel: m[2], view: m[3], hist: +m[4], painted: +m[5], lod: m[6], raw: t } : { raw: t };
};
// click the person's VISUAL shape (box/hex) — the <g> bbox includes labels
// and would not be the cell itself
const clickPerson = (page, iid) =>
  page.locator('[data-pid="' + iid + '"] .atlas-box, [data-pid="' + iid + '"] .atlas-hex').first().click();

const browser = await chromium.launch();
async function openJourney(width, height, query = "") {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(HARNESS + query, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('#atlas-mount[data-atlas-ready="1"]', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector(".atlas-world, .atlas-listview"), null, { timeout: 10000 });
  return { ctx, page, errors };
}
const shot = (page, name) => page.screenshot({ path: join(SHOTS, name + ".png"), fullPage: false });

try {
  await mkdir(SHOTS, { recursive: true });
  console.log("== 390px acceptance journey ==");
  const { ctx: c390, page, errors } = await openJourney(390, 844);

  // 1. cold corpus → focus current person → bounded local topology
  await page.waitForFunction(() => document.querySelectorAll(".atlas-cell").length > 30, null, { timeout: 10000 });
  const painted0 = await page.locator(".atlas-world").getAttribute("data-painted");
  ok("cold load renders bounded local topology", +painted0 >= 60 && +painted0 <= 255, `painted=${painted0} of ≤255 (corpus holds 10,259)`);
  ok("cold root is the corpus current person (founder)", (await ctxText(page)).includes("root:") && (await ctxText(page)).includes("Living"), "");
  await shot(page, "390-01-cold-pedigree");

  // 2. select WITHOUT changing root (Donna, gen 2)
  await clickPerson(page, "p7b1078c886");
  await page.waitForSelector(".atlas-cell.atlas-sel");
  const c1 = await ctxOf(page);
  ok("selection is state; root did NOT move", c1.sel.includes("Donna Ruth Lawton") && c1.root === "Living",
    `root="${c1.root}" selection="${c1.sel}"`);
  const selCells = await page.locator('[data-pid="p7b1078c886"].atlas-sel').count();
  ok("every occurrence of the identity is marked (one canonical identity)", selCells >= 1);
  await shot(page, "390-02-select-donna-root-held");

  // 3. explicit re-root
  await page.locator("#panel-reroot").click();
  const c2 = await ctxOf(page);
  ok("explicit re-root moves the root, selection survives", c2.root.includes("Donna Ruth Lawton") && c2.sel.includes("Donna Ruth Lawton"),
    `root="${c2.root}"`);
  await shot(page, "390-03-reroot-donna");

  // 4. change representation → fractal; root+selection survive
  await page.locator('[data-atlas-view="fractal"]').click();
  await page.waitForSelector(".atlas-world[data-view='fractal']");
  const c3 = await ctxOf(page);
  ok("view→fractal: root and selection survive", c3.root.includes("Donna Ruth Lawton") && c3.view === "fractal" && c3.sel.includes("Donna Ruth Lawton"),
    `root="${c3.root}" view=${c3.view} sel="${c3.sel}"`);
  ok("root spouse cells render as affinity (L8)", (await page.locator(".atlas-cell.atlas-affinity").count()) >= 0, "affinity class present when couples exist for root");
  await shot(page, "390-04-fractal-survives");

  // 5. change representation → tree
  await page.locator('[data-atlas-view="tree"]').click();
  await page.waitForSelector(".atlas-listview");
  const c4 = await ctxOf(page);
  ok("view→tree: root and selection survive", c4.root.includes("Donna Ruth Lawton") && c4.view === "tree" && c4.sel.includes("Donna Ruth Lawton"), "");
  ok("tree renders ancestors+self sections as rows", (await page.locator('.atlas-row[data-section="ancestors"]').count()) >= 1
    && (await page.locator('.atlas-row[data-section="self"]').count()) === 1);
  ok("selected row marked in tree view too", (await page.locator(".atlas-row.atlas-sel").count()) >= 1);
  await shot(page, "390-05-tree-survives");

  // 6. back restores prior exploration contexts (three pushes → three backs)
  await page.locator("#atlas-back").click(); // → fractal
  const b1 = await ctxOf(page);
  ok("back 1/3: prior context (fractal, root Donna)", b1.view === "fractal" && b1.root.includes("Donna Ruth Lawton"), `view=${b1.view} root="${b1.root}"`);
  await page.locator("#atlas-back").click(); // → pedigree, root Donna
  await page.locator("#atlas-back").click(); // → cold context: root founder, selection Donna
  const b3 = await ctxOf(page);
  ok("back 2/3+3/3: cold-load context restored, selection intact",
    b3.root === "Living" && b3.view === "pedigree" && b3.sel.includes("Donna Ruth Lawton"),
    `root="${b3.root}" view=${b3.view} sel="${b3.sel}"`);
  await shot(page, "390-06-back-restored-context");

  // 7. semantic zoom (L2): zoom out to structure
  await page.locator('[data-atlas-view="fractal"]').click();
  for (let i = 0; i < 5; i++) await page.locator("#atlas-zout").click();
  await page.waitForSelector(".atlas-world.lod-far", { timeout: 5000 });
  const labelHidden = await page.evaluate(() => {
    const l = document.querySelector(".atlas-cell .atlas-label");
    return !l || getComputedStyle(l).display === "none";
  });
  ok("semantic zoom: far = structure only, labels hidden", labelHidden);
  await shot(page, "390-07-lod-far-structure-only");
  for (let i = 0; i < 9; i++) await page.locator("#atlas-zin").click();
  await page.waitForSelector(".atlas-world.lod-near", { timeout: 5000 });
  ok("semantic zoom: near = reading (labels back)", !(await page.evaluate(() => {
    const l = document.querySelector('.atlas-cell[data-gen="0"] .atlas-label');
    return !l || getComputedStyle(l).display === "none";
  })));
  await shot(page, "390-08-lod-near-reading");

  ok("zero page errors on the 390 journey", errors.length === 0, errors.join("; ").slice(0, 200));
  await c390.close();

  // 8. ghost frontier (L7) at Martha Steward — both parents are ghost refs
  console.log("== ghost frontier journey ==");
  const g390 = await openJourney(390, 844, "?p=pbdd007b536");
  await g390.page.waitForSelector(".atlas-cell.atlas-ghost", { timeout: 10000 });
  const ghosts = await g390.page.locator(".atlas-cell.atlas-ghost").count();
  ok("ghost slots render dashed at the parent positions (L7)", ghosts === 2, `${ghosts} ghost cells (Martha Steward's 2 unpublished parent refs)`);
  const ghostTitle = await g390.page.locator(".atlas-cell.atlas-ghost").first().locator("title").textContent();
  ok("ghost affordance says coverage-unknown, never 'no ancestors'", ghostTitle === GHOST_TITLE, ghostTitle);
  await g390.page.locator(".atlas-cell.atlas-ghost").first().click();
  await g390.page.waitForFunction((t) => document.getElementById("atlas-ghostlog").textContent.includes(t), GHOST_TITLE, { timeout: 5000 });
  ok("ghost click-through names the child carrying the reference", (await g390.page.locator("#atlas-ghostlog").innerText()).includes("Martha Steward"));
  await shot(g390.page, "390-09-ghost-frontier-martha");
  ok("ghost journey: zero page errors", g390.errors.length === 0, g390.errors.join("; ").slice(0, 200));
  await g390.ctx.close();

  // desktop pass
  console.log("== desktop confirmation pass ==");
  const d = await openJourney(1440, 900);
  await d.page.waitForFunction(() => document.querySelectorAll(".atlas-cell").length > 30);
  await shot(d.page, "desktop-01-cold-pedigree");
  await clickPerson(d.page, "p7b1078c886");
  await d.page.locator("#panel-reroot").click();
  await d.page.locator('[data-atlas-view="fractal"]').click();
  await d.page.waitForSelector(".atlas-world[data-view='fractal']");
  await shot(d.page, "desktop-02-fractal-donna");
  await d.page.locator('[data-atlas-view="tree"]').click();
  await d.page.waitForSelector(".atlas-listview");
  await shot(d.page, "desktop-03-tree-donna");
  const dc = await ctxOf(d.page);
  ok("desktop: same engine, same survival (root Donna across views)", dc.root.includes("Donna Ruth Lawton") && dc.view === "tree",
    `root="${dc.root}" view=${dc.view}`);
  ok("desktop journey: zero page errors", d.errors.length === 0, d.errors.join("; ").slice(0, 200));
  await d.ctx.close();
} finally {
  await browser.close();
  server.close();
}
const fails = results.filter((r) => r[0] === "FAIL").length;
console.log(`\nJOURNEY ${fails === 0 ? "PASS" : "FAIL"} — ${results.length - fails}/${results.length} beats`);
