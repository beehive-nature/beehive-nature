/** Passive, immutable feature report. Safe outside a browser; never requests permissions or initializes WASM. */
export function getBrowserCapabilities() {
    const checks = {
        window: () => typeof window === "object" && window !== null,
        secureContext: () => globalThis.isSecureContext === true,
        webAssembly: () => typeof WebAssembly === "object" && WebAssembly !== null && typeof WebAssembly.compile === "function",
        webRtc: () => typeof RTCPeerConnection === "function",
        crypto: () => typeof crypto === "object" && crypto !== null && typeof crypto.getRandomValues === "function",
        worker: () => typeof Worker === "function",
        indexedDb: () => typeof indexedDB === "object" && indexedDB !== null && typeof indexedDB.open === "function",
        readableStream: () => typeof ReadableStream === "function",
        blob: () => typeof Blob === "function",
        serviceWorker: () => typeof navigator === "object" && navigator !== null && !!navigator.serviceWorker,
        messageChannel: () => typeof MessageChannel === "function",
        filePicker: () => typeof window === "object" && window !== null &&
            typeof window.showSaveFilePicker === "function",
        document: () => typeof document === "object" && document !== null && typeof document.createElement === "function",
        objectUrls: () => typeof URL === "function" && typeof URL.createObjectURL === "function" && typeof URL.revokeObjectURL === "function",
    };
    const features = Object.freeze(Object.fromEntries(Object.entries(checks).map(([feature, check]) => {
        // Restricted origins may throw merely on access to an API such as IndexedDB.
        try {
            return [feature, check()];
        }
        catch {
            return [feature, false];
        }
    })));
    const support = (...required) => {
        const missing = Object.freeze(required.filter((feature) => !features[feature]));
        return Object.freeze({ available: missing.length === 0, missing });
    };
    const connection = ["window", "webAssembly", "webRtc", "crypto"];
    return Object.freeze({
        features,
        operations: Object.freeze({
            connect: support(...connection),
            uploadBytes: support(...connection),
            uploadBlob: support(...connection, "blob", "worker", "indexedDb"),
            download: support(...connection, "blob"),
            read: support(...connection),
            stream: support(...connection, "readableStream"),
            media: support(...connection, "secureContext", "serviceWorker", "messageChannel", "readableStream"),
            saveWithPicker: support("window", "secureContext", "filePicker"),
            saveWithDownload: support("document", "objectUrls"),
        }),
    });
}
//# sourceMappingURL=capabilities.js.map