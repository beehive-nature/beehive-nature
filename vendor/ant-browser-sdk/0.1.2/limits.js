import { AutonomiError } from "./errors.js";
const MAX_FILE_BYTES = 1_000_000_000;
/** Limits of the bundled core and media worker. Browser memory/storage may impose lower limits. */
export const SDK_LIMITS = Object.freeze({
    minFileBytes: 3,
    maxFileBytes: MAX_FILE_BYTES,
    maxRangeBytes: 4 * 1024 * 1024,
    defaultStreamChunkBytes: 1024 * 1024,
    downloadConcurrency: Object.freeze({ min: 1, max: 256, default: "auto" }),
    mediaMaxFileBytes: MAX_FILE_BYTES,
});
/** @internal Validate before copying bytes, staging, or starting network work. */
export function assertFileSize(size) {
    if (!Number.isSafeInteger(size) || size < SDK_LIMITS.minFileBytes || size > SDK_LIMITS.maxFileBytes) {
        throw new AutonomiError("INVALID_SOURCE", `File size must be an integer from ${SDK_LIMITS.minFileBytes} through ${SDK_LIMITS.maxFileBytes} bytes`);
    }
}
//# sourceMappingURL=limits.js.map