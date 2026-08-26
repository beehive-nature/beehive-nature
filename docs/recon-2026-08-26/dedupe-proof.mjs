// dedupe-proof.mjs — render identity for the three deduped files, one run:
//   per file: two consecutive shots (stability control), then stash → two
//   before-shots → pop → byte-compare.
import { chromium } from "file:///C:/Users/travi/beehive-nature/e2e/node_modules/playwright/index.mjs";
import { writeFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = ["bnames", "royalguard", "wallet"];
const shoot = async (f, tag) => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(`http://127.0.0.1:8949/surfaces/${f}.html`, { waitUntil: "load" });
	await page.waitForTimeout(900);
	const buf = await page.screenshot({ fullPage: true });
	writeFileSync(`.recon/${f}-${tag}.png`, buf);
	await browser.close();
	return buf;
};

for (const f of files) {
	const a1 = await shoot(f, "a1");
	const a2 = await shoot(f, "a2");
	const stableAfter = a1.equals(a2);
	execSync("git stash", { stdio: "ignore" });
	const b1 = await shoot(f, "b1");
	const b2 = await shoot(f, "b2");
	execSync("git stash pop", { stdio: "ignore" });
	const stableBefore = b1.equals(b2);
	const identical = a1.equals(b1);
	console.log(
		`${f}: after-stable=${stableAfter ? "yes" : "NO(live page)"} before-stable=${stableBefore ? "yes" : "NO(live page)"} before-vs-after=${identical ? "IDENTICAL" : "DIFFERS"}`,
	);
}
