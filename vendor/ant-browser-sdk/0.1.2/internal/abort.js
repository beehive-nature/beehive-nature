export function abortReason(signal) {
    return signal.reason === undefined
        ? new DOMException("The operation was aborted", "AbortError")
        : signal.reason;
}
export function throwIfAborted(signal) {
    if (signal?.aborted)
        throw abortReason(signal);
}
export function isAbort(error, signal) {
    return ((signal?.aborted === true && error === signal.reason) ||
        (typeof error === "object" &&
            error !== null &&
            "name" in error &&
            error.name === "AbortError"));
}
/** Reject when the signal aborts while still observing the underlying promise. */
export function abortable(promise, signal, onAbort, onLateResolve) {
    if (!signal)
        return Promise.resolve(promise);
    return new Promise((resolve, reject) => {
        let settled = false;
        let aborted = false;
        const abort = () => {
            if (settled)
                return;
            settled = true;
            aborted = true;
            const reason = abortReason(signal);
            try {
                onAbort?.(reason);
            }
            catch {
                // Cancellation cleanup must not replace the signal's reason.
            }
            reject(reason);
        };
        if (signal.aborted)
            abort();
        else
            signal.addEventListener("abort", abort, { once: true });
        void Promise.resolve(promise).then((value) => {
            if (aborted) {
                try {
                    onLateResolve?.(value);
                }
                catch {
                    // A late resource cleanup has no caller left to observe its error.
                }
                return;
            }
            if (settled)
                return;
            settled = true;
            signal.removeEventListener("abort", abort);
            resolve(value);
        }, (error) => {
            if (settled)
                return;
            settled = true;
            signal.removeEventListener("abort", abort);
            reject(error);
        });
    });
}
//# sourceMappingURL=abort.js.map