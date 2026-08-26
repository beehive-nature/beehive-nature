// serve.mjs — zero-dep static server for the hex demo. Root = hex/.
// Usage: node tools/serve.mjs [port]  → http://127.0.0.1:<port>/demo/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] ?? 8944);
const MIME = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json",
};

createServer(async (req, res) => {
	try {
		let p = join(ROOT, normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^([/\\])+/, ""));
		if (extname(p) === "") p = join(p, "index.html");
		const body = await readFile(p);
		res.setHeader("Content-Type", MIME[extname(p)] ?? "application/octet-stream");
		res.setHeader("Cache-Control", "no-store");
		res.end(body);
	} catch {
		res.statusCode = 404;
		res.end("404");
	}
}).listen(PORT, "127.0.0.1", () => console.log(`hex demo on http://127.0.0.1:${PORT}/demo/`));
