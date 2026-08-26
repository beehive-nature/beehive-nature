// measure-inscriptions.mjs — READ-ONLY measurement of https://inscriptions.app
// (Inscript, React SPA, Froggi ecosystem). No login, no wallet, no submits —
// load, wait for settle, scroll to populate, read perf entries. Estate
// playwright rail (shared checkout e2e/node_modules, zero install).
import { chromium } from "file:///C:/Users/travi/beehive-nature/e2e/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "shots");
mkdirSync(SHOTS, { recursive: true });
const URL = "https://inscriptions.app";
const RUNS = Number(process.env.RUNS ?? 2);

const browser = await chromium.launch();

async function settle(page, quietMs = 3000, capMs = 90000) {
	const t0 = Date.now();
	let lastReq = Date.now();
	page._sawRequest = () => (lastReq = Date.now());
	while (Date.now() - t0 < capMs) {
		await page.waitForTimeout(300);
		if (Date.now() - lastReq >= quietMs) return "settled";
	}
	return "cap";
}

for (let run = 1; run <= RUNS; run++) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	const reqs = [];
	const resps = [];
	page.on("request", (r) => {
		reqs.push({ url: r.url(), method: r.method(), type: r.resourceType(), at: Date.now(), post: r.postData() ?? null });
		page._sawRequest?.();
	});
	page.on("response", async (r) => {
		resps.push({ url: r.url(), status: r.status(), type: r.request().resourceType(), at: Date.now(), len: Number(r.headers()["content-length"] ?? 0) });
	});
	const consoleErrs = [];
	page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 120)); });

	await page.addInitScript(() => {
		window.__lt = [];
		try {
			new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push({ start: e.startTime, dur: e.duration }))).observe({ entryTypes: ["longtask"] });
		} catch {}
		window.__lcp = [];
		try {
			new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lcp.push({ start: e.startTime, size: e.size }))).observe({ entryTypes: ["largest-contentful-paint"] });
		} catch {}
	});

	const t0 = Date.now();
	try {
		await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
	} catch (e) {
		console.log(`run ${run}: goto failed: ${String(e).slice(0, 160)}`);
		await context.close();
		continue;
	}
	await settle(page);
	// populate the gallery: scroll-only — reading, not acting
	for (let i = 0; i < 10; i++) {
		await page.evaluate(() => window.scrollBy(0, 1100));
		await page.waitForTimeout(650);
	}
	await settle(page);
	for (let i = 0; i < 4; i++) {
		await page.evaluate(() => window.scrollBy(0, -1400));
		await page.waitForTimeout(350);
	}
	const wallMs = Date.now() - t0;

	const m = await page.evaluate(() => {
		const paint = performance.getEntriesByType("paint");
		const fcp = paint.find((p) => p.name === "first-contentful-paint");
		const nav = performance.getEntriesByType("navigation")[0];
		const res = performance.getEntriesByType("resource");
		const byType = {};
		let transfer = 0;
		for (const r of res) {
			byType[r.initiatorType] = (byType[r.initiatorType] ?? 0) + 1;
			transfer += r.transferSize ?? 0;
		}
		const nodes = document.querySelectorAll("*").length;
		const svgs = document.querySelectorAll("svg");
		const imgs = document.querySelectorAll("img");
		const canvases = document.querySelectorAll("canvas");
		// sample inline svg depth: are inscription glyphs inline element trees?
		const sample = [];
		const byLen = [...svgs].sort((a, b) => b.querySelectorAll("*").length - a.querySelectorAll("*").length);
		for (const s of byLen.slice(0, 3)) sample.push(s.querySelectorAll("*").length);
		const react = !!(window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || document.querySelector("#root,[data-reactroot]"));
		return {
			url: location.href,
			title: document.title,
			nodes,
			svgCount: svgs.length,
			imgCount: imgs.length,
			canvasCount: canvases.length,
			biggestSvgChildren: sample,
			fcp: fcp ? Math.round(fcp.startTime) : null,
			lcp: window.__lcp?.length ? Math.round(window.__lcp[window.__lcp.length - 1].start) : null,
			dcl: Math.round(nav?.domContentLoadedEventEnd ?? 0),
			loadEvt: Math.round(nav?.loadEventEnd ?? 0),
			resCount: res.length,
			resByType: byType,
			transferKB: Math.round(transfer / 1024),
			longTasks: (window.__lt ?? []).map((t) => ({ start: Math.round(t.start), dur: Math.round(t.dur) })),
			react,
			memMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
		};
	});

	// classify network: fetch/xhr + JSON-RPC bodies, serial vs batched
	const rpc = [];
	for (const r of reqs) {
		if (!r.post) continue;
		const p = r.post.trimStart()[0];
		if (p !== "{" && p !== "[") continue;
		try {
			const j = JSON.parse(r.post);
			const items = Array.isArray(j) ? j : [j];
			if (!items[0]?.method) continue;
			rpc.push({ url: r.url.slice(0, 80), at: r.at, batch: Array.isArray(j) ? items.length : 1, methods: items.map((x) => String(x.method).slice(0, 40)) });
		} catch {}
	}
	// overlap analysis on ALL requests: how many were in-flight simultaneously?
	const evts = [...reqs.map((r) => ({ t: r.at, d: 1 })), ...resps.map((r) => ({ t: r.at, d: -1 }))].sort((a, b) => a.t - b.t);
	let cur = 0;
	let maxInFlight = 0;
	for (const e of evts) { cur += e.d; maxInFlight = Math.max(maxInFlight, cur); }

	const lt = m.longTasks ?? [];
	const ltTotal = lt.reduce((s, t) => s + t.dur, 0);
	const ltLastEnd = lt.length ? Math.max(...lt.map((t) => t.start + t.dur)) : 0;
	await page.screenshot({ path: join(SHOTS, `inscript-run${run}-populated.png`), fullPage: false }).catch(() => {});
	console.log(`\n=== RUN ${run} · ${m.url} · "${m.title}" ===`);
	console.log(JSON.stringify({
		wallClockMs: wallMs,
		fcp: m.fcp,
		lcp: m.lcp,
		dcl: m.dcl,
		loadEvent: m.loadEvt,
		ttiApproxLastLongTaskEnd: lt.length ? Math.round(ltLastEnd) : m.fcp,
		domNodes: m.nodes,
		svgElements: m.svgCount,
		imgElements: m.imgCount,
		canvasElements: m.canvasCount,
		biggestInlineSvgChildren: m.biggestSvgChildren,
		react: m.react,
		requests: reqs.length,
		maxRequestsInFlight: maxInFlight,
		rpcCalls: rpc.length,
		rpcBatches: rpc.filter((r) => r.batch > 1).map((r) => r.batch),
		rpcMethods: [...new Set(rpc.flatMap((r) => r.methods))].slice(0, 20),
		resourceEntries: m.resCount,
		transferKB: m.transferKB,
		resByType: m.resByType,
		longTaskCount: lt.length,
		longTaskTotalMs: ltTotal,
		longTaskMaxMs: lt.length ? Math.max(...lt.map((t) => t.dur)) : 0,
		jsHeapMB: m.memMB,
		consoleErrors: consoleErrs.length,
	}, null, 1));
	await context.close();
}
await browser.close();
