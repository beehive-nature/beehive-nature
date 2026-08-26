// measure-gallery-panel.mjs — the gallery PANEL of inscriptions.app (opened
// via its nav button). Read-only viewing: Escape-dismiss the intro modal,
// click the public Gallery nav. No login, no wallet, no submits.
import { chromium } from "file:///C:/Users/travi/beehive-nature/e2e/node_modules/playwright/index.mjs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
	window.__lt = [];
	try {
		new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push({ start: e.startTime, dur: e.duration }))).observe({ entryTypes: ["longtask"] });
	} catch {}
});
const reqs = [];
const resps = [];
page.on("request", (r) => reqs.push({ u: r.url(), m: r.method(), t: r.resourceType(), at: Date.now(), post: r.postData() }));
page.on("response", (r) => resps.push({ u: r.url(), s: r.status(), t: r.request().resourceType(), at: Date.now() }));
const consoleErrs = [];
page.on("pageerror", (e) => consoleErrs.push(String(e).slice(0, 150)));

await page.goto("https://inscriptions.app", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000);

// dismiss the intro modal if a backdrop is present
const dismissed = await page.evaluate(() => {
	const bd = document.querySelector(".absolute.inset-0");
	if (!bd) return "no-backdrop";
	bd.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	return "clicked-backdrop";
});
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(1200);
const backdropGone = await page.evaluate(() => !document.querySelector(".absolute.inset-0"));

// open the gallery panel (public view)
const gallery = page.getByRole("button", { name: "Gallery" });
await gallery.click({ timeout: 15000, force: true });
const tGallery = Date.now();
// populate: scroll inside whichever scroller grows
for (let i = 0; i < 10; i++) {
	await page.waitForTimeout(1800);
	await page.evaluate(() => {
		const el = [document.scrollingElement, ...document.querySelectorAll("div")].find((e) => e && e.scrollHeight > e.clientHeight + 300 && e.clientHeight > 300 && getComputedStyle(e).overflowY !== "visible");
		(el ?? document.scrollingElement).scrollBy(0, 1400);
	});
}
await page.waitForTimeout(3500);

const d = await page.evaluate(() => {
	const svgs = [...document.querySelectorAll("svg")];
	const byLen = svgs.map((s) => s.querySelectorAll("*").length).sort((a, b) => b - a);
	return {
		url: location.href,
		nodes: document.querySelectorAll("*").length,
		svgTotal: svgs.length,
		svgChildTop10: byLen.slice(0, 10),
		svgChildSum: byLen.reduce((a, b) => a + b, 0),
		polygons: document.querySelectorAll("polygon").length,
		paths: document.querySelectorAll("path").length,
		rects: document.querySelectorAll("rect").length,
		imgs: document.querySelectorAll("img").length,
		canvases: document.querySelectorAll("canvas").length,
		text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 300),
	};
});
const evts = [...reqs.map((r) => ({ t: r.at, d: 1 })), ...resps.map((r) => ({ t: r.at, d: -1 }))].sort((a, b) => a.t - b.t);
let cur = 0;
let max = 0;
for (const e of evts) { cur += e.d; max = Math.max(max, cur); }
const galleryResps = resps.filter((r) => r.at >= tGallery - 2000);
const rpcs = [];
for (const r of reqs) {
	if (!r.post) continue;
	try {
		const j = JSON.parse(r.post);
		const items = Array.isArray(j) ? j : [j];
		if (items[0]?.method) rpcs.push({ batch: items.length, methods: items.map((x) => String(x.method)), at: r.at });
	} catch {}
}
const lt = await page.evaluate(() => window.__lt ?? []);
const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));

console.log(JSON.stringify({
	modal: { dismissed, backdropGoneAfterEscape: backdropGone },
	...d,
	galleryPhaseMs: Date.now() - tGallery,
	galleryPhaseRequests: galleryResps.length,
	galleryPhaseApi: [...new Set(galleryResps.filter((r) => r.t === "fetch" || r.t === "xhr").map((r) => r.s + " " + r.u.slice(0, 100)))],
	allRequests: resps.length,
	maxInFlight: max,
	rpcCalls: rpcs.length,
	rpcParamsTotal: rpcs.reduce((s, r) => s + r.batch, 0),
	rpcBatches: rpcs.filter((r) => r.batch > 1).map((r) => r.batch),
	rpcMethods: [...new Set(rpcs.flatMap((r) => r.methods))],
	rpcTimeline: rpcs.map((r) => ({ relS: ((r.at - reqs[0].at) / 1000).toFixed(1), batch: r.batch, m: r.methods.join(",") })),
	longTaskCount: lt.length,
	longTasks: lt.map((t) => Math.round(t.dur)),
	longTaskTotalMs: Math.round(lt.reduce((s, t) => s + t.dur, 0)),
	longTaskMaxMs: lt.length ? Math.max(...lt.map((t) => t.dur)) : 0,
	heapMB: heap,
	pageErrors: consoleErrs.slice(0, 4),
}, null, 1));
await page.screenshot({ path: "svgwall/shots/inscript-gallery-panel.png", fullPage: false });
await browser.close();
