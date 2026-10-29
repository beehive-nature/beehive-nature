import { AutonomiError, wrapError } from "./errors.js";
import { abortable, throwIfAborted } from "./internal/abort.js";
import { getBindings, initializeClientWasm } from "./internal/runtime.js";
/**
 * Parse an `ant://manifest/...` link, an `ant://<address>` file link, or a
 * bare 64-character hex address. Nothing is fetched: a manifest link carries
 * the manifest bytes, and a file link is only an address.
 */
export async function parseManifestLink(link, options = {}) {
    throwIfAborted(options.signal);
    await abortable(initializeClientWasm(options.wasm), options.signal);
    throwIfAborted(options.signal);
    try {
        const raw = getBindings().parseManifestLink(link);
        return raw.kind === "file"
            ? Object.freeze({ kind: "file", address: raw.address })
            : Object.freeze({ kind: "manifest", manifest: manifestFromCore(raw.manifest) });
    }
    catch (error) {
        throw wrapError("INVALID_SOURCE", "The link is not a valid Autonomi file or manifest link", error);
    }
}
/** Decode the bytes of a `.ant` manifest file. Nothing is fetched. */
export async function decodeManifest(bytes, options = {}) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
        throw new AutonomiError("INVALID_SOURCE", "A manifest requires its file bytes");
    }
    throwIfAborted(options.signal);
    await abortable(initializeClientWasm(options.wasm), options.signal);
    throwIfAborted(options.signal);
    try {
        return manifestFromCore(getBindings().decodeManifest(bytes));
    }
    catch (error) {
        throw wrapError("INVALID_SOURCE", "The bytes are not a valid manifest", error);
    }
}
/** Whether `value` is a manifest entry rather than an address, public file, or private reference. */
export function isManifestEntry(value) {
    return (typeof value === "object" && value !== null &&
        "kind" in value && (value.kind === "embedded" || value.kind === "public") &&
        typeof value.address === "string" && typeof value.name === "string");
}
/**
 * What the client reads for an entry: the embedded DataMap as a private file
 * reference, or the public address. The entry's name becomes the file name.
 */
export function manifestEntrySource(entry) {
    if (entry.kind === "embedded") {
        if (!(entry.dataMap instanceof Uint8Array) || entry.dataMap.byteLength === 0) {
            throw new AutonomiError("INVALID_SOURCE", `Manifest entry ${entry.name} is embedded but carries no DataMap`);
        }
        return { dataMap: entry.dataMap, name: fileName(entry) };
    }
    return entry.address;
}
/** An entry's recorded SHA-256 as lowercase hex, refusing a malformed one before anything is fetched. */
export function recordedSha256(entry) {
    if (entry.sha256 === undefined)
        return undefined;
    if (typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/iu.test(entry.sha256)) {
        throw new AutonomiError("INVALID_SOURCE", `Manifest entry ${entry.name} has a malformed sha256`);
    }
    return entry.sha256.toLowerCase();
}
/**
 * Hold downloaded bytes to the SHA-256 their manifest entry records, as the CLI does when
 * extracting. WebCrypto hashes them: the bytes are already whole here, and the core's
 * browser build exports no SHA-256.
 */
export async function checkSha256(bytes, expected, name) {
    const subtle = globalThis.crypto?.subtle;
    // Refuse rather than return bytes that were never held to the claim.
    if (!subtle)
        throw new Error("WebCrypto, needed to check the manifest entry's sha256, is unavailable outside a secure context");
    const actual = Array.from(new Uint8Array(await subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (actual !== expected)
        throw new Error(`${name} does not match its manifest entry's sha256: expected ${expected}, got ${actual}`);
}
/** The last path component, which is what a saved file should be called. */
export function fileName(entry) {
    return entry.name.slice(entry.name.lastIndexOf("/") + 1) || entry.name;
}
function manifestFromCore(raw) {
    const torrent = raw.torrent
        ? Object.freeze({
            ...(raw.torrent.infoHashV1 ? { infoHashV1: raw.torrent.infoHashV1 } : {}),
            ...(raw.torrent.infoHashV2 ? { infoHashV2: raw.torrent.infoHashV2 } : {}),
        })
        : undefined;
    return Object.freeze({
        ...(raw.name ? { name: raw.name } : {}),
        ...(torrent ? { torrent } : {}),
        entries: Object.freeze(raw.entries.map((entry) => Object.freeze({
            name: entry.name,
            ...(entry.path ? { path: entry.path } : {}),
            ...(typeof entry.size === "number" ? { size: entry.size } : {}),
            ...(typeof entry.knownSize === "number" ? { knownSize: entry.knownSize } : {}),
            ...(entry.sha256 ? { sha256: entry.sha256 } : {}),
            kind: entry.kind,
            address: entry.address,
            ...(entry.dataMap ? { dataMap: entry.dataMap } : {}),
        }))),
    });
}
/** Create a portable `.ant` file and share link offline through the Rust encoder. */
export async function createManifest(input, options = {}) {
    throwIfAborted(options.signal);
    let copied;
    try {
        copied = structuredClone(input);
    }
    catch (error) {
        throw wrapError("INVALID_SOURCE", "Could not copy the manifest input", error);
    }
    await abortable(initializeClientWasm(options.wasm), options.signal);
    throwIfAborted(options.signal);
    try {
        const raw = getBindings().createManifest(copied);
        return Object.freeze({ ...raw, manifest: manifestFromCore(raw.manifest) });
    }
    catch (error) {
        throw wrapError("INVALID_SOURCE", "Could not create the manifest", error);
    }
}
/** Format a public file share link using the shared core's address grammar. */
export async function createFileLink(address, options = {}) {
    throwIfAborted(options.signal);
    await abortable(initializeClientWasm(options.wasm), options.signal);
    throwIfAborted(options.signal);
    try {
        return getBindings().createFileLink(address);
    }
    catch (error) {
        throw wrapError("INVALID_SOURCE", "Could not create a file link", error);
    }
}
//# sourceMappingURL=manifest.js.map