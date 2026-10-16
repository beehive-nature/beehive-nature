import { getBindings, initializeClientWasm } from "./internal/runtime.js";
import { abortable, throwIfAborted } from "./internal/abort.js";
import { AutonomiError } from "./errors.js";
/** Read mainnet WebRTC seeds and payment defaults from the bundled Rust core. No network dial or EVM RPC. */
export async function getNetworkDefaults(options = {}) {
    throwIfAborted(options.signal);
    await abortable(initializeClientWasm(options.wasm), options.signal);
    throwIfAborted(options.signal);
    const raw = getBindings().mainnetNetworkDefaults();
    return Object.freeze({
        id: raw.id,
        seeds: Object.freeze([...raw.seeds]),
        payment: Object.freeze({
            chainId: raw.payment.chain_id,
            paymentTokenAddress: raw.payment.payment_token_address,
            paymentVaultAddress: raw.payment.payment_vault_address,
        }),
        rpcUrl: raw.rpc_url,
    });
}
/** Copy a bundled profile before any asynchronous callbacks can alter it. */
export function snapshotNetworkProfile(profile) {
    if (profile.seeds.length === 0) {
        throw new AutonomiError("CONNECTION_FAILED", `No WebRTC bootstrap seeds configured for ${profile.id}; supply a trusted network profile or an explicit WebRTC multiaddress`);
    }
    if (!profile.id || new Set(profile.seeds).size !== profile.seeds.length) {
        throw new TypeError("Network profiles require a name and distinct trusted seeds");
    }
    return Object.freeze({ id: profile.id, seeds: Object.freeze([...profile.seeds]), payment: Object.freeze({ ...profile.payment }) });
}
//# sourceMappingURL=network-profile.js.map