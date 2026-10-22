import { AutonomiError } from "../errors.js";
const WINDOW_CHECKPOINT_FORMAT = "autonomi-browser-sdk/upload-window";
const WINDOW_CHECKPOINT_VERSION = 1;
/**
 * A Rust checkpoint is scoped to the records of one upload call. When a file is
 * uploaded in several windows, the SDK records which window a checkpoint belongs
 * to so a restarted upload can stage exactly that window again. Checkpoints for
 * a file uploaded in one window stay plain Rust checkpoints.
 */
export function wrapWindowCheckpoint(checkpoint, window) {
    return JSON.stringify({
        format: WINDOW_CHECKPOINT_FORMAT,
        version: WINDOW_CHECKPOINT_VERSION,
        firstIndex: window.firstIndex,
        records: window.records,
        checkpoint,
    });
}
/** Returns undefined for a plain Rust checkpoint. */
export function unwrapWindowCheckpoint(value) {
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        return undefined;
    }
    if (typeof parsed !== "object" || parsed === null || !("format" in parsed) || parsed.format !== WINDOW_CHECKPOINT_FORMAT) {
        return undefined;
    }
    const { version, firstIndex, records, checkpoint } = parsed;
    if (version !== WINDOW_CHECKPOINT_VERSION || !Number.isSafeInteger(firstIndex) || firstIndex < 0 ||
        !Number.isSafeInteger(records) || records < 1 || typeof checkpoint !== "string") {
        throw new AutonomiError("INVALID_SOURCE", "Unsupported or malformed windowed upload checkpoint");
    }
    return { window: { firstIndex: firstIndex, records: records }, checkpoint };
}
//# sourceMappingURL=window-checkpoint.js.map