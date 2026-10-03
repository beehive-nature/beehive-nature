import { deleteStagedSession, deleteUploadCheckpoint } from "./record-store.js";
import { AutonomiError } from "../errors.js";
import { newStagingSessionId } from "./staging.js";
import { snapshot } from "./snapshot.js";
import { abortable, isAbort } from "./abort.js";
const states = new WeakMap();
export function retainUpload(network, input, id) {
    const { name, contentType, visibility } = input;
    const size = "blob" in input ? input.blob.size : input.bytes.byteLength;
    let discarding;
    const handle = Object.freeze({
        id, name, size, contentType, visibility,
        get status() { return state.status; },
        get payments() { return Object.freeze([...state.payments]); },
        get pendingPayments() { return Object.freeze(state.submissions.filter(({ handle }) => handle.status === "pending").map(({ handle }) => handle)); },
        get settled() { return state.settled; },
        discard() {
            if (state.status === "completed" || state.status === "discarded")
                return Promise.resolve();
            if (state.status === "active") {
                return Promise.reject(new AutonomiError("UPLOAD_IN_PROGRESS", "Wait for the active upload before discarding its recovery"));
            }
            if (discarding)
                return discarding;
            state.status = "discarding";
            discarding = state.settled.then(() => releaseUpload(state, "discarded")).catch((error) => {
                state.status = "ready";
                discarding = undefined;
                throw error;
            });
            return discarding;
        },
    });
    const state = {
        handle, network: snapshot(network), size,
        ...input, payments: [], paymentTasks: [], submissions: [], status: "active", settled: Promise.resolve(),
        ...("blob" in input
            ? { cursor: { sessionId: newStagingSessionId(), nextRecord: 0, windowed: false, usedMerkle: false } }
            : {}),
    };
    states.set(handle, state);
    return state;
}
export function recordPayment(state, network, quotes, receipt, merkle) {
    validateReceipt(receipt, quotes, merkle);
    if (merkle && (!("winnerPoolHash" in receipt) || typeof receipt.winnerPoolHash !== "string"))
        throw new Error("Merkle receipt is missing its winner");
    const existing = state.payments.find((payment) => sameNetwork(payment.network, network) &&
        payment.receipt.transactionHash === receipt.transactionHash && payment.receipt.totalAmount === receipt.totalAmount &&
        payment.merkle?.calldata === merkle?.calldata &&
        payment.quotes.length === quotes.length && payment.quotes.every((quote, index) => {
        const other = quotes[index];
        return quote.quoteHash === other.quoteHash && quote.amount === other.amount && quote.rewardsAddress === other.rewardsAddress;
    }));
    if (existing)
        return existing;
    const payment = snapshot({ network, quotes, receipt, ...(merkle ? { merkle } : {}) });
    state.payments.push(payment);
    return payment;
}
export function trackPayment(state, network, quotes, submission, merkle) {
    validateReceipt(submission, quotes, merkle);
    if (typeof submission.wait !== "function")
        throw new TypeError("Payment submission requires a wait() observer");
    let outcome;
    let observing;
    const finish = (settlement) => {
        if (outcome)
            return outcome;
        if (settlement.status === "confirmed") {
            const recorded = recordPayment(state, network, quotes, settlement.receipt, merkle);
            if (recorded.receipt.transactionHash === undefined)
                throw new Error("Submitted payment has no transaction hash");
            outcome = Object.freeze({ status: "confirmed", receipt: recorded.receipt });
        }
        else if (settlement.status === "failed") {
            outcome = Object.freeze({ ...settlement });
        }
        else {
            throw new TypeError("Invalid payment settlement");
        }
        return outcome;
    };
    const handle = Object.freeze({
        network, quotes, ...(merkle ? { merkle } : {}),
        submission: snapshot({ transactionHash: submission.transactionHash, totalAmount: submission.totalAmount,
            ...(submission.walletAddress === undefined ? {} : { walletAddress: submission.walletAddress }) }),
        get status() { return outcome?.status ?? "pending"; },
        reconcile() {
            if (outcome)
                return Promise.resolve(outcome);
            if (!observing) {
                observing = Promise.resolve().then(() => submission.wait()).then(finish).finally(() => { observing = undefined; });
                state.paymentTasks.push(observing);
            }
            return observing;
        },
    });
    const tracked = {
        handle,
        confirm(receipt) {
            if (receipt.transactionHash === undefined)
                throw new Error("Submitted payment has no transaction hash");
            finish({ status: "confirmed", receipt });
        },
    };
    state.submissions.push(tracked);
    return tracked;
}
export async function reconcilePayments(state, signal) {
    for (const { handle } of state.submissions) {
        if (handle.status !== "pending")
            continue;
        try {
            await abortable(handle.reconcile(), signal);
        }
        catch (error) {
            if (isAbort(error, signal))
                throw error;
            throw new AutonomiError("PAYMENT_UNRESOLVED", "A submitted storage payment is still unresolved; retry confirmation before paying again", error);
        }
    }
}
function retainedUpload(handle) {
    const state = states.get(handle);
    if (!state)
        throw new AutonomiError("INVALID_SOURCE", "Recovery must come from this SDK instance");
    return state;
}
export function uploadSettlement(handle) {
    return retainedUpload(handle).settled;
}
export function claimUpload(handle, network) {
    const state = retainedUpload(handle);
    if (state.status === "completed" || state.status === "discarded") {
        throw new AutonomiError("INVALID_SOURCE", `Upload recovery is ${state.status}`);
    }
    if (state.status !== "ready") {
        throw new AutonomiError("UPLOAD_IN_PROGRESS", `Upload recovery is ${state.status}`);
    }
    if (!sameNetwork(state.network, network)) {
        throw new AutonomiError("INVALID_SOURCE", "Resume on the original payment network and contracts");
    }
    state.status = "active";
    state.paymentTasks = [];
    return state;
}
export function awaitUploadSettlement(state) {
    state.status = "settling";
    state.settled = Promise.allSettled([state.work, ...state.paymentTasks]).then(() => {
        if (state.status === "settling")
            state.status = "ready";
        state.paymentTasks = [];
        delete state.work;
    });
}
export async function releaseUpload(state, status) {
    if (state.cursor)
        await deleteStagedSession(state.cursor.sessionId);
    if (state.checkpointStoredLocally)
        await deleteUploadCheckpoint(state.handle.id);
    delete state.cursor;
    delete state.blob;
    delete state.bytes;
    delete state.work;
    state.paymentTasks = [];
    state.status = status;
}
export function quoteTotal(quotes) {
    return quotes.reduce((total, quote) => {
        if (!/^\d+$/u.test(quote.amount))
            throw new Error("Storage quote has a non-decimal amount");
        return total + BigInt(quote.amount);
    }, 0n).toString();
}
export function validateReceipt(receipt, quotes, merkle) {
    if (merkle) {
        if (!/^\d+$/u.test(receipt.totalAmount) || BigInt(receipt.totalAmount) > BigInt(merkle.maximumAmount) || !receipt.transactionHash) {
            throw new Error("Invalid Merkle payment receipt");
        }
        if ("winnerPoolHash" in receipt && receipt.winnerPoolHash !== undefined && !merkle.poolHashes.includes(receipt.winnerPoolHash.replace(/^0x/u, "").toLowerCase())) {
            throw new Error("Merkle receipt winner is outside the prepared pools");
        }
        return;
    }
    if (!/^\d+$/u.test(receipt.totalAmount) || receipt.totalAmount !== quoteTotal(quotes)) {
        throw new Error("Payment provider returned a totalAmount that does not match the verified quotes");
    }
    if (quotes.length > 0 || receipt.transactionHash !== undefined) {
        if (typeof receipt.transactionHash !== "string" || receipt.transactionHash.trim() === "") {
            throw new Error("Payment provider must return a non-empty transactionHash for a paid plan");
        }
    }
}
/** The core accepts one transaction hash for the entire current plan. */
export function paidReceipt(state, network, quotes) {
    if (quotes.length === 0)
        return { totalAmount: "0" };
    for (const payment of state.payments) {
        if (!sameNetwork(payment.network, network))
            continue;
        try {
            validateReceipt(payment.receipt, payment.quotes);
        }
        catch {
            continue;
        }
        if (payment.receipt.transactionHash === undefined)
            continue;
        const paid = new Map(payment.quotes.map((quote) => [normalizedHash(quote.quoteHash), quote]));
        const seen = new Set();
        if (quotes.every((quote) => {
            const hash = normalizedHash(quote.quoteHash);
            const previous = paid.get(hash);
            if (seen.has(hash))
                return false;
            seen.add(hash);
            return previous && previous.amount === quote.amount &&
                previous.rewardsAddress.toLowerCase() === quote.rewardsAddress.toLowerCase();
        }))
            return { ...payment.receipt, totalAmount: quoteTotal(quotes) };
    }
    return undefined;
}
export function uploadResult(state, uploaded) {
    const last = state.payments.at(-1)?.receipt.transactionHash;
    const transactionHash = uploaded.transactionHash ?? last;
    return {
        file: uploaded.file,
        records: uploaded.records,
        paymentMode: uploaded.paymentMode === "merkle" ? "merkle" : "single",
        ...(transactionHash ? { transactionHash } : {}),
        storageCostAtto: state.payments.reduce((sum, payment) => sum + BigInt(payment.receipt.totalAmount), 0n).toString(),
        payments: Object.freeze([...state.payments]),
    };
}
function sameNetwork(a, b) {
    return a.chainId === b.chainId &&
        a.paymentTokenAddress.toLowerCase() === b.paymentTokenAddress.toLowerCase() &&
        a.paymentVaultAddress.toLowerCase() === b.paymentVaultAddress.toLowerCase();
}
function normalizedHash(hash) {
    return hash.toLowerCase().replace(/^0x/u, "");
}
//# sourceMappingURL=upload-recovery.js.map