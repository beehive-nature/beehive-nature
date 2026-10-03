// Validate the reviewed allowlist; never expand publication from arbitrary
// directory contents or follow remote URLs. Dynamic loaders are declared too.
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";

export function checkRuntimeDependencies(root, files, runtime) {
  const allowed = new Set(files);
  const missing = new Set();
  function requireRef(from, ref) {
    if (!ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) return;
    const clean = ref.split(/[?#]/)[0];
    const path = clean.startsWith('/') ? clean.slice(1) : posix.normalize(posix.join(posix.dirname(from), clean));
    if (!allowed.has(path)) missing.add(from + " -> " + path);
  }
  for (const [from, refs] of Object.entries(runtime.dynamicDependencies)) {
    for (const ref of refs) if (!allowed.has(ref)) missing.add(from + " -> " + ref);
  }
  for (const file of files.filter(f => /\.(?:html|mjs|js|css)$/.test(f))) {
    const source = readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[^]*?-->/g, '');
    if (/\.(?:html|mjs|js)$/.test(file)) {
      for (const m of source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^;"']*?\bfrom\s*)?["']([^"']+)["']/g)) requireRef(file, m[1]);
      for (const m of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) requireRef(file, m[1]);
    }
    if (file.endsWith('.html')) {
      for (const tag of source.matchAll(/<(?:script|img|source|video)\b[^>]*>/gi))
        for (const m of tag[0].matchAll(/\b(?:src|poster)=["']([^"']+)["']/gi)) requireRef(file, m[1]);
      for (const m of source.matchAll(/<link\b[^>]*>/gi)) {
        if (/rel=["']stylesheet["']/i.test(m[0])) requireRef(file, m[0].match(/href=["']([^"']+)["']/i)?.[1]);
      }
    }
    if (file.endsWith('.css')) {
      for (const m of source.matchAll(/url\(["']?([^)'"\s]+)/g)) requireRef(file, m[1]);
      for (const m of source.matchAll(/@import\s*["']([^"']+)["']/g)) requireRef(file, m[1]);
    }
  }
  if (missing.size) throw new Error('Undeclared interactive dependencies:\n' + [...missing].join('\n'));
}
