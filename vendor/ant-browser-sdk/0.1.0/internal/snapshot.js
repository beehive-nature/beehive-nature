/** Snapshot JSON-like protocol metadata without exposing live internal state. */
export function snapshot(value) {
    return freeze(structuredClone(value));
}
function freeze(value) {
    if (value && typeof value === "object") {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
//# sourceMappingURL=snapshot.js.map