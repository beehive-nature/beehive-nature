import { AutonomiError } from "./errors.js";
const MAX_UPLOAD_BYTES = 1_000_000_000;
/** The earlier fixed download cap, kept as the default buffered-download budget. */
const DEFAULT_DOWNLOAD_MEMORY_BYTES = 1_000_000_000;
/** Limits of the bundled core and media worker. Browser memory/storage may impose lower limits. */
export const SDK_LIMITS = Object.freeze({
    minFileBytes: 3,
    /** Upload limit, retained for compatibility. Streaming downloads have no fixed size cap. */
    maxFileBytes: MAX_UPLOAD_BYTES,
    maxUploadBytes: MAX_UPLOAD_BYTES,
    maxRangeBytes: 4 * 1024 * 1024,
    defaultStreamChunkBytes: 1024 * 1024,
    downloadConcurrency: Object.freeze({ min: 1, max: 256, default: "auto" }),
    /**
     * Default `maxMemoryBytes` for buffered `download()` and `downloadAndSave()`.
     * Pass a larger budget explicitly, or stream with `streamAndSave()` or `pipeTo()`.
     */
    defaultDownloadMemoryBytes: DEFAULT_DOWNLOAD_MEMORY_BYTES,
    /** Largest exact byte position supported by JavaScript and the core. */
    mediaMaxFileBytes: Number.MAX_SAFE_INTEGER,
    /** Bytes read from the start of a media file when a media source is created. */
    mediaPrimeHeadBytes: 1024 * 1024,
    /** Bytes read from the end of a media file when a media source is created. */
    mediaPrimeTailBytes: 64 * 1024,
});
/** @internal Validate before copying bytes, staging, or starting network work. */
export function assertFileSize(size) {
    if (!Number.isSafeInteger(size) || size < SDK_LIMITS.minFileBytes || size > SDK_LIMITS.maxFileBytes) {
        throw new AutonomiError("INVALID_SOURCE", `File size must be an integer from ${SDK_LIMITS.minFileBytes} through ${SDK_LIMITS.maxFileBytes} bytes`);
    }
}
//# sourceMappingURL=limits.js.map