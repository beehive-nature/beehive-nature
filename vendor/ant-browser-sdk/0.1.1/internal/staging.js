import { getBrowserCapabilities } from "../capabilities.js";
import { getStagedRecord } from "./record-store.js";
import { abortable, throwIfAborted } from "./abort.js";
/** Keep this much quota free for checkpoints and other origin data. */
const STAGING_RESERVE_BYTES = 16 * 1024 * 1024;
/** IndexedDB stores each record with some overhead beyond its byte length. */
const STAGING_OVERHEAD_FACTOR = 1.05;
export function newStagingSessionId() {
    if (typeof crypto.randomUUID === "function")
        return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function assertStagingSupported() {
    const { features } = getBrowserCapabilities();
    if (!features.worker || !features.indexedDb) {
        throw new Error("File uploads require Web Workers and IndexedDB in this browser");
    }
}
/** Ask the browser not to evict staged records under storage pressure. */
export async function requestPersistentStaging() {
    try {
        await globalThis.navigator?.storage?.persist?.();
    }
    catch {
        // Persistence is an eviction hint. IndexedDB remains usable when denied.
    }
}
/** Bytes the next window may stage; unbounded when the browser gives no estimate. */
export async function stagingBudget() {
    const storage = globalThis.navigator?.storage;
    if (!storage?.estimate)
        return Number.POSITIVE_INFINITY;
    const { quota, usage = 0 } = await storage.estimate();
    if (quota === undefined)
        return Number.POSITIVE_INFINITY;
    return Math.max(0, Math.floor((quota - usage - STAGING_RESERVE_BYTES) / STAGING_OVERHEAD_FACTOR));
}
export function openStagingSession(options) {
    const worker = new Worker(new URL("../upload-worker.js", import.meta.url), { type: "module" });
    let closed = false;
    let failure;
    let request;
    const fail = (error) => {
        failure ??= error;
        const pending = request;
        request = undefined;
        pending?.reject(error);
    };
    const close = () => {
        if (closed)
            return;
        closed = true;
        worker.terminate();
        fail(new Error("Upload staging was stopped"));
    };
    worker.addEventListener("message", (event) => {
        const message = event.data;
        if (closed)
            return;
        if (message?.type === "progress") {
            try {
                options.report(message.message, {
                    phase: "staging", unit: "records", ...(message.completed === undefined ? {} : { completed: message.completed }),
                });
            }
            catch (error) {
                fail(error);
            }
        }
        else if (message?.type === "window") {
            const pending = request;
            request = undefined;
            pending?.resolve({
                firstIndex: message.firstIndex, records: message.records,
                ...(message.complete && message.file ? { file: message.file } : {}),
                ...(message.dataMap ? { dataMap: message.dataMap } : {}),
            });
        }
        else if (message?.type === "error") {
            fail(new Error(message.message));
        }
    });
    worker.addEventListener("error", (event) => {
        if (!closed)
            fail(new Error(event.message || "Upload encryption worker failed"));
    });
    try {
        worker.postMessage({
            type: "start", blob: options.blob, name: options.name, contentType: options.contentType,
            sessionId: options.sessionId, wasm: options.wasm, skip: options.skip, withholdDataMap: options.withholdDataMap,
        });
    }
    catch (error) {
        fail(error);
    }
    return {
        next(limit, signal) {
            throwIfAborted(signal);
            if (closed || failure !== undefined)
                return Promise.reject(failure ?? new Error("Upload staging was stopped"));
            if (request)
                return Promise.reject(new Error("An upload window is already being staged"));
            const staged = new Promise((resolve, reject) => { request = { resolve, reject }; });
            worker.postMessage({ type: "stage", limit });
            return abortable(staged, signal, close).catch((error) => {
                close();
                throw error;
            });
        },
        close,
    };
}
export async function loadStagedRecord(sessionId, index, expectedSize, signal) {
    throwIfAborted(signal);
    const content = await abortable(getStagedRecord(sessionId, index), signal);
    if (content.byteLength !== expectedSize) {
        throw new Error(`Staged upload record ${index + 1} has ${content.byteLength} bytes, expected ${expectedSize}`);
    }
    return content;
}
//# sourceMappingURL=staging.js.map