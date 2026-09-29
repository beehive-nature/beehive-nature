// ── identity assignment + persistence — the real code, testable in CI ──────
// Extracted from the pipeline so synthetic fixtures can prove the guarantees:
// reordered imports preserve issued ids; explicitly approved provider aliases
// preserve identity; collisions refuse; a corrupted previously-issued
// registry STOPS the run (a missing one starts fresh — those are different
// states and must never be confused).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const newInternalId = (providerRef) =>
  "p" + createHash("sha1").update(providerRef).digest("hex").slice(0, 10);

export const PUBLIC_REGISTRY_SCHEMA = "skaists.identity-registry/1";
export const PRIVATE_REGISTRY_SCHEMA = "skaists.identity-registry-private/1";

// Distinguish: missing registry → fresh start; corrupted → fatal. A silent
// reset of frozen addresses is the exact bug this module exists to prevent.
export function loadRegistry(path, schema) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return { state: "fresh", registry: { schema, issued: {}, aliases: {} } };
    throw new Error(`identity registry unreadable (${path}): ${e.message} — refusing to run against ambiguous identity state`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`identity registry CORRUPT (${path}): ${e.message} — refusing to reset frozen addresses; repair the registry explicitly`);
  }
  if (!parsed || typeof parsed !== "object" || typeof parsed.issued !== "object" || Array.isArray(parsed.issued))
    throw new Error(`identity registry malformed (${path}): expected {schema, issued{}} — refusing to run`);
  parsed.aliases = parsed.aliases || {};
  return { state: "loaded", registry: parsed };
}

// Assign internal ids for the persons being published. Registry-first:
// issued ids are reused; aliases redirect changed provider refs to their
// canonical entry; collisions refuse; living pseudonyms come from (and
// persist to) the PRIVATE registry only.
export function assignIdentities({ pubPersons, root, pubRegistry, privRegistry }) {
  const idmap = {};
  const errors = [];
  const issuedReverse = new Map(); // iid -> fsid (collision guard, includes aliases' canonicals)
  for (const [fsid, iid] of Object.entries(pubRegistry.issued || {})) {
    if (issuedReverse.has(iid)) errors.push(`registry collision: id ${iid} issued to both ${issuedReverse.get(iid)} and ${fsid} — merge/split requires explicit aliasing`);
    else issuedReverse.set(iid, fsid);
  }
  let livN = Math.max(0, ...Object.values(privRegistry.issued || {})
    .map((v) => { const m = /^liv-(\d+)$/.exec(v); return m ? parseInt(m[1], 10) : 0; }));

  for (const id of Object.keys(pubPersons)) {
    const p = pubPersons[id];
    if (p.living) {
      if (id === root) { idmap[id] = "founder"; privRegistry.issued[id] = "founder"; continue; }
      const known = privRegistry.issued[id];
      if (known) idmap[id] = known;
      else { idmap[id] = "liv-" + (++livN); privRegistry.issued[id] = idmap[id]; }
      continue;
    }
    if (/^ovl-/.test(id)) { idmap[id] = id; continue; }
    // alias first (explicitly approved provider-reference change), then issued
    const canonical = (pubRegistry.aliases || {})[id] || id;
    const known = pubRegistry.issued[canonical];
    if (known) { idmap[id] = known; if (canonical !== id) pubRegistry.aliases[id] = canonical; continue; }
    const iid = newInternalId("familysearch:" + id);
    if (issuedReverse.has(iid)) { errors.push(`hash collision on ${id} → ${iid} (already ${issuedReverse.get(iid)}) — refusing`); continue; }
    pubRegistry.issued[id] = iid;
    issuedReverse.set(iid, id);
    idmap[id] = iid;
  }
  return { idmap, errors };
}
