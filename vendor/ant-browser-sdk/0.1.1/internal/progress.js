import { throwIfAborted } from "./abort.js";
let sequence = 0;
const prefix = Math.random().toString(36).slice(2);
export function operationId() { return `${prefix}-${++sequence}`; }
export function progressReporter(operation, id, phase, notify, signal, parentOperationId) {
    let finished = false;
    let lastMessage = `${operation} started`;
    let current = { phase };
    const emit = (event) => {
        try {
            notify(Object.freeze(event));
        }
        catch { /* UI callbacks do not affect operation results. */ }
    };
    const identity = { operation, operationId: id, ...(parentOperationId === undefined ? {} : { parentOperationId }) };
    const report = (message, details) => {
        if (finished)
            return;
        throwIfAborted(signal);
        if (details)
            current = details;
        lastMessage = message;
        emit({ ...identity, message, ...current, status: "running" });
        // A listener may synchronously cancel this operation.
        throwIfAborted(signal);
    };
    report.finish = (outcome = { status: "succeeded" }) => {
        if (finished)
            return;
        finished = true;
        emit({ ...identity, ...current, message: lastMessage,
            ...(outcome.status === "succeeded" ? { phase: "complete" } : {}), ...outcome });
    };
    return report;
}
//# sourceMappingURL=progress.js.map