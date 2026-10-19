import { AutonomiError, errorMessage } from "../errors.js";
import { SDK_LIMITS } from "../limits.js";
import { getBrowserCapabilities } from "../capabilities.js";
import { abortable, abortReason, throwIfAborted } from "./abort.js";
export class MediaBridge {
    #sessions = new Map();
    #workerUrl;
    #scope;
    #messageListenerAttached = false;
    constructor() { }
    async attach(reader, options) {
        throwIfAborted(options.signal);
        if (!Number.isSafeInteger(reader.size) || reader.size < SDK_LIMITS.minFileBytes || reader.size > SDK_LIMITS.mediaMaxFileBytes) {
            throw new AutonomiError("MEDIA_FAILED", `Media file size must be from ${SDK_LIMITS.minFileBytes} through ${SDK_LIMITS.mediaMaxFileBytes} bytes`);
        }
        const { features } = getBrowserCapabilities();
        if (!features.secureContext || !features.serviceWorker) {
            throw new AutonomiError("MEDIA_FAILED", "Media streaming requires a secure context (HTTPS; localhost is allowed) with service-worker support");
        }
        const workerUrl = new URL(options.serviceWorkerUrl ?? "/autonomi-stream-sw.js", location.href).href;
        const scope = normalizeScope(options.scope ?? "/");
        await this.#ensureWorker(workerUrl, scope, options.signal);
        throwIfAborted(options.signal);
        if (!this.#messageListenerAttached) {
            navigator.serviceWorker.addEventListener("message", this.#onMessage);
            this.#messageListenerAttached = true;
        }
        const sessionId = randomSessionId();
        const url = new URL(`__autonomi_stream/${sessionId}/file`, new URL(scope, location.origin));
        url.searchParams.set("size", String(reader.size));
        url.searchParams.set("type", reader.contentType || "application/octet-stream");
        url.searchParams.set("name", reader.name);
        let closed = false;
        const source = {
            url: url.href,
            file: {
                address: reader.address,
                name: reader.name,
                size: reader.size,
                contentType: reader.contentType,
            },
            close: () => {
                if (closed)
                    return;
                closed = true;
                this.#sessions.delete(sessionId);
                reader.close();
            },
        };
        this.#sessions.set(sessionId, { reader, source });
        return source;
    }
    close() {
        for (const { source } of this.#sessions.values()) {
            try {
                source.close();
            }
            catch {
                // Continue releasing the remaining media readers.
            }
        }
        this.#sessions.clear();
        if (this.#messageListenerAttached) {
            navigator.serviceWorker.removeEventListener("message", this.#onMessage);
            this.#messageListenerAttached = false;
        }
    }
    #onMessage = async (event) => {
        const data = event.data;
        if (data?.type !== "autonomi-file-range")
            return;
        // Every bridge on this page receives this event. Only the owner may reply
        // through the shared response port.
        if (typeof data.sessionId !== "string" || !this.#sessions.has(data.sessionId))
            return;
        const port = event.ports[0];
        if (!port)
            return;
        try {
            const { start, length } = data;
            if (typeof data.sessionId !== "string" ||
                typeof start !== "number" ||
                typeof length !== "number" ||
                !Number.isSafeInteger(start) ||
                !Number.isSafeInteger(length) ||
                start < 0 ||
                length < 0) {
                throw new Error("The service worker requested an invalid file range");
            }
            const session = this.#sessions.get(data.sessionId);
            if (!session)
                return;
            const bytes = await session.reader.read(start, length);
            const owned = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
                ? bytes
                : bytes.slice();
            port.postMessage({ ok: true, bytes: owned.buffer }, [owned.buffer]);
        }
        catch (error) {
            port.postMessage({ ok: false, error: errorMessage(error) });
        }
    };
    async #ensureWorker(workerUrl, scope, signal) {
        if (!("serviceWorker" in navigator)) {
            throw new AutonomiError("MEDIA_FAILED", "Media streaming requires a secure context (HTTPS; localhost is allowed) with service-worker support");
        }
        this.#assertWorkerLocation(workerUrl, scope);
        const scopeUrl = new URL(scope, location.origin).href;
        const registrations = await abortable(navigator.serviceWorker.getRegistrations(), signal);
        const existing = registrations.find((registration) => registration.scope === scopeUrl);
        const newestWorker = existing?.installing ?? existing?.waiting ?? existing?.active;
        if (newestWorker && newestWorker.scriptURL !== workerUrl) {
            throw new AutonomiError("MEDIA_FAILED", `A different service worker is already registered for ${scopeUrl}; ` +
                "merge the Autonomi media bridge into that worker and pass its URL as serviceWorkerUrl");
        }
        // Another attach may have selected a location while registrations were loading.
        this.#assertWorkerLocation(workerUrl, scope);
        this.#workerUrl = workerUrl;
        this.#scope = scope;
        throwIfAborted(signal);
        const registration = existing && newestWorker
            ? existing
            : await abortable(navigator.serviceWorker.register(workerUrl, { scope }), signal);
        await abortable(navigator.serviceWorker.ready, signal);
        if (navigator.serviceWorker.controller?.scriptURL === workerUrl)
            return;
        if (registration.active?.scriptURL === workerUrl) {
            await waitForController(workerUrl, signal);
            return;
        }
        await waitForController(workerUrl, signal);
    }
    #assertWorkerLocation(workerUrl, scope) {
        if (this.#workerUrl && (this.#workerUrl !== workerUrl || this.#scope !== scope)) {
            throw new AutonomiError("MEDIA_FAILED", "One client cannot use multiple Autonomi media service-worker locations");
        }
    }
}
function normalizeScope(scope) {
    const path = new URL(scope, location.origin).pathname;
    return path.endsWith("/") ? path : `${path}/`;
}
function randomSessionId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function waitForController(workerUrl, signal) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let timeout;
        const cleanup = () => {
            if (timeout !== undefined)
                clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener("controllerchange", changed);
            signal?.removeEventListener("abort", aborted);
        };
        const changed = () => {
            if (settled)
                return;
            if (navigator.serviceWorker.controller?.scriptURL !== workerUrl)
                return;
            settled = true;
            cleanup();
            resolve();
        };
        const aborted = () => {
            if (settled || !signal)
                return;
            settled = true;
            cleanup();
            reject(abortReason(signal));
        };
        timeout = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(new AutonomiError("MEDIA_FAILED", "The media service worker did not take control of this page; reload once and retry"));
        }, 10_000);
        navigator.serviceWorker.addEventListener("controllerchange", changed);
        if (signal?.aborted)
            aborted();
        else {
            signal?.addEventListener("abort", aborted, { once: true });
            changed();
        }
    });
}
//# sourceMappingURL=media.js.map