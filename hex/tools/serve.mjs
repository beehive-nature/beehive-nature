// serve.mjs — zero-dep static server. Default root = hex/; pass --root <dir>
// to serve elsewhere (e.g. the worktree root for the live surface).
// Usage: node tools/serve.mjs [port] [--root <dir>]  → http://127.0.0.1:<port>/demo/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
let port = 8944;
let rootArg = null;
for (let i = 0; i < args.length; i++) {
	if (args[i] === "--root") rootArg = args[++i];
	else if (!isNaN(Number(args[i]))) port = Number(args[i]);
}
const ROOT = resolve(rootArg ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const PORT = port;
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
