export function corePaymentNetwork(network) {
    return {
        chain_id: network.chainId,
        payment_token_address: network.paymentTokenAddress,
        payment_vault_address: network.paymentVaultAddress,
    };
}
/** Restore the pinned identity only for the configuration passed to the core. */
export function paymentNetworkFromCore(value, expected) {
    if (typeof value !== "object" || value === null) {
        throw new Error("The core requested payment with an invalid network configuration");
    }
    const network = value;
    for (const [key, configuredValue] of Object.entries(corePaymentNetwork(expected))) {
        if (network[key] !== configuredValue) {
            throw new Error("The core requested payment on a different network configuration");
        }
    }
    return expected;
}
export function assertPaymentChainId(chainId) {
    if (!Number.isSafeInteger(chainId) || chainId < 0) {
        throw new TypeError("Payment chainId must be a non-negative safe integer");
    }
}
//# sourceMappingURL=payment-network.js.map