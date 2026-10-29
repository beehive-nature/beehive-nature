import { snapshot } from "./internal/snapshot.js";
/**
 * Pause a paid upload after quote verification until the application explicitly
 * calls `request.pay()`. The provider selected at that point owns wallet submission.
 */
export function createManualPaymentProvider(options) {
    if (!options || typeof options.onRequest !== "function") {
        throw new TypeError("Manual payment requires an onRequest callback");
    }
    if (options.payment && typeof options.payment.pay !== "function") {
        throw new TypeError("The default wallet must be a PaymentProvider");
    }
    let recoveryPayment = options.payment;
    function recoveryProvider() {
        if (!recoveryPayment)
            throw new Error("Select a wallet provider with payment recovery support");
        return recoveryPayment;
    }
    async function review(network, quotes, context, merkle, submit) {
        const paymentNetwork = snapshot(network);
        const paymentQuotes = snapshot(quotes);
        const totalAmountAtto = merkle ? merkle.maximumAmount : quoteTotal(paymentQuotes);
        if (!/^\d+$/u.test(totalAmountAtto))
            throw new TypeError("Storage payment has a non-decimal amount");
        let status = "pending";
        let walletPayment;
        let resolveUpload;
        let rejectUpload;
        const uploadPayment = new Promise((resolve, reject) => {
            resolveUpload = resolve;
            rejectUpload = reject;
        });
        const request = {
            network: paymentNetwork,
            quotes: paymentQuotes,
            totalAmountAtto,
            ...(merkle ? { merkle } : {}),
            get status() {
                return status;
            },
            pay(payment = options.payment) {
                if (walletPayment)
                    return walletPayment;
                if (status !== "pending") {
                    return Promise.reject(new Error(`Storage payment cannot start while request is ${status}`));
                }
                if (!payment || typeof payment.pay !== "function") {
                    return Promise.reject(new Error("Select a wallet PaymentProvider before paying"));
                }
                if (merkle && typeof payment.payMerkle !== "function") {
                    return Promise.reject(new Error("Select a wallet PaymentProvider with payMerkle support"));
                }
                recoveryPayment = payment;
                status = "paying";
                walletPayment = Promise.resolve().then(() => submit(payment));
                void walletPayment.then((receipt) => {
                    status = "paid";
                    resolveUpload(receipt);
                }, (error) => {
                    status = "failed";
                    rejectUpload(error);
                });
                return walletPayment;
            },
            cancel(reason) {
                if (status !== "pending")
                    return false;
                status = "cancelled";
                rejectUpload(cancellationError(reason));
                return true;
            },
        };
        Object.freeze(request);
        const abort = () => {
            if (context.signal)
                request.cancel(context.signal.reason);
        };
        if (context.signal?.aborted)
            abort();
        else
            context.signal?.addEventListener("abort", abort, { once: true });
        try {
            if (status === "pending") {
                const notified = options.onRequest(request);
                void Promise.resolve(notified).catch((error) => request.cancel(error));
            }
        }
        catch (error) {
            request.cancel(error);
        }
        try {
            return await uploadPayment;
        }
        finally {
            context.signal?.removeEventListener("abort", abort);
        }
    }
    return {
        async pay(network, quotes, context) {
            if (quotes.length === 0)
                return { totalAmount: "0" };
            const savedNetwork = snapshot(network);
            const savedQuotes = snapshot(quotes);
            return review(savedNetwork, savedQuotes, context, undefined, payment => payment.pay(savedNetwork, savedQuotes, context));
        },
        async payMerkle(network, request, context) {
            const savedNetwork = snapshot(network);
            const savedRequest = snapshot(request);
            return review(savedNetwork, [], context, savedRequest, payment => payment.payMerkle(savedNetwork, savedRequest, context));
        },
        async recover(network, quotes, attempt, context) {
            const payment = recoveryProvider();
            if (!payment.recover)
                throw new Error("Wallet PaymentProvider does not support journal recovery; no new payment was requested");
            return payment.recover(network, quotes, attempt, context);
        },
        async recoverMerkle(network, request, attempt, context) {
            const payment = recoveryProvider();
            if (!payment.recoverMerkle)
                throw new Error("Wallet PaymentProvider does not support Merkle journal recovery; no new payment was requested");
            return payment.recoverMerkle(network, request, attempt, context);
        },
    };
}
function quoteTotal(quotes) {
    let total = 0n;
    for (const quote of quotes) {
        if (!/^\d+$/u.test(quote.amount)) {
            throw new TypeError("Verified storage quote has a non-decimal amount");
        }
        total += BigInt(quote.amount);
    }
    return total.toString();
}
function cancellationError(reason) {
    if (reason instanceof Error)
        return reason;
    if (typeof reason === "string" && reason !== "")
        return new Error(reason);
    return new Error("Storage payment was cancelled");
}
//# sourceMappingURL=manual-payment.js.map