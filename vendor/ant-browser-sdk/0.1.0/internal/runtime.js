import initAntCore, { BrowserNetworkClient, parseWebRtcDirectMultiaddr, decodeMerklePaymentReceipt, encryptPublicFile, mainnetNetworkDefaults, } from "../wasm/ant_core.js";
import { AutonomiError } from "../errors.js";
let initialization;
/** Initialize the page's shared WASM module. Later explicit sources must match. */
export async function initializeWasm(source) {
    await initializeClientWasm(source);
}
/** The very same compiled module is used by the page and every upload worker. */
export async function initializeClientWasm(source) {
    try {
        if (!initialization) {
            const state = {
                requested: source,
                promise: Promise.resolve().then(async () => {
                    const loaded = await loadSource(source);
                    state.loaded = loaded;
                    const module = loaded instanceof WebAssembly.Module
                        ? loaded : await WebAssembly.compile(loaded);
                    await initAntCore({ module_or_path: module });
                    return module;
                }),
            };
            initialization = state;
            void state.promise.catch(() => {
                if (initialization === state)
                    initialization = undefined;
            });
            return await state.promise;
        }
        const state = initialization;
        if (source === undefined || source === state.requested)
            return await state.promise;
        const [module, requested] = await Promise.all([state.promise, loadSource(source)]);
        if (requested === module || sameSource(state.loaded, requested))
            return module;
        throw new AutonomiError("INITIALIZATION_FAILED", "WASM is already initialized with a different source; omit wasm to reuse it or reload the page");
    }
    catch (error) {
        if (error instanceof AutonomiError)
            throw error;
        throw new AutonomiError("INITIALIZATION_FAILED", "Could not initialize the Autonomi WASM core", error);
    }
}
async function loadSource(source) {
    const resolved = await (source ?? new URL("../wasm/ant_core_bg.wasm", import.meta.url));
    if (resolved instanceof WebAssembly.Module)
        return resolved;
    if (resolved instanceof ArrayBuffer)
        return resolved.slice(0);
    if (ArrayBuffer.isView(resolved)) {
        return new Uint8Array(resolved.buffer, resolved.byteOffset, resolved.byteLength).slice().buffer;
    }
    const response = resolved instanceof Response ? resolved : await fetch(resolved);
    if (!response.ok)
        throw new Error(`Could not load Autonomi WASM (${response.status} ${response.statusText})`);
    return response.arrayBuffer();
}
function sameSource(left, right) {
    if (left === right)
        return true;
    if (!(left instanceof ArrayBuffer) || !(right instanceof ArrayBuffer))
        return false;
    const a = new Uint8Array(left);
    const b = new Uint8Array(right);
    return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
export function getBindings() {
    return {
        BrowserNetworkClient,
        parseWebRtcDirectMultiaddr,
        decodeMerklePaymentReceipt,
        encryptPublicFile,
        mainnetNetworkDefaults,
    };
}
//# sourceMappingURL=runtime.js.map