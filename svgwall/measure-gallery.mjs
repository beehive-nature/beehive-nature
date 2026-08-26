// measure-gallery.mjs — the populated GALLERY view of inscriptions.app via its
// route URL (no clicks at all). Read-only. Estate playwright rail.
import { chromium } from "file:///C:/Users/travi/beehive-nature/e2e/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "https://inscriptions.app/gallery";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
	window.__lt = [];
	try {
		new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push({ start: e.startTime, dur: e.duration }))).observe({ entryTypes: ["longtask"] });
	} catch {}
	window.__lcp = [];
	try {
		new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lcp.push({ start: e.startTime }))).observe({ entryTypes: ["largest-contentful-paint"] });
	} catch {}
});
const reqs = [];
const resps = [];
const errs = [];
const consoleErrs = [];
page.on("request", (r) => reqs.push({ u: r.url(), m: r.method(), t: r.resourceType(), at: Date.now(), post: r.postData() }));
page.on("response", (r) => resps.push({ u: r.url(), s: r.status(), t: r.request().resourceType(), at: Date.now() }));
page.on("pageerror", (e) => consoleErrs.push(String(e).slice(0, 150)));

const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
// populate: settle, then scroll to bottom repeatedly (infinite scroll), settle
for (let i = 0; i < 8; i++) {
	await page.waitForTimeout(2500);
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
}
await page.waitForTimeout(4000);

const d = await page.evaluate(() => {
	const svgs = [...document.querySelectorAll("svg")];
	const byLen = svgs.map((s) => s.querySelectorAll("*").length).sort((a, b) => b - a);
	// what are the tiles made of? sample the biggest repeating containers
	const counts = {
		nodes: document.querySelectorAll("*").length,
		svgTotal: svgs.length,
		svgChildTop10: byLen.slice(0, 10),
		svgChildSum: byLen.reduce((a, b) => a + b, 0),
		polygons: document.querySelectorAll("polygon").length,
		paths: document.querySelectorAll("path").length,
		rects: document.querySelectorAll("rect").length,
		imgs: document.querySelectorAll("img").length,
		canvases: document.querySelectorAll("canvas").length,
	};
	return {
		...counts,
		url: location.href,
		title: document.title,
		docH: document.body.scrollHeight,
		fcp: Math.round(performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint")?.startTime ?? 0),
		lcp: window.__lcp?.length ? Math.round(window.__lcp[window.__lcp.length - 1].start) : null,
		text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 260),
	};
});

// in-flight overlap across ALL requests
const evts = [...reqs.map((r) => ({ t: r.at, d: 1 })), ...resps.map((r) => ({ t: r.at, d: -1 }))].sort((a, b) => a.t - b.t);
let cur = 0;
let max = 0;
for (const e of evts) { cur += e.d; max = Math.max(max, cur); }

const lt = await page.evaluate(() => window.__lt ?? []);
const rpcs = [];
for (const r of reqs) {
	if (!r.post) continue;
	try {
		const j = JSON.parse(r.post);
		const items = Array.isArray(j) ? j : [j];
		if (items[0]?.method) rpcs.push({ batch: items.length, methods: items.map((x) => String(x.method)) });
	} catch {}
}
const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));

console.log(JSON.stringify({
	...d,
	wallMs: Date.now() - t0,
	requests: resps.length,
	maxInFlight: max,
	api: [...new Set(resps.filter((r) => r.t === "fetch" || r.t === "xhr").map((r) => r.s + " " + r.u.slice(0, 100)))].slice(0, 14),
	rpcCalls: rpcs.length,
	rpcParamsTotal: rpcs.reduce((s, r) => s + r.batch, 0),
	rpcBatches: rpcs.filter((r) => r.batch > 1).map((r) => r.batch),
	rpcMethods: [...new Set(rpcs.flatMap((r) => r.methods))],
	longTaskCount: lt.length,
	longTasks: lt.map((t) => Math.round(t.dur)),
	longTaskTotalMs: Math.round(lt.reduce((s, t) => s + t.dur, 0)),
	longTaskMaxMs: lt.length ? Math.max(...lt.map((t) => t.dur)) : 0,
	lastLongTaskEnd: lt.length ? Math.max(...lt.map((t) => t.start + t.dur)) : 0,
	heapMB: heap,
	pageErrors: consoleErrs.slice(0, 4),
}, null, 1));

await page.screenshot({ path: "svgwall/shots/inscript-gallery-route.png", fullPage: false });
await page.screenshot({ path: "svgwall/shots/inscript-gallery-route-full.png", fullPage: true }).catch(() => {});
await browser.close();
