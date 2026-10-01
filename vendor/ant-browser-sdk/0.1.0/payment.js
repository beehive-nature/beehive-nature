/** Share receipt observation, retry transient failures, and cache definitive outcomes. */
export function createPaymentSubmission(info, observe) {
    if (typeof info.transactionHash !== "string" || info.transactionHash.trim() === "" ||
        typeof info.totalAmount !== "string" || !/^\d+$/u.test(info.totalAmount) || typeof observe !== "function") {
        throw new TypeError("Payment submission requires a transaction hash, decimal total, and observer");
    }
    let pending;
    return Object.freeze({
        transactionHash: info.transactionHash,
        totalAmount: info.totalAmount,
        ...(info.walletAddress === undefined ? {} : { walletAddress: info.walletAddress }),
        wait() {
            pending ??= Promise.resolve().then(observe).then((settlement) => {
                if (settlement.status === "confirmed") {
                    return Object.freeze({ ...settlement, receipt: Object.freeze({ ...settlement.receipt }) });
                }
                if (settlement.status !== "failed")
                    throw new TypeError("Invalid payment settlement");
                return Object.freeze({ ...settlement });
            }).catch((error) => {
                pending = undefined;
                throw error;
            });
            return pending;
        },
    });
}
/** @internal Keep adapters' receipt-returning pay() boundary. */
export async function confirmedPayment(submission) {
    const settlement = await submission.wait();
    if (settlement.status === "failed")
        throw settlement.cause ?? new Error(settlement.reason);
    return settlement.receipt;
}
//# sourceMappingURL=payment.js.map